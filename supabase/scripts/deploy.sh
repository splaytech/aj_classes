#!/usr/bin/env bash
# Sets up (or updates) the hosted Supabase project for the portal and lead capture
# (docs/requirements/release-2/go-live.md §3). Safe to run again after any change.
#
# Order matters: migrations first, checked by behaviour; the Auth settings that open sign-up last
# (ADR-0011). Sign-up is only ever open with the sign-up guard installed (the before-user-created
# hook, the linking and wipe triggers, users-by-default). If anything fails after sign-up was
# opened, the script closes it again and says so.
#
# Usage, from the repo root:
#   SUPABASE_ACCESS_TOKEN=… SUPABASE_DB_PASSWORD=… TURNSTILE_SECRET=… RESEND_API_KEY=… \
#   NOTIFY_WORKER_SECRET=… supabase/scripts/deploy.sh      # add --dry-run to print the steps only
#
# NOTIFY_WORKER_SECRET (ADR-0004): a long random value of your own, kept in your password manager.
# pg_cron sends it to the notifications function; it also goes into Vault (printed at the end).
#
# Optional, for Zoho CRM (leads-and-crm.md §4): ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
# ZOHO_REFRESH_TOKEN, and optionally ZOHO_LEAD_SOURCE (an exact value from your Lead Source list).
# Without them, enquiries are still saved; they just aren't sent to Zoho CRM.
#
# Google sign-in (ADR-0011): only when [remotes.production.auth.external.google] enabled = true in
# supabase/config.toml, also GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (release-notes.md).

set -euo pipefail

PROJECT_REF="unzjnxctkyahtmrkinyr" # [remotes.production] in supabase/config.toml
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
PUBLISHABLE_KEY="sb_publishable_RcrO-f-2jyjJyfTWNWy0IQ_1NwGbnhb" # public, same as apps/web/.env.production
SITE_ORIGINS="https://ajclasses.com.au,https://staging.ajclasses.com.au"
SITE_URL="https://ajclasses.com.au" # links in app emails; one database serves staging and prod
LOCAL_NOTIFY_SECRET="local-notify-secret" # supabase/config.toml, local only: never hosted
FUNCTIONS=(account-admin invite-redeem leads notifications)

# Secrets can also come from supabase/.env.deploy (git-ignored), so they never pass through chat
# or shell history. Values already in the environment win.
ENV_FILE="${DEPLOY_ENV_FILE:-$(dirname "$0")/../.env.deploy}" # the test points this at /dev/null
CONFIG_FILE="${DEPLOY_CONFIG:-$(dirname "$0")/../config.toml}"  # read only to see if Google is on
GUARD_RETRY_SECONDS="${DEPLOY_GUARD_RETRY_SECONDS:-3}"           # the test sets 0
MANAGEMENT_API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"
HOOK_URI="pg-functions://postgres/public/hook_before_user_created"
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_]+$ && -n "$value" && -z "${!key:-}" ]] && export "$key=$value"
  done < <(grep -E '^[A-Z_]+=' "$ENV_FILE")
fi

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

say() { printf '\n▶ %s\n' "$1"; }
fail() { printf '\n✖ %s\n' "$1" >&2; exit 1; }

# Prints a command for --dry-run without its secret values: the argument after --password, and
# the value of every NAME=value pair. (No command passes a secret on argv any more; this stays as
# a backstop.)
describe_command() {
  local shown=() hide_next=false arg
  for arg in "$@"; do
    if $hide_next; then
      shown+=("…")
      hide_next=false
    elif [[ "$arg" == "--password" ]]; then
      shown+=("$arg")
      hide_next=true
    elif [[ "$arg" =~ ^[A-Z_]+= ]]; then
      shown+=("${arg%%=*}=…")
    else
      shown+=("$arg")
    fi
  done
  printf '  (dry run) %s\n' "${shown[*]}"
}

run() {
  if $DRY_RUN; then
    describe_command "$@"
  else
    "$@"
  fi
}

