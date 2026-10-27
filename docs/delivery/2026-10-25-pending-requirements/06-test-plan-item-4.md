# 06 — Test plan: item 4 (staff phone on My profile, plus the Privacy update)

> **Stage:** 6a of /deliver (Tester, T4.12) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy`
> (worktree `/Users/sjain/dev/work/aj_classes-items-4-9`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 4 (AC-4.1 to AC-4.10), [03b](03b-design-items-4-8.md)
> §0.3 and §4 (§4.7 test approach), [04b](04b-plan-items-4-8.md) §0, T4.8 and T4.12,
> [05-dev-notes-item-4.md](05-dev-notes-item-4.md) (D2 especially), [06-test-plan-item-3.md](06-test-plan-item-3.md)
> and [TSR-item-3.md](TSR-item-3.md) (format, strict console reading),
> `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-4.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/staff-phone-privacy` HEAD at freeze time. This plan was written
against **`33c8573`** (the Developer's last commit, plus this docs commit). The run doesn't start
unless `git merge-base --is-ancestor 33c8573 HEAD` exits 0. If the T4.11 Reviewer or T4.13
Security pass leads to fix commits, the TSR names that fix SHA too, and the run uses the HEAD that
contains it. Record both SHAs in the TSR.

**Status: FROZEN, 75 cases.** No case may be removed or weakened from here on; new cases go at the end.

**Frozen on `FIX=2ff414f`** (26 Oct 2026). Security round 2 and code review round 2 both came back
APPROVED on it. The fix commits it contains are `dfcd372` and `beb59f0` (S1), `7fb4c31` (review 5
nits), `9711224` (S3), `1996c62` (E-60 wrong-role reads), `154a664` (dev notes §7) and `2ff414f`
(a comment-only change in `staff-client.ts`). The run also needs
`git merge-base --is-ancestor 2ff414f HEAD` to exit 0, and HEAD may differ from `2ff414f` only in
docs. E-92 to E-96 test the S1 fix.

**Lines changed after review 6a round 1** (`review-6a-item-4.md`; no second round, as agreed):
1. Finding 1, E-23: set the invitee's password with its own token first, and assert
   `password_set_at is not null`, so `complete_onboarding()` gets past `password_not_set`.
2. Finding 2, E-25: `updated_at` is record-only (the before-update trigger sets `now()` whenever
   `phone` is in the update).
3. Finding 3: this header (`FIX=2ff414f`); E-07 lists the 20 files explicitly; E-04 lists
   `staff-access.test.ts` and the round-2 counts (≥ 51 / 439, ≥ 14 / 507); E-96 no longer allows a
   new migration file (S1 was edited into `20261026100000`).
4. Finding 4, E-95: two more checks for the `invited` exemption. Before setup, the invited admin's
   own token gets `200 []` (RLS). After joining, the new admin at aal1 gets `insufficient_aal`.
   The review also suggested that an aal2 admin's write to the invited admin's phone gives
   `200 []`. A rolled-back probe on the local stack showed it **succeeds** (an aal2 admin can update
   any row, and the trigger skips the aal check for invited rows). So E-95 expects
   `200` with the number, the same as E-29, and the TSR records the probe.
5. Finding 5: D is started before E-22 and stays up through phases 2 to 4. E-22 and E-23 expect
   console 0 and hosted 0, and they're in E-91.
6. Finding 6, E-59: the console wording is now one rule.
7. Finding 7, E-60: the stale note is replaced, and `/portal/admin/activity` legs are added for a
   tutor, a student and a parent.
8. Finding 8, E-02 and E-90: the snapshot adds Isla's consent columns, the `student_guardians`
   count and `tutor@`'s `banned_until`.
9. Finding 9: `pp()` and `token.mjs` are defined in §1, the X2 `set-active` call is spelled out,
   and E-21 uses `token.mjs`.
10. Finding 10, E-96: also greps `supabase/README.md` for the break-glass text.
11. Found while fixing: a superuser `update … set phone = null` is now refused with
    `phone_required` (dev notes §8, S4), so X1 sets the null with
    `session_replication_role = replica` for that one statement.
12. Found while fixing: E-92 adds the pgTAP-backed case where an aal1 admin re-sends their own
    stored number in display format with a bio change, which saves (200).

**Environment (local only).**

| Name | What | Address |
|---|---|---|
| **DB** | Local Supabase, started from **this worktree** (`project_id = "aj_classes"`, shared with the other checkouts) | API `http://127.0.0.1:55321`, DB `:55322`, Studio `:55323`, Mailpit `:55324` |
| **D** | Dev server, strict port | `http://localhost:5173` (`pnpm dev --port 5173 --strictPort` from `apps/web`) |
| **P** | Local-Supabase production build on the item 1 Vercel mirror | `http://localhost:4173` |
| **A** | Android emulator `AJ_Test_Phone` (Play Store image, `hw.keyboard=no`), reaching D and DB through `adb reverse` | `localhost:5173` on the device |

- Seed accounts are in `supabase/seed.sql`: `admin@`, `newadmin@`, `tutor@`, `student@`,
  `parent@` and `inactive@local.test`. The local-only password and the local-only admin
  authenticator key are in the file's header comment. The run reads them from there and never
  copies them into the TSR.
- Seed phones (after `pnpm db:reset`): every staff profile (`admin@`, `newadmin@`, `tutor@`,
  `inactive@`) is `+61400000000`; `student@` and `parent@` are null. `inactive@` is
  `is_active = false` and banned in `auth.users`.
- **The hosted project `unzjnxctkyahtmrkinyr` is never read or written.** The committed
  `apps/web/.env.production` points at it, so every build and every dev server runs with the
  local exports below (shell variables win over `.env` files in Vite). E-01, E-02 and E-05
  enforce this. If any of them fails, **stop the run**.

**Full check** (04b §0 steps 1 to 4, from the worktree root, with the §1 exports set):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build \
  && [ "$(grep -rl unzjnxctkyahtmrkinyr apps/web/build/client | wc -l | tr -d ' ')" = 0 ] \
  && pnpm db:test && pnpm test:functions
(cd ~/dev/work/aj_classes-e2e && AJ_CLASSES_DIR=/Users/sjain/dev/work/aj_classes-items-4-9 \
  VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder npx playwright test)
lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill   # the E2E global setup leaves its dev server running
```

**Hard rules for this run.**
1. Local stack only (above). Banned commands: `supabase link`, `db push`, `config push`,
   `functions deploy`, `secrets set|unset|list`, and anything with `--linked` or `--project-ref`.
2. `supabase/.env.deploy` is never opened, `cat`-ed, sourced or grepped.
3. Secret values are never printed. Env checks print variable names, or `SET` / `unset`.
4. Docs-and-test only: no source file is edited during the run. If a fix is needed, it goes to the
   Developer, and the run restarts on the new HEAD.
5. **No test numbers that are real.** Every phone typed in this plan is from ACMA's reserved
   fiction ranges (`0491 570 xxx`, `(0X) 5550 xxxx`), or the design's examples. None of them is
   `0412 345 678` (the example in the invalid-phone error text, dev notes D2) or `BUSINESS.phone`
   (`+61 469 800 685`).

**Strict console reading (team lead, TSR-item-3 E-22 ruling).** Every browser leg counts
`console` messages of type `error` plus `pageerror` events, from the first page open to the end of
the case, across navigations. Expected is **0** on every leg. A refused request the app should never
have sent (for example, a 403 from a page loader running before the access check) **fails the
case**, even if the page then shows the right message. There are exactly two pre-declared
exceptions, both requests the test itself forces or the user must make:
- **A1.** E-42: the one `400` from `/auth/v1/token?grant_type=password` when `inactive@` signs in.
  The app has to send that request to learn the account is refused.
- **A2.** E-51 and E-53: the one line for the request the test breaks with `page.route` (rewritten
  to a bad phone, or aborted). Nothing else.

Any other line fails the case.

**Team-lead rulings (26 Oct 2026, recorded before freeze).**
1. **A1 and A2 are accepted, narrowly** (the same as item 2's R1 ruling). A1 is a request the
   server must refuse; the app can't know in advance that the account is deactivated. A2 covers
   only lines caused by the test's own `page.route` rewrites or aborts. Everything else must be 0
   on every leg, including the app's own `console.error` calls and `pageerror` events.
2. **E-60 stays strict and unchanged.** A request the app should never have sent fails the case.
   The Developer is checking now, and will add a role pre-check if the bug is real.
3. **The Privacy text changes** after Security S3 (`06-security-item-4.md`) found it too broad.
   The new text is an `[ASSUMPTION]` that still needs B17. E-84 tests it word for word. AC-4.9's
   "one new sentence" counts as met by this two-sentence B17 draft.

**No hosted requests.** Every browser leg also counts requests whose host ends in `supabase.co`.
Expected is **0** on every leg. E-91 adds them up.

**For Saurabh** (not cases; none of these blocks a case's pass or fail):
1. **B17 / Q7:** approve the Privacy wording and the heading change, batched with items 2 and 3.
   It's a release step, not a test. E-84 tests the post-S3 draft word for word (ruling 3). The
   draft is two sentences, and the team lead ruled that this meets AC-4.9's "one new sentence". If
   Saurabh changes the wording at B17, E-84's expected text changes with it, on a new build.
2. **Looks:** the E-70 and E-71 screenshots (8 legs) and the E-72 emulator screenshots are in
   `$EVD`. Legibility is measured (contrast, overflow, line counts), so the cases pass or fail on
   numbers. Whether it *looks* right is his call, after the run.
3. Nothing in this plan needs his accounts, his app config or a paid call. **E-72** is the only
   case with a device dependency. If the emulator can't boot on this Mac, E-72 is BLOCKED, and the
   lead must ask him before the gate to check the keypad on a real phone (steps under E-72).

**Known non-bugs for this run** (don't raise):
1. **O1 (dev notes):** when the browser check fails, focus moves to the first bad field, but
   Chromium doesn't scroll it into view. `develop` does the same with Full name, so it's
   pre-existing, and it's worth a ticket. E-47 measures focus (`document.activeElement`), not
   scrolling.
2. **O2 (dev notes):** the phone hint is 3 lines at 360 px. The wording is the PO's. The UI cases
   allow up to 3 lines.
3. **D1:** `PRIVACY` keeps its existing reviewer comment ("Wording for the owner to review…");
   nothing is added. E-86 checks that this branch adds no new draft or approval comment.
4. **D3:** `PRIVACY.lastUpdated` says "October 2026". If the release slips into November, the
   release step updates it (04b risk 6). That's not a test failure on this build.
5. The admin staff page shows the "you" hint ("So AJ Classes can reach you…") for someone else's
   number. It's the shared form, an accepted 03b `[ASSUMPTION]`.
6. A superuser `update` from `psql` writes no audit row, because `auth.uid()` is null. The fixture
   restores below depend on that.
7. Hot reload logs `[react-router:hmr] No module update found` after source edits. No source is
   edited in this run, but clear the console first if a server was left running from an edit.
8. Dev/staging `robots.txt` is `Disallow: /` on purpose. E-87 checks the built
   `apps/web/build/client/robots.txt` instead.

---

## 1. Set-up (once per terminal, before any build or server)

```bash
cd /Users/sjain/dev/work/aj_classes-items-4-9
pnpm db:status                                   # else pnpm db:start (from this worktree)
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from pnpm db:status>
export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA      # Cloudflare's public always-pass test key
export VITE_LOCAL_ADMIN_TWO_STEP_KEY=<local-only key from the supabase/seed.sql header>   # D only; never in a build
export KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
export SCR=<session scratch dir>
export EVD=$PWD/docs/test-reports/2026-10-26-feature-staff-phone-privacy/evidence
mkdir -p "$EVD"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'
qf() { docker exec -i supabase_db_aj_classes psql -U postgres -At -v ON_ERROR_STOP=1 < "$1"; }
MP=http://127.0.0.1:55324

