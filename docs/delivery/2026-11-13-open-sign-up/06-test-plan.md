# 06 — Test plan: open sign-up for parents and guardians

Stage 6a of `/deliver`, Tester. Branch `feature/open-sign-up`. Date 2026-11-14.
Inputs: [00](00-decisions.md), [01](01-requirement.md) (AC-1 to AC-56), [03](03-design.md), [04](04-plan.md),
[05](05-dev-notes.md), [release-notes](release-notes.md), [review-5](review-5.md), [06-security](06-security.md),
[review-6a](review-6a.md), the shared tester role and the
AJ Classes tester addendum (`~/second-brain/Projects/AJClasses/_agents/tester.md`).

**Plan base: `5e92ee6`** (fix batch 4). Written at `8a33156`, re-synced at `84d2691` (batch 2), then revised after
review-6a round 1 against `1562010` (batch 3) and `5e92ee6` (batch 4: no `Staff` badge on the code e-mail; the
clean-up re-checks every condition at delete time). At run time, if
`git diff --quiet 5e92ee6 HEAD -- apps/web/src supabase e2e package.json` fails, re-derive every value marked
**(count)** and every quoted string from the files before comparing. A wrong expected value found in the run is a
plan error: the TSR records it and the lead rules on it. The run doesn't edit this plan.

`/test-and-ship` writes `docs/test-reports/<date>-feature-open-sign-up/TSR.md` (plus `bugs/`). **Write each case's
Actual and Result into the TSR as soon as the case runs.** Keep screenshots, HARs and traces under a gitignored
`run-*/` folder; commit only `TSR.md` and `bugs/`.

**115 cases**: 8 suites (S), 81 feature and edge cases (TST-1 included), 9 regression cases (R), 5 lead-only visual cases (V),
the security residual check SEC-1, the six fix-batch-2 cases FB2-1 to FB2-6 (§6b), and the five 8-digit-code cases
OTP-1 to OTP-5 (§6c). Five more checks are Saurabh's and sit outside the pass/fail set (§7). S-0 is a start-state
gate, not a case.

---

## 0. Set-up

### 0.1 Environment

- Repo `/Users/sjain/dev/work/aj_classes` at the plan base (or HEAD, see above). Local Supabase only: API `:55321`,
  DB `:55322`, Studio `:55323`, Mailpit `:55324`. No hosted Supabase, Vercel, Resend or Google, not even read-only.
- Dev server: `pnpm dev --port 5173 --strictPort` (from `apps/web`). Use `http://localhost:5173`: it is the local
  `site_url`, so it is the host in every e-mailed link. Take the real URL from the run log.
- Start of run: the stack is on a fresh seed (`pnpm db:reset`; the run's owner does this, never in parallel with
  another agent). Check the start state with S-0 below before any case.
- Browser cases are driven through Playwright with the installed Chrome (`channel: 'chrome'`), unless a case says
  "Lead". Stub `window.confirm` in-page. Clear the console before measuring if source files changed while the dev
  server ran (addendum: HMR noise).
- Turnstile: the local site key `1x00000000000000000000AA` passes by itself in the browser. Raw API calls use the
  token `XXXX.DUMMY.TOKEN.XXXX` with the always-pass secret.
- Mobile cases: `~/dev/work/aj_classes_mobile` on the headless simulator, `config.json` pointing at
  `http://127.0.0.1:55321` (hard-stop otherwise). Show screenshots with `xcrun simctl io <udid> screenshot`.

### 0.2 Helpers (dry-run on this machine, 2026-11-14)

Each tool call is a fresh zsh shell: start every block with the `export S=…` and `. "$S/t6.sh"` lines.

```sh
# One-off set-up: scratch dir and the publishable key in a 0600 header file (never on a command line)
export S=/path/to/run-scratch; mkdir -p "$S"; umask 077
(cd /Users/sjain/dev/work/aj_classes && supabase status -o json > "$S/status.json")
python3 -I -c "import json; d=json.load(open('$S/status.json')); open('$S/anon.hdr','w').write('apikey: '+d['PUBLISHABLE_KEY']+'\n')"
# then write $S/t6.sh exactly as below
```

```sh
# $S/t6.sh
API=http://127.0.0.1:55321
MAILPIT=http://127.0.0.1:55324
CAPTCHA='XXXX.DUMMY.TOKEN.XXXX'
db() { docker exec supabase_db_aj_classes psql -U postgres -At -q -v ON_ERROR_STOP=1 -c "$1"; }
# Plant N cap rows (optionally aged, e.g. '25 hours'); prints their ids as 1,2,3 (save them). Delete by those ids.
plant_cap() { db "insert into private.sign_up_emails (created_at) select now() - ('${2:-0 seconds}')::interval from generate_series(1,$1) returning id" | grep -E '^[0-9]+$' | paste -sd, -; }
unplant_cap() { [ -n "$1" ] && db "delete from private.sign_up_emails where id in ($1)"; db "select count(*) from private.sign_up_emails"; }
mail_count() { curl -s -G "$MAILPIT/api/v1/search" --data-urlencode "query=to:\"$1\"" --data-urlencode 'limit=50' | python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("messages_count"))'; }
mail_subjects() { curl -s -G "$MAILPIT/api/v1/search" --data-urlencode "query=to:\"$1\"" --data-urlencode 'limit=50' | python3 -I -c 'import json,sys; print("|".join(m["Subject"] for m in json.load(sys.stdin).get("messages",[])))'; }
newest_link() { id=$(curl -s -G "$MAILPIT/api/v1/search" --data-urlencode "query=to:\"$1\" subject:\"$2\"" --data-urlencode 'limit=1' | python3 -I -c 'import json,sys; m=json.load(sys.stdin)["messages"]; print(m[0]["ID"] if m else "")'); [ -n "$id" ] && curl -s "$MAILPIT/api/v1/message/$id" | python3 -I -c 'import json,sys,re,html; h=html.unescape(json.load(sys.stdin)["HTML"]); m=re.search(r"http://localhost:5173/portal/auth/confirm\?token_hash=[^\"<\s]+", h); print(m.group(0) if m else "")'; }
auth_post() { curl -s -o "$S/last.json" -w '%{http_code}' -X POST -H @"$S/anon.hdr" -H 'Content-Type: application/json' -d "$2" "$API/auth/v1/$1"; echo " $(cat "$S/last.json")"; }
raw_signup() { auth_post signup "{\"email\":\"$1\",\"password\":\"$3\",\"data\":{\"full_name\":\"$2\"},\"gotrue_meta_security\":{\"captcha_token\":\"$CAPTCHA\"}}"; }
raw_signup_nocaptcha() { auth_post signup "{\"email\":\"$1\",\"password\":\"x-throwaway-password-123\",\"data\":{\"full_name\":\"No Captcha\"}}"; }
raw_resend() { auth_post resend "{\"type\":\"signup\",\"email\":\"$1\",\"gotrue_meta_security\":{\"captcha_token\":\"$CAPTCHA\"}}"; }
raw_password() { auth_post 'token?grant_type=password' "{\"email\":\"$1\",\"password\":\"$2\",\"gotrue_meta_security\":{\"captcha_token\":\"$CAPTCHA\"}}"; }
rpc_anon() { curl -s -X POST -H @"$S/anon.hdr" -H 'Content-Type: application/json' -d "${2:-{\}}" "$API/rest/v1/rpc/$1"; echo; }
# A query "as" someone, read-only, with crafted claims (amr optional). $1 = e-mail, $2 = aal, $3 = amr JSON or '', $4 = SQL
as_user() { id=$(db "select id from public.profiles where email='$1'"); c="{\"sub\":\"$id\",\"role\":\"authenticated\",\"aal\":\"$2\"${3:+,\"amr\":$3}}"; docker exec supabase_db_aj_classes psql -U postgres -At -c "begin read only; select set_config('request.jwt.claims', '$c', true); set local role authenticated; $4; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$|^[{]"sub"'; }
```

Dry-run results (read-only; nothing was written to the shared stack):

| Dry-run | Result |
|---|---|
| `db "select public.sign_up_status()"`, `rpc_anon sign_up_status`, `rpc_anon sign_up_guard_ready` | `open`, `"open"`, `true` |
| `db "select nope()"` (planted bad query) | exit 1 (the helper fails loudly) |
| `curl …/auth/v1/settings` | `external.google` false, `disable_signup` false, `mailer_autoconfirm` false |
| `mail_count parent@local.test`, `mail_subjects parent@local.test` | a number, and the subjects joined by `|` |
| `newest_link <an INT address> "Confirm your e-mail for AJ Classes"` | `http://localhost:5173/portal/auth/confirm?token_hash=<hex>&type=email` (browser PKCE sign-ups add a `pkce_` prefix: 05 slice 11) |
| The `amr` matrix (AMR-1), the hook refusals (H-1), the user read sweep (U-6), `admin_list_users` as admin/aal1/tutor (AD-1, AD-2), `admin_set_sign_up_open` as tutor (CAP-9), `admin_list_staff` (U-10) | the exact values in those cases |
| e2e lists (`npx playwright test --list`, both configs) | `Total: 13 tests in 6 files`; `Total: 23 tests in 1 file` |

Re-sync dry-runs at `84d2691` (2026-11-14; superseded by the next table wherever they differ):

| Dry-run at `84d2691` | Result |
|---|---|
| `pnpm test` | `Test Files  93 passed (93)`, `Tests  843 passed (843)`; e2e-unit `ℹ tests 6`, `ℹ fail 0`; `test-deploy-order.mjs` 50 `ok` lines, `All checks passed.` |
| Web test files on disk (`find apps/web -name '*.test.ts' -o -name '*.test.tsx'`, outside `node_modules`) | 93 |
| New pgTAP assertions in `open_sign_up.test.sql` (`git diff 8a33156 84d2691`) | 7, so 1207 + 7 = **1214** |
| `cron.job` | four jobs: `daily-history-trim`, `delete-stale-sign-ups|45 17 * * *|true`, `due-tomorrow-reminders`, `email-worker-kick` |
| FB2-1 gate on `84d2691` and on `8a33156` (superseded below) | `tree: pw=0 arr=0 envfile=1 post=5`, `base: pw=2 arr=1 envfile=0 post=0` |
| Hook with a spaces-only Google e-mail | `google_email_unverified` |
| `[auth.sms]` / `[auth.email]` keys (awk, FB2-6, OTP-1) | `enable_signup = false`, `enable_confirmations = true`; `otp_length = 8`, `otp_expiry = 3600`, `secure_password_change = true`; at `8a33156` SMS `enable_confirmations = false` |
| Rows the clean-up would delete now (read-only `select count(*)`, FB2-4) | `0` |

