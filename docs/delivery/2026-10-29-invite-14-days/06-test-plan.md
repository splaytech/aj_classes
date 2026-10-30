# 06 — Test plan: invites stay valid for 14 days

Stage 6a of `/deliver`, Tester. Branch `feature/invite-14-days`, worktree
`/Users/sjain/dev/work/aj_classes-invites`. Date 2026-10-29.
Inputs: [01](01-requirement.md) (AC 1–41), [03](03-design.md) (§4.3, §5, §8), [04](04-plan.md),
[05](05-dev-notes.md) (gates, AC trace, deviations, fixtures, handover), [review-1..5](review-5.md),
[06-security](06-security.md), the tester addendum (`~/second-brain/Projects/AJClasses/_agents/tester.md`).

**Plan base: `0e6c200`** (code at `aa7f1ee`, after fix batches 1–3: 05-dev-notes "Fix batch 1", "Fix batch 2" and "Fix batch 3"). Revised after [review-6a](review-6a.md) round 1 (findings 1–7) and round 2 (2 nits). **Frozen at
`0e6c200`, 74 cases** (APPROVED, review-6a round 2), plus one case added at freeze (E-10s, from
nit 2): 75. Later rounds may only add cases.
First written at `d35311c`, then re-synced to the batch: the token now travels in the fragment
(`/portal/invite#token=…`) and is wiped from the address bar on every load and every same-tab
re-open (§0.2); a late redeem answer for a link replaced in the same tab is dropped (batch 3,
E-10). At run time, if
`git diff --quiet 0e6c200 HEAD -- apps/web/src supabase e2e package.json` fails, re-derive every
count and expected value marked **(count)** from the files and the measured output before
comparing (shared tester rule, item 8 lesson). A wrong expected value found in the run is a plan
error, which the TSR records and the lead rules on; the run doesn't edit this plan.

The `/test-and-ship` run writes `docs/test-reports/<date>-feature-invite-14-days/TSR.md` (plus
`bugs/`, `evidence/`). **Each case's Actual/Result goes into the TSR as soon as the case runs.**

---

## 0. Set-up

### 0.1 What was dry-run for this plan (2026-10-29, read-only)

Final dry-runs at `0e6c200` (batch 3; the Tester owns the stack and ports, so these include
writes, all cleaned up afterwards: back to 6 auth users, 0 tokens, 6 students, 2 guardians):

| Dry-run at `0e6c200` | Result |
|---|---|
| `pnpm test` | `Test Files  76 passed (76)`, `Tests  657 passed (657)`, e2e unit `ℹ tests 6` |
| Feature Vitest files (S-3, 8 files) | `Test Files  8 passed (8)`, `Tests  57 passed (57)` |
| PROD-1 build (local Supabase + Turnstile test key) and mirror | `build exit=0`; `check-hosted-ref: 0 files (of 155 scanned)`; headers `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, CSP; `pw-states` 16 lines and `pw-reopen abc` exactly as PROD-1 states, in Chromium and WebKit |
| `pw-reopen.mjs` on the dev server, `abc` and real L1/L2 | every E-9 line below (Chromium; `abc` also WebKit) |
| `pw-late.mjs` (E-10), real B | Chromium and WebKit: `refusedSeen` false throughout, B lands on `/portal/join`; `CONTROL=1` shows `refusedSeen: true` (the check can fail) |
| TC-11 rate-limit check, real fixture | `+10` after ten refusals from A; the valid token from A refused, `used_at` still null; from B `ok`, `+11` |
| TC-17 sign-in, real F-4 fixture (`pw-login.mjs`) | `/portal/tutor`, `h1` `Welcome, TP`, same after reload |
| Browsers installed | Chromium (1228, 1248) and WebKit (2370); **no Firefox** |
| e2e smoke list | `Total: 10 tests in 5 files` (the AC 6 opens are now new pages, plus a same-tab regression inside the onboarding test) |
| `pw-reopen.mjs` (appendix C) | `node --check` only; the review round holds the browser ports, so its first run is its dry run |

Re-sync dry-runs at `56f3efd` (batch 1; superseded where the table above differs):

| Dry-run at `56f3efd` | Result |
|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | exit 0 each |
| `pnpm test` | `Test Files  76 passed (76)`, `Tests  655 passed (655)`, e2e unit `ℹ tests 6` (the Developer ran it 4 times in a row green after the P-1 fix) |
| Feature Vitest files (S-3, now 8 with `admin-student.test.tsx`) | `Test Files  8 passed (8)`, `Tests  55 passed (55)` (batch 2 will add tests: count pending) |
| e2e lists | smoke `Total: 10 tests in 5 files`; CSP `Total: 21 tests in 1 file` |
| Static gates S-7 G1–G11 | as stated per gate. **G9 was fixed in the re-sync:** without `-F`, `${…}` is read as a regex and the gate printed `0` on the correct file |
| `invite-redeem` `{"token":"x"}` | `{"ok":false,"code":"invite_invalid"}` with `cache-control: no-store` |
| `pw-states.mjs` on the dev server, `#token=abc` | 16 lines, every UI-1a value below; `?token=abc` shows the incomplete state and is itself stripped to `/portal/invite` |
| Same-tab probes (an earlier version of `pw-reopen.mjs`) | E-6 values below; found P-5 and P-6 (the bug fix batch 2 addresses). Appendix C's final script passed `node --check` only: the ports went back to the Developer before it could run |
| `invite_redeem_attempts` after all of the above | `0` (shape refusals never reach the database) |

First dry-run at `d35311c` (kept for the record; superseded where the table above differs):

