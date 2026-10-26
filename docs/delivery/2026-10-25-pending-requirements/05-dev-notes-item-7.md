# 05 — Developer notes: item 7 (hold results, and returned work outlives enrolment)

> **Stage:** 5 of /deliver (Developer) · **Date:** 26 Oct 2026 · **Branch:** `feature/fair-results`
> (worktree `aj_classes-items-4-9`, cut from `develop` @ `68f1729`, whose CI run is green; docs commit `6dcca6f`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 7 (AC-7.1–7.17), [02b](02b-architecture-items-4-8.md) §7,
> [ADR-0007](../../decisions/0007-returned-work-outlives-enrolment.md), [03b](03b-design-items-4-8.md) §7 and §9,
> [04b](04b-plan-items-4-8.md) §0 and T7.0–T7.10.
> **Next:** T7.11 Reviewer (`review-5-item-7.md`), then T7.12 Tester, T7.13 Security and T7.14 `/test-and-ship`.
> Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`). Nothing touched the
hosted project. I didn't read `supabase/.env.deploy`, and I didn't run `link`, `db push` or
`functions deploy`. There's one migration, no function change and no new dependency. 0 browser
requests went to `supabase.co`.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T7.0 Migration file | Done | Stack check 1 printed `1`; check 2 printed `20261026100000`. `supabase/migrations/20261027100000_fair_results.sql` is last in `ls supabase/migrations \| tail -2` |
| T7.1 Flag and guard | Done | Steps 1–2. AC-7.1 and AC-7.2 (paper half) in `fair_results.test.sql` |
| T7.2 Read rule and held submit | Done | Steps 3–4. AC-7.3–7.6. `family_portal.test.sql` (D8) green |
| T7.3 List builder, wrappers, view | Done | Steps 5–6. AC-7.8–7.11, AC-7.13, the grants row. Whole suite green |
| T7.4 Email recipients | Done | Step 7. AC-7.14 (DB half). `email_outbox.test.sql` green. `pnpm db:types`: only `database.types.ts` changed (`hold_results` ×3, `is_past_class` ×2) |
| T7.5 Hold switch | Done | `HoldResultsSetting` (4 tests), `auth-errors` (1 new test). Browser: §3 |
| T7.6 "Past class" for families | Done | `family-data.test.ts` (2), `StatusChips.test.tsx` (1). Browser: §3 |
| T7.7 Docs (AC-7.17) | Done | `r3b/review.md` F8 and F28 resolved, with the link; `r3b/design.md` D8 and the §4 student and parent rows |
| T7.8 Manual passes | Done, scripted (§3) | Some legs are left for the Tester (§6) |
| T7.9 Full check | Done | §2 |
| T7.10 Dev notes | Done | This file |
| T7.11–T7.14 | **Not started** | |

I didn't tick 04b. The Manager owns that file.

## 2. Commits and full check

Commits (oldest first):

1. `b26ed8e` feat(assignments): add a hold-results flag, locked once published (T7.0, T7.1)
2. `30952eb` feat(assignments): keep held quizzes Submitted until staff return them (T7.2)
3. `af63e26` feat(family): keep returned work readable after leaving a class (T7.3)
4. `279fd1d` feat(email): keep sending "work returned" to students who left the class (T7.4)
5. `9554421` chore(types): regenerate database types for hold results and past class (T7.4)
6. `1949982` feat(assignments): add the "hold results" switch to the assignment page (T7.5)
7. `368b34a` feat(family): tag returned work from a past class (T7.6)
8. `03a9dcb` docs(r3b): mark F8 and F28 resolved by item 7 and state rule (b) (T7.7)
9. This file (docs commit).

The migration grows across commits 1–4, one step group per task, so each commit leaves a
working database.

Full check, from the repo root, on `03a9dcb`, after `pnpm db:reset`:

| Step | Result |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` (web + e2e) | Pass |
| `test` | Vitest **59 files, 504 tests** (8 new); e2e unit 6/6 |
| `VITE_APP_ENV=production pnpm build`, local Supabase exports and the Turnstile test key | Pass |
| `pnpm --filter web check:hosted-ref build/client` | `0 files (of 153 scanned)` |
| `db:test` | **15 files, 581 tests, PASS** (`fair_results.test.sql` has 74) |
| `test:functions` | **169 `ok`, 0 failed**. "All checks passed." ×3 |
| `test:smoke` (in-repo, `e2e/.env` from `local-env.mjs`) | **9 passed** (44.5 s) |
| No-Supabase build (ci-gates.md Lighthouse flags), then `check:hosted-ref` | Pass, `0 files` |
| `test:csp` | **19 passed** (30.3 s) |

Rule checks: `kinet validate` can't run (KINET isn't initialised in this worktree; I didn't run
`kinet init`). Instead I grepped every changed TS/TSX file for `console.log`/`console.debug`,
`style={{`, `: any`, `TODO`, `fetch(`, `axios` and DOM queries: no matches. No secret-like strings
in the diff.