# Ids and short checks used below
ADM=$(q "select id from public.profiles where email='admin@local.test'")
NADM=$(q "select id from public.profiles where email='newadmin@local.test'")
TUT=$(q "select id from public.profiles where email='tutor@local.test'")
INA=$(q "select id from public.profiles where email='inactive@local.test'")
STU=$(q "select id from public.profiles where email='student@local.test'")
PAR=$(q "select id from public.profiles where email='parent@local.test'")
ISLA=$(q "select id from public.students where full_name='Isla Demo'")
ph()   { q "select coalesce(phone,'null') from public.profiles where email='$1'"; }        # stored phone
aud()  { q "select count(*) from public.audit_log where action='profile_edited_by_admin'"; }
lastaud() { q "select actor_id||'|'||target_id||'|'||details::text from public.audit_log where action='profile_edited_by_admin' order by id desc limit 1"; }
R0="update public.profiles set phone='+61400000000' where email in ('admin@local.test','newadmin@local.test','tutor@local.test','inactive@local.test')"
                                                                                       # phone restore: superuser, writes no audit row
# Playwright: reuse the E2E repo's install.
ln -sfn ~/dev/work/aj_classes-e2e/node_modules "$SCR/node_modules"
```

The `VITE_LOCAL_ADMIN_TWO_STEP_KEY` export is for **D** only. This worktree has no
`apps/web/.env.development.local`, so without it `admin@` can't pass two-step on D. Unset it before
any build (`env -u VITE_LOCAL_ADMIN_TWO_STEP_KEY …`). E-05 checks it isn't in the build.

**`$SCR/as.mjs`** (REST as one caller; prints `status body`). It imports this worktree's helpers,
so **run it from the worktree root**: the helpers run `supabase status` in the current folder
(TSR-item-3 harness note 4).

```js
// node $SCR/as.mjs <anon | admin-aal1 | admin-aal2 | <seed email> | token:<jwt>> <METHOD> <path> [json body]
import { api, signIn, adminTwoStepToken } from '/Users/sjain/dev/work/aj_classes-items-4-9/supabase/scripts/local-test-helpers.mjs';
const [who, method, path, body] = process.argv.slice(2);
let token;
if (who.startsWith('token:')) token = who.slice(6);
else if (who.startsWith('admin-aal')) { const t = await adminTwoStepToken(); token = who === 'admin-aal1' ? t.aal1 : t.aal2; }
else if (who !== 'anon') token = (await signIn(who)).access_token;
const r = await api(path, { method, token, body: body ? JSON.parse(body) : undefined, headers: { Prefer: 'return=representation' } });
console.log(r.status, JSON.stringify(r.json));
```

Short forms:

```bash
pp() { node $SCR/as.mjs "$1" PATCH "/rest/v1/profiles?id=eq.$2&select=id,phone" "{\"phone\":$3}"; }   # phone write
setactive() { node $SCR/as.mjs admin-aal2 POST /functions/v1/account-admin "{\"action\":\"set-active\",\"userId\":\"$1\",\"active\":$2}"; }
```

**`$SCR/token.mjs`** prints one caller's access token (same helpers, run from the root):

```js
// node $SCR/token.mjs <admin-aal1 | admin-aal2 | <seed email> | <email> <password>>
import { api, signIn, adminTwoStepToken } from '/Users/sjain/dev/work/aj_classes-items-4-9/supabase/scripts/local-test-helpers.mjs';
const [who, password] = process.argv.slice(2);
const CAPTCHA = { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' }; // Turnstile always-pass test secret, as the helpers
if (who.startsWith('admin-aal')) { const t = await adminTwoStepToken(); process.stdout.write(who === 'admin-aal1' ? t.aal1 : t.aal2); }
else if (password) process.stdout.write((await api('/auth/v1/token?grant_type=password', { body: { email: who, password, gotrue_meta_security: CAPTCHA } })).json?.access_token ?? '');
else process.stdout.write((await signIn(who)).access_token ?? '');
```

**Browser harness** (`$SCR/ui.mjs`, Chromium, throwaway). Each leg opens a fresh context and
attaches, before the first navigation:
- `page.on('console')` (type `error`) and `page.on('pageerror')` → **console errors**;
- `page.on('request')` → **hosted** (host ends in `supabase.co`), and **PATCHes** (method `PATCH`,
  path `/rest/v1/profiles`);
- `page.on('response')` → status and body for every `127.0.0.1:55321` response (kept for E-83).

Sign-in is through `/portal/login` with the seed password. "Overflow" is
`document.documentElement.scrollWidth − clientWidth`. "Dark" is the portal's own switch,
Account → Appearance → Dark (not `emulateMedia`). "Light" is Appearance → Light. "Lines" is
`Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))`.
"Contrast" is the WCAG ratio of the element's computed `color` against the first opaque
`background-color` up its ancestors (the input's own background for the typed text).

**Seed-data order and fixtures.** Each fixture is applied right before the case that needs it and
restored at that case's end (or the last case named), so earlier cases run on the seed. E-02 takes
the snapshot that E-90 compares against. Phone values are measured per case, and audit rows as a
**delta** (`aud` before and after), because the full check and E2E write their own rows.

| Fixture | What | Applied right before | Restored by |
|---|---|---|---|
| X1 | `tutor@` has no phone (staff who joined before onboarding): `q "begin; set local session_replication_role = replica; update public.profiles set phone=null where id='$TUT'; commit;"` (a plain superuser update is refused with `phone_required`) | E-13, and again E-49 | Same case's last step: `q "$R0"`; `ph tutor@local.test` = `+61400000000` |
| X2 | `tutor@` deactivated through the real admin action, while a tutor token or page is still open: `setactive $TUT false` | E-21, and again E-59 | Same case's last step: `setactive $TUT true`; `tutor@` signs in again; `banned_until` is null or in the past |
| X3 | Invited, unfinished tutor `e2e-item4-inv@local.test` ("Item Four Invitee"), through the real admin UI invite; its session token read from the invitee page's `localStorage` after the invite link's "Continue" (as the E2E invite spec) | E-22 | Kept for E-29 and E-58; finished in E-61; deleted in E-90 (audit rows, profile, `auth.users`, as the E2E spec's cleanup) |
| X4 | `inactive@` temporarily unbanned (still `is_active = false`): `q "update auth.users set banned_until=null where email='inactive@local.test'"` | E-21 step 4 | Same step: `q "update auth.users set banned_until=now()+interval '100 years' where email='inactive@local.test'"` |
| X5 | Invited, unfinished parent `e2e-item4-par@local.test` for Isla, through Admin → Students → Isla → invite parent; token as X3 | E-23 | E-23 last step: delete as X3 |
| X6 | Distinct staff numbers for the build grep: `q "update public.profiles set phone='+61491570156' where id='$TUT'"`; `q "update public.profiles set phone='+61255501234' where id='$ADM'"` | E-80 (before the build) | E-90: `q "$R0"` |
| X7 | A 1 × 1 PNG at `$SCR/avatar.png` (made with `printf`/`base64`, ~70 bytes) | E-62 | E-62 last step: photo removed in the UI; avatar objects for `tutor@` back to the snapshot count |

---

## 2. Cases

Phases run in this order: **0** safety, **1** repo checks, **2** DB and API (no browser), **3**
portal on **D**, **4** UI matrix and device, **5** exposure and Privacy on the build, **6**
close-out. Phase 7 (Security S1) runs right after phase 2, keeping its IDs. Within a phase, run in table order. Phase 1 runs the E2E suite, which starts and leaves
its own server on :5173, so kill it before starting **D**.

### Phase 0 — safety guards (stop the run if any fails)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-01 | §0.3 | Safety | Shell, dev server and E2E env point at the local stack only | 1. `echo $VITE_SUPABASE_URL`; compare `$VITE_SUPABASE_PUBLISHABLE_KEY` with `pnpm db:status`'s key (print `equal` / `differ` only). 2. `ls -a apps/web \| grep -E '^\.env'`. 3. `grep -E '^(SUPABASE_REST_URL\|PG_HOST\|PG_PORT\|WEB_BASE_URL\|MAILPIT_URL)=' ~/dev/work/aj_classes-e2e/.env`; `grep -c 'supabase.co' ~/dev/work/aj_classes-e2e/.env`. 4. `env \| grep -E '^(SUPABASE_REST_URL\|PG_HOST\|PG_PORT\|WEB_BASE_URL\|MAILPIT_URL)='`. 5. `env \| cut -d= -f1 \| grep -xE 'SUPABASE_ACCESS_TOKEN\|SUPABASE_DB_PASSWORD\|RESEND_API_KEY\|TURNSTILE_SECRET\|ZOHO_[A-Z_]+'` (names only). 6. `git rev-parse HEAD`; `git merge-base --is-ancestor 33c8573 HEAD; echo $?`; `git branch --show-current` | 1: exactly `http://127.0.0.1:55321`; `equal`. 2: `.env.example` and `.env.production` only (no `.env.local`, no `.env.development*`), so D reads only the shell exports. 3: `SUPABASE_REST_URL=http://127.0.0.1:55321`, `PG_HOST` `127.0.0.1` or `localhost`, `PG_PORT=55322`, `WEB_BASE_URL=http://localhost:5173`, `MAILPIT_URL=http://127.0.0.1:55324`; `supabase.co` **0**. 4: no output. 5: **no output**. 6: HEAD recorded; `0`; `feature/staff-phone-privacy`. **Any failure: stop** | DB |
| E-02 | §0.3, 04b §0 | Safety | Stack started and reset from this worktree; seed snapshot | 1. `pnpm db:reset`. 2. `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' \| grep -c aj_classes-items-4-9`. 3. `q "select max(version) from supabase_migrations.schema_migrations"`; `ls supabase/migrations \| tail -1`. 4. Snapshot: `q "select email\|\|'\|'\|\|role\|\|'\|'\|\|status\|\|'\|'\|\|is_active\|\|'\|'\|\|coalesce(phone,'null')\|\|'\|'\|\|full_name\|\|'\|'\|\|md5(coalesce(bio,'')\|\|qualifications::text\|\|subjects::text)\|\|'\|'\|\|coalesce(avatar_path,'null') from public.profiles order by email" > $SCR/snapshot-start.txt`; `q "select count(*) from storage.objects where bucket_id like '%avatar%'" >> $SCR/snapshot-start.txt`; `q "select full_name\|\|'\|'\|\|coalesce(consent_recorded_at::text,'null')\|\|'\|'\|\|coalesce(consent_source::text,'null')\|\|'\|'\|\|coalesce(profile_id::text,'null') from public.students order by 1" >> $SCR/snapshot-start.txt`; `q "select count(*) from public.student_guardians" >> $SCR/snapshot-start.txt`; `q "select email\|\|'\|'\|\|coalesce((banned_until > now())::text,'null') from auth.users where email in ('tutor@local.test','inactive@local.test') order by 1" >> $SCR/snapshot-start.txt` | 1: exit 0. 2: **1** (if not, `pnpm db:stop && pnpm db:start` here, then repeat). 3: both `20261026100000`. 4: 6 profiles; the 4 staff `+61400000000`, `student@` and `parent@` `null`; `inactive@` `is_active` `f`. Saved. **Any failure in 2–3: stop** | DB |
| E-03 | §0.3 | Safety | `.env.deploy` untouched; no banned command in the run log | `git check-ignore -q supabase/.env.deploy; echo $?` (doesn't open the file). At close-out: `grep -nE 'env\.deploy\|db push\|config push\|functions deploy\|secrets (set\|unset\|list)\|--linked\|--project-ref\|supabase link' <the TSR's command log>` | `0`; the log has no such line | — |

### Phase 1 — repo checks

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-04 | DoD, all | Full check | Repo full check (header, lines 1–3) | Run with the §1 exports, `VITE_LOCAL_ADMIN_TWO_STEP_KEY` unset; save the log to `$EVD/E-04-fullcheck.log` | Every step exit 0. Lint 0 problems. `pnpm test` 0 failed, **≥ 51 files / ≥ 439 tests**, and the list includes `ProfileForm.test.tsx`, `profile-validation.test.ts`, `auth-errors.test.ts`, `privacy.test.tsx`, `staff-access.test.ts`. `db:test` 0 failed, **≥ 14 files / ≥ 507 tests**, with `staff_phone.test.sql` and `onboarding.test.sql` listed. `test:functions` **≥ 169 `ok`, 0 `NOT OK`** (dev notes §7 round-2 counts). Fewer means a test was dropped: fail. Record the counts | DB |
| E-05 | §0.3, 4.8 | Hosted refs | The build has no hosted ref and no local-only key | After E-04's build: `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client \| wc -l`; `grep -rl 'supabase\.co' apps/web/build/client \| wc -l`; `grep -rl 127.0.0.1:55321 apps/web/build/client \| wc -l`; `grep -rlF "$(sed -n 's/^--   \([A-Z]\{32\}\)$/\1/p' supabase/seed.sql)" apps/web/build/client \| wc -l` | **0**, **0**, **≥ 1** (the build really is the local-Supabase one), **0** | P build |
| E-06 | 4.7 (regr.) | E2E | External E2E suite (header, line 4) | Run it; then `lsof -t -nP -iTCP:5173 -sTCP:LISTEN \| xargs kill`; then `q "select count(*) from public.profiles where email like 'e2e-%'"`; same for `public.posts` (title) and `public.enquiries` (email) | **9 passed**, 0 failed (it includes invite onboarding with a phone, so `complete_onboarding()` works with the new trigger, and admin 2FA login). All three counts **0**. Port 5173 free | DB, D (own) |
| E-07 | 03b §4.1 | Scope guard | Only the 03b files changed; the untouched list is untouched | `git diff --name-only develop...HEAD -- apps supabase`; `git diff --quiet develop...HEAD -- apps/web/src/routes/portal/profile.tsx apps/web/src/routes/portal/admin-staff-member.tsx apps/web/src/routes/portal/admin-staff.tsx apps/web/src/services/database.types.ts; echo $?`; `git diff develop...HEAD -- supabase/migrations \| grep -c 'complete_onboarding'` | The name list is exactly these **20** files (recounted at freeze on `2ff414f`): `apps/web/src/components/portal/{PortalField.tsx,ProfileForm.test.tsx,ProfileForm.tsx}`, `apps/web/src/constants/{content,error,portal}.constants.ts`, `apps/web/src/lib/{profile-validation.test.ts,profile-validation.ts}`, `apps/web/src/routes/privacy.test.tsx`, `apps/web/src/services/{activity.service.ts,auth-errors.test.ts,auth-errors.ts,profile.service.ts,staff-access.test.ts,staff-client.ts,staff.service.ts,types.ts}`, `supabase/README.md`, `supabase/migrations/20261026100000_staff_phone_edit.sql`, `supabase/tests/database/staff_phone.test.sql`. Any other file, or a missing one, fails. `0`. **0** (onboarding not redefined) | — |
| E-08 | Repo rules | Code rules | Added lines follow the repo rules | `git diff develop...HEAD -- apps/web/src \| grep -E '^\+' \| grep -nE 'console\.(log\|debug)\|style=\{\{\|: any\b\|TODO(?! \[)\|fetch\(\|axios\|document\.(querySelector\|getElementById)\|innerHTML'` (use `grep -P` for the lookahead) | **0** lines. (The existing `getElementById(...).focus()` in `ProfileForm.tsx` is an unchanged line, so it isn't a `+` line) | — |
| E-09 | 03b §4.1 | Types | Generated types match the migrated schema | `pnpm db:types && git diff --exit-code apps/web/src/services/database.types.ts; echo $?` | `0` (`phone` was already a column; no RPC changed) | DB |

### Phase 2 — DB and API (no browser)

Run from the worktree root. Each case ends with `ph` for every account it touched, and restores
with `q "$R0"` unless a later case is named.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-10 | 4.2 | Accepted formats | A tutor saves each accepted format; it's stored as `+61…` | As `tutor@`, `pp tutor@local.test $TUT` with each, in order: `"0491 570 156"`, `"0491-570-157"`, `"(02) 5550 1234"`, `"(03) 5550 1234"`, `"(07) 5550 1234"`, `"(08) 5550 1234"`, `"+61 491 570 158"`, `"+61255509876"`, `"  0491 570 159  "`, `"0491\t570\t110"`; `ph tutor@local.test` after each. Then `q "$R0"` | Each **200**, body `[{"id":"$TUT","phone":…}]` with, in order: `+61491570156`, `+61491570157`, `+61255501234`, `+61355501234`, `+61755501234`, `+61855501234`, `+61491570158`, `+61255509876`, `+61491570159`, `+61491570110`; `ph` equals the body each time | DB |
| E-11 | 4.3 | Invalid input (API) | The server refuses what isn't Australian when the browser is bypassed | `pp tutor@local.test $TUT` with each: `"0512345678"`, `"(05) 1234 5678"`, `"(09) 1234 5678"`, `"041234567"`, `"04123456789"`, `"0412abc678"`, `"abc"`, `"+1 202 555 0100"`, `"61491570156"`, `"+61 (0) 491 570 156"`, `"0491.570.156"`, `"1300 123 456"`, `"000"`, a 5,000-character string of `4`, `"'; drop table public.profiles; --"`, `123` (a JSON number); `ph tutor@local.test` after each | Each **400** with message `invalid_phone` (the JSON number: `invalid_phone`, or a 400 type error; record which). **Never 500.** `ph` stays `+61400000000` after every one. `q "select count(*) from public.profiles"` still 6 | DB |
| E-12 | 4.4 | Blank (API) | A saved number can't be cleared | `pp tutor@local.test $TUT` with `""`, `"   "`, `null`; then the whole-form write `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/profiles?id=eq.$TUT&select=id" '{"full_name":"Changed Tutor","bio":"changed","phone":""}'`; `q "select full_name, bio, coalesce(phone,'null') from public.profiles where id='$TUT'"` | Each **400** `phone_required`. The whole-form write **400** `phone_required`, and the row is unchanged: `Local Tutor`, the seed bio, `+61400000000` (one statement saves nothing) | DB |
| E-13 | 4.4 | No phone yet (API) | Staff with no number can save other fields with the phone blank (X1) | Apply X1. `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/profiles?id=eq.$TUT&select=id,full_name,phone" '{"full_name":"Local Tutor B","phone":""}'`; same with `"phone":null`; then `pp tutor@local.test $TUT '"0491 570 156"'`; restore the name (`q "update public.profiles set full_name='Local Tutor' where id='$TUT'"`); restore X1 | First two **200**, `full_name` `Local Tutor B`, `phone` `null`. Third **200**, `+61491570156`. After the restore, `ph` = `+61400000000`, name `Local Tutor` | DB |
| E-14 | 4.3, 4.5 | One statement | A bad phone in a whole-form write saves none of it | `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/profiles?id=eq.$TUT&select=id" '{"full_name":"Changed","bio":"changed","qualifications":["x"],"subjects":["maths"],"phone":"abc"}'`; read the row | **400** `invalid_phone`; `full_name`, `bio`, `qualifications`, `subjects`, `phone` all equal the snapshot | DB |
| E-15 | 4.7 | Permissions: tutor | A tutor can't read or change anyone else's phone | As `tutor@`: `pp tutor@local.test $ADM '"0491 570 156"'`; same for `$NADM`, `$INA`, `$STU`; `GET /rest/v1/profiles?select=id,phone&id=eq.$ADM`; `GET /rest/v1/profiles?select=id,phone`; `POST /rest/v1/rpc/admin_list_staff '{}'`; then `ph` for all four | Each PATCH **200 `[]`** (RLS, 0 rows). The single GET `[]`. The list GET returns exactly **1** row, `$TUT`. `admin_list_staff` refused (**403**/400 with `not_admin` or `42501`), 0 rows. All four phones unchanged | DB |
| E-16 | 4.7 | Permissions: families | Students and parents can't set a phone on their own row or anyone's | As `student@` and as `parent@`: `pp <self> <own id> '"0491 570 156"'`; `pp <self> $TUT '"0491 570 156"'`; `GET /rest/v1/profiles?select=id,phone` ; `POST /rest/v1/rpc/admin_list_staff '{}'` | Every PATCH **200 `[]`** (0 rows); the GET returns only their own row, with `phone` `null`; the RPC refused, 0 rows. `ph student@local.test` and `ph parent@local.test` `null`; `ph tutor@local.test` `+61400000000` | DB |
| E-17 | 4.7 | Families never hold a phone | An admin can't give a family account a phone; other family edits still save | As `admin-aal2`: `pp admin-aal2 $STU '"0491 570 156"'`; same for `$PAR`; then `node $SCR/as.mjs admin-aal2 PATCH "/rest/v1/profiles?id=eq.$STU&select=id,full_name,phone" '{"full_name":"Aarav Demo B","phone":""}'`; restore the name by SQL | Both phone writes **400** `invalid_input`; phones `null`. The name write **200**, name changed, phone `null` (a blank is "no change", dev notes D4). Name restored to `Aarav Demo` | DB |
| E-18 | 4.7 | Permissions: aal1 admin | An admin without two-step can't change a phone | `aud` → N. `pp admin-aal1 $TUT '"0491 570 156"'`; `ph tutor@local.test`; `aud` | **200 `[]`**; phone `+61400000000`; audit still **N** | DB |
| E-19 | 4.7 | Permissions: signed out | Anonymous callers can't read or write a phone | `pp anon $TUT '"0491 570 156"'`; `node $SCR/as.mjs anon GET "/rest/v1/profiles?select=id,phone"` | Write **401** or **200 `[]`** (record which); read **401** (no anon grant) or `[]`. Phone unchanged | DB |
| E-20 | 4.7 | Ungranted columns | `status`, `terms_accepted_at`, `password_set_at` (and `role`, `is_active`, `email`) stay unwritable | As `tutor@`, one PATCH per body on own row: `{"status":"invited"}`, `{"terms_accepted_at":null}`, `{"password_set_at":null}`, `{"role":"admin"}`, `{"is_active":false}`, `{"email":"x@local.test"}`, and `{"phone":"0491 570 156","role":"admin"}`. Repeat the first three as `admin-aal2` on `$TUT`. Read the row | Every PATCH **401/403** with code `42501` (`permission denied`). Row unchanged: `active`, the seed `terms_accepted_at` and `password_set_at`, `tutor`, `t`, `tutor@local.test`, phone `+61400000000` | DB |
| E-21 | 4.7 | Permissions: deactivated | A deactivated tutor's still-valid token, and a deactivated account that somehow signs in, can't change a phone (X2, X4) | 1. `T=$(node $SCR/token.mjs tutor@local.test)`. 2. Apply X2 (`setactive $TUT false`); `q "select is_active from public.profiles where id='$TUT'"`. 3. `pp "token:$T" $TUT '"0491 570 156"'`; `ph tutor@local.test`. Restore X2. 4. Apply X4; `I=$(node $SCR/token.mjs inactive@local.test)`; `pp "token:$I" $INA '"0491 570 156"'`; `ph inactive@local.test`; restore X4. 5. With the ban back: `node $SCR/token.mjs inactive@local.test \| wc -c` | 2: `f`. 3: **200 `[]`** or 401 (record which); phone `+61400000000`. After the restore, `tutor@` signs in again (200 with a token). 4: sign-in succeeds while unbanned; PATCH **200 `[]`**; phone `+61400000000`. 5: refused: **0** characters (no `access_token`) | DB |
| E-22 | 4.7 | Permissions: still invited | An invited, unfinished account can't change any phone (X3, real invite) | **Start D now** (phase 3's command; it stays up through phase 4). Apply X3: as `admin@` on D, Admin → Staff → Invite staff (name "Item Four Invitee", `e2e-item4-inv@local.test`); open the Mailpit link in a second context; click "Continue"; stop on `/portal/join`; read `TI` from `localStorage`. `q "select role, status, coalesce(phone,'null') from public.profiles where email='e2e-item4-inv@local.test'"`; `INV=<its id>`. Then `pp "token:$TI" $INV '"0491 570 156"'`; `pp "token:$TI" $TUT '"0491 570 156"'`; `node $SCR/as.mjs "token:$TI" PATCH "/rest/v1/profiles?id=eq.$INV&select=id" '{"full_name":"x"}'` | `tutor\|invited\|null`. All three **200 `[]`**. The invitee's phone `null` and name unchanged; `ph tutor@local.test` unchanged. Browser legs (admin and invitee): console errors 0, hosted 0. Keep X3 | D, DB |
| E-23 | 4.7 (regr.) | Onboarding refuses a family phone | An invited parent can't set a phone through `complete_onboarding()` (X5) | Apply X5 (Admin → Students → Isla → invite parent `e2e-item4-par@local.test`; link; "Continue"; token `TP`). Set its password with its own token: `curl -s -o /dev/null -w '%{http_code}' -X PUT $VITE_SUPABASE_URL/auth/v1/user -H "apikey: $KEY" -H "Authorization: Bearer $TP" -H 'Content-Type: application/json' -d '{"password":"e2e-item4-password-123"}'`; `q "select password_set_at is not null from public.profiles where email='e2e-item4-par@local.test'"`. Then `node $SCR/as.mjs "token:$TP" POST /rest/v1/rpc/complete_onboarding '{"new_full_name":"Item Four Parent","new_phone":"0491 570 156","accepts_terms":true}'`; `q "select status, coalesce(phone,'null') from public.profiles where email='e2e-item4-par@local.test'"`. Restore X5 | Password `200`; `t`. RPC **400** `invalid_input` (not `password_not_set`); `invited\|null`. Browser legs: console errors 0, hosted 0. After the restore, `q "select count(*) from public.profiles where email='e2e-item4-par@local.test'"` = 0 | D, DB |
| E-24 | 4.6 | Admin change: audit | An admin's change writes one audit row with the field name and no digits | `aud` → N. `pp admin-aal2 $TUT '"(03) 5550 4321"'`; `aud`; `lastaud`; `q "select count(*) from public.audit_log a where a.action='profile_edited_by_admin' and (a.details::text ~ '[0-9]' or row_to_json(a)::text ~ '(355504321\|5550 4321\|5550-4321)')"`; `node $SCR/as.mjs admin-aal2 POST /rest/v1/rpc/admin_list_staff '{}'` → the `$TUT` entry's `phone` | **200**, `+61355504321`. Audit **N + 1**. `lastaud` = `$ADM\|$TUT\|{"fields": ["phone"]}` exactly. The digit count **0**. `admin_list_staff` shows `+61355504321` | DB |
| E-25 | 4.6 | Same value | An equal number in another format changes nothing and writes no audit row | `q "select updated_at from public.profiles where id='$TUT'"` → U. `aud` → N. `pp admin-aal2 $TUT '"03 5550 4321"'`; `pp admin-aal2 $TUT '"+61 3 5550 4321"'`; `aud`; `updated_at` (record only) | Both **200** with `+61355504321`; audit still **N**. `updated_at` is recorded, not judged (the before-update trigger sets `now()` whenever `phone` is in the update) | DB |
| E-26 | 4.6 | Self-edit | A staff member's own change writes no audit row; `updated_at` moves | `aud` → N; tutor `updated_at` → U. `pp tutor@local.test $TUT '"0491 570 156"'`; `pp admin-aal2 $ADM '"0491 570 157"'` (admin, own row); `aud`; tutor `updated_at`. Then `q "$R0"` | Both **200**; audit still **N**; tutor `updated_at` **> U** | DB |
| E-27 | 4.6 | Several fields | Name plus phone by an admin: one row, both names | `aud` → N. `node $SCR/as.mjs admin-aal2 PATCH "/rest/v1/profiles?id=eq.$TUT&select=id" '{"full_name":"Local Tutor C","phone":"0491 570 158"}'`; `aud`; `lastaud`. Restore name and phone by SQL | **200**; **N + 1**; details exactly `{"fields": ["full_name", "phone"]}`; no digit in `details` | DB |
| E-28 | 4.6 | Other staff rows | An admin can correct another admin's and a deactivated tutor's phone | `aud` → N. `pp admin-aal2 $NADM '"0491 570 159"'`; `pp admin-aal2 $INA '"(08) 5550 1234"'`; `aud`; the last 2 audit rows' `target_id\|details`. Then `q "$R0"` | Both **200** (`+61491570159`, `+61855501234`); **N + 2**; targets `$NADM` and `$INA`, each `{"fields": ["phone"]}` | DB |
| E-29 | 4.6 | Invited staff row | An admin can set an invited staff member's phone (X3) | `pp admin-aal2 $INV '"0491 570 110"'`; `q "select status, phone from public.profiles where id='$INV'"` | **200**; `invited\|+61491570110` (the invitee overrides it in E-61). Keep X3 | DB |
| E-30 | 03b §4.2 | Trigger function | The trigger function is closed to clients and safely defined | `node $SCR/as.mjs tutor@local.test POST /rest/v1/rpc/check_profile_phone '{}'`; `q "select has_function_privilege(r, 'private.check_profile_phone()', 'execute') from unnest(array['anon','authenticated','public']) r"` (use `pg_roles` for `public`, or check `proacl`); `q "select prosecdef, proconfig from pg_proc where proname='check_profile_phone'"`; `q "select tgname, tgenabled from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal order by 1"` | RPC **404** (not exposed). `anon` `f`, `authenticated` `f`; `proacl` has no `=X` (public) entry. `t` and `{search_path=""}`. Triggers include `profiles_audit_admin_edit`, `profiles_check_phone`, `profiles_set_updated_at`, all enabled (`O`) | DB |
| E-31 | 4.8 | DB exposure | Nothing in the database hands a phone to a family or a visitor | `q "select proname from pg_proc where pronamespace='public'::regnamespace and prosrc ilike '%phone%' order by 1"`; `q "select count(*) from pg_proc where pronamespace='public'::regnamespace and prorettype='public.profiles'::regtype"`; `q "select count(*) from information_schema.views where table_schema='public' and view_definition ilike '%phone%'"`; `q "select count(*) from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='anon'"`; `q "select count(*) from pg_publication_tables where tablename='profiles'"`; for the two functions found, `q "select string_agg(r, ',') from unnest((select proacl::text[] from pg_proc where proname='admin_list_staff')) r"` | Exactly `admin_list_staff`, `complete_onboarding`. `0`, `0`, `0`, `0`. `admin_list_staff` is executable by `authenticated` but refuses non-admins (E-15, E-16); `anon` has no execute | DB |
| E-32 | 4.6, 4.7 | Concurrency | A tutor and an admin save different numbers at the same moment | `aud` → N. `(pp tutor@local.test $TUT '"0491 570 156"' > $SCR/c1 & pp admin-aal2 $TUT '"0491 570 157"' > $SCR/c2 & wait)`; `cat $SCR/c1 $SCR/c2`; `ph tutor@local.test`; `aud`; `admin_list_staff` entry. Then `q "$R0"` | Both **200**, no 500, no deadlock error. Final phone is one of `+61491570156` / `+61491570157` (record which), and `admin_list_staff` agrees. Audit **N + 1** (only the admin's write; record if the admin wrote last). No partial value | DB |

### Phase 3 — portal on the dev server

Start **D** from `apps/web` with the §1 exports (including `VITE_LOCAL_ADMIN_TWO_STEP_KEY`):
`pnpm dev --port 5173 --strictPort`. Every case below records **console errors**, **hosted** and
(where named) **PATCHes**. Unless the case says otherwise: console errors **0**, hosted **0**.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-40 | Smoke | Start-up | The app starts and the key pages load | `curl -s -o /dev/null -w '%{http_code}'` for `/`, `/privacy`, `/portal/login`; then open each in the harness at 1280 × 800 | Three **200**. Each page: exactly **1** `h1`, exactly **1** `<meta name="robots">` (BUG-1 regression), overflow 0, console errors 0, hosted 0 | D |
| E-41 | Smoke, regr. | Sign-in | Every active role signs in, and stays signed in after a reload | For `admin@`, `newadmin@`, `tutor@`, `student@`, `parent@`: sign in at `/portal/login`; record the final URL and `h1`; reload; record again; sign out | `admin@`: two-step is entered by the dev server, lands in the admin area. `newadmin@`: the two-step set-up screen. `tutor@`: the staff home. `student@`: the student home. `parent@`: the parent home. The same page after reload (still signed in). Console errors 0 and hosted 0 on all five legs | D |
| E-42 | Smoke, regr. | Sign-in | The deactivated account is refused | `inactive@` with the seed password | "Email or password is incorrect." shown; URL stays `/portal/login`; 0 auth-token keys in `localStorage`. Console: only **A1** (one `400` on `/auth/v1/token`); nothing else. Hosted 0 | D |
| E-43 | 4.1, 4.10 | Field on My profile | The tutor sees the phone field, pre-filled and described | As `tutor@`, `/portal/profile`. Read: the `label[for=profile-phone]` text; the order of `#profile-full-name` and `#profile-phone` in the form; `#profile-phone`'s `value`, `type`, `inputmode`, `autocomplete`; the element named by its `aria-describedby`; the count of "Save profile" buttons | Label exactly `Phone number` (1 label). Phone is the next field after Full name. Value `0400 000 000`. `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`. `aria-describedby` points at the hint, whose text is exactly `So AJ Classes can reach you about your classes. Only AJ Classes admins can see it; it's never shown on the website.` Exactly **1** "Save profile" button | D |
| E-44 | 4.1 | Field on My profile | The admin sees the same on their own My profile | As `admin@`, `/portal/profile`; same reads as E-43 | Same as E-43, value `0400 000 000` | D |
| E-45 | 4.2 | Save and reload | A tutor changes the number; it's formatted, stored and still there after a reload | `aud` → N. As `tutor@`: clear `#profile-phone`, type `0491-570-156`, Save profile. Read the status text and the field; count PATCHes; reload; read the field; `ph tutor@local.test`; `aud` | "Profile saved." shown **once**. Field shows `0491 570 156` before and after the reload. PATCHes **1**. DB `+61491570156`. Audit still **N** (self-edit) | D |
| E-46 | 4.2 | Other formats | Landline and `+61` forms in the UI | As `tutor@`: save `+61 2 5550 9876`, read field, reload; save `(08) 5550 1234`, reload; `ph` after each. Then `q "$R0"` | Field `(02) 5550 9876`, DB `+61255509876`; then `(08) 5550 1234`, `+61855501234`. "Profile saved." once per save | D |
| E-47 | 4.3 | Invalid input (browser) | Bad values are refused on the field, and nothing is sent | As `tutor@`, for each of `12345`, `abc`, `0512 345 678`, `+1 202 555 0100`, `0491.570.156`, `61491570156`: type it, Save. Read the field's error text, `aria-invalid`, `document.activeElement.id`, the FormAlert and status text; count PATCHes; `ph` | Error under the field exactly `Please enter an Australian phone number, like 0412 345 678.`; `aria-invalid="true"`; `aria-describedby` now also names the error; focus `profile-phone`. No FormAlert, no "Profile saved.". PATCHes **0** for all six. DB `+61400000000` | D |
| E-48 | 4.4 | Blank (browser) | A saved number can't be cleared in the form | As `tutor@`: clear the field, Save; then type three spaces, Save | Both: error on the field exactly `Please enter a phone number. You can change it, but you can't remove it.`; focus `profile-phone`; PATCHes **0**; DB `+61400000000` | D |
| E-49 | 4.4 | No phone yet (browser) | Staff with no number see an empty field and can still save the rest (X1) | Apply X1. As `tutor@`, `/portal/profile`: read the field and hint; edit Bio (append " B"), Save; read status; `q "select coalesce(phone,'null'), bio from public.profiles where id='$TUT'"`; then type `0491 570 159`, Save, reload. Restore the bio by SQL; restore X1 | Field empty, hint as E-43. First save: "Profile saved.", PATCHes 1, DB `null` and the new bio. Second save: field `0491 570 159` after reload, DB `+61491570159`. Restores done: `+61400000000`, seed bio | D |
| E-50 | 4.5 | Edits survive a phone error | A phone error keeps every other edit; the fixed save saves all, and the header name refreshes | As `tutor@`: change Full name to `Local Tutor D`, tick one more subject, append " D" to Bio, add the qualification `Test cert`, type `abc` in the phone, Save. Read all five fields. Fix the phone to `0491 570 157`, Save. Read the header's name (no reload); count PATCHes; read the row. Restore the row by SQL (name, subjects, bio, qualifications, `$R0`) | After the error: all four other edits still in their fields, no "Profile saved.", PATCHes **0**. After the fix: "Profile saved." once; PATCHes **1**; the header shows `Local Tutor D` without a reload; DB has all five new values (`+61491570157`). Restores done | D |
| E-51 | 4.3, 4.5 | Server refusal in the UI | When the server refuses the phone, the message sits on the field and the other edits stay | As `tutor@`: `page.route('**/rest/v1/profiles*', r => r.request().method() === 'PATCH' ? r.continue({ postData: JSON.stringify({ ...JSON.parse(r.request().postData()), phone: '0412abc678' }) }) : r.continue())`. Append " E" to Bio, type `0491 570 156`, Save. Read the field error, FormAlert, status, Bio; the row. Then change the rewrite to `phone: ''`, Save again; read the field error. Unroute | First: field error exactly `Please enter an Australian phone number, like 0412 345 678.` (`PORTAL_ERRORS.invalidPhone`); **no** FormAlert; no "Profile saved."; Bio still has " E"; DB bio and phone unchanged. Second: field error exactly `Please enter a phone number. You can change it, but you can't remove it.`; no FormAlert. Console: only **A2** (one line per forced 400, 2 in total); hosted 0 | D |
| E-52 | 4.5 | Double save | A double-click sends one save | As `tutor@`: type `0491 570 158`; double-click Save profile (`dblclick`). Count PATCHes; read status. Then `q "$R0"` | PATCHes **1**; "Profile saved." once; no error | D |
| E-53 | 4.5 | Other failures | A network failure uses the form alert, not the phone field | As `tutor@`: `page.route` aborts the PATCH. Type `0491 570 159`, Save. Read the FormAlert, field error, field value. Unroute | FormAlert exactly `We couldn't reach the server. Check your connection and try again.` (or `PORTAL_ERRORS.notSaved`'s text; record which key). No error on the phone field; the field still `0491 570 159`. DB `+61400000000`. Console: only **A2** (the aborted request) | D |
| E-54 | 4.6 | Admin correction | An admin changes a tutor's phone on the staff page; the header link and the list update | `aud` → N. As `admin@`: `/portal/admin/staff`, read Local Tutor's Phone cell; open Local Tutor; read the field and hint; type `(03) 5550 4321`, Save. Read the status, the header's `tel:` link `href` and text (no reload); go back to the list; read the Phone cell. `aud`; `lastaud` | List before: `0400 000 000`. Field `0400 000 000`, hint as E-43. "Profile saved." once. Header link `href="tel:+61355504321"`, text `(03) 5550 4321`, without a reload. List cell `(03) 5550 4321`. Audit **N + 1**, details `{"fields": ["phone"]}` | D |
| E-55 | 4.6 | Activity | Admin → Activity shows the edit by field name only | As `admin@`, `/portal/admin/activity`. Read the newest row's text; scan `document.body.innerText` for the number in any form. Then `q "$R0"` | Newest row contains `Edited profile of`, `Local Tutor` and `Fields: phone` (record the exact text). The page text matches **none** of `355504321`, `5550 4321`, `5550-4321`, `+61355504321`, `(03) 5550`; no `tel:` link on the page | D |
| E-56 | 4.6 | Admin: invalid and blank | The admin form has the same rules | As `admin@` on Local Tutor's page: type `abc`, Save; clear the field, Save. Count PATCHes; `ph` | `abc`: the invalid message (E-47 text) on the field. Blank: the required message (E-48 text). PATCHes **0**; DB `+61400000000` | D |
| E-57 | 4.6 | Admin: own page and other admin | Own staff page writes no audit row; another admin's writes one | `aud` → N. As `admin@`: open own staff page (`/portal/admin/staff/$ADM`, title has the "you" marker), save `0491 570 156`; `aud`. Then open New Admin's page, save `0491 570 157`; `aud`; `lastaud`. Then `q "$R0"` | Own page: saved, audit still **N**. New Admin: saved, **N + 1**, target `$NADM`, `{"fields": ["phone"]}`. List shows both new numbers before the restore | D |
| E-58 | 4.6 | Admin: deactivated and invited rows | The admin can correct a deactivated tutor's phone; the invited row shows in the list (X3) | As `admin@`: list → Inactive Tutor's Phone cell; open it; save `(07) 5550 1234`; read the header link. List → "Item Four Invitee"'s Phone cell (E-29 set it). Then `q "$R0"` | Inactive Tutor: form shown, "Profile saved.", link `tel:+61755501234`. Invitee cell `0491 570 110`. (Before E-29 it would be `—`; record nothing else.) Keep X3 | D |
| E-59 | 4.7 | Deactivated while on the page | A tutor deactivated while My profile is open can't save a phone (X2) | As `tutor@`, open `/portal/profile`. Apply X2 (as `admin-aal2`, through `as.mjs` → `account-admin` `set-active`). In the open page, type `0491 570 156`, Save. Read the alert or redirect; `ph`. Restore X2 | Either the existing FormAlert `Your changes weren't saved. Please try again.` (RLS returned 0 rows), or a redirect to `/portal/login` (record which). **No** "Profile saved."; DB `+61400000000`. Console errors **0**: any line fails. Record whether it was the alert or the redirect | D |
| E-60 | 4.7 | Permissions (UI) | The phone pages are closed to everyone they're not for | Separate legs, each a fresh context: signed out → `/portal/profile` and `/portal/admin/staff/$TUT`; `tutor@` → `/portal/admin/staff` and `/portal/admin/staff/$ADM`; `student@` and `parent@` → `/portal/profile` and `/portal/admin/staff/$TUT`; `newadmin@` → `/portal/admin/staff/$TUT`; `admin@` → `/portal/admin/staff/$STU` (a family id); `tutor@`, `student@` and `parent@` → `/portal/admin/activity`. For each: final URL, `h1`, `#profile-phone` count, any staff number (any form of `+61400000000`) in the DOM or in any `127.0.0.1:55321` response body, every 4xx response | Signed out: `/portal/login?next=…`. Tutor, student, parent: "You don't have access to this page". `newadmin@`: the two-step set-up screen. `admin@` on a family id: the not-found panel. `#profile-phone` count **0** everywhere; staff number **0** everywhere; **0** 4xx responses, console errors **0**, hosted **0** on every leg. Ruling 2: strict. `1996c62` added the role pre-check (dev notes §7), so the only request a wrong-role leg may send is the layout's own access read (`profiles?select=full_name,role,is_active`, 200). Any other request to `:55321` on a wrong-role leg fails, even with a 200 | D |
| E-61 | 4.7 (regr.) | Onboarding with a phone | The invitee finishes setup with their own number; it wins over the admin's; they can then change it (X3) | In X3's invitee context on `/portal/join`: name "Item Four Invitee", phone `0491 570 157`, password, terms, Finish setup. `q "select status, phone from public.profiles where id='$INV'"`. Sign in as the invitee; `/portal/profile`; read the field; save `0491 570 158`; `aud` before and after | Join completes, leaves `/portal/join`. `active\|+61491570157` (the invitee's number replaced the admin's `+61491570110`). My profile shows `0491 570 157`; the change saves (`+61491570158`); audit delta **0** (self-edit). Keep X3 for E-90 | D, DB |
| E-62 | Regr. (T4.12) | Profile photo | The photo still uploads and removes, alongside a phone change; the admin photo audit still works (X7) | `aud` → N. As `tutor@` on My profile: Choose a photo (`$SCR/avatar.png`), "Use this photo"; read the `img` alt and `src`. Change the phone to `0491 570 156`, Save, reload; read the `img` again. Remove the photo. As `admin@` on Local Tutor's page: upload the photo, then remove it. `aud`; the last 2 rows' details. Then `q "$R0"` | Upload: `img` alt `Photo of Local Tutor`. After the phone save and reload: the same photo still shown, phone `0491 570 156`. Remove: "No photo yet". Admin upload and remove: **N + 2**, each `{"fields": ["avatar_path"]}`. Avatar object count back to the snapshot's | D |
| E-63 | Regr. (audit body copy) | Other profile fields | An admin's edit of name, subjects, bio and qualifications is still audited by name, and saved | `aud` → N. As `admin@` on Local Tutor's page: change Full name, one subject, Bio and one qualification; Save; reload; read the fields. `aud`; `lastaud`. Restore the row by SQL | Saved and still there after reload. **N + 1**, details exactly `{"fields": ["full_name", "bio", "qualifications", "subjects"]}` (the function's order). No `phone` in the list (it didn't change) | D |
| E-64 | Regr. | Sign-in after a change | A phone change doesn't disturb sign-in | As `tutor@`: save `0491 570 159`; sign out; sign in; `/portal/profile`; read the field. Then `q "$R0"` | Signs in to the staff home; field `0491 570 159` | D |

### Phase 4 — UI matrix and device

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-70 | 4.10 | UI: tutor | My profile at 1280 and 360 px, light and dark (4 legs) | As `tutor@`, per leg (1280 × 800 light, 1280 × 800 dark, 360 × 780 light, 360 × 780 dark; theme set through Account → Appearance): open `/portal/profile`. Measure the field: overflow; `#profile-phone` box inside the viewport; contrast of label, typed text (on the input's own background), hint. Type `abc`, Save; measure the error's contrast and lines; hint lines. Screenshot the field area to `$EVD/E-70-<w>-<theme>.png`. Then reset Appearance to "Same as this device" | Every leg: overflow **0**; field fully inside the viewport (`left ≥ 0`, `right ≤ innerWidth`); `type="tel"`. Contrast **≥ 4.5:1** for label, typed text, hint and error, in both themes. Lines: at 1280, hint ≤ 2 and error 1; at 360, hint ≤ 3 (O2) and error ≤ 2. 1 `h1`. Console errors 0, hosted 0 | D |
| E-71 | 4.10 | UI: admin | Admin → Staff → Local Tutor at 1280 and 360 px, light and dark (4 legs) | As `admin@`, `/portal/admin/staff/$TUT`, the same four legs and measurements as E-70, plus the header's `tel:` link contrast. Screenshots `$EVD/E-71-<w>-<theme>.png`. Reset Appearance | Same thresholds as E-70 on every leg, plus link contrast ≥ 4.5:1. Overflow **0** at 360 in both themes. Console errors 0, hosted 0 | D |
| E-72 | 4.10 | Phone keypad | Tapping the phone field opens the phone keypad on a real Android browser | 1. `~/Library/Android/sdk/emulator/emulator -avd AJ_Test_Phone -no-window -no-audio &`; `adb wait-for-device`; wait for `sys.boot_completed` = 1. 2. `adb reverse tcp:5173 tcp:5173`; `adb reverse tcp:55321 tcp:55321`. 3. Drive Chrome on the device: Playwright `_android` (`device.launchBrowser()`), or, if that isn't allowed, `adb forward tcp:9222 localabstract:chrome_devtools_remote` and `chromium.connectOverCDP('http://localhost:9222')`. Attach the console, `pageerror` and hosted counters. 4. As `tutor@`: `/portal/profile`; tap `#profile-phone`; `adb shell dumpsys input_method \| grep -E 'mInputShown\|inputType'`; `adb exec-out screencap -p > $EVD/E-72-tutor.png`. 5. As `admin@` (two-step entered by D): `/portal/admin/staff/$TUT`; the same. 6. `adb reverse --remove-all`; stop the emulator | Both pages: `mInputShown=true` and the focused editor's `inputType=0x3` (`TYPE_CLASS_PHONE`). The screenshots show the phone keypad. Viewport width recorded (the device's CSS width); overflow **0**. Console errors 0, hosted 0. **If the emulator can't boot or Chrome can't be driven: BLOCKED**, and the lead asks Saurabh before the gate to do this by hand: on his phone (or Chrome DevTools device mode with "Show virtual keyboard"), open My profile and an admin staff page, tap the phone field, and confirm the number pad opens | A, D |

### Phase 5 — exposure and Privacy on the build

Stop **D** first (`lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill`). Apply **X6**, then rebuild
with the §1 exports and **without** `VITE_LOCAL_ADMIN_TWO_STEP_KEY`:
`env -u VITE_LOCAL_ADMIN_TWO_STEP_KEY VITE_APP_ENV=production pnpm build` (from the root). Re-run
E-05's four greps on this build. Start **P** as in item 3 §1 (Vercel mirror config from item 1's
`jq` line, `pnpm exec serve --config "$SCR/serve-like-vercel.json" -l 4173 --no-clipboard` from
`apps/web`). Vercel Analytics stand-in for console counts as item 1 (`/_vercel/insights/*` answered
with an empty `200` script).

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-80 | 4.8 | Build grep (D2) | No stored staff number, in any form, is in the build | Build the pattern **from the database at grep time**, not by hand: `q "select distinct phone from public.profiles where phone is not null"` (after X6: `+61491570156`, `+61255501234`, `+61400000000`). For each `+61NNNNNNNNN`, add: `+61NNNNNNNNN`, `61NNNNNNNNN`, `0NNNNNNNNN`, `NNNNNNNNN`, the `formatPhone` form (`0491 570 156` / `(02) 5550 1234` / `0400 000 000`), the same with hyphens, and `+61 N…` spaced as typed in this plan. Write them to `$SCR/staff-phones.txt`, one per line; `grep -rlF -f $SCR/staff-phones.txt apps/web/build/client \| tee $SCR/E-80-hits.txt \| wc -l`. Separately: `grep -rhoE '.{0,40}0412 345 678.{0,10}' apps/web/build/client \| sort -u` | The pattern file has **≥ 21 lines** (3 numbers × 7 forms), and **none** of them is `0412 345 678` or a form of `+61412345678`. Hits **0 files** (prerendered `.html`, `.data` and JS included). The `0412 345 678` scan shows only the error-text example (`…phone number, like 0412 345 678.`); any other context fails. If a hit is a non-phone numeric literal, quote 40 characters of context in the TSR; it still counts as a hit to be ruled on by the lead | P build |
| E-81 | 4.8 | Code grep | No profile phone in public services, the sitemap or SEO code | `grep -rn "phone" apps/web/src/services/public-*.ts apps/web/src/services/*.client.ts apps/web/src/routes/sitemap* apps/web/src/lib/seo.ts`; `grep -rn "phone" apps/web/src/services/family-client.ts apps/web/src/services/*family* 2>/dev/null` | First grep: only `leads.client.ts` (the enquiry form's own field) and `seo.ts`'s `BUSINESS.phone` (`telephone`). Second: **0** lines (no family service reads a phone) | — |
| E-82 | 4.8 | JSON-LD | The only `telephone` on public pages is the business number | For every `.html` file under `apps/web/build/client`: extract every `<script type="application/ld+json">` block; `jq` every `telephone` value | Every value equals `+61 469 800 685` (`BUSINESS.phone`); count of other values **0** | P build |
| E-83 | 4.8 | Network exposure | Family pages and public pages never receive a staff phone | On **D** (restart it for this case, then stop it): as `student@` open home, an assignment, timetable, Account; as `parent@` open home, each child, a child assignment, Account; signed out open `/`, `/privacy`, `/portal/login`. Keep every `127.0.0.1:55321` response body. Search all bodies for every line of `$SCR/staff-phones.txt` | Matches **0** across all bodies (record the response count searched, ≥ 10). Console errors 0, hosted 0 on every leg | D |
| E-84 | 4.9 | Privacy page | `/privacy` has the new heading and the exact staff sentence | On **P** and on **D**, `/privacy` at 1280: `h2` texts; `document.body.innerText` checks; `lastUpdated` line; `h1` count; `<meta name="robots">` count | `h2` "Portal accounts" exactly **1**; "Student and parent portal accounts" **0**; all `h2` texts unique. The "Portal accounts" section contains exactly once (ruling 3, post-S3 B17 draft): `For tutors and other staff we also keep a phone number, given at account setup or added later on My profile, and kept up to date by them or an admin. We use it to contact them about classes; only they and AJ Classes admins can see it, and it is never published.` The old wording (`given when they set up their account`, `only AJ Classes admins can see it`) is found **0** times. It sits right after `For each account we keep your name, email address and sign-in times.` The rest of the section is unchanged from `develop` (diff of the `text` with the sentence removed is empty). `Last updated: October 2026` (D3). 1 `h1`; 1 robots meta; console errors 0, hosted 0 | P, D |
| E-85 | 4.9 | Privacy in the build | The prerendered HTML has the sentence and not the old heading | `grep -c 'For tutors and other staff we also keep a phone number' apps/web/build/client/privacy/index.html`; `grep -rl 'Student and parent portal accounts' apps/web/build/client \| wc -l`; `curl -s http://localhost:4173/privacy \| grep -c 'Portal accounts'` | `1`; `0`; `≥ 1`. Also `grep -c 'given at account setup or added later on My profile' apps/web/build/client/privacy/index.html` = `1`, and `grep -rl 'given when they set up their account' apps/web/build/client \| wc -l` = `0` | P |
| E-86 | 4.9 | No draft marker | This branch adds no draft, approval, TBC or TODO text to `PRIVACY`; approval is tracked in the docs | `git diff develop...HEAD -- apps/web/src/constants/content.constants.ts \| grep -E '^\+' \| grep -ciE 'draft\|approv\|review\|\[TBC\|TODO'`; `grep -rc '\[TBC' apps/web/build/client \| grep -v ':0' \| wc -l`; `grep -nE 'B17\|Q7' docs/delivery/2026-10-25-pending-requirements/04b-plan-items-4-8.md \| grep -ci 'item 4\|privacy'` | `0`; `0`; `≥ 1` | P build |
| E-87 | Regr. (addendum) | Public sweep | Every sitemap URL at 375 and 1280 px | For every `<loc>` in `apps/web/build/client/sitemap.xml`, mapped to `http://localhost:4173`: open at 375 × 812 and 1280 × 800. Also `cat apps/web/build/client/robots.txt` | Every URL: **200**; console errors 0; overflow 0; exactly 1 `h1`; exactly 1 robots meta; hosted 0. `robots.txt` has the production rules (`Disallow: /portal`, the `Sitemap:` line). Record the URL count | P |

### Phase 6 — close-out

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-90 | All | Data restore | The local data is back to the seed | Restore X6 (`q "$R0"`). Delete X3 and X8 as the E2E spec's cleanup (audit rows by `actor_id` or `target_id`, `profiles`, `auth.users`). Re-run E-02 step 4 into `$SCR/snapshot-end.txt`; `diff $SCR/snapshot-start.txt $SCR/snapshot-end.txt`; `q "select count(*) from public.profiles where email like 'e2e-%'"`; `q "select banned_until > now() from auth.users where email='inactive@local.test'"`; `q "select is_active from public.profiles where email='tutor@local.test'"`; stop D and P; stop the emulator | `diff` empty (phones, names, bios, photos, flags, students' consent and accounts, guardian count, both ban states); `e2e-%` **0**; `t`; `t`; ports 5173 and 4173 free | DB |
| E-91 | §0.3, all | Console and hosted total | Every browser leg was clean | Sum the harness counters over every leg of E-22, E-23, E-40 to E-87, E-94 and E-95 (list the legs and their counts in the TSR) | Console errors **0** and `pageerror` **0** on every leg, except the pre-declared A1 (E-42, 1 line) and A2 (E-51, 2 lines; E-53, 1 line). Hosted (`supabase.co`) requests **0** in total | D, P, A |

### Phase 7 — Security S1 (added before freeze; run after phase 2, before phase 3)

S1 (`06-security-item-4.md`): someone with only an admin's password gets an aal1 session, changes
the admin's own phone with no audit row, then asks for a factor reset, and the identity call goes
to their number. The fix makes `check_profile_phone()` raise `insufficient_aal` when an admin
changes their own phone without aal2. Invited accounts are exempt, so onboarding still works.
These cases run in **phase 2's slot** (they need no browser, except E-94 and E-95), but keep their
IDs. Restore every phone with `q "$R0"`.

| Fixture | What | Applied right before | Restored by |
|---|---|---|---|
| X8 | Invited, unfinished admin `e2e-item4-adm@local.test` ("Item Four Admin"): the real admin UI invite (as X3), then `q "update public.profiles set role='admin' where email='e2e-item4-adm@local.test'"` (superuser, because the role control only shows for joined staff) | E-95 | E-95 last step: delete as X3 |

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-92 | S1, 4.7 | aal1 admin, own phone | An admin without two-step can't change their own phone through the API | `aud` → N. 1. `pp admin-aal1 $ADM '"0491 570 156"'`; `ph admin@local.test`. 2. As `newadmin@` (no authenticator, so aal1 is all it can get): `pp newadmin@local.test $NADM '"0491 570 157"'`; `ph newadmin@local.test`. 3. `pp admin-aal1 $ADM '"03 5550 4321"'`. 4. `aud`. 6. `node $SCR/as.mjs admin-aal1 PATCH "/rest/v1/profiles?id=eq.$ADM&select=id,phone" '{"bio":"aal1 bio","phone":"0400 000 000"}'` (the form re-sends the stored number in display format); then restore the bio by SQL. 5. Record only: `node $SCR/as.mjs admin-aal1 PATCH "/rest/v1/profiles?id=eq.$ADM&select=id,full_name" '{"full_name":"Local Admin B"}'`, then restore the name by SQL (security residual 1: aal1 own-row edits of other fields are pre-existing and accepted) | 1–3: each **400** with message `insufficient_aal`; **never 200**, never 500. `admin@` and `newadmin@` both still `+61400000000`. 4: audit still **N**. 5: status and body recorded in the TSR, not pass/fail; name restored. 6: **200** with `+61400000000` (the same number after normalising isn't a change); bio restored | DB |
| E-93 | S1, 4.6 | aal2 admin, own phone | With two-step, the same change succeeds | `aud` → N. `pp admin-aal2 $ADM '"0491 570 156"'`; `ph admin@local.test`; `aud`. Then `q "$R0"` | **200**, `+61491570156`; audit still **N** (a self-edit) | DB |
| E-94 | S1, 4.6 | Fix doesn't block real paths | The aal2 admin's UI saves still work, and the aal1 admin can't reach the form | 1. As `admin@` on D (two-step entered): `/portal/profile`, save `0491 570 157`; then `/portal/admin/staff/$ADM`, save `0491 570 158`. Read the status each time; `ph admin@local.test`. 2. As `newadmin@`: open `/portal/profile`; read the URL, `h1` and `#profile-phone` count. Then `q "$R0"` | 1: "Profile saved." both times, no field error; `+61491570158`. 2: the two-step set-up screen, `#profile-phone` count **0**. Console errors 0 and hosted 0 on both legs (strict; a refused `profiles` request fails) | D |
| E-95 | S1, 4.7 (regr.) | Invited admin onboarding | An invited admin still finishes setup with a phone at aal1 (X8) | Apply X8; read the invitee's token `TA` from `localStorage` after "Continue". 1. Before setup: `pp "token:$TA" $ADM8 '"0491 570 156"'` (`ADM8` = its id); then `pp admin-aal2 $ADM8 '"0491 570 110"'`; `q "select status, coalesce(phone,'null') from public.profiles where id='$ADM8'"`. 2. On `/portal/join`: name, phone `0491 570 159`, password `e2e-item4-password-123`, terms, Finish setup. `q "select role, status, phone from public.profiles where id='$ADM8'"`. 3. After joining, at aal1 (password sign-in, no factor yet): `pp "token:$(node $SCR/token.mjs e2e-item4-adm@local.test e2e-item4-password-123)" $ADM8 '"0491 570 157"'` (the password typed in step 2); `ph e2e-item4-adm@local.test`. Restore X8 | 1: own token **200 `[]`** (RLS: not active staff). aal2 admin **200** with `+61491570110` (rolled-back probe; see "Lines changed" 4). Row `invited\|+61491570110`. 2: join completes, with no `insufficient_aal` error shown; `admin\|active\|+61491570159` (the invitee's number wins). Next screen recorded (the two-step set-up screen is expected for a new admin). 3: **400** `insufficient_aal`; phone still `+61491570159`. Console errors 0, hosted 0. After the restore, the count of `e2e-item4-adm@` rows is 0 | D, DB |
| E-96 | S1 (c) | Runbook and pgTAP | The break-glass runbook no longer trusts the profile phone; pgTAP covers both levels | `grep -n 'Break-glass' docs/requirements/release-2/r2a/design.md`; on that line: `grep -c 'a number held outside the portal'` and `grep -c 'never the phone on their portal profile'`; `grep -cE 'insufficient_aal' supabase/tests/database/staff_phone.test.sql`; `grep -c 'insufficient_aal' supabase/migrations/20261026100000_staff_phone_edit.sql`; `ls supabase/migrations \| tail -1`; `grep -c 'a number held outside the portal' supabase/README.md`; `grep -c 'Never use the phone on their portal profile' supabase/README.md` | The break-glass line (§16.3, item 3, around line 643) says to confirm identity by calling a number held outside the portal, never the portal profile phone: both counts **1**. pgTAP mentions `insufficient_aal` **≥ 1** time, and E-04 shows `staff_phone.test.sql` passing (it must hold the aal1 refusal and the aal2 success). The migration raises it: **≥ 1**, and it's still the newest file (`20261026100000_staff_phone_edit.sql`; no second migration). `supabase/README.md`: **1** and **1** | — |