require() {
  local name="$1" why="$2"
  if [[ -z "${!name:-}" ]]; then
    $DRY_RUN && { printf '  (dry run) %s is not set: %s\n' "$name" "$why"; return; }
    fail "$name is not set: $why"
  fi
}

sha256() { printf %s "$1" | shasum -a 256 | cut -d' ' -f1; }

# The digest `supabase secrets list -o json` shows for one hosted secret; empty if it isn't set.
# Release step: on the first real run, confirm the list really shows SHA-256 hex digests.
hosted_digest() {
  local name="$1" listing="$2"
  jq -r --arg name "$name" '.[] | select(.name == $name) | .value' <<<"$listing"
}

# Fails unless the hosted function settings are the hosted values, not the local ones that
# `secrets set` copies from config.toml (design 03 §3.6, review-3 R2-3).
check_hosted_secrets() {
  local listing name
  listing="$(supabase secrets list --project-ref "$PROJECT_REF" -o json)"
  for name in "${local_only[@]}"; do
    if [[ -n "$(hosted_digest "$name" "$listing")" ]]; then
      fail "$name is still set on the hosted project (a local-only value). Run again after removing it: supabase secrets unset $name."
    fi
  done
  # The value just deployed, so a missing secret or a config.toml copy that won both fail
  # (review-5 finding 3). The script already refused the local value before deploying.
  if [[ "$(hosted_digest NOTIFY_WORKER_SECRET "$listing")" != "$(sha256 "$NOTIFY_WORKER_SECRET")" ]]; then
    fail "NOTIFY_WORKER_SECRET on the hosted project isn't the value you deployed (missing, or the local one)."
  fi
  if [[ "$(hosted_digest EMAIL_TRANSPORT "$listing")" != "$(sha256 resend)" ]]; then
    fail "EMAIL_TRANSPORT on the hosted project isn't 'resend'."
  fi
  if [[ "$(hosted_digest SITE_URL "$listing")" != "$(sha256 "$SITE_URL")" ]]; then
    fail "SITE_URL on the hosted project isn't $SITE_URL."
  fi
  printf '  Hosted function settings checked: no local values, NOTIFY_WORKER_SECRET as deployed, EMAIL_TRANSPORT=resend, SITE_URL=%s\n' "$SITE_URL"
}

# Reads the hosted project's public sign-in settings (no secret needed).
signups_are_off() {
  curl -fsS --max-time 20 "${PROJECT_URL}/auth/v1/settings" -H "apikey: ${PUBLISHABLE_KEY}" |
    grep -q '"disable_signup":true'
}

# True only when the hosted database has the whole sign-up guard, checked by behaviour, not by
# migration history (ADR-0011). Before the migration the function doesn't exist (404): false.
sign_up_guard_ready() {
  curl -fsS --max-time 20 -X POST "${PROJECT_URL}/rest/v1/rpc/sign_up_guard_ready" \
    -H "apikey: ${PUBLISHABLE_KEY}" -H 'Content-Type: application/json' -d '{}' |
    grep -qx 'true'
}

# PostgREST reloads its schema cache after `db push`, so a fresh function may 404 for a moment.
sign_up_guard_ready_with_retries() {
  local attempt
  for attempt in 1 2 3 4 5; do
    sign_up_guard_ready && return 0
    [[ $attempt -lt 5 ]] && sleep "$GUARD_RETRY_SECONDS"
  done
  return 1
}

