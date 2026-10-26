# 06 — Test plan: item 7 (hold results; returned work outlives enrolment)

> **Stage:** 6a of /deliver (Tester, T7.12) · **Date:** 26 Oct 2026 · **Branch:** `feature/fair-results`
> (worktree `/Users/sjain/dev/work/aj_classes-items-4-9`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 7 (AC-7.1 to AC-7.17), [03b](03b-design-items-4-8.md)
> §7 (§7.5 strings, §7.6 status table, §7.7 test approach), [04b](04b-plan-items-4-8.md) §0 (full check) and §5
> (T7.0 to T7.14), [05-dev-notes-item-7.md](05-dev-notes-item-7.md) (§4 browser pass, O1 to O5, D1 to D6, §6
> legs left for the Tester, §7 review fixes), [review-5-item-7.md](review-5-item-7.md) (APPROVED),
> [06-security-item-7.md](06-security-item-7.md) (APPROVED, S1 to S5), `supabase/README.md` (runbook "A
> student leaves a class, or was enrolled by mistake (ADR-0007)"), [06-test-plan-item-4.md](06-test-plan-item-4.md)
> (format, harness), [06-test-plan-item-3.md](06-test-plan-item-3.md) (Mailpit and worker helpers),
> [TSR-item-4.md](TSR-item-4.md) (rulings R1 to R5), `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-7.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/fair-results` HEAD at freeze time. This plan was written against
**`a6727f1`** (dev notes deferral line; docs `9d9ece8` before it). The last production-code commit is
**`995c9ee`**; after it only tests changed (`a5286bd`: pgTAP, a feedback-only update on held
multiple-choice work keeps its marks, `fair_results` +3; `c7a18b3`: the switch's mid-save reload
guard, +1 Vitest). Code changes since `374b368`, all re-read for this plan:
- `0d1b701` and `8cf5689`: the switch keeps the clicked value through the save and the reload, and
  shows the saved value again after a refusal or a throw;
- `6b082f0` (P1): the marking page shows `Feedback on this answer (optional)` on multiple-choice
  answers, with no mark input, and saves feedback only (`awarded_marks` isn't sent for them); new
  `submission.test.tsx`;
- `92163b9` (P2): `getStaffClient()` in `staff-client.ts`; `getAssignment` (and so `getSubmission`)
  sends nothing for a student, a parent or a signed-out visitor and returns `notAllowed`;
- `995c9ee` (P4): `HoldResultsSetting` takes a `revision` prop (`assignment-detail.tsx` passes the
  loader's `assignment` object); the clicked value clears on the first render of reloaded data,
  whatever value comes back, unless a save is still running;
- `3d1e2fb` (README step (c)) and `d5baae1` (pgTAP: e008 has 1 result before the delete).

The run doesn't start unless `git merge-base --is-ancestor a6727f1 HEAD` exits 0. If
`git diff --quiet a6727f1 HEAD -- apps e2e supabase package.json pnpm-lock.yaml` doesn't exit 0,
every value marked **[re-check]** is re-read from the files before the run, never carried over.
Record both SHAs in the TSR.

**Status: FROZEN, 69 cases.** Frozen by the commit `docs(delivery): freeze the item 7 test plan` (its
SHA is recorded in `TSR-item-7.md`'s header). No case may be removed or weakened from here on; new
cases go at the end. The team lead ruled on P1 to P4 (block below); P1, P2 and P4 are fixed in the
build under test, so E-42, E-47 and E-93 are expected to **pass**.

**Changes after review 6a** ([review-6a-item-7.md](review-6a-item-7.md), round 1, CHANGES_REQUESTED;
no second round if the TSR header lists these):
1. Finding 1, **E-01** step 5: the gate SHA is `a6727f1` (the header's).
2. Finding 2, **E-42**: the X1 restore deletes by id (`$MD`, `$MPD`, `$ED`), since E-23 renamed `MD`.
3. Finding 3, **E-47**: the 1,000-character Q2 text is cleared before leaving the page (reload without
   saving); **E-49** asserts Q2's stored feedback is `''` after the Return.
4. Finding 4, **E-64**: the answers md5 is taken just before E-64's write attempts, not from E-12.
5. Finding 5, **E-70**: Isla's `Reasoning mock test 1` is `submitted` (seed), the rest `not_started`.
6. Finding 6, **E-81**: restore re-enrols first, nulls `awarded_marks` on positions 2 and 3 only,
   result `mark` back to `1.0`, `status='submitted'`, `feedback=''`; Mailpit is cleared first (finding 17).
7. Finding 7, **E-11**: `grep -cE 'rule \(b\)|rules \(a\) and \(b\)'` → `2`.
8. Finding 8, **E-08**: constants and test files excluded; no `grep -P` (`perl` instead); exit 1 = no match.
9. Finding 9, **E-10**: `proconfig` prints `{"search_path=\"\""}` under `psql -At`.
10. Finding 10, **E-04**, **E-06**: the line is `check-hosted-ref: 0 files (of N scanned)`.
11. Finding 11, **E-69**: expected console **0**, no exception.
12. Finding 12, **E-24**: aal1 admin on NAPLAN is **200** `[{"id":"$ED","hold_results":true}]`, `t`, then reset.
13. Findings 13–14: the Rulings block (the lead's); A1–A4 below no longer say "proposed"; **E-91** drops
    "if ruled in".
14. Finding 15: known values replace [measure] in **E-24** (student, parent `200 []`), **E-61**
    (`2 of 2`), **E-69** (Aarav not listed), **E-73** step 3 (`403`), **E-74** (parent home lists
    `Noah Demo` only).
15. Finding 16: **E-72** uses the full name; **E-82** `Can Noah Demo use the portal?` (`fullName`).
16. Finding 18: **E-12** runs before E-05 (it's listed after E-04 in the table now); **E-92**, **E-93**
    have an Env cell.
17. Finding 19, **E-09**: `git checkout -- apps/web/src/services/database.types.ts` if it changed.
18. Finding 20: §4 renumbered; §3's S1 row adds E-72 for (d).
19. Finding 21: the Phase 4 intro says `not_submitted` isn't exercised for Aarav (pgTAP covers it).
20. Finding 22, **E-50**: the parent page heading is `Aarav’s results`.
21. Counts at `a6727f1`: Vitest 60 / **521**, pgTAP 15 / **590** (`fair_results` **83**) in **E-04**.
22. Not covered adds security **S6** and the deferred staff-loader pre-checks.

**Expected values were checked on this branch before writing them** (the item 4 lesson). Read-only,
at `a6727f1`:
- UI strings from `apps/web/src/constants/` (`online-assignments.constants.ts` `HOLD_RESULTS`,
  `PUBLISHING`, `SUBMISSION_PAGE`, `SUBMISSIONS`; `family.constants.ts` `FAMILY_TAGS`,
  `FAMILY_STATUS_LABELS`, `STUDENT_HOME`, `SOLVE_PAGE`, `RESULTS_TEXT`, `PARENT_*`,
  `ADMIN_STUDENT_PAGE`; `error.constants.ts` `PORTAL_ERRORS`; `portal.constants.ts` `CLASS_PAGE`,
  `ENROL_DIALOG`, `STUDENTS_PAGE`, `NOT_FOUND_PANEL`). They're quoted as they are, curly apostrophes
  included (`’` where the constant has it, `'` where it doesn't).
- Error codes from `supabase/migrations/20261027100000_fair_results.sql` (`assignment_published`,
  `hold_needs_questions`, both P0001 → HTTP 400) and the unchanged helpers (`not_student` 42501,
  `require_my_child` P0002, `parent_child_assignment` 42501 `not_found`, `student_*` P0002
  `not_found`, `check_assignment_result` `not_enrolled`, `check_assignment_status` `has_submissions`).
  Through PostgREST, P0002 answers **HTTP 500**: that's the known ITEM3-FU-1 (TSR-item-3, "Not covered"
  1), not item 7. 42501 for a signed-in caller is **403**.
- Seed names, classes and statuses from `supabase/seed.sql` (below).
- Test counts from source: `fair_results.test.sql` has **83** assertions (`grep -cE '^select (is|isnt|ok|results_eq|lives_ok|throws_ok|is_empty)\('`).
  Summed over the 15 pgTAP files the total is **590**. Vitest: **60** test files; the total **521** =
  item 6's 496 + 8 (dev notes §2) + 2 (`4a014f4`, `7126f06`) + 3 (`submission.test.tsx`, new) + 2
  (`HoldResultsSetting.test.tsx`, now 8 `it`s, `995c9ee` and `c7a18b3`) + 10 (`staff-access.test.ts`'s new `STAFF_PAGE_READS`
  block: 2 reads × {student, parent} + 2 signed out + 2 reads × {tutor, admin}).
  Smoke **9** (`admin-posts` 5, `invite-onboarding` 1, `our-approach` 1, `register-interest` 1,
  `staff-login` 1). CSP **19** (9 pages × 2 widths + 1). e2e unit **6** (`local-hosts.test.ts`).
  `test:functions` **169** `ok` comes from the dev notes and item 4's TSR: item 7 changes no
  function **[dev notes]**.
- Email wording from `supabase/functions/notifications/copy.ts`.

Values that only a run can give (dates, scores the UI formats, timings, scanned-file counts) are
marked **[measure]**. The rule is the expectation; the number is recorded.

---

## Pre-freeze findings (raised by this plan; ruled and resolved)

- **P1 — AC-7.4 per-question feedback on multiple-choice answers.** The marking page offered the field
  on written answers only. Ruled a defect; fixed in `6b082f0`. E-47 must pass.
- **P2 — staff assignment read from a family page.** `getAssignment` ran alongside the layout's
  access check. Ruled; fixed in `92163b9` (`getStaffClient`). E-42 stays strict and must pass.
- **P3 — console exceptions A3 and A4.** Accepted, narrowly (ruling 3).
- **P4 — the switch could stay disabled when the reload brought back the old value.** Ruled a defect;
  fixed in `995c9ee` (`revision` prop). E-93 must pass.

---

**Team lead rulings on P1–P4 (26 Oct 2026, before freeze).**
1. **P1: a defect, fixed before freeze.** AC-7.4 says the tutor "can add an overall comment and
   per-question feedback" on a held submission, and a held submission is all multiple-choice, so
   the AC covers multiple-choice answers. The Developer is adding the field for multiple-choice
   answers. E-47 stays as written and must pass.
2. **P2: fixed before freeze.** The Developer is adding the item 4 wrong-role pre-check to the
   assignment page loader (and the submission page loader if it has the same gap). E-42 stays
   strict: any staff `assignments` read from a student or parent page fails the case.
3. **P3: A3 and A4 accepted as narrow exceptions,** consistent with items 4 and 5 (must-refuse
   requests). A3: the page's own refused read when a family member follows a URL to work they
   can't see (no longer, or never, as in E-71), at most 1 line on an assignment page and 2 on a parent's child page, with
   the codes asserted. A4: the refused `not_student` reads on a page that was open when an admin
   deactivated or archived the student, at most 1 `not_student` line per reload, code asserted.
   Any other console line fails its case.
4. **P4: a defect, fixed before freeze.** If the reload returns the old value, the box must show
   it and be enabled. The Developer is fixing it; E-93 stays as written and must pass.

## Environment (local only)

| Name | What | Address |
|---|---|---|
| **DB** | Local Supabase, started from **this worktree** (`project_id = "aj_classes"`, shared by every checkout) | API `http://127.0.0.1:55321`, DB `:55322`, Studio `:55323`, Mailpit `:55324` |
| **D** | Dev server, strict port, started by hand from `apps/web` with the §1 exports | `http://localhost:5173` |
| **M** | The production mirror, started by `test:csp` itself | `http://127.0.0.1:4173` |

- **Seed (after `pnpm db:reset`).** The accounts `admin@`, `newadmin@`, `tutor@`, `student@`,
  `parent@` and `inactive@local.test` are as in `supabase/seed.sql`. The local-only password and the
  local-only admin authenticator key are in its header comment. The run reads them from there and
  never copies them into the TSR.
  - `student@` is **Aarav Demo**, Year 8, enrolled in **Selective Entry Maths & Reasoning** (tutor
    Local Tutor) and **Selective Interview Preparation** (tutor Local Tutor, online, no assignments).
    `parent@` (**Local Parent**) is linked to Aarav and **Noah Demo** (no account; NAPLAN class).
  - **Isla Demo** (Year 8, no account) is enrolled in the same two classes. **NAPLAN Reading &
    Writing** is taught by **Local Admin**.
  - Aarav's maths work. Published: `Fractions practice set 3` (paper, no result, **Not started**),
    `Reasoning mock test 1` (paper, `marked`, 42/50; family label **Waiting for marking**), `Number
    patterns check` (online, **Returned**: 6/8 = 75 %, tutor comment `Great reasoning in the written
    question, Aarav. …`), `Word problems set 1` (online, written, **submitted**), `Fractions quick
    quiz` (online, not started), `Times tables warm-up` (3 multiple-choice questions, no hold, not
    started). Draft: `Ratio worksheet`.
  - The seed's return of `Number patterns check` queues 2 `work_returned` emails (Aarav and Local
    Parent). The cron sends them to Mailpit within 5 minutes of the reset.
  - **No seed assignment has `hold_results = true`.**
- **The hosted project `unzjnxctkyahtmrkinyr` is never read or written.** The committed
  `apps/web/.env.production` points at it, so every build and the dev server run with the §1 exports.
  `supabase/.env.deploy` is never opened.

**Full check** (04b §0 steps 1 to 3, then the in-repo E2E; from the worktree root, with the §1
exports, `VITE_LOCAL_ADMIN_TWO_STEP_KEY` unset):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build \
  && pnpm --filter web check:hosted-ref build/client \
  && pnpm db:test && pnpm test:functions
node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke
lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill   # global setup leaves its dev server running
VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= \
  VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 pnpm build \
  && pnpm --filter web check:hosted-ref build/client \
  && pnpm --filter aj-classes-e2e test:csp          # ci-gates.md "Lighthouse"; test:csp starts M itself
```

**Hard rules for this run.**
1. Local stack only. Banned: `supabase link`, `db push`, `config push`, `functions deploy`,
   `secrets set|unset|list`, anything with `--linked` or `--project-ref`, `git push`, `gh pr …`.
2. `supabase/.env.deploy` is never opened, `cat`-ed, sourced or grepped. Key values are never printed:
   print names, counts, or `equal` / `differ`.
3. Docs-and-test only: no tracked file changes during the run. A fix goes to the Developer, and the
   run restarts on the new HEAD.
4. Every fixture account, assignment and title starts with `e2e-item7`, so E-90 can find and remove
   it.

**Strict console and network reading (team lead).** Every browser leg counts `console` messages of
type `error` plus `pageerror` events, from the first page open to the end of the case, across
navigations. Expected is **0** on every leg. A request the app should never have sent **fails the
case**, even if the page then shows the right thing, and even if it got a 200. **Any request to a
host ending in `supabase.co`, or to any URL containing `unzjnxctkyahtmrkinyr`, fails the case.**
The only exceptions, exact and nowhere else:
- **A1.** E-32 and E-73 step 4: the one `400` from `/auth/v1/token?grant_type=password` when a
  deactivated account signs in. The app has to send it to learn the account is refused (item 4's A1).
- **A2.** E-39 and E-40: the one `400` `PATCH /rest/v1/assignments` line per race, from a stale tab
  the test makes on purpose. The app must send the click's save to learn it's refused.
- **A3 (ruling 3).** On the direct-URL legs to work the family can't see (no longer, or never, as in E-71) (E-63, E-66
  step 4, E-71 step 3, E-72 step 4, E-76 step 4): the refused family RPC lines of that page's own
  loader, and nothing else. At most **1** for an assignment page (`student_assignment` 500 or
  `parent_child_assignment` 403) and **2** for a parent child page (`parent_child_assignments` and
  `parent_child_timetable`, both 500). A person following an old link has to ask; the 500 is
  ITEM3-FU-1. Each leg lists its lines in the TSR.
- **A4 (ruling 3).** E-73 step 2 and E-74 step 2: the refused `not_student` read (403) on the page that
  was open when an admin cut access, at most **1** line per reload, code asserted. That's the refusal
  under test.

**For Saurabh** (none of these blocks a case; nothing in this plan needs his accounts, his app
config or a paid call):
1. **Looks:** the E-52, E-43 and E-68 screenshots (`$EVD`). The cases pass or fail on measured
   overflow, contrast and line counts. Whether it *looks* right is his call, after the run.
2. **O3 (hint length):** the hint is 5 lines at 360 px. The wording is the PO's (03b §7.5). He or the PO
   may want the shorter text in dev notes O3. Not a test failure.

**Known non-bugs for this run** (don't raise):
1. **S1 (security, accepted residual):** removing a student or archiving the class doesn't cut off
   returned work. The admin steps are in the `supabase/README.md` runbook. E-73, E-74, E-75 and E-76
   test those steps.
2. **S2:** a removed student still sees later edits to a returned assignment's title or
   instructions. Tutor guidance is in the README.
3. **S4:** returning work in an archived class now emails the student and active parents (before item
   7 it queued none). Same people, not wider. E-78 records it as informational.
4. **S5:** held work that was submitted but not returned before the student was removed is stranded:
   hidden from the family, and a tutor return gives `not_enrolled`. Fails closed. The workaround is
   re-enrol, return, remove. E-69 records it as informational.
5. **ITEM3-FU-1:** `require_my_child` and `student_assignment` raise P0002, which PostgREST answers
   with **500**. Pre-existing; the codes are asserted, and A3 covers the console line.
6. **O2 (dev notes):** `Typography color="text.secondary"` renders in the body colour across the
   portal (pre-existing, MUI 9). Contrast is measured, and it passes.
7. **O5:** at 360 px the "DEV" marker overlaps the start of the signed-in name. Existing non-prod marker.
8. **Stale `true` `[ASSUMPTION]` (03b §7.2):** deleting every question leaves `hold_results = true`
   with the switch hidden. E-26 records it.
9. **Progress counts past-class work** (03b §7.4 `[ASSUMPTION]`).
10. Staff and family status labels differ on purpose (staff "Submitted", family "Waiting for
    marking"; tester addendum).
11. The supabase-js vendor bundle contains the literal `supabase.co` (TSR-item-4 R1). The build
    check is `check:hosted-ref` (`unzjnxctkyahtmrkinyr`), and the browser rule counts requests,
    not strings.
12. Production public pages carry no robots meta; the dev server carries one (TSR-item-4 R5). The
    check is "never more than one".
13. Hot reload logs `[react-router:hmr] No module update found` after source edits. No source is edited
    in this run; clear the console first if a server was left running from an edit.

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
export SCR=<session scratch dir>/item7-run
export EVD=$PWD/docs/test-reports/2026-10-26-feature-fair-results/evidence
mkdir -p "$SCR" "$EVD"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'
qf() { docker exec -i supabase_db_aj_classes psql -U postgres -At -v ON_ERROR_STOP=1 < "$1"; }
MP=http://127.0.0.1:55324
mp_to()    { curl -s "$MP/api/v1/search?query=to:$1" | jq '.messages | length'; }
mp_subj()  { curl -s "$MP/api/v1/search?query=to:$1" | jq -r '.messages[].Subject'; }
WORKER() { curl -s -o "${2:-$SCR/worker.json}" -w '%{http_code}' -X POST "$VITE_SUPABASE_URL/functions/v1/notifications" \
  -H "apikey: $KEY" -H 'Content-Type: application/json' -H "x-notify-secret: ${1-local-notify-secret}" -d '{}'; }
CRON_OFF="select cron.alter_job(jobid, active := false) from cron.job where jobname = 'email-worker-kick'"
CRON_ON="select cron.alter_job(jobid, active := true) from cron.job where jobname = 'email-worker-kick'"
CRON_STATE="select active from cron.job where jobname = 'email-worker-kick'"
ob() { q "select recipient_role||':'||status||':'||coalesce(reason,'-') from public.email_outbox where kind='work_returned' and assignment_id='$1' order by 1"; }

# Ids
ADM=$(q "select id from public.profiles where email='admin@local.test'")
TUT=$(q "select id from public.profiles where email='tutor@local.test'")
STU=$(q "select id from public.profiles where email='student@local.test'")
PAR=$(q "select id from public.profiles where email='parent@local.test'")
for s in 'Aarav Demo:AARAV' 'Isla Demo:ISLA' 'Noah Demo:NOAH'; do
  export "${s##*:}=$(q "select id from public.students where full_name='${s%%:*}'")"; done
for c in 'Selective Entry Maths & Reasoning:MATHS' 'NAPLAN Reading & Writing:ENG' 'Selective Interview Preparation:INTV'; do
  export "${c##*:}=$(q "select id from public.classes where name='${c%%:*}'")"; done
for t in 'Number patterns check:NP' 'Word problems set 1:WORD' 'Reasoning mock test 1:MOCK' \
         'Fractions quick quiz:FRACQ' 'Fractions practice set 3:FRACP' 'Times tables warm-up:TABLES' 'Ratio worksheet:RATIO'; do
  export "${t##*:}=$(q "select id from public.assignments where title='${t%%:*}'")"; done
qid() { q "select id from public.assignment_questions where assignment_id='$1' and position=$2"; }   # question id
res() { q "select coalesce(status,'none') from public.assignment_results where assignment_id='$1' and student_id='${2:-$AARAV}'"; }

ln -sfn ~/dev/work/aj_classes-e2e/node_modules "$SCR/node_modules"   # Playwright for the harness
```

**`$SCR/as.mjs`** and **`$SCR/token.mjs`** are item 4's (06-test-plan-item-4 §1), unchanged, run
**from the worktree root**: `node $SCR/as.mjs <anon | admin-aal1 | admin-aal2 | <seed email> | token:<jwt>> <METHOD> <path> [json]`
prints `status body`; `node $SCR/token.mjs <seed email | admin-aal2 | <email> <password>>` prints one
access token. Short forms:

```bash
rpc()   { node $SCR/as.mjs "$1" POST "/rest/v1/rpc/$2" "${3:-{\}}"; }               # rpc <who> <fn> [json]
hold()  { node $SCR/as.mjs "$1" PATCH "/rest/v1/assignments?id=eq.$2&select=id,hold_results" "{\"hold_results\":$3}"; }
holdv() { q "select hold_results from public.assignments where id='$1'"; }
```

For the fixture accounts, `who` is `token:$(node $SCR/token.mjs <email> e2e-item7-password-123)`.

**Browser harness** (`$SCR/ui.mjs`, Chromium, throwaway): item 4's, with the same counters attached
before the first navigation of every fresh context: **console errors** (`console` type `error` plus
`pageerror`), **hosted** (host ends in `supabase.co`, or URL contains `unzjnxctkyahtmrkinyr`),
**writes** (method `PATCH`/`POST`/`DELETE` to `:55321`, with path and body), **4xx/5xx** responses
from `:55321`, and every `:55321` response body (kept for the JSON checks). "Overflow" is
`documentElement.scrollWidth − clientWidth`. "Dark" and "Light" are the portal's own Account →
Appearance → `Dark` / `Light`; reset to `Same as this device` after each matrix. "Lines" is
`round(height / lineHeight)`. "Contrast" is the WCAG ratio of computed `color` against the first
opaque `background-color` up the ancestors. Widths: 1280 × 800 and 360 × 780. Sign-in is through
`/portal/login`. `admin@` gets two-step from D (`VITE_LOCAL_ADMIN_TWO_STEP_KEY`).

**Fixtures** (each applied right before the case that needs it, so earlier cases run on the seed):

| Fixture | What | Applied right before | Restored by |
|---|---|---|---|
| X1 | `e2e-item7 API draft` (maths, 1 multiple-choice question), `e2e-item7 API paper` (maths, no questions), `e2e-item7 English draft` (NAPLAN, 1 multiple-choice question): superuser `insert`s in `$SCR/x1.sql`; ids `MD`, `MPD`, `ED` | E-20 | E-42 last step: `delete from public.assignments where id in ('$MD','$MPD','$ED')` (by id: E-23 renames `MD`) |
| X2 | `e2e-item7 Held quiz` (`H1`), built by `tutor@` in the UI (E-33): due today + 7; Q1 "e2e-item7 pick B" (A, B, C; correct B; 2 marks; explanation `B is right`), Q2 "e2e-item7 pick A" (A, B; correct A; 1 mark; explanation `A is right`) | E-33 | Deleted in E-76 (the AC-7.13 case) |
| X3 | `e2e-item7 Paper draft` (tutor UI, no questions) | E-34 | E-34 last step: deleted in the UI |
| X4 | `e2e-item7 Race quiz` (tutor UI, 1 multiple-choice question), two tabs | E-39 | E-40 last step: deleted in the UI |
| X5 | `e2e-item7 Admin quiz` (admin UI, maths, 1 multiple-choice question) | E-41 | E-41 last step: deleted in the UI |
| X6 | Aarav hands in `Times tables warm-up` in the UI | E-51 | E-51 last step: `delete from public.assignment_answers` and `assignment_results` for (`$TABLES`, `$AARAV`) |
| X7 | Aarav answers Q1 of `Fractions quick quiz` (no hand-in), so it's **In progress** | E-60 | E-90 (delete its answers and result row) |
| X8 | Aarav removed from maths through the class page **Remove from class** (E-60) | E-60 | E-77 (re-enrolled through **Add student**) |
| X9 | Second parent for Aarav, `e2e-item7-p2@local.test` ("e2e-item7 Parent Two"), through Admin → Students → Aarav → **Invite or link a parent**, the Mailpit link and `/portal/join` (password `e2e-item7-password-123`, terms), as item 3's E-40 | E-65 | Unlinked in E-72; account deleted in E-90 |
| X10 | Isla's student account `e2e-item7-isla@local.test`: Admin → Students → Isla → **Record consent**, **Send invite**, the Mailpit link, `/portal/join` | E-70 | E-90: delete the account; Isla's `profile_id` and consent columns back to the snapshot |
| X11 | Parent for Isla, `e2e-item7-p3@local.test`, as X9 on Isla's page | E-71 | E-90 |
| X12 | Aarav's login deactivated through Admin → Students → Aarav → Student account → **Deactivate** | E-73 | Same case: **Reactivate** |
| X13 | Aarav's roster row archived through Admin → Students → **Archive** | E-74 | Same case: **Restore** |
| X14 | Maths class archived through the class page **Archive** | E-78 | Same case: **Restore** |
| X15 | Isla removed from both her classes | E-79 | Same case: re-enrolled in both |
| X16 | Cron off (`$CRON_OFF`) | E-80 | E-81 last step: `$CRON_ON`; `q "$CRON_STATE"` = `t` |

---

## 2. Cases

Phases run in this order: **0** safety, **1** repo checks, **2** DB and API, **3** hold results in the
portal, **4** leaving a class, **5** family and email regression, **6** close-out. Within a phase, run
in table order. Start **D** after phase 1 (`pnpm dev --port 5173 --strictPort` from `apps/web`); it
stays up through phase 5. Unless a case says otherwise, every browser leg expects console errors
**0**, hosted **0**, and no 4xx/5xx from `:55321`.

### Phase 0 — safety guards (stop the run if any fails)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-01 | §0.3 | Safety | Shell, build and E2E env point at the local stack only | 1. `echo $VITE_SUPABASE_URL`; compare the key with `pnpm db:status`'s (print `equal`/`differ`). 2. `ls -a apps/web \| grep -E '^\.env'`. 3. `grep -cE 'supabase\.co\|unzjnxctkyahtmrkinyr' e2e/.env`; `grep -E '^(SUPABASE_REST_URL\|WEB_BASE_URL\|MAILPIT_URL)=' e2e/.env`. 4. `env \| cut -d= -f1 \| grep -xE 'SUPABASE_ACCESS_TOKEN\|SUPABASE_DB_PASSWORD\|RESEND_API_KEY\|EMAIL_TRANSPORT\|TURNSTILE_SECRET\|ZOHO_[A-Z_]+'`. 5. `git rev-parse HEAD`; `git merge-base --is-ancestor a6727f1 HEAD; echo $?`; `git diff --quiet a6727f1 HEAD -- apps e2e supabase package.json pnpm-lock.yaml; echo $?`; `git branch --show-current` | 1: exactly `http://127.0.0.1:55321`; `equal`. 2: `.env.example` and `.env.production` only. 3: `0`; `http://127.0.0.1:55321`, `http://localhost:5173`, `http://127.0.0.1:55324`. 4: no output. 5: HEAD recorded; `0`; `0` (else re-check every **[re-check]** value); `feature/fair-results`. **Any failure: stop** | DB |
| E-02 | 04b §0 | Safety | Stack started and reset from this worktree | 1. `pnpm db:reset`. 2. `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' \| grep -c aj_classes-items-4-9`. 3. `q "select max(version) from supabase_migrations.schema_migrations"`; `ls supabase/migrations \| tail -1`; `ls supabase/migrations \| wc -l`. 4. `q "$CRON_STATE"` | 1: exit 0. 2: **1** (else `pnpm db:stop && pnpm db:start` here, repeat). 3: `20261027100000` and `20261027100000_fair_results.sql`; **15** files. 4: `t`. **Any failure in 2–3: stop** | DB |
| E-03 | §0.3 | Safety | `.env.deploy` untouched; no banned command | `git check-ignore -q supabase/.env.deploy; echo $?` (doesn't open it). At close-out: `grep -nE 'env\.deploy\|db push\|config push\|functions deploy\|secrets (set\|unset\|list)\|--linked\|--project-ref\|supabase link\|git push' <the TSR's command log>` | `0`; no such line | — |

### Phase 1 — repo checks

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-04 | DoD, all | Full check | Lines 1–2 of the full check (web, build, hosted-ref, pgTAP, functions) | Run with the §1 exports, `VITE_LOCAL_ADMIN_TWO_STEP_KEY` unset (`env -u`); log to `$EVD/E-04-fullcheck.log` | Every step exit 0. Lint 0 problems. `pnpm test`: **60 files / 521 tests**, 0 failed [re-check], the list includes `HoldResultsSetting.test.tsx` (8), `submission.test.tsx` (3), `staff-access.test.ts`, `StatusChips.test.tsx` (1), `family-data.test.ts` (2), `auth-errors.test.ts`; e2e unit **6/6**. `check-hosted-ref: 0 files (of N scanned)`, N [measure] (dev notes: 153). `db:test`: **15 files / 590 tests**, PASS, `fair_results.test.sql` **83** [re-check], `family_portal.test.sql` and `email_outbox.test.sql` pass. `test:functions`: **≥ 169 `ok`**, 0 `not ok`, "All checks passed." ×3. Fewer tests than these means a test was dropped: fail | DB |
| E-12 | Regr. (item 3) | Seed emails; snapshot | The seed's two "work returned" emails go out; take the start snapshot | Before E-05 (smoke may touch Mailpit), ≥ 6 min after E-02: `ob $NP`; `mp_subj student@local.test`; `mp_subj parent@local.test`. Snapshot to `$SCR/snapshot-start.txt`: `profiles` (`email\|role\|status\|is_active`), `students` (`full_name\|is_active\|coalesce(profile_id::text,'null')\|coalesce(consent_source::text,'null')`), `enrolments` (`class name\|student name`), `student_guardians` count, `classes` (`name\|is_active`), `assignments` (`title\|status\|hold_results`), `assignment_results` (`title\|student\|status\|coalesce(mark::text,'-')\|marked_by is null\|coalesce(feedback,'')`), `md5(string_agg(…))` over `assignment_answers` | `parent:sent:-`, `student:sent:-`. Student: `Your work has been marked: Number patterns check`; parent: `Aarav's work has been marked: Number patterns check` (straight `'`, `copy.ts`). Snapshot: 6 profiles; 0 assignments with `hold_results` `t`; Aarav's results as in §Environment | DB |
| E-05 | Regr., T7.9 | E2E smoke | In-repo smoke suite | Line 3 of the full check; then the kill; `lsof -nP -iTCP:5173 -sTCP:LISTEN \| wc -l`; `q "select count(*) from public.profiles where email like 'e2e-%'"`, same on `posts` (title) and `enquiries` (email) | **9 passed**, 0 failed; the `hostedSupabaseGuard` fixture reports no hosted request. `0` (port free). All three counts **0** | DB, D (own) |
| E-06 | Regr., T7.9 | CSP | No-Supabase build, hosted-ref, CSP sweep | Lines 4–6 of the full check | Build exit 0; `check-hosted-ref: 0 files (of N scanned)`; **19 passed**, 0 failed | M |
| E-07 | 03b §7.1 | Scope guard | Only the item 7 files changed | `git diff --name-only develop...HEAD -- apps supabase e2e \| sort` | Exactly these **31** [re-check]: `apps/web/src/components/portal/{HoldResultsSetting.test.tsx,HoldResultsSetting.tsx,index.ts,StatusChips.test.tsx,StatusChips.tsx}`, `apps/web/src/constants/{error,family,online-assignments}.constants.ts`, `apps/web/src/lib/{assignments,family-progress}.test.ts`, `apps/web/src/routes/portal/{assignment-detail,parent-child-assignment,parent-child,student-assignment,student-home,submission}.tsx`, `apps/web/src/routes/portal/submission.test.tsx`, `apps/web/src/services/{assignments.service.ts,auth-errors.test.ts,auth-errors.ts,database.types.ts,family-data.test.ts,family-data.ts,index.ts,staff-access.test.ts,staff-client.ts,submissions.service.ts,types.ts}`, `supabase/README.md`, `supabase/migrations/20261027100000_fair_results.sql`, `supabase/tests/database/fair_results.test.sql`. Nothing under `e2e/` or `supabase/functions/` | — |
| E-08 | Repo rules | Code rules | Added non-test, non-constant lines follow the repo rules | `git diff develop...HEAD -- apps/web/src ':(exclude)apps/web/src/constants' ':(exclude)*.test.ts' ':(exclude)*.test.tsx' \| grep -E '^\+[^+]' \| perl -ne 'print if /console\.(log\|debug)\|style=\{\{\|: any\b\|TODO(?! \[)\|fetch\(\|axios\|document\.(querySelector\|getElementById)\|innerHTML\|\x27(Hold results\|Past class\|Locked because\|Feedback on this answer)/'; echo "exit=$?"` (perl, not `grep -P`, which macOS lacks) | **0** lines printed. (Hard-coded UI text outside `constants/` counts as a hit) | — |
| E-09 | 03b §7.1 #10 | Types | Generated types match the schema | `pnpm db:types && git diff --exit-code apps/web/src/services/database.types.ts; echo $?`; if it isn't `0`, keep the diff in `$SCR` and `git checkout -- apps/web/src/services/database.types.ts` | `0` | DB |
| E-10 | 7.6, grants | DB objects | Column, trigger, security-definer settings and grants as designed | `q "select column_default, is_nullable, data_type from information_schema.columns where table_name='assignments' and column_name='hold_results'"`; `q "select tgname, tgenabled from pg_trigger where tgname='assignments_check_hold_results'"`; `q "select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('check_hold_results','assignment_readable_by','student_submit','assignments_for_student','student_assignments','parent_child_assignments','assignment_view','work_returned_recipients') order by 1"`; `q "select r, f, has_function_privilege(r, f, 'execute') from unnest(array['anon','authenticated']) r, unnest(array['public.student_assignments()','public.parent_child_assignments(uuid)','private.assignments_for_student(uuid, boolean)','private.assignment_readable_by(uuid, uuid)','private.check_hold_results()']) f order by 1,2"`; `grep -lE 'function (public\|private)\.(student_submit\|assignments_for_student\|student_assignments\|parent_child_assignments\|assignment_view\|work_returned_recipients\|assignment_readable_by)\b' supabase/migrations/*.sql \| tail -1` | `false`, `NO`, `boolean`. `assignments_check_hold_results\|O`. All 8 rows `t` and `{"search_path=\"\""}` (as `psql -At` prints it). Privileges (10 cells): `anon` `f` on all 5; `authenticated` `t` on the two public wrappers and `f` on the 3 private helpers (2 `t`, 8 `f`). The last file redefining any of them is `20261027100000_fair_results.sql` | DB |
| E-11 | 7.17, S1, S2 | Docs | r3b review and design, and the README runbook | `grep -c 'Resolved 2026, pending-requirements item 7' docs/requirements/release-3/r3b/review.md`; `grep -nE '^\| (F8\|F28) ' docs/requirements/release-3/r3b/review.md \| grep -c 'Resolved 2026'`; `grep -cE 'rule \(b\)\|rules \(a\) and \(b\)' docs/requirements/release-3/r3b/design.md`; `grep -c 'Hold results until I return them' docs/requirements/release-3/r3b/design.md`; `grep -c '^## Item 7 — Fair results: "hold results" switch, and returned work stays visible after leaving a class$' docs/delivery/2026-10-25-pending-requirements/01b-requirement-items-4-9.md`; `grep -c '^### A student leaves a class, or was enrolled by mistake (ADR-0007)$' supabase/README.md`; `grep -cE '\*\*\((a\|b\|c\|d\|e)\)' supabase/README.md` | `2`; `2`; `2` (the Student and Parent rows); `1` (D8); `1` (the link anchor's heading exists); `1`; `5` | — |

### Phase 2 — DB and API (no browser)

Apply **X1** first. Run from the worktree root.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-20 | 7.1 | Default | Off by default, on new rows too | `q "select count(*) from public.assignments where hold_results"`; `holdv $MD` | `0` (seed and X1); `f` | DB |
| E-21 | 7.1, 7.6 | Tutor sets it | The class tutor turns it on and off on a draft with a question | `hold tutor@local.test $MD true`; `holdv $MD`; `hold tutor@local.test $MD false`; `holdv $MD`; `hold tutor@local.test $MD true` | **200** `[{"id":"$MD","hold_results":true}]`; `t`; **200** with `false`; `f`; **200** `true` (left on for E-23) | DB |
| E-22 | 7.2 (paper half) | No questions | Paper homework can't hold, on update or insert | `hold tutor@local.test $MPD true`; `holdv $MPD`; `node $SCR/as.mjs tutor@local.test POST "/rest/v1/assignments?select=id" "{\"class_id\":\"$MATHS\",\"title\":\"e2e-item7 Insert held\",\"hold_results\":true}"`; `q "select count(*) from public.assignments where title='e2e-item7 Insert held'"`; seed paper `hold tutor@local.test $FRACP true` | **400**, message `hold_needs_questions`, code `P0001`; `f`. Insert **400** `hold_needs_questions`; count `0`. `$FRACP` (published paper): **400** `assignment_published` (the trigger checks the publish lock first); `holdv $FRACP` `f`. Never 500 | DB |
| E-23 | 7.1 | Lock and unlock | Locked once published; title edits still save; back to draft unlocks it | 1. `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/assignments?id=eq.$MD&select=id,status" '{"status":"published"}'`. 2. `hold tutor@local.test $MD false`. 3. `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/assignments?id=eq.$MD&select=id" '{"status":"draft","hold_results":false}'` (one statement). 4. `… '{"title":"e2e-item7 API draft B"}'`. 5. `… '{"status":"draft"}'`. 6. `hold tutor@local.test $MD false`; `holdv $MD`. 7. Publish again; `holdv $MD` | 1: **200**, `published`. 2: **400** `assignment_published`; still `t`. 3: **400** `assignment_published`; status still `published`, hold `t`. 4: **200** (`saveAssignment` never sends `hold_results`). 5: **200** `draft` (nobody started). 6: **200**; `f`. 7: **200**; `f` | DB |
| E-24 | 7.6 | Who can set it | Only staff who manage the assignment | Each against `$MD` back in draft (`q "update public.assignments set status='draft' where id='$MD'"`), then `holdv $MD` after each: `hold admin-aal2 $MD true`; `hold admin-aal2 $MD false`; `hold admin-aal1 $MD true`; `hold newadmin@local.test $MD true`; `hold tutor@local.test $ED true` (another class's tutor); `hold admin-aal1 $ED true` (aal1, but the NAPLAN tutor); `hold student@local.test $MD true`; `hold parent@local.test $MD true`; `hold anon $MD true`; `node $SCR/as.mjs student@local.test GET "/rest/v1/assignments?select=id,hold_results"` | aal2 admin: **200** `true`, then **200** `false`. aal1 admin on maths, `newadmin@`, tutor on NAPLAN: each **200 `[]`** (0 rows). aal1 admin on NAPLAN: **200** `[{"id":"$ED","hold_results":true}]` (Local Admin tutors NAPLAN, `seed.sql:111`; `teaches_class` needs no aal2), `holdv $ED` = `t`, then reset to `f` by SQL. Student, parent: **200 `[]`** (RLS, 0 rows). Anon: 401 or `[]`. Student GET: `[]`. `holdv $MD` stays `f` after every refused call; `holdv $ED` `f` after the tutor@ call and after the reset | DB |
| E-25 | Grants | Closed helpers | The private helpers aren't reachable; family list RPCs need a sign-in | `rpc tutor@local.test assignment_readable_by "{\"target_student\":\"$AARAV\",\"target_assignment\":\"$NP\"}"`; `rpc tutor@local.test check_hold_results`; `rpc anon student_assignments`; `rpc anon parent_child_assignments "{\"target_student\":\"$AARAV\"}"`; `rpc tutor@local.test student_assignments` | First two **404** (not exposed). Anon: **401** with `42501` (no execute), or 403 (record which); never 200. Tutor `student_assignments`: **403** `not_student` | DB |
| E-26 | 7.1 `[ASSUMPTION]` | Stale value | Deleting every question leaves `true` (accepted, harmless) | `hold tutor@local.test $MD true`; `node $SCR/as.mjs tutor@local.test DELETE "/rest/v1/assignment_questions?assignment_id=eq.$MD&select=id"`; `holdv $MD`; `q "select count(*) from public.assignment_questions where assignment_id='$MD'"` | Hold **200**; delete **200** with 1 row; `t` (recorded, known non-bug 8); `0`. E-34 checks the page hides the switch with 0 questions | DB |

### Phase 3 — hold results in the portal (D)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-30 | Smoke | Start-up | The app starts | `curl -s -o /dev/null -w '%{http_code}'` for `/`, `/portal/login`; open both at 1280 | Both **200**. 1 `h1` each; `<meta name="robots">` **≤ 1**; overflow 0; console 0; hosted 0 | D |
| E-31 | Smoke | Sign-in per role | Each active role signs in and stays signed in after a reload | `admin@`, `newadmin@`, `tutor@`, `student@`, `parent@`: sign in; final URL and `h1`; reload; again; sign out | `admin@` → `/portal/admin` (two-step from D). `newadmin@` → `/portal/account/two-step/setup`. `tutor@` → `/portal/tutor`. `student@` → `/portal/student`, `h1` `Hi Aarav`. `parent@` → `/portal/parent`, `h1` `Hi Local`. Same after reload. Console 0, hosted 0 on all five | D |
| E-32 | Smoke | Deactivated refused | `inactive@` can't sign in | Sign in with the seed password | `Email or password is incorrect.` shown; URL stays `/portal/login`; 0 auth-token keys in `localStorage`. Console: only **A1** | D |
| E-33 | 7.1, 7.2 | Switch appears with questions | A new draft shows the switch only once it has a question (X2) | As `tutor@`: Classes → Selective Entry Maths & Reasoning → Assignments → `New assignment`; title `e2e-item7 Held quiz`, due today + 7; `Save assignment`. On the new page, count checkboxes labelled `Hold results until I return them`. `Add question` → Q1 as X2 → `Save question`; count again; read the label, the hint, `aria-describedby`; checked and disabled state. Add Q2. `H1=$(q "select id from public.assignments where title='e2e-item7 Held quiz'")` | 0 questions: **0** switches (`Draft: students and parents can’t see this yet. …` shown). After Q1: **1** switch, unticked, enabled. Label exactly `Hold results until I return them`. The checkbox's `aria-describedby` names the hint, whose text is exactly `Students see their marks and the correct answers only when you return their work. This matters only when every question is multiple choice: work with a written question is always held until you return it.` It sits after the question list. Writes: only the assignment and question inserts | D |
| E-34 | 7.2, 7.1 `[ASSUMPTION]` | Paper: no switch | Paper drafts, published paper, and a draft whose questions were deleted show no switch (X3, E-26's `MD`) | As `tutor@`: create `e2e-item7 Paper draft` (no questions); count switches. Open `Fractions practice set 3` (published paper) and `/portal/assignments/$MD` (0 questions, `hold_results` `t`). Delete X3 in the UI | **0** switches on all three; `$MD` shows `No questions yet. Without questions, students hand this in on paper.`. PATCHes to `assignments` **0** | D |
| E-35 | 7.1, review 5 (O1) | Immediate tick | The tick shows at once, is disabled while it saves, and stays ticked until the reloaded value arrives (`7126f06`, `0d1b701`) | As `tutor@` on `H1`: delay the PATCH 1500 ms and the next `GET /rest/v1/assignments*` (the reload) another 1500 ms with `page.route(… setTimeout(() => r.continue(), 1500) …)`. Click the box. Read `checked`, `disabled` at +200 ms, at the PATCH response +100 ms (save done, reload not yet back), and after the reload response renders; count PATCHes and read the body. Unroute; reload the page; `holdv $H1` | +200 ms: **checked**, **disabled**; PATCH **1**, body `{"hold_results":true}`. After the save, before the reload: still **checked** and **disabled** (no flicker back). After the reload renders (`revision` changes, `995c9ee`): checked, **enabled**. After a page reload: checked; DB `t`. No error alert. Console 0 (a delayed request isn't a failed one) | D |
| E-36 | 7.1 | Off again; double click | Unticking saves; a double click sends one save | Untick: PATCH body, `holdv`. Then `dblclick` the box; count PATCHes; wait for idle; reload; read `checked`; `holdv $H1`. Leave it ticked (`t`) at the end | Untick: 1 PATCH `{"hold_results":false}`, DB `f`. Double click: **1** PATCH (the box is disabled after the first click), final state matches the DB. End: `t` | D |
| E-37 | 7.1 | Locked on publish | Publishing locks the switch and shows the locked note | `Publish to class`; read the dialog title and text; confirm; read the notice; read the switch, its description text; force-click it (`{ force: true }`); count PATCHes to `assignments` after the publish | Dialog `Publish this assignment?`, `Every student in Selective Entry Maths & Reasoning will see it and can start answering. Questions can’t be changed after this.`. Notice `Published. Students can see it now.`. Switch **checked**, **disabled**; text exactly `Locked because the assignment is published. Move it back to draft to change this.` (the hint is gone). Force-click: **0** PATCHes | D |
| E-38 | 7.1 (§6 leg 3) | Back to draft | Back to draft makes it editable again; publish locks it again | `Back to draft`; dialog `Move back to draft?` / `Students won’t see it until you publish again. This is only possible until someone starts.`; confirm. Read the notice and the switch. Untick (PATCH, `holdv`), tick (PATCH, `holdv`). Publish again | Notice `Moved back to draft.`. Switch enabled, hint back. `f` then `t`. Published again: locked, ticked, the locked note. Nobody has started `H1` yet (`res $H1` = `none`) | D |
| E-39 | 7.1, review 5 (O4) | Race: published elsewhere | A stale draft tab gets the switch's own message, and the box reverts (X4) | As `tutor@`: create `e2e-item7 Race quiz` with 1 question (stay on its page in tab A). In tab B, open it and `Publish to class`. In tab A (not reloaded) click the box. Read the alert, `checked`, `disabled`; `holdv` | Alert exactly `This can’t change once the assignment is published.` (`PORTAL_ERRORS.holdLocked`, `4a014f4`); **not** `Questions can’t change once the assignment is published.`. The box goes back to **unticked** (the saved value) and is enabled again in the stale tab (`isPublished` is stale). DB `f`. Console: only **A2** (one 400 `assignment_published`) | D |
| E-40 | 7.1, 7.2 | Race: no questions | A tick on a draft whose question was deleted elsewhere is refused and reverts | Tab B: `Back to draft`, then delete the race quiz's only question. Tab A (not reloaded): click the box. Read the alert, `checked`; `holdv`. Then delete X4 in the UI | Alert exactly `Add at least one question before holding results.`; box unticked, enabled; DB `f`. Console: only **A2** (one 400 `hold_needs_questions`). X4 gone | D |
| E-41 | 7.1, 7.6 (§6 leg 4) | Admin role | An admin manages the switch on another tutor's class (X5) | As `admin@`: maths class → `New assignment` `e2e-item7 Admin quiz`, 1 question; tick (PATCH status 200, DB `t`); publish (locked note); `Back to draft` (enabled); untick (`f`); delete X5 in the UI | Every save 200, no alert; the same texts as E-33, E-37, E-38. Console 0 | D |
| E-42 | 7.6 | UI permission boundaries | The switch is only on pages for staff who manage the work | Fresh context each: `tutor@` → `/portal/assignments/$ED` (NAPLAN, admin's class); `student@` and `parent@` → `/portal/assignments/$H1`; signed out → `/portal/assignments/$H1`. Read the final URL, `h1`, switch count, every `:55321` request. Then restore X1: `q "delete from public.assignments where id in ('$MD','$MPD','$ED')"`; `q "select count(*) from public.assignments where id in ('$MD','$MPD','$ED')"` = 0 | Tutor: `Not found` / `This page doesn't exist, or you don't have access to it.`. Student, parent: `You don't have access to this page`. Signed out: `/portal/login?next=…`. Switch count **0** everywhere. 4xx/5xx **0**; console 0. Strict (ruling 2, fixed in `92163b9`): on the student, parent and signed-out legs the only `:55321` request allowed is the layout's own access read; any `assignments`, `assignment_questions` or `assignment_answers` read fails the case. Expected: **0** such reads | D |
| E-43 | 7.3, 7.7 | Student submits held work | Aarav hands in `H1`: handed in, waiting, no answers shown | As `student@`: home → `H1` in **To do** with `Start`; open; choose B for Q1 (correct), B for Q2 (wrong); `Hand in`; read the dialog; confirm. Read the notice, status chip, counts of `Correct answer`, `Explanation:`, awarded chips (`N / M`). Capture the `student_submit` response and the next `student_assignment` JSON. Reload; read the notice. Home: section of `H1`. DB: `res $H1`; `q "select marked_by is null from public.assignment_results where assignment_id='$H1' and student_id='$AARAV'"`; `q "select awarded_marks from public.assignment_answers where assignment_id='$H1' and student_id='$AARAV' order by question_id"` (map by position). Repeat the page measurements after reload at 1280 and 360, light and dark (4 legs): overflow, contrast of the notice and chip, screenshots `$EVD/E-43-<w>-<theme>.png` | Dialog `Hand in your work?` / `You’ve answered every question. You can’t change your answers after this.`. Notice `Handed in! Your tutor will mark it soon.`; chip `Waiting for marking`. `Correct answer` **0**, `Explanation:` **0**, awarded chips **0**. `student_submit` body `"submitted"`. JSON: `status` `submitted`, `mark` null, every `correctOption` null, `explanation` `''`, `awardedMarks` null. After reload: `Handed in <date>. Waiting for your tutor to mark it.` [measure date]. Home: under `Waiting for marking`, not under `Marked and returned`. DB `submitted`, `t`, awarded `2` (Q1) and `0` (Q2). 4 legs: overflow **0**, contrast **≥ 4.5:1** | D |
| E-44 | 7.3, 7.6 | Parent before return | The parent sees "Waiting for marking", the child's answers, no marks or correct answers | As `parent@`: home → Aarav (`View progress`); read `H1`'s row status chip and mark cell; open the row. Read counts of `Their answer`, `Correct answer`, `Explanation:`, awarded chips; capture `parent_child_assignment` JSON and the `parent_child_assignments` row | Row chip `Waiting for marking`, no score in the mark cell. Page: `Their answer` **2** (answers show once submitted), `Correct answer` **0**, `Explanation:` **0**, awarded **0**. JSON: `correctOption` all null, `explanation` all `''`, `awardedMarks` all null, `mark` null; list row `status` `submitted`, `mark` null | D |
| E-45 | 7.6 | API: nothing before return | No RPC or table gives a family the marks or correct options | `rpc student@local.test student_assignment "{\"target\":\"$H1\"}" \| jq`-check as E-43; `rpc student@local.test student_assignments` (`H1` row); `rpc parent@local.test parent_child_assignment "{\"target_student\":\"$AARAV\",\"target_assignment\":\"$H1\"}"`; `rpc parent@local.test parent_child_assignments "{\"target_student\":\"$AARAV\"}"`. As `student@` and `parent@`: `GET /rest/v1/assignment_questions?select=correct_option,explanation&assignment_id=eq.$H1`, `GET /rest/v1/assignment_answers?select=awarded_marks&assignment_id=eq.$H1`, `GET /rest/v1/assignment_results?select=mark&assignment_id=eq.$H1` | Every RPC 200 with `correctOption`/`correct_option` null, `explanation` `''`, `awardedMarks` null, `mark` null, `comment` `''`. All six table GETs **200 `[]`** | DB |
| E-46 | 7.4 | Tutor sees held work | The submission shows the auto-marks and can be returned at once | As `tutor@` on `H1`: read Aarav's row in `Submissions` (status, score) and the progress text. `Mark` → read the heading, `Handed in <date>`, each answer's mark text, the score; the `Return to student` button's state | Row status `Submitted` (staff label), score `2 / 3` [re-check: `SUBMISSIONS.score`]. Progress `Returned 0 of N`, N = maths enrolments (3) [measure]. Heading `Aarav Demo’s work`. `2 / 2 (marked automatically)` and `0 / 1 (marked automatically)`. `Score 2 / 3`. `Return to student` enabled | D |
| E-47 | 7.4 (§6 leg 2) | Per-question feedback (UI) | The tutor can add feedback on each multiple-choice answer of held work, and the automatic marks stay (`6b082f0`) | On the same page: count fields labelled `Feedback on this answer (optional)` and mark inputs (`Marks (out of …)`); type `e2e-item7 Q1 feedback` on Q1; `Save`; read the notice; list the writes and their bodies; read the DB: `q "select q.position, a.awarded_marks, a.feedback from public.assignment_answers a join public.assignment_questions q on q.id=a.question_id where a.assignment_id='$H1' and a.student_id='$AARAV' order by 1"`. Then type 1,001 characters in Q2's field and read its value length; then **reload without saving** and read Q2's field and DB feedback | **2** feedback fields (one per answer), **0** mark inputs. `Saved.` once. Writes: one `PATCH /rest/v1/assignment_answers` per answer whose body has `feedback` and **no** `awarded_marks`, then one `PATCH assignment_results`. DB: `1\|2\|e2e-item7 Q1 feedback`, `2\|0\|` (marks unchanged). 1,001 characters: the field holds 1,000 (`maxLength`). After the reload: Q2's field is empty and its DB feedback `''` (the long draft was never saved). Console 0 | D |
| E-48 | 7.4 | Per-question feedback (DB) | The stored feedback stays hidden from the family until return | `rpc student@local.test student_assignment "{\"target\":\"$H1\"}" \| jq '.questions[0].feedback'`; same as `parent@` through `parent_child_assignment` | Both `""` (feedback shows only once returned; E-50 shows it after) | DB |
| E-49 | 7.4 | Return; email by cron | The tutor returns the held work; it's a staff return and the cron sends the email | `curl -s -X DELETE $MP/api/v1/messages`; `q "$CRON_STATE"` = `t`. As `tutor@`: overall comment `e2e-item7 nice work`; `Return to student`; read the dialog; confirm; read the notice. `q "select status, marked_by='$TUT' from public.assignment_results where assignment_id='$H1' and student_id='$AARAV'"`; `ob $H1`. Poll `ob $H1` every 30 s up to 6 min; record the time to `sent`. `mp_subj student@local.test`; `mp_subj parent@local.test`; the plain text of each with URLs stripped, `grep -cE '2 / 3\|e2e-item7 nice work\|Q1 feedback'`; the `View feedback` hrefs (keep for E-67) | Dialog `Return this work?` / `Aarav Demo and their parents will see the marks, feedback and comment.`. Notice `Returned. The student and their parents can see the marks now.`. DB `returned\|t`; Q2's stored feedback `''` and Q1's `e2e-item7 Q1 feedback` (`q "select q.position, a.feedback from public.assignment_answers a join public.assignment_questions q on q.id=a.question_id where a.assignment_id='$H1' and a.student_id='$AARAV' order by 1"`). `ob` `parent:pending:-`, `student:pending:-`, then both `sent` within **≤ 6 min** [measure the time]. Subjects `Your work has been marked: e2e-item7 Held quiz` and `Aarav's work has been marked: e2e-item7 Held quiz`. Mark, comment and feedback in the email: **0**. Student link path `/portal/student/assignments/$H1`; parent `/portal/parent/children/$AARAV/assignments/$H1` | D, DB |
| E-50 | 7.4 | Returned: everything shows | After return the student and parent see an ordinary return | As `student@`: `H1` page: chips (`Returned`, no `Past class`), `Your results`, `Correct answer` **2**, `Explanation: B is right`, `Explanation: A is right`, awarded `2 / 2`, `0 / 1`, `Comment from the tutor` with `e2e-item7 nice work`, `Tutor feedback: e2e-item7 Q1 feedback`; enabled radios **0**; `Hand in` buttons **0**. Home: `H1` under `Marked and returned` with its score. As `parent@`: child page row chip `Returned`, `Tutor: e2e-item7 nice work`; the assignment page as the student's, with the heading `Aarav’s results` (`RESULTS_TEXT.headingFor`) | All as listed. `Past class` count **0** (still enrolled). Console 0 | D |
| E-51 | 7.5 | Hold off unchanged | An all-multiple-choice quiz without hold still returns on submit, with no email (X6) | `curl -s -X DELETE $MP/api/v1/messages`. As `student@`: `Times tables warm-up`, answer the 3 questions, `Hand in`, confirm. Read the notice and chip. `q "select status, marked_by is null from public.assignment_results where assignment_id='$TABLES' and student_id='$AARAV'"`; `ob $TABLES`; `WORKER`; `mp_to student@local.test`; `mp_to parent@local.test`. Restore X6 | Notice `Handed in and marked. Here are your results.`; chip `Returned`; `Correct answer` shown. `returned\|t`. `ob` empty; worker 200 with nothing for `$TABLES`; Mailpit **0** and **0** | D, DB |
| E-52 | 7.7, 7.1 | Switch on phone and themes | Tutor and admin, draft and published, at 1280 and 360, light and dark (16 legs) | Create `e2e-item7 Matrix draft` (maths, 1 question) as `tutor@`. Legs: {`tutor@`, `admin@`} × {Matrix draft (enabled, hint), `H1` (locked note)} × {1280, 360} × {light, dark}. Per leg: overflow; checkbox box inside the viewport; label lines; hint or note lines; contrast of label, hint/note; screenshot of the switch `$EVD/E-52-<role>-<state>-<w>-<theme>.png`. Reset Appearance. Delete the Matrix draft | Every leg: overflow **0**; box inside the viewport; label **1** line at 1280, **≤ 2** at 360; hint **≤ 3** lines at 1280, **≤ 5** at 360 (O3); locked note **1** at 1280, **≤ 2** at 360; contrast **≥ 4.5:1** both themes; 1 `h1`. Console 0, hosted 0 | D |
| E-92 | 7.1, review 5 round 2 (finding 1), `995c9ee` | Slow connection: no flicker | On a throttled network the tick stays on through the save and the reload, both ways (run right after E-36, before E-37; `H1` is a ticked draft) | As `tutor@` on `H1` (draft, ticked): CDP `Network.emulateNetworkConditions` `{offline:false, latency:800, downloadThroughput:50000, uploadThroughput:20000}` (slow 3G-like). Untick. From the click until the network is idle plus 500 ms, sample `checked` and `disabled` every 50 ms. Then tick again and sample the same way. Remove the throttle; reload; read `checked`; `holdv $H1`. Record each phase's duration | Untick: every sample after the click is **unchecked** (0 samples checked); `disabled` from the click until the reload renders, then enabled. Tick: every sample is **checked** (0 samples unchecked); the same `disabled` pattern. PATCH **1** per click. After reload: checked; DB `t`. No error alert. Console 0, hosted 0. Durations recorded [measure] | D |
| E-93 | 7.1, review 5 round 2 (finding 2) | Reload brings back the old value (P4) | When the reload shows a value other than the one clicked, the switch shows that value and isn't stuck disabled (run after E-92, before E-37) | As `tutor@` on `H1` (ticked draft). `page.route` the first `GET /rest/v1/assignments*` after the PATCH: let it through, then rewrite its JSON so `hold_results` is `true` (the old value), standing in for another tab ticking it back. Untick. Wait for idle + 1 s. Read `checked`, `disabled`. Unroute; reload the page; `holdv $H1`; tick again so it ends `t` | After the forced reload: the box shows the reloaded value (**checked**) and is **enabled**. A box still unchecked and disabled after 1 s **fails** (ruling 4; fixed in `995c9ee`, expected to pass). After the real reload: it shows the DB value (`f`); after the final tick, `t`. Console 0 (the rewrite is a 200, not a refused request) | D |

### Phase 4 — leaving a class (03b §7.6 status table)

Apply **X7** first (Aarav, in the UI: `Fractions quick quiz`, choose an answer for Q1, leave
without handing in; `res $FRACQ` = `in_progress`). Before X8, Aarav's maths results are: `NP`
returned, `H1` returned, `WORD` submitted, `MOCK` marked, `FRACQ` in progress, `FRACP` and
`TABLES` none, `RATIO` draft. That covers every row of the status table except `not_submitted`, which
Aarav never has (a paper `not_submitted` row exists only for Leo); pgTAP covers it (`family_status`).

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-60 | 7.8 (§6 leg 1) | Remove from class (UI) | The admin removes Aarav from maths with the class page's button (X8) | As `admin@`: Classes → Selective Entry Maths & Reasoning → `Students` tab → Aarav's `Remove from class`; read the dialog; confirm. Read the student list; the writes; `q "select count(*) from public.enrolments where class_id='$MATHS' and student_id='$AARAV'"`; `q "select count(*) from public.assignment_results where student_id='$AARAV'"` before and after | Dialog `Remove from class?` / `Aarav Demo will be removed from this class. Their past marks are kept.`. Aarav gone from the list. Writes: exactly **1** `DELETE /rest/v1/enrolments…`. Enrolment `0`; results count **unchanged** | D |
| E-61 | 7.8, 7.10, 7.12 | Student home after removal | Only returned work stays, tagged | As `student@`: home. Read each section; titles; chips; the progress values; the timetable page | `To do`: `Nothing to do right now. Nice work!`. `Waiting for marking` section **absent**. `Marked and returned`: exactly **2** items, `Number patterns check` and `e2e-item7 Held quiz`, each with exactly one `Past class` chip, under the class name. Progress: `Done` `2 of 2` (known); `Average mark` `71%` (75 % and 67 %) [re-check]; `Handed in on time` [measure]. `My timetable`: `Selective Interview Preparation` only; `Selective Entry Maths & Reasoning` **0** | D |
| E-62 | 7.8, 7.11, 7.12 | Past-class pages, read-only | The two pages open, show everything, and offer no editing | As `student@`: open `NP` and `H1` from `See results`. Read: chips; `Correct answer` count; comment; `Tutor feedback:`; counts of enabled `input[type=radio]`, enabled `textarea`, `Hand in` buttons, `Saved`/`Saving…`; writes to `:55321` while on the pages (click an option label) | Each: `Returned` and `Past class` chips; results and correct answers shown (`NP`: `Comment from the tutor` with the seed comment; `H1`: `e2e-item7 nice work`, `Tutor feedback: e2e-item7 Q1 feedback`). Enabled radios **0**, textareas **0**, `Hand in` **0**. Writes **0** (no `student_save_answer`/`student_submit`) | D |
| E-63 | 7.10 | Hidden work by URL | Every non-returned or draft assignment from the class is hidden | As `student@`, fresh page each: `/portal/student/assignments/<id>` for `WORD` (submitted), `MOCK` (marked), `FRACQ` (in progress), `FRACP` and `TABLES` (not started), `RATIO` (draft) | Each: `Not found` / `This page doesn't exist, or you don't have access to it.`; no question text of that assignment in the DOM. Console: only **A3** (≤ 1 line each, the `student_assignment` 500) | D |
| E-64 | 7.8, 7.10, 7.11 | Student API after removal | Rule (b) reads, and every write refused | `rpc student@local.test student_assignments \| jq -c '[.[]\|{title,is_past_class,status}]'`; `student_assignment` for `NP` (`isPastClass`, `questions[0].correctOption`) and for each id in E-63; `student_save_answer` `{"target_assignment":"$NP","target_question":"$(qid $NP 1)","chosen_option":0}`; same on `$FRACQ`; `student_submit` `{"target_assignment":"$NP"}` and `$FRACQ`; `student_timetable`; the answers md5 (`md5(string_agg(…))` over Aarav's `assignment_answers`) taken **just before** the write attempts, and again after | List: exactly 2 rows, `Number patterns check` and `e2e-item7 Held quiz`, both `is_past_class` `true`, `returned`. `NP`: `true`, correct option not null. The 6 hidden ids: each **500** `P0002` `not_found` (ITEM3-FU-1). Both saves and both submits: **500** `P0002` `not_found`. Timetable: no row with class `$MATHS`. md5 before = after | DB |
| E-65 | 7.8, 7.12 | Parents after removal (X9) | Each linked parent still sees the returned work, tagged | Apply X9 (real invite, join). As `parent@`, then as Parent Two (X9): home; Aarav's child page (rows, chips, `Tutor:` lines, timetable); both assignment pages (chips, results); writes | Child page: exactly **2** rows (`Number patterns check`, `e2e-item7 Held quiz`), each `Returned` + `Past class`; `Tutor: …` lines; timetable `Selective Interview Preparation` only. Assignment pages: `Returned` + `Past class`, `Correct answer` shown, no editing controls. Writes 0. Same for both parents. Console 0 | D |
| E-66 | 7.8, 7.10 | Parent API after removal | The parent RPCs follow the same rules | As `parent@`: `parent_child_assignments` (`$AARAV`); `parent_child_assignment` (`$AARAV`, `$NP`) and (`$AARAV`, `$WORD`); `parent_child_timetable` (`$AARAV`). Step 4: open `/portal/parent/children/$AARAV/assignments/$WORD` in the browser | 2 rows, both past class; `NP` 200 `isPastClass` `true`; `WORD` **403** `42501` `not_found`; timetable without `$MATHS`. Step 4: `Not found` panel; console only **A3** (1 line) | DB, D |
| E-67 | 7.14 | Email links after removal | The E-49 "View feedback" links still open the page | Fresh contexts, signed out: open each kept href (host `localhost:5173`, `SITE_URL`) → sign in as that person → final URL, chips, results | Student: lands on `/portal/student/assignments/$H1`; parent: `/portal/parent/children/$AARAV/assignments/$H1`. Both show `Returned` + `Past class` and the results. Console **0**, hosted 0 (strict: no exception here) | D |
| E-68 | 7.16 | Past class on phone and themes | Student home, both student pages' `NP`, the parent child page and parent `NP` page at 1280/360, light/dark (16 legs) | Per leg: overflow; every `Past class` chip inside the viewport and not overlapping its neighbours (bounding boxes); chip text contrast; the chip row wraps (no clipped text); screenshots `$EVD/E-68-<page>-<w>-<theme>.png`. Reset Appearance | Every leg: overflow **0**; chips inside the viewport, no overlap; contrast **≥ 4.5:1**; 1 `h1`. Console 0, hosted 0 | D |
| E-69 | S5, 7.11 | Tutor side after removal (informational) | Staff can't return work for a student who has left | As `tutor@`: `H1` page `Submissions` (Aarav's row count); open `/portal/assignments/$WORD/students/$AARAV`. API: `node $SCR/as.mjs tutor@local.test PATCH "/rest/v1/assignment_results?assignment_id=eq.$WORD&student_id=eq.$AARAV&select=status" '{"status":"returned"}'`; `res $WORD` | Page: `Not found` panel (the roster comes from enrolments). API: **400** `not_enrolled`; `res` still `submitted`. Recorded as S5 (fails closed); not a defect. Aarav **not listed** in `Submissions`. Console **0** (no refused browser request happens here; no exception applies) | D, DB |
| E-70 | 7.13, 7.12 | Another student (X10) | Isla never sees Aarav's work; her empty "returned" list | Apply X10 (real invite and join). As Isla (`token:`): `student_assignments` (titles, statuses, marks); `student_assignment` `$NP` (`mark`, `comment`, every `selectedOption`, `response`); grep every Isla response body for `The gaps go up by 2`, `Great reasoning`, `e2e-item7 nice work`, `e2e-item7 Q1 feedback`. UI as Isla: home | Isla still in maths: her list has the maths work by rule (a), `Reasoning mock test 1` `submitted` (seed, `seed.sql:149`; UI `Waiting for marking`), every other row `not_started`; all `is_past_class` `false`, `mark` null. `NP`: `mark` null, `comment` `''`, all `selectedOption` null, `response` `''`. Grep **0**. Home: `Marked and returned` shows `Nothing returned yet.` (AC-7.12 empty text) | DB, D |
| E-71 | 7.13 | Another child's parent (X11) | Isla's parent can't see Aarav's work | Apply X11. As Parent Three (X11): `parent_child_assignments` (`$AARAV`); `parent_child_assignment` (`$AARAV`, `$NP`); `parent_child_timetable` (`$AARAV`). Step 3: open `/portal/parent/children/$AARAV` and `…/assignments/$NP`; Parent Three (X11) home | **500** `P0002` `not_found`; **403** `42501` `not_found`; **500** `P0002` [re-check]. Step 3: `Not found` on both; home lists Isla only. Console only **A3** (≤ 2 + ≤ 1) | DB, D |
| E-72 | 7.13 | Unlinked parent (X9) | A removed parent link sees nothing | As `admin@`: Aarav's page → Parent Two (X9)'s `Remove`; dialog `Remove this parent?` / `e2e-item7 Parent Two will no longer see Aarav Demo’s work. Their account stays, so you can link them again.` (full names, `admin-student.tsx:456`); confirm (`Parent removed.`). As Parent Two (X9): the three RPCs as E-71; step 4: Parent Two (X9) home; Aarav's child page URL | RPCs: **500** P0002, **403** 42501, **500** P0002. Home: `No children are linked to your account yet. Please contact AJ Classes.`. Child page: `Not found`; console only **A3**. `parent@` still sees the 2 rows (unchanged) | D, DB |
| E-73 | 7.13, S1 (b) | Deactivated student (X12) | A deactivated login sees nothing; parents still do | 1. `T=$(node $SCR/token.mjs student@local.test)`; keep a `student@` page open on home. As `admin@`: Aarav → Student account → `Deactivate`; dialog text; confirm (`Deactivated.`). 2. In the open student page: reload. 3. `rpc "token:$T" student_assignments`; `rpc "token:$T" student_assignment "{\"target\":\"$NP\"}"`. 4. Sign in as `student@`. 5. As `parent@`: Aarav's child page. Restore: `Reactivate` (`Reactivated.`); `student@` signs in | Dialog `Deactivate this account?` / `Aarav Demo will be signed out and lose access straight away. Their work and marks are kept.`. 2: signed out to `/portal/login`, or `Your student account isn’t active. Please contact AJ Classes.` (record which); console only **A4**. 3: both **403** `not_student`; never a row. 4: `Email or password is incorrect.`, console only **A1**. 5: still the 2 past-class rows (S1 (b)). After restore: sign-in works, home shows the 2 items | D, DB |
| E-74 | 7.13, S1 (a) | Roster row archived (X13) | Archiving the student cuts off the student and every parent | Keep a `student@` page open. As `admin@`: Students → Aarav's `Archive`; dialog; confirm. Aarav's admin page banner. Student page: reload (A4). `rpc student@local.test student_assignments`; as `parent@`: `parent_child_assignments`, `parent_child_assignment` (`$NP`); `parent@` home. Restore: `Show archived` → `Restore` | Dialog `Archive this student?` / `Aarav Demo will be hidden from the roster. Their classes and marks are kept.`. Banner `This student is archived, so they and their parents can’t see their work.`. Student: **403** `not_student`; page shows the refusal or signs out (record), console only **A4**. Parent: **500** P0002, **403** 42501; home lists `Noah Demo` only. After restore: all back (2 past rows) | D, DB |
| E-75 | 7.13, S1 (c) | Roster row deleted (rolled back) | Deleting the roster row deletes every result, so nothing shows | `$SCR/e75.sql`: `begin; delete from public.students where id='$AARAV'; select count(*) from public.assignment_results where student_id='$AARAV'; select set_config('request.jwt.claims', json_build_object('sub','$PAR','role','authenticated')::text, true); set local role authenticated; select count(*) from public.parent_child_assignments('$AARAV');` (expected to raise) `rollback;`. Then `q "select count(*) from public.assignment_results where student_id='$AARAV'"` | Results `0` inside; the RPC raises `not_found` (P0002). After rollback: the count equals the snapshot's | DB |
| E-76 | 7.13, S1 (e) | Assignment deleted | Deleting a past-class assignment removes it for the student and parents | As `tutor@`: `H1` page `Delete`; dialog `Delete this assignment?` / `It will be removed with all its marks and feedback. This cannot be undone.`; confirm. `q "select count(*) from public.assignment_results where assignment_id='$H1'"`. As `student@`: home; old `H1` URL (step 4). `rpc student@local.test student_assignments` | Count `0`. Home: `Marked and returned` has `Number patterns check` only (1 item, `Past class`). Step 4: `Not found`, console only **A3**. RPC: 1 row | D, DB |
| E-77 | 7.13 | Re-enrol | Re-enrolling shows everything by rule (a), untagged, writable | As `admin@`: maths class → `Students` → `Add student`; `Add a student` dialog, choose Aarav; `Add to class`. As `student@`: home; `rpc student@local.test student_assignments`; save an answer on `FRACQ` in the UI | **6** rows (the seed's 6 published maths assignments; `H1` was deleted in E-76), all `is_past_class` `false`; `To do` and `Waiting for marking` back; `Past class` chips **0**; the save shows `Saved` (200). Timetable shows both classes | D, DB |
| E-78 | 7.9, 7.10, 7.11, S4 | Class archived (X14) | Archiving keeps returned work readable and hides the rest; returning there now emails (informational) | As `admin@`: maths class → `Archive`; `Archive this class?` / `It disappears from the tutor’s pages and the timetable. You can restore it later.`; confirm; banner `This class is archived.`. As `student@` (still enrolled): home, timetable; `rpc` `student_assignments`, `student_save_answer` on `$NP` and `$FRACQ`, `student_submit` `$FRACQ`. As `parent@`: child page; `parent_child_assignment` (`$AARAV`, `$NP`) and (`$AARAV`, `$WORD`). S4 (informational): `curl -s -X DELETE $MP/api/v1/messages`; as `admin@` (archived classes are hidden from tutors) return `MOCK` (paper, Marked → Returned) on its page if the page allows it [measure]; `ob $MOCK`; `WORKER`; Mailpit counts; restore `MOCK` to `marked` and delete its new outbox rows. Restore X14 (`Restore`) | Student: 1 item (`Number patterns check`, `Past class`); the to-do and waiting items hidden; timetable `Selective Interview Preparation` only. RPC: 1 row past; saves and submit **500** P0002. Parent: 1 row past; `NP` 200, `WORD` **403**. S4: if the return is possible, `ob` 2 rows and 2 emails: **expected**, recorded, not a defect. After restore: 6 rows, none past | D, DB |
| E-79 | 7.12, 7.10 | Empty states (X15) | A student in no class: every empty text | As `admin@`: remove Isla from maths and interview (UI). As Isla: home and timetable. As Parent Three (X11): home card and Isla's child page. Restore X15 (re-enrol both) | Isla home: `Nothing to do right now. Nice work!`, `Nothing returned yet.`, no waiting section. Timetable `You’re not in any classes yet.`. Parent Three (X11) home card `Not in a class yet`. Child page `Nothing has been set yet.` and `Not in any classes yet.`. Console 0 | D |

### Phase 5 — family and email regression

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-80 | Regr. (item 3) | Paper return email | A tutor's paper return still emails the student and the one linked parent (X16) | Apply X16. `curl -s -X DELETE $MP/api/v1/messages`. As `tutor@`: `MOCK`, set Aarav from Marked to Returned, save. `ob $MOCK`; `WORKER`; `cat $SCR/worker.json`; `mp_subj` both; mark `42` and `Strong on patterns` in each text (URLs stripped). Restore `MOCK` (`marked`, delete its outbox rows) | `ob` 2 `pending` → worker 200 `sent: 2` → both `sent`. Subjects `Your work has been marked: Reasoning mock test 1`, `Aarav's work has been marked: Reasoning mock test 1`. Parent Two (X9) (unlinked in E-72) gets **0**. Mark and feedback **0** | D, DB |
| E-81 | 7.14, regr. | Waiting email after removal | A staff return queued while enrolled is still sent after removal, and its links open | `curl -s -X DELETE $MP/api/v1/messages`. As `tutor@`: `/portal/assignments/$WORD/students/$AARAV`, marks 3 and 3 on the written answers, `Return to student`. `ob $WORD` (2 pending). As `admin@`: remove Aarav from maths (UI). `WORKER`; `ob $WORD`; `q "select count(*) from public.email_outbox where kind='work_returned' and assignment_id='$WORD' and status='skipped'"`; Mailpit subjects; open both links signed in. Restore, in this order: re-enrol (UI); `awarded_marks = null`, `feedback = ''` on `WORD`'s positions **2 and 3** only (SQL); result `status='submitted'`, `mark=1.0`, `feedback=''`, `marked_by=null` (SQL, `session_replication_role = replica` if a trigger refuses); delete its new outbox rows; `$CRON_ON`; `res $WORD` = `submitted` and the E-12 snapshot row matches | Worker 200 `sent: 2`; skipped **0**. Subjects `… Word problems set 1`. Both links open with `Returned` + `Past class`. Console 0. Cron `t` after restore | D, DB |
| E-82 | Regr. | Family pages on the seed | Existing family pages behave as on `develop` | After every restore: as `student@`: home (sections, `See results`, progress), `NP` page, `My timetable`, Account. As `parent@`: home (both children; Noah's `Can Noah Demo use the portal?` (`fullName`, `parent-home.tsx:173`)), Aarav's and Noah's child pages, `NP` page. Count `Past class` everywhere | Same sections and titles as E-12's snapshot implies (To do: `Fractions practice set 3`, `Fractions quick quiz`, `Times tables warm-up`; Waiting: `Word problems set 1`, `Reasoning mock test 1`; Returned: `Number patterns check`). `Past class` **0**. Console 0, hosted 0 | D |

### Phase 6 — close-out

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-90 | All | Data restore | The local data is back to the seed | Restore X7. Delete X9, X10, X11 as the E2E invite spec's cleanup (guardian links, audit rows by actor or target, `profiles`, `auth.users`); Isla's `profile_id` and consent columns back by SQL. `q "select count(*) from public.assignments where title like 'e2e-item7%'"`. Re-take the E-12 snapshot into `$SCR/snapshot-end.txt`; `diff`. `q "select count(*) from public.profiles where email like 'e2e-%'"`; same on `posts` and `enquiries`. `q "select count(*) from public.email_outbox where status in ('pending','sending')"`. `q "$CRON_STATE"`. Stop D | `e2e-item7%` assignments **0**. `diff` empty (Aarav's enrolments, results, answers md5, classes active, guardians count, Isla's columns). `e2e-%` **0**, **0**, **0**. Outbox waiting **0**. `t`. Port 5173 free | DB |
| E-91 | §0.3, all | Console and hosted total | Every browser leg was clean | Sum the harness counters over every browser leg of E-30 to E-82, E-92 and E-93; list each leg and its counts in the TSR | Console errors and `pageerror` **0** on every leg, except the pre-declared A1 (E-32, E-73), A2 (E-39, E-40: 1 each), and A3 and A4 (each line listed). Hosted requests **0** in total | D |

---

## 3. AC → case map

| AC | Cases |
|---|---|
| 7.1 The switch (default off, saves, locked on publish, server refuses after publishing, back to draft unlocks, any assignment with questions) | E-10, E-20, E-21, E-23, E-24, E-26, E-33, E-35 to E-41, E-52, E-92, E-93 |
| 7.2 Not offered on paper (built half) | E-22, E-34, E-40. **File hand-in half: not covered (T2.15)** |
| 7.3 Submit with hold on | E-43, E-44, E-45 |
| 7.4 Tutor return (auto-marks, comment, per-question feedback, staff return, email) | E-46, E-47, E-48, E-49, E-50 |
| 7.5 Hold off unchanged | E-51 |
| 7.6 Permissions | E-24, E-25, E-42, E-44, E-45 |
| 7.7 Switch at 360 px, light and dark | E-43, E-52 |
| 7.8 Removed from a class | E-60 to E-62, E-64, E-65, E-66 |
| 7.9 Class archived | E-78 |
| 7.10 What stays hidden | E-61, E-63, E-64, E-66, E-78, E-79 |
| 7.11 Read-only (save, submit; upload/remove is item 2's) | E-62, E-64, E-69, E-78 |
| 7.12 Labelled; "Nothing returned yet." | E-61, E-62, E-65, E-70, E-79 |
| 7.13 Boundaries (other student, other parent, deactivated, unlinked, roster row, assignment deleted, re-enrol) | E-70 to E-77 |
| 7.14 Email links after leaving | E-67, E-81 |
| 7.15 Files | **Not covered (T2.15)** |
| 7.16 Past class at 360 px, light and dark | E-68 |
| 7.17 Docs | E-11 |
| Review 5 fixes (immediate tick and revert, `holdLocked`; round 2 no flicker, never stuck) | E-35, E-36, E-39, E-40, E-92, E-93 |
| Security S1 runbook (a)–(e), S4, S5 | E-11, E-74 (a), E-73 (b), E-75 (c), E-72 (d), E-76 (e), E-78 (S4), E-69 (S5) |
| Grants after drop and recreate | E-04, E-10, E-25 |
| Smoke and sign-in | E-30, E-31, E-32 |
| Family and email regression | E-12, E-49, E-51, E-80, E-81, E-82 |
| Repo checks (`test:smoke`, `test:csp`) | E-04 to E-09 |
| Safety, console and hosted | E-01 to E-03, E-91 |

**Total: 69 cases** (phase 0: 3, phase 1: 9, phase 2: 7, phase 3: 25 (E-30 to E-52, plus E-92 and
E-93, which run after E-36), phase 4: 20, phase 5: 3, phase 6: 2). The TSR's pass rate counts every case; BLOCKED counts as not passed. None needs Saurabh.

## 4. Not covered by this plan

1. **AC-7.2's file hand-in half and all of AC-7.15**, plus AC-7.11's "upload or remove": item 2 is
   held, and no file controls exist on this branch. They move to item 2's re-test, **T2.15** (03b §9,
   04b §7, including security S3 (a)–(c)).
2. **The hosted migration** and the hosted grant check (security residual 3): Saurabh's release steps
   (03b §7.8). Never run from here.
3. **Real devices, Safari, Firefox, keyboard-only and screen-reader passes.** The browser legs are
   Chromium at emulated widths. The hint's `aria-describedby` is measured (E-33), not listened to.
4. **Hosted latency** for the immediate tick (O1, fixed in `7126f06` and `0d1b701`): measured locally
   with forced delays (E-35) and CDP throttling (E-92), not against the hosted project.
5. **A save or reload that throws** (`8cf5689`'s `finally` path): the dev notes say it isn't
   unit-tested; E-93 covers a reload that returns the old value, not one that throws. Forcing a thrown revalidate
   in the browser would need a code change, so it's left to review.
6. **Lighthouse and structured data:** item 7 changes no public page; `test:csp` and smoke run (E-05,
   E-06).
7. **Item 8's `email_recipients`** replacing `work_returned_recipients`: tested in item 8's plan.
8. **Security S6** (pre-existing, accepted residual): staff can change `awarded_marks` on a multiple-choice
   answer through the API. The portal never sends it since `6b082f0` (E-47 asserts that); the follow-up is
   a `check_assignment_answer` guard.
9. **The other staff loaders' wrong-role reads** (dev notes Round 3, deferred to the E-60 follow-up):
   `assignments.tsx`, `classes.tsx`, `class-detail.tsx`, the timetable and the tutor dashboard still read for
   a family role. Only the assignment and marking pages are in E-42.
10. **Security S1 and S2** are accepted residuals (known non-bugs 1–2); **S4** and **S5** are informational
   (E-78, E-69).
