#!/usr/bin/env bash
# Sets up (or updates) the hosted Supabase project for the portal and lead capture
# (docs/requirements/release-2/go-live.md §3). Safe to run again after any change.
#
# Order matters: sign-ups are switched off and CHECKED before any table is created, because an
# account created without an invite would otherwise become an active tutor (completion-todo §0).
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

set -euo pipefail

PROJECT_REF="unzjnxctkyahtmrkinyr" # [remotes.production] in supabase/config.toml
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
PUBLISHABLE_KEY="sb_publishable_RcrO-f-2jyjJyfTWNWy0IQ_1NwGbnhb" # public, same as apps/web/.env.production
SITE_ORIGINS="https://ajclasses.com.au,https://staging.ajclasses.com.au"
SITE_URL="https://ajclasses.com.au" # links in app emails; one database serves staging and prod
LOCAL_NOTIFY_SECRET="local-notify-secret" # supabase/config.toml, local only: never hosted
FUNCTIONS=(account-admin leads notifications)

# Secrets can also come from supabase/.env.deploy (git-ignored), so they never pass through chat
# or shell history. Values already in the environment win.
ENV_FILE="$(dirname "$0")/../.env.deploy"
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
# the value of every NAME=value pair.
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
  if [[ "$(hosted_digest NOTIFY_WORKER_SECRET "$listing")" == "$(sha256 "$LOCAL_NOTIFY_SECRET")" ]]; then
    fail "NOTIFY_WORKER_SECRET on the hosted project is the local value. Set a real one and run again."
  fi
  if [[ "$(hosted_digest EMAIL_TRANSPORT "$listing")" != "$(sha256 resend)" ]]; then
    fail "EMAIL_TRANSPORT on the hosted project isn't 'resend'."
  fi
  if [[ "$(hosted_digest SITE_URL "$listing")" != "$(sha256 "$SITE_URL")" ]]; then
    fail "SITE_URL on the hosted project isn't $SITE_URL."
  fi
  printf '  Hosted function settings checked: no local values, EMAIL_TRANSPORT=resend, SITE_URL=%s\n' "$SITE_URL"
}

# Reads the hosted project's public sign-in settings (no secret needed).
signups_are_off() {
  curl -fsS --max-time 20 "${PROJECT_URL}/auth/v1/settings" -H "apikey: ${PUBLISHABLE_KEY}" |
    grep -q '"disable_signup":true'
}

say "Checking what's needed"
command -v supabase >/dev/null || fail "Install the Supabase CLI: brew install supabase/tap/supabase"
require SUPABASE_ACCESS_TOKEN "create one at supabase.com/dashboard/account/tokens"
require SUPABASE_DB_PASSWORD "the database password chosen when the project was created"
require TURNSTILE_SECRET "Cloudflare dashboard → Turnstile → your widget → Secret key"
require RESEND_API_KEY "resend.com → API keys (the SMTP password for sign-in emails, and app emails)"
require NOTIFY_WORKER_SECRET "a long random value of your own; also goes into Vault (supabase/README.md)"
if [[ "${NOTIFY_WORKER_SECRET:-}" == "$LOCAL_NOTIFY_SECRET" ]]; then
  fail "NOTIFY_WORKER_SECRET is the local value from config.toml. Use a real secret for the hosted project."
fi
command -v jq >/dev/null || fail "Install jq (brew install jq): it checks the hosted function settings."
export SUPABASE_YES=1 # answer yes to config push prompts

say "1/6 Linking the project"
run supabase link --project-ref "$PROJECT_REF" --password "${SUPABASE_DB_PASSWORD:-}"

say "2/6 Sign-in settings (invite only, captcha, email): supabase/config.toml"
run supabase config push --project-ref "$PROJECT_REF"

say "3/6 Confirming public sign-ups are off before creating any tables"
if $DRY_RUN; then
  printf '  (dry run) would check %s/auth/v1/settings for "disable_signup":true\n' "$PROJECT_URL"
elif ! signups_are_off; then
  fail "Sign-ups are still ON. Turn them off (Dashboard → Authentication → Sign In / Providers → \
'Allow new users to sign up' off), then run this again. Nothing else was changed."
fi

say "4/6 Database tables, access rules and functions (supabase/migrations)"
run supabase db push --password "${SUPABASE_DB_PASSWORD:-}"

say "5/6 Edge functions: ${FUNCTIONS[*]}"
for name in "${FUNCTIONS[@]}"; do
  run supabase functions deploy "$name" --project-ref "$PROJECT_REF"
done

say "6/6 Function settings"
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
run supabase secrets set --project-ref "$PROJECT_REF" "${secrets[@]}"
# Then, last of all, remove the local-only values it copied (unless set on purpose here). No
# `secrets set` runs after this, so nothing copies them back.
local_only=(ZOHO_ACCOUNTS_URL ZOHO_API_URL MAILPIT_URL)
[[ -z "${ZOHO_LEAD_SOURCE:-}" ]] && local_only+=(ZOHO_LEAD_SOURCE)
run supabase secrets unset --project-ref "$PROJECT_REF" "${local_only[@]}"
if $DRY_RUN; then
  printf '  (dry run) would check `supabase secrets list -o json`: no %s, EMAIL_TRANSPORT=resend, SITE_URL=%s, NOTIFY_WORKER_SECRET not the local value\n' \
    "${local_only[*]}" "$SITE_URL"
else
  check_hosted_secrets
fi
if [[ -z "${ZOHO_REFRESH_TOKEN:-}" ]]; then
  printf '  Zoho CRM not configured: enquiries are saved but not sent to Zoho CRM (leads-and-crm.md §4).\n'
fi

cat <<'NEXT'

✔ Supabase is set up. What's left (go-live.md):
  • Vercel → Settings → Environment Variables (Production and Preview):
      VITE_TURNSTILE_SITE_KEY = the Turnstile site key   → switches the portal on
      VITE_LEAD_CAPTURE       = on                        → enquiries saved + sent to Zoho CRM
    then redeploy.
  • First admins: supabase/README.md → "First admin on a new environment" (do it twice).
  • Dashboard → Authentication → Users: should list only people you invited.
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
    Then do the test-family check (README) before telling families.
VAULT
