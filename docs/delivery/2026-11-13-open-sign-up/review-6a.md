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