**Mutation check.** With `student_submit` reverted to auto-return and `work_returned_recipients`
reverted to `assignment_visible_to` (in the local database only, then reset), 11 of the 74
`fair_results` tests fail: every AC-7.3 and AC-7.6 hiding case, the AC-7.4 outbox count, and both
AC-7.14 recipient and claim cases.

## 3. Copied function bodies (for T2.15 and the Reviewer)

Each was checked as the current definition with
`grep -n "function <schema>.<name>" supabase/migrations/*.sql | tail -1` before copying. Each
body was copied by script from the exact lines below, and `diff` against the source shows only the
listed change.

| Function | Source file | Lines | Change |
|---|---|---|---|
| `public.student_submit(uuid)` | `20261007090321_family_functions.sql` | 463–527 | `create or replace`; the final branch gains `or (select a.hold_results … )` and a one-line comment |
| `private.assignments_for_student(uuid, boolean)` | `20261007090321_family_functions.sql` | 151–202 | Dropped and recreated: `is_past_class boolean` last column and expression; `left join public.enrolments`; `where` = rule (a) or (b) |
| `public.student_assignments()` | `20261007090321_family_functions.sql` | 347–371 | Dropped and recreated: `is_past_class boolean` in `returns table` |
| `public.parent_child_assignments(uuid)` | `20261007090321_family_functions.sql` | 574–598 | Same |
| `private.assignment_view(uuid, uuid, boolean)` | `20261007090321_family_functions.sql` | 206–267 | `create or replace`; `'isPastClass', summary.is_past_class,` after `'comment'` |
| `private.work_returned_recipients(uuid, uuid)` | `20261025110000_work_returned_email.sql` | 115–140 | `create or replace`; both `assignment_visible_to` calls become `assignment_readable_by` |

Grants for the three dropped functions are re-applied as `20261007090321` lines 786–831 apply them:
revoke from `public, anon, authenticated` on all three, then `grant execute … to authenticated` on
the two public wrappers. pgTAP checks that `authenticated` can still execute both and `anon`
can't. The new `private.check_hold_results()` and `private.assignment_readable_by(uuid, uuid)`
are revoked from `public, anon, authenticated` (step 8). `parent_child_assignment` and
`student_assignment` aren't redefined. They read the view, so rule (b) reaches them unchanged.

## 4. Browser pass (T7.8; dev server :5173, Chromium via Playwright, scripted)

