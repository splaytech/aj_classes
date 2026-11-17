# 05 — Dev notes: mock test closing (Part A, ACs 1 to 9)

Dev Lead, branch `feature/mock-test-closing`, 18 Nov 2026. Built by the lead without specialists. Built from `01-requirement.md` Part A and ruling S-1 (AC 5, Saurabh's "if someone has submitted they should be able to see"). Part B (categories) is not built.

## What was built

| Commit | What |
|---|---|
| `9cba1b4` | Migration `20261119100000_mock_test_closing.sql`, pgTAP `mock_tests_closing.test.sql`, pins updated in `mock_tests_admin.test.sql` (admin list columns) and `open_sign_up_access.test.sql` (AC-26 function allowlist), regenerated `database.types.ts`. |
| `e584243` | Ruling S-1 in the migration and pgTAP; the web: service, dialogs, admin page and list, the taker list's Closed chip, constants, vitest. |
| (this commit) | e2e smoke: Close now after a student submitted; these notes. |

### Database

- `mock_tests.closes_at timestamptz` (nullable) and the check `mock_tests_closes_only_released` (`closes_at is null or status = 'released'`).
- No grant on `closes_at`: the existing table-level select lets admins read it (RLS is admin-only), and insert and update stay column-scoped to title and instructions.
- Closed means `closes_at <= now()`. `now()` itself counts as closed (AC 8).

Function signatures:

| Function | Change |
|---|---|
| `mock_release(target uuid, closes timestamptz default null) returns void` | Replaces `mock_release(uuid)`, which is dropped (see the deploy note). Refuses `closes <= now()` with `mock_closes_in_past`. |
| `mock_set_closing(target uuid, closes timestamptz) returns void` | New. Released tests only (`invalid_status` otherwise). Null clears the date and reopens the test. A past date or now is refused with `mock_closes_in_past`. |
| `mock_close_now(target uuid) returns void` | New. Released tests only. Sets `closes_at = now()` and works with submitted attempts. On a test that is already closed it does nothing: the first closing time is kept, and no error is raised. |
| `mock_withdraw(target uuid)` | Same rule as before. It also clears `closes_at`. |
| `mock_tests_admin_list()` | Dropped and re-created, because the return type changed: it gains `closes_at`. |
| `mock_tests_for_me()` | Dropped and re-created: it gains `closes_at`. It lists an open test, or a closed test where the caller's attempt is submitted (S-1). |
| `mock_test_open(target uuid)` | On a closed test it returns the result view if the caller submitted, otherwise `not_found` (404, `private.raise_mock_not_found()`). The JSON gains `closes_at`. |
| `mock_start`, `mock_save_answer`, `mock_submit` | A closed test is `not_found` for everyone, submitters included. An in-progress attempt is never auto-submitted. |

All three admin functions follow the existing pattern:

- `security definer` and `search_path=''`;
- `private.is_admin()` (active admin at aal2);
- the test row locked `for update` first;
- execute revoked from public, anon and authenticated, then granted to authenticated.

The replaced taker functions keep their lock order: test row `for share`, then the attempt row.

### Web

- **Service:** `releaseMockTest(testId, closesAt | null)`; new `setMockTestClosing(testId, closesAt | null)` and `closeMockTestNow(testId)`. `mock_closes_in_past` maps to `mockClosesInPast`.
- **`MockClosingDialogs.tsx`:**
  - `MockReleaseDialog` replaces the release ConfirmDialog. It keeps the same title, text and Release button and adds an optional "Closes" field (`DateTimePicker`, viewer's local time).
  - `MockClosingDialog` is Set closing date. It has the field and a Clear button, which is always shown so focus never drops (BUG-4).
- **Admin page:** shows "Closes <date time>" or "Closed <date time>", and a Closed chip next to Released. Actions: Set closing date, and Close now (a ConfirmDialog, only while open). After Close now, focus moves to the h1 (BUG-4 pattern). After Set closing date, MUI returns focus to the button, which stays on the page.
- **Admin list:** a Closed chip, and the "Closes …" or "Closed …" line under the status.
- **Taker list:** a Closed chip on a closed test the person submitted (S-1). No other taker UI changed.
- **Copy:** all of it is in `MOCK_CLOSING` and `MOCK_VALIDATION` (`mock-tests.constants.ts`).

## Assumptions and choices

1. Close now on an already closed test is a silent no-op that keeps the first closing time. Two admins pressing it at once both succeed.
2. A submitter on a closed test gets `not_found` from `mock_submit` and `mock_start`. The open view still gives their result.
3. A half-typed date in the picker is refused with "Enter a full date and time, or leave it empty." The picker reports no value until every part is filled, so without this check a half-typed date would have released a test that never closes. The check reads the field's own text through its input ref.
4. `now()` is the transaction start. A save or submit whose transaction began just before a Close now committed can still land, because it is ordered before the close. A call after the close commits is refused.

## Deploy note

The migration drops `mock_release(uuid)`. Apply the migration before the web deploys:
- the old web calls `mock_release` with only `target`, which still resolves through the default;
- the new web sends `closes`, which the old function lacks.

## Checks (lead, separate commands, 18 Nov 2026)

| Command | Result |
|---|---|
| `pnpm format:check` | fails only on `actionItems.md` and `supabase/.temp/linked-project.json` |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | vitest 110 files / 1077 tests passed; e2e unit 6/6; deploy-order 0 NOT OK |
| `VITE_APP_ENV=production pnpm build` | exit 0 |
| `pnpm db:reset` + `pnpm db:test` | `Files=24, Tests=1847`, PASS |
| `pnpm test:functions` | exit 0, 0 NOT OK |
| `pnpm --filter aj-classes-e2e test:smoke` | 17 passed (includes Close now) |
| CI-style build + `check:hosted-ref` + `test:csp` | 0 of 186 files; 23 passed |

## Not done

- No real-browser visual pass of the new dialogs (375 px, dark mode, picker popup). Vitest and the e2e smoke only.
- Part B (categories) is still in design.

---

# Part B — categories (ACs 10 to 29)

Dev Lead, 18 Nov 2026. Built by the lead without specialists, in the order of `04-plan.md` (every slice is ticked there). Design `03-design.md` was followed. The one deviation is listed under "Deviations".

## Commits

| Slices | Commit | What |
|---|---|---|
| 1, 2 | `45a7908` | Migration `20261120100000_mock_test_categories.sql`, plus the existing pgTAP and e2e fixtures tagged before release |
| 3 | `b74cf68` | `mock_tests_categories.test.sql` |
| 4, 5, 6a | `01234a1` | Option lists, parity test, service reads, `updateMockTestTags`, error mapping |
| 6b, 7a | `b3a732c` | Tag helpers, `MockTagFields`, `MockTestDialog` sends tags |
| 7b | `f50b26c` | Release dialog tags, `MockTagsDialog`, `MockTagLine`, admin edit and list pages, take page, the AC 29 scope test |
| 8 | `f129e09` | `filterMockTests`, `MockTestFilters`, taker list states |
| 9 | `ba21b20` | e2e: tag in the UI, release refused for a missing stream, edit the draft, release, Edit tags, taker filters and Clear |
| 10 | (this commit) | These notes; the parity test formatting |

## Database

- **`private.mock_test_options`:** RLS on, no grant, no policy. It holds 7 subjects and 6 streams, inside the marked seed block.
- **Columns on `mock_tests`:** `subject`, `stream`, `year_levels smallint[] default '{}'` and `any_year boolean default false`, with the checks `mock_tests_year_levels_valid` and `mock_tests_any_year_alone`. Grants are insert and update on these four columns only.
- **`private.check_mock_test_tags()`** (trigger `mock_tests_check_tags`, before insert or update; security definer, `search_path=''`, execute revoked). On UPDATE only, it does the locked read `for no key update` by `old.id`. It checks:
  - each new or changed subject or stream against the active options;
  - the years, in the design's order;
  - on a released row, that a set tag is not cleared, judged on the locked read (`mock_tag_kept`).

  All refusals are 23514 with the field in `hint`.
- **`private.check_mock_test_release_tags()`** (trigger `mock_tests_release_needs_tags`, `when (old.status = 'draft' and new.status = 'released')`): judges on its own locked read and raises `mock_tags_missing`.
- **Functions:** `mock_release(target uuid, closes timestamptz default null)` keeps its signature. Its locked `for update` read gains the tags, and it raises `mock_tags_missing` after the questions and closing checks. `mock_tests_admin_list()` and `mock_tests_for_me()` are dropped and re-created, each with the four tag columns added; the S-1 clause is copied verbatim. `mock_test_open(uuid)` gains `tags` in its JSON.
- **Implementation note on the guard:** the design's step 2 condition ("INSERT, or `new.subject is distinct from current_row.subject`") was first written as one boolean expression. PL/pgSQL still read `current_row` on INSERT and failed with `record "current_row" is not assigned yet` (the trap 03 §1.3.4 warns about). The fix is two flags, `subject_changed` and `stream_changed`, set inside the `if tg_op = 'UPDATE'` block. The design's rules are unchanged.

## Web

- **Constants:** `MOCK_TEST_SUBJECTS`, `MOCK_TEST_STREAMS`, `MOCK_TAG_ANY`, `MOCK_TAGS`, `MOCK_TEST_FILTERS`, the `MOCK_VALIDATION` tag texts and `columns.tags`. Five error keys.
- **`lib/mock-tests.ts`:** `mockYearsSet`, `missingMockTagFields`, `setMockTagFields`, `mockTagErrors(tags, required, kept?)`, `applyYearPick`, `mockSubjectText`, `mockStreamText`, `mockYearText`, `mockTagNamesText`, `sameMockTags` and `filterMockTests`.
- **Components:** `MockTagFields`, `MockTagsDialog`, `MockTagLine` and `MockTestFilters`. `MockTestDialog` and `MockReleaseDialog` are changed.
- **Pages:**
  - admin edit: a Tags card, a missing-tags hint on a draft, and Edit tags on released and closed tests;
  - admin list: a Tags column;
  - take page: the tag line;
  - taker list: filters and the two empty states.

## Deviations and readings

1. **Stream labels (deviation, forced by AC 11):** the design says to take labels from `findProgramme(slug)?.menuLabel`. `findProgramme` searches `TEMPLATE_PROGRAMMES`, which leaves out VCE, so the VCE stream would have shown as `vce`. The design's own parity assertion (each label equals the programme's `menuLabel`) could not pass that way. `MOCK_TEST_STREAMS` and `mockStreamText` look the slug up in `PROGRAMMES.items` instead. The behaviour is as specified, and a unit test pins "VCE Tutoring".
2. **`mockTagErrors` takes an optional third argument `kept`.** The design says the released-test dialog "gets `tagKeep`" while the release dialog gets the field message, but the two-argument signature can't tell the callers apart. `kept = true` selects `tagKeep`.
3. **Release button stays enabled with a tag missing:** the [ASSUMPTION] in 04-plan 7b.1, as designed. The dialog names each missing field and won't submit until all three are set.
4. **Filter selects use `displayEmpty`**, so "All" shows in the box. Without it an empty value renders blank.
5. **`set local role authenticated`:** `tests.authenticate_as` already does this (`set_config('role', 'authenticated', true)`), so the pgTAP file doesn't repeat it.

## Two-session checks (03 §7, 04-plan 3.7)

- **Setup:** local stack, `docker exec supabase_db_aj_classes psql`. Script: `scratchpad/race.sh`, not committed.
- **Sessions:** session 1 holds its transaction 4 s; session 2 starts 1 s later. "Admin" means the seeded admin with JWT claims at aal2 and `set local role authenticated`; "table owner" means `postgres`.
- **Fixture:** each order used a fresh, fully tagged draft with one question. All race rows were removed afterwards.

In every order session 2 blocked until session 1 committed (it returned within 3 ms of the commit), then failed as designed. No released test was left without a tag.

```
=== Order A: S1 mock_release, S2 clears subject
  S2: S2 starts 18:42:45.495391
  S2: ERROR:  mock_tag_kept
  S2: HINT:  subject
  S2: S2 returned (after its error or success) 18:42:48.455651
  S1: S1 done, holding 4 s 18:42:44.449251
  S1: S1 committed 18:42:48.454394
  after: status=released subject=maths stream=naplan any_year=true
=== Order B: S1 clears subject, S2 mock_release
  S2: S2 starts 18:42:49.684895
  S2: ERROR:  mock_tags_missing
  S2: S2 returned (after its error or success) 18:42:52.64881
  S1: S1 done, holding 4 s 18:42:48.639488
  S1: S1 committed 18:42:52.64698
  after: status=draft subject=NULL stream=naplan any_year=true
=== Order C: S1 clears subject, S2 (table owner) direct status = released
  S1: S1 done, holding 4 s 18:42:52.856408
  S1: S1 committed 18:42:56.862869
  S2: S2 starts 18:42:53.893126
  S2: ERROR:  mock_tags_missing
  S2: S2 returned (after its error or success) 18:42:56.865287
  after: status=draft subject=NULL stream=naplan any_year=true
=== Order C mirror: S1 (table owner) direct status = released, S2 clears subject
  S2: S2 starts 18:42:58.102461
  S2: ERROR:  mock_tag_kept
  S2: HINT:  subject
  S2: S2 returned (after its error or success) 18:43:01.082237
  S1: S1 done, holding 4 s 18:42:57.066584
  S1: S1 committed 18:43:01.075193
  after: status=released subject=maths stream=naplan any_year=true
=== Released tests with a missing tag after all four runs (must be 0):
0
cleanup: 0 race rows left
```

## Checks (lead, separate commands, 18 Nov 2026, on `ba21b20` plus this commit)

| Command | Result |
|---|---|
| `pnpm format:check` | fails only on `actionItems.md` and `supabase/.temp/linked-project.json` |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | vitest 117 files / 1138 tests passed; e2e unit 6/6; deploy-order exit 0 |
| `VITE_APP_ENV=production pnpm build` | exit 0 |
| `pnpm db:reset` + `pnpm db:test` | `Files=25, Tests=1947`, PASS. Includes `mock_tests_closing`, run after the categories migration |
| `pnpm test:functions` | exit 0, 0 NOT OK |
| `pnpm --filter aj-classes-e2e test:smoke` | 17 passed (the mock spec now covers tags, the release refusal, Edit tags and filters) |
| CI-style build + `check:hosted-ref build/client` + `test:csp` | 0 of 186 files; 23 passed |

## Not done

- **The tester-ui real-browser rows (DoD 12):** 375 and 1280 px, light and dark, a keyboard walk, AC 18, 23, 26, 27 and 28 by eye. Only vitest and the e2e smoke ran; no one has looked at the pages yet.
- **ADR-0012 Amendment 1:** read against the build and it matches. Not edited.

---

# Fix batch 1 (review-5 items 1 to 8, Test Manager F-1)

| Item | Commit | Change |
|---|---|---|
| 1, 3, 4, 5, 8 | `ffe68cc` | ADR-0012 Amendment 2 (closing); decision 5 points at the amendments; the Amendment 1 AC 15 reference is fixed. Focus goes to the heading after Clear filters and after Take back. A released test's years can change but not be emptied. `mockTagsMissing` is generic |
| 2, 6, 7, F-1 | (this commit) | See below |

- **Item 2: `clock_timestamp()`.** The closed checks now use `clock_timestamp()` instead of `now()`. This covers `mock_tests_for_me`, `mock_test_open`, `mock_start`, `mock_save_answer` and `mock_submit`, plus `mock_close_now`'s already-closed check and the value it sets.
  - Both migrations are edited in place, since neither is on hosted yet. The bodies copied into `20261120100000` are kept in step.
  - `mock_release` and `mock_set_closing` keep `now()` for their past-date check (lead ruling).
  - The pgTAP comparisons that assumed `closes_at = now()` now use `clock_timestamp()`. The categories file keeps the stamped value in a temp table.
- **Item 6: new pgTAP cases** in `mock_tests_categories.test.sql`:
  - the question is unchanged after the tag edits, on both a released and a closed test;
  - AC 25: a parent's visible set is the same before and after every released test is retagged.
- **Item 7: types and casts.** `pnpm db:types` gives no diff. The `as unknown as` casts on the two list RPCs are now plain `as` casts. The JSON returns of `mock_test_open` and `mock_submit` keep `as unknown as`, because their generated type is `Json`.
- **F-1: closing copy.** `setClosingText`, `confirmCloseNowText` and `closedNow` now say:
  - people who haven't submitted lose access, and anyone part-way through can't finish;
  - people who submitted still see their result.

  A vitest case pins this. The e2e selector for the notice is updated.

## Two-session check: a taker call that waits on Close now (review-5 #2)

- **Setup:** local stack, seeded admin at aal2 and `student@local.test`. Script: `scratchpad/race-close.sh`, not committed.
- **Order:** the taker's transaction (session 2) begins first, so its `now()` is earlier than the close. Session 1 then calls `mock_close_now` and holds its transaction for 4 s. Session 2 calls while the lock is held.
- **Result:** session 2 blocked until session 1 committed, then got `not_found`. Under the old `now()` predicate it would have landed. The attempt stayed unsubmitted and the answer unchanged. The rows were removed afterwards.

```
=== Submit begun before Close now, waiting on its lock
  S1: S1 closed, holding 4 s 19:28:24.021404
  S1: S1 committed 19:28:28.036179
  S2: S2 transaction begins 19:28:23.47308
  S2: S2 calls 19:28:24.984038
  S2: ERROR:  {"code":"P0002","message":"not_found","details":null,"hint":null}
  S2: DETAIL:  {"status":404,"headers":{}}
  S2: S2 returned 19:28:28.037618
  after: closes_at set=true, attempt submitted=false, answer=0
=== Save begun before Close now, waiting on its lock
  S2: S2 transaction begins 19:28:28.242199
  S2: S2 calls 19:28:29.744746
  S2: ERROR:  {"code":"P0002","message":"not_found","details":null,"hint":null}
  S2: DETAIL:  {"status":404,"headers":{}}
  S2: S2 returned 19:28:32.788996
  S1: S1 closed, holding 4 s 19:28:28.783512
  S1: S1 committed 19:28:32.786078
  after: closes_at set=true, attempt submitted=false, answer=0
cleanup: 0 race rows left
```

The categories two-session checks (orders A, B, C and the C mirror) were re-run on the edited migrations. Results are as before: `mock_tag_kept`, `mock_tags_missing`, `mock_tags_missing`, `mock_tag_kept`, and 0 released tests without a tag.

## Checks (lead, separate commands, after `db:reset`)

| Command | Result |
|---|---|
| `pnpm format:check` | only the two allowed files fail |
| `pnpm lint` and `pnpm typecheck` | exit 0 |
| `pnpm test` | vitest 117 files / 1144 tests; e2e unit 6/6; deploy-order exit 0 |
| `VITE_APP_ENV=production pnpm build` | exit 0 |
| `pnpm db:test` | `Files=25, Tests=1951`, PASS |
| `pnpm test:functions` | exit 0, 0 NOT OK |
| `test:smoke` | 17 passed |
| CI-style build, `check:hosted-ref`, `test:csp` | 0 of 186 files; 23 passed |
