APPROVED

# Review 5b — item 3, round 2 bug fixes (BUG-5 to BUG-8)

- **Scope:** `git diff 4af50eb..1dc433c` in `aj_classes` (`fdcf317`, `c877f4a`, `1dc433c`), plus E2E repo `0ceb308`.
- **Read against:** BUG-5 to BUG-8, `05-dev-notes-item-3.md` §9, `03-design.md` (§3.2, §3.10), `06-security-item-3.md` and `CLAUDE.md`.
- **Checks run:** format:check, lint, typecheck and `pnpm test` (48 files, 360 tests) all pass. `db:test` was not run because the Tester was using the local stack; the pgTAP results are the developer's (454 pass).
- **Recorded by:** the team lead, from the Reviewer's hand-back. The Reviewer has no write access.

## Answers to the brief

1. **BUG-5.**
   - The redefined `check_assignment_result` body equals the original from `20261007090320` except for the new `elsif` (lines 516-520).
   - Only active staff (`by_staff`) reach that branch. Students and parents have no direct write, and an automatic return still leaves `marked_by` null and sends nothing (`email_outbox.test.sql:143`).
   - No duplicate emails: the unique constraint `email_outbox_once` with `on conflict do nothing` blocks a second row, and the trigger returns early when the old status is already `returned`. A return that sent nothing before can now send once, on a new staff return. That is AC-3.1 behaviour and fits security review row 38.
   - The seed's follow-up update fires no trigger branch and queues nothing.
2. **BUG-7.** `42501` fits the role checks, and the UI still maps `not_found` correctly, because `toErrorKey` checks the message before the code. `require_my_child` and `student_assignment` still raise `P0002` (see finding 1).
3. **BUG-6.**
   - The layout guard uses the same `getSession()`, so the services and the guard can't disagree about "signed out".
   - An expired token is refreshed; a refresh that fails gives `notAllowed` and then a redirect.
   - `ssr:false`, and the family routes aren't pre-rendered.
   - No regression or extra request for signed-in users.
4. **BUG-8.** The spec selects exactly the anon column grant, and it asserts that an `author_id` read is refused with `42501`.
5. **Tests.** The new tests fail without the fixes. For gaps, see findings 4 and 5.

## Findings

1. **Non-blocking.** `20261025110000_work_returned_email.sql:526-529`: the comment says "as the other family functions do". The "not yours" helper `require_my_child` raises `P0002`, so `parent_child_assignments`, `parent_child_timetable` and `student_assignment` still answer 500. `student_assignment` can be reached from an item 3 email after the student is unenrolled or the work is unpublished. Fix the comment now, and either widen the change or open a ticketed follow-up.
2. **Non-blocking.** `20261025110000…:516-520`: a staff return records the returner as the marker. `ResultCard` then shows "Marked by <returner>" with the original time on imported or orphaned rows. Accept this as the cost of design §3.2 and add a note to it. The longer-term option is a separate `returned_by` column.
3. **Non-blocking.** `supabase.client.ts:31`: the doc comment claims "no request", but `getSession()` may refresh the token. Reword it to "reads the stored session (refreshing it if expired); no data request".
4. **Non-blocking.** `family-signed-out.test.ts:50`: only 1 of the 7 reads is tested on the signed-in path. Optional: an `it.each` over `FAMILY_READS`.
5. **Non-blocking.** `email_outbox.test.sql:629-654`: no assert shows that an existing marker is kept on return. Optional: add one.
6. **Nit.** E2E `admin-posts.spec.ts:191` and `:5`: the comment should cite the column grant in `20261025110100`, not `PUBLIC_POST_COLUMNS`. `PostRow` still includes `author_id`.

## Team-lead disposition
- 1: fix the comment before the merge (comment only). Widening `42501` is a ticketed follow-up, `ITEM3-FU-1`, Low.
- 2: add a note to `03-design.md` §3.2 before the merge.
- 3 and 6: fix the comment wording before the merge.
- 4 and 5: optional; follow-up `ITEM3-FU-2`.
