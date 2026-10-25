CHANGES_REQUESTED

# Review 6a — item 4 test plan, round 1

**Plan reviewed:** `56601bf`, 75 cases.

**Checked against:** 01b AC-4.1–4.10, 03b §4.7, dev notes D2, Security S1–S4 and review 5. Expected results were compared with the landed code, and read-only queries were run on the local stack. HEAD moved during the review: `dfcd372`, `beb59f0`, `7fb4c31`, `9711224` and `1996c62` all landed.

**What already holds:**
- Every AC has measurable cases, and S1 has five.
- The hosted guards E-01 to E-05 are hard stops.
- The D2 grep builds its pattern from the stored numbers.
- The console rulings are narrow: A1 is E-42 only, A2 is E-51/E-53 only, and E-91 holds the totals.
- Fixtures are restored after each case.

## Blocking

1. **E-23 can't reach `invalid_input`.** `complete_onboarding()` refuses with `password_not_set` before it gets that far. **Fix:** set the password with the invitee's token first and assert `password_set_at is not null`. The expected result stays 400 `invalid_input`.
2. **E-25's "`updated_at` still U" will fail.** The before-update trigger always sets `now()` when `phone` is in the update. **Fix:** drop that expectation or make it record-only. Keep "200 and audit unchanged".
3. **The freeze header, E-07 and E-96 describe fixes as still to come, but they have landed.**
   - Set `FIX=1996c62` or later.
   - E-07: give the expected file list explicitly. That is about 20 files under `apps` and `supabase`, including `activity.service.ts`, `staff.service.ts`, `staff-client.ts` and `staff-access.test.ts`; recount at freeze.
   - E-02/E-96: S1 was edited in place in `20261026100000`, so remove the "or a new file" branch.
   - E-04: add `staff-access.test.ts`.
4. **E-95 tests only the happy path of the `invited` exemption.** Add two checks:
   - Before setup, an aal2 admin PATCHing the invited admin's phone gets 200 `[]` and the phone stays null.
   - After joining, the new admin at aal1 changing their own phone gets 400 `insufficient_aal`.

## Minor

5. **E-22, E-23, E-94, E-95:** start the dev server after E-06 kills it. Give E-22 and E-23 a console/hosted expectation of 0, and add them to E-91.
6. **E-59:** the console wording contradicts itself. It should read "0; any line fails; record alert vs redirect".
7. **E-60:** the note is stale, because `1996c62` has landed. Add `/portal/admin/activity` legs for a tutor, a student and a parent.
8. **E-90:** add Isla's consent columns and the `student_guardians` count to the snapshot, plus a `banned_until` check for the tutor.
9. **Commands to define:**
   - add `pp()` to §1;
   - spell out the X2 `set-active` call;
   - add `token.mjs`;
   - replace the prose `signIn` calls in E-21.
10. **E-96:** also `grep -c` for the break-glass text in `supabase/README.md`, expecting 1.

## Next

The Tester fixes 1–4, ideally 5–10 as well, then freezes. A second round isn't needed if the changed lines are listed in the TSR header.