The pass ran on the seed data plus two local-only drafts in the seeded maths class:
"Held warm-up (item 7 check)" (2 multiple-choice questions) and "Paper draft (item 7 check)".
It used `tutor@local.test`, `student@local.test` (Aarav Demo) and `parent@local.test`, at
1280 and 360 px, in light and dark (`colorScheme` emulation; the portal's default is "system").
Afterwards I ran `pnpm db:reset`, so those rows are gone.

| Leg | Result |
|---|---|
| AC-7.2 paper draft | No hold checkbox on the page |
| AC-7.1 / 7.7 draft switch, 4 variants | Enabled, unticked. Label 1 line in all variants. Hint 3 lines at 1280, **5 lines at 360** (O3). 0 px sideways overflow. Text `#172033` on white, `#E2E8F0` on `#131C31` |
| AC-7.1 tick | Saves: after a reload it's still ticked, and the database has `hold_results = true` |
| AC-7.1 publish | After "Publish to class", the box is disabled and ticked, with "Locked because the assignment is published. Move it back to draft to change this." (1 line at 1280, 2 at 360). 0 px overflow in all 4 variants |
| AC-7.3 student hands in | "Handed in! Your tutor will mark it soon." and the "Waiting for marking" chip show. No correct answer or explanation shows. Database: `submitted`, `marked_by` null |
| AC-7.4 tutor return | The submission page shows "1 / 1 (marked automatically)" and "0 / 1 (marked automatically)". The tutor adds an overall comment and clicks "Return to student". Database: `returned`, `marked_by` = tutor, 2 `work_returned` rows queued (Aarav and his one seeded parent) |
| AC-7.4 email | Both emails reached Mailpit **150 s** after the return (limit 5 min) |
| AC-7.8 / 7.12 / 7.16 removal | Aarav's maths enrolment row deleted (the same delete `removeEnrolment` sends). Student home, 4 variants: both returned maths items ("Held warm-up", "Number patterns check") show "Past class"; the maths to-do items are gone; 0 px overflow. The student assignment page shows "Returned" and "Past class" chips, the results and correct answers, no "Hand in" button and 0 enabled radios. Parent child page and parent assignment page, 4 variants each: "Returned" + "Past class" chips and the tutor's comment; 0 px overflow |
| AC-7.14 email links | After removal, the student's email link (`/portal/student/assignments/…`) and the parent's "View feedback" link (`/portal/parent/children/…/assignments/…`) both open the page, tagged "Past class" |
| AC-7.12 empty | With Aarav's returned results deleted, student home shows "Nothing returned yet." |
| Requests to `supabase.co` | 0 |

The screenshots (26) and `results.json` are in the session scratchpad, not the repo:
`/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/f3122f43-e1db-48f8-8b25-a31385abb4a2/scratchpad/shots/`.
I looked at the draft switch at 360 light, the student's handed-in page, student home at 360 dark,
the parent child page at 360 light and the past-class student page at 360 light. Nothing wraps
badly or overlaps.

**Observations (not changed):**

- **O1. The tick shows only after the save and the reload.** The checkbox is controlled by the
  loaded value, so a click disables it, saves, revalidates, and then shows the tick. Locally
  that takes 30–90 ms. On hosted Supabase the box could look unresponsive for a moment. It does
  look busy (disabled) while it waits. A small optimistic `pending` state would fix it if the
  Reviewer or Tester thinks it's worth it.
- **O2. `Typography color="text.secondary"` renders in the primary text colour across the
  portal.** I measured it on the new hint, on the existing "Total 2 marks" and on the question
  explanations: all are `#172033` in light and `#E2E8F0` in dark, the same as body text. Item 4's
  phone hint was `#4B5563`, but that's a form-field hint with its own styling. This was already
  on `develop` (MUI 9) and isn't caused by item 7. Contrast is well above 4.5:1. Worth a ticket,
  because "muted" text across the portal isn't muted.
- **O3. The hint is 5 lines at 360 px** (3 at 1280). The wording is the PO's (03b §7.5). A shorter
  version would be "Marks and correct answers show only when you return the work. Only matters
  when every question is multiple choice." That needs the PO or Saurabh to agree.
- **O4. The race-case error reads as if it's about questions.** If the assignment is published
  in another tab and the tutor then clicks the box, the server's `assignment_published` maps to
  `PORTAL_ERRORS.assignmentPublished`: "Questions can’t change once the assignment is
  published." 03b §7.5 chose that key. A dedicated "This can't change once the assignment is
  published." would be clearer. It's a one-key change if the PO agrees.
- **O5. Pre-existing:** at 360 px the "DEV" environment marker overlaps the start of the signed-in
  name in the header. That's the existing non-prod marker, not item 7.

## 5. Deviations and `[ASSUMPTION]`s

- **D1. Three cited line ranges were off; the copies use the real ones.** 03b cites
  `20261025110000` lines 115–138 for `work_returned_recipients`. The function ends at **140**:
  138 is the parent branch's `assignment_visible_to` line, and 139–140 hold the switch check and
  `$$;`. Copying 115–138 would have dropped the notification-settings check for parents. The
  other ranges differ only by a trailing blank line or the closing `$$;`: `student_submit`
  463–527 (cited 463–528), `assignments_for_student` 151–202 (cited 151–203),
  `student_assignments` 347–371 (cited 347–370), `assignment_view` 206–267 (cited 206–268),
  grants 786–831 (cited 786–830). §3 has the ranges I actually used. **T2.15 should use §3.**
- **D2. Two test fixtures outside the 25-file list.** `lib/assignments.test.ts` and
  `lib/family-progress.test.ts` build `AssignmentSummary` and `FamilyAssignment` literals. They
  gained `holdResults: false` and `isPastClass: false`, or typecheck fails. 27 files changed in
  total (with this file, 28).
- **D3. Extra pgTAP cases** beyond 03b §7.7:
  - hold is allowed and can be turned off on a draft with a written question (the AC-7.1
    `[ASSUMPTION]` "shown for any assignment with questions");
  - editing a published assignment's other fields still works with the new trigger, as
    `saveAssignment` never sends `hold_results`;
  - after removal, the worker's `notify_claim_emails()` still claims all 3 waiting
    `work_returned` rows for the held quiz and skips none (02b §7.1 point 6, end to end);
  - after removal, in-progress work can't be continued; in an archived class, not-started work
    can't be handed in.
- **D4. The hint is the checkbox's accessible description** (`aria-describedby` via `useId`), so a
  screen reader announces it with the label. The tests assert it that way.
- **D5. Where the chip sits on student home:** on its own line under the class name, wrapped in a
  `Box` with `mt: 1`, matching 03b §7.4's "under the class name".
- **D6. `[ASSUMPTION]` The manual removal deleted the enrolment row with SQL**, not through the
  class page's Remove button. `removeEnrolment` sends exactly that delete, so the database state
  is the same. The UI click itself is left for the Tester (§6).
- The 03b `[ASSUMPTION]`s hold as designed: a stale `true` after deleting every question is left
  as it is; the switch saves on change; past-class returned work counts in the progress summary
  (the browser showed "2 of 2 Done, 63%" after removal).
- **Not built (moved to T2.15, item 2 held):** the file hand-in half of AC-7.2 and all of
  AC-7.15. No item 2 code or migration is touched.

## 6. What I didn't verify (manual legs left for the Tester)

1. **The class page's "Remove" button** as the removal step (D6), and **archiving the class in
   the UI** followed by the family pages. Archive is covered by pgTAP only (AC-7.9, 7.10, 7.11).
2. **Per-question feedback on a held return** (AC-7.4 "per-question feedback"). I added only the
   overall comment.
3. **Back to draft in the browser**, then the switch editable again. This is covered by pgTAP
   (AC-7.1) and by the component reading `isPublished`, but I didn't click it.
4. **The admin role in the browser** (pgTAP covers `a1` aal2 setting the switch).
5. **Real devices.** Everything ran in headless Chromium with emulated colour schemes, not on a
   phone or in Safari or Firefox. Keyboard-only and screen-reader passes weren't done.
6. **Hosted behaviour:** none, by rule. O1's lag on hosted latency is unmeasured.
7. **Lighthouse and structured data** weren't run: T7.9 names only `test:smoke` and `test:csp`,
   and item 7 changes no public page.

## 7. Review fixes (after review-5-item-7 and 06-security-item-7, both APPROVED)

| Finding | Fix | Commit |
|---|---|---|
| Review 1 | The `notify_claim_emails()` count joins `email_outbox` on `kind = 'work_returned'` | `32ed149` |
| Review 2 | pgTAP (AC-7.13): after removal, deleting the returned assignment deletes its result, drops it from the student's list, and its page gives P0002 | `27d5d8e` |
| Review 3 | pgTAP, archive block: `parent_child_assignment(d1, e008)` isn't null; `e007` gives 42501 `not_found` | `314bc7d` |
| Review 4 (O4) | New `PORTAL_ERRORS.holdLocked`: "This can’t change once the assignment is published." `HoldResultsSetting` maps `assignmentPublished` to it. The generic `auth-errors` mapping is unchanged elsewhere. 1 new test | `4a014f4` |
| Review 5 (O1) | The switch shows the clicked value at once, disabled, until the save and `onChanged` (the page reload) finish. After a refusal it goes back to the saved value. `onChanged` may now return a promise. 1 new test, plus the refusal test checks the revert. Browser: on "Ratio worksheet" the box is ticked straight after the click, and still ticked after a reload. The script then clicked it again to untick it, putting the seed data back (and the next `pnpm db:reset` reset it anyway) | `7126f06` |
| Security S1 | `supabase/README.md` → Runbooks → "A student leaves a class, or was enrolled by mistake": the residual and admin steps (a)–(e), with the portal paths. There's no portal button for (c), so it's the SQL line | `1e28b48` |
| Security S2 | The same section: one tutor-guidance paragraph | `4a00530` |
| Security S3 | 03b §9 step 3 and 04b §7 T2.15 step 5 list the three item 2 rebase checks | `393635f` |

Not changed: O2 (muted text, already on `develop`) and O3 (hint length, PO wording), as review finding 6 says. S4 and S5 are informational, for the TSR.

Full check after the fixes, on `393635f`, after `pnpm db:reset`:

- format, lint and typecheck: clean.
- Vitest: **59 files, 506 tests**; e2e unit 6/6.
- Local-exports production build: `check:hosted-ref` 0 files of 153.
- `db:test`: **15 files, 586 tests**, PASS (`fair_results` 79).
- `test:functions`: 169 `ok`, 0 `not ok`.
- `test:smoke`: **9 passed**.
- No-Supabase build: `check:hosted-ref` 0 files. `test:csp`: **19 passed**.

### Round 2 (review-5-item-7 round 2, APPROVED; non-blocking findings)

| Finding | Fix | Commit |
|---|---|---|
| 1 Flicker after save | After a successful save, the clicked value stays until the `holdResults` prop changes (previous-prop-in-state). A refusal still reverts at once. The "tick at once" test now rerenders with the new value and checks there's no flicker before it arrives | `0d1b701` |
| 2 Stuck if a save or reload throws | `try … finally` clears the pending value unless the reload finished. The refusal tests cover the `finally` path. The throw path isn't unit-tested: a rejection from the change handler is unhandled by design, and Vitest fails the run on it | `8cf5689` |
| 3 Step (c) wording | `supabase/README.md`: do (a) or (b) first; check `select full_name …` before the delete; enrolments, parent links, results, answers, the row's consent and email rows all cascade (all 5 FKs to `students` are `on delete cascade`) | `3d1e2fb` |
| 5 Dev notes | §7 now says the script unticked the box again to restore the seed data | this commit |
| 6 Vacuous delete | pgTAP asserts the e008 result count is 1 just before the delete | `d5baae1` |

Finding 4 is skipped, as the team lead asked.

Checks after round 2:

- format, lint and typecheck: clean.
- Vitest: 59 files, 506 tests; e2e unit 6/6.
- `db:test`: 15 files, **587 tests**, PASS (`fair_results` 80).
- No build config changed, so the build and E2E weren't re-run.


### Round 3 (Tester findings from the item 7 test plan)

| Finding | Fix | Commit |
|---|---|---|
| Bug, AC-7.4 per-question feedback | The marking page shows the existing "Feedback on this answer (optional)" field on multiple-choice answers too. There's no mark field: the automatic mark stays. `saveSubmission` sends `feedback` only for those (`AnswerMark.awardedMarks` is omitted), through the same `assignment_answers` update and `feedback` column grant. New `submission.test.tsx` (3): the field shows on a multiple-choice answer with no mark field; it saves feedback only; written answers keep mark + feedback | `6b082f0` |
| Wrong-role read (the E-60 pattern) | New `getStaffClient()` in `staff-client.ts` (tutor or admin, else null). `getAssignment` uses it, and `getSubmission` calls `getAssignment` first, so neither page sends a read for a student, a parent or someone signed out. `staff-access.test.ts`: +10 cases | `92163b9` |
| P4, the box stuck on an unchanged reload | `HoldResultsSetting` takes a `revision` prop (the page's loader data object) and clears the clicked value in the render that first shows reloaded data, whatever its value. A why-comment in the component explains it. Reloads that land mid-save are ignored. New test: the reload comes back with the same old value, and the box shows it, enabled | `995c9ee` |

Still open (deferred to the E-60 follow-up): the other staff loaders, `assignments.tsx`, `classes.tsx`, `class-detail.tsx`, the timetable and the tutor dashboard, still send their reads for a family role. Only the assignment and marking pages use `getStaffClient()` so far.

Browser (local, scripted):

- A student who handed in "Times tables warm-up" then opened its staff URL and its marking URL: 0 requests to `assignments`, `assignment_answers` or `enrolments`.
- The tutor's marking page showed 3 feedback fields and 0 mark fields. Saving feedback on question 2 stored it, and the automatic marks stayed (0, 1, 0).
- The student's returned page showed the feedback (FamilyWork).
- The hold switch on "Ratio worksheet" ticked at once, settled ticked and enabled, then was unticked again by the script.

Full check after round 3, on `995c9ee` plus these notes, after `pnpm db:reset`:

- format, lint and typecheck: clean.
- Vitest: **60 files, 520 tests**; e2e unit 6/6.
- Local-exports production build: `check:hosted-ref` 0 files of 153.
- `db:test`: 15 files, 587 tests, PASS.
- `test:functions`: 169 `ok`, 0 `not ok`.
- `test:smoke`: 9 passed.
- No-Supabase build: `check:hosted-ref` 0 files. `test:csp`: 19 passed.

### BUG-15 (TSR round 1): refused sign-outs after a deactivation

**Cause, checked locally.** supabase-js 2.117.2's `signOut({ scope: 'local' })` still sends `POST /auth/v1/logout?scope=local` whenever there's a session (`GoTrueClient._signOut`), to revoke this session's refresh token on the server. It then clears storage, and it ignores a 401, 403 or 404 itself. Deactivation bans the account (`account-admin` `set-active`). Probed on the local stack:

- the ban leaves the session and its refresh token in place (1 session, 1 live refresh token before and after);
- `/logout` for the banned user answers **403 `user_banned`** and revokes nothing;
- a refresh with that token answers **400 `user_banned`**.

So the call can't do anything, and the browser logs each refused one. Both layout guards make it, in parallel, which gives two lines.

**Fix (`e748a61`, services and lib only).** For the guard's sign-out (it only happens for a deactivated account), `guardPortalPage` calls the new `forgetDeactivatedSession()`. That removes only this device's stored session (`clearStoredSession()` in `supabase.client.ts`: the session key plus the `-user` and `-code-verifier` copies). It sends no request, so both parallel guards can call it, and the second finds nothing.

- The storage key is pinned explicitly to supabase-js's own default (`sb-<first host label>-auth-token`), so nobody is signed out by the change.
- Sign-outs people choose (`PortalLayout`, join, two-step pages) still use `signOut()`, which revokes the session on the server.
- Residual: if a deactivation's ban step failed (`ban_failed`, which the admin already sees and retries), the account's refresh token isn't revoked on the server. It's removed from this device, and the database refuses the inactive profile's reads anyway.

**Tests.**

- `lib/portal-guard.test.ts`: two parallel guards for a deactivated account both redirect to `/portal/login?reason=inactive`, and `signOut` is never called.
- `services/supabase.client.test.ts` (3): the pinned key matches the default for local and hosted URLs; only the session's keys are cleared; a second clear finds nothing.

**Browser repro (local, scripted, the BUG-15 steps).** The student was signed in on `/portal/student`, then the admin deactivated Aarav Demo (banned). The student then reloaded.

| | Old guard (`8d29762`) | Fix |
|---|---|---|
| Landed on | `/portal/login?reason=inactive` | `/portal/login?reason=inactive` |
| `POST /auth/v1/logout` | 2, both 403 | **0** |
| Console errors | 2 ("Failed to load resource … 403") | **0** |
| Stored session afterwards | none | none |

A later visit to `/portal/student` goes to `/portal/login?next=…`, so the person stays signed out.

Full check after BUG-15, on `e748a61` plus these notes, after `pnpm db:reset`:

- format, lint and typecheck: clean.
- Vitest: **62 files, 525 tests**; e2e unit 6/6.
- Local-exports production build: `check:hosted-ref` 0 files of 153.
- `db:test`: 15 files, 590 tests, PASS.
- `test:functions`: 169 `ok`, 0 `not ok`.
- `test:smoke`: 9 passed.
- No-Supabase build: `check:hosted-ref` 0 files. `test:csp`: 19 passed.
