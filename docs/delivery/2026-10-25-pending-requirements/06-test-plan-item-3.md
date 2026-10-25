# 06 — Test plan: item 3 ("Work returned" email)

> **Stage:** 6a of /deliver (Tester) · **Date:** 25 Oct 2026 · **Branch:** `feature/work-returned-email`
> **Input:** [01-requirement.md](01-requirement.md) item 3 (AC-3.1 to AC-3.11; AC-3.8 as reworded
> in the change log), [03-design.md](03-design.md) §0.3 and §3 (incl. §3.10),
> [04-plan.md](04-plan.md) §4, §6.3 and §8, [05-dev-notes-item-3.md](05-dev-notes-item-3.md),
> [06-test-plan-item-1.md](06-test-plan-item-1.md) (format, N-01 guard),
> `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-3.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/work-returned-email` HEAD at freeze time. It must be a
descendant of the Developer's fix commit for `review-5-item-3.md` and `06-security-item-3.md`.
That SHA is **`FIX=716c283`** (05 §8, round 1 and round 2 fixes).
`git merge-base --is-ancestor 716c283 HEAD` must exit 0, or the run doesn't start. Record both
SHAs in the TSR. Cases E-92 to E-105 test those fixes.

**`[ASSUMPTION]` AC-3.5 90-day limit (team lead, 01 change log, 25 Oct 2026).** "At most one email
per person per assignment" holds while the outbox row exists. The daily `daily-history-trim` job
(`private.trim_history()`) deletes finished rows (`sent`, `skipped`, `failed`) after 90 days, so a
re-return more than 90 days later may send one more email. Every AC-3.5 case (E-18, E-23, E-41,
E-43, E-44) runs well inside 90 days, so it expects exactly one email. E-105 tests the limit
itself.

**`[ASSUMPTION]` AC-3.6 ruling (team lead, 25 Oct 2026).** "Every email has a link to this page"
passes if:
- a **signed-in** user following the footer link lands on the switch (`#notifications` in view);
- a **signed-out** user lands on Account after sign-in. The top of the page is fine.

Keeping the `#hash` through sign-in is on the Later list (04 §7). E-34 and E-101 test this
ruling.

**Hard rules for this run.**
1. **Local stack only.** The hosted project (`unzjnxctkyahtmrkinyr`) is never read or written.
   E-01 to E-03 enforce this before anything else runs. If any of them fails, **stop the run**.
2. **Mailpit is the only email transport.** No real `RESEND_API_KEY` exists in this shell or in
   the local edge runtime. `EMAIL_TRANSPORT` is `mailpit` locally, never `resend`.
3. **`supabase/.env.deploy` is never read.** It isn't opened, `cat`-ed, sourced or grepped.
   `deploy.sh` is never run from the repo path, because the script loads that file. It runs only
   as a copy in `$SCR` (E-60 to E-66), and never without fakes on `PATH`. **Never a real deploy.**
4. **Banned commands:** `supabase link`, `db push`, `config push`, `functions deploy`,
   `secrets set|unset|list`, and anything with `--linked` or `--project-ref`.
5. **Secret values are never printed.** Env checks print variable *names* or `SET`/`unset` only.

---

## 1. Set-up (once per terminal, before any build)

```bash
cd ~/dev/work/aj_classes
pnpm db:status                              # stack is already running (05 §7); else pnpm db:start
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from pnpm db:status>
export KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
export SCR=<session scratch dir>
export EVD=$PWD/docs/test-reports/2026-10-25-feature-work-returned-email/evidence
mkdir -p "$EVD"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'
qf() { docker exec -i supabase_db_aj_classes psql -U postgres -At -v ON_ERROR_STOP=1 < "$1"; }  # SQL files ($$ is safe in a file)
MP=http://127.0.0.1:55324
mp_to()    { curl -s "$MP/api/v1/search?query=to:$1" | jq '.messages | length'; }   # emails to one address
mp_total() { curl -s "$MP/api/v1/messages" | jq .total; }
WORKER() { curl -s -o "${2:-$SCR/worker.json}" -w '%{http_code}' -X POST "$VITE_SUPABASE_URL/functions/v1/notifications" \
  -H "apikey: $KEY" -H 'Content-Type: application/json' -H "x-notify-secret: ${1-local-notify-secret}" -d '{}'; }
CRON_OFF="select cron.alter_job(jobid, active := false) from cron.job where jobname = 'email-worker-kick'"
CRON_ON="select cron.alter_job(jobid, active := true) from cron.job where jobname = 'email-worker-kick'"
CRON_STATE="select active from cron.job where jobname = 'email-worker-kick'"

# Ids used below
AARAV=$(q "select id from public.students where full_name='Aarav Demo'")
ISLA=$(q "select id from public.students where full_name='Isla Demo'")
LEO=$(q "select id from public.students where full_name='Leo Demo'")
NOAH=$(q "select id from public.students where full_name='Noah Demo'")
STU=$(q "select id from public.profiles where email='student@local.test'")
PAR=$(q "select id from public.profiles where email='parent@local.test'")
TUT=$(q "select id from public.profiles where email='tutor@local.test'")
for t in 'Reasoning mock test 1:MOCK' 'Word problems set 1:WORD' 'Times tables warm-up:TABLES' \
         'Persuasive writing draft:PERS' 'Fractions practice set 3:FRACP' 'Fractions quick quiz:FRACQ'; do
  export "${t##*:}=$(q "select id from public.assignments where title='${t%%:*}'")"; done
ob() { q "select recipient_role||':'||status||':'||coalesce(reason,'-') from public.email_outbox where assignment_id='$1' order by 1"; }

# Playwright for browser measurements: reuse the E2E repo's install.
ln -sfn ~/dev/work/aj_classes-e2e/node_modules "$SCR/node_modules"
```

**`$SCR/return-mock.sql`** (a staff return of Aarav's paper mock test as `tutor@`, so
`marked_by` is set and the trigger fires). Made once with the ids filled in:

```bash
cat > "$SCR/return-mock.sql" <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$TUT', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.assignment_results set status = 'returned' where assignment_id = '$MOCK' and student_id = '$AARAV';
commit;
SQL
```

