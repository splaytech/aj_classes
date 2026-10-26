CHANGES_REQUESTED

# Review 6a — item 7 test plan, round 1

**Reviewed:** the draft `06-test-plan-item-7.md` (69 cases) at code `79e803a`, against 01b item 7, 03b §7.4–§7.7, 04b §5, dev notes (§2, §4, §6, Rounds 2–3), review-5-item-7, 06-security-item-7, `seed.sql`, the migration, `fair_results.test.sql` and the portal source. Read-only.

**Checked and correct:** case and phase counts; the 31-file scope list; Vitest 60 / 520 and pgTAP 15 / 587 with the breakdowns; every UI string in `src/constants/*` including curly quotes; email subjects and links; error codes, statuses and trigger order; grants and RLS; seed values (incl. 71 % average); `HoldResultsSetting`, `saveSubmission`, `getStaffClient` behaviour; deferred halves listed as Not covered; dev notes §6 legs mapped.

## Blocking

1. **E-01 step 5** uses `374b368`; use `79e803a` (the header's gate).
2. **E-42 restore leaves `MD`** (renamed in E-23 step 4). Delete by id: `where id in ('$MD','$MPD','$ED')`.
3. **E-47 leaves a 1,000-character Q2 draft that E-49's Return saves** (`submission.tsx:72-84,112-124`). Clear it or reload without saving; assert Q2 feedback `''`.
4. **E-64's answers md5 against E-12 can't match** (H1 rows added later). Take the md5 just before E-64's writes, or exclude `$H1`, `$FRACQ` on both sides.
5. **E-70:** Isla's `Reasoning mock test 1` is `submitted` (`seed.sql:149`; UI `Waiting for marking`), others `not_started`.
6. **E-81 restore:** re-enrol first; null `awarded_marks` on positions 2 and 3 only (mark back to `1.0`); result `status='submitted'`, `feedback=''`.
7. **E-11:** use `grep -cE 'rule \(b\)|rules \(a\) and \(b\)'` → `2`.
8. **E-08:** exclude `apps/web/src/constants` and test files (→ `0`); don't use `grep -P` on macOS (assert exit 1, or `perl`/`rg`).
9. **E-10:** `proconfig` prints `{"search_path=\"\""}` under `psql -At`.
10. **E-04, E-06:** the line is `check-hosted-ref: 0 files (of N scanned)` (hyphen).
11. **E-69:** no refused browser request happens; expected **console 0**, no new exception.
12. **E-24 aal1 admin on NAPLAN:** known value **200** `[{"id":"$ED","hold_results":true}]`, `holdv $ED` = `t` (admin tutors NAPLAN, `seed.sql:111`), then reset.

## Non-blocking

13. Rulings wording: A3/A4 still "proposed"; heading says P1–P3; give A4 a cap (≤ 1 `not_student` line per reload).
14. E-71 vs A3 wording ("no longer see"): confirm or reword.
15. Known values marked [measure]: E-61 `2 of 2`; E-69 Aarav not listed; E-74 parent home lists `Noah Demo` only; E-24 student/parent `200 []`; E-73 step 3 `403`.
16. Settled [re-check]s: E-72 full name (`admin-student.tsx:456`); E-82 `fullName` (`parent-home.tsx:173`).
17. E-81: clear Mailpit first.
18. Move E-12 before E-05; add the Env cell to E-92, E-93.
19. E-09: `git checkout -- apps/web/src/services/database.types.ts` if `db:types` changes it.
20. §4 numbering; §3 S1 row add E-72 for (d).
21. Phase 4 intro: `not_submitted` isn't exercised for Aarav (pgTAP covers it).
22. E-50: parent heading `Aarav’s results` (`RESULTS_TEXT.headingFor`).

**Next:** fix 1–12, then freeze; if the TSR header lists the changed lines, no second round is needed.
