#!/usr/bin/env bash
# Sets up (or updates) the hosted Supabase project for the portal and lead capture
# (docs/requirements/release-2/go-live.md §3). Safe to run again after any change.
#
# Order matters: sign-ups are switched off and CHECKED before any table is created, because an
# account created without an invite would otherwise become an active tutor (completion-todo §0).
#
# Usage, from the repo root:
#   SUPABASE_ACCESS_TOKEN=… SUPABASE_DB_PASSWORD=… TURNSTILE_SECRET=… RESEND_API_KEY=… \
#     supabase/scripts/deploy.sh            # add --dry-run to print the steps only
#
# Optional, for Zoho CRM (leads-and-crm.md §4): ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
# ZOHO_REFRESH_TOKEN, and optionally ZOHO_LEAD_SOURCE (an exact value from your Lead Source list).
# Without them, enquiries are still saved; they just aren't sent to Zoho CRM.

set -euo pipefail

PROJECT_REF="unzjnxctkyahtmrkinyr" # [remotes.production] in supabase/config.toml
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
PUBLISHABLE_KEY="sb_publishable_RcrO-f-2jyjJyfTWNWy0IQ_1NwGbnhb" # public, same as apps/web/.env.production
SITE_ORIGINS="https://ajclasses.com.au,https://staging.ajclasses.com.au"
FUNCTIONS=(account-admin leads)

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

say() { printf '\n▶ %s\n' "$1"; }
fail() { printf '\n✖ %s\n' "$1" >&2; exit 1; }

run() {
  if $DRY_RUN; then
    printf '  (dry run) %s\n' "$*"
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
require RESEND_API_KEY "resend.com → API keys (used as the SMTP password for sign-in emails)"
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
secrets=("ALLOWED_ORIGINS=${SITE_ORIGINS}")
for name in ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_REFRESH_TOKEN ZOHO_LEAD_SOURCE; do
  [[ -n "${!name:-}" ]] && secrets+=("${name}=${!name}")
done
run supabase secrets set --project-ref "$PROJECT_REF" "${secrets[@]}"
if [[ ${#secrets[@]} -lt 4 ]]; then
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
