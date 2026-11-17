# Review 6a: test plan (`06-test-plan.md`, working tree), against `84d2691`

## Round 1

**CHANGES_REQUESTED**

Traceability is fine: all 53 live ACs map to at least one case, and the plan says why AC-39 (FS-3), real Google (FS-1) and real Resend (FS-2) can't be tested locally. About 45 expected values were sampled against the code, `seed.sql`, migrations, templates and read-only DB probes; three classes of mismatch, and HEAD moved past the pin.

1. **Blocking: seven expected values print booleans as `t`/`f`, but `||` concatenation gives `true`/`false`.** S-0 (:127), U-7 (:300), SU-7 (:452), CF-7 (:565), CAP-6 (:666), AD-3 (:775), AD-5 (:789). S-0's own query on the seed prints `admin@local.test|admin|active|true … inactive@local.test|tutor|active|false` (`seed.sql`:28-34, :83). So SU-7 → `user|invited|true|true|-`, CF-7 → `active|true|true|Priya Tester`, U-7 → `user|active|true`, CAP-6 → `false|true`, AD-3 → `false|true`, AD-5 → `true|true|false`. INV-1, FB2-4 step 2 and R-9 select separate columns, so their `t`/`f` is right. **Fix:** change the values or select columns separately.
2. **Blocking: CAP-2's clean-up fails, so the cap stays full for later cases** (:327-331). `db()` runs psql without `-q`, so `insert … returning id` appends `INSERT 0 15` to `ids`, and `delete … where id in ($ids)` is a syntax error (reproduced on a temp table: `CREATE TABLE,1,2,3,INSERT 0 3`). §0.3 (:108) prescribes the same pattern for CAP-1, CAP-3, CAP-4, CAP-5 without commands. **Fix:** `| grep -E '^[0-9]+$' | paste -sd, -` or `-q` in `db()`, and give each case the corrected command.
3. **Blocking (for the run): HEAD moved to `1562010`.** `d320e73` makes the clean-up skip deactivated and audited sign-ups (FB2-4's "`is_active = false` → deleted" becomes kept; "returns `2`" becomes `1`); `0c1c1f7` makes OTP-2 read "an 8-digit"; `1625b05` changes DEP-1's 50 `ok` and the FB2-1/FB2-2 greps; new pgTAP assertions change S-4's 1214. **Fix:** re-pin and re-sync; add an audited-row fixture to FB2-4.
4. **Non-blocking:** S-7 (:182) says 375 and 1280 px; the CSP spec uses 360 and 1280 (`e2e/csp/public-csp.spec.ts` `VIEWPORTS`). Count 23 is right.
5. **Non-blocking:** CF-6 (:546-551) never types a name; Full name is empty for e-mail sign-ups (FB2-5; `FinishSignUpForm.tsx`:53). Add "with a valid name" to (a)-(c).
6. **Non-blocking:** FB2-4 step 3 (:1033-1047) has no SQL for the eight `auth.users` inserts, and "S-0's seed list unchanged after rollback" is always true. Give the script, count survivors and seed accounts before `rollback`, and back-date seed profiles to 8 days inside the transaction.
7. **Non-blocking:** no case checks invites still work at the cap (AC-46) or while closed (AC-48). Add a staff invite to CAP-3 and CAP-6.
8. **Non-blocking:** AMR-1 misses `magiclink`, `email/signup`, a non-array claim and an entry with no method (migration :280-286). Probes give `magiclink t`, `"otp" f`, `[{}] f`.
9. **Non-blocking:** G-3 (:699-704) has no URL for `error_description=sign_up_refused` (`auth-callback.tsx`:50 → closed message).
10. **Non-blocking, new:** `supabase/templates/reauthentication.html`:36 still shows the `Staff` badge, and users now get this e-mail (finish step, Change password). 03 removed it only from `recovery.html` (03:286). Record in OTP-2 and V-5 for the lead.
11. **Non-blocking:** the inputs line (:4) says AC-1 to AC-55 (should be AC-56); AC-44 is traced only to "the suites pass" but names specific tests (Q3 linking rows, S1-S7 spikes, one sign-up-to-home e2e). Add a by-name existence check.

**Checked and correct at `84d2691`:** H-1, H-2, AMR-1's 9 rows, CAP-2's reply shape, CAP-5, CAP-9; U-6 (3), U-10 (4), `admin_list_users` aal1 refusal; DEP-2, OTP-1, the `join.tsx` grep, mobile `maxLength: 6`; cron `45 17 * * *` with 4 active jobs, FB2-4 step 2; CF-1 template and subject, CF-7 audit key order, AD-3 876000h ban, AD-6, INV-1 `replaced_sign_up`, INV-5/INV-6, U-9 (Mailpit); R-5's 23 URLs, R-8 3/6/2, U-4's 24 routes; SU-1 to SU-7, CF-2 to CF-6, CF-10, CAP-1, CAP-6, G-3, AD-1 to AD-7, UI-1, UI-2, OTP-2 to OTP-4. S-2, S-4, S-5, S-6 counts not re-checked.

## Lead note (round 1)

All 11 go back to the Tester. Item 10: lead ruling, the `Staff` badge comes off `reauthentication.html` (users get this e-mail now); the Developer makes that change and the Tester pins to the SHA that includes it.

## Round 2

**CHANGES_REQUESTED**

All 11 round-1 findings are fixed. Two expected values are still wrong, both from this revision, and each is a one-line fix.

**Round-1 checks, re-run read-only:**
- **S-0:** its query on the seed prints `…|active|true … inactive@local.test|tutor|active|false`, which matches :150.
- **`db -q` id capture:** on a session temp table copying `private.sign_up_emails` (identity id, 15 rows aged 25 h), it gives `1,…,15` with no `INSERT 0` line. Without `-q` it still gives `CREATE TABLE,1,2,3,INSERT 0 3`.
- **Pin:** `git diff 5e92ee6 HEAD -- apps/web/src supabase e2e package.json` is empty.
- **`pnpm test`:** 93 files, 844 tests, `ℹ tests 6`, `ℹ fail 0`, 53 `ok`, `All checks passed.`
- **1225 pgTAP:** the change in assertion calls is +6 for `84d2691..1562010` and +5 for `..5e92ee6`.
- **564 functions:** no function or INT script changed since `84d2691`, and review-5 has 564.

**Fresh values that matched the code at `5e92ee6` (over 12):**
- **FB2-4:** steps 1, 2, 4 and 5 match. The step 3 script, run as written in `begin … rollback`, printed `qualifies|stale`, `removed|1`, `fixtures left|8`, `stale left|0`, `stale profile left|0`, `seed left|7`, `second run|0`, then `0` after the rollback. Each kept fixture fails exactly one condition; `f606` without its audit row and `f605` set active both qualify again.
- **OTP-2:** `codeSent` reads "an 8-digit"; the `a 8-digit` unit test exists; `Code from the email`, `Email me a new code`, `We sent a new code.` and `Password changed…` match. `reauthentication.html` has no `Staff` and reads "on the AJ Classes portal".
- **OTP-3:** the `FinishSignUpForm` and `join.tsx` code fields use `emailCodeLength`.
- **CAP-3 and CAP-6:** staff invites go through `createUser` with `account_role: 'tutor'`, which skips the hook. Only the hook and `sign_up_status` read the switch or the cap. Subject, copy and the `sign_up_closed` audit row with a null target match.
- **AMR-1:** all 14 rows match.
- **G-3 4b:** `sign_up_refused` maps to `signUpClosed`.
- **TST-1:** every grep matches, including `11` and `case 1` to `case 6`.
- **Also matched:** FB2-1's gate and six names, FB2-2's nine post-check names, OTP-1, DEP-2, FB2-6's awk, and 115 cases (110 headed plus V-1 to V-5).

**Findings**

1. **Blocking, FB2-2 (`06-test-plan.md`:1061).** The expected `1` comes out as `0` in the run shell: there `grep` is a ugrep wrapper that treats the `$` in `'mailer_otp_length == $otp_length …'` as an anchor. The string is in `deploy.sh`:187 and `/usr/bin/grep` gives `1`. Fix: `grep -cF`.
2. **Blocking, SU-11 (:413).** The expected `0` will be `3` after Sitting 2: `t6-<run>-capinvite` (CAP-3, :670), `t6-<run>-closedinvite` (CAP-6, :689) and EN-1's `t6-<run>-pending` (:490) are tutors with `account_role` set and none contains `-inv`. Fix: relabel them `-inv-cap`, `-inv-closed`, `-inv-pending`, or exclude them another way. Also, :156 schedules SU-11 in Sitting 1 but :413 says "after Sitting 2"; move it.
3. **Non-blocking, AD-1 step 4 (:791-793).** "Staff … and the invite counts show no `t6` user" is false once the pending, capinvite, closedinvite and invstaff tutors exist. Say "no `t6` account with role `user`".
4. **Non-blocking, §0.4 (:155-158).** No sitting lists TST-1. Add it to Sitting 1.

## Round 3

**APPROVED**

All four round-2 findings are fixed, and no new error would give a case the wrong result. The pin holds: `git diff --quiet 5e92ee6 HEAD -- apps/web/src supabase e2e package.json` passes.

**Every changed grep gives its expected value in this shell** (the Claude Code ugrep wrapper): FB2-2 (:1066) `1`; FB2-4 step 4 (:1139) `1`; OTP-1 mobile (:1210) `1`; OTP-3 `join.tsx` (:1242) `1`; TST-1 (:1002-1007) `11`, eight `=> 1` lines, `AC-14 case 1` to `case 6`, `1`, `2`, `1`. SU-8 (:487) couldn't run as written with no dev server; on the existing build's `sitemap.xml` it gives `0`.

**No old label is left:** no `capinvite`, `closedinvite`, `-pending` without `-inv`, or `t6-<run>-staff@`. The only `t6` invite labels are `-inv-pending`, `-inv-cap`, `-inv-closed`, `-invstaff`, `-invstudent`, `-invparent` and `-inv-staff`, plus `-promote`.

**SU-11's filter covers every case it needs to.** Of the 37 `t6` labels in the plan, each account that Sitting 1 or 2 makes a tutor, parent or student, or gives an `account_role`, is excluded by `%-inv%` or `%-promote%` (SQL `like` check passes for all seven). The rest stay `user`, including `-changed` (refused in AD-7), `-deact`, `-deactnew`, and the invites INV-4 to INV-6 refuse. G-4's positive control is rolled back. R-2 and R-3 run in Sitting 3, after SU-11. §0.4 lists TST-1 in Sitting 1 and SU-11 last in Sitting 2, matching :413. 115 cases (110 headed plus V-1 to V-5).

1. **Non-blocking, AD-1 step 4 (`06-test-plan.md`:797).** EN-1's `-inv-pending` is redeemed in EN-2 (:509, `tutor|active`), so AD-1 shows it as an active staff member, not an invite. The result is unchanged, since the check only asserts that no `user` account appears.

> **Lead:** finding 1 reworded in place at :797 (EN-1's tutor shows as active after EN-2; the CAP-3, CAP-6 and INV-1 ones as invites). Stage 6a gate passed.