---

## 3. AC → case map

| AC | Cases |
|---|---|
| 4.1 Field on My profile (label, pre-fill, hint) | E-43, E-44, E-49, E-54 (admin page pre-fill) |
| 4.2 Accepted formats, stored `+61…`, reload | E-10, E-13, E-45, E-46, E-61, E-64 |
| 4.3 Invalid input (browser and server) | E-11, E-14, E-47, E-51, E-56 |
| 4.4 Blank: can't clear; no-phone staff still save | E-12, E-13, E-48, E-49, E-51, E-56 |
| 4.5 Save behaviour, edits survive a phone error | E-14, E-45, E-50, E-51, E-52, E-53 |
| 4.6 Admin correction, list, tap-to-call, audit without digits | E-24 to E-29, E-32, E-54 to E-58, E-62, E-63 |
| 4.7 Permissions (tutor, families, deactivated, invited, aal1, signed out, ungranted columns, onboarding) | E-06, E-15 to E-23, E-30, E-32, E-59, E-60, E-61 |
| 4.8 Not exposed anywhere new | E-05, E-31, E-55, E-60, E-80 to E-83 |
| 4.9 Privacy (heading, exact text, no draft marker) | E-84, E-85, E-86 (B17 is Saurabh's, "For Saurabh" 1; ruling 3) |
| Security S1 (aal1 admin can't change their own phone; break-glass runbook) | E-92 to E-96 |
| 4.10 360 px, keypad, light and dark, admin page too | E-43, E-70, E-71, E-72 |
| Smoke and sign-in | E-40, E-41, E-42, E-64 |
| Regression (onboarding, admin staff list, photo, other fields, public pages) | E-06, E-23, E-54, E-58, E-61, E-62, E-63, E-87 |
| Safety, console and hosted | E-01 to E-05, E-91 |

**Total: 75 cases** (phase 0: 3, phase 1: 6, phase 2: 23, phase 3: 25, phase 4: 3, phase 5: 8,
phase 6: 2, phase 7: 5). The TSR's pass rate counts every case; BLOCKED counts as not passed.

## 4. Not covered by this plan

1. **The hosted migration** (`20261026100000_staff_phone_edit.sql`) and the live Privacy check are
   Saurabh's release steps (03b §4.8, dev notes §6). They're never run from here.
2. **Screen-reader output.** The `aria-describedby` links are measured (E-43, E-47); listening with
   VoiceOver isn't part of the gate.
3. **iOS Safari.** The keypad is checked on Android Chrome (E-72). The `type="tel"` attribute is
   the same signal for iOS, but no iOS device is driven.
4. **Held item 2's merge** (the `PRIVACY` text conflict) is tested when item 2 is rebased (T2.15),
   not here.