Re-sync dry-runs after review-6a (2026-11-14; `pnpm test` at `1562010`, whose web, e2e and deploy files equal
`5e92ee6`'s; the rest at `5e92ee6`):

| Dry-run | Result |
|---|---|
| `pnpm test` | `Test Files  93 passed (93)`, `Tests  844 passed (844)`; `ℹ tests 6`, `ℹ fail 0`; 53 `ok` lines, `All checks passed.` |
| pgTAP assertion calls added/removed in `supabase/tests/database/`, `84d2691..1562010` and `1562010..5e92ee6` | +8/−2 (1220), then 5 more (**1225**, the lead's count) |
| S-0's query | `…|active|true`, `inactive@local.test|tutor|active|false`: `||` prints `true`/`false`; separate columns print `t`/`f` |
| `db` with `-q` and `returning id` (session temp table) | `1,2,3`, no `INSERT 0 3` line |
| AMR-1 extra rows | `magiclink t`, `email/signup t`, `"otp" f`, `{"method":"otp"} f`, `[{}] f` |
| FB2-1 gate at `5e92ee6` / `8a33156` | `pw=0 arr=0 envfile=1 post=6` / `pw=2 arr=1 envfile=0 post=0` |
| The stack has batch 4 (`private.is_stale_sign_up(uuid)` exists; `authenticated` can't run it) | `t|f` |
| `Staff` in `reauthentication.html` and `recovery.html` at `5e92ee6` | `0`, `0` |
| AC-44 names (TST-1) | each as listed there |

**Not dry-run** (they write): `pnpm db:test`, `pnpm test:functions`, the e2e runs, every browser case, every case with a fixture,
every raw sign-up, and the rolled-back write cases (G-4, G-5, U-7). Each such case states its expected value from
the code; the run records a mismatch as a plan error or a bug.

### 0.3 Fixtures and restoring them

- Every address this run creates is `t6-<run>-<label>@local.test`, `<run>` = `date +%s` at the start of the run.
  Record it in the TSR.
- **The daily cap is shared state.** Each browser or raw e-mail sign-up takes a slot (15 per rolling 24 h). Empty
  it at the start of each sitting and wherever a case says so: `db "delete from private.sign_up_emails"` (the README's
  local reset). Plant rows only with `ids=$(plant_cap 15)` (or `plant_cap 15 '25 hours'`) and restore in the same case
  with `unplant_cap "$ids"`, which must print the count from before the plant. Each tool call is a fresh shell, so
  record `$ids` in the TSR and paste it back if the restore runs in a later call.
- The kill switch must be open at the end of every case that touches it: `db "select open from private.sign_up_settings"` → `t`.
- Seed accounts are never promoted, deactivated or deleted. Promotion, deactivation and invite cases use their own
  `t6-` accounts. A case that invites a seed student (INV-2) restores it in the same case.
- Mailpit is shared and keeps old mail: always compare **per-address counts before and after** (`mail_count`), never
  the total.
- Clean-up (R-9) deletes every `t6-%` auth user (`delete from auth.users where email like 't6-%@local.test'`, which
  cascades to `profiles`) and empties the cap.

**S-0 start state (gate before any case).**

```sh
export S=…; . "$S/t6.sh"
db "select p.email||'|'||p.role||'|'||p.status||'|'||p.is_active from public.profiles p order by 1" | paste -sd' ' -
db "select open from private.sign_up_settings"; db "select count(*) from private.sign_up_emails"
db "select public.sign_up_guard_ready()"; db "select count(*) from public.posts"
lsof -nP -iTCP:5173 -sTCP:LISTEN | wc -l
```

Expected (dry-run matched): `admin@local.test|admin|active|true inactive@local.test|tutor|active|false newadmin@local.test|admin|active|true parent@local.test|parent|active|true student@local.test|student|active|true tutor@local.test|tutor|active|true user@local.test|user|active|true`;
`t`; `0`; `t`; `0` posts (seed has none); the 5173 count is `1` once the dev server is up (`0` before).

### 0.4 Sittings and ownership

- **Sitting 1 (cheap, ~35 cases):** S-1 to S-8, then the DB and raw-API cases (H, AMR, G-4 to G-6, U-6 to U-10,
  CAP-2, CAP-5, CAP-9, DEP, SU-9, SU-10), SEC-1, FB2-1, FB2-2, FB2-4, FB2-6, OTP-1, TST-1.
- **Sitting 2 (browser, ~50):** SU-1 to SU-8, EN, CF, CAP, G-1 to G-3, U-1 to U-5, AD, INV, FB2-3, FB2-5, UI-1, UI-2,
  OTP-2 to OTP-4, then **SU-11 last** (DB; it counts what Sitting 2 made).
- **Sitting 3 (~20):** M and OTP-5 (mobile), R (regression, public sweep), then clean-up R-9.
- Never mark a case BLOCKED for lack of budget: say NOT RUN and hand back.
- **Lead's cases:** V-1 to V-5 (real-browser visual judgement: does it look right, consistent, readable, in light
  and dark). The Tester takes the screenshots for those and hands them over; the lead gives the verdict. Everything
  else is the Tester's, mobile included.

---

## 1. Suites

**S-1 — format, lint, typecheck.** AC-42. Method: automated.
`pnpm format:check; pnpm lint; pnpm typecheck`, each `> log 2>&1; echo "exit=$?"`.
Expected: `exit=0` each. Bare `pnpm format:check` may fail only on the untracked `actionItems.md` and
`supabase/.temp/*` (review-5): those two are not branch failures; anything else is.

**S-2 — `pnpm test`.** AC-42, AC-47. Method: automated.
Expected: web `Test Files  93 passed (93)` and `Tests  844 passed (844)` **(count)**, e2e-unit `ℹ tests 6` and
`ℹ fail 0`, `test-deploy-order.mjs` 53 `ok` lines and `All checks passed.` (dry-run matched). The feature files in it: `sign-up.test.tsx`, `sign-up-resend.test.tsx`, `login.test.tsx`,
`auth-callback.test.tsx`, `auth-confirm.test.tsx`, `user-home.test.tsx`, `account.test.tsx`, `admin-users.test.tsx`,
`terms.test.tsx`, `privacy.test.tsx`, `sitemap.test.ts`, `FinishSignUpForm.test.tsx`, `ParentInviteDialog.test.tsx`,
`PortalLayout.test.tsx`, `sign-up-validation.test.ts`, `portal-access.test.ts`, `sign-up.service.test.ts`,
`auth-errors.test.ts`, `admin-student.test.tsx`, `hosting-csp.test.ts`, and fix batch 2's `portal-validation.test.ts`
("e-mailed codes are 8 digits", "authenticator (TOTP) codes stay 6 digits", "matches [auth.email] otp_length in
supabase/config.toml").

**S-3 — production build and hosted-ref check.** AC-42. Method: automated.
`VITE_APP_ENV=production pnpm build` as in `docs/testing/ci-gates.md` (gate build), then
`pnpm --filter web check:hosted-ref <paths>`.
Expected: build `exit=0`; `apps/web/build/client/terms/index.html` exists with exactly one `<h1`; hosted-ref
`0 files`.

**S-4 — `pnpm db:test`.** AC-26 to AC-28, AC-44, AC-47, AC-52 to AC-54. Method: automated.
Expected: PASS, **1225** tests **(count)** in 20 files, including `open_sign_up.test.sql` and
`open_sign_up_access.test.sql`. Lift any cron pause first (addendum).

**S-5 — `pnpm test:functions`.** AC-12 to AC-14, AC-19, AC-20, AC-24, AC-29, AC-32 to AC-38, AC-42, AC-46, AC-48.
Method: automated (restart the edge runtime first: `docker restart supabase_edge_runtime_aj_classes`).
Expected: **564** `ok` **(count)**, "All checks passed", including `test-open-sign-up.mjs` (whose AC-12 matrix now
requires `200` with `identities: []` for all 8 account kinds). Afterwards
`db "select count(*) from private.sign_up_emails"` → `0` and the switch `t` (INT empties and reopens them).

**S-6 — e2e smoke.** AC-1, AC-16, AC-21, AC-42, AC-51, AC-54. Method: automated.
`node e2e/scripts/local-env.mjs > e2e/.env; pnpm --filter aj-classes-e2e test:smoke`.
Expected: **13 passed** **(count)**, including the three in `e2e/tests/open-sign-up.spec.ts`. Afterwards no `e2e-%`
rows in posts, enquiries or profiles; nothing listening on 5173 (kill a leftover by PID from `lsof`, never `pkill -f`).

**S-7 — CSP sweep.** AC-50. Method: automated, on the gate build from S-3 (rebuild if another build ran since).
`pnpm --filter aj-classes-e2e test:csp`. Expected: **23 passed** **(count)** (`/terms` at 360 and 1280 px, the
spec's `VIEWPORTS`).

**S-8 — mobile suite (regression, no mobile code changed).** AC-40, AC-41. Method: automated.
In `aj_classes_mobile`: `flutter analyze && flutter test`. Expected: no analyzer issues, all tests pass (counts as on
its `main`, `bf14460`).

---

## 2. Database and raw API cases (Sitting 1)

**H-1 — the hook's refusals (read-only).** AC-28, AC-45, AC-48, AC-53. Method: DB query.

```sh
export S=…; . "$S/t6.sh"
q() { docker exec supabase_db_aj_classes psql -U postgres -At -c "begin read only; select public.hook_before_user_created('$1'::jsonb); rollback;" | sed -n 2p; }
q '{"user":{"email":"x@local.test","app_metadata":{"provider":"email","account_role":"tutor"},"user_metadata":{"full_name":"Ab"}}}'
q '{"user":{"email":"x@local.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":false}}}'
q '{"user":{"email":"","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}}}'
q '{"user":{"email":"g@local.test","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}}}'
q '{"user":{"email":"a@local.test","app_metadata":{"provider":"apple"},"user_metadata":{}}}'
q '{"user":{"email":"e@local.test","app_metadata":{"provider":"email"},"user_metadata":{"full_name":"😀"}}}'
q '{"user":{"email":"   ","app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true}}}'
```

Expected, line by line (dry-run matched):
`{"error": {"message": "sign_up_refused", "http_code": 429}}`,
`{"error": {"message": "google_email_unverified", "http_code": 429}}`,
`{"error": {"message": "google_email_unverified", "http_code": 429}}`, `{}`,
`{"error": {"message": "sign_up_refused", "http_code": 429}}`,
`{"error": {"message": "invalid_name", "http_code": 429}}`,
`{"error": {"message": "google_email_unverified", "http_code": 429}}` (spaces-only Google e-mail, `btrim`, fix batch 2).

**H-2 — the hook while closed, for e-mail and Google (rolled back).** AC-48. Method: DB query (writes inside a
transaction that is rolled back).

```sh
export S=…; . "$S/t6.sh"
docker exec supabase_db_aj_classes psql -U postgres -At -c "begin; update private.sign_up_settings set open = false where id; select public.hook_before_user_created('{\"user\":{\"email\":\"g@local.test\",\"app_metadata\":{\"provider\":\"google\"},\"user_metadata\":{\"email_verified\":true}}}'); select public.hook_before_user_created('{\"user\":{\"email\":\"e@local.test\",\"app_metadata\":{\"provider\":\"email\"},\"user_metadata\":{\"full_name\":\"Ab Cd\"}}}'); select public.sign_up_status(); rollback;"
db "select open from private.sign_up_settings"
```

Expected: both hook calls `{"error": {"message": "sign_up_closed", "http_code": 429}}`; status `closed`; after the
rollback `t`.

**AMR-1 — the finish step's session check (read-only).** AC-17, AC-55. Method: DB query.

```sh
export S=…; . "$S/t6.sh"
for amr in '[{"method":"otp"}]' '[{"method":"oauth"}]' '[{"method":"recovery"}]' '[{"method":"magiclink"}]' '[{"method":"email/signup"}]' '[{"method":"password"}]' '[{"method":"token_refresh"}]' '[{"method":"otp"},{"method":"unknown"}]' '[{"method":"otp"},{"method":"password"}]' '[]' '"otp"' '{"method":"otp"}' '[{}]' none; do
  if [ "$amr" = none ]; then c='{}'; else c="{\"amr\":$amr}"; fi
  echo "$amr => $(docker exec supabase_db_aj_classes psql -U postgres -At -c "begin read only; select set_config('request.jwt.claims', '$c', true); select private.session_can_finish_sign_up(); rollback;" | sed -n 3p)"
done
```

Expected (dry-run matched): `otp t`, `oauth t`, `recovery t`, `magiclink t`, `email/signup t`, `password f`,
`token_refresh f`, `otp+unknown f`, `otp+password f`, `[] f`, `"otp"` (not an array) `f`, `{"method":"otp"}` (an
object) `f`, `[{}]` (an entry with no method) `f`, `none f`.

**AMR-2 — `complete_sign_up` from a password session is refused (real token).** AC-17, AC-20. Method: raw API.
Pre: the CF-10 account (`t6-<run>-pwonly`), unfinished, with a password saved and no finish. Run right after CF-10.
Steps: `raw_password t6-<run>-pwonly@local.test '<P2>'` → take `access_token` from `$S/last.json`; POST
`/rest/v1/rpc/my_sign_up` and `/rest/v1/rpc/complete_sign_up` `{"new_full_name":"Pw Only","accepts_terms":true}`
with `Authorization: Bearer` from a 0600 header file.
Expected: `my_sign_up` → `[{"full_name":"Pw Only",…,"signed_up_with":"email","can_finish":false}]`;
`complete_sign_up` → HTTP 403 with `"message":"sign_up_link_needed"`; `db "select status from public.profiles where
email='t6-<run>-pwonly@local.test'"` → `invited`.

**G-4 — a Google identity never attaches to an existing account (rolled back).** AC-14 case 2, AC-54. Method: DB
query (each insert inside `begin … rollback`).
Pre: two `t6` sign-ups from SU-7/EN-5: one **unconfirmed** (`t6-<run>-new`) and one **confirmed, unfinished**
(after CF-2, before CF-8, or a dedicated one). For each of `user@`, `tutor@`, `admin@`, `parent@`, `student@`,
`inactive@local.test` and the two `t6` addresses:

```sh
export S=…; . "$S/t6.sh"; E=user@local.test
docker exec supabase_db_aj_classes psql -U postgres -At -c "begin; insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) select gen_random_uuid(), u.id, 'google-sub-t6', jsonb_build_object('sub','google-sub-t6','email',u.email,'email_verified',true), 'google', now(), now() from auth.users u where u.email = '$E'; rollback;" 2>&1 | grep -o 'identity_link_refused'
```

Expected: `identity_link_refused` for all eight. **Positive control** (must succeed): in one transaction insert a
brand-new `auth.users` row (no `account_role`, `email_confirmed_at` null) and then its Google identity, then
`select role, status from public.profiles where id = <new id>` → `user|invited`, no error; `rollback`.
`db "select count(*) from auth.identities where provider='google'"` → `0` afterwards.

**G-5 — Google sign-up is finished without a password, and later Google sign-ins go home.** AC-52, AC-55. Method:
automated: `open_sign_up.test.sql` (Google-shaped user → `user/invited`; finish with `[oauth]` and no password →
active) and `open_sign_up_access.test.sql` (the sweep again with `[oauth]`). Expected: green in S-4.
Not locally testable with a real Google account (no Google client): FS-1.

**G-6 — a promoted Google user still signs in with Google as a parent.** AC-35, AC-44. Method: automated
(`open_sign_up.test.sql`: promoted Google user in an `[oauth]` session reads its child through `parent_children()`;
INT promotion section). Expected: green in S-4 and S-5. Real Google: FS-1.

**U-6 — a user reads nothing private (read-only, crafted session).** AC-26, AC-27, AC-55. Method: DB query.

```sh
export S=…; . "$S/t6.sh"
for t in classes class_sessions enrolments students student_guardians assignments assignment_questions assignment_answers assignment_results audit_log enquiries notification_settings; do
  echo "$t => $(as_user user@local.test aal1 '' "select count(*) from public.$t")"; done
echo "email_outbox => $(as_user user@local.test aal1 '' 'select count(*) from public.email_outbox')"
echo "profiles => $(as_user user@local.test aal1 '' 'select count(*) from public.profiles')"
echo "storage => $(as_user user@local.test aal1 '' 'select count(*) from storage.objects')"
# positive control: the same helper as the admin sees rows
echo "admin classes => $(as_user admin@local.test aal2 '' 'select count(*) from public.classes')"
```

Expected (dry-run matched): every table `0`; `email_outbox => ERROR:  permission denied for table email_outbox`
(no rows either way); `profiles => 1`; `storage => 0`; `admin classes => 3` (seed). The full pinned sweep of every
table and every `public` function `authenticated` can run is `open_sign_up_access.test.sql` (S-4).

**U-7 — a user can't write or raise their own role (rolled back).** AC-27, AC-28. Method: DB query.

```sh
export S=…; . "$S/t6.sh"
id=$(db "select id from public.profiles where email='user@local.test'")
docker exec supabase_db_aj_classes psql -U postgres -At -c "begin; select set_config('request.jwt.claims', '{\"sub\":\"$id\",\"role\":\"authenticated\",\"aal\":\"aal1\"}', true); set local role authenticated; update public.profiles set role='admin' where id='$id'; update public.profiles set status='invited', is_active=false, terms_accepted_at=null where id='$id'; insert into public.classes (name) values ('t6'); rollback;" 2>&1 | grep -E '^UPDATE|ERROR' | head -3
db "select role||'|'||status||'|'||is_active from public.profiles where email='user@local.test'"
```

Expected: each update reports `UPDATE 0` or an `ERROR` (permission or policy), the insert an `ERROR`; afterwards
`user|active|true` (dry-run matched). Also `as_user user@local.test aal1 '[{"method":"password"}]' "select count(*) from public.my_onboarding()"` → `0`
and `select public.my_has_password()` → `t`.

**U-8 — PostgREST with a real user token.** AC-26, AC-27. Method: raw API.
Steps: `raw_password user@local.test local-password-123` → token; with it, GET `/rest/v1/classes?select=id`,
`/rest/v1/students?select=id`, `/rest/v1/profiles?select=email`; PATCH `/rest/v1/profiles?email=eq.user@local.test`
`{"role":"admin"}`.
Expected: `[]`, `[]`, `[{"email":"user@local.test"}]`; the PATCH changes nothing (an error, or `[]` with
`Prefer: return=representation`); `db "select role from public.profiles where email='user@local.test'"` → `user`.

**U-9 — users get no portal e-mail.** AC-29. Method: DB query + Mailpit.
Expected: `db "select count(*) from public.email_outbox o join public.profiles p on p.id = o.recipient_id where p.role = 'user'"`
→ `0` (dry-run: `0`). After Sitting 2, `mail_subjects` for each finished `t6` user contains only
`Confirm your e-mail for AJ Classes`, `Reset your AJ Classes password` (only where a case sent one) and
`Your password was changed` (only where a case changed it) — no "New work", "due" or "marked" subjects.
pgTAP-AX publishes, returns and sweeps due-tomorrow work and checks no outbox row is for a user (S-4).

**U-10 — users stay off staff and student lists.** AC-30. Method: DB query.
Expected: `as_user admin@local.test aal2 '' 'select count(*) from public.admin_list_staff()'` → `4` (dry-run) and
`as_user admin@local.test aal2 '' "select count(*) from public.admin_list_staff() where role = 'user'"` → `0`;
`db "select count(*) from public.students s join public.profiles p on p.id = s.profile_id where p.role='user'"` → `0`.
The browser side is AD-1 step 4.

**CAP-2 — the 16th sign-up is refused (raw).** AC-46. Method: raw API + DB.

```sh
export S=…; . "$S/t6.sh"; db "delete from private.sign_up_emails"
ids=$(plant_cap 15); echo "ids=$ids"
db "select public.sign_up_status()"
raw_signup t6-<run>-sixteenth@local.test "Sixteen Parent" "t6-throwaway-password-1"
db "select count(*) from auth.users where email='t6-<run>-sixteenth@local.test'"; mail_count t6-<run>-sixteenth@local.test
unplant_cap "$ids"
```

Expected: `ids=` and 15 comma-separated numbers; `busy`; `429 {"code":429,"error_code":"unknown","msg":"sign_up_busy"}` (05 slice 5 shape); `0`; `0`;
after the delete `0`.

**CAP-5 — the cap is a rolling 24 hours.** AC-46. Method: DB.
Steps (one shell): `db "delete from private.sign_up_emails"; ids=$(plant_cap 15 '25 hours'); db "select public.sign_up_status()"; unplant_cap "$ids"`.
Expected: `open` while the 15 old rows are there; `unplant_cap` prints `0`. (The hook's purge of old rows is pgTAP-OS, S-4.)

**CAP-9 — only an admin with two-step can switch sign-up.** AC-31, AC-48. Method: DB query (read-only; the
function raises before writing).
Expected: `as_user tutor@local.test aal1 '' 'select public.admin_set_sign_up_open(false)'` → `ERROR:  not_admin`
(dry-run matched); `as_user admin@local.test aal1 '' 'select count(*) from public.admin_list_users()'` →
`ERROR:  not_admin`; `db "select open from private.sign_up_settings"` → `t`.

**DEP-1 — release order and fail-closed deploy.** AC-47. Method: automated (`test-deploy-order.mjs`, inside S-2):
dry-run order gate → `db push` → guard check → functions → secrets → `config push` last → post-check; a failed
`config push` and autoconfirm-on after the push each give one `PATCH {"disable_signup":true}` and a non-zero exit;
the token only in a `-H @file`. Expected: 53 `ok` lines **(count)** (dry-run matched). Never run `deploy.sh` itself.

**DEP-2 — the guard and the static Auth settings.** AC-15, AC-39, AC-47, AC-51. Method: static + DB.

```sh
export S=…; . "$S/t6.sh"; cd /Users/sjain/dev/work/aj_classes
rpc_anon sign_up_guard_ready
grep -nE '^(enable_signup|enable_confirmations|sign_in_sign_ups|enable_manual_linking) ' supabase/config.toml
grep -n -A1 '^\[auth.hook.before_user_created\]' supabase/config.toml
grep -n -A1 -E '^\[(remotes\.production\.)?auth\.external\.google\]' supabase/config.toml
grep -n -E '^(admin_email|sender_name) = ' supabase/config.toml
awk '/^\[auth.sms\]/{f=1;next} /^\[/{f=0} f && /^enable_confirmations /' supabase/config.toml
```

Expected: `true`; the first grep prints seven lines, in file order: `enable_signup = true` (`[auth]`),
`enable_manual_linking = false`, `sign_in_sign_ups = 30`, `enable_signup = true` and `enable_confirmations = true`
(`[auth.email]`), `enable_signup = false` and `enable_confirmations = true` (`[auth.sms]`; dry-run at `84d2691`
matched); the hook `enabled = true`; both Google tables followed by `enabled = false`;
`admin_email = "hello@ajclasses.com.au"` and `sender_name = "AJ Classes"` (the production SMTP table);
`enable_confirmations = true` under `[auth.sms]` (FB2-6). Prove the
grep can fail: run it once against a copy with `enabled = true` under the production Google table and see the
mismatch.

**SU-9 — Turnstile is checked on the server.** AC-8, AC-38. Method: raw API.
Steps: `raw_signup_nocaptcha t6-<run>-nocap@local.test`; `auth_post resend '{"type":"signup","email":"t6-<run>-nocap@local.test"}'`;
`auth_post recover '{"email":"tutor@local.test"}'`.
Expected: the first two `400` with `"error_code":"captcha_failed"`; recover refused (non-2xx, captcha);
`db "select count(*) from auth.users where email='t6-<run>-nocap@local.test'"` → `0`;
`mail_count t6-<run>-nocap@local.test` → `0`; cap count unchanged.

**SU-10 — a bad name or a role marker from outside makes nothing.** AC-4, AC-28, AC-45. Method: raw API + DB.
Steps: `raw_signup t6-<run>-onechar@local.test "A" x-throwaway-password-123`; then a raw sign-up whose `data` is
`{"full_name":"Sneaky Parent","role":"tutor","account_role":"admin"}` for `t6-<run>-sneaky@local.test`.
Expected: first `429 … "msg":"invalid_name"`, no user, no mail, cap unchanged; second `200`, and
`db "select p.role||'|'||p.status||'|'||coalesce(u.raw_app_meta_data->>'account_role','-') from public.profiles p join auth.users u on u.id=p.id where p.email='t6-<run>-sneaky@local.test'"`
→ `user|invited|-`. (Mailpit +1 for sneaky: a normal confirmation.)

**SU-11 — sign-up never makes a staff role.** AC-28, AC-41. Method: DB. **Runs last in Sitting 2** (after INV,
before Sitting 3's R-2 and R-3), although it is listed here. Every `t6` account that any case makes a tutor, parent or
student carries `-inv` or `-promote` in its address (`-inv-pending`, `-inv-cap`, `-inv-closed`, `-invstaff`,
`-invstudent`, `-invparent`, `-inv-staff`, `-promote`), so the query excludes exactly those.
Expected: `db "select count(*) from public.profiles p join auth.users u on u.id=p.id where p.email like 't6-%' and (p.role <> 'user' or u.raw_app_meta_data ? 'account_role') and p.email not like '%-promote%' and p.email not like '%-inv%'"`
→ `0` (promoted and invited fixtures excluded by label). pgTAP-OS covers hostile metadata and `complete_onboarding` (S-4).

---

## 3. Browser cases (Sitting 2)

Before each browser case: a fresh browser context (signed out) unless it says otherwise; the dev server up; record
console errors (expected none) and the robots meta count (expected `1`).

### 3.1 Sign-up page

**SU-1 — the Sign in page links to sign-up; no Google button.** AC-1, AC-48, AC-51. Method: manual browser.
Steps: open `/portal/login`.
Expected: text `New to AJ Classes? ` followed by a link `Create an account` → `/portal/sign-up`; no
`Continue with Google` button (Google is off locally); the link appears nowhere else: open `/`, `/posts`, `/privacy`
and `/terms` and count links to `/portal/sign-up` → `0` each.

**SU-2 — what the sign-up page asks for.** AC-2, AC-51. Method: manual browser.
Steps: click the SU-1 link.
Expected: `h1` `Create an account`; the intro `For parents and guardians. Students get their accounts from AJ Classes.`;
labelled fields `Full name` (`autocomplete="name"`) and `Email` (`type="email"`); the Turnstile widget; the line
`We use your name and e-mail to run your account. See our Privacy Policy.` with `Privacy Policy` → `/privacy`; a
`Create account` button; `Already have an account? Sign in` with `Sign in` → `/portal/login`;
`document.querySelectorAll('input[type=password]').length` → `0`; no `Continue with Google`.

**SU-3 — name rules in the browser.** AC-4. Method: manual browser.
Steps: pass the check, then submit with each name and a new e-mail: `A`; 101 × `a`; `Ab‮cd` (contains U+202E);
then `  Ab  `.
Expected: `A` and 101 × `a` → field error `Please enter your full name (2–100 characters).` and no request to
`/auth/v1/signup` (network log); U+202E → `Please type your name on one line, without special formatting characters.`
and no request; `  Ab  ` → the sent card (SU-7 wording), and `db "select full_name from public.profiles where email='<that e-mail>'"` → `Ab`.

**SU-4 — an emoji name gets the same answer for every e-mail (review-5 item 3).** AC-4, AC-12, AC-46. Method:
manual browser + DB.
Steps: (a) name `😀`, e-mail `t6-<run>-emoji1@local.test`, submit; (b) name `😀`, e-mail `parent@local.test`,
submit; (c) name `😀😀`, e-mail `t6-<run>-emoji2@local.test`, submit.
Expected: (a) and (b) the same field error `Please enter your full name (2–100 characters).`, no request to
`/auth/v1/signup` in either; (c) the sent card, and
`db "select full_name||'|'||role||'|'||status from public.profiles where email='t6-<run>-emoji2@local.test'"` →
`😀😀|user|invited`. `parent@local.test` unchanged (`Local Parent|parent|active`).

**SU-5 — e-mail rules.** AC-5. Method: manual browser + DB.
Steps: submit with e-mail empty; `not-an-email`; then `T6-<run>-Mixed@Local.Test`.
Expected: `Please enter your email address.`; `Please enter a valid email address, like name@example.com.`
(`PORTAL_VALIDATION.emailInvalid`, the same text as Sign in and Forgot password); the mixed-case one is accepted, and
`db "select email from public.profiles where email ilike 't6-<run>-mixed@local.test'"` → `t6-<run>-mixed@local.test`.

**SU-6 — the "I am human" check comes first.** AC-8. Method: manual browser.
Steps: fill a valid name and new e-mail; submit without passing the check.
Expected: `Please complete the "I am human" check.` (`PORTAL_VALIDATION.captchaRequired`, as on Sign in) and no
request to `/auth/v1/signup`. The server-side refusal text `Please complete the "I am human" check and try again.`
(`captchaFailed`) and the widget reset after a failure are `sign-up.test.tsx` "shows captcha, rate-limit and network
problems, and resets the check after each" (S-2) plus SU-9.

**SU-7 — a new e-mail: the sent card, the account and the e-mail.** AC-10, AC-15, AC-41. Method: manual browser +
DB + Mailpit.
Pre: cap emptied. Steps: name `Priya T6`, e-mail `t6-<run>-new@local.test`, pass the check, `Create account`.
Expected:
- the card `h1` `Check your e-mail`, text `We've sent a link to confirm your address. It expires in 1 hour.`, then
  `Already have an account? Sign in or reset your password.` with `Sign in` → `/portal/login` and
  `reset your password` → `/portal/forgot-password`, and a link `Send the link again` → `/portal/sign-up/resend`;
- `db "select p.role||'|'||p.status||'|'||p.is_active||'|'||(u.email_confirmed_at is null)||'|'||coalesce(u.raw_app_meta_data->>'account_role','-') from public.profiles p join auth.users u on u.id=p.id where p.email='t6-<run>-new@local.test'"`
  → `user|invited|true|true|-`;
- `db "select count(*) from private.sign_up_emails"` → up by 1;
- `mail_subjects t6-<run>-new@local.test` → `Confirm your e-mail for AJ Classes`.

**SU-8 — noindex, not in the sitemap, under the portal's error boundary.** AC-11. Method: manual browser +
automated.
Expected: on `/portal/sign-up` exactly one `meta[name=robots]`, content contains `noindex`; `curl -s
http://localhost:5173/sitemap.xml | grep -cF 'portal'` → `0`; the ErrorBoundary is `sign-up.test.tsx` "AC-11: is
noindex, and sits under the portal root (its ErrorBoundary)" (S-2).

### 3.2 Existing e-mails, resend, enumeration

**EN-1 — every existing account gets the same card, and nothing changes or is sent.** AC-12, AC-46 (not at cap).
Method: manual browser + DB + Mailpit.
Pre: cap emptied. A pending invite: as admin, invite staff `t6-<run>-inv-pending@local.test` (don't redeem). The
deactivated finished user from AD-3 and the deactivated unfinished one from AD-5 if Sitting 2 order allows; else
run those two rows after AD-5. For each e-mail below, first save
`db "select p.full_name||'|'||p.role||'|'||p.status||'|'||p.is_active||'|'||md5(coalesce(u.encrypted_password,''))||'|'||coalesce(u.email_confirmed_at::text,'-') from public.profiles p join auth.users u on u.id=p.id where p.email='<e>'"`
and `mail_count <e>`. Then submit the form (name `Probe Parent`) with: `admin@`, `tutor@`, `student@`, `parent@`,
`user@`, `inactive@local.test`, `t6-<run>-inv-pending@local.test`, the AD-3 and AD-5 accounts.
Expected for every one: the same card as SU-7 (same heading and text, compare the card's `innerText`); the saved row
unchanged; `mail_count` unchanged; the cap count unchanged. Record the network reply of `/auth/v1/signup`: `200`
with `"identities":[]` for every one of these (FB2-6, the quiet reply), against `200` with one `email` identity for a
new address (SU-7). That raw difference is R1 (accepted, Decision 6; AC-12 as reworded), not a failure of this case.

**EN-2 — a pending invite still works after someone signs up with its e-mail.** AC-13. Method: manual browser.
Pre: EN-1 done for `t6-<run>-inv-pending@local.test`. Steps: open its invite link from Mailpit (`newest_link` is for
confirmations; take the `/portal/invite#token=…` link from the invite mail).
Expected: the invite setup form (`/portal/join`) opens for that e-mail, as today; finishing it gives
`db "select role||'|'||status from public.profiles where email='t6-<run>-inv-pending@local.test'"` → `tutor|active`.

**EN-3 — a repeat sign-up for an unfinished, unconfirmed e-mail.** AC-14 (closing paragraph), AC-12. Method:
manual browser + DB + Mailpit.
Pre: `t6-<run>-repeat@local.test` signed up once (link L1 in Mailpit). Steps: (a) sign up again within 60 s;
(b) back-date `db "update auth.users set confirmation_sent_at = now() - interval '2 minutes' where email='t6-<run>-repeat@local.test'"`
(local only) and sign up again → link L2; (c) open L1 and press Continue; (d) open L2 and press Continue.
Expected: (a) the sent card, `mail_count` unchanged (Auth's 60 s wait reads as sent); (b) the sent card, `mail_count`
+1, cap unchanged by both repeats (no new account); (c) `This link has expired or has already been used.`;
(d) lands on `/portal/join`. The finish step shows no ticked box: the tick is given only there (AC-14).

**EN-4 — Send the link again.** AC-19, AC-46 (R2). Method: manual browser + Mailpit + DB.
Pre: `t6-<run>-resend@local.test` signed up (unconfirmed, link L1, sent over 60 s ago or back-dated); the confirmed
unfinished account from CF-2 (`t6-<run>-new`, before CF-8). Steps: open `/portal/sign-up/resend`; for each of
L1's e-mail, `t6-<run>-new@local.test`, `nobody-<run>@local.test`: fill, pass the check, `Send link`; then repeat the
first one at once.
Expected: page `h1` `Send the link again`, intro `Enter the e-mail you signed up with.`; every reply the same:
heading `Check your e-mail`, the SU-7 text, plus `To finish signing up, use the link we e-mailed you, or Forgot password.`
with `Forgot password` → `/portal/forgot-password`. Mailpit: +1 for the unconfirmed one (new link; L1 now gives
`This link has expired or has already been used.`), +0 for the confirmed unfinished one, +0 for `nobody`, +0 for the
immediate repeat. Cap count unchanged throughout.

### 3.3 Confirmation and the finish step

**CF-1 — the confirmation e-mail.** AC-15, AC-16. Method: Mailpit (+ V-5 for the look).
Pre: SU-7. Steps: open the newest message to `t6-<run>-new@local.test` in Mailpit (`/api/v1/message/<id>`).
Expected: subject `Confirm your e-mail for AJ Classes`; HTML contains `Confirm your e-mail`,
`Someone, hopefully you, asked to create an AJ Classes account with this e-mail.`, a `Confirm my e-mail` button,
`This link expires in 1 hour and works once.`, `If the button doesn't work, copy this link into your browser:` and the
link printed as text; the link matches `^http://localhost:5173/portal/auth/confirm\?token_hash=(pkce_)?[0-9a-f]+&type=email$`
(the site, never `:55321`). Locally the sender is Supabase's default (`Admin <admin@email.com>`); the production
sender `AJ Classes <hello@ajclasses.com.au>` is DEP-2 plus FS-2. There is no separate plain-text part (05 slice 6;
lead assumption Q1 accepts the visible link).

**CF-2 — opening the link spends nothing until Continue; the token leaves the address bar.** AC-16. Method: manual
browser + DB.
Steps: open the CF-1 link in a fresh context; wait 5 s; check DB; press `Continue`; after landing, read
`location.href` and press Back once.
Expected: before the click `h1` `Confirm your e-mail`, `Continue to finish creating your account.`, a `Continue`
button; no request to `/auth/v1/verify` in the network log; `db "select email_confirmed_at is null from auth.users where email='t6-<run>-new@local.test'"`
→ `t`. After: `location.href` = `http://localhost:5173/portal/join`; Back never shows a URL containing `token_hash`;
`… is null` → `f`, and `db "select encrypted_password is null from auth.users where email='t6-<run>-new@local.test'"` → `t`
(the throwaway password is wiped).

**CF-3 — a used or broken link: one message.** AC-18. Method: manual browser.
Steps: open the CF-1 link again and press Continue; open it with the hash changed by one character; open
`/portal/auth/confirm?type=email` (no hash).
Expected: the first two show `This link has expired or has already been used.` with a link `Send the link again`
→ `/portal/sign-up/resend`, and nothing says which case it was; the third shows
`This link is incomplete. Please use the button in the email.` An expired link is `auth-confirm.test.tsx` "shows one
message and a "Send the link again" link when the link has expired" (S-2).

**CF-4 — the finish step.** AC-6, AC-7, AC-17, AC-50. Method: manual browser (+ V-2).
Pre: CF-2's session on `/portal/join`.
Expected: `h1` `Finish creating your account`; `You're signing up as t6-<run>-new@local.test.`; `Full name`
**empty** (never pre-filled for an e-mail sign-up: FB2-5); `Create password` and `Confirm password`, both `autocomplete="new-password"`, with a
show/hide control; a checkbox labelled `I'm a parent or guardian, and I agree to the Terms & Conditions and Privacy Policy.`
where `Terms & Conditions` → `/terms` and `Privacy Policy` → `/privacy`, both `target="_blank"`
`rel="noopener noreferrer"`; a `Finish` button; `Not you? Sign out`.

**CF-5 — until it is saved, the finish step is the only page.** AC-17. Method: manual browser.
Pre: CF-4's session. Steps: open `/portal`, `/portal/user`, `/portal/account`, `/portal/admin`, `/portal/parent`.
Expected: each ends on `/portal/join` with the finish step; no other page content renders.

**CF-6 — the finish step's checks.** AC-6, AC-7, AC-45. Method: manual browser.
Pre: CF-4's session. Each step with the valid name `Priya Tester` typed unless stated (the field starts empty,
FB2-5): (a) password `short-pass` (10) twice, tick, Finish; (b) two different 12+ passwords, tick; (c) a good
matching password, no tick, Finish; (d) name `A`, good passwords, tick.
Expected: (a) `Please use at least 12 characters.`; (b) `The two passwords don't match.`; (c)
`Please agree to the Terms & Conditions and Privacy Policy to continue.`; (d)
`Please enter your full name (2–100 characters).`; none of them sends `PUT /auth/v1/user` or
`/rest/v1/rpc/complete_sign_up` (network); `db "select status from public.profiles where email='t6-<run>-new@local.test'"`
→ `invited`. The server's weak-password message `Please use at least 12 characters, and avoid common passwords.` is
`FinishSignUpForm.test.tsx` "AC-6: shows the server's weak-password and same-password messages" (S-2); a save with no
tick through the API is pgTAP-OS `terms_required` (S-4).

**CF-7 — finishing makes the account active and lands on Latest news; other sessions end.** AC-6, AC-7, AC-14,
AC-17, AC-21. Method: manual browser + DB.
Pre: CF-4's session (context 1). In context 2, request Forgot password for `t6-<run>-new@local.test`, open the
recovery link, press Continue (context 2 also lands on the finish step). Save
`db "select count(*) from auth.sessions s join auth.users u on u.id=s.user_id where u.email='t6-<run>-new@local.test'"` (expect `2`).
Steps: in context 1, type the name `Priya Tester`, password P2 (`t6-finish-pass-<run>`) twice, tick, `Finish`.
Expected:
- context 1 lands on `/portal/user` with `h1` `Latest news`;
- `db "select status||'|'||(terms_accepted_at is not null)||'|'||(joined_at is not null)||'|'||full_name from public.profiles where email='t6-<run>-new@local.test'"`
  → `active|true|true|Priya Tester`;
- the sessions count → `1`; `db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='t6-<run>-new@local.test'"` → `0`;
- `db "select details::text from public.audit_log where action='account_activated' and target_id=(select id from public.profiles where email='t6-<run>-new@local.test')"`
  → `{"via": "email", "role": "user"}` (key order as Postgres prints `jsonb`);
- sign out, then sign in at `/portal/login` with P2 → `/portal/user`. The throwaway password never existed for
  anyone (it was wiped at CF-2).
- context 2 (its session row was deleted): reload → it never shows the finish step again. It lands on
  `/portal/user` while its access token lasts (up to 1 hour, which AC-14 allows: own profile and posts only) or on
  `/portal/login`; either passes. `db "select count(*) from public.audit_log where action='account_activated' and target_id=(select id from public.profiles where email='t6-<run>-new@local.test')"`
  → `1`.

**CF-8 — a stranger's password never signs in (AC-14 case 5, in the UI).** AC-14, AC-20. Method: raw API + manual
browser + DB.
Steps: (a) A: `raw_signup t6-<run>-victim@local.test "Stranger" 'stranger-pass-P1-123'`; (b) A at `/portal/login`
with P1; (c) B opens the confirmation link (`newest_link`) and presses Continue, then closes the tab without
finishing; (d) A signs in with P1 again; (e) B uses Forgot password, opens the link, finishes with P2; (f) P1 and P2
at `/portal/login`.
Expected: (b) `Email or password is incorrect.`; after (c) `db "select encrypted_password is null from auth.users where email='t6-<run>-victim@local.test'"`
→ `t`; (d) `Email or password is incorrect.`, and no `auth.sessions` row was created by A's attempts (count before
(d) = after (d)); (f) P1 → `Email or password is incorrect.`, P2 → `/portal/user`. Cases 1, 3 and 4 run in INT
(`test-open-sign-up.mjs` "S6: the confirm-time wipe" and "S5: the finish step", S-5); case 2 is G-4.

**CF-9 — authenticators added before proof are removed.** AC-14 case 6, AC-17. Method: DB fixture + browser.
Steps: sign up `t6-<run>-factor@local.test`; insert a factor before confirming
(`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) select gen_random_uuid(), id, 't6-before', 'totp', 'verified', now(), now(), 'T6T6T6T6T6T6T6T6' from auth.users where email='t6-<run>-factor@local.test'`);
open the link, Continue; count factors; insert a second factor (`t6-after`); finish the step; count again.
Expected: after Continue `0`; after the second insert `1`; after Finish `0`.

**CF-10 — AC-20 from the UI: a password saved but the finish not saved.** AC-17, AC-20. Method: manual browser
(Playwright `page.route('**/rest/v1/rpc/complete_sign_up', r => r.abort())`) + DB.
Steps: sign up `t6-<run>-pwonly@local.test` (name `Pw Only`); confirm; on the finish step type the name `Pw Only` and P2, tick, Finish with
the RPC aborted; remove the route; `Not you? Sign out`; at `/portal/login` sign in with P2.
Expected: after the aborted Finish the form shows
`We couldn't reach the server. Check your connection and try again.` (`PORTAL_ERRORS.network`) and the status is
still `invited`, with
`db "select password_set_at is not null from public.profiles where email='t6-<run>-pwonly@local.test'"` → `t`.
After the password sign-in: the address is `/portal/login?reason=finish-sign-up`, the page shows
`To finish signing up, use the link we e-mailed you, or Forgot password.` (link → `/portal/forgot-password`), no
portal page rendered, and the password session was ended on the server (sessions for that user before the sign-in =
after the redirect). Then run AMR-2. Then Forgot password → link → finish with a **new** password → `/portal/user`.

**CF-11 — pressing Finish again after a failed save, same password (regression of Tester 6a bug 1).** AC-6,
AC-17. Method: manual browser + DB.
Pre: as CF-10 up to the aborted Finish (`We couldn't reach the server. Check your connection and try again.`), on a
fresh `t6-<run>-retry` account, staying in the link session.
Steps: remove the route; press Finish again with the same password and tick.
Expected (`completeSignUp` now goes on past `same_password`): no
`Your new password must be different from your current one.`; it lands on `/portal/user` with `h1` `Latest news`;
`db "select status from public.profiles where email='t6-<run>-retry@local.test'"` → `active`; that password signs
in. Unit: `sign-up.service.test.ts` "on a retry after a failed save, the "same password" reply goes on to save
(Tester 6a bug 1)" (S-2).

**CF-12 — Forgot password for an unfinished sign-up leads to the finish step.** AC-20, AC-46 (R2). Method: manual
browser + DB + Mailpit.
Steps: sign up `t6-<run>-forgot@local.test` (don't confirm); save the cap count; `/portal/forgot-password` with that
e-mail, pass the check, `Send link`; open `Reset your AJ Classes password` from Mailpit, press Continue.
Expected: `If that email has an account, we've sent a link. It expires in 1 hour.`; Mailpit +1; the cap count
unchanged; Continue lands on `/portal/join` with the finish step (not Set your password); `encrypted_password is null`
→ `t`; finishing works and lands on `/portal/user`.

**CF-13 — a finished user resets and changes the password.** AC-24. Method: manual browser.
Pre: CF-7's finished user. Steps: Forgot password → link → Continue → `Set your password` → new password P3 →
sign in with P3; then Account → `Change password` → P4 → sign out → sign in with P4.
Expected: each sign-in lands on `/portal/user`; P2 and P3 are refused after they are replaced
(`Email or password is incorrect.`). Google-made accounts setting a password through Forgot password: INT/pgTAP
(S-4, S-5) and FS-1.

### 3.4 The daily cap and the switch

**CAP-1 — at the cap, everyone gets the busy message (page loaded busy).** AC-46, AC-12. Method: manual browser +
DB + Mailpit.
Pre: cap emptied; `ids=$(plant_cap 15)` (record `$ids`). Steps: load `/portal/login`, then `/portal/sign-up`; submit
(after the check) with `t6-<run>-capnew@local.test`, `parent@local.test`, and the unconfirmed `t6-<run>-resend@local.test`.
Expected: the login link `Create an account` still shows (busy counts as open); each submit shows
`Sign-up is busy right now. Please try again tomorrow.`; no request to `/auth/v1/signup` for any of them; no new
`auth.users` row; `mail_count` +0 for all three. Restore: `unplant_cap "<ids>"` → `0`; `sign_up_status` → `open`.

**CAP-3 — at the cap, resend and Forgot password still send and aren't counted.** AC-19, AC-20, AC-46 (R2).
Method: browser + Mailpit + DB.
Pre: cap emptied, `ids=$(plant_cap 15)`. Steps: `Send the link again` for the unconfirmed `t6-<run>-resend`
(back-date `confirmation_sent_at` first); Forgot password for `tutor@local.test`; as admin, invite staff
`t6-<run>-inv-cap@local.test` (AC-46: the cap never blocks invites).
Expected: both pages show their normal sent replies (never the busy message); Mailpit +1 each; the invite is sent
(`You're invited to the AJ Classes portal` in Mailpit) and its profile is `tutor`/`invited`; cap count still 15.
Restore: `unplant_cap "<ids>"` → `0`.

**CAP-4 — the cap fills while the page is open (review-5 item 2).** AC-46, AC-12. Method: manual browser + DB.
Steps: cap emptied; load `/portal/sign-up` (open) in tab A and fill name and `t6-<run>-race1@local.test`;
`ids=$(plant_cap 15)`; pass the check and submit. Then reload nothing, change the e-mail to `parent@local.test`, pass the check,
submit.
Expected: both show `Sign-up is busy right now. Please try again tomorrow.`; the network log has a
`/rest/v1/rpc/sign_up_status` call right before each would-be send and **no** `/auth/v1/signup`; no user for
`race1`; `mail_count` +0 for both. Restore: `unplant_cap "<ids>"` → `0`.

**CAP-6 — an admin closes and reopens sign-up.** AC-31, AC-48. Method: manual browser + DB + raw API.
Steps: as `admin@local.test` (two-step entered by the dev server), Admin → `Users` → the card shows
`Sign-up is open` and a `Close sign-up` button → dialog `Close sign-up?` /
`New people won't be able to create an account, by e-mail or with Google. Everyone who already has an account can still sign in.`
→ confirm. Then, signed out: `/portal/login`; `/portal/sign-up`; `raw_signup t6-<run>-closed@local.test "Closed Parent" x-throwaway-password-123`;
sign in as `tutor@` and `user@local.test`; as admin, invite staff `t6-<run>-inv-closed@local.test` (AC-48:
invites are not sign-ups). Back as admin: `Open sign-up` → `Open sign-up?` /
`Parents and guardians will be able to create an account again.` → confirm.
Expected: after closing, the status line `Sign-up closed.` and the card `Sign-up is closed`;
`db "select open||'|'||(updated_by = (select id from public.profiles where email='admin@local.test')) from private.sign_up_settings"`
→ `false|true`; an audit row `sign_up_closed` with `target_id` null. Signed out: no `Create an account` link; the sign-up
page shows `h1` `Sign-up is closed`, `New accounts are closed at the moment. If you already have an account, please sign in.`
and a `Sign in` link, and no form; the raw sign-up `429 … "msg":"sign_up_closed"`, no user, `mail_count` 0; tutor
and user sign in to `/portal/tutor` and `/portal/user`; the staff invite is sent while closed (Mailpit +1, profile
`tutor`/`invited`). After reopening: `Sign-up opened.`, `Sign-up is open`, audit
`sign_up_opened`, `open` → `t`, the login link back.

**CAP-7 — sign-up closes while the page is open (review-5 item 2).** AC-48, AC-12. Method: manual browser + DB.
Steps: tabs A1 and A2 (signed out) both load `/portal/sign-up` while it is open; A1 fills
`t6-<run>-race2@local.test`, A2 fills `parent@local.test` (name `Race Parent` in both); tab B (admin) closes
sign-up; without reloading, A1 and A2 each pass the check and submit.
Expected: both show the closed card (`h1` `Sign-up is closed`); no `/auth/v1/signup` request; no `race2` user;
Mailpit +0. Restore: tab B reopens (`open` → `t`).

**CAP-8 — Users page and switch are admin-only.** AC-25, AC-31. Method: manual browser.
Steps: as `tutor@local.test` open `/portal/admin/users`; as `user@`, `parent@`, `student@local.test` the same.
Expected: each shows `You don't have access to this page` / `This page isn't part of your account.`; the network
log has no `/rest/v1/rpc/admin_list_users` or `sign_up_status` call from that page (staff-client rule, 05 slice 28).

### 3.5 Google, as far as the local stack allows

**G-1 — the button stays hidden while Google is off.** AC-51. Method: manual browser.
Expected: no `Continue with Google` on `/portal/login` or `/portal/sign-up` (and no `or` separator line);
`/auth/v1/settings` reports `external.google: false`.

**G-2 — the button and the request when Google is on (stubbed settings).** AC-51. Method: manual browser
(`page.route('**/auth/v1/settings', …)` returning the real body with `external.google: true`; abort `**/authorize**`).
Steps: on `/portal/login` and on `/portal/sign-up`, click `Continue with Google`.
Expected: on both pages the button shows, with `or` above it; the aborted request goes to
`http://127.0.0.1:55321/auth/v1/authorize?provider=google…` with `redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fportal%2Fauth%2Fcallback`
and a `code_challenge` parameter. (`open-sign-up.spec.ts` covers the sign-up page in S-6.)

**G-3 — the callback's messages, for each recorded refusal shape.** AC-32, AC-48, AC-53, AC-54. Method: manual
browser. Open each URL in a fresh context:
1. `/portal/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity`
2. `/portal/auth/callback#error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity`
3. `/portal/auth/callback?error=server_error&error_description=google_email_unverified`
4. `/portal/auth/callback?error=server_error&error_description=sign_up_closed`
4b. `/portal/auth/callback?error=server_error&error_description=sign_up_refused`
5. `/portal/auth/callback?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`
6. `/portal/auth/callback?error=access_denied&error_code=user_banned&error_description=User+is+banned`

Expected: 1 and 2 → `This e-mail already has an AJ Classes account. Sign in with your e-mail and password, use Forgot password, or use the link we e-mailed you.`;
3 → `We couldn't get a verified e-mail address from Google. Please sign up with your e-mail instead.`;
4, 4b and 5 → `New accounts are closed at the moment. If you already have an account, please sign in.`;
6 → `Your account is not active. Please contact hello@ajclasses.com.au.`. Every one: `h1` `Sign in`, a
`Back to sign in` link → `/portal/login`, and `location.href` = `http://localhost:5173/portal/auth/callback`
(query and fragment wiped) after load.

### 3.6 What a signed-up user sees

**U-1 — the user home.** AC-21, AC-22. Method: manual browser.
Steps: sign in as `user@local.test` / `local-password-123`; reload.
Expected (both times): `/portal/user`; `h1` `Latest news`; `What's happening at AJ Classes, posted by our team.`;
`There are no news posts at the moment.` (seed has no posts); the navigation has exactly two links,
`Latest news` → `/portal/user` and `Account` → `/portal/account`, plus a `Sign out` button; the area badge `User`.

**U-2 — posts, newest first, as on `/posts`.** AC-21. Method: manual browser + DB fixture.
Steps: as admin, Admin → Posts: publish `e2e-t6-<run>-older` then `e2e-t6-<run>-newer`. As `user@local.test` open
`/portal/user`; open `/posts` signed out.
Expected: both pages list `e2e-t6-<run>-newer` above `e2e-t6-<run>-older`, with the same items in the same order.
Restore: delete both posts in Admin → Posts (or by saved ids); `db "select count(*) from public.posts"` → `0`.

**U-3 — the trimmed Account page.** AC-23. Method: manual browser.
Steps: as `user@local.test` open `/portal/account`.
Expected: `h1` `Your account`; the e-mail `user@local.test`; `Role` `User`; sections `Change password` and
`Appearance`; **no** `Notifications`, `Your choices` or `Two-step sign-in` heading; no request to the consents or
notification-settings RPCs in the network log. Change password hidden for a Google-only account is
`account.test.tsx` "hides Change password for a Google-only account with no password" (S-2).

**U-4 — every staff, admin, student and parent page is refused.** AC-25. Method: manual browser.
Pre: ids from `db` (first class, first assignment, its first student, `tutor@`'s id, Aarav Demo's id). Steps: as
`user@local.test` open each: `/portal/tutor`, `/portal/timetable`, `/portal/classes`, `/portal/classes/<classId>`,
`/portal/assignments`, `/portal/assignments/<assignmentId>`, `/portal/assignments/<assignmentId>/students/<studentId>`,
`/portal/profile`, `/portal/admin`, `/portal/admin/staff`, `/portal/admin/staff/<tutorId>`, `/portal/admin/activity`,
`/portal/admin/enquiries`, `/portal/admin/posts`, `/portal/admin/emails`, `/portal/admin/students`,
`/portal/admin/students/<studentId>`, `/portal/admin/users`, `/portal/student`,
`/portal/student/assignments/<assignmentId>`, `/portal/student/timetable`, `/portal/parent`,
`/portal/parent/children/<studentId>`, `/portal/parent/children/<studentId>/assignments/<assignmentId>`.
Expected: all 24 show `You don't have access to this page`, `This page isn't part of your account.` and
`Go to your home page`; no data from those pages appears. Also `/portal/login`, `/portal/sign-up`, `/portal/join` and
`/portal/account/two-step/setup` each redirect to `/portal/user`. The route walk that fails on a new layout is
`portal-access.test.ts` "knows every layout inside the member layout, and only the user area lets a user in" (S-2).

**U-5 — a signed-up user's session after Sign out.** AC-55 (sign out as today). Method: manual browser.
Expected: `Sign out` → `/portal/login`; Back → a portal page redirects to `/portal/login`.

### 3.7 Admin: Users, deactivate, reactivate, promote

**AD-1 — the Users page.** AC-30, AC-31. Method: manual browser (+ V-4).
Pre: several `t6` users from earlier cases, finished and not. Steps: as admin, Admin dashboard → the `Users`
shortcut → `/portal/admin/users`.
Expected: `h1` `Users`; intro `People who signed up on the website. They see only the latest news until you link them to a student.`;
the sign-up card; table columns `Name`, `E-mail`, `Signed up`, `How`, `Finished`, `Status`, `Action`; rows newest
first, matching `as_user admin@local.test aal2 '' "select email from public.admin_list_users()"` in order; the
`user@local.test` row reads `Local User`, `user@local.test`, `Signed up <d Mon yyyy>` (e.g. `Signed up 14 Nov 2026`),
`E-mail`, `Finished`, `Active`, `Deactivate`; an unconfirmed `t6` row reads `Not finished`; the hint
`To link a user to their child, use Invite or link a parent on the student's page.` Step 4: Staff
(`/portal/admin/staff`), Students, the dashboard's staff/student/invite counts and Emails show no `t6` account with
role `user` and no `user@local.test` (the `-inv` tutors rightly appear on Staff: EN-1's
as active once EN-2 redeems it, those from CAP-3, CAP-6 and INV-1 as invites).

**AD-2 — tutors and admins without two-step can't open it.** AC-31. Method: manual browser.
Expected: `tutor@` → `You don't have access to this page`; `newadmin@` (no authenticator) → sent to two-step setup
(`/portal/account/two-step/setup?next=…`).

**AD-3 — deactivate a finished user.** AC-32. Method: manual browser + DB.
Pre: a finished `t6-<run>-deact@local.test` (password P), signed in in context U on `/portal/user`. Steps: admin →
Users → its `Deactivate` → `Deactivate <name>?` / `They'll be signed out and can't sign in until you reactivate them.`
→ confirm; in context U open `/portal/account`; then sign in with P.
Expected: `<name> was deactivated.`, the row `Deactivated` with a `Reactivate` button;
`db "select p.is_active||'|'||(u.banned_until > now() + interval '99 years') from public.profiles p join auth.users u on u.id=p.id where p.email='t6-<run>-deact@local.test'"`
→ `false|true`; an audit `deactivated` row with that `target_id`. Context U ends on `/portal/login?reason=inactive` with
`Your account is not active. Please contact hello@ajclasses.com.au.`; the password sign-in shows
`Email or password is incorrect.` (lead assumption Q2: deliberate, R2a V18).

**AD-4 — reactivate.** AC-32. Method: manual browser + DB.
Steps: `Reactivate` → `Reactivate <name>?` / `They'll be able to sign in again.` → confirm; sign in with P.
Expected: `<name> was reactivated.`; `Active`; `is_active` `t`, `banned_until` null or in the past; audit
`reactivated`; the sign-in lands on `/portal/user`.

**AD-5 — deactivate an unconfirmed sign-up.** AC-12, AC-32, AC-36. Method: manual browser + DB + Mailpit.
Pre: `t6-<run>-deactnew@local.test` signed up, unconfirmed. Steps: Users → `Deactivate` → confirm; then sign up again
with that e-mail; then `Send the link again` for it.
Expected: the row `Not finished`, `Deactivated`;
`db "select (u.email_confirmed_at is not null)||'|'||(u.encrypted_password is null)||'|'||p.is_active from auth.users u join public.profiles p on p.id=u.id where u.email='t6-<run>-deactnew@local.test'"`
→ `true|true|false`; the sign-up shows the SU-7 card and the resend its card, with `mail_count` +0 for both (nothing is sent to a
deactivated sign-up). Invites to it: INV-6.

**AD-6 — link a finished e-mail user as a parent (promotion).** AC-33, AC-35. Method: manual browser + DB + Mailpit.
Pre: a finished `t6-<run>-promote@local.test` (name `Promo Parent`, password P), signed in in context U. Save its
`mail_count` and its sessions count. Steps: admin → Students → `Aarav Demo` → `Invite or link a parent` → e-mail
`t6-<run>-promote@local.test` → `Invite or link`; read the dialog; `Link as parent`.
Expected:
- the dialog `Link a signed-up user?`, `This e-mail belongs to a signed-up user. They'll become a parent of Aarav Demo.`,
  `Signed up with e-mail on <d Mon yyyy>.`, and **no** line about the mobile app (that is for Google only);
- after `Link as parent`: `Linked as a parent of Aarav Demo. No e-mail was sent.` and the person shows on Aarav's
  parent rows;
- `db "select p.role||'|'||(u.raw_app_meta_data->>'account_role')||'|'||(select count(*) from public.student_guardians g where g.parent_id=p.id) from public.profiles p join auth.users u on u.id=p.id where p.email='t6-<run>-promote@local.test'"`
  → `parent|parent|1`;
- `db "select details->>'promoted_from', details->>'signed_up_with', details->>'student_name' from public.audit_log where action='parent_linked' and target_id=(select id from public.profiles where email='t6-<run>-promote@local.test')"`
  → `user|email|Aarav Demo`;
- `mail_count` unchanged; the sessions count unchanged; the row is gone from Admin → Users;
- in context U the next page goes to `/portal/parent` (from `/portal`), showing Aarav Demo; P still signs in.
Restore at R-9 (the guardian row goes with the deleted user).

**AD-7 — the account changed while the admin was deciding.** AC-33. Method: manual browser.
Pre: a finished `t6-<run>-changed@local.test`. Steps: open the AD-6 dialog for it (stop at `Link a signed-up user?`);
in another tab deactivate it on the Users page; press `Link as parent`.
Expected: back on the form with `This e-mail's account changed while you were deciding. Please try again.`;
`role` still `user`, no `student_guardians` row. The Google wording (`Signed up with Google on …` plus
`They signed up with Google, so they can't use the mobile app until they set a password with Forgot password on the website.`)
and the `role_sync_failed` heal are `ParentInviteDialog.test.tsx` and INT "Promotion in invite-parent" (S-2, S-5).

### 3.8 Invites and signed-up accounts

**INV-1 — a staff invite replaces an unfinished sign-up.** AC-36. Method: manual browser + DB + Mailpit.
Pre: `t6-<run>-invstaff@local.test` signed up (unconfirmed, link L1); save its user id. Steps: admin → Staff →
invite staff with that e-mail; then open L1 and Continue; then open the invite link from Mailpit.
Expected: the invite is sent as for any new e-mail; L1 → `This link has expired or has already been used.`;
`db "select p.id <> '<old id>', p.role, p.status, coalesce(u.raw_app_meta_data->>'account_role','-'), u.email_confirmed_at is not null from public.profiles p join auth.users u on u.id=p.id where p.email='t6-<run>-invstaff@local.test'"`
→ `t|tutor|invited|tutor|t`; the audit `invite_sent` for it has `details->>'replaced_sign_up'` = `true`; the invite
link opens the staff setup form; the e-mail is no longer on Admin → Users.

**INV-2 — a student invite replaces an unfinished sign-up.** AC-34, AC-36. Method: manual browser + DB.
Pre: a seed student with no account: `db "select id||'|'||full_name from public.students where profile_id is null order by full_name limit 1"`
(save it); `t6-<run>-invstudent@local.test` signed up, unconfirmed (link L1). Steps: that student's page →
account section → `Send invite` with that e-mail.
Expected: the invite is sent; L1 dead (as INV-1); the new profile `student|invited` with `account_role` `student`.
Restore: delete the invited auth user by e-mail, then
`db "select profile_id is null from public.students where id='<saved id>'"` → `t` (if not, set it back to null by
saved id).

**INV-3 — a parent invite replaces an unfinished sign-up.** AC-36. Method: manual browser + DB.
Pre: `t6-<run>-invparent@local.test` signed up, unconfirmed. Steps: Aarav Demo → `Invite or link a parent` with it,
name `Inv Parent`.
Expected: a normal parent invite (no confirm dialog: it isn't finished); L1 dead; profile `parent|invited`, `account_role`
`parent`.

**INV-4 — a finished user can't be invited as staff.** AC-37. Method: manual browser.
Expected: invite staff with a finished `t6` user's e-mail → `This e-mail already has an account.`; nothing changes
(role `user`, status `active`); Mailpit +0.

**INV-5 — a finished user can't become a student's account.** AC-34. Method: manual browser.
Expected: a student's `Send invite` with a finished `t6` user's e-mail →
`This e-mail already has an account. Signed-up accounts are for parents and guardians. Use a different e-mail for the student's account.`;
nothing changes; Mailpit +0.

**INV-6 — a deactivated sign-up is refused by every invite.** AC-36. Method: manual browser.
Pre: AD-3's (finished, deactivated) and AD-5's (unfinished, deactivated) accounts. Steps: staff invite, student
invite and parent invite with each.
Expected: all six → `This e-mail already has an account.`; nothing changes; Mailpit +0. `resend-invite` and
`cancel-invite` for a user (`not_allowed`) and the finish-versus-replace race are INT "Invites and sign-ups" (S-5).

---

## 4. Mobile (Sitting 3)

**M-1 — a finished user on the shipped mobile build.** AC-40, AC-41. Method: mobile (simulator, local stack).
Steps: sign in as `user@local.test` / `local-password-123`; screenshot; kill and relaunch the app; screenshot.
Expected (from `access_state_service.dart:62` and `error_copy.dart`): the app stays on the sign-in screen with
`Something went wrong. Please try again.` in the error colour (the `Unresolvable role` error, `ErrorKeys.server`);
no tab bar, no class, student, parent or staff data; no crash on either launch; never the "invited, setup
unfinished" screen.

**M-2 — an unfinished sign-up on mobile.** AC-40. Method: mobile.
Pre: an unfinished, confirmed `t6-<run>-mobile@local.test` (its throwaway password is wiped). Steps: sign in with any
password.
Expected: `Email or password is incorrect.`; never the "invited, setup unfinished" screen;
`as_user t6-<run>-mobile@local.test aal1 '' 'select count(*) from public.my_onboarding()'` → `0`.

**M-3 — a promoted user on mobile.** AC-35. Method: mobile.
Pre: AD-6's promoted account. Steps: sign in with P.
Expected: the parent home showing Aarav Demo (role from `account_role = parent`), as `parent@local.test` gets.

**M-4 — what mobile reads is unchanged.** AC-41. Method: DB.
Expected: `db "select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('role','full_name','is_active','invited_at') order by 1"`
→ `full_name`, `invited_at`, `is_active`, `role` (dry-run matched); `db "select proname from pg_proc where proname='my_onboarding'"` → `my_onboarding`;
`db "select count(*) from auth.users u join public.profiles p on p.id=u.id where p.role='user' and u.raw_app_meta_data ? 'account_role'"` → `0`.

---

## 5. Terms and Privacy

**T-1 — the Terms page.** AC-50. Method: manual browser + automated.
Steps: open `/terms` at 375 and 1280 px.
Expected: 200; one `h1` `Terms & Conditions`; `Last updated: November 2026`; the intro starting
`These terms cover every AJ Classes portal account`; the ten section headings in order `Who we are`,
`Who can have an account`, `What a signed-up account is for`, `Keeping your account safe`, `Using the portal`,
`E-mails from us`, `Closing accounts`, `Your information`, `The portal itself`, `Changes to these terms`; the
`Your information` section links to `/privacy`; one robots meta (indexable, a public page); no sideways scroll; no
console errors. `sitemap.xml` lists `/terms` right after `/privacy`. The invite setup form's terms line links to
`/terms` (open a real invite's `/portal/join` from INV-1 or R-2). Own ErrorBoundary: `terms.test.tsx` (S-2).
Wording approval: FS-5.

**T-2 — the Privacy Policy says true things.** AC-43. Method: manual browser + automated.
Expected on `/privacy`: the text `Portal accounts are created by invitation from AJ Classes, or by parents and guardians signing up themselves when sign-up is open.`
present, and `only by invitation` absent (`curl -s http://localhost:5173/privacy` is a client shell, so read the
rendered page text); the sentences about Google (`Google gives us your name, your e-mail address and a link to your Google profile picture; we use only your name and e-mail address.`)
and the account e-mails (`such as confirming your address, password resets and security notices`) present.
`privacy.test.tsx` "says parents and guardians can sign up, and what a signed-up account gets (open sign-up AC-43)" (S-2).
Wording approval: FS-5.

---

## 6. Regression (Sitting 3)

**R-1 — every seeded role signs in, and stays signed in after reload.** AC-42. Method: manual browser.
Steps: for each account at `/portal/login` with `local-password-123`, then reload.
Expected: `admin@local.test` → `/portal/admin` (the dev server enters the code); `newadmin@local.test` →
`/portal/account/two-step/setup`; `tutor@` → `/portal/tutor`; `student@` → `/portal/student`; `parent@` →
`/portal/parent`; `user@` → `/portal/user`; each the same after reload; `inactive@local.test` →
`Email or password is incorrect.` and no session.

**R-2 — a new staff invite end to end.** AC-42. Method: manual browser + automated.
Expected: invite `t6-<run>-inv-staff@local.test` → Mailpit `You're invited to the AJ Classes portal` → setup form →
active `tutor`; `auth.users.email_confirmed_at` set at creation (before the redeem). Automated:
`invite-onboarding.spec.ts` (S-6) and `test-invite-redeem.mjs` (S-5).

**R-3 — parent and student invites as before.** AC-42. Method: manual browser.
Expected: a parent invite to a new e-mail sends an invite; a parent invite with `parent@local.test` on a child they
aren't linked to links without an e-mail (as today, `linked`); a student invite to a new e-mail sends an invite.
Restore each fixture by deleting its auth user (and the guardian row) by saved id.

**R-4 — Forgot password and two-step for staff.** AC-38, AC-42. Method: manual browser + automated.
Expected: Forgot password for `tutor@` without the check → `Please complete the "I am human" check.`; with it →
the sent message and Mailpit +1; the recovery link → `Set your password`. Admin 2FA login: `staff-login.spec.ts`
(S-6). PKCE reset: `open-sign-up.spec.ts` "Forgot password still works with the PKCE client (S7)" (S-6).

**R-5 — the public page sweep.** AC-42, AC-50. Method: manual browser (addendum sweep).
Steps: fetch `http://localhost:5173/sitemap.xml`; for every `<loc>` (path part), at 375 px and 1280 px.
Expected: **23** URLs **(count)** including `/terms`; each 200, no console errors, no sideways scroll
(`scrollWidth <= clientWidth`), exactly one `h1`, exactly one `meta[name=robots]`; no `/portal` URL in the list.

**R-6 — the account page for families and staff is unchanged.** AC-23, AC-42. Method: manual browser.
Expected: `parent@` sees `Your choices` and `Notifications`; `student@` sees `Notifications`; `tutor@` sees
`Two-step sign-in` and no `Notifications`.

**R-7 — the existing e2e smoke and CSP suites.** AC-42. Method: automated = S-6 (13) and S-7 (23).

**R-8 — the stack-wide counts are the seed's.** AC-42. Method: DB.
Expected at the end (before R-9): `db "select count(*) from public.classes"` → `3`, `students` → `6`,
`student_guardians` → `2` plus any rows from AD-6/R-3 not yet restored; `sign_up_guard_ready()` → `t`.

**R-9 — clean-up and hand-back.** Method: DB + shell.

```sh
export S=…; . "$S/t6.sh"
db "delete from public.posts where title like 'e2e-t6-%'"
db "delete from auth.users where email like 't6-%@local.test'"
db "delete from private.sign_up_emails"
db "update private.sign_up_settings set open = true where id and not open"
db "select (select count(*) from public.profiles where email like 't6-%' or email like 'e2e-%'), (select count(*) from private.sign_up_emails), (select open from private.sign_up_settings), (select count(*) from public.posts)"
lsof -nP -iTCP:5173 -sTCP:LISTEN
rm -f "$S/status.json" "$S/anon.hdr" "$S"/*.hdr
```

Expected: `0|0|t|0`; nothing on 5173 (stop the dev server by its PID from `lsof`, after checking its cwd is this
repo); the key files deleted. INV-2's student `profile_id` is null again; `student_guardians` → `2`.

**TST-1 — the tests AC-44 names exist.** AC-44. Method: static (the suites S-2, S-4 to S-6 prove they pass).

```sh
cd /Users/sjain/dev/work/aj_classes
grep -cF 'identity_link_refused' supabase/tests/database/open_sign_up.test.sql
for s in "S1: the before-user-created hook" "AC-15/16: the confirmation e-mail (S2 text part)" "S6: the confirm-time wipe (AC-14)" "S2/S4: captcha, resend and unconfirmed sign-in" "S5: the finish step" "S7: e-mail links still work with the PKCE client" "Invites and sign-ups (AC-13, AC-34, AC-36, AC-37)" "Promotion in invite-parent (AC-33, AC-35)"; do printf '%s => %s\n' "$s" "$(grep -cF "$s" supabase/scripts/test-open-sign-up.mjs)"; done
grep -oE "AC-14 case [1-6]" supabase/scripts/test-open-sign-up.mjs | sort -u | paste -sd, -
grep -cF "a parent signs up by e-mail, confirms, finishes and lands on Latest news" e2e/tests/open-sign-up.spec.ts
grep -cF "terms_required" supabase/tests/database/open_sign_up.test.sql
grep -cF "Steps in order:" supabase/scripts/test-deploy-order.mjs
```

Expected (dry-run matched): `11` (the Q3 linking rows: each refused kind);
each of the eight sections `=> 1` (spikes S1, S2, S4 to S7; S3 is the pgTAP rows above); `AC-14 case 1,AC-14 case 2,AC-14
case 3,AC-14 case 4,AC-14 case 5,AC-14 case 6`; `1` (the e-mail sign-up to Latest news e2e); `2` or more (the save
without its tick, AC-45); `1` (the `deploy.sh` dry-run order check). The raw-API sign-up that skips the form is SU-9/SU-10
here and the INT hook section; the cap's same busy message for new and existing e-mails is CAP-1 and `sign-up.test.tsx`.

---

## 6b. Security additions ([06-security.md](06-security.md))

**SEC-1 — the e-mail-change API tells a signed-in user whether an address has an account (Security finding 2).**
AC-12 (R1/R2 extension). Method: raw API. **Records a residual risk: the expected 422 is a PASS of the check, not a
defect.** Writes nothing for an address that already exists.

```sh
export S=…; . "$S/t6.sh"
raw_password user@local.test local-password-123 > /dev/null
python3 -I -c "import json; t=json.load(open('$S/last.json'))['access_token']; open('$S/user.hdr','w').write('Authorization: Bearer '+t+'\n')"
curl -s -o "$S/put.json" -w '%{http_code}\n' -X PUT -H @"$S/anon.hdr" -H @"$S/user.hdr" -H 'Content-Type: application/json' -d '{"email":"admin@local.test"}' "$API/auth/v1/user"; cat "$S/put.json"; echo
db "select email||'|'||coalesce(email_change,'')||'|'||coalesce(email_change_token_new,'') from auth.users where email='user@local.test'"
rm -f "$S/user.hdr"
```

Expected: `422` and a body with `"error_code":"email_exists"`; the `auth.users` row unchanged (`user@local.test||`);
`mail_count admin@local.test` unchanged. Record it in the TSR under "residual risks confirmed" for Saurabh's
decision (Security "For the lead" item 1). Do **not** probe a non-existing address: that sends an e-mail-change mail.

**Fix batch 2** (commits `19905ba`, `7a0b2d9`, `ffd77ce`, `52deea4`, `0746501`, `76d70f2`). Values below are read from
`5e92ee6` (batches 3 and 4 included).

**FB2-1 — `deploy.sh` keeps secrets off argv (Security finding 3).** AC-47. Method: automated + static.
Expected: `test-deploy-order.mjs` (S-2) passes, among its 53, `No fake ever saw a secret value in its arguments (DB
password, Resend, worker, Zoho)`, `link and db push run with no --password, and find SUPABASE_DB_PASSWORD in the
environment`, `secrets set reads a 0600 --env-file holding every hosted value, single-quoted`, `A secret with a quote
is refused while checking what's needed, before any command runs`, `A secret with a line break is refused while
checking what's needed, before any command runs` and `The header and secrets files are gone after exit, on success
and on failure` (names read from the `1562010` run log). Static gate (the base commit is the planted bad file):

```sh
cd /Users/sjain/dev/work/aj_classes
for src in tree base; do
  if [ $src = tree ]; then f() { git show 5e92ee6:supabase/scripts/deploy.sh; }; else f() { git show 8a33156:supabase/scripts/deploy.sh; }; fi
  echo "$src: pw=$(f | grep -cE -- '--password "\$') arr=$(f | grep -cE 'supabase secrets set .*"\$\{secrets\[@\]\}"') envfile=$(f | grep -cE 'supabase secrets set --project-ref "\$PROJECT_REF" --env-file') post=$(f | grep -cE 'security_captcha_enabled|rate_limit_email_sent|security_manual_linking_enabled|external_anonymous_users_enabled|mailer_otp_length|sms_autoconfirm')"
done
```

Expected (dry-run matched): `tree: pw=0 arr=0 envfile=1 post=6` and `base: pw=2 arr=1 envfile=0 post=0`.
(`grep -c` counts lines. Keep `$src` out of a `git show "<rev>:path"` written as `$src:path`: zsh reads `:s` as a
modifier and prints "bad substitution".) Never run `deploy.sh` itself.

**FB2-2 — the wider post-check (Security finding 6).** AC-47. Method: automated + static.
Expected: `auth_settings_are_safe` in `deploy.sh` requires, besides the hook URI, `mailer_autoconfirm == false` and
`disable_signup == false`: `.security_captcha_enabled == true and .security_captcha_provider == "turnstile"`,
`.rate_limit_email_sent == $email_sent` (from `[auth.rate_limit] email_sent`, `30`), `.external_google_enabled == $google`
(from `google_enabled`), `.security_manual_linking_enabled == false`, `.external_anonymous_users_enabled == false`,
and (batch 3) `.mailer_otp_length == $otp_length` (from `[auth.email] otp_length`, `8`) and `.sms_autoconfirm == false`
(`git show 5e92ee6:supabase/scripts/deploy.sh | grep -cF 'mailer_otp_length == $otp_length and .sms_autoconfirm == false'`
→ `1`). `test-deploy-order.mjs` passes the nine `Post-check: … → non-zero exit and one PATCH closes sign-up` checks
(`sign-up off after the push (disable_signup)`, `Turnstile off`, `another captcha provider`, `the hourly e-mail limit
not the configured 30`, `Google on while config.toml says off`, `manual linking on`, `anonymous sign-ins on`,
`e-mailed codes 6 digits, not 8`, `SMS sign-up auto-confirmed`); the dry-run prints `(dry run) would check … Turnstile
on, rate_limit_email_sent = 30, Google as config.toml, manual linking and anonymous sign-ins off, mailer_otp_length =
8, sms_autoconfirm false`.

**FB2-3 — the guidance line in the promote dialog (Security finding 4).** AC-33. Method: manual browser +
automated.
Expected: in AD-6's dialog (`Link a signed-up user?`), a warning box with
`Only link an e-mail that is already on this student’s enrolment record, or that you confirmed with the parent you already know. Never link one supplied only in a message.`
(`PARENT_INVITE_DIALOG.promote.checkFirst`; note the curly `’` in `student’s`), shown for every signed-up user
before `Link as parent`. `release-notes.md` says the same. Unit: `ParentInviteDialog.test.tsx` "warns to link only an
e-mail on the enrolment record or confirmed with the known parent (security 06 finding 4)" (S-2).

**FB2-4 — unconfirmed sign-ups are deleted after 7 days, and nothing else (AC-56; Security findings 8 and 12;
was D8).** Method: DB query (fixtures inside `begin … rollback`) + automated.
1. `db "select jobname||'|'||schedule||'|'||active||'|'||command from cron.job where jobname='delete-stale-sign-ups'"`
   → `delete-stale-sign-ups|45 17 * * *|true|select private.delete_stale_sign_ups()`, and
   `db "select count(*) from cron.job where active"` → `4` (both dry-run matched).
2. `db "select has_function_privilege('authenticated','private.delete_stale_sign_ups()','execute'), has_function_privilege('authenticated','private.is_stale_sign_up(uuid)','execute'), pg_get_function_result('private.delete_stale_sign_ups()'::regprocedure), private.can_write_auth_tables('postgres')"`
   → `f|f|integer|t` (separate columns print `t`/`f`).
3. The matrix, in one transaction that is rolled back. Fixture e-mails end `@cleanup.test` so they never match the
   seed's `@local.test`; the seven seed profiles (named, so the run's own `t6-` accounts are left alone) are back-dated
   too, so the job is shown not to touch them.

```sh
export S=…; . "$S/t6.sh"
docker exec -i supabase_db_aj_classes psql -U postgres -At -q -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email, null,
       case when v.confirmed then now() end,
       '{"provider":"email","providers":["email"]}'::jsonb
         || case when v.marker is null then '{}'::jsonb else jsonb_build_object('account_role', v.marker) end,
       jsonb_build_object('full_name', 'Cleanup Fixture'), now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-00000000f601', 'stale@cleanup.test',       false, null),
  ('00000000-0000-0000-0000-00000000f602', 'six-days@cleanup.test',    false, null),
  ('00000000-0000-0000-0000-00000000f603', 'confirmed@cleanup.test',   true,  null),
  ('00000000-0000-0000-0000-00000000f604', 'finished@cleanup.test',    true,  null),
  ('00000000-0000-0000-0000-00000000f605', 'deactivated@cleanup.test', false, null),
  ('00000000-0000-0000-0000-00000000f606', 'audited@cleanup.test',     false, null),
  ('00000000-0000-0000-0000-00000000f607', 'tutor@cleanup.test',       false, 'tutor'),
  ('00000000-0000-0000-0000-00000000f608', 'parent@cleanup.test',      false, 'parent'),
  ('00000000-0000-0000-0000-00000000f609', 'student@cleanup.test',     false, 'student')
) as v (id, email, confirmed, marker);
update public.profiles set status = 'active', joined_at = now() where id = '00000000-0000-0000-0000-00000000f604';
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000f605';
insert into public.audit_log (actor_id, action, target_id)
select id, 'reactivated', '00000000-0000-0000-0000-00000000f606' from public.profiles where email = 'admin@local.test';
update public.profiles set created_at = now() - interval '8 days' where email like '%@cleanup.test' or email in ('admin@local.test','newadmin@local.test','tutor@local.test','inactive@local.test','parent@local.test','student@local.test','user@local.test');
update public.profiles set created_at = now() - interval '6 days' where id = '00000000-0000-0000-0000-00000000f602';
select 'qualifies', string_agg(split_part(email, '@', 1), ',' order by email) from auth.users u where email like '%@cleanup.test' and private.is_stale_sign_up(u.id);
select 'removed', private.delete_stale_sign_ups();
select 'fixtures left', count(*) from auth.users where email like '%@cleanup.test';
select 'stale left', count(*) from auth.users where email = 'stale@cleanup.test';
select 'stale profile left', count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000f601';
select 'seed left', count(*) from auth.users where email in ('admin@local.test','newadmin@local.test','tutor@local.test','inactive@local.test','parent@local.test','student@local.test','user@local.test');
select 'second run', private.delete_stale_sign_ups();
rollback;
SQL
db "select count(*) from auth.users where email like '%@cleanup.test'"
```

   Expected: `qualifies|stale`; `removed|1`; `fixtures left|8`; `stale left|0`; `stale profile left|0`;
   `seed left|7`; `second run|0`; after the rollback `0`, and S-0's list unchanged. So: the six-day-old,
   confirmed, finished, deactivated (`f605`), audited (`f606`, active but named by an audit row) and the three
   invitees are all kept. Not dry-run (it writes, then rolls back): a mismatch is a plan error or a bug for the lead.
4. Rows that stop qualifying while the job runs (Security finding 12): automated only, pgTAP-OS (S-4): "The blocked
   row still qualifies", "Confirmed meanwhile: no longer qualifies", "Deactivated meanwhile: no longer qualifies",
   "Audited meanwhile: no longer qualifies", "Once nothing blocks it, the next run deletes that row". The delete
   itself re-checks with the same helper: `git show 5e92ee6:supabase/migrations/20261114100100_open_sign_up.sql | grep -cF 'delete from auth.users u where u.id = stale and private.is_stale_sign_up(u.id)'`
   → `1`.
5. Real data (read-only): `db "select count(*) from auth.users u where private.is_stale_sign_up(u.id)"` → `0` on a
   fresh seed.

Note (AC-56 as reworded): a sign-up deactivated from Admin → Users is confirmed and audited, so the job keeps it, and
it keeps refusing a later invite to that address until it is reactivated and linked as a parent (INV-6).

**FB2-5 — no name pre-fill on the finish step for e-mail sign-ups (Security finding 9).** AC-14, AC-17. Method:
manual browser + automated.
Expected: CF-4's `Full name` is empty although the sign-up sent `Priya T6`; CF-7's typed `Priya Tester` is what is
saved; in CF-8, B's finish step never shows `Stranger` anywhere (`page.content()` has no `Stranger`). A Google
sign-up still starts with the name from its Google account (unit only, no local Google). Unit: `FinishSignUpForm.test.tsx`
"doesn't pre-fill an e-mail sign-up's name, which a stranger may have typed (security 06 finding 9)" and "starts a
Google sign-up with the name from the owner's Google account"; e2e `open-sign-up.spec.ts` asserts the empty field
(S-2, S-6).

**FB2-6 — the quiet reply for a confirmed e-mail (`[auth.sms] enable_confirmations = true`; Security finding 10).**
AC-12. Method: static + raw API + DB + Mailpit.
Steps:

```sh
export S=…; . "$S/t6.sh"; cd /Users/sjain/dev/work/aj_classes
awk '/^\[auth.sms\]/{f=1;next} /^\[/{f=0} f && /^(enable_signup|enable_confirmations) /' supabase/config.toml
before=$(db "select md5(p.full_name||p.role||p.status||coalesce(u.encrypted_password,'')) from public.profiles p join auth.users u on u.id=p.id where p.email='parent@local.test'"); m0=$(mail_count parent@local.test)
raw_signup parent@local.test "Probe Parent" x-throwaway-password-123 | cut -c1-4
python3 -I -c "import json; d=json.load(open('$S/last.json')); print(d.get('identities'), d.get('id'))"
db "select id from auth.users where email='parent@local.test'"
after=$(db "select md5(p.full_name||p.role||p.status||coalesce(u.encrypted_password,'')) from public.profiles p join auth.users u on u.id=p.id where p.email='parent@local.test'"); [ "$before" = "$after" ] && echo unchanged; echo "mail +$(( $(mail_count parent@local.test) - m0 ))"
```

Expected: `enable_signup = false` and `enable_confirmations = true` (at `8a33156`: `false`); `200 `; `[]` and an
`id` that differs from the real one printed next; `unchanged`; `mail +0`. Then repeat for a new address
`t6-<run>-quiet@local.test`: `200` with `identities` holding one `email` entry (record it: R1, narrowed not closed).
EN-1 and S-5 carry the other account kinds. The service still treats a `422 user_already_exists` as quiet (for a
project with SMS confirmations off): `sign-up.service.test.ts` (S-2).

### UI regressions of the 6a findings

**UI-1 — Admin → Users when the status can't be read (regression of Tester 6a bug 2).** AC-31, AC-48. Method:
manual browser (`page.route('**/rest/v1/rpc/sign_up_status', r => r.abort())`).
Steps: as admin open `/portal/admin/users` with the route aborted; then remove the route and press `Try again`.
Expected: with the abort, the sign-up card says `We couldn't load whether sign-up is open.` with a `Try again`
button, and there is **no** `Close sign-up` or `Open sign-up` button; the user table still lists the users. After
`Try again`: `Sign-up is open` and `Close sign-up`. With the same abort, signed out, `/portal/sign-up` still shows the
closed card (`Sign-up is closed`) and `/portal/login` hides `Create an account` (fail closed, unchanged). Unit:
`admin-users.test.tsx` "says the status couldn't be loaded, with a retry, rather than claim closed (Tester 6a bug 2)"
and `sign-up.service.test.ts` "reports a failed read as a failure, not as closed (Tester 6a bug 2)" (S-2).

**UI-2 — a server-side name refusal uses the self-service wording (regression of Tester 6a bug 3).** AC-4, AC-45.
Method: manual browser (route fulfil).
Steps: (a) on `/portal/sign-up`, fulfil `**/auth/v1/signup` with status 429 and body
`{"code":429,"error_code":"unknown","msg":"invalid_name"}`, then submit a valid name and a new e-mail; (b) on a finish
step (a fresh confirmed `t6-<run>-nameerr` sign-up), fulfil `**/rest/v1/rpc/complete_sign_up` with status 400 and
body `{"code":"P0001","message":"invalid_name"}`, then Finish with a valid name, password and tick.
Expected: both show the field error `Please enter your full name (2–100 characters).` (`PROFILE_VALIDATION.nameLength`)
under `Full name`; the page text never contains `Please enter their full name`. Unit: `sign-up.test.tsx` "shows a
server-side name refusal in the page's own words (Tester 6a bug 3)" and `FinishSignUpForm.test.tsx` "shows a
server-side name refusal in the form's own words (Tester 6a bug 3)" (S-2).

(The third 6a bug, the Finish retry, is CF-11.)

## 6c. E-mailed codes are 8 digits; authenticator codes stay 6 (review-6b, Security finding 5)

**OTP-1 — the settings and constants.** AC-42 (no regression), Security finding 5. Method: static.

```sh
cd /Users/sjain/dev/work/aj_classes
awk '/^\[auth.email\]/{f=1;next} /^\[/{f=0} f && /^(otp_length|otp_expiry|secure_password_change) /' supabase/config.toml
awk '/^\[auth.mfa.phone\]/{f=1;next} /^\[/{f=0} f && /^otp_length /' supabase/config.toml
grep -nE '^\s*(codeLength|emailCodeLength):' apps/web/src/constants/app.constants.ts
grep -cF 'maxLength: 6' /Users/sjain/dev/work/aj_classes_mobile/lib/core/presentation/screens/verify_totp_screen.dart
```

Expected: `secure_password_change = true`, `otp_length = 8`, `otp_expiry = 3600`; phone MFA `otp_length = 6`
(off, unchanged); `codeLength: 6, // authenticator (TOTP) codes` and `emailCodeLength: 8, …`; mobile `1` (the TOTP
field, unchanged). `portal-validation.test.ts` "matches [auth.email] otp_length in supabase/config.toml" (S-2) fails
if the two drift.

**OTP-2 — Change password asks for the 8-digit e-mailed code.** AC-24, AC-42. Method: manual browser + DB fixture
+ Mailpit.
Pre: a finished `t6-<run>-reauth@local.test` signed in. Fixture (local only, makes the session older than a day so
Auth wants re-authentication): `db "update auth.sessions set created_at = now() - interval '25 hours' where user_id = (select id from auth.users where email='t6-<run>-reauth@local.test')"`.
Steps: Account → `Change password` → new password twice → `Change password`; read the code from Mailpit
(`Your AJ Classes code`, the 8 digits in its text); type the first 6 digits → submit; then all 8 → submit; then sign
out and sign in with the new password.
Expected: the status text `You signed in more than a day ago, so we emailed you an 8-digit code to confirm it’s you.`
(batch 3; a unit test fails if any constant says "a 8-digit"); a `Code from the email` field with `maxlength="8"` and the number keypad (`inputmode="numeric"`);
the e-mail's subject `Your AJ Classes code`, its text `Enter this code on the AJ Classes portal to confirm it's you:`
(no "staff portal"), **no `Staff` badge** in its header (batch 4, `a55579f`: users get this e-mail too), and one
8-digit code (`python3 -I -c 'import re,sys; print(re.findall(r"(?<![0-9])[0-9]{8}(?![0-9])", sys.stdin.read()))'`
on the message's `Text` gives one item; BSD `grep` treats `\b` differently, so don't use it); 6 digits →
`Please enter the 8-digit code from the email.` and no request to `PUT /auth/v1/user`; 8 digits →
`Password changed. Other devices have been signed out.`; the new password signs in to `/portal/user`. Then
`Email me a new code` (on a second back-dated attempt) → `We sent a new code.` and Mailpit +1.

**OTP-3 — the finish step's e-mailed code is 8 digits too.** AC-17. Method: manual browser + DB fixture + Mailpit.
Pre: a confirmed `t6-<run>-finishcode` on its finish step; back-date its session 25 hours (as OTP-2).
Steps: fill name, password, tick, `Finish`; then a 6-digit code; then the real 8-digit code and `Finish` again.
Expected: `For your security, we've emailed you a code. Enter it below, then press Finish again.`; the code field
`maxlength="8"`; 6 digits → `Please enter the 8-digit code from the email.`; 8 digits → `/portal/user`, status
`active`. Unit: `FinishSignUpForm.test.tsx` "asks for the 8-digit e-mailed code, not a 6-digit one (security 06
finding 5)" (S-2). The invite setup form (`Finish setup again`) uses the same 8-digit field: `join.tsx` passes
`AUTH_LIMITS.emailCodeLength` (static: `grep -cF 'length={AUTH_LIMITS.emailCodeLength}' apps/web/src/routes/portal/join.tsx` → `1`).

**OTP-4 — authenticator codes stay 6 on the web.** AC-42. Method: manual browser.
Steps: sign in as `newadmin@local.test` and reach two-step setup; and as `admin@local.test` with the dev server's
automatic code turned off if possible, else read `TwoStepCodeForm` on `/portal/login/verify`.
Expected: the authenticator code field has `maxlength="6"`; 5 digits → `Please enter the 6-digit code.`
(`PORTAL_VALIDATION.codeInvalid`); `staff-login.spec.ts` (admin 2FA, S-6) passes.

**OTP-5 — authenticator codes stay 6 on mobile.** AC-40, AC-42. Method: mobile.
Steps: sign in as `admin@local.test` on the simulator (the TOTP step-up).
Expected: the code field takes 6 digits (`verify_totp_screen.dart:75`, `maxLength: 6`); a valid TOTP for
`LOCALDEVADMINKEYLOCALDEVADMINKEY` signs in to the admin dashboard, as the README's `flutter drive` role flow does.

---

## 7. Lead's visual cases, and Saurabh's checks

**Lead (real-browser judgement).** The Tester captures 375 px and 1280 px, light and dark, and hands them over:

- **V-1** — `/portal/sign-up`: the form, the sent card, the busy message, the closed card. AC-2, AC-10, AC-46, AC-48.
- **V-2** — `/portal/auth/confirm` (sign-up variant) and the finish step, including an error state. AC-16, AC-17.
- **V-3** — the user home (empty, and with U-2's two posts) and the trimmed Account page. AC-21 to AC-23.
- **V-4** — Admin → Users (with finished, unfinished and deactivated rows, and both switch dialogs) and the promote
  dialog. AC-31, AC-33, AC-48.
- **V-5** — the confirmation e-mail, the recovery e-mail and the code e-mail (`Your AJ Classes code`, from OTP-2) in
  Mailpit: same frame, colours and logo, **no `Staff` badge on any of the three** (code e-mail: batch 4), the
  recovery e-mail says `your AJ Classes account`, and the code e-mail says `the AJ Classes portal`. AC-15.

**For Saurabh — not in the frozen pass/fail set.** The TSR words these ACs as "partly verified", never a plain PASS:

- **FS-1 — a real Google sign-up and sign-in** (AC-52 to AC-55, AC-51 on the live button, and AC-14 case 2 with a
  real provider), after he creates the Google client and switches it on (release-notes step 4). Steps: one Google
  sign-up with a new address → finish step with no password → Latest news; sign out and sign in with Google again →
  straight to Latest news; one Google sign-in with an address that already has an e-mail account → message M.
- **FS-2 — a real e-mail sign-up on production** (AC-15 sender `AJ Classes <hello@ajclasses.com.au>` through Resend,
  AC-16 `SITE_URL` link), release-notes step 3.
- **FS-3 — the hosted per-IP limit** (AC-39): local GoTrue sets no rate-limit header, so it enforces nothing
  (05 slice 30). The team pins `sign_in_sign_ups = 30` (DEP-2) and the mapping `over_request_rate_limit` →
  `Too many attempts. Please wait a few minutes and try again.` (`auth-errors.test.ts`, `sign-up.test.tsx`).
  Saurabh, after release: 31 quick wrong sign-ins from one network → that message.
- **FS-4 — the hosted "Before User Created" hook is offered on the plan** (release gate; release-notes step 2).
- **FS-5 — wording approval** of `/terms` (AC-50) and the Privacy changes (AC-43).

---

## 8. Pre-freeze findings for the lead

Resolved by fix batch 2 and the lead's stage-6 rulings (`00-decisions.md`), now tested as regressions:
the AC-12 wording (EN-1, FB2-6: page-level; raw `identities: []` is R1), the Finish retry (CF-11), the Users page with
an unknown status (UI-1), the self-service `invalid_name` wording (UI-2), AC-40's mobile state (M-1, ruled "today's
error state") and AC-27 (a permission rule: U-7, U-8).

Fixed since: "a 8-digit" (batch 3, OTP-2), the `Staff` badge on the code e-mail (batch 4, review-6a item 10, OTP-2,
V-5), and the clean-up keeping deactivated and audited sign-ups (batch 3, AC-56 reworded, FB2-4).

Still open, for the lead:

8. **Security's `otp_expiry = 1800` wasn't taken** (`otp_expiry = 3600`, OTP-1). With 8 digits the brute-force risk is
   covered (review-6b); recorded only so the TSR doesn't report it as missed.

## 9. Traceability (AC → cases)

| AC | Cases |
|---|---|
| 1 | SU-1, S-6 |
| 2 | SU-2, V-1 |
| 3 | Removed (Decision 2: parents only) |
| 4 | SU-3, SU-4, SU-10, H-1, CF-6, UI-2 |
| 5 | SU-5 |
| 6 | CF-4, CF-6, CF-7, CF-11 |
| 7 | CF-4, CF-6, CF-7 |
| 8 | SU-6, SU-9 |
| 9 | Removed (Decision 2: no age tick) |
| 10 | SU-7, V-1 |
| 11 | SU-8 |
| 12 | EN-1, EN-3, SU-4, AD-5, CAP-1, CAP-4, CAP-7, SEC-1, FB2-6 (reworded: page-level; raw reply is R1) |
| 13 | EN-2 |
| 14 | CF-2, CF-7, CF-8, CF-9, EN-3, G-4, S-5, FB2-5 |
| 15 | CF-1, DEP-2, V-5, FS-2 |
| 16 | CF-1, CF-2, S-6 |
| 17 | CF-4, CF-5, CF-7, CF-10, CF-11, AMR-1, AMR-2, FB2-5, OTP-3 |
| 18 | CF-3 |
| 19 | EN-4, CAP-3 |
| 20 | CF-10, CF-12, AMR-2, CAP-3 |
| 21 | U-1, U-2, CF-7, V-3 |
| 22 | U-1 |
| 23 | U-3, R-6, V-3 |
| 24 | CF-13, OTP-2 |
| 25 | U-4, CAP-8 |
| 26 | U-6, U-8, S-4 |
| 27 | U-7, U-8, S-4 (reworded: a permission rule, no name-edit screen) |
| 28 | H-1, SU-10, SU-11, U-7, S-4 |
| 29 | U-9, S-4 |
| 30 | U-10, AD-1 |
| 31 | AD-1, AD-2, CAP-6, CAP-8, CAP-9, UI-1 |
| 32 | AD-3, AD-4, AD-5, G-3 |
| 33 | AD-6, AD-7, FB2-3 |
| 34 | INV-2, INV-5 |
| 35 | AD-6, G-6, M-3 |
| 36 | INV-1, INV-2, INV-3, INV-6, AD-5 |
| 37 | INV-4 |
| 38 | SU-9, R-4 |
| 39 | DEP-2 (setting only); not locally testable → FS-3 |
| 40 | M-1, M-2, S-8, OTP-5 |
| 41 | M-4, SU-7, SU-11 |
| 42 | S-1 to S-8, R-1 to R-8, OTP-1, OTP-4, OTP-5 |
| 43 | T-2, FS-5 |
| 44 | TST-1 (each named test exists), S-2, S-4, S-5, S-6 (they pass) |
| 45 | SU-10, CF-6, H-1, UI-2 |
| 46 | CAP-1 to CAP-5 (CAP-3: invites still sent at the cap), EN-4, SU-4 |
| 47 | DEP-1, DEP-2, FB2-1, FB2-2 |
| 48 | CAP-6 (invites still sent while closed), CAP-7, H-2, G-3, SU-1, UI-1 |
| 49 | Removed (Decision 1: live at release; closing is AC-48) |
| 50 | T-1, S-7, CF-4, FS-5 |
| 51 | SU-1, SU-2, G-1, G-2 |
| 52 | G-5, H-1; real Google → FS-1 |
| 53 | H-1, G-3; real Google → FS-1 |
| 54 | G-3, G-4; real Google → FS-1 |
| 55 | AMR-1, G-5, U-5, S-4; real Google → FS-1 |
| 56 | FB2-4 (was D8; reworded in batch 3: deactivated and audited sign-ups are kept) |

Coverage: 53 live ACs (56 less AC-3, AC-9, AC-49), all traced to at least one case. Not fully testable locally:
AC-39 (hosted per-IP limit), and the real-provider and real-mail parts of AC-15 and AC-51 to AC-55 (FS-1, FS-2).
