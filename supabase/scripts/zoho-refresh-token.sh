#!/usr/bin/env bash
# Turns a one-time Zoho "Generate Code" grant (api-console.zoho.com.au → Self Client) into a
# long-lived refresh token, and saves it as ZOHO_REFRESH_TOKEN in supabase/.env.deploy.
# The token is never printed. Run it within the code's time limit:
#   supabase/scripts/zoho-refresh-token.sh <code>
# Needs ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET already saved in supabase/.env.deploy.

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.deploy"
CODE="${1:-}"
[[ -n "$CODE" ]] || { echo "Usage: $0 <one-time code from Zoho>" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

value() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
CLIENT_ID="$(value ZOHO_CLIENT_ID)"
CLIENT_SECRET="$(value ZOHO_CLIENT_SECRET)"
[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" ]] ||
  { echo "Paste ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET into $ENV_FILE first." >&2; exit 1; }

RESPONSE="$(curl -fsS --max-time 30 -X POST "https://accounts.zoho.com.au/oauth/v2/token" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=${CLIENT_ID}" \
  --data-urlencode "client_secret=${CLIENT_SECRET}" \
  --data-urlencode "code=${CODE}")"

TOKEN="$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("refresh_token",""))')"
if [[ -z "$TOKEN" ]]; then
  ERROR="$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("error","unknown"))')"
  echo "✖ Zoho refused the code: ${ERROR} (codes are single-use and expire; generate a new one)." >&2
  exit 1
fi

python3 - "$ENV_FILE" "$TOKEN" <<'PY'
import re, sys
path, token = sys.argv[1], sys.argv[2]
text = open(path).read()
text = re.sub(r'^ZOHO_REFRESH_TOKEN=.*$', f'ZOHO_REFRESH_TOKEN={token}', text, flags=re.M)
open(path, 'w').write(text)
PY
echo "✔ Zoho refresh token saved in supabase/.env.deploy (not shown)."
