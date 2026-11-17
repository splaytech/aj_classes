# BUG-3 — A closed test's edit page still says people can take it

- **Row:** V-3 (lead visual, AC 4/5, ruling S-1). **Severity:** Minor (wrong statement to the admin). **Kind:** app bug, found by the lead from the round-1 screenshots.
- **Build:** `dc516b9`.

## Steps
1. As admin, open a released test whose closing time has passed (or press Close now), e.g. `t7-<RUN>-k-closed`.

## Expected
The page states the closed truth, in line with S-1 and the existing closing copy: people who haven't submitted can't see or take it; people who submitted still see their result.

## Actual
Under the `Released` and `Closed` chips, the info notice still reads "Released: students, parents and signed-up users can take it. It can only go back to draft until someone submits it." (`MOCK_TEST_EDIT_PAGE.releasedNote`, `apps/web/src/routes/portal/admin-mock-test.tsx:221`), directly above "Closed 18 Nov 2026, 7:27 am". Evidence: `run-1/shots/BR-1-closed-edit-375-dark.png` (and the other three sizes).

**Round 2 (`0ea0923`): retested, PASS.** BR-1c: `k-closed` shows the closed note, with S-1 wording and no "can take it"; `k-later` keeps the released note; `k-draft` keeps the draft note (`run-2/shots/BR-1-closed-edit-*`).