Most phase 4 cases make their return through the UI (it's the real path). Where a case says
"return the mock test" and the UI was already proven in E-20, `qf $SCR/return-mock.sql` is an
equal alternative. Always restore X2 first if the row is already `returned`.

**`$SCR/as.mjs`** (REST as one role; prints `status body`). Uses only the local helpers:

```js
// node $SCR/as.mjs <anon|admin-aal1|admin-aal2|<seed email>> <METHOD> <path> [json body]
import { api, signIn, adminTwoStepToken } from '/Users/sjain/dev/work/aj_classes/supabase/scripts/local-test-helpers.mjs';
const [who, method, path, body] = process.argv.slice(2);
let token;
if (who.startsWith('admin-aal')) { const t = await adminTwoStepToken(); token = who === 'admin-aal1' ? t.aal1 : t.aal2; }
else if (who !== 'anon') token = (await signIn(who)).access_token;
const r = await api(path, { method, token, body: body ? JSON.parse(body) : undefined, headers: { Prefer: 'return=representation' } });
console.log(r.status, JSON.stringify(r.json));
```

Servers (names used in the **Env** column):

| Name | What | Start |
|---|---|---|
| **DB** | Local Supabase (`:55321` API, `:55322` DB, `:55323` Studio, `:55324` Mailpit), edge runtime serving `notifications` | Already running (05 §7) |
| **D** | Dev server `http://localhost:5173` | `pnpm dev --port 5173 --strictPort`, with `VITE_LEAD_CAPTURE=on` in `apps/web/.env.development.local` |
| **P** | Production build, Vercel mirror, `http://localhost:4173` | As item 1 §1: `VITE_APP_ENV=production pnpm build`, then from `apps/web`: `pnpm exec serve --config "$SCR/serve-like-vercel.json" -l 4173 --no-clipboard` (mirror config made with item 1's `jq` line) |
| **F** | Fake CLI sandbox for `deploy.sh` (no stack needed) | E-60 |

**Browser measurements** use a throwaway Playwright script in `$SCR` (Chromium; console cleared
before each page). "Console errors" means `console.error` messages plus `pageerror` events.
"Overflow" means `document.documentElement.scrollWidth − clientWidth`. Dark mode is the portal
theme switch on Account → Appearance (not `emulateMedia`), screenshot saved to `$EVD`.

**Known non-bugs for this run** (don't raise):
1. Every `db reset` queues 2 emails (the seed's returned "Number patterns check"). 05 §7 says they
   are already `sent`, and `test-notifications.mjs` drains them anyway.
2. Locally, email links start with `http://localhost:5173` (`SITE_URL` in `config.toml`).
3. The parent email says "Hi Local," (the seed parent is "Local Parent").
4. Signing in drops the `#notifications` hash (`safeNextPath` keeps path and query). A signed-out
   person following the footer link lands at the top of Account (05 D6). That **passes** under the
   AC-3.6 ruling above, and keeping the hash is on the Later list. Signed in, the link scrolls to
   the section.
5. Anonymous `GET /rest/v1/posts?select=*` is refused (`permission denied`): visitors now have
   column grants only. The public client always names its columns (item 1 N-64).
6. Rows that end `skipped` (recipient switched off or deactivated after the return) are not
   shown on Admin → Emails. That's by design (03 §3.3).
7. Hot reload logs `[react-router:hmr] No module update found` after source edits. Clear the
   console first.
8. While the edge runtime is stopped (E-36), the browser shows no errors, because the browser
   never calls `notifications`. Only cron does.
9. With `EMAIL_TRANSPORT` unset, any caller, even one with no secret or a wrong one, gets **503**
   `config_missing` instead of 401. That's the accepted gate order (05 §8 round 2): it gives away
   only that sending is off, and it claims and sends nothing.
10. A re-return more than 90 days after the first email may send again (the AC-3.5 `[ASSUMPTION]`
    above).

**Seed-data order and fixtures.** Each fixture is applied only right before the case that needs
it and restored right after, so earlier cases run on the seed as 05 §7 left it. E-02 takes a
snapshot. E-90 compares the end state against it.

| Fixture | Applied right before | Restored by |
|---|---|---|
| X1 cron paused (`$CRON_OFF`) | E-30, E-40, E-47, E-49 | Same case's last step (`$CRON_ON`, then `$CRON_STATE` = `t`) |
| X2 Aarav's "Reasoning mock test 1" returned (seed: `marked`, 42) | E-20 | E-23: `q "update public.assignment_results set status='marked' where assignment_id='$MOCK' and student_id='$AARAV'"; q "delete from public.email_outbox where assignment_id='$MOCK'"` |
| X3 "Word problems set 1" returned in the UI | E-24 | E-24 last step: the `restoreSeededWork` SQL from `test-notifications.mjs` (or just re-run `pnpm test:functions`, which restores it) |
| X4 Aarav submits "Times tables warm-up" | E-25 | E-25 last step: `q "delete from public.assignment_answers where assignment_id='$TABLES' and student_id='$AARAV'"; q "delete from public.assignment_results where assignment_id='$TABLES' and student_id='$AARAV'"` |
| X5 Isla, Leo, Noah paper results | E-26 to E-28 | E-28 last step: delete those `assignment_results` rows the case created (`student_id in ('$ISLA','$LEO','$NOAH')` and `assignment_id in ('$FRACP','$PERS')`), and every outbox row for them |
| X6 HTML-title assignment | E-29 | E-29 last step: delete the assignment (cascades results and outbox) |
| X7 family fixtures: second parent for Aarav (`e2e-item3-p2@local.test`), parent for Isla (`e2e-item3-isla@local.test`), invited student for Noah (`e2e-item3-noah@local.test`), Noah's consent | E-40 | E-46: `q "delete from auth.users where email like 'e2e-item3-%@local.test'"`; `q "update public.students set profile_id=null, consent_recorded_at=null, consent_recorded_by=null, consent_source=null where id='$NOAH'"` (check the column list against `\d public.students` first); reactivate `student@` if E-43 left it off |
| X8 Admin → Emails rows (failed, waiting) | E-47 | E-48 last step: delete by the ids saved in `$SCR/x8-ids.txt` |
| X9 cap = 0 (committed) | E-49 | E-49 last step: re-create `private.email_daily_cap()` returning 70; `q "select private.email_daily_cap()"` = 70 |
| X10 `config.toml` without `EMAIL_TRANSPORT` + stack restart | E-50 | E-50 last step: `git checkout -- supabase/config.toml`, restart, `git diff --quiet -- supabase/config.toml` |
| X11 `email-worker-kick` unscheduled (kill switch) | E-52 | E-52 last step: re-schedule; `$CRON_STATE` = `t` |
| X14 3 eligible `pending` rows (`$FRACQ` student and parent, `$TABLES` student) | E-93 (after E-53) | E-93 last step: delete by the ids in `$SCR/x14-ids.txt` |

---

## 2. Cases

Phases run in this order: **0** safety, **1** repo checks, **2** DB and API (no browser), **3**
portal on **D** with seed data, **4** fixtures, **5** `deploy.sh` with fakes, **6** production
build **P**, **7** regression and close-out. Within a phase, run in table order.

### Phase 0 — safety guards (stop the run if any fails)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-01 | §0.3, 3.11 | Safety | Build env, E2E env and shell point at the local stack only (item 1 N-01, extended) | 1. `echo $VITE_SUPABASE_URL; pnpm db:status \| grep -i publishable`. 2. `grep -E '^(SUPABASE_REST_URL\|PG_HOST\|PG_PORT\|WEB_BASE_URL\|MAILPIT_URL)=' ~/dev/work/aj_classes-e2e/.env`. 3. `grep -c 'supabase.co' ~/dev/work/aj_classes-e2e/.env`. 4. `env \| grep -E '^(SUPABASE_REST_URL\|PG_HOST\|PG_PORT\|WEB_BASE_URL\|MAILPIT_URL)='` (dotenv never overrides shell variables). 5. `env \| cut -d= -f1 \| grep -xE 'RESEND_API_KEY\|EMAIL_TRANSPORT\|NOTIFY_WORKER_SECRET\|SITE_URL\|SUPABASE_ACCESS_TOKEN\|SUPABASE_DB_PASSWORD\|TURNSTILE_SECRET\|ZOHO_[A-Z_]+'` (names only, never values). 6. `cat supabase/.temp/project-ref 2>/dev/null \| wc -c` (only the size, to know whether the CLI is linked; banned commands stay banned either way) | 1: URL exactly `http://127.0.0.1:55321`; exported key equals the `db:status` key. 2: `SUPABASE_REST_URL=http://127.0.0.1:55321`; `PG_HOST` is `127.0.0.1` or `localhost`; `PG_PORT=55322`; `WEB_BASE_URL=http://localhost:5173`; `MAILPIT_URL=http://127.0.0.1:55324`. 3: **0**. 4: no output. 5: **no output** (no real Resend key, no `EMAIL_TRANSPORT`, no deploy secret in the shell). 6: recorded. **Any failure: stop the run and report it** | DB |
| E-02 | §0.3, 3.9, 3.11 | Safety | Mailpit is the only transport; local worker settings | 1. `grep -nE '^(EMAIL_TRANSPORT\|MAILPIT_URL\|SITE_URL\|NOTIFY_WORKER_SECRET) =' supabase/config.toml`; `git diff --quiet -- supabase/config.toml; echo $?`. 2. `docker exec supabase_edge_runtime_aj_classes sh -c 'for v in EMAIL_TRANSPORT MAILPIT_URL SITE_URL; do printf "%s=%s\n" $v "$(printenv $v)"; done; [ -z "$RESEND_API_KEY" ] && echo RESEND_API_KEY=unset \|\| echo RESEND_API_KEY=SET'`. 3. `q "select decrypted_secret from vault.decrypted_secrets where name='notify_worker_url'"`. 4. `curl -s $MP/api/v1/webui \| jq '.MessageRelay.Enabled // false'`. 5. Snapshot: `q "select 'profiles',count(*) from public.profiles union all select 'guardians',count(*) from public.student_guardians union all select 'settings',count(*) from public.notification_settings union all select 'outbox_'\|\|status,count(*) from public.email_outbox group by status union all select 'posts',count(*) from public.posts" > $SCR/snapshot-start.txt`; `q "select a.title\|\|':'\|\|r.status from public.assignment_results r join public.assignments a on a.id=r.assignment_id where r.student_id='$AARAV' order by 1" >> $SCR/snapshot-start.txt`; `q "$CRON_STATE"` | 1: `EMAIL_TRANSPORT = "mailpit"`, `MAILPIT_URL = "http://supabase_inbucket_aj_classes:8025"`, `SITE_URL = "http://localhost:5173"`, `NOTIFY_WORKER_SECRET = "local-notify-secret"`; exit `0`. 2: `EMAIL_TRANSPORT=mailpit`, the same Mailpit URL, `SITE_URL=http://localhost:5173`, `RESEND_API_KEY=unset`. (If the container doesn't expose them as env, record that and rely on step 1.) 3: `http://supabase_kong_aj_classes:8000/functions/v1/notifications`. 4: `false` (Mailpit never relays). 5: snapshot saved; outbox has 2 `sent` and nothing else; settings 0; posts 1; "Word problems set 1:submitted", "Reasoning mock test 1:marked"; cron `t`. **Any failure in 1–4: stop the run** | DB |
| E-03 | §0.3 | Safety | `.env.deploy` untouched and ignored; banned commands absent from this plan's run log | `git check-ignore -q supabase/.env.deploy; echo $?` (doesn't open the file). At close-out: `grep -nE 'env\.deploy\|db push\|config push\|functions deploy\|secrets (set\|unset\|list)\|--linked\|supabase link' <the TSR's command log>` | `0` (ignored). The command log has no line that reads `.env.deploy` or runs a banned command outside the `$SCR` fake sandbox (E-60 to E-66) | — |

### Phase 1 — repo checks

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-04 | DoD 3 | Full check | Repo full check | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions` | Every step exit 0. Lint 0 problems. `pnpm test` 0 failed, **≥ 47 files / ≥ 352 tests**. `db:test` 0 failed, **≥ 13 files / ≥ 450 tests**, `email_outbox.test.sql` and `posts.test.sql` listed. `test:functions` **≥ 169 `ok`, 0 `NOT OK`**, notifications **≥ 90** (05 §8 round 2 counts at `716c283`). Fewer means a test was dropped: fail. Record the counts | DB |
| E-05 | 3.1–3.11 | Script | Notifications script on its own; cron restored | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-notifications.mjs; echo exit=$?`; then `q "$CRON_STATE"`; `q "select status from public.assignment_results where assignment_id='$WORD' and student_id='$AARAV'"`; `ob $WORD` | Prints the recovery command before the end-to-end part; every line `ok`; `exit=0`; cron `t`; status `submitted`; `ob` empty (D11 restore) | DB |
| E-06 | 1.12 (regr.) | Bundle | Item 1 bundle check | From `apps/web`, the 03 §1.6 bundle script verbatim | Output exactly `done`; `$SB` and `$MUI` non-empty | P build |
| E-07 | 3.9 | Scope guard | Auth templates and hosting config untouched | `git diff develop..HEAD --stat -- supabase/templates apps/web/vercel.json apps/web/serve.railway.json` | Empty output | — |
| E-08 | 3.9 | Wording | No `[TBC`/TODO markers shipped | `grep -rc '\[TBC' apps/web/build/client \| grep -v ':0' \| wc -l`; `git diff develop..HEAD -- apps/web/src supabase/functions \| grep -cE '^\+.*TODO'` | Both **0** | P build |

### Phase 2 — DB and API (no browser)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-10 | 3.8 | Permissions | Admin list RPC refused for every non-admin | `for w in anon tutor@local.test student@local.test parent@local.test newadmin@local.test admin-aal1; do echo $w; node $SCR/as.mjs $w POST /rest/v1/rpc/admin_email_problems '{}'; done` | anon **401**; each signed-in non-admin and both aal1 admins **403** (or 400) with `not_admin`/`42501` in the body; 0 rows returned | DB |
| E-11 | 3.8 | Permissions | Admin aal2 gets only the safe columns | `node $SCR/as.mjs admin-aal2 POST /rest/v1/rpc/admin_email_problems '{}'` | **200**, body `[]` (seed rows are all `sent`). Then, once E-47's fixture exists, re-run: each object's keys are exactly `assignment_title, created_at, id, reason, recipient_role, state` (no `email`, no body, no name) | DB |
| E-12 | 3.10 | Permissions | Worker RPCs and outbox closed to clients | As `tutor@`, `student@`, `parent@`, `admin-aal2`: `POST /rest/v1/rpc/notify_claim_emails '{}'`, `POST /rest/v1/rpc/notify_record_result '{"target":"00000000-0000-0000-0000-000000000000","outcome":"sent"}'`, `POST /rest/v1/rpc/notify_flag_config_missing '{}'`, `GET /rest/v1/email_outbox?select=id` | Every call **401/403/404** with a permission error. 0 rows. `q "select count(*) from public.email_outbox"` unchanged | DB |
| E-13 | 3.6, 3.10 | Permissions | Own switch only | 1. `node $SCR/as.mjs parent@local.test POST /rest/v1/notification_settings '{"profile_id":"'$STU'","work_returned":false}'`. 2. As `student@`: `POST … '{"profile_id":"'$STU'","work_returned":false}'`, then as `parent@`: `GET /rest/v1/notification_settings?select=*` and `PATCH /rest/v1/notification_settings?profile_id=eq.$STU '{"work_returned":true}'`. 3. As `student@`: `PATCH …?profile_id=eq.$STU '{"profile_id":"'$PAR'"}'`. 4. As `tutor@`: `GET …?select=*` and `POST … '{"profile_id":"'$TUT'","work_returned":false}'`. 5. Clean up: `q "delete from public.notification_settings"` | 1: **403** (RLS), 0 rows. 2: student insert **201**; parent GET `[]`; parent PATCH **200** with `[]` (0 rows changed); `q "select work_returned from public.notification_settings where profile_id='$STU'"` = `f`. 3: **401/403** (no update grant on `profile_id`). 4: tutor GET `[]`, POST **403**. 5: count 0 | DB |
| E-14 | 3.10 | Permissions | Families can't trigger an email by "returning" work | As `student@` and as `parent@`: `PATCH /rest/v1/assignment_results?assignment_id=eq.$WORD&student_id=eq.$AARAV '{"status":"returned"}'` | Each refused (4xx) or `[]`; `q "select status from public.assignment_results where assignment_id='$WORD' and student_id='$AARAV'"` still `submitted`; `ob $WORD` empty | DB |
| E-15 | 3.5, 3.10 | Permissions | A tutor can't return (or email about) another class's work | `tutor@` doesn't teach the English class (its tutor is `admin@`). Fixture: `q "insert into public.assignment_results(assignment_id, student_id, status) values ('$PERS','$NOAH','submitted')"`. Then `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/assignment_results?assignment_id=eq.$PERS&student_id=eq.$NOAH" '{"status":"returned"}'`; `q "select status from public.assignment_results where assignment_id='$PERS' and student_id='$NOAH'"`; `ob $PERS`. Clean up: delete that result row | PATCH **200 `[]`** or 4xx (0 rows changed); status still `submitted`; `ob` **empty** (`parent@` isn't emailed about Noah). Row deleted afterwards | DB |
| E-16 | 3.7 | Worker | Wrong secret, no secret, GET | `WORKER wrong-secret`; `WORKER ''`; `curl -s -o /dev/null -w '%{http_code}' -H "apikey: $KEY" $VITE_SUPABASE_URL/functions/v1/notifications`; `cat $SCR/worker.json` after each | `401` + `{"ok":false,"code":"not_allowed"}`; `401`; `405`. Outbox unchanged; `mp_total` unchanged | DB |
| E-17 | 3.7 | Worker | README's local "send now" command works as written | Copy the `curl -X POST …/functions/v1/notifications -H 'x-notify-secret: local-notify-secret'` line from `supabase/README.md` verbatim (no `apikey`), add `-s -w ' %{http_code}'` | `200` and `{"ok":true,"data":{"claimed":0,…}}`. If Kong demands `apikey`, raise a docs bug (minor) | DB |
| E-18 | 3.5 | Concurrency | Two worker calls at once send each email once | `$CRON_OFF`; `qf $SCR/return-mock.sql` (§1, a staff return as `tutor@`, committed); `mp_total` → N; `(WORKER local-notify-secret $SCR/w1.json & WORKER local-notify-secret $SCR/w2.json & wait)`; `cat $SCR/w1.json $SCR/w2.json`; then `mp_total`, `ob $MOCK`; restore with X2's SQL; `$CRON_ON` | Exactly **N + 2**; `ob` = `parent:sent:-`, `student:sent:-`; one of `w1.json` / `w2.json` reports `sent: 2` and the other `claimed: 0` (advisory lock); record which. Cron `t` at the end | DB |
| E-19 | 3.7, 3.8 | Cap (24 h rolling) | Cap override inside a rolled-back transaction | `$SCR/cap.sql`: `begin;` `delete from public.email_outbox;` (inside the transaction, rolled back; the seed's and earlier cases' `sent` rows would otherwise already fill a cap of 2) `create or replace function private.email_daily_cap() returns int language sql immutable set search_path='' as 'select 2';` insert 2 `sent` rows for Aarav's student account on two different assignments with `sent_at = now() - interval '23 hours 59 minutes'`; insert 1 `pending` row ("Times tables warm-up", student); `select count(*) from public.notify_claim_emails();` (A); `update` one sent row to `now() - interval '24 hours 1 minute'`; `select count(*) from public.notify_claim_emails();` (B); then re-run with 1 `sent` + 1 `sending` (`claimed_at = now() - interval '1 minute'`) and a fresh pending row (C); `rollback;` → `qf $SCR/cap.sql` | A = **0**; B = **1**; C = **0** (a `sending` row counts). After the run, `q "select private.email_daily_cap()"` = **70** and outbox counts equal the snapshot (rolled back) | DB |
| E-19a | 3.7 | Reclaim | Stale `sending` rows go back or fail | `$SCR/reclaim.sql`: `begin;` insert 3 `sending` rows: attempts 1 claimed 11 min ago (R1), attempts 1 claimed 9 min ago (R2), attempts 3 claimed 11 min ago (R3); `select private.kick_email_worker();` `select status, attempts, coalesce(reason,'-') from public.email_outbox where id in (R1,R2,R3);` then `select public.notify_record_result(R1, 'sent');` (R1 is now `pending`, so the `sending` guard must ignore it); `rollback;` | R1 `pending`, attempts **1**; R2 `sending`, 1; R3 `failed`, 3, `max_attempts`. `notify_record_result` on the now-`pending` R1 changes nothing (still `pending`). Everything rolled back | DB |
| E-19b | 3.8 | No address | Empty address fails the row with `no_address` | `$SCR/noaddr.sql`: `begin;` `update public.profiles set email='' where id='$STU';` (record if a constraint refuses it) insert 1 pending student row; `select count(*) from public.notify_claim_emails();` `select status, reason from public.email_outbox where recipient_id='$STU' and status<>'sent';` `rollback;` | Claim returns **0** rows; the row is `failed` / `no_address`. If `profiles.email` can't be blank, record "unreachable by constraint" (the fix commit adds a pgTAP `no_address` test, checked in E-95) | DB |
| E-19c | 3.7 | Missing Vault secret | Kick does nothing without its secret | `$SCR/novault.sql`: `begin;` insert 1 pending row; `select count(*) from net.http_request_queue;` (A); `delete from vault.secrets where name='notify_worker_secret';` `select private.kick_email_worker();` `select count(*) from net.http_request_queue;` (B); `rollback;` | B = A (no call); row still `pending`; after rollback `q "select count(*) from vault.secrets where name='notify_worker_secret'"` = 1 | DB |
| E-80 | Posts (item 1 carry-over) | Permissions | Anon can't read `author_id` | `curl -s -w ' %{http_code}' "$VITE_SUPABASE_URL/rest/v1/posts?select=author_id" -H "apikey: $KEY"`; same with `select=id,created_at,updated_at,title,body`, `select=id&limit=1`, `select=*` | `author_id`: **401** with `permission denied`. Public columns: **200** with 1 row. `id&limit=1`: **200**. `*`: refused (known non-bug 5) | DB |
| E-81 | Posts | Invalid input | DB refuses spaces-only and padded posts | `q "insert into public.posts(title,body) values ('   ','x')"`; `(E'\t\n','x')`; `('x',E' \r\n ')`; `(' '\|\|repeat('a',120),'x')`; `('x',repeat('b',5000)\|\|' ')`; then `('a','b')` and delete it | First five fail with `check constraint` (**23514**). `('a','b')` succeeds. Post count back to 1 | DB |
| E-82 | Posts | Invalid input | Admin API (aal2) can't publish spaces-only | `node $SCR/as.mjs admin-aal2 POST /rest/v1/posts '{"title":"   ","body":"x"}'` | **400** with `23514`/check violation; count unchanged | DB |

### Phase 3 — portal on the dev server, seed data

Start **D**. Sign-in page `/portal/login`. Seed password: `supabase/seed.sql`.
`q "$CRON_STATE"` = `t` at the start of the phase. Before E-20: `curl -s -X DELETE $MP/api/v1/messages`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-20 | 3.1, 3.3, 3.9 | Paper return | Tutor returns Aarav's paper mock test (X2) | As `tutor@`, open `/portal/assignments/$MOCK`, set Aarav's status from Marked to Returned, save. Then `ob $MOCK`; `WORKER`; `cat $SCR/worker.json`; `mp_to student@local.test`; `mp_to parent@local.test`; `mp_to tutor@local.test`; `mp_to admin@local.test` | UI: saved, no error. `ob` = `parent:pending:-`, `student:pending:-` before the call; worker `200`, `sent: 2`; then both `sent`. Mailpit: student **1**, parent **1**, tutor **0**, admin **0** | D, DB |
| E-21 | 3.3, 3.9 | Content | Both emails say the right things and nothing more | For each message: `curl -s $MP/api/v1/message/<ID> \| jq '{Subject, From, Text, HTML}' > $SCR/msg-<role>.json`; check subject, greeting, body, button, footer; `jq -r .Text \| sed -E 's#https?://[^[:space:]"<]+##g' \| grep -cE '42\|Strong on patterns\|check units'` (URLs stripped first, as `test-notifications.mjs` does: the links carry random UUIDs); same on the HTML with tags removed, then URLs stripped; `jq -r .HTML \| grep -c 'Selective Entry Maths &amp; Reasoning'`; `grep -c '&amp;amp;'` | Student subject `Your work has been marked: Reasoning mock test 1`; parent subject `Aarav's work has been marked: Reasoning mock test 1`. Greeting `Hi Aarav,` / `Hi Local,`. Body names the title and `Selective Entry Maths & Reasoning`, and says the tutor marked it. One "View feedback" link. Footer links to `/portal/account#notifications`. From `AJ Classes <hello@ajclasses.com.au>`. The mark (`42`) and the feedback text: **0** matches in Text and HTML. Class name escaped once (`&amp;` 1, `&amp;amp;` 0). HTML has the `<strong>AJ</strong> Classes` header and `#172554` | DB |
| E-22 | 3.4 | Link round trip | Signed out → sign-in → the right page, for each email | New context, signed out. Open the student email's "View feedback" `href`; record the URL; sign in `student@`; record the final URL and `h1`. Repeat with the parent email and `parent@`. Then, signed in as `parent@`, open the **student's** link; signed in as `tutor@`, open the parent's link | Each link starts `http://localhost:5173`. Signed out → `/portal/login?next=…`. After sign-in: exactly `/portal/student/assignments/$MOCK` and `/portal/parent/children/$AARAV/assignments/$MOCK`; the page shows the assignment title and the mark. Wrong-role opens: no assignment data for the wrong person (access message or redirect to their own home; record which); 0 console errors | D |
| E-23 | 3.5 | Second return | Return again: no second email | As `tutor@`: set Aarav back to Marked, save; then Returned, save. `ob $MOCK`; `WORKER`; `mp_to student@local.test`; `mp_to parent@local.test`. Then restore X2 | `ob` still exactly 2 rows, both `sent`; worker `claimed: 0`; Mailpit still **1** each. (Inside the 90-day `[ASSUMPTION]` window; past 90 days is E-105) | D, DB |
| E-24 | 3.1 | Online return | Tutor returns Aarav's online "Word problems set 1" in the UI (X3) | As `tutor@`, `/portal/assignments/$WORD/students/$AARAV`: mark both written answers, Return. `ob $WORD`; `WORKER`; Mailpit counts. Restore X3 | "Returned…" notice; `ob` 2 rows → both `sent`; Mailpit +1 student, +1 parent | D, DB |
| E-25 | 3.5 | MCQ auto-return | All-multiple-choice work sends nothing (X4) | As `student@`, open "Times tables warm-up", answer and submit. `q "select status, marked_by is null from public.assignment_results where assignment_id='$TABLES' and student_id='$AARAV'"`; `ob $TABLES`; `WORKER`; Mailpit counts. Restore X4 | Status `returned`, `t` (no `marked_by`); `ob` **empty**; Mailpit counts unchanged | D, DB |
| E-26 | 3.2 | No account, no parent | Leo (roster only, no parent) | As `tutor@`, on "Fractions practice set 3" (`$FRACP`), give Leo a mark and set Returned (X5). `ob $FRACP`; admin RPC (E-11 command) | Save succeeds, no error. `ob` **empty**; admin list `[]` (nothing recorded as a failure) | D, DB |
| E-27 | 3.2 | No account, no parent | Isla (roster only, no parent) | Same as E-26 for Isla on `$FRACP` | Same: 0 rows, admin list `[]` | D, DB |
| E-28 | 3.1, 3.2 | No student account, parent active | Noah's English work goes to the parent only | As `admin@` (the English tutor), on "Persuasive writing draft" (`$PERS`), set Noah Returned. `ob $PERS`; `WORKER`; open the parent email | `ob` = exactly `parent:…` (no student row); parent gets **1** email with subject `Noah's work has been marked: Persuasive writing draft` and a link to `/portal/parent/children/$NOAH/assignments/$PERS`. Restore X5 | D, DB |
| E-29 | 3.3 | Escaping | Hostile assignment title is shown as text (X6) | As `tutor@`, create a paper assignment in the maths class titled `<img src=x onerror=alert(1)> & "Q"`, publish, give Aarav a mark, Return. `WORKER`. Open the Mailpit HTML view (`$MP/view/<ID>.html`) with a `dialog` listener; `jq -r .HTML \| grep -c '<img src=x'`; subject from the API | 0 dialogs; raw `<img src=x` count **0**; `&lt;img` present; subject shows the literal text. Delete the assignment (X6) | D, DB |
| E-30 | 3.6 | Switch: student | Account → Notifications for `student@` | `$CRON_OFF`. Sign in `student@`, open `/portal/account`. Read the section; toggle off; Save; reload; sign out and in; read the switch. `q "select work_returned from public.notification_settings where profile_id='$STU'"`. As `tutor@` return the mock test (X2); `ob $MOCK`; `WORKER`; Mailpit counts | Section heading "Notifications", label "Email me when work is marked and returned", switch **on** by default (no row). After Save: "Saved. We'll remember this choice."; DB `f`. After reload and after sign-out/in: **off**. Return queues **parent only** (`ob` has no student row); Mailpit student +0, parent +1 | D, DB |
| E-31 | 3.6 | Switch: student | Turn it back on; second Save is an update | Same session: toggle on, Save, reload. `q "select count(*), bool_and(work_returned) from public.notification_settings where profile_id='$STU'"`. Restore X2; then return the mock test again (fresh, since X2 deleted its rows); `ob $MOCK`; `WORKER`; restore X2; `$CRON_ON` | "Saved…" shown; DB `1\|t` (one row, updated, not a second insert). Return now queues student **and** parent. Cron `t` | D, DB |
| E-32 | 3.6 | Switch: parent | Same for `parent@` (both children) | Sign in `parent@`: section shown, on; off → Save → reload → off; sign out/in → off; back on → Save. Rapid double-click on Save once | Same messages and persistence as E-30/E-31. Double-click: `q "select count(*) from public.notification_settings where profile_id='$PAR'"` = **1**; no error shown | D |
| E-33 | 3.6 | Switch: staff | Not shown to tutor or admin | As `tutor@` and `admin@` on `/portal/account`: `document.querySelectorAll('#notifications').length`; `getByText('Email me when work is marked')` count | **0** and **0** for both; page otherwise unchanged; 0 console errors | D |
| E-34 | 3.6 | Switch: footer deep link | Signed in, the footer link opens on the section | As `student@`, paste the email's footer URL (`…/portal/account#notifications`) into a fresh tab | Section `#notifications` is in the viewport (`getBoundingClientRect().top` between 0 and the viewport height). This is the signed-in half of the AC-3.6 ruling; the signed-out half is E-101 | D |
| E-35 | 3.6 | Error states | Load and save failures are shown, the rest of Account works | Playwright: `page.route('**/rest/v1/notification_settings**', r => r.abort())` before opening `/portal/account` as `student@`; then unroute, reload, and abort only the PATCH/POST on Save | Load failure: a `FormAlert` in the Notifications section; password and appearance sections still render; no switch. Save failure: alert shown, no "Saved…"; 0 uncaught `pageerror` | D |
| E-36 | 3.7 | Never blocks marking | Return with the edge runtime stopped | `docker stop supabase_edge_runtime_aj_classes`. As `tutor@`, return the mock test (X2). `ob $MOCK`. Then `docker start supabase_edge_runtime_aj_classes`, wait for it to answer (`WORKER` returns 200), check Mailpit; restore X2 | Tutor sees the normal saved state, **no** error, 0 console errors. `ob` 2 rows `pending`. After restart, the worker sends both (`sent: 2`) | D, DB |
| E-37 | 3.1 | Real cron leg | Cron delivers without a manual call | Cron active (`$CRON_STATE` `t`). As `tutor@`, return the mock test (X2); note the time; poll `mp_to student@local.test` every 30 s for up to 6 min | Both emails arrive within **≤ 5 min 30 s** (record the seconds); `ob` both `sent`. Restore X2 | D, DB |
| E-38 | 3.8 | Admin page: empty | Admin → Emails with no problems | As `admin@`, from `/portal/admin` click the "Emails" shortcut | URL `/portal/admin/emails`; `h1` "Emails" (exactly 1 `h1`); intro text from `EMAILS_PAGE.intro`; 5 column headers When, Recipient, Assignment, State, Reason; one body row "No failed or waiting emails"; 0 console errors | D |
| E-39 | 3.8 | Permissions (UI) | Non-admins can't open Admin → Emails | Open `/portal/admin/emails` signed out; as `tutor@`; `student@`; `parent@`; `newadmin@` | Signed out → `/portal/login`. Tutor, student, parent: "You don't have access to this page" (or their own home), 0 table rows, no "Emails" heading. `newadmin@` → two-step set-up screen. 0 requests to `rpc/admin_email_problems` that return 200 | D |

### Phase 4 — fixtures (each applied right before its case, restored after)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-40 | 3.1 | Both parents | Apply X7: real invite flow for a second parent | `$CRON_OFF`. As `admin@`, on Aarav's student page (`/portal/admin/students/$AARAV`), invite parent `e2e-item3-p2@local.test`. Take the invite link from Mailpit, finish `/portal/join` (name, phone, password, terms) as the E2E invite spec does. `q "select status, is_active from public.profiles where email='e2e-item3-p2@local.test'"`. Return the mock test as `tutor@`; `ob $MOCK`; `WORKER`; Mailpit counts for all three | Profile `active\|t`. `ob` = 3 rows: `parent`, `parent`, `student`. Worker `sent: 3`; exactly **1** email each to `student@`, `parent@`, `e2e-item3-p2@` | D, DB |
| E-41 | 3.5 | Other children's parents | A parent of another child gets nothing | As `admin@`, invite `e2e-item3-isla@local.test` as Isla's parent and finish the join. Restore X2, return the mock test again; `WORKER`; `mp_to e2e-item3-isla@local.test` | Isla's parent: **0** emails; `ob $MOCK` has no row for them | D, DB |
| E-42 | 3.2 | Invited, not active | Invited student account gets nothing | As `parent@`, give consent for Noah (portal consent prompt). As `admin@`, invite Noah's student account `e2e-item3-noah@local.test`; **don't** finish the join. `q "select status from public.profiles where email='e2e-item3-noah@local.test'"`. As `admin@`, return Noah's "Persuasive writing draft"; `ob $PERS`; `WORKER` | Status `invited`. `ob` = `parent` only; the invite email exists but no "marked" email to `e2e-item3-noah@`; return succeeds; admin list `[]`. Restore X5 rows for Noah | D, DB |
| E-43 | 3.5 | Deactivated student | A deactivated student gets nothing; parents still do | As `admin@`, deactivate `student@` (Aarav's account). Restore X2, return the mock test; `ob $MOCK`; `WORKER`. Then reactivate `student@` and sign in as them | `ob` = 2 parent rows, **no** student row; parents get 1 each, student 0. After reactivation `student@` signs in again | D, DB |
| E-44 | 3.2, 3.5 | Deactivated parent | A deactivated parent gets nothing | As `admin@`, deactivate `e2e-item3-p2@`. Restore X2, return the mock test; `ob $MOCK` | `ob` = `parent` (`parent@`) + `student`; no row for `e2e-item3-p2@` | D, DB |
| E-45 | 3.2 | Everyone switched off | Every recipient off: no email, no failure | `parent@` and `student@` switch off (UI, as E-30). Restore X2, return the mock test; `ob $MOCK`; admin list | `ob` **empty**; return succeeded; admin list `[]`. Switch both back on | D, DB |
| E-46 | 3.2 | Claim-time skip | Switch turned off after the return, before the send | Cron still off. Restore X2; return the mock test (2 or 3 `pending`); then `student@` switches off in the UI; `WORKER`; `ob $MOCK`; admin list. Switch back on. Restore X2. **Restore X7** (SQL in the fixture table); `$CRON_ON` | Student row `skipped`, no student email; parent row(s) `sent`. Admin list `[]` (skipped isn't a problem). After X7 restore: `q "select count(*) from public.profiles where email like 'e2e-item3-%'"` = 0; cron `t` | D, DB |
| E-47 | 3.8 | Admin page: rows | Apply X8: failed and waiting rows, every reason | `$CRON_OFF`. `$SCR/x8.sql` inserts, returning ids into `$SCR/x8-ids.txt`: F1 `failed`/`rejected`, created 30 min ago; W1 `pending`, attempts 0, created 3 h ago; W2 `pending`, attempts 1, `reason='server_error'`, created 4 h ago; W3 `pending`, `reason='config_missing'`, created 5 h ago; W4 `pending`, created 1 h ago; F2 `failed`/`max_attempts`, created 6 h ago (unique key: spread over `$WORD`, `$FRACQ`, `$TABLES`, `$FRACP` × student/parent). As `admin@`, open `/portal/admin/emails`; re-run E-11 | Rows in order **F1, W1, W2, W3, F2** (newest first), W4 absent. State chips: Failed, Waiting, Waiting, Waiting, Failed. Reasons: "Rejected by email service", "Not attempted", "Retrying", "Set-up error", "Gave up after 3 tries". Recipient column Student/Parent as inserted. `document.body.innerText` contains no `@local.test`. E-11 key check passes | D, DB |
| E-48 | 3.8 | UI | Admin → Emails and Account at 375 and 1280, light and dark | With X8 in place, as `admin@`: `/portal/admin/emails` at 375×812 and 1280×800, light then dark. As `student@` and `parent@`: `/portal/account#notifications` at the same four. Screenshots to `$EVD/emails-<w>-<theme>.png`, `$EVD/account-<role>-<w>-<theme>.png` | Overflow **0** on every page (the table scrolls inside its own box at 375); 1 `h1`; 0 console errors; switch label ≤ 2 lines (height ≤ 2 × line-height). Readability and colours: **Saurabh judges** from the screenshots. Then delete X8 by id; `$CRON_ON` | D |
| E-49 | 3.7, 3.8 | Daily limit | Apply X9 (cap 0): waiting rows show "Daily limit" | `$CRON_OFF`. Save `q "select pg_get_functiondef('private.email_daily_cap()'::regprocedure)" > $SCR/cap-def.sql`. `q "create or replace function private.email_daily_cap() returns int language sql immutable set search_path = '' as 'select 0'"`. Insert one pending row created 3 h ago. `WORKER`; admin page. Then restore: run `$SCR/cap-def.sql` via `qf`, check 70, delete the row, `$CRON_ON` | Worker `200`, `claimed: 0`; row still `pending` with attempts 0; admin page reason "Daily limit". After restore: cap **70**; `pg_get_functiondef` equals the saved text; cron `t` | D, DB |
| E-50 | 3.7, §0.3 | Worker without `EMAIL_TRANSPORT` | Apply X10: the worker refuses and flags rows | `$CRON_OFF`. Delete the `EMAIL_TRANSPORT = "mailpit"` line from `supabase/config.toml` (local, temporary). `pnpm db:stop && pnpm db:start`; check the publishable key is unchanged (else re-export). Return the mock test (X2); `WORKER`; `cat $SCR/worker.json`; `q "select status, attempts, reason from public.email_outbox where assignment_id='$MOCK'"`; Mailpit counts; backdate those rows' `created_at` 3 h; admin page. Restore: `git checkout -- supabase/config.toml`; restart; `git diff --quiet -- supabase/config.toml`; `WORKER` | Worker **503** `{"ok":false,"code":"config_missing"}`; rows `pending`, attempts **0**, reason `config_missing`; Mailpit +0; admin page "Waiting / Set-up error". **Never 401 while the transport is unset** (gate order at `716c283`: the transport check runs before the secret check). A 401 here, or rows left without the `config_missing` flag ("Not attempted" instead of "Set-up error"), is a **fail**. E-103 repeats this with no secret and a wrong one inside the same X10 window. After restore: config clean; worker `sent: 2`; restore X2; `$CRON_ON`; cron `t` | D, DB |
| E-51 | 3.7 (R3-1) | Script recovery | Ctrl-C mid-run resumes cron; next run passes | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-notifications.mjs & P=$!; sleep 4; kill -INT $P; wait $P; echo exit=$?`; `q "$CRON_STATE"`. Repeat with `kill -TERM`. Then run the script normally | First: `exit=130`, "Interrupted: the email cron job is active again.", cron `t`. Second: `exit=143`, cron `t`. Normal run: all `ok`, exit 0, "Word problems set 1" back to `submitted`, `ob $WORD` empty. (If `sleep 4` lands before the pause or after the end, adjust the delay and record it; the case needs one interrupt inside the end-to-end part) | DB |
| E-52 | Runbook | Kill switch | Apply X11: README kill switch stops sends; re-enable works | `q "select cron.unschedule('email-worker-kick')"`; return the mock test (X2); wait 6 min; `ob $MOCK`. Re-enable: `q "select cron.schedule('email-worker-kick', '*/5 * * * *', 'select private.kick_email_worker()')"`; wait ≤ 6 min | While unscheduled: rows stay `pending`, Mailpit +0. After re-scheduling: `q "$CRON_STATE"` = `t`, `q "select schedule, command from cron.job where jobname='email-worker-kick'"` equals the migration's; both rows `sent`. Restore X2 | DB |
| E-53 | 3.9 | Email rendering | The email in Mailpit at 375 px (and 320) | Open `$MP/view/<ID>.html` for the E-20 student and parent emails at 375×812 and 320×640, light | Overflow **0** (05 D9); "View feedback" button fully inside the viewport; footer URL wraps. Screenshots `$EVD/email-<role>-<w>.png`. Looks: **Saurabh judges** | DB |

### Phase 5 — `deploy.sh` against fakes (never a real deploy)

Sandbox: `F=$SCR/deploy; mkdir -p $F/repo/supabase/scripts $F/bin; cp supabase/scripts/deploy.sh $F/repo/supabase/scripts/`.
**The copy's `../.env.deploy` is `$F/repo/supabase/.env.deploy`, which must not exist.** The real
`supabase/.env.deploy` is never touched. Fakes: `$F/bin/supabase` appends `"$*"` to `$F/calls.log`
and, for `secrets list`, prints `$F/secrets.json`; `$F/bin/curl` prints `$F/signup.json`. Every
run: `env -i HOME=$F PATH="$F/bin:/usr/bin:/bin" SUPABASE_ACCESS_TOKEN=fake-tok-AAA SUPABASE_DB_PASSWORD=fake-db-BBB TURNSTILE_SECRET=fake-ts-CCC RESEND_API_KEY=re_fake_DDD NOTIFY_WORKER_SECRET=fake-notify-EEE bash $F/repo/supabase/scripts/deploy.sh [--dry-run] > $F/out.txt 2>&1; echo exit=$?`.
`$F/secrets.json` (good): `[{"name":"ALLOWED_ORIGINS","value":"x"},{"name":"EMAIL_TRANSPORT","value":"<sha256 of resend>"},{"name":"SITE_URL","value":"<sha256 of https://ajclasses.com.au>"},{"name":"NOTIFY_WORKER_SECRET","value":"<sha256 of fake-notify-EEE>"},{"name":"RESEND_API_KEY","value":"y"}]`, digests made with `printf %s <v> \| shasum -a 256 \| cut -d' ' -f1`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-60 | §0.3 | Safety | The sandbox can't reach the real CLI or the real secrets file | `bash -n supabase/scripts/deploy.sh; echo $?`; `test ! -e $F/repo/supabase/.env.deploy && echo absent`; `env -i PATH="$F/bin:/usr/bin:/bin" bash -c 'command -v supabase; command -v curl; command -v jq; command -v shasum'` | `0`; `absent`; `supabase` and `curl` resolve to `$F/bin/…`; `jq` and `shasum` to `/usr/bin/…`. **Any other result: skip phase 5 and report** | F |
| E-61 | 3.11 (D10) | Dry run | Steps in order, secrets masked | Dry run (above). `grep -c -E 'fake-db-BBB\|re_fake_DDD\|fake-notify-EEE\|fake-ts-CCC\|fake-tok-AAA' $F/out.txt`; `grep -n '▶' $F/out.txt`; `test -e $F/calls.log && wc -l < $F/calls.log \|\| echo absent` | exit 0. Secret matches **0**. `--password …`, `RESEND_API_KEY=…`, `NOTIFY_WORKER_SECRET=…`, `EMAIL_TRANSPORT=…`, `SITE_URL=…` shown masked. Steps 1/6 to 6/6 in order; step 5 lists `account-admin leads notifications`; a `secrets set` line before one `secrets unset` line that includes `MAILPIT_URL`; the "would check `supabase secrets list -o json`" line; the Vault SQL printed with the `<NOTIFY_WORKER_SECRET>` placeholder. `calls.log` **absent, or 0 lines** (dry run calls nothing) | F |
| E-62 | §0.3 | Local secret refused | `NOTIFY_WORKER_SECRET=local-notify-secret` | Dry run and real-path run with that value | Both exit **1** with "NOTIFY_WORKER_SECRET is the local value…"; `calls.log` 0 lines | F |
| E-63 | 3.11 | Real path, good settings | Digest check passes | `signup.json` = `{"disable_signup":true}`, good `secrets.json`; run without `--dry-run`; `cat $F/calls.log` | exit 0; "Hosted function settings checked: no local values, NOTIFY_WORKER_SECRET as deployed, EMAIL_TRANSPORT=resend, SITE_URL=https://ajclasses.com.au". `calls.log` order: `link`, `config push`, `db push`, 3 × `functions deploy` (last `notifications`), one `secrets set` containing `EMAIL_TRANSPORT=resend` and `SITE_URL=https://ajclasses.com.au`, then one `secrets unset` with `MAILPIT_URL`, then `secrets list`; **no** `secrets set` after the `unset` | F |
| E-64 | 3.11 | Real path, bad settings | Digest check fails correctly | Five runs, one change each to `secrets.json`: (a) add `{"name":"MAILPIT_URL","value":"z"}`; (b) `EMAIL_TRANSPORT` = sha256 of `mailpit`; (c) remove `EMAIL_TRANSPORT`; (d) `SITE_URL` = sha256 of `http://localhost:5173`; (e) `NOTIFY_WORKER_SECRET` = sha256 of `local-notify-secret` | Each exits **1** with its own message: (a) "MAILPIT_URL is still set…", (b) and (c) "EMAIL_TRANSPORT … isn't 'resend'", (d) "SITE_URL on the hosted project isn't https://ajclasses.com.au.", (e) "NOTIFY_WORKER_SECRET on the hosted project isn't the value you deployed (missing, or the local one)." (the pre-flight "…is the local value…" message is E-62's, not this one) | F |
| E-65 | Deploy order | Sign-ups guard | Sign-ups on stops before any table | `signup.json` = `{"disable_signup":false}`; real path | exit **1**, "Sign-ups are still ON"; `calls.log` has `link` and `config push` only (no `db push`, no `functions deploy`, no `secrets`) | F |
| E-66 | §0.3 | Clean-up | Sandbox removed; repo untouched | `rm -rf $F`; `git status --porcelain` | Sandbox gone; `git status` clean apart from the TSR/evidence files | F |

### Phase 6 — production build (P) smoke and public regression

Start **P** (build from E-04).

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-70 | Smoke | Page sweep | Every sitemap URL at 375 and 1280 (item 1 N-57) | `curl -s localhost:4173/sitemap.xml \| grep -o '<loc>[^<]*' \| sed 's#<loc>https://ajclasses.com.au##'`; for each at 375×812 and 1280×800: status, console errors, overflow, `h1` count, robots meta count | Every URL **200**; 0 console errors; overflow **0**; exactly 1 `h1`; robots meta **0** on production pages. URL count recorded (item 1: home + 9 programmes + resources + guides + privacy + posts) | P |
| E-71 | Privacy (T3.8) | Wording | Service-email sentence in the built Privacy page | `grep -c "These are service emails; you can turn them off in Account → Notifications." apps/web/build/client/privacy/index.html` (also try the HTML-entity form of `→`); `grep -c 'Supabase keeps these in short-lived technical logs' …` | First **1**; item 1's sentence still **1**. Wording approval is Saurabh's (B17 / Q7), not a Tester pass | P |
| E-72 | Regr. | `/posts` | Item 1 `/posts` still works with the column grants | `curl -s -o /dev/null -w '%{http_code}' localhost:4173/posts`; browser `/posts` at 1280: list request query string; `li h2` count; header/footer News links | `200`; request `select=id,created_at,title,body&order=created_at.desc&limit=200` answers **200**; 1 post listed; 1 header + 1 footer News link | P |
| E-73 | Regr. | 404 / robots | One robots meta on 404 and `/subscribed` (BUG-1) | `curl -s localhost:4173/does-not-exist \| grep -c 'name="robots"'`; same for `/subscribed` | Each **1**; 404 status 404 | P |
| E-74 | Regr. | Portal headers | `/portal/account` and `/portal/admin/emails` headers | `curl -sI localhost:4173/portal/account`; `curl -sI localhost:4173/portal/admin/emails` | Both 200 with `Content-Security-Policy` (same as `vercel.json`), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` | P |

### Phase 7 — regression and close-out (D running)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-83 | Posts | Regr. | Admin posts create → edit → delete still works (item 1 N-52) | As `admin@`: publish `T-new`, reload `/posts`; edit to `T-edited`; delete. Then try a spaces-only title in the UI | `T-new` first, then `T-edited`, then gone; count back to 1. Spaces-only: inline `titleLength` message, nothing inserted | D |
| E-84 | Smoke | Sign-in | Every seeded role signs in and reloads (item 1 N-54) | `admin@`, `newadmin@`, `tutor@`, `student@`, `parent@` at `/portal/login`, then reload | Each lands on its `/portal…` home (`admin@` → `/portal/admin`; `newadmin@` → two-step set-up); still signed in after reload; 0 console errors | D |
| E-85 | Smoke | Sign-in | Inactive account refused (item 1 N-55) | `inactive@local.test` with the seed password | "Email or password is incorrect."; stays on `/portal/login`; no session in `localStorage` | D |
| E-86 | Regr. | Family pages | Student and parent assignment pages | As `student@`: `/portal/student`, then "Number patterns check" (returned), "Word problems set 1" (waiting for marking), "Fractions quick quiz" (to do). As `parent@`: `/portal/parent`, Aarav → "Number patterns check"; Noah → consent prompt still shown (if E-42's consent was reset) | Each page 200 with its title; returned work shows mark and feedback; family status wording ("Waiting for marking", "Not started") as before; 0 console errors | D |
| E-87 | Regr. | Marking | Paper and online marking pages for staff | As `tutor@`: `/portal/assignments/$MOCK` (results list), `/portal/assignments/$WORD/students/$AARAV` (submission view, don't return) | Both render with the seed data; Aarav shows Marked / Submitted; 0 console errors | D |
| E-88 | Regr. | E2E | Full E2E suite | `cd ~/dev/work/aj_classes-e2e && pnpm test` | All specs pass (admin posts, invite onboarding, Our Approach, Register Interest, admin 2FA). A timing-only failure is re-run once and written up as an E2E-repo issue, not an app bug | D |
| E-89 | Regr. | E2E hygiene | No leftovers | `q "select count(*) from public.posts where title like 'e2e-%'"`; same for `public.enquiries` and `public.profiles` (`email like 'e2e-%'`) | All **0** | DB |
| E-90 | Close-out | State | End state equals the start snapshot | Re-run E-02 step 5 into `$SCR/snapshot-end.txt`; `diff $SCR/snapshot-start.txt $SCR/snapshot-end.txt`; `q "$CRON_STATE"`; `q "select private.email_daily_cap()"`; `git diff --quiet -- supabase/config.toml` | No diff except more `outbox_sent` rows from cases that send (record the number); cron `t`; cap 70; config clean | DB |
| E-91 | DoD 3 | Final check | Functions and DB suites once more after all fixtures | `pnpm db:test && pnpm test:functions` | Same counts as E-04, 0 failed, cron `t` afterwards | DB |

### Fix cases (review-5 and security; E-92 onwards)

These test the Developer's fix commit (`$FIX`). Each row says which phase it runs in. Both reviews
also list a posts-migration comment fix (review-5 #6); that's comment-only, so it has no case.
**Fixture X12** (E-98) sets `EMAIL_TRANSPORT = "smtp"` in `supabase/config.toml`, as X10 does with
its edit. It's applied right before E-98 and restored in E-98's last step with
`git checkout -- supabase/config.toml`, a restart, and `git diff --quiet`. E-103 runs inside X10
(E-50's window), not in a fixture of its own. **Fixture X13** (E-92) renames one seeded row and is restored in the same case.

| ID | AC / finding | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-92 | 3.7 / review-5 #1 | Script recovery | The cron job always ends active, even when the restore fails (phase 4, after E-51) | Apply X13: `q "update public.assignments set title='Word problems set 1 (x13)' where id='$WORD'"`. Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-notifications.mjs; echo exit=$?`; `q "$CRON_STATE"`. Repeat with the student renamed instead (`q "update public.students set full_name='Aarav Demo (x13)' where id='$AARAV'"`). Restore both names; run the script normally | Both broken runs exit **non-zero** (no hang) with cron **`t`** afterwards. The rename makes the id lookup and the restore fail, which is exactly review-5's break. Restored run: all `ok`, exit 0, cron `t`. Also by reading the fixed script: the id lookup comes before the pause, and the `finally` resumes **before** it restores (or the restore has its own `try`) | DB |
| E-93 | 3.7 / review-5 #2 | Batch stop on network error | A network error stops the batch; rows go back to `pending`, none stuck `sending` (phase 4, **after E-53**, cron off, fixture X14) | 1. Unit: the script's checks include `shouldStopBatch` true for `network`, plus a batch-order check for a network outcome; both `ok` in E-04. 2. Live: `$CRON_OFF`. Apply X14: `$SCR/x14.sql` inserts 3 eligible `pending` rows (student and parent on `$FRACQ`, student on `$TABLES`; Aarav is enrolled and both are published), saving the ids in `$SCR/x14-ids.txt`; `q "select id, attempts from public.email_outbox where id in (<x14 ids>)" > $SCR/e93-before.txt`. `mp_total` → M1. `docker stop supabase_inbucket_aj_classes`; `time WORKER`; `cat $SCR/worker.json`; `q "select id, status, attempts, coalesce(reason,'-') from public.email_outbox where id in (<x14 ids>)"`. `docker start supabase_inbucket_aj_classes`; wait until `curl -s $MP/api/v1/info` answers; `mp_total` → M2 (does Mailpit keep its messages across a restart?). `WORKER`; Mailpit counts. Restore X14 (delete by id); `$CRON_ON` | Worker `200`, `sent: 0`, `retrying: 3`. Only **1** send is tried: the batch stops after the first `network` outcome, with no more 10 s timeouts (the call ends within ~12 s; record the time). All 3 rows are `pending` / `network`, and **none is left `sending`**. Each row has attempts **+1** from `e93-before.txt`. That is a **pass**: team-lead decision 1 accepted it (released rows use an attempt, as for a 429). M2 is recorded: if M2 < M1, Mailpit doesn't keep messages, which is why E-93 runs after E-53. After Mailpit is back, all 3 send (+3) | DB |
| E-94 | 3.11 / review-5 #3 | Deploy digest check | A missing or mismatched hosted worker secret fails (phase 5, fake sandbox **F**) | Same sandbox and `env -i` call as E-63. Change `$F/secrets.json` one way per run: (a) remove the `NOTIFY_WORKER_SECRET` entry; (b) set its value to the sha256 of `some-other-value`; (c) the good listing (sha256 of `fake-notify-EEE`, the deployed value) | (a) and (b) exit **1** with "NOTIFY_WORKER_SECRET on the hosted project isn't the value you deployed (missing, or the local one).", the same message as E-64(e); `calls.log` shows `secrets list` was the last call. (c) exits 0 and prints "Hosted function settings checked: no local values, NOTIFY_WORKER_SECRET as deployed, …". E-64(e) (local value) still exits 1 | F |
| E-95 | 3.8 / review-5 #4 | `no_address` | A blank address fails the row and is listed for admins (phase 2) | 1. `grep -c no_address supabase/tests/database/email_outbox.test.sql` and the `db:test` result from E-04. 2. Live, rolled back: E-19b's transaction, extended. After the claim, set admin aal2 claims (`select set_config('request.jwt.claims', json_build_object('sub', '<admin id>', 'role', 'authenticated', 'aal', 'aal2')::text, true); set local role authenticated;`), then `select state, reason from public.admin_email_problems();` then `rollback;` | 1: ≥ 1 match, and that pgTAP test passes. 2: the claim returns **0** rows for that recipient; the row is `failed` / `no_address`; the admin list shows `failed` / `no_address` ("Recipient address missing" on the page). If `profiles.email` can't be blanked, the pgTAP case is the proof; record it | DB |
| E-96 | — / review-5 #5, security #2(b) | Docs | README says hosted secrets go only through `deploy.sh` (phase 1) | `grep -n 'secrets set' supabase/README.md`; read each hit | No hit tells anyone to run `supabase secrets set` by hand for hosted. The hosted-settings text says to use `supabase/scripts/deploy.sh` only, and says why: a manual call copies the local `[edge_runtime.secrets]` values | — |
| E-97 | 3.3, 3.9 / security #1 | Subject sanitising | A title with `\r\nBcc:` can't add a header or a line (phase 4) | 1. Unit: the script has a check that `renderWorkReturned` with a title containing `\r\n`, `\t` or other control characters gives a subject with none of them; it shows `ok` in E-04. 2. Live: create the X6 assignment as in E-29, then `q "update public.assignments set title=E'e2e-crlf\r\nBcc: evil@local.test' where title like '<img%'"`. Return Aarav's work; `WORKER`; `curl -s $MP/api/v1/message/<ID> \| jq '{Subject, Bcc, To}'`; `curl -s $MP/api/v1/message/<ID>/headers \| jq 'has("Bcc")'`; `mp_to evil@local.test`. Delete the assignment | Subject is one line: `jq '.Subject \| test("[\\r\\n\\t]")'` is **false**, and the subject reads `… e2e-crlf Bcc: evil@local.test` with the break turned into a space. `Bcc` is empty or null; headers have no `Bcc` (**false**); `To` has only the intended recipient; `evil@local.test` has **0** emails | D, DB |
| E-98 | §0.3 / security #2(a) | Worker guard | An unknown `EMAIL_TRANSPORT` refuses to send (phase 4, after E-50, fixture X12) | 1. Unit: the `isUsableConfig` / `gateRequest` checks are `ok` in E-04 (E-102 lists them). 2. Live, X12: `$CRON_OFF`; in `config.toml` set `EMAIL_TRANSPORT = "smtp"` (**not** `resend`, so nothing can reach the internet even if a guard were missing); restart; queue 2 rows (return the mock test); `WORKER`; `WORKER wrong-secret`; outbox; Mailpit. 3. Restore X12, restart, `git diff --quiet -- supabase/config.toml`, `WORKER` | 2: both calls **503** `config_missing` (an unknown transport is "no usable transport", gate step 1); claimed **0**; rows `pending`, attempts **0**, reason `config_missing`; Mailpit +0. 3: config clean; `sent: 2`; restore X2; `$CRON_ON`; cron `t`. The "local secret or http `SITE_URL` outside Mailpit" refusal needs a hosted `SUPABASE_URL`, which the local runtime can't have, so it's unit-only (E-102) | D, DB |
| E-99 | Privacy / security #3 | Wording | The Privacy Policy names Resend (United States) (phase 6) | `grep -c 'Resend' apps/web/build/client/privacy/index.html`; `grep -o '[^.]*Resend[^.]*\.' apps/web/build/client/privacy/index.html`; `pnpm --filter web exec vitest run src/routes/privacy.test.tsx` | ≥ **1** match; the sentence names Resend and the United States (or "outside Australia") for sign-in and portal emails; the Privacy test passes. Wording approval is Saurabh's (B17 / Q7) | P |
| E-100 | — / security #7 | Outbox retention | The daily job deletes outbox rows older than 90 days and keeps newer or unfinished ones (phase 2) | 1. `q "select jobname, schedule, command, active from cron.job order by jobname"`. 2. `$SCR/retention.sql`: `begin;` insert rows on distinct (assignment, recipient) pairs: `sent` 91 days old (`created_at` and `sent_at`), `skipped` 91 d, `failed` 91 d, `sent` 89 d, `pending` 91 d, `sending` 91 d; run the job's command exactly as stored in `cron.job.command`; `select status, extract(day from now()-created_at)::int from public.email_outbox where <those ids>;` `rollback;` | 1: exactly two jobs, `daily-history-trim` (daily, command calls `private.trim_history()`, active `t`) and `email-worker-kick` (`*/5 * * * *`, active `t`); no `cron-history-trim` left (05 §8, renamed). `private.trim_history()` isn't callable by `authenticated` (`as.mjs tutor@local.test POST /rest/v1/rpc/trim_history '{}'` → 404/403). 2: the 91-day `sent`, `skipped` and `failed` rows are **gone**. The 89-day `sent` row, the `pending` row and the `sending` row are **kept** (3 rows). Everything rolled back; outbox counts equal the snapshot | DB |
| E-101 | 3.6 (`[ASSUMPTION]` ruling) | Footer link signed out | A signed-out footer link lands on Account after sign-in (phase 3, after E-34) | New context, signed out: open the student email's footer URL (`…/portal/account#notifications`); sign in `student@`; record the final path, `h1`, and whether `#notifications` exists. Repeat with the parent email and `parent@`. Then `grep -n -i 'hash' docs/delivery/2026-10-25-pending-requirements/04-plan.md` within §7 | After sign-in, the path is exactly `/portal/account` (the hash may be gone), the Account `h1` shows, and the Notifications section with the switch is on the page (count 1); 0 console errors. **Pass** under the ruling, wherever the page is scrolled. 04 §7 lists "keep the `#hash` through sign-in" as Later | D |
| E-102 | §0.3 / review-5 R2-1, security #2(a) | Hosted detection | A non-local `SUPABASE_URL` with Mailpit, the committed local secret or an http `SITE_URL` is a set-up error; local Mailpit still sends (phase 1, unit; phase 3, live) | 1. In E-04's `test:functions` output, find the `config.ts` checks (`isHostedProject`, `isUsableConfig`, `gateRequest`) and list them in the TSR. 2. Live, local: E-05 and E-20 (Mailpit + local secret + `http://localhost:5173` on the local runtime). 3. `docker exec supabase_edge_runtime_aj_classes printenv SUPABASE_URL` | 1: each of these is `ok`. Hosted `SUPABASE_URL` + `EMAIL_TRANSPORT=mailpit` → `config_missing`. Hosted + committed `local-notify-secret` → `config_missing`. Hosted + `http://` `SITE_URL` → `config_missing`. A missing or unreadable `SUPABASE_URL` counts as hosted. Local `http://kong:8000` + Mailpit + local secret + http localhost → allowed. Each `config_missing` result means 503, rows flagged and **nothing claimed or sent** (the gate runs before `notify_claim_emails`). 2: the local sends work (E-05, E-20 pass). 3: a local address (05 §8 says `http://kong:8000`); record it. The hosted path isn't driven end to end: `SUPABASE_URL` is set by the CLI and can't be faked on the local runtime without breaking `serviceClient()`. Unit-only, as the coordinator asked | DB |
| E-103 | 3.7, §0.3 / gate order | Gate order | With `EMAIL_TRANSPORT` unset: 503 and rows flagged even with no or a wrong secret. Once the transport is set: a wrong secret gives 401 (phase 4, inside E-50's X10 window) | During E-50 (transport line removed, stack restarted, 2 rows pending): `WORKER ''`; `WORKER wrong-secret`; `WORKER` (right secret); `cat $SCR/worker.json` after each; then `q "select status, attempts, reason from public.email_outbox where assignment_id='$MOCK'"`. After E-50's restore (transport back): `WORKER wrong-secret`; `WORKER ''`; outbox; then `WORKER` | Transport unset: all three calls **503** `{"ok":false,"code":"config_missing"}`, never 401. Rows `pending`, attempts **0**, reason `config_missing`; Mailpit +0. Transport set: wrong secret **401** `not_allowed`; missing secret **401**; rows unchanged and still unsent; the right secret → **200** `sent: 2`. Unit: the `gateRequest` checks (unset transport → `config_missing` with no, wrong and right secret, hosted and local; wrong/unset secret with a transport → 401) are `ok` in E-04 | DB |
| E-104 | Runbook / review-5 R2, security #2 | README | The kill switch gives the hosted `secrets unset` command, and "Set-up error" covers local-only values on hosted (phase 1) | `grep -n -i 'kill switch' -A3 supabase/README.md`; `grep -n 'Set-up error' supabase/README.md`; read each. **Read only: never run the command it prints** (hard rule 4) | The kill-switch text gives the hosted form, `supabase secrets unset EMAIL_TRANSPORT --project-ref <ref>` (or the same with the repo's ref), and says an `unset` copies nothing from `config.toml`; it still gives `cron.unschedule('email-worker-kick')` as the other way. The "Set-up error" line names: a missing `EMAIL_TRANSPORT`, `RESEND_API_KEY` or `SITE_URL`, **and** local-only values on hosted (Mailpit transport, the committed local secret, a non-https `SITE_URL`). It says released rows on a network error or 429 still use an attempt (E-93). E-96's "only through `deploy.sh`" still holds | — |
| E-105 | 3.5 (`[ASSUMPTION]` 90 days) | At most once, 90-day limit | Within 90 days a re-return sends nothing; after the trim it may send once more (phase 2, rolled back) | `$SCR/ninety.sql`: `begin;` make the mock test returned by the staff-return harness (`return-mock.sql` body without `commit`), so 2 rows exist; **`reset role;`** then `update public.email_outbox set status='sent', sent_at=now()-interval '91 days', created_at=now()-interval '91 days' where assignment_id='<MOCK>';` set the tutor claims and `set local role authenticated` again, re-return (set `marked`, then `returned`), **`reset role;`** → count (A); `select private.trim_history();` → count (B); set the tutor claims and `set local role authenticated` again, re-return (`marked` → `returned`), **`reset role;`** → count and statuses (C); `rollback;`. (`authenticated` can't update the outbox or run `trim_history()`, so every outbox update, trim and count runs after `reset role`, and every re-return after the role is set again) | A = **2** (the 91-day rows still exist, so no new row: at most once while the row exists). B = **0** (finished rows over 90 days trimmed). C = **2** new `pending` rows (one more email per person, as the `[ASSUMPTION]` allows). Repeat with `89 days`: after the trim the rows are still there (2), and the re-return adds **0**. Everything rolled back; the outbox matches the snapshot | DB |

### Regression cases for round-1 bugs (added at round 2, after `1dc433c`)

| ID | AC / bug | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-106 | 3.1 / BUG-5 | Return with no `marked_by` | A staff return of a `marked` result with a null marker queues the emails | 1. As in E-20, on the seed row as `db reset` leaves it (no manual `marked_by`). 2. Fixture for the bug path itself: `q "update public.assignment_results set marked_by=null where assignment_id='$MOCK' and student_id='$AARAV'"` (as postgres; the result stays `marked`), then as `tutor@` in the UI set Returned → Save; `q "select marked_by='$TUT', marked_at is not null from …"`; `ob $MOCK`; `WORKER`; Mailpit counts. Restore X2 | 1 and 2: "Saved"; `marked_by` = tutor and `marked_at` set; `ob` = `parent` + `student` pending → `sent: 2`; +1 email each to `student@` and `parent@` | D, DB |
| E-107 | 3.4 / BUG-6 | Signed-out deep links | Email links make no database call while signed out | Fresh context, signed out: open each of the student link, the parent link and the footer link; record every `/rest/v1/rpc/` request and console error until `/portal/login` loads; sign in and record the landing | **0** `/rest/v1/rpc/` requests and **0** console errors before sign-in; landing exactly as E-22 / E-101 | D |
| E-108 | 3.4 / BUG-7 | Wrong-person read | A tutor calling `parent_child_assignment` is refused, not a 500 | `node $SCR/as.mjs tutor@local.test POST /rest/v1/rpc/parent_child_assignment '{"target_student":"<Aarav>","target_assignment":"<MOCK>"}'`; same as `student@` | **403** with `"code":"42501"` for both; never 500 / `P0002` | DB |
| E-109 | Regr. / BUG-8 | E2E | Full E2E suite at `0ceb308` | `git -C ~/dev/work/aj_classes-e2e log --oneline -1`; `cd ~/dev/work/aj_classes-e2e && pnpm test` | HEAD `0ceb308` (or later); **9 passed, 0 failed**; then E-89 hygiene 0 | D |

### Regression and auth-flow cases (added at round 3, after `330b2cc`)

| ID | AC / bug | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-110 | 3.4 / BUG-9 | Wrong role, signed in | Wrong-role email links make no refused call | Signed in, open in a fresh tab of the same context: `parent@` on the student link, `tutor@` on the parent link, `student@` on the parent link. Then the right roles on their own links. Record `/rest/v1/rpc/` requests with their statuses, and console errors | Wrong roles: "You don't have access to this page"; **0** `/rest/v1/rpc/` responses with a 4xx; **0** console errors. Right roles: the assignment page with title and mark, all RPC responses 2xx, 0 console errors | D |
| E-111 | 3.4 / BUG-9 shared access read | Account switch in one tab | Sign out as one role, sign in as another in the same tab, open a family link | One page, one tab: sign in `parent@`, open the parent link (page shows); sign out; sign in `tutor@` in the same tab; open the parent link; sign out; sign in `parent@` again; open the parent link. Then `student@` → sign out → `parent@` → open the student link | Each step answers for the person now signed in, never the previous one: tutor sees the access message, the parent sees the page again, the parent on the student link sees the access message; 0 refused RPCs and 0 console errors at every step | D |
| E-112 | Auth / shared access read | Two-step admin set-up | `newadmin@` completes two-step set-up and reaches Admin | Sign in `newadmin@` (lands on set-up); read the TOTP secret from the page, enter a current code, finish; open `/portal/admin` and `/portal/admin/emails`; reload. Fixture restore: `q "delete from auth.mfa_factors where user_id=(select id from auth.users where email='newadmin@local.test')"` and sign-in again lands on set-up | After set-up: lands on `/portal/admin` (not back on set-up), Emails page shows "No failed or waiting emails", survives reload; 0 console errors. After the restore: set-up screen again | D |
| E-113 | Auth / shared access read | Student join | A student invite completes join and lands on the student home | Parent gives consent for Noah; admin invites `e2e-item3-noah@local.test`; open the Mailpit invite → Continue → `/portal/join` → finish; record the landing, reload; open the Account page. Restore as X7 | Lands on `/portal/student` (not stuck on `/portal/join`), profile `active`, `role` student; reload keeps it; Account shows the Notifications switch; 0 console errors | D |

---

## 3. Case count

| Area | Cases |
|---|---|
| Safety (E-01 to E-03, E-60, E-66) | 5 |
| Repo checks and scope guards (E-04 to E-08) | 5 |
| Who receives: student, both parents, no-recipient cases, others (E-20, E-24, E-26 to E-28, E-40 to E-45) | 11 |
| Once per person: second return, MCQ auto-return, concurrent worker calls, claim-time skip (E-18, E-23, E-25, E-46) | 4 |
| Content and escaping (E-21, E-29) | 2 |
| Link round trip and deep link (E-22, E-34) | 2 |
| Switch on Account (E-30 to E-33, E-35) | 5 |
| Cap, reclaim, no address, Vault, daily limit (E-19, E-19a to E-19c, E-49) | 5 |
| Never blocks marking, worker refusals, transport missing, real cron, kill switch, script recovery (E-16, E-17, E-36, E-37, E-50 to E-52) | 7 |
| Admin → Emails: empty, rows, safe columns (E-11, E-38, E-47) | 3 |
| Permissions: RPC, RLS, switch, family "returns", other tutor, UI (E-10, E-12 to E-15, E-39) | 6 |
| Posts migration (E-80 to E-82, E-72, E-83) | 5 |
| `deploy.sh` with fakes (E-61 to E-65) | 5 |
| UI at 375/1280, light/dark, and the email at 375 (E-48, E-53) | 2 |
| Smoke (E-70, E-84, E-85) | 3 |
| Regression and close-out (E-71, E-73, E-74, E-86 to E-91) | 9 |
| Fix cases: review-5 and security, rounds 1 and 2 (E-92 to E-105) | 14 |
| Regression for round-1 bugs (E-106 to E-109) | 4 |
| Round-3 regression and auth flows (E-110 to E-113) | 4 |
| **Total** | **101** |

AC coverage: 3.1 E-20/24/28/37/40 · 3.2 E-26–28/42/44–46 · 3.3 E-21/29 · 3.4 E-22 ·
3.5 E-18/23/25/41/43/44 · 3.6 E-13/30–35 · 3.7 E-16/19/19a/19c/36/49/50 · 3.8 E-10/11/19b/38/39/47/49 ·
3.9 E-02/07/21/53/97 · 3.10 E-12–15 · 3.11 E-01/02/61–64/94. Fix cases: review-5 #1–5 → E-92–96 (#6 comment only, no case); security #1 → E-97, #2 → E-96/98, #3 → E-99, #7 → E-100. AC-3.6 ruling → E-34/101. Round 2: hosted detection E-102, gate order E-50/103, README E-104, AC-3.5 90-day `[ASSUMPTION]` E-105. Plus the pgTAP and script suites in E-04/E-05.

---

## 4. Not testable locally

| # | What | Why | Who / when |
|---|---|---|---|
| 1 | Migrations on the hosted project, incl. `create extension pg_cron/pg_net` from a migration; the posts pre-check (05 §5 step 0) | Hosted DB is off-limits | Saurabh, go-live §7a: step 0 (posts pre-check), then `deploy.sh` from `release/work-returned-email` |
| 2 | Hosted Vault entries, the cron job calling the hosted function, and `secrets list -o json` really giving SHA-256 digests | Hosted only. E-63, E-64 and E-94 prove the check's logic against a fake listing in the assumed format | Saurabh, go-live §7a: the Vault lines **straight after the deploy, before the merge to `main`** (then delete the SQL Editor snippet); then confirm "Hosted function settings checked" and, on the first run, the digest format; then the merge; then exposed schemas still `public` and `graphql_public` only |
| 3 | A real `deploy.sh` run, and the hosted-detection gate (E-102) on the real hosted `SUPABASE_URL` | Never run by the team; the local runtime can't have a hosted `SUPABASE_URL` | Saurabh, go-live §7a deploy step; the AC-3.11 check then shows the gate lets real sends through |
| 4 | Real Resend: request accepted, `Idempotency-Key` honoured, 429/409 behaviour, the 2 req/s limit, deliverability, SPF/DKIM on `ajclasses.com.au` | No Resend key is used. Covered only by unit tests of the request builder and outcome mapping | Saurabh, go-live §7a last step: the AC-3.11 test-family check, after the merge |
| 5 | Deno type-check of `supabase/functions/notifications` | Deno isn't installed; the edge runtime strips types without checking them, and `tsc` doesn't cover `supabase/functions` | Developer/CI later, or Saurabh's deploy (`functions deploy` bundles it) |
| 6 | Real mail clients (Gmail, Outlook, Apple Mail, phone mail apps), dark-mode mail rendering | Only Mailpit's HTML view in Chromium (E-53) | Saurabh, release check |
| 7 | Safari, Firefox, real iPhone/Android | Playwright Chromium only | Saurabh, quick phone check |
| 8 | File hand-in returns (AC-3.1 third type) | Item 2 isn't built | Item 2's test plan |
| 9 | The real 2-hour wait before a row shows as Waiting, and the real 24-hour cap roll-off | Tested by back-dating rows (E-47, E-19) | — |
| 10 | Spam Act "on by default" and the Resend mention in Privacy | Legal / wording decisions, not tests | Security + Saurabh (B17 / Q7) |

---

## 5. ACs I think are untestable as written

1. **AC-3.1 "file hand-in"**: item 2 isn't built. The trigger is type-agnostic (it fires on any
   staff return), so paper and online are the proof for now. Retest in item 2's plan.
2. **AC-3.9 "comes from the verified `ajclasses.com.au` domain"**: locally we can only check the
   `From` header. Whether Resend accepts and signs for that domain is a hosted fact (§4 item 4).
3. **AC-3.11**: it's a process rule ("no email goes to a real family"). Locally we can prove only
   that every send goes to Mailpit (E-01, E-02) and that `deploy.sh` sets hosted values (E-63).
   The hosted test-family check is Saurabh's.
4. **AC-3.7 "Resend down"**: it can't be produced locally without a Resend transport. It's covered
   by `outcomeForStatus` and the 429 stop-batch unit tests, plus the edge-runtime-stopped case
   (E-36). "Missing secret" and "daily cap reached" are fully testable (E-19c, E-49, E-50).
5. **AC-3.8 "~2 hours"**: measurable only by back-dating rows, not by waiting. The cut-off is
   exact at 2 h in SQL; "~" isn't a testable tolerance.
6. **AC-3.3 "no marks"**: there's no exact rule for what counts as a mark, so the check is a
   heuristic (no digits outside the links and title, no seeded feedback text). It wouldn't catch
   a mark written as words, but the template has no field that could carry one.
7. **AC-3.6 "On by default"**: the default is testable (E-30). Whether it's *allowed* (Spam Act)
   is a Security/owner ruling, not a test.
8. **AC-3.6 "every email has a link to this page"**: resolved by the team lead's `[ASSUMPTION]`
   ruling (top of this file). Signed in, the link lands on the switch (E-34). Signed out, it lands
   on Account after sign-in (E-101). Keeping the hash is on the Later list.

## Team-lead decisions before freeze

1. **E-93:** rows released after a network error use one attempt each, the same rule as a 429 (05 §8, README). Accepted: three back-to-back failed runs ending in "failed" is visible on Admin → Emails and bounded. E-93 expects this; it is not a bug.
2. **Local secret on hosted → 503, not 401:** accepted as meeting Security fix 2(a) (see `06-security-item-3.md`, team-lead closure).
