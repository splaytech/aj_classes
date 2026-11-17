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