# True when [remotes.production.auth.external.google] in config.toml says enabled = true.
google_enabled() {
  awk '
    /^\[/ { in_google = ($0 == "[remotes.production.auth.external.google]") ; next }
    in_google && /^[[:space:]]*enabled[[:space:]]*=[[:space:]]*true[[:space:]]*(#.*)?$/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' "$CONFIG_FILE"
}

# A plain `key = value` setting from one [table] of config.toml (no quotes, no inline tables).
config_value() {
  local table="$1" key="$2"
  awk -v table="[$table]" -v key="$key" '
    /^\[/ { in_table = ($0 == table); next }
    in_table && $1 == key && $2 == "=" { print $3; exit }
  ' "$CONFIG_FILE"
}

# After config push, are the hosted Auth settings the safe ones? The safety argument (ADR-0011)
# rests on all of them (review-5 finding 5, security 06 finding 6):
#   - the before-user-created hook on, pointing at our function;
#   - e-mail confirmations on (with autoconfirm, a stranger's password would sign in without the
#     mailbox ever being proven: AC-14) and sign-up on as pushed;
#   - Turnstile on, and Auth's hourly e-mail limit as configured (R1, R2, R4 lean on both);
#   - Google exactly as config.toml says; manual linking and anonymous sign-ins off;
#   - e-mailed codes as long as config.toml says (8: security 06 finding 5), and SMS sign-up not
#     auto-confirmed (the quiet reply for existing e-mails: finding 10). Review-5 round 3.
auth_settings_are_safe() {
  local google=false
  google_enabled && google=true
  curl -fsS --max-time 20 -H @"$AUTH_HEADER_FILE" "$MANAGEMENT_API" |
    jq -e --arg uri "$HOOK_URI" --argjson email_sent "$(config_value auth.rate_limit email_sent)" \
      --argjson google "$google" --argjson otp_length "$(config_value auth.email otp_length)" \
      '.hook_before_user_created_enabled == true and .hook_before_user_created_uri == $uri
       and .mailer_autoconfirm == false and .disable_signup == false
       and .security_captcha_enabled == true and .security_captcha_provider == "turnstile"
       and .rate_limit_email_sent == $email_sent
       and .external_google_enabled == $google
       and .security_manual_linking_enabled == false
       and .external_anonymous_users_enabled == false
       and .mailer_otp_length == $otp_length and .sms_autoconfirm == false' >/dev/null
}

# Turns public sign-up off on the hosted project. Never ends the script silently (set -e): if the
# PATCH fails, it says what to do by hand.
close_sign_up() {
  if ! curl -fsS --max-time 20 -X PATCH -H @"$AUTH_HEADER_FILE" -H 'Content-Type: application/json' \
    -d '{"disable_signup":true}' "$MANAGEMENT_API" >/dev/null; then
    fail "Sign-up may be open without the hook: turn it off in Dashboard → Authentication → Sign In / Providers → 'Allow new users to sign up' now."
  fi
  printf '  Sign-up was closed again (disable_signup = true).\n'
}

say "Checking what's needed"
command -v supabase >/dev/null || fail "Install the Supabase CLI: brew install supabase/tap/supabase"
require SUPABASE_ACCESS_TOKEN "create one at supabase.com/dashboard/account/tokens"
require SUPABASE_DB_PASSWORD "the database password chosen when the project was created"
# The CLI reads it from the environment (SUPABASE_DB_PASSWORD), so it never goes on argv where
# `ps` can show it (security 06 finding 3).
export SUPABASE_DB_PASSWORD
require TURNSTILE_SECRET "Cloudflare dashboard → Turnstile → your widget → Secret key"
require RESEND_API_KEY "resend.com → API keys (the SMTP password for sign-in emails, and app emails)"
require NOTIFY_WORKER_SECRET "a long random value of your own; also goes into Vault (supabase/README.md)"
if [[ "${NOTIFY_WORKER_SECRET:-}" == "$LOCAL_NOTIFY_SECRET" ]]; then
  fail "NOTIFY_WORKER_SECRET is the local value from config.toml. Use a real secret for the hosted project."
fi
command -v jq >/dev/null || fail "Install jq (brew install jq): it checks the hosted settings."
if google_enabled; then
  require GOOGLE_CLIENT_ID "Google Cloud → APIs & Services → Credentials → your Web client"
  require GOOGLE_CLIENT_SECRET "Google Cloud → APIs & Services → Credentials → the same Web client"
  export GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET # read by config push through env()
fi
export SUPABASE_YES=1 # answer yes to config push prompts

# One `secrets set` with every hosted value. The CLI also copies [edge_runtime.secrets] from
# config.toml on this call (the local Zoho fake, Mailpit and the local email settings).
secrets=(
  "ALLOWED_ORIGINS=${SITE_ORIGINS}"
  "EMAIL_TRANSPORT=resend"
  "SITE_URL=${SITE_URL}"
  "NOTIFY_WORKER_SECRET=${NOTIFY_WORKER_SECRET:-}"
  "RESEND_API_KEY=${RESEND_API_KEY:-}"
)
for name in ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_REFRESH_TOKEN ZOHO_LEAD_SOURCE; do
  [[ -n "${!name:-}" ]] && secrets+=("${name}=${!name}")
done
# The secrets file single-quotes each value, so a quote or a line break can't be held: refuse it
# here, before anything changes (review-5 round 3 finding 3).
for pair in "${secrets[@]}"; do
  value="${pair#*=}"
  if [[ "$value" == *"'"* || "$value" == *$'\n'* ]]; then
    fail "${pair%%=*} contains a quote or a line break, which the secrets file can't hold. Change it and run again."
  fi
done

# The Management API token goes in a 0600 header file, so it never shows in `ps` (curl -H @file).
# The function secrets get their own 0600 file at step 6 (`secrets set --env-file`). Both go at exit.
AUTH_HEADER_FILE=""
SECRETS_FILE=""
if ! $DRY_RUN; then
  umask 077
  AUTH_HEADER_FILE="$(mktemp)"
  trap 'rm -f "$AUTH_HEADER_FILE" "$SECRETS_FILE"' EXIT
  printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN" >"$AUTH_HEADER_FILE"
fi

say "1/7 Linking the project"
run supabase link --project-ref "$PROJECT_REF"

say "2/7 Gate: sign-up is off, or the sign-up guard is already installed"
SIGNUPS_WERE_ON=false
if $DRY_RUN; then
  printf '  (dry run) would check %s/auth/v1/settings for "disable_signup":true, or rpc/sign_up_guard_ready = true\n' "$PROJECT_URL"
elif signups_are_off; then
  printf '  Sign-up is off.\n'
elif sign_up_guard_ready; then
  SIGNUPS_WERE_ON=true
  printf '  Sign-up is on and the sign-up guard is installed.\n'
else
  fail "Sign-ups are on but the sign-up guard isn't installed. Turn sign-ups off (Dashboard → Authentication → \
Sign In / Providers → 'Allow new users to sign up' off) and run again. Nothing was changed."
fi

say "3/7 Database tables, access rules and functions (supabase/migrations)"
run supabase db push

say "4/7 Checking the sign-up guard works (rpc/sign_up_guard_ready)"
if $DRY_RUN; then
  printf '  (dry run) would check %s/rest/v1/rpc/sign_up_guard_ready = true, up to 5 tries\n' "$PROJECT_URL"
elif ! sign_up_guard_ready_with_retries; then
  $SIGNUPS_WERE_ON && close_sign_up
  fail "The migrations ran but the sign-up guard isn't ready. Sign-up is off. Nothing else was changed."
else
  printf '  The sign-up guard is ready.\n'
fi

say "5/7 Edge functions: ${FUNCTIONS[*]}"
for name in "${FUNCTIONS[@]}"; do
  run supabase functions deploy "$name" --project-ref "$PROJECT_REF"
done

say "6/7 Function settings"
# Through a 0600 file, never argv (security 06 finding 3). Each value is single-quoted so the
# CLI's .env reader takes it literally (no $ expansion); values were checked before step 1.
if $DRY_RUN; then
  printf '  (dry run) supabase secrets set --project-ref %s --env-file <0600 temp file with: %s>\n' \
    "$PROJECT_REF" "$(printf '%s ' "${secrets[@]%%=*}")"
else
  SECRETS_FILE="$(mktemp)"
  for pair in "${secrets[@]}"; do
    printf "%s='%s'\n" "${pair%%=*}" "${pair#*=}" >>"$SECRETS_FILE"
  done
  supabase secrets set --project-ref "$PROJECT_REF" --env-file "$SECRETS_FILE"
fi
# Then, last of all, remove the local-only values it copied (unless set on purpose here). No
# `secrets set` runs after this, so nothing copies them back.
local_only=(ZOHO_ACCOUNTS_URL ZOHO_API_URL MAILPIT_URL)
[[ -z "${ZOHO_LEAD_SOURCE:-}" ]] && local_only+=(ZOHO_LEAD_SOURCE)
run supabase secrets unset --project-ref "$PROJECT_REF" "${local_only[@]}"
if $DRY_RUN; then
  printf '  (dry run) would check `supabase secrets list -o json`: no %s, EMAIL_TRANSPORT=resend, SITE_URL=%s, NOTIFY_WORKER_SECRET as deployed\n' \
    "${local_only[*]}" "$SITE_URL"
else
  check_hosted_secrets
fi
if [[ -z "${ZOHO_REFRESH_TOKEN:-}" ]]; then
  printf '  Zoho CRM not configured: enquiries are saved but not sent to Zoho CRM (leads-and-crm.md §4).\n'
fi

# Last, because this is what opens sign-up (ADR-0011).
if google_enabled; then
  say "7/7 Sign-in settings (sign-up open, hook, confirmations; Google on): supabase/config.toml"
else
  say "7/7 Sign-in settings (sign-up open, hook, confirmations; Google off): supabase/config.toml"
fi
# A push that fails part-way may already have opened sign-up, so close it again, loudly.
if ! run supabase config push --project-ref "$PROJECT_REF"; then
  close_sign_up
  fail "config push failed, so sign-up was closed again. Fix the error above, then run again."
fi
printf '  Checking the sign-up hook is on and confirmations are on\n'
if $DRY_RUN; then
  printf '  (dry run) would check %s: hook on (%s), mailer_autoconfirm false, disable_signup false, Turnstile on, rate_limit_email_sent = %s, Google as config.toml, manual linking and anonymous sign-ins off, mailer_otp_length = %s, sms_autoconfirm false\n' \
    "$MANAGEMENT_API" "$HOOK_URI" "$(config_value auth.rate_limit email_sent)" "$(config_value auth.email otp_length)"
elif ! auth_settings_are_safe; then
  close_sign_up
  fail "The sign-up hook isn't on, or e-mail confirmations are off, so sign-up was closed again. Check Dashboard → Authentication → Hooks → Before User Created and Sign In / Providers → Confirm email, then run again."
else
  printf '  The sign-up hook is on and confirmations are on.\n'
fi

cat <<'NEXT'

✔ Supabase is set up. What's left (go-live.md):
  • Vercel → Settings → Environment Variables (Production and Preview):
      VITE_TURNSTILE_SITE_KEY = the Turnstile site key   → switches the portal on
      VITE_LEAD_CAPTURE       = on                        → enquiries saved + sent to Zoho CRM
    then redeploy.
  • First admins: supabase/README.md → "First admin on a new environment" (do it twice).
  • Dashboard → Authentication → Users: invited people and signed-up users (role `user`).
  • Close sign-up: Portal → Admin → Users → Close sign-up (supabase/README.md → "Close sign-up").
NEXT

# The cron job reads the worker's address and secret from Vault (ADR-0004). Printed, not run:
# Saurabh pastes it once with the secret from his password manager, so it never passes through
# this script's arguments, shell history or chat.
cat <<VAULT

  • "Work returned" emails, once per project (supabase/README.md → "Work returned emails"):
    Dashboard → SQL Editor, replace the placeholder with NOTIFY_WORKER_SECRET from your password
    manager, then run:
      select vault.create_secret('${PROJECT_URL}/functions/v1/notifications', 'notify_worker_url');
      select vault.create_secret('<NOTIFY_WORKER_SECRET>', 'notify_worker_secret');
    Then delete that query from the SQL Editor's saved snippets and history, so the secret is
    only in Vault and your password manager. Then do the test-family check (README) before
    telling families.
VAULT