| Dry-run | Result |
|---|---|
| `pnpm format:check` | exit 0, `All matched files use Prettier code style!` (no `actionItems.md` in this worktree) |
| `pnpm lint`, `pnpm typecheck` | exit 0 |
| `pnpm test` (4 runs) | 3 runs `Tests  647 passed (647)`, `Test Files  75 passed (75)`; **1 run failed** `admin-staff-member.test.tsx:81` (pre-freeze finding P-1) |
| Feature Vitest files (S-3) | `Test Files  7 passed (7)`, `Tests  51 passed (51)` |
| `VITE_APP_ENV=production pnpm build` | exit 0 |
| e2e lists | `Total: 10 tests in 5 files` (smoke); `Total: 21 tests in 1 file` (CSP; the addendum's 19 is stale) |
| Static gates G1–G8, G10 (S-7) | as stated per gate; each also failed on a planted bad input |
| Edge mount, newest migration | mount count `1`; `20261030100000` = newest file |
| `invite-redeem` shape refusals (no DB write) | `OPTIONS` 204; `{"token":"x"}` → 200 `{"ok":false,"code":"invite_invalid"}`; other Origin → 403 `forbidden`; GET → 405 `method_not_allowed`; non-JSON → 400 `invalid_request`; `{}` → 200 `invite_invalid`. `invite_redeem_attempts` stayed `0` |
| `account-admin` refused callers | signed out (publishable key only) → `403 not_admin`; bad bearer → `401 UNAUTHORIZED_INVALID_JWT_FORMAT` |
| Helper `tp.mjs` (§0.4) | `node --check` ok; `totp`, `mails`, `link`, `mail`, `redeem x`, `call signedout/badtoken` as above |
| UI-1 script `pw-states.mjs` (§0.4) on the dev server, `?token=abc` | every value in UI-1 below was measured this way (both widths, both schemes, 0 console errors, 1 robots meta, 1 `h1`, no sideways scroll) |

**Not dry-run** (they write to the shared stack, which Reviewer/Security and then the Developer
were using): `pnpm db:test` (expected 18 files, 834 tests, from 05 T9.1 **(count)**),
`pnpm test:functions` (4 scripts, 413 checks: 92 / 30 / 153 / 138, 05 "Fix batch 2" **(count)**), the e2e runs, every
fixture, every invite and redeem with a real token, the email-off run, the production preview.
The first execution of each is its dry run: if a *command* fails for a reason unrelated to the
build, fix the command, note it in the TSR, rerun.

### 0.2 Parameters (final, from fix batch 1)

| Name | Meaning | Value (frozen) | Was at `d35311c` |
|---|---|---|---|
| `LINK_SEP` | Where the token sits in the emailed link | `#`: `http://localhost:5173/portal/invite#token=<43 base64url>`; a `?token=` query is ignored (incomplete state) | `?` |
| `STRIP` | When the token leaves the address bar | `render`: on **every load and every same-tab re-open**, through the router with `replace` (batch 2). A re-open adopts the new token. A fragment change always adds one history entry, which the page then overwrites with `/portal/invite`, so history grows by exactly 1 per re-open and no entry keeps the token. Continue doesn't touch the address bar | `continue` |
| `NOSTORE` | `Cache-Control: no-store` on function replies | `present` (every `respond()` reply) | `absent` |
| `STRAY` | `deleteUser` branch in `invite-redeem` | `no`: any identity mismatch refuses, releases and warns `mismatch` (G11) | `yes` |

Cases tagged **[LINK_SEP]**, **[STRIP]** or **[NOSTORE]** depend on these. The helper's link
pattern accepts only `#token=`, so an email with the old `?token=` shape makes `TP link` print
`no link` (a fail).

### 0.3 Ground rules

1. **Stack owner.** The Tester owns the local stack and :5173 for the run, **after** the lead hands
   it back from the Developer's fix batch. Before the first state-changing command, confirm with
   the lead that nobody else is using it. Nobody else resets, restarts, seeds or runs suites.
2. **Local only.** `supabase status -o env` shows `LINKED_PROJECT_REF`; never use `--linked`,
   `db push`, `functions deploy` or a `*.supabase.co` URL. Hard stop if any output names one.
3. **Keys.** `supabase status` output goes only to `$T/status.env`. `local-test-helpers.mjs`
   reads the service key at run time and never prints it. No key, token or link goes into the TSR
   or evidence: tokens stay in `$T/links/` (outside git); the TSR writes `<TOKEN>`.
4. **Code under test.** Before any function or e2e case and after every restart, run **CHK**
   (§0.5). After any edit under `supabase/functions/`, run
   `docker restart supabase_edge_runtime_aj_classes` (05 T3 correction: no hot reload), then CHK.
5. **Dev server:** `pnpm dev --port 5173 --strictPort` from `apps/web` of this worktree, run in the
   background with its log in `$T/dev.log`; take the URL from that log. Clear the console before
   measuring if a source file was edited while it ran.
6. **Fixtures** (§0.6). Each case creates its own `tp-…@local.test` accounts right before it needs
   them and removes them by e-mail at its end. The seed is never changed except where a case says
   so, and that case restores it in the same case.
7. **Rate limit.** Every browser redeem shares one Docker address, so clear the bucket (F-2) right
   before each browser block that clicks Continue. `tp.mjs redeem`/`signs-in` use a fresh
   `x-forwarded-for` per call and don't need it.
8. **Browser.** Driven with Playwright from `e2e/node_modules` (scripts in §0.4 / per case) or
   Claude in Chrome. Values are **measured** with the snippets given. Stub `window.confirm` if a
   case hits one. Screenshots go to `$T/shots/` and are copied to `evidence/` (no tokens visible:
   take them after the strip, or crop the address bar).
9. `actionItems.md` (Saurabh's, in the `main` checkout) and `e2e/.env` are never staged or
   committed.

**PRE** — every shell block starts with this line (each tool call is a fresh zsh shell):

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T/links" "$T/shots" && STAMP=$(cat "$T/stamp" 2>/dev/null || (date +%s | tee "$T/stamp")) && LINK_SEP='#' && STRIP=render && NOSTORE=present
```

**Q "…"** below means `docker exec supabase_db_aj_classes psql -U postgres -At -c "…"` (`-At`
prints `|`-separated values and an empty string for null). **TP …** means `node "$T/tp.mjs" …`
(it prints `Stopped services: […]` and a CLI-update notice on stderr from `supabase status`; ignore
both, or add `2>/dev/null`). `E(x)` means `tp-x-$STAMP@local.test`.

### 0.4 Helper scripts (write them to `$T` once, from the appendix)

- `$T/tp.mjs` (appendix A): `totp`, `invite-staff <e> <name>`, `invite-student <studentId> <e>`,
  `invite-parent <studentId> <e> <name>`, `resend <e>`, `cancel <e>`, `call <who> <json>`
  (`who` = `signedout|badtoken|tutor|student|parent|admin-aal1|admin`), `mails <e>` (Mailpit
  count to that address), `link <e>` (newest invite link), `subject <e>`, `mail <e>` (From, Subject,
  text lines, HTML; token masked), `redeem <token> [address]` (prints `status=… <body>`, or
  `ok:tokenHash` on success, never the hash), `signs-in <e> <token>` (redeem + Auth `/verify`
  hop; prints `redeem=200 ok hop=200 same_account=true` on success), `old-link <e>`,
  `set-password <e> <pw>`, `password-signin <e> <pw>`.
- `$T/pw-states.mjs` (appendix B): the invitee page states at 375/1280 × light/dark, each state in
  a new tab.
- `$T/pw-reopen.mjs` (appendix C): the same-tab re-open cases for E-9 and PROD-1 (`<token1> [token2]`).
- `$T/pw-late.mjs` (appendix D): the late-answer case E-10 (route interception).
- `$T/pw-login.mjs` (appendix E): signs in at `/portal/login` and prints the landing path (TC-17, R-2).
- Every page script takes `BROWSER=chromium` (default) or `webkit`; Firefox isn't installed.

Saving a link: `TP link E(x) > "$T/links/x"`; its token: `TOK=$(sed -E 's/.*token=//' "$T/links/x")`.

### 0.5 CHK (after every restart and before function/e2e cases)

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep -c aj_classes-invites/supabase/functions
ls supabase/migrations | tail -1
docker exec supabase_db_aj_classes psql -U postgres -At -c "select max(version) from supabase_migrations.schema_migrations"
curl -s -o /dev/null -w 'options=%{http_code}\n' -X OPTIONS http://127.0.0.1:55321/functions/v1/invite-redeem -H 'Origin: http://localhost:5173'
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Expected: `1`; `20261030100000_invite_tokens.sql` and `20261030100000` (or a newer pair that
match, if the batch adds a migration); `options=204`; the only 5173 listener (if any) has a cwd
under `/Users/sjain/dev/work/aj_classes-invites/` (`lsof -a -p <pid> -d cwd -Fn`).

### 0.6 Fixtures (exact; local database only)

**F-1 Back-date a link and its date together** (03 §8.1 item 2; `sent_at`, `expires_at` and
`profiles.invited_at` move by the same interval, so `expires_at > sent_at` still holds). Run it
right after the send:

```
cd /Users/sjain/dev/work/aj_classes-invites && E='<email>' && I='<interval>'
docker exec supabase_db_aj_classes psql -U postgres -At -c "update private.invite_tokens t set sent_at = t.sent_at - interval '$I', expires_at = t.expires_at - interval '$I' from public.profiles p where p.id = t.profile_id and p.email = '$E';" -c "update public.profiles set invited_at = invited_at - interval '$I' where email = '$E';" -c "select round(extract(epoch from now() - t.sent_at)/60), round(extract(epoch from t.expires_at - t.sent_at)/3600), p.invited_at = t.sent_at from private.invite_tokens t join public.profiles p on p.id = t.profile_id where p.email = '$E';"
```

Expected: `UPDATE 1`, `UPDATE 1`, then `<minutes since send ≈ interval>|336|t`.
Intervals used: `13 days`, `13 days 23 hours`, `14 days`, `14 days 1 minute`, `15 days`, `10 days`.

**F-2 Clear the redeem rate limit** (before each browser block that clicks Continue):
`Q "delete from private.invite_redeem_attempts;"` → `DELETE <n>`.

**F-3 Old-format link** (AC 38; 03 §8.1 item 4): `TP old-link E(old) > "$T/links/old"` prints
`http://localhost:5173/portal/auth/confirm?token_hash=<hash>&type=invite`. Auth creates an
invited tutor with Auth's `invited_at`, which the guarded trigger copies, so its chip shows
`Invited` (expected, 03 §8.1 item 4). Remove: `Q "delete from auth.users where email = 'E(old)';"`.

**F-4 AC 17 joined-account fixture** (05 T5 deviation: `email_confirm: true` is needed for the
password sign-in):
`Q "update public.profiles set status = 'active', joined_at = now() where email = 'E(17)';"`, then
`TP set-password E(17) tp-local-password-17-only` → `status=200` (the helper sends
`{ password, email_confirm: true }` to `PUT /auth/v1/admin/users/<id>`).

**F-5 Email off** (05 S2 / T9.3: `functions serve --env-file` overrides `[edge_runtime.secrets]`;
`config.toml` is **not** edited). Start, in the background (`run_in_background`):

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
printf 'EMAIL_TRANSPORT=off\n' > "$T/email-off.env"
supabase functions serve --env-file "$T/email-off.env" > "$T/serve.log" 2>&1
```

Then check it is live before any case:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
curl -s -w ' status=%{http_code}\n' -X POST http://127.0.0.1:55321/functions/v1/invite-redeem -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -d '{"token":"x"}'
```

Expected `{"ok":false,"code":"invite_invalid"} status=200` (ALLOWED_ORIGINS still set). **Always
afterwards**, whatever happened: stop the serve task, then (stopping it removes the edge container;
every function answers 503 until restarted, 05 S2 gotcha):

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm db:stop > "$T/stop.log" 2>&1; echo "stop exit=$?"; pnpm db:start > "$T/start.log" 2>&1; echo "start exit=$?"
git diff --stat -- supabase/config.toml | wc -l | tr -d ' '
```

Expected both `exit=0`, `0` (config untouched), then **CHK** passes and
`docker exec supabase_edge_runtime_aj_classes printenv EMAIL_TRANSPORT` prints `mailpit`.

**F-6 Mailpit refuses the address** (05 S4a: Mailpit answers 400 to `has space@local.test`, which
`outcomeForStatus` maps to `failed`). Save the id first, then
`Q "update public.profiles set email = 'has space@local.test' where id = '<id>';"`; **restore in
the same case** with `Q "update public.profiles set email = 'E(x)' where id = '<id>';"` →
`UPDATE 1`, whatever happened.

**F-7 Consented roster student** (only Aarav has consent in the seed):
`Q "insert into public.students (full_name, year_level, consent_recorded_at, consent_source) values ('TP Student $STAMP', 8, now(), 'admin') returning id;"` → save as `$T/student-id`.
Remove at the case end: `Q "delete from public.students where id = '<id>';"` → `DELETE 1`
(`student_guardians` rows go with it; check `Q "select count(*) from public.student_guardians where student_id = '<id>';"` → `0`).

**F-8 Pre-release invite** (AC 25; as the e2e AC 25 test): an Auth user with no `invited_at`:
`Q "insert into auth.users (id, aud, role, email, raw_user_meta_data) values (gen_random_uuid(), 'authenticated', 'authenticated', 'E(25)', '{\"full_name\":\"TP Old Invite\"}') returning id;"`.

**F-9 End-of-run clean-up and leftovers check:**

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
docker exec supabase_db_aj_classes psql -U postgres -At -c "delete from public.audit_log where details->>'email' like 'tp-%' or details->>'email' = 'has space@local.test';" -c "delete from auth.users where email like 'tp-%@local.test';" -c "delete from public.students where full_name like 'TP Student %';" -c "delete from private.invite_redeem_attempts;"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select (select count(*) from auth.users), (select count(*) from public.profiles where email like 'tp-%' or email like 'e2e-%'), (select count(*) from public.students), (select count(*) from private.invite_tokens), (select count(*) from public.student_guardians), (select count(*) from public.posts where title like 'e2e-%'), (select count(*) from public.enquiries where email like 'e2e-%');"
lsof -nP -iTCP:5173 -sTCP:LISTEN; lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected last query `6|0|6|0|<seed guardians>|0|0` (6 seed auth users, 6 seed roster students;
read the seed guardian count with the same query before the first fixture and compare). After the
run, no listener on 4173, and none on 5173 except a dev server you started on purpose and then
stopped.

---

## For Saurabh

**Nothing in the frozen pass/fail set needs Saurabh.** Every case runs on the local stack with
seeded accounts, Mailpit and no paid or model call.

## Not covered — for Saurabh (outside the frozen set; the TSR lists them as not covered)

1. **Hosted sends and the live link** (AC 31 hosted half, AC 28 via Resend): the real email from
   `hello@ajclasses.com.au` through Resend, its link on `https://ajclasses.com.au`, and the
   `deploy.sh` / `curl` checks. These are 04 §7 release steps 1–5.
2. **Mobile** (AC 27 runtime half): the shipped mobile build against the new data. Mobile still
   shows `Invite expired` after 1 hour until D1 (01 "For Saurabh" item 7).
3. **Real mail clients** rendering the new HTML (Gmail, Outlook, iOS Mail). Only Mailpit is checked.
4. **The emailed reauthentication code** (AC 34) needs a session older than a day. The plan pins
   that its code path, template and subject are unchanged (S-7 G1/G2, TC-34) but doesn't trigger it.
5. **Other browser engines.** Chromium is the frozen engine; UI-1a, PROD-1, E-9 (with `abc`) and
   E-10 are also run under WebKit. **Firefox isn't installed** on this machine, and real Safari, mobile
   Safari and Chrome on Android aren't covered. The fragment strip and the hash-change re-open are
   standard history APIs, but only a real device proves them.
6. **The production host's headers on the real domain.** PROD-1 checks the mirror, which copies
   the production header rules. Saurabh's release step 1 should add
   `curl -sI https://ajclasses.com.au/portal/invite | grep -iE "^(cache-control|x-robots-tag|content-security-policy)"`
   (expect `no-store`, `noindex, nofollow`, a CSP).
7. **The hosted rate-limit key** (accepted residual, 06-security #3): hosted, the limit keys on the
   leftmost `x-forwarded-for`, which a caller can set. Locally TC-11 proves the counting only.

---

## Run order

S-1 → S-2 → S-3 → S-7 → PROD-1 → (lead confirms the stack is the Tester's) → CHK → S-4 → S-5 →
read seed counts (F-9 query) → start dev server → TC-1…TC-19, TC-38 → TC-20 → TC-22/35/40
(collected) → TC-23, TC-24, TC-25 (UI-2, UI-3) → UI-1 → TC-26, TC-28…TC-31 → TC-32, TC-33, TC-34 →
TC-39 (F-6) → TC-41 → E-1…E-10, E-10s → R-1…R-7 → F-5 block (TC-21b, TC-36, TC-39b, TC-41b) → CHK →
S-6 (e2e) → F-9.

---

## 1. Automated suites

### S-1 — Format (DoD 2)

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm format:check > "$T/fmt.log" 2>&1; echo "exit=$?"; tail -1 "$T/fmt.log"
```

Expected `exit=0`, `All matched files use Prettier code style!`. Automated.

### S-2 — Lint, typecheck, unit, build (AC 34; DoD 2)

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm lint > "$T/lint.log" 2>&1; echo "lint exit=$?"
pnpm typecheck > "$T/tc.log" 2>&1; echo "typecheck exit=$?"
pnpm test > "$T/test.log" 2>&1; echo "test exit=$?"; grep -E "Test Files|Tests  |ℹ tests" "$T/test.log"
VITE_APP_ENV=production pnpm build > "$T/build.log" 2>&1; echo "build exit=$?"; tail -1 "$T/build.log"
```

Expected all `exit=0`; `Test Files  76 passed (76)`, `Tests  657 passed (657)` **(count)**; e2e
unit `ℹ tests 6`. P-1 (the flaky staff-page test) was fixed in `c82dede`: any failure now is a
real failure. If `admin-staff-member.test.tsx` or `admin-student.test.tsx` fails alone, rerun
the file 10 times and record the pass rate in the defect. Automated.

### S-3 — Feature unit files (AC 6, 8, 9, 10, 23, 24, 25, 26, 32, 38)

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm --filter web exec vitest run src/constants/invite-copy.test.ts src/lib/account-status.test.ts src/services/invites.service.test.ts src/lib/invite-steps.test.ts src/routes/portal/invite.test.tsx src/routes/portal/auth-confirm.test.tsx src/routes/portal/admin-staff-member.test.tsx src/routes/portal/admin-student.test.tsx > "$T/feature.log" 2>&1; echo "exit=$?"; grep -E "Test Files|Tests  " "$T/feature.log"
```

Expected `exit=0`, `Test Files  8 passed (8)`, `Tests  57 passed (57)` **(count)**. Automated.

### S-4 — pgTAP (AC 3 boundary, 7, 15, 17, 18, 27, 40)

State-changing (writes and rolls back). Tester only.

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm db:test > "$T/dbtest.log" 2>&1; echo "exit=$?"; grep -E "^Files=|^Result:" "$T/dbtest.log"; grep -E "invite_tokens" "$T/dbtest.log"
```

Expected `exit=0`, `Files=18, Tests=834` **(count; no_plan: record measured)**, `Result: PASS`,
the `invite_tokens.test.sql` line ends `ok`. Automated.

### S-5 — Function scripts (AC 1–4, 7, 11–20, 22, 28–31, 35, 37, 39–41)

State-changing (creates and deletes `redeem-…`/`kid-…` accounts). Run after CHK.

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
pnpm test:functions > "$T/fn.log" 2>&1; echo "exit=$?"; grep -cE "^ok    " "$T/fn.log"; grep -cE "^NOT OK" "$T/fn.log"; grep -E "All checks passed|check\(s\) failed" "$T/fn.log"
grep -E "^ok    (AC 3: a link 14 days 1 minute old is refused|AC 7: the same link a second time is refused|AC 12/13: only the newest link works \(staff\)|The previous link still works)" "$T/fn.log"
```

Expected `exit=0`; `413` ok lines **(count: account-admin 92 + leads 30 + notifications 153 +
invite-redeem 138; 05 "Fix batch 1" gates, unchanged by fix batches 2 and 3)**; `0` NOT OK; four
`All checks passed.` lines; the second grep prints exactly those 4 lines (AC 37's four required
tests). Automated.

### S-6 — E2E smoke and CSP (AC 6, 7, 8, 25, 34, 37; regression)

Run last (it creates and removes `e2e-%` rows). Port 5173: stop your dev server first, or make sure
it is this worktree's (global setup reuses it).

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
docker exec supabase_db_aj_classes psql -U postgres -At -c "delete from private.invite_redeem_attempts;"
node e2e/scripts/local-env.mjs > e2e/.env
pnpm --filter aj-classes-e2e test:smoke > "$T/smoke.log" 2>&1; echo "smoke exit=$?"; grep -E "[0-9]+ (passed|failed|flaky)" "$T/smoke.log" | tail -3
pnpm --filter aj-classes-e2e test:csp > "$T/csp.log" 2>&1; echo "csp exit=$?"; grep -E "[0-9]+ (passed|failed|flaky)" "$T/csp.log" | tail -3
docker exec supabase_db_aj_classes psql -U postgres -At -c "select (select count(*) from public.posts where title like 'e2e-%') + (select count(*) from public.enquiries where email like 'e2e-%') + (select count(*) from public.profiles where email like 'e2e-%') + (select count(*) from auth.users where email like 'e2e-%');"
lsof -nP -iTCP:5173 -sTCP:LISTEN; lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected `smoke exit=0`, `10 passed`; `csp exit=0`, `21 passed` **(count; measured with
`--list`)**; leftovers `0`; then stop anything the suites left on 5173/4173 and re-check.
**[LINK_SEP]**: the spec's `INVITE_LINK_PATTERN` is `/portal/invite#token=[A-Za-z0-9_-]{43}`
(checked). Its AC 6 opens are new pages since batch 2 (P-5 fixed), and it has a same-tab
re-open regression; TC-6 and E-9 repeat both by hand. Automated.

### S-7 — Static gates (AC 26, 27, 29, 32, 33; DoD 7)

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
echo "G1 config.toml diff:"; git diff develop...HEAD -- supabase/config.toml | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'
echo "G2 templates changed:"; git diff --name-only develop...HEAD -- supabase/templates | wc -l | tr -d ' '
echo "G3 otp_expiry:"; grep -c '^otp_expiry = 3600$' supabase/config.toml
echo "G4 no 1 hour in invite copy:"; grep -n "1 hour" supabase/functions/account-admin/invite-copy.ts supabase/functions/account-admin/invite-email.ts; echo "exit=$?"
echo "G5 336 in three places:"; grep -hoE "interval '336 hours'|INVITE_LIFETIME_HOURS = 336;|INVITE_LINK_LIFETIME_HOURS = 336;" supabase/migrations/20261030100000_invite_tokens.sql supabase/functions/account-admin/invite-copy.ts apps/web/src/constants/app.constants.ts | sort | uniq -c
echo "G6 no console.log added:"; git diff develop...HEAD -- apps/web/src supabase/functions | grep -E '^\+.*console\.(log|debug)'; echo "exit=$?"
echo "G7 no secret in log calls:"; grep -nE "console\.(info|warn|error|log)\(" supabase/functions/invite-redeem/*.ts supabase/functions/account-admin/*.ts supabase/functions/account-admin/handlers/*.ts | sed -E "s/'[^']*'//g" | grep -E "\b(token|tokenHash|hash|email|link|userId|profileId)\b"; echo "exit=$?"
echo "G8 migration drops/renames nothing:"; grep -niE "\bdrop\b|\brename\b" supabase/migrations/20261030100000_invite_tokens.sql; echo "exit=$?"
echo "G9 reset copy still from AUTH_LIMITS:"; grep -cF 'It expires in ${AUTH_LIMITS.linkExpiryHours} hour.' apps/web/src/constants/portal.constants.ts
echo "G10 untracked files stay out:"; git log --stat develop..HEAD | grep -c actionItems; git ls-files e2e/.env apps/web/.env.local apps/web/.env.development.local | wc -l | tr -d ' '
echo "G11 redeem never deletes a user:"; cat supabase/functions/invite-redeem/redeem.ts supabase/functions/invite-redeem/index.ts | grep -c deleteUser
```

Expected:
- G1 prints exactly the 4 added lines plus a blank `+` line: the two `# invite-redeem (ADR-0010)…`
  comment lines, `+[functions.invite-redeem]`, `+verify_jwt = false`, `+`. Nothing else (AC 33).
- G2 `0` (AC 32/33: recovery, magic-link, reauthentication templates untouched).
- G3 `1`.
- G4 no lines, `exit=1` (AC 29).
- G5 `3 interval '336 hours'` (code + 2 comments), `1 INVITE_LIFETIME_HOURS = 336;`,
  `1 INVITE_LINK_LIFETIME_HOURS = 336;` (AC 26, 32: one value, three agreeing places).
- G6 no lines, `exit=1`. G7 no lines, `exit=1` (AC 8). G8 no lines, `exit=1` (AC 27).
- G9 `1` (AC 32). G10 `0` and `0`. G11 `0` (06-security #2).

Plant proof (dry-run): G4 matched a planted `expiry: 'This link expires in 1 hour'`; G6 matched
`+  console.log('x');`; G7 matched `console.warn('invite-redeem', token);` (and the string-strip
stops `'invite email config missing'` matching); G8 matched `alter table x rename to y;`; G1 printed
planted `±otp_expiry` lines; G3 printed `0` on `otp_expiry = 86400`; G9 printed `0` on a planted
`` sent: `It expires in 24 hour.` ``. G11 reads its own count (`0` is the pass). Automated.

### PROD-1 — Production build preview shows Continue (review-5 #1)

Builds with the **local** Supabase URL and publishable key (the portal switches itself off without
them, `portal-root.tsx`), then serves it with the repo's production mirror on 4173.

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
supabase status -o env > "$T/status.env" 2>/dev/null; source "$T/status.env"
VITE_APP_ENV=production VITE_SUPABASE_URL=http://127.0.0.1:55321 VITE_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA VITE_LEAD_CAPTURE= pnpm --filter web build > "$T/prod-build.log" 2>&1; echo "build exit=$?"
pnpm --filter web check:hosted-ref build/client 2>&1 | tail -1
grep -rl "1x00000000000000000000AA" apps/web/build/client/assets | wc -l | tr -d ' '; grep -rl "127.0.0.1:55321" apps/web/build/client/assets | wc -l | tr -d ' '
```

Expected `build exit=0`; `check-hosted-ref: 0 files (of 155 scanned)` **(count)**; `1` and `1`
(the Turnstile test key, Cloudflare's always-pass `1x00000000000000000000AA`, and the local URL
are each in one bundle: the build can't pick up `.env.production`'s hosted values).
`apps/web/build/` is a normal production build since fix batch 3; this command replaces it. Then in the background: `pnpm --filter web mirror >
"$T/mirror.log" 2>&1` (port 4173). Then:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T/shots/prod"
curl -sI http://127.0.0.1:4173/portal/invite | grep -iE "^(HTTP|cache-control|x-robots-tag|content-security-policy)" | cut -c1-80
BASE=http://127.0.0.1:4173 TOKEN_LOC=$([ "$LINK_SEP" = '#' ] && echo fragment || echo query) OUT="$T/shots/prod" node "$T/pw-states.mjs" > "$T/prod-states.jsonl" 2>&1; echo "exit=$?"
BASE=http://127.0.0.1:4173 node "$T/pw-reopen.mjs" abc > "$T/prod-reopen.log" 2>&1; echo "reopen exit=$?"; cat "$T/prod-reopen.log"
BROWSER=webkit BASE=http://127.0.0.1:4173 node "$T/pw-reopen.mjs" abc > "$T/prod-reopen-webkit.log" 2>&1; echo "webkit exit=$?"; cat "$T/prod-reopen-webkit.log"
```

(set `LINK_SEP` with PRE first). Expected: HTTP 200 with `Cache-Control: no-store`, `X-Robots-Tag:
noindex, nofollow` and a CSP (06-security #14); `exit=0`; for `invite-ready` at every width and
scheme: `h1` `Welcome to AJ Classes`, `buttons` `["Continue"]` **on first render** (the point of
review-5 #1), `href` already `http://127.0.0.1:4173/portal/invite` (strip on load in the
production build too), 0 console errors; `invite-query` shows the incomplete state. The click
after it shows `Something went wrong. Please try again.` (`PORTAL_ERRORS.unknown`: 4173 isn't in
`ALLOWED_ORIGINS`, so a 403; measured: `Something went wrong…` with `Try again`, and one console
line `Failed to load resource: … 403 (Forbidden)`, which is that 403 and not an app error) or the
refused page; record which; either is fine here. **`pw-reopen abc` on 4173 (review-6a #1),
both engines, measured on the dry run:**
- `b0`, `b1`, `b2`, `b3`, `a0`, `a1`, `d`: `href` `http://127.0.0.1:4173/portal/invite`, never
  `#token=`.
- `b1` and `a1`: `buttons` `["Continue"]`, `sameDocument: true` (a real same-tab re-open, no page
  load).
- `b1.historyLength` = `b0.historyLength` + 1 (measured `2` → `3`); `a1` = `a0` + 1 (`3` → `4`).
- `a0`: the incomplete state (`h1` `This link has expired or has already been used.`, no buttons).

(The
Developer also ran a full redeem on 4173 under `functions serve` with 4173 added to
`ALLOWED_ORIGINS`, 05 "Fix batch 1". This plan doesn't repeat that: the redeem path is the same
code on both servers.) `apps/web/build/` holds the Developer's gate build; the command above
rebuilds it. Stop the mirror; `lsof -nP -iTCP:4173 -sTCP:LISTEN` empty. Rebuild is
not needed: S-6 uses the dev server. Manual (measured).

---

## 2. Acceptance cases

Cases below run on the dev server (5173) and the local stack. Each lists its AC, steps, expected.
"Refused" means `status=200 {"ok":false,"code":"invite_invalid"}` from `TP redeem`, or
`redeem=200 {"ok":false,"code":"invite_invalid"} hop=none` from `TP signs-in`. Save every refused
raw body into `$T/refusals.txt` (one line each) for TC-11.

### Lifetime (US1)

**TC-1…TC-4 — Sample points on the 336 h rule (AC 1–4, AC 5).** For each row, invite, save the
link, back-date (F-1), then redeem + hop:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T/links" && STAMP=$(cat "$T/stamp") && N=ac1 && I='13 days' && E="tp-$N-$STAMP@local.test"
node "$T/tp.mjs" invite-staff "$E" "TP $N" 2>/dev/null
node "$T/tp.mjs" link "$E" 2>/dev/null > "$T/links/$N"; TOK=$(sed -E 's/.*token=//' "$T/links/$N"); echo "len=${#TOK}"
docker exec supabase_db_aj_classes psql -U postgres -At -c "update private.invite_tokens t set sent_at = t.sent_at - interval '$I', expires_at = t.expires_at - interval '$I' from public.profiles p where p.id = t.profile_id and p.email = '$E';" -c "update public.profiles set invited_at = invited_at - interval '$I' where email = '$E';"
node "$T/tp.mjs" signs-in "$E" "$TOK" 2>/dev/null
docker exec supabase_db_aj_classes psql -U postgres -At -c "select p.invited_at = t.sent_at, t.used_at is not null from private.invite_tokens t join public.profiles p on p.id = t.profile_id where p.email = '$E';"
```

| Case | `N` | `I` | Expected `signs-in` | Expected last query |
|---|---|---|---|---|
| TC-1 (AC 1) | `ac1` | `13 days` | `redeem=200 ok hop=200 same_account=true` | `t|t` (date kept after the hop: AC 40 trigger guard) |
| TC-2 (AC 2) | `ac2` | `13 days 23 hours` | same as TC-1 | `t|t` |
| TC-3a (boundary) | `ac3a` | `14 days` | refused | `t|f` |
| TC-3 (AC 3) | `ac3` | `14 days 1 minute` | refused | `t|f` |
| TC-4 (AC 4) | `ac4` | `15 days` | refused | `t|f` |

Each: `status=200 {"ok":true,"data":{"userId":"…"}}` from the invite, `len=43`, `UPDATE 1` twice.
**TC-5 (AC 5):** the method is F-1, local only; the TSR records the commands and the F-1 check
query output (`|336|t`). AC 1 and AC 3 are also run in the browser in UI-1b. Keep `ac1`…`ac4`
until TC-11; then `Q "delete from auth.users where email like 'tp-ac%-$STAMP@local.test';"`.
Automated (scripted).

### Single use and scanners (US2, US3)

**TC-6 — Opening uses nothing up (AC 6) [STRIP].** Invite `E(ac6)`, save the link, F-2. In a fresh
browser context: open the link 3 times, **each in a new tab** (`context.newPage()` then
`goto(link)`; a same-tab `goto` after the strip is only a fragment change and doesn't load the
page), and wait for `Continue` each time.
Between loads: `Q "select used_at is null from private.invite_tokens t join public.profiles p on p.id = t.profile_id where p.email = 'E(ac6)';"`
→ `t` and `Q "select count(*) from private.invite_redeem_attempts;"` → `0` (no request on load).
Then click `Continue` in the third tab. Expected: URL becomes `http://localhost:5173/portal/join`, the join form
shows `E(ac6)`; Q `used_at is null` → `f`. Manual (measured).

**TC-7 — A used link is refused (AC 7).** After TC-6: `TP redeem $TOK` → refused (API). Then F-2,
and in a **new** context open the same link, click `Continue` → refused page (UI-1 text). Also the
same context as TC-6 (signed in as the invitee): open the link again, Continue → refused page.
Manual + automated.

**TC-8 — No token in the address bar, history, audit or logs (AC 8) [STRIP][LINK_SEP].**
In TC-6's context, record `location.href` (a) right after each load and (b) after Continue; then
`page.goBack()` until the history start, recording each URL. Expected (`STRIP=render`): (a) is
already `http://localhost:5173/portal/invite`, with `location.hash` and `location.search` both
`''`, before any click; (b) `/portal/join`; no history entry contains `token=`. The fragment
never reaches a server, so the dev-server log check below is a belt-and-braces `0`.

Then, with `TOK` and its hash `H=$(printf %s "$TOK" | shasum -a 256 | cut -d' ' -f1)`:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && TOK=$(sed -E 's/.*token=//' "$T/links/ac6") && H=$(printf %s "$TOK" | shasum -a 256 | cut -d' ' -f1)
docker exec supabase_db_aj_classes psql -U postgres -At -c "select count(*) from public.audit_log where details::text like '%$TOK%' or details::text like '%$H%';"
docker logs supabase_edge_runtime_aj_classes 2>&1 | grep -c -e "$TOK" -e "$H"
grep -c -e "$TOK" -e "$H" "$T/dev.log"
```

Expected `0`, `0`, `0`. Also, as admin, open `/portal/admin/activity` and check
`document.body.innerText.includes('<TOK>')` → `false`. S-5's leak check covers the returned
`tokenHash`. Manual + automated.

### Messages (US3)

**TC-9 — Refused page text (AC 9).** On any refused page (TC-3 browser, TC-7, TC-10b):
`h1` `Welcome to AJ Classes`; alert text exactly
`This invitation link has expired. Please contact your AJ Classes administrator to request a new invite.`;
a link `Already set up your account? Sign in` with `href` `/portal/login`; no `Continue` or
`Try again` button; clicking the link lands on `/portal/login`. Snippet:
`({h1:[...document.querySelectorAll('h1')].map(h=>h.textContent), alert:document.querySelector('[role=alert]')?.textContent, links:[...document.querySelectorAll('main a')].map(a=>[a.textContent,a.getAttribute('href')]), buttons:[...document.querySelectorAll('main button')].map(b=>b.textContent)})`.
Manual (measured).

**TC-10 — Missing vs garbled (AC 10) [LINK_SEP].**
- a. `/portal/invite` (no token); `/portal/invite#token=` (empty); and the **real token in a
  query**, `/portal/invite?token=<TOK>` (ignored, AC 10 "a parameter the link needs is missing"):
  each `h1` `This link has expired or has already been used.`, text
  `This link is incomplete. Please use the button in the email.`, **no buttons** in `main`, and no
  POST. Afterwards `TP signs-in E <TOK>` still succeeds (the query visit used nothing).
- b. Garbled, each in a fresh context after F-2: `#token=abc`; the real token cut to 42 chars; the
  real token with its last character changed (43 chars, right shape, unknown). Each shows
  `Continue` first, then after the click the TC-9 refused page. API: `TP redeem abc`, the 42-char and
  the changed token → refused each.
- c. `/portal/auth/confirm` with no parameters → same as a (regression).

Manual (measured) + automated.

**TC-11 — All refusals look the same (AC 11).** Collect every refused raw body from TC-3, 3a, 4, 7,
10b, 12, 13, 15, 16, 17, 18 and the rate-limit check below into `$T/refusals.txt`.
Rate limit: with one fixed address and an unknown 43-char token:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T"
U=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"); A="10.250.$((RANDOM % 250)).$((RANDOM % 250))"
for i in $(seq 1 11); do node "$T/tp.mjs" redeem "$U" "$A" 2>/dev/null; done | sort | uniq -c
```

Expected one line: `11 status=200 {"ok":false,"code":"invite_invalid"}` (the 11th is the rate
limit, byte-identical).

**TC-11r — The limit really blocks (review-6a #2; this check fails if there is no limit).** A
fresh invite `E(rl)`; then, with one new address A and a second address B:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T/links" && STAMP=$(cat "$T/stamp") && E="tp-rl-$STAMP@local.test"
node "$T/tp.mjs" invite-staff "$E" "TP RL" 2>/dev/null
TOK=$(node "$T/tp.mjs" link "$E" 2>/dev/null | sed -E 's/.*token=//'); echo "len=${#TOK}"
U=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"); A="10.251.$((RANDOM % 250)).$((RANDOM % 250))"; B="10.252.$((RANDOM % 250)).$((RANDOM % 250))"
Q() { docker exec supabase_db_aj_classes psql -U postgres -At -c "$1"; }
C0=$(Q "select count(*) from private.invite_redeem_attempts;")
for i in $(seq 1 10); do node "$T/tp.mjs" redeem "$U" "$A" 2>/dev/null; done | sort | uniq -c
echo "after 10: +$(( $(Q "select count(*) from private.invite_redeem_attempts;") - C0 ))"
node "$T/tp.mjs" redeem "$TOK" "$A" 2>/dev/null
echo "after valid-from-A: +$(( $(Q "select count(*) from private.invite_redeem_attempts;") - C0 ))"; Q "select used_at is null from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='$E';"
node "$T/tp.mjs" redeem "$TOK" "$B" 2>/dev/null
echo "after B: +$(( $(Q "select count(*) from private.invite_redeem_attempts;") - C0 ))"; Q "select used_at is null from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='$E';"
```

Expected (dry run): the invite `ok`, `len=43`; `10 status=200 {"ok":false,"code":"invite_invalid"}`;
`after 10: +10`; the **valid** token from A → `status=200 {"ok":false,"code":"invite_invalid"}`;
`after valid-from-A: +10` (a limited call writes no row) and `t` (not used); from B →
`status=200 ok:tokenHash`; `after B: +11` and `f`. Remove `E(rl)`. Automated.

Then `sort -u "$T/refusals.txt" | sed -E 's/^.*(\{.*\}).*$/\1/' | sort -u`
prints exactly one line `{"ok":false,"code":"invite_invalid"}`. The browser refused page for an
unknown token (TC-10b changed char) is word-for-word the same as for a used one (TC-7) and an
expired one (TC-3 browser): compare the TC-9 snippet output. The redeem request carries no e-mail
and the reply none (look at the request body in TC-6's network log: `{"token":"<TOK>"}` only).
Automated + manual.

### Re-send and cancel (US2)

**TC-12 — Re-send replaces the link, per role (AC 12, 35, 40).** Fixtures: staff `E(r-staff)`;
F-7 student, invite its account `E(r-kid)` (`TP invite-student <sid> E(r-kid)`); parent
`E(r-par)` (`TP invite-parent <sid> E(r-par) "TP Parent"`). For each: record `TP mails E` (=1),
save link L1, `TP resend E` → `status=200 {"ok":true,"data":{}}`, `TP mails E` → `2`, save L2.
Then `TP redeem <L1 token>` → refused; `TP signs-in E <L2 token>` → success line.
Check `Q "select p.invited_at = t.sent_at from private.invite_tokens t join public.profiles p on p.id = t.profile_id where p.email = 'E';"` → `t` after the invite and after the re-send.
Automated (scripted).

**TC-13 — Two re-sends: only the newest works (AC 13).** `E(r2)`: invite (L1), resend (L2), resend
(L3). `TP redeem` L1 → refused, L2 → refused, `TP signs-in` L3 → success. Q
`select count(*) from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='E(r2)'` → `1`. Automated.

**TC-14 — Opened but unfinished → re-send is an invite (AC 14).** `E(r14)`: invite, `TP signs-in`
with L1 (success; this confirms the e-mail). Q `select email_confirmed_at is not null, (select status from public.profiles where email='E(r14)') from auth.users where email='E(r14)'` → `t|invited`.
`TP resend E(r14)` → ok; `TP subject E(r14)` → `You're invited to the AJ Classes portal` (not
`Reset your AJ Classes password`); `TP link E(r14)` matches `/portal/invite#token=`;
then F-2 and open L2 in a browser, Continue → `/portal/join`. Automated + manual.

**TC-15 — Cancel switches the link off (AC 15).** `E(c15)`: invite, save L1, `TP cancel E(c15)`
(before: save its id) → `status=200 {"ok":true,…}`. `TP redeem` L1 → refused;
`Q "select count(*) from private.invite_tokens where profile_id = '<id>';"` → `0`;
`Q "select count(*) from auth.users where id = '<id>';"` → `0`. Automated.

**TC-16 — A re-send starts a fresh 14 days (AC 16).** `E(r16)`: invite (L1), F-1 `10 days`,
resend (L2), F-1 `13 days` (moves L2, which is now the only row). `TP signs-in` L2 → success;
`TP redeem` L1 → refused. Automated.

### Already-active and inactive accounts (US3)

**TC-17 — Joined account: link refused, password works (AC 17).** `E(17)`: invite, save L1, apply
F-4. `TP redeem` L1 → refused; `Q "select last_sign_in_at is null from auth.users where email='E(17)';"`
→ `t` (no session made). In the browser (F-2): open L1, Continue → TC-9 page; click
`Already set up your account? Sign in`, sign in with `E(17)` / `tp-local-password-17-only`
→ `/portal/tutor` with `h1` `Welcome, TP` (the fixture's first name), and the same path after a
reload (measured on the dry run with `pw-login.mjs`, appendix E; the seeded tutor lands there too).
`/portal/join` or `/portal/login` is a fail. Run:
`BASE=<dev URL> node "$T/pw-login.mjs" E(17) tp-local-password-17-only` → `{"path":"/portal/tutor","h1":"Welcome, TP",…}`
then `{"afterReload":"/portal/tutor"}`. Manual + automated.

**TC-18 — Deactivated account: refused, nobody signed in (AC 18).** `E(18)`: invite, save L1,
`Q "update public.profiles set is_active = false where email='E(18)';"`. `TP redeem` L1 → refused;
`Q "select last_sign_in_at is null from auth.users where email='E(18)';"` → `t`. Automated.

**TC-19 — Existing rules unchanged (AC 19).** As admin in the browser:
- a. Staff → `Invite staff`, name `TP Dup`, e-mail `tutor@local.test` → dialog error
  `This e-mail already has an account.`; no new Mailpit message to `tutor@local.test`
  (`TP mails` before = after).
- b. `TP resend tutor@local.test` → `status=200 {"ok":false,"code":"already_joined"}` (the UI has
  no Resend button on a joined account; `already_joined` maps to `They have already joined.`,
  `auth-errors.ts:65`).
- c. Aarav Demo (has an account): `TP invite-student <aarav id> E(19c)` →
  `{"ok":false,"code":"already_has_account"}` (`This student already has an account.`).
- d. Existing parent: TC-41.

Manual + automated.

### Who can send

**TC-20 — Refused callers (AC 20).** Fixture `E(20)` (invited, link L1). Record before:
`Q "select (select count(*) from private.invite_tokens), (select token_hash from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='E(20)'), (select count(*) from public.audit_log), (select count(*) from auth.users);"`
and the Mailpit total (`curl -s 'http://127.0.0.1:55324/api/v1/messages?limit=1' | python3 -c 'import sys,json;print(json.load(sys.stdin)["total"])'`).
Then for `who` in `signedout badtoken tutor student parent admin-aal1` and each body:
`{"action":"invite","email":"tp-20x-<STAMP>@local.test","fullName":"TP Nope"}`,
`{"action":"resend-invite","userId":"<E(20) id>"}`, `{"action":"cancel-invite","userId":"<E(20) id>"}`
→ `TP call <who> '<body>'`.

Expected: `signedout` → `status=403 {"ok":false,"code":"not_admin"}` (local Kong lets the
publishable key through; AC 20 allows 401 too); `badtoken` → `status=401` (gateway); `tutor`,
`student`, `parent`, `admin-aal1` → `status=403 {"ok":false,"code":"not_admin"}`. Afterwards the
before-query and Mailpit total are identical (audit count, token rows, `E(20)`'s hash, users) and
`Q "select count(*) from auth.users where email like 'tp-20x-%';"` → `0`. In the browser as tutor
there is no Staff → `Invite staff` (record where `/portal/admin/staff` sends a tutor).
Automated (scripted).

**TC-21 — Consent first; failed first invite leaves nothing (AC 21).** a. A second F-7-style roster
row **without** consent (`insert … (full_name, year_level) values ('TP Student $STAMP nc', 8)`):
`TP invite-student <id> E(21a)` → `{"ok":false,"code":"consent_needed"}`; in the browser its
Student account e-mail field is disabled with helper `Record consent first.`. b. Email off: TC-21b
in §4. Automated + manual.

**TC-22 — Audit actions (AC 22).** Collected from the cases above:
`Q "select action, count(*) from public.audit_log where details->>'email' in ('E(r-staff)','E(r-kid)','E(r-par)','E(c15)') group by 1 order by 1;"`
→ `invite_cancelled|1`, `invite_resent|3`, `invite_sent|2`, `parent_invited|1`, `student_invited|1`
(staff `r-staff` + `c15` = 2 `invite_sent`). `parent_linked` is checked in TC-41. The `details` of
these rows hold no token (TC-8 query). Automated.

### Admin status (US4) — browser, see UI-2 and UI-3

**TC-23 (AC 23)** = UI-2. **TC-24 (AC 24)** = UI-3. **TC-25 (AC 25)** = UI-2 row "pre-release",
plus `Q "select count(*) from public.profiles p where p.status='invited' and p.invited_at is not null and not exists (select 1 from private.invite_tokens t where t.profile_id=p.id);"`
→ `0` on the plain seed before any fixture (migration step 6).

**TC-26 — Invite dialog copy (AC 26).** Staff → `Invite staff`: intro text exactly
`They'll get an e-mail to set their password. The link works for 14 days; you can resend it.`
The number comes from `INVITE_LIMITS.linkLifetimeDays` (G5, `invite-copy.test.ts`). Cancel.
Manual + unit.

**TC-27 — Nothing mobile reads is removed (AC 27).**
`Q "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('invited_at','status','joined_at','is_active','last_sign_in_at','role','email');"`
→ `email,invited_at,is_active,joined_at,last_sign_in_at,role,status`; G8; pgTAP #18 (S-4). The
runtime half is "Not covered — for Saurabh" item 2. Automated.

### Email content

**TC-28…TC-31 — The invite email (AC 28, 29, 30, 31) [LINK_SEP].** For `E(r-staff)`, `E(r-kid)`,
`E(r-par)` (their first or re-sent email), `TP mail E`. Expected for each:
- `from` `AJ Classes <hello@ajclasses.com.au>`; `subject` `You're invited to the AJ Classes portal`.
- `text` lines, in order (empty lines between): `You're invited to AJ Classes`;
  `<intro> Click the button, then fill in a few details and choose your password.`;
  `Accept invite: http://localhost:5173/portal/invite#token=<TOKEN>`;
  `This link expires in 14 days and works once. If it has expired, ask AJ Classes to send you a new one.`;
  `If you didn't expect this email, you can ignore it.`
  where `<intro>` is, for staff `You've been invited to the AJ Classes staff portal.`; student
  `You've been invited to the AJ Classes student portal, where you can see your classes and do your assignments online.`;
  parent `You've been invited to the AJ Classes parent portal, where you can follow your child's assignments, marks and tutor comments.`
- `html` contains `&nbsp;Staff</span>` / `&nbsp;Students</span>` / `&nbsp;Parents</span>`,
  `>You&#39;re invited to AJ Classes</h1>`, `>Accept invite</a>`, the expiry line, and
  `If you didn&#39;t expect this email, you can ignore it.`; its `href` is the same link.
- Neither part contains `1 hour`, `supabase` or `auth/confirm` (AC 29, 31).

Visual look in Mailpit's HTML tab vs. today's template: screenshot for the TSR (judgement, flagged
for Saurabh to glance at; not pass/fail). Automated + manual.

### Password reset and sign-in unchanged (US5)

**TC-32 — Reset stays 1 hour (AC 32).** Browser, signed out: `/portal/forgot-password`, e-mail
`student@local.test`, `Send link`. Page text exactly
`If that email has an account, we've sent a link. It expires in 1 hour.`
`TP subject student@local.test` → `Reset your AJ Classes password`; its text contains
`This link expires in 1 hour and works once.`; its link is
`http://localhost:5173/portal/auth/confirm?token_hash=…&type=recovery`.
- a. Fresh link: open, `Continue` → `/portal/set-password` (don't submit; sign out after).
- b. Second request after 60 s (`max_frequency = "60s"`), then age it:
  `Q "update auth.users set recovery_sent_at = now() - interval '61 minutes' where email='student@local.test';"`;
  open the newest link, `Continue` → alert
  `This link has expired or has already been used. Request a new link below.` and link
  `Request a new link`. The student's password is unchanged (TC-34 sign-in still works).

Manual (measured).

**TC-33 (AC 33)** = S-7 G1, G2, G3. Automated.

**TC-34 — Sign-in and two-step unchanged (AC 34).** `staff-login.spec.ts` in S-6; S-2 auth unit
tests; R-2. The emailed code: `git diff develop...HEAD -- apps/web/src/routes/portal/account.tsx`
is empty and `sendReauthCode`/`changePassword` are unchanged (`git diff develop...HEAD --
apps/web/src/services/auth.service.ts` touches only `confirmEmailLink`→`confirmRecoveryLink`).
Automated.

### Local Mailpit

**TC-35 (AC 35)** = TC-12 counts (1 per send for staff, student, parent, re-send) plus UI-1b links
working on 5173. **TC-36 (AC 36)** = §4. **TC-37 (AC 37)** = S-5 second grep + S-6 smoke.

### Added in round 1

**TC-38 — Old-format link refused (AC 38).** F-3 `E(old)`. F-2. Browser (record network): open
the old link → `h1` `Welcome to AJ Classes`, `Continue` shown; click → TC-9 text and sign-in link;
address bar `http://localhost:5173/portal/auth/confirm` (no `token_hash`); requests to
`/auth/v1/verify` = `0`; `Q "select last_sign_in_at is null from auth.users where email='E(old)';"`
→ `t`. Also at 375 px light. Remove F-3. Manual (measured).

**TC-39 — Failed re-send changes nothing, via the UI (AC 39, 37).** `E(39)`: invite, save L1, F-1
`14 days 1 minute` (so the page shows expired). Record `Q "select invited_at, (select token_hash from private.invite_tokens where profile_id=p.id), (select count(*) from public.audit_log where action='invite_resent' and target_id=p.id) from public.profiles p where email='E(39)';"`
and `id`. Apply F-6. As admin open the staff member page, click `Resend invite`. Expected: error
alert `The invite e-mail couldn't be sent. Please try again.`; chip still `Invite expired`, warning
`The link has expired. Send a new one.` still there, `Invited on …` text unchanged; no
`A new invite link has been sent.`. Restore F-6. The record query is unchanged; the account still
exists. Then F-1 forward is not possible, so prove L1 still works by moving it back:
`Q "update private.invite_tokens set expires_at = now() + interval '1 hour' where profile_id='<id>';"`
then `TP signs-in E(39) <L1>` → success. Manual + automated.

**TC-40 (AC 40)** = TC-1/2 (`invited_at = sent_at` after the hop), TC-12 (after invite and
re-send), UI-3 (`Invited on` shows it). Automated.

**TC-41 — Linking an existing parent (AC 41).** F-7 student (UI). Record `TP mails parent@local.test`,
`Q "select count(*) from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='parent@local.test';"`
(`0`) and the `parent_linked` count. Browser: student page → `Invite or link a parent`, e-mail
`parent@local.test` (name any) → success; the parent row shows `Parent Demo`… with chip `Active`
(record the name shown). Expected: Mailpit count unchanged; token count `0`; `parent_linked` +1;
`Q "select count(*) from public.student_guardians where student_id='<sid>';"` → `1`. The seed is
restored when F-7's student is deleted (guardian row goes with it; check `parent@local.test`'s
children on `/portal/parent` are still the seed's). Email-off half: TC-41b. Manual + automated.

---

## 3. Browser UI cases (375 and 1280 px, light and dark)

"Four combos" = 375 light, 375 dark, 1280 light, 1280 dark (Playwright `viewport` and
`colorScheme`; no saved theme, so the portal follows the system setting). Measured in each:
sideways scroll `document.documentElement.scrollWidth <= window.innerWidth` → `true`;
`document.querySelectorAll('h1').length` → `1`; `meta[name=robots]` count `1`; body background
`rgb(255, 255, 255)` in light and `rgb(11, 18, 32)` in dark (measured); 0 console errors (clear
first). Screenshots of each combo into `evidence/`; **readability and look are judgement**: the
TSR attaches them and flags them for a human glance, not pass/fail.

### UI-1 — Invitee `/portal/invite` states [LINK_SEP][STRIP]

**UI-1a — Missing, ready, refused (garbled).** F-2, then (set `LINK_SEP` via PRE):

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T/shots/ui1" && LINK_SEP="#"
BASE=$(grep -oE 'http://localhost:[0-9]+' "$T/dev.log" | head -1) TOKEN_LOC=$([ "$LINK_SEP" = '#' ] && echo fragment || echo query) OUT="$T/shots/ui1" node "$T/pw-states.mjs" > "$T/ui1.jsonl" 2>&1; echo "exit=$?"; wc -l < "$T/ui1.jsonl"
```

Expected `exit=0`, `16` lines (4 pages × 4 combos). Then repeat the same command with
`BROWSER=webkit` and `OUT="$T/shots/ui1-webkit"` (review-6a #5): the same 16 expectations
(dry run: 0 mismatches). In every combo:
- `invite-missing`: `h1` `["This link has expired or has already been used."]`, text has
  `This link is incomplete. Please use the button in the email.`, `buttons` `[]`, title
  `Accept invite | AJ Classes Portal`, `posts` `[]`.
- `invite-query` (`?token=abc`): same as `invite-missing` (a query is ignored); `href`
  `http://localhost:5173/portal/invite`.
- `invite-ready` (`#token=abc`) before: `h1` `["Welcome to AJ Classes"]`, text has
  `You've been invited to the AJ Classes portal. Continue to set up your account.`,
  `buttons` `["Continue"]`, `href` `http://localhost:5173/portal/invite` (stripped on load,
  before any click). After: `h1` unchanged, text has the AC 9 message,
  `buttons` `[]`, links include `Already set up your account? Sign in -> /portal/login`, `href`
  `http://localhost:5173/portal/invite`, `posts` `["/functions/v1/invite-redeem"]` (one).
- `confirm-missing`: same as `invite-missing` but title `Continue | AJ Classes Portal`.
- all: `sideways` false, `robots` 1, 0 errors, the background above.

**UI-1b — Real links: success and expired.** For each combo, a fresh `E(ui1-<combo>)`: invite, F-2,
open the link, Continue → `http://localhost:5173/portal/join`, the form shows that e-mail, no
`token=` in `location.href`. For 1280 light use AC 1's back-dated link (F-1 `13 days` first). For
375 dark, a second fixture back-dated `14 days 1 minute` (AC 3) → refused page as UI-1a "after".
Screenshot the join page and refused page.

**UI-1c — Checking and Try-again states.** Checking (`Checking your link…`, button disabled) and
Try again are pinned by `invite.test.tsx` (S-3); the browser sees them in E-7.

### UI-2 — Admin status on Staff, staff member, Students, student page (AC 23, 25)

Fixtures right before UI-2 (removed at the end of UI-3): staff `E(s-fresh)` (fresh), `E(s-13)`
(F-1 `13 days 23 hours`), `E(s-14)` (F-1 `14 days 1 minute`), `E(25)` (F-8, no date); F-7 student
`TP Student <STAMP>` with account `E(k-14)` (F-1 `14 days 1 minute`), parents `E(p-fresh)` (fresh)
and `E(p-14)` (F-1 `14 days 1 minute`). Snippets: chips
`[...document.querySelectorAll('.MuiChip-label')].map(e=>e.textContent)`; alerts
`[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)`; table row
`[...document.querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.innerText))`.
Expected `Invited on` text = `Invited on ${new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short'}).format(new Date('<Q invited_at>'))}. They haven't set a password yet.`
(computed in the page from the Q value; staff wording uses `'`, the student section `’` U+2019).

| Page | Row | Expected chip | Expected warning | `Invited on` |
|---|---|---|---|---|
| Staff (filter All) | s-fresh, s-13 | `Invited` | — | — |
| Staff | s-14, 25 | `Invite expired` | — | — |
| Staff, filter `Invited` | all four | shown (expired included) | — | — |
| Staff member | s-fresh, s-13 | `Invited` | none | shown, = Q date |
| Staff member | s-14 | `Invite expired` | `The link has expired. Send a new one.` | shown |
| Staff member | 25 (pre-release, AC 25) | `Invite expired` | `The link has expired. Send a new one.` | **absent** (`innerText` has no `Invited on`) |
| Students list, Account column | TP Student | `Invite expired` | — | — |
| Student page, Student account | k-14 | `Invite expired` | `The invite link has expired. Send a new one.` | shown (`’`) |
| Student page, parent rows | p-fresh / p-14 | `Invited` / `Invite expired` | — | — (rows show only the chip) |
| Admin dashboard | invites count | = `Q "select count(*) from public.profiles where status='invited';"` (counts both statuses) | — | — |

All four combos for the staff member and student pages; Staff and Students lists at 1280 light and
375 dark (tables; check the 375 table scrolls inside its container, not the page). Manual (measured).

### UI-3 — Re-send refreshes the status (AC 24; review-5 #2) [three buttons]

For each button × each of the four combos: back-date the target `14 days 1 minute` (F-1), reload,
confirm `Invite expired`, click `Resend invite`. Expected, without a manual reload: success alert
`A new invite link has been sent.` **still visible after the refresh**; chip `Invited`; no expired
warning; `Invited on` = the new Q `invited_at` (formatted as UI-2), later than before; Mailpit +1
for that address.

| Button | Target | Page |
|---|---|---|
| Staff member page `Resend invite` | `E(s-14)` | `/portal/admin/staff/<id>` |
| Student account `Resend invite` | `E(k-14)` | student page, Student account section |
| Parent row `Resend invite` (small button next to the chip) | `E(p-14)` | student page, Parents section (chip only: `Invite expired` → `Invited`) |

Failure path (no refresh): TC-39 (staff page). For the student account and parent row, apply F-6 to
`E(k-14)` then `E(p-14)` (one at a time, restore each): error alert, chip unchanged. Then remove
the UI-2 fixtures: `Q "delete from auth.users where email in (…);"` and F-7. Manual (measured).

---

## 4. Email-off block (F-5) — AC 21, 36, 39, 41

Prepare **before** starting F-5 (email on): `E(off-r)` invited with link L1 (record
`invited_at`, token hash, `invite_resent` count); F-7 student for the student/parent invites; save
the Mailpit total. Start F-5, check it is live. Then:

**TC-36a/TC-21b — First invites fail and leave nothing.**
`TP invite-staff E(off-s) "TP Off"`, `TP invite-student <sid> E(off-k)`,
`TP invite-parent <sid> E(off-p) "TP Off Parent"` → each `status=200 {"ok":false,"code":"email_failed"}`.
`Q "select count(*) from auth.users where email in ('E(off-s)','E(off-k)','E(off-p)');"` → `0`;
same for `public.profiles` → `0`; `Q "select profile_id is null from public.students where id='<sid>';"`
→ `t`; Mailpit total unchanged. Browser as admin: Staff → `Invite staff` with `E(off-s2)` → dialog
shows `The invite e-mail couldn't be sent. Please try again.`; the student page invite form shows the
same. `grep -c "invite email config missing" "$T/serve.log"` ≥ `4`.

**TC-39b — Re-send fails and keeps everything.** `TP resend E(off-r)` → `email_failed`; the
recorded values are unchanged; the account exists.

**TC-41b — Linking an existing parent still works.** `TP invite-parent <sid> parent@local.test "x"`
→ `status=200 {"ok":true,"data":{"userId":"…","linked":true}}`; no token row for `parent@local.test`;
`parent_linked` +1; Mailpit total unchanged.

**Stop F-5** and restart as F-5 says (always). Then CHK, then `TP signs-in E(off-r) <L1>` → success
(the previous link survived the failed re-send, AC 39). Remove `E(off-r)` and F-7. Manual +
automated.

---

## 5. Edge cases (not in the ACs' wording)

**E-1 — Double-click Continue.** Fresh invite, F-2, double-click `Continue` fast. Expected: one
POST to `/functions/v1/invite-redeem` (the button is disabled while checking), lands on
`/portal/join`. Manual.

**E-2 — Two tabs, one link.** Open the same link in tabs A and B (same context). Continue in A →
`/portal/join`; then Continue in B → refused page (single use). Manual.

**E-3 — Link opened while signed in as admin.** In the admin's browser context, open a fresh
invite link and Continue. Expected: lands on `/portal/join` showing the **invitee's** e-mail (the
admin session is replaced). Record what the admin then sees on reload. Judgement call flagged for
the lead: not a fail unless it shows the admin's data or keeps the admin signed in under the
invitee's form. Manual.

**E-4 — Cancel, then re-invite the same e-mail.** `E(e4)`: invite (L1), cancel, invite again (L2).
`TP redeem` L1 → refused; `TP signs-in` L2 → success (the cancel-and-re-invite identity case; the
new account is not deleted: `Q "select count(*) from auth.users where email='E(e4)';"` → `1`).
Automated.

**E-5 — Mixed-case e-mail.** `TP invite-staff TP-Upper-$STAMP@Local.Test "TP Upper"` → ok;
`Q "select email from public.profiles where email ilike 'tp-upper-%';"` → all lower case; its link
signs in. Automated.

**E-6 — Reload after the strip [STRIP] (P-3, accepted).** Open a real link in a new tab, then
reload straight away. Expected (measured on the dry run with `abc`): `h1`
`This link has expired or has already been used.`, `This link is incomplete. Please use the
button in the email.`, no `Continue`. The link is **not** used (Q `used_at is null` → `t`), and
opening the email link in a new tab still shows `Continue` and works. The lead accepted this
message as correct: it tells the person to use the email button. Manual.

**E-9 — Same-tab re-open adopts the token and clears the address again [STRIP] (batch 2;
P-6).** Fixture `E(e9)`: invite (L1), F-2. Run `node "$T/pw-reopen.mjs" abc` and
`BROWSER=webkit node "$T/pw-reopen.mjs" abc` (no database effect), then `node "$T/pw-reopen.mjs" <L1 token>`. Then
`TP resend E(e9)` (L2), F-2, and run `node "$T/pw-reopen.mjs" <L1 token> <L2 token>`. Expected
per printed line:
- `b0 first load`: `href` `http://localhost:5173/portal/invite`, `buttons` `["Continue"]`.
- `b1 same-tab re-open`: `href` back to `http://localhost:5173/portal/invite` (**no `#token=`**),
  `buttons` `["Continue"]`, `historyLength` **exactly `b0` + 1** (the fragment change adds one
  entry, which the page overwrites).
- `b2 back one entry` and `b3 forward again`: `href` `http://localhost:5173/portal/invite` both
  times (neither entry kept the token).
- `a0 after reload`: the incomplete state (`h1` `This link has expired or has already been used.`,
  no buttons; E-6, accepted).
- `a1 same-tab re-open after reload`: `href` `…/portal/invite`, `h1` `Welcome to AJ Classes`,
  `buttons` `["Continue"]` (the re-open adopts the token; the withdrawn "stays incomplete" decision
  no longer applies).
- `c0 re-sent link, same tab`: `href` `…/portal/invite`, `Continue`, `historyLength` exactly
  one more than at `a1`.
- `c1 after Continue`: `href` `http://localhost:5173/portal/join`; `c redeem bodies` is exactly
  `["{\"token\":\"<TOKEN2>\"}"]` (Continue used the **new** token, not the one from the first
  load).
- `d new tab`: `href` `…/portal/invite`, `Continue`, `redeemPosts=0` (L1 here is now replaced:
  don't click it). Record L2's `used_at` right after `c1` and again after `d`:
  `Q "select used_at from private.invite_tokens t join public.profiles p on p.id=t.profile_id where p.email='E(e9)';"`
  → the same timestamp both times (review-6a #6: the new tab redeemed nothing).

Then `TP redeem <L1 token>` → refused (replaced). Through all of it, no address contains
`token=` once a page settles, and `b2`/`b3` show no history entry kept it. `b1` and `a1` (and
`c0`) print `sameDocument: true`: they are real same-tab re-opens, not page loads (review-6a #1).
Measured on the dry run: `historyLength` `b0` 2, `b1` 3, `b2`/`b3` 3, `a0` 3, `a1` 4, `c0` 5,
`c1` 5. Manual (scripted, measured).

**E-10 — A late answer for a replaced link never shows (fix batch 3).** Browser-driven with route
interception (`pw-late.mjs`, appendix D): A is a random unknown token whose redeem is **held** in
the browser; B is a real fresh invite `E(e10)` (F-2 first). The script clicks Continue on A,
re-opens B in the same tab, clicks Continue on B (B's redeem is held too), then answers A with
`200 {"ok":false,"code":"invite_invalid"}`, waits 1 s, and only then sends B's redeem for real.

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T" && STAMP=$(cat "$T/stamp") && E="tp-e10-$STAMP@local.test"
docker exec supabase_db_aj_classes psql -U postgres -At -c "delete from private.invite_redeem_attempts;"
node "$T/tp.mjs" invite-staff "$E" "TP E10" 2>/dev/null
TOK=$(node "$T/tp.mjs" link "$E" 2>/dev/null | sed -E 's/.*token=//')
BASE=$(grep -oE 'http://localhost:[0-9]+' "$T/dev.log" | head -1) node "$T/pw-late.mjs" "$TOK"; echo "exit=$?"
CONTROL=1 BASE=$(grep -oE 'http://localhost:[0-9]+' "$T/dev.log" | head -1) node "$T/pw-late.mjs" x | tail -1
```

Expected, as measured on the dry run:
- `1 A held`: `buttons` `["Checking your link… [disabled]"]`, `refusedSeen` false.
- `2 B opened in the same tab`: `hash` `""`, `buttons` `["Continue"]`.
- `held ["A","B"]`.
- `3 A answered invite_invalid`: still `["Checking your link… [disabled]"]` (B's check),
  `refusedSeen` **false**.
- `4 B answered for real`: `path` `/portal/join`, `refusedSeen` **false** (the expired message
  was never on screen, not even briefly).
- `exit=0`. Q `used_at is not null` for `E(e10)` → `t`.
- Control (`CONTROL=1`, A alone): `control A answered … "refusedSeen":true`. This proves the
  detector would catch the bug.

Then repeat the main run once with `BROWSER=webkit` and a second fresh invite. Remove both
fixtures. E-10 covers a late **refusal**. Nit 2 of review-6a round 2 asked to say the
late-**success** path is covered by the batch-3 unit case; it isn't: that case
(`invite.test.tsx:105`) answers A only with `inviteExpired`. So the late-success path gets its own
case, **E-10s**, added at freeze time (an addition, allowed). Manual (scripted, measured).

**E-10s — A late success for a replaced link never signs in as A (fix batch 3; added at
freeze).** As E-10, but A's held redeem is answered with
`200 {"ok":true,"data":{"tokenHash":"aaaa…"}}` (56 × `a`, never a real hash). Fresh `E(e10s)`:

```
cd /Users/sjain/dev/work/aj_classes-invites && T=/private/tmp/aj-inv-tsr && mkdir -p "$T" && STAMP=$(cat "$T/stamp") && E="tp-e10s-$STAMP@local.test"
docker exec supabase_db_aj_classes psql -U postgres -At -c "delete from private.invite_redeem_attempts;"
node "$T/tp.mjs" invite-staff "$E" "TP E10s" 2>/dev/null
TOK=$(node "$T/tp.mjs" link "$E" 2>/dev/null | sed -E 's/.*token=//')
A_ANSWER=ok BASE=$(grep -oE 'http://localhost:[0-9]+' "$T/dev.log" | head -1) node "$T/pw-late.mjs" "$TOK"; echo "exit=$?"
```

Expected: `3 A answered ok` still `["Checking your link… [disabled]"]`, and
`verify calls so far 0 with A hash 0` (A's sign-in hop never starts); `4 B answered for real`
`path` `/portal/join`, `refusedSeen` false; `verify calls total 1 with A hash 0` (only B's hop).
Its first run is its dry run. Remove the fixture. Manual (scripted, measured).

**E-7 — Real network failures and Try again.** Playwright, fresh invite each, F-2.
- a. Redeem fails: `context.setOffline(true)`, click Continue → alert `Something went wrong. Please
  try again.` (`PORTAL_ERRORS.unknown`, 03 §5.2 / risk 5) with `Try again`. `setOffline(false)`,
  `Try again` → `/portal/join` (the link wasn't used: no request left the browser).
- b. Hop fails: `page.route('**/auth/v1/verify', r => r.abort())`, click Continue → after the
  redeem succeeds, 2 aborted `/verify` attempts (one automatic retry), alert
  `We couldn't reach the server. Check your connection and try again.` (`network`) with
  `Try again`. `page.unroute(…)`, `Try again` → `/portal/join`, with **no** second redeem POST
  (count POSTs to `invite-redeem` = 1).

If 7a shows the `network` text instead, record it: still a pass (retryable message), plan note.
Manual (measured).

**E-8 — `Cache-Control` [NOSTORE].** `curl -s -D - -o /dev/null -X POST http://127.0.0.1:55321/functions/v1/invite-redeem -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -d '{"token":"x"}' | grep -i '^cache-control'`
→ `cache-control: no-store` (dry run). Same check on one `account-admin` reply (TC-20's
`signedout` call with `curl -D -`) → `cache-control: no-store`. Automated.

---

## 6. Regression (R)

**R-1 — Public sweep (addendum).** Every `sitemap.xml` URL (from
`curl -s http://localhost:5173/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//'`, host mapped
to the dev server) at 375 and 1280: status 200, 0 console errors, no sideways scroll, one `h1`,
one `meta[name=robots]`. Manual (scripted).

**R-2 — Sign-in per role, plus reload; inactive refused (AC 34).** `pw-login.mjs` (appendix E) or by hand, `/portal/login` with
`local-password-123`: admin (two-step code entered automatically locally, `Local development:
entering your code automatically…`; else `TP totp`), newadmin (lands on two-step setup), tutor,
student, parent: record landing URL, same after reload; `inactive@local.test` stays on
`/portal/login` with `Email or password is incorrect.` (record the exact text). Manual.

**R-3 — Two-step.** Admin sign-in shows `Enter your code`, and a wrong code (`000000`) is refused
before the right one passes. Manual.

**R-4 — Password reset still 1 h** = TC-32. 

**R-5 — Cancel invite from the UI.** Staff member page of a fresh `E(r5)` → `Cancel invite` →
confirm dialog `Cancel this invite?` with `The pending account for E(r5) will be removed. You can
invite them again later.` → confirm → back on Staff without the row; Q user count `0`. Same on a
student account (`Invite cancelled.`), F-7 fixture. Manual.

**R-6 — Parent link with no email** = TC-41 (UI) and TC-41b.

**R-7 — Hybrid and multi-year classes (item 2026-10-28).** Admin `/portal/classes`: Year cells
`NAPLAN Reading & Writing` `Year 5`, `Selective Entry Maths & Reasoning` `Years 7–9` (U+2013),
`Selective Interview Preparation` `Year 8`; Maths detail Delivery fact
`Hybrid · Truganina, Room 1 and Zoom`; admin `/portal/timetable` bullet
`Hybrid · Truganina, Room 1 and Zoom` count `2`. Values from the seed (read-only Q:
`NAPLAN…|{5}|in_person|Truganina, Room 2`, `Selective Entry…|{7,8,9}|hybrid|Truganina, Room 1 and Zoom`,
`Selective Interview…|{8}|online|Zoom`). Manual (measured).

---

## 7. Traceability

| AC | Cases |
|---|---|
| 1 | TC-1, UI-1b, S-5, S-6 |
| 2 | TC-2, S-5 |
| 3 | TC-3, TC-3a, UI-1b, S-4, S-5 |
| 4 | TC-4, S-5 |
| 5 | TC-5 (F-1) |
| 6 | TC-6, S-3, S-6 |
| 7 | TC-7, E-2, S-5, S-6 |
| 8 | TC-8, UI-1a, E-9, PROD-1, S-3, S-5, S-6, S-7 G7 |
| 9 | TC-9, UI-1a, TC-38, E-10 |
| 10 | TC-10, UI-1a |
| 11 | TC-11, TC-11r, E-10, E-10s, S-5 |
| 12 | TC-12, S-5 |
| 13 | TC-13, S-5 |
| 14 | TC-14 |
| 15 | TC-15, R-5 |
| 16 | TC-16 |
| 17 | TC-17, S-4 |
| 18 | TC-18, S-4 |
| 19 | TC-19, TC-41 |
| 20 | TC-20 |
| 21 | TC-21, TC-21b |
| 22 | TC-22, TC-41 |
| 23 | UI-2, S-3 |
| 24 | UI-3, S-3 |
| 25 | TC-25, UI-2, S-6 |
| 26 | TC-26, S-7 G5 |
| 27 | TC-27, S-7 G8, S-4 (runtime half: For Saurabh) |
| 28 | TC-28 |
| 29 | TC-29, S-7 G4 |
| 30 | TC-30 |
| 31 | TC-31 (hosted half: For Saurabh) |
| 32 | TC-32, S-7 G2, G9 |
| 33 | S-7 G1–G3 |
| 34 | TC-34, R-2, R-3, S-2, S-6 |
| 35 | TC-35 (TC-12), UI-1b |
| 36 | TC-36a, TC-39b, TC-41b |
| 37 | S-5 (4 named checks), S-6 |
| 38 | TC-38, S-3 |
| 39 | TC-39, TC-39b, UI-3 failure path, S-5 |
| 40 | TC-1/2, TC-12, UI-3, S-4 |
| 41 | TC-41, TC-41b |

Case count: 7 suites (S-1…S-7) + PROD-1 + 45 acceptance cases (TC-1…TC-41, with TC-36 run as
TC-36a, plus TC-3a, TC-21b, TC-39b, TC-41b; TC-23/24 are run as UI-2/UI-3) + 3 UI cases (UI-1,
UI-2, UI-3) + 10 edge (E-1…E-10) + 7 regression (R-1…R-7) + TC-11r = **74** frozen, plus
**E-10s** added at freeze (review-6a round 2 nit 2) = **75** run.

---

## 8. Pre-freeze findings (for the lead)

- **P-1 (Low, test defect) — FIXED in `c82dede`** (now `waitFor`; 4 green full runs, 05 "Fix
  batch 1" 5b). Original finding: flaky `admin-staff-member.test.tsx:81`. 1 of 4 full `pnpm test`
  runs on `d35311c` failed: `expect(screen.queryByText(STAFF_MEMBER_PAGE.invite.expired)).not.toBeInTheDocument()`
  found the alert. The success notice is set before `onChanged()` starts the revalidation, so
  `findByText(resent)` can resolve while the old data still shows. Repro: `pnpm test` under load
  (Reviewer and Security were running in parallel); 10 isolated runs of the file passed. Fix: wrap
  the two following assertions in `waitFor`. The same pattern matters for review-5 #2's new
  `admin-student.test.tsx`. Severity: a correct build can fail the gate.
- **P-2 (Info, addendum stale): `test:csp` is 21 tests, not 19** (`--list` on `d35311c`); the
  smoke is 10. Update `_agents/tester.md` at close.
- **P-3 — ACCEPTED by the lead:** a reload after the on-load strip shows "This link is
  incomplete…" (E-6). That's correct: it tells the person to use the email button. (The lead's
  earlier acceptance of a same-tab re-open staying incomplete is **withdrawn**: fix batch 2 makes
  the re-open adopt the token, E-9.)
- **P-4 — EXPECTED (lead):** a Studio "Send invitation" (or any Auth `inviteUserByEmail`) shows
  `Invited` for 14 days, because the guarded trigger copies Auth's `invited_at`, while its link is
  refused (AC 38). TC-38's F-3 fixture shows exactly this and it is a pass. The Developer adds a
  README note.
- **P-5 — FIXED in batch 2** (the e2e's AC 6 opens are new pages). Original finding (Low, test
  gap): the e2e's "3 opens" were one page load. `invite-onboarding.spec.ts:86`
  calls `inviteePage.goto(inviteLink)` three times in one tab. After the first load strips the
  address to `/portal/invite`, the next two `goto`s are fragment-only changes: the page doesn't
  load again (dry-run probe: the same-document marker survived, the URL went back to
  `#token=abc`, and `Continue` stayed). So the e2e proves "one load doesn't use the link", not
  "three loads". TC-6 covers AC 6 with three new tabs. Fix: open each in `inviteeContext.newPage()`.
- **P-6 (Low, for the lead; same family as P-3): a same-tab re-open puts the token back in the
  address bar and history.** E-9b: after a normal load, opening the link again in the same tab
  sets `…/portal/invite#token=<TOK>` and nothing strips it (the strip runs once, on mount), which
  re-opens the gap 06-security #1 closed, on that path only. A related consequence: if an admin
  re-sends while the old page is still open and the person opens the **new** link in that same
  tab, Continue uses the token kept from the first load, so it is refused as replaced. A new tab
  works. **FIXED in `e732840`** (the wipe and the token adoption run on every load and every
  same-tab re-open). E-9 is pass/fail for it.

---

## Appendix A — `$T/tp.mjs`

Write this file verbatim to `/private/tmp/aj-inv-tsr/tp.mjs` (dry-run copy checked with
`node --check`).

```js
// Tester helper for docs/delivery/2026-10-29-invite-14-days/06-test-plan.md. LOCAL stack only.
// Run from the worktree root (local-test-helpers reads `supabase status`). Never prints a key.
// Usage: node $T/tp.mjs <command> [args]   (commands are listed in the plan, section 0.4)

import { createHmac } from 'node:crypto';

import {
  API,
  SITE_ORIGIN,
  adminApi,
  adminTwoStepToken,
  api,
  latestMailTo,
  mailpitText,
  mailsTo,
  signIn,
  sql,
} from '/Users/sjain/dev/work/aj_classes-invites/supabase/scripts/local-test-helpers.mjs';

const LINK = /http:\/\/localhost:5173\/portal\/invite#token=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;
const ADMIN_KEY = 'LOCALDEVADMINKEYLOCALDEVADMINKEY'; // supabase/seed.sql, local only
const [command, ...args] = process.argv.slice(2);

function totp() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...ADMIN_KEY].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const idOf = (email) => sql(`select id from public.profiles where email = '${email}'`);
const freshAddress = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function callerToken(who) {
  if (who === 'signedout') return undefined;
  if (who === 'badtoken') return 'not-a-real-token';
  if (who === 'admin') return (await adminTwoStepToken()).aal2;
  if (who === 'admin-aal1') return (await adminTwoStepToken()).aal1;
  return (await signIn(`${who}@local.test`)).access_token; // tutor, student, parent
}

async function accountAdmin(body, who = 'admin') {
  const reply = await api('/functions/v1/account-admin', { token: await callerToken(who), body });
  return `status=${reply.status} ${JSON.stringify(reply.json)}`;
}

async function redeem(token, address = freshAddress()) {
  const response = await fetch(`${API}/functions/v1/invite-redeem`, {
    method: 'POST',
    headers: { Origin: SITE_ORIGIN, 'x-forwarded-for': address, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return { status: response.status, text: await response.text() };
}

async function signsIn(email, token) {
  const reply = await redeem(token);
  const body = JSON.parse(reply.text);
  if (body.ok !== true) return `redeem=${reply.status} ${reply.text} hop=none`;
  const hop = await api('/auth/v1/verify', {
    body: { type: 'recovery', token_hash: body.data.tokenHash },
  });
  return `redeem=${reply.status} ok hop=${hop.status} same_account=${hop.json?.user?.id === idOf(email)}`;
}

const commands = {
  totp: async () => totp(),
  'invite-staff': ([email, name]) => accountAdmin({ action: 'invite', email, fullName: name }),
  'invite-student': ([studentId, email]) =>
    accountAdmin({ action: 'invite-student', studentId, email }),
  'invite-parent': ([studentId, email, name]) =>
    accountAdmin({ action: 'invite-parent', studentId, email, fullName: name }),
  resend: ([email]) => accountAdmin({ action: 'resend-invite', userId: idOf(email) }),
  cancel: ([email]) => accountAdmin({ action: 'cancel-invite', userId: idOf(email) }),
  call: ([who, json]) => accountAdmin(JSON.parse(json), who),
  mails: async ([email]) => String((await mailsTo(email)).length),
  link: async ([email]) => {
    const mail = await latestMailTo(email);
    if (!mail) return 'no mail';
    return (await mailpitText(mail.ID)).match(LINK)?.[0] ?? 'no link';
  },
  subject: async ([email]) => (await latestMailTo(email))?.Subject ?? 'no mail',
  // The newest message's From, Subject, text lines and HTML, with the token masked as <TOKEN>.
  mail: async ([email]) => {
    const summary = await latestMailTo(email);
    if (!summary) return 'no mail';
    const m = await (await fetch(`http://127.0.0.1:55324/api/v1/message/${summary.ID}`)).json();
    const mask = (s) => s.replace(/token=[A-Za-z0-9_-]{43}/g, 'token=<TOKEN>');
    return JSON.stringify(
      { from: `${m.From.Name} <${m.From.Address}>`, subject: m.Subject, text: mask(m.Text).split(/\r?\n/), html: mask(m.HTML) },
      null,
      1,
    );
  },
  redeem: async ([token, address]) => {
    const reply = await redeem(token, address);
    return `status=${reply.status} ${reply.text.includes('tokenHash') ? 'ok:tokenHash' : reply.text}`;
  },
  'signs-in': ([email, token]) => signsIn(email, token),
  'old-link': async ([email]) => {
    const reply = await adminApi('/auth/v1/admin/generate_link', { body: { type: 'invite', email } });
    const hash = reply.json?.properties?.hashed_token;
    return hash
      ? `${SITE_ORIGIN}/portal/auth/confirm?token_hash=${hash}&type=invite`
      : `status=${reply.status}`;
  },
  'set-password': async ([email, password]) => {
    const reply = await adminApi(`/auth/v1/admin/users/${idOf(email)}`, {
      method: 'PUT',
      body: { password, email_confirm: true },
    });
    return `status=${reply.status}`;
  },
  'password-signin': async ([email, password]) => {
    const reply = await api('/auth/v1/token?grant_type=password', {
      body: { email, password, gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' } },
    });
    return `status=${reply.status} ${reply.json?.error_code ?? (reply.json?.access_token ? 'session' : '')}`;
  },
};

if (!commands[command]) {
  console.error(`unknown command ${command}; one of: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
console.log(await commands[command](args));
```

Note: `resend`/`cancel` look the id up by the profile's **current** e-mail; under F-6 use
`TP call admin '{"action":"resend-invite","userId":"<id>"}'` with the saved id.

## Appendix B — `$T/pw-states.mjs`

```js
// Invitee page states at 375/1280 px, light/dark (06-test-plan UI-1). Signed-out pages only.
// Usage: BASE=http://localhost:5173 TOKEN_LOC=query|fragment OUT=<dir> node pw-states.mjs [token]
// With no token argument it uses the garbled token "abc" (a shape refusal: no database write).
import { chromium, firefox, webkit } from '/Users/sjain/dev/work/aj_classes-invites/e2e/node_modules/@playwright/test/index.mjs';

// BROWSER=chromium (default) | webkit | firefox, if that engine is installed.
const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];

const BASE = process.env.BASE ?? 'http://localhost:5173';
const SEP = process.env.TOKEN_LOC === 'fragment' ? '#' : '?';
const OUT = process.env.OUT ?? '.';
const token = process.argv[2] ?? 'abc';
const pages = [
  { name: 'invite-missing', path: '/portal/invite', click: false },
  { name: 'invite-query', path: `/portal/invite?token=${token}`, click: false },
  { name: 'invite-ready', path: `/portal/invite${SEP}token=${token}`, click: true },
  { name: 'confirm-missing', path: '/portal/auth/confirm', click: false },
];

const measure = () => ({
  h1: [...document.querySelectorAll('h1')].map((h) => h.textContent),
  text: document.querySelector('main')?.innerText ?? document.body.innerText,
  buttons: [...document.querySelectorAll('button')].map((b) => `${b.textContent}${b.disabled ? ' [disabled]' : ''}`),
  links: [...document.querySelectorAll('a')].filter((a) => a.closest('main')).map((a) => `${a.textContent} -> ${a.getAttribute('href')}`),
  sideways: document.documentElement.scrollWidth > window.innerWidth,
  robots: document.querySelectorAll('meta[name="robots"]').length,
  title: document.title,
  bg: getComputedStyle(document.body).backgroundColor,
  href: location.href,
});

const browser = await engine.launch();
for (const width of [375, 1280]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme });
    for (const { name, path, click } of pages) {
      // A new tab per state: after the on-load strip, a same-tab goto to the link is only a
      // fragment change and doesn't load the page again (06-test-plan E-9).
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      const posts = [];
      page.on('request', (r) => r.method() === 'POST' && posts.push(new URL(r.url()).pathname));
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState('networkidle');
      const before = await page.evaluate(measure);
      await page.screenshot({ path: `${OUT}/${name}-${width}-${scheme}.png`, fullPage: true });
      let after = null;
      if (click) {
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByRole('alert').waitFor();
        after = await page.evaluate(measure);
        await page.screenshot({ path: `${OUT}/${name}-after-${width}-${scheme}.png`, fullPage: true });
      }
      console.log(JSON.stringify({ name, width, scheme, before, after, posts: [...posts], errors: [...errors] }));
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
```

With a real token as the argument the script redeems it (state-changing): use it only for UI-1a's
garbled `abc` default; UI-1b drives real links per combo.

## Appendix C — `$T/pw-reopen.mjs`

Write verbatim to `/private/tmp/aj-inv-tsr/pw-reopen.mjs` (dry-run at `0e6c200` on the dev
server and the 4173 mirror, Chromium and WebKit).

```js
// E-9: same-tab re-open after the strip (06-test-plan). LOCAL dev server only.
// Usage: BASE=http://localhost:5173 node pw-reopen.mjs <token1> [token2]
// With token2 (a re-sent link), step c opens it in the tab that still shows token1's page and
// clicks Continue (state-changing: it redeems token2). With only "abc", nothing reaches the DB.
import { chromium, firefox, webkit } from '/Users/sjain/dev/work/aj_classes-invites/e2e/node_modules/@playwright/test/index.mjs';

// BROWSER=chromium (default) | webkit | firefox, if that engine is installed.
const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];

const BASE = process.env.BASE ?? 'http://localhost:5173';
const [token1, token2] = process.argv.slice(2);
const link = (token) => `${BASE}/portal/invite#token=${token}`;

const browser = await engine.launch();
const context = await browser.newContext();
const page = await context.newPage();
const posts = [];
page.on('request', (r) => {
  if (r.method() === 'POST' && r.url().includes('invite-redeem')) posts.push(r.postData() ?? '');
});
const state = async (label) =>
  console.log(label, JSON.stringify(await page.evaluate(() => ({
    href: location.href,
    h1: document.querySelector('h1')?.textContent,
    buttons: [...document.querySelectorAll('main button')].map((b) => b.textContent),
    sameDocument: window.__tp === 1, // true: no page load happened since the marker was set
    historyLength: history.length,
  }))));

await page.goto(link(token1));
await page.waitForLoadState('networkidle');
await page.evaluate(() => { window.__tp = 1; });
await state('b0 first load');
await page.goto(link(token1));
await page.waitForTimeout(500);
await state('b1 same-tab re-open');
// The fragment change adds one history entry, which the page overwrites: step back over it.
await page.goBack();
await page.waitForTimeout(500);
await state('b2 back one entry');
await page.goForward();
await page.waitForTimeout(500);
await state('b3 forward again');

await page.reload();
await page.waitForLoadState('networkidle');
await page.evaluate(() => { window.__tp = 1; });
await state('a0 after reload');
await page.goto(link(token1));
await page.waitForTimeout(500);
await state('a1 same-tab re-open after reload');

if (token2) {
  await page.goto(link(token2));
  await page.waitForTimeout(500);
  await state('c0 re-sent link, same tab');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/portal\/(join|invite)/);
  await page.waitForTimeout(1500);
  await state('c1 after Continue');
  console.log('c redeem bodies', JSON.stringify(posts.map((b) => b.replace(token2, '<TOKEN2>').replace(token1, '<TOKEN1>'))));
}

const fresh = await context.newPage();
let freshPosts = 0;
fresh.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('invite-redeem')) freshPosts += 1; });
await fresh.goto(link(token1));
await fresh.waitForLoadState('networkidle');
console.log('d new tab', JSON.stringify(await fresh.evaluate(() => ({
  href: location.href,
  buttons: [...document.querySelectorAll('main button')].map((b) => b.textContent),
})), null, 0), `redeemPosts=${freshPosts}`);
await browser.close();
```

## Appendix D — `$T/pw-late.mjs`

Write verbatim to `/private/tmp/aj-inv-tsr/pw-late.mjs` (dry-run at `0e6c200`, Chromium and
WebKit, including `CONTROL=1`).

```js
// E-10 (fix batch 3): a late refusal for link A, replaced in the same tab by link B, must never
// show. Usage: BASE=http://localhost:5173 node pw-late.mjs <B token>   (B = a real, fresh link)
// A is a random unknown token; its redeem is held in the browser and answered with
// invite_invalid, so it never reaches the server. B's redeem is held too, then sent for real.
//   CONTROL=1 node pw-late.mjs x            A only: the refused message must show (the check can fail)
//   A_ANSWER=ok node pw-late.mjs <B token>  E-10s: A's late answer is a success; its sign-in must not start
import { randomBytes } from 'node:crypto';

import { chromium, firefox, webkit } from '/Users/sjain/dev/work/aj_classes-invites/e2e/node_modules/@playwright/test/index.mjs';

// BROWSER=chromium (default) | webkit | firefox, if that engine is installed.
const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];
const BASE = process.env.BASE ?? 'http://localhost:5173';
const tokenA = randomBytes(32).toString('base64url');
const tokenB = process.argv[2];
const REFUSED = 'This invitation link has expired. Please contact your AJ Classes administrator to request a new invite.';

const browser = await engine.launch();
const context = await browser.newContext();
const page = await context.newPage();
// Remembers whether the refused message was ever on screen, even for a moment.
await page.addInitScript((text) => {
  window.__refusedSeen = false;
  new MutationObserver(() => {
    if (document.body?.innerText.includes(text)) window.__refusedSeen = true;
  }).observe(document, { subtree: true, childList: true, characterData: true });
}, REFUSED);

const held = [];
// Every Auth /verify call (the sign-in hop), to prove A's hop never starts.
const verifies = [];
page.on('request', (r) => {
  if (r.method() === 'POST' && r.url().includes('/auth/v1/verify')) verifies.push(r.postData() ?? '');
});
const FAKE_A_HASH = 'a'.repeat(56); // what a late "ok" for A hands back; never a real token
await page.route('**/functions/v1/invite-redeem', async (route) => {
  if (route.request().method() !== 'POST') return route.continue();
  const body = route.request().postData() ?? '';
  held.push({ route, which: body.includes(tokenA) ? 'A' : body.includes(tokenB) ? 'B' : '?' });
});
const until = async (check) => {
  for (let i = 0; i < 50 && !check(); i += 1) await page.waitForTimeout(100);
};
const state = async (label) =>
  console.log(label, JSON.stringify(await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    buttons: [...document.querySelectorAll('main button')].map((b) => `${b.textContent}${b.disabled ? ' [disabled]' : ''}`),
    refusedSeen: window.__refusedSeen,
  }))));

await page.goto(`${BASE}/portal/invite#token=${tokenA}`);
await page.getByRole('button', { name: 'Continue' }).click();
await until(() => held.length === 1);
await state('1 A held');
if (process.env.CONTROL === '1') {
  // Control: answer A with no B in between. The refused message must show (refusedSeen true),
  // which proves the detector works.
  await held[0].route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: '{"ok":false,"code":"invite_invalid"}',
  });
  await page.waitForTimeout(1000);
  await state('control A answered');
  await browser.close();
  process.exit(0);
}
await page.goto(`${BASE}/portal/invite#token=${tokenB}`);
await page.waitForTimeout(500);
await state('2 B opened in the same tab');
await page.getByRole('button', { name: 'Continue' }).click();
await until(() => held.length === 2);
console.log('held', JSON.stringify(held.map((h) => h.which)));
const answerA = process.env.A_ANSWER === 'ok'
  ? JSON.stringify({ ok: true, data: { tokenHash: FAKE_A_HASH } })
  : '{"ok":false,"code":"invite_invalid"}';
await held[0].route.fulfill({
  status: 200,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  body: answerA,
});
await page.waitForTimeout(1000);
await state(`3 A answered ${process.env.A_ANSWER === 'ok' ? 'ok' : 'invite_invalid'}`);
console.log('verify calls so far', verifies.length, 'with A hash', verifies.filter((v) => v.includes(FAKE_A_HASH)).length);
await held[1].route.continue();
await page.waitForURL(/\/portal\/join/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);
await state('4 B answered for real');
console.log('verify calls total', verifies.length, 'with A hash', verifies.filter((v) => v.includes(FAKE_A_HASH)).length);
await browser.close();
```

## Appendix E — `$T/pw-login.mjs`

Write verbatim to `/private/tmp/aj-inv-tsr/pw-login.mjs` (dry-run at `0e6c200` with the TC-17
fixture and `tutor@local.test`).

```js
// Signs in at /portal/login and prints where the portal lands (06-test-plan TC-17, R-2).
// Usage: BASE=http://localhost:5173 node pw-login.mjs <email> <password>
import { chromium } from '/Users/sjain/dev/work/aj_classes-invites/e2e/node_modules/@playwright/test/index.mjs';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const [email, password] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/portal/login`);
await page.locator('#login-email').fill(email);
await page.locator('#login-password').fill(password);
// A click before the local always-pass Turnstile settles is a silent no-op (e2e/src/auth/login.ts),
// so click again until the page leaves /portal/login (up to 5 tries).
for (let attempt = 0; attempt < 5 && new URL(page.url()).pathname === '/portal/login'; attempt += 1) {
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname !== '/portal/login', { timeout: 4000 }).catch(() => {});
}
// The sign-in page keeps a captcha connection open, so wait for the page to settle by time.
await page.waitForTimeout(3000);
console.log(JSON.stringify({ path: new URL(page.url()).pathname, h1: await page.locator('h1').first().textContent(), alert: await page.locator('[role=alert]').allTextContents() }));
await page.reload();
await page.waitForTimeout(3000);
console.log(JSON.stringify({ afterReload: new URL(page.url()).pathname }));
await browser.close();
```
