# review-6a — Stage 6a (Test plan) gate

## Round 1

CHANGES_REQUESTED

Checked and correct:
- Traceability: AC 1–19 and the Amendments (A6 via TC-18b, AC 7 via TC-7c–h, AC 18 via §5).
- Expected values match the seed and the mobile subtitles.
- The TC-8 and TC-15 strings match the live DB.
- The AC 12 commands are local-only and correct.
- The TC-17b and TC-17c codes are right (200 [], 403, 400/428C9).
- DB ownership is sound, counts are labelled honestly, and the mobile approach is feasible.

Findings:
1. **Blocking:** the temporary mobile test can be left behind. cp, 3× flutter drive and rm sit in one shell call, so a timeout or abort leaves `integration_test/hm_class_screens_test.dart` in aj_classes_mobile, and F-1 never checks the mobile repo. Fix: split TC-18a into cp, then one call per role (timeout 600000 or background), then an always-run cleanup (`rm -f …; git status --short`). Add a mobile-repo leftovers check to F-1.
2. Non-blocking: screenshots go to ~/aj_mobile_overnight/screenshots/, so add a copy step into evidence/mobile/.
3. Non-blocking: the TC-12a restore (`pnpm db:reset`) must run whatever happens in TC-12a.
4. Non-blocking: if the TC-18a student test fails only because a row is off-screen in a lazy list, that is a plan error (scroll first), not a product bug.
5. Non-blocking: pgTAP uses no_plan, so record the measured Tests= value against the expected 618, and treat a mismatch with PASS as a plan error.

## Round 2

APPROVED

All five round-1 findings are resolved:
1. TC-18a is split into five calls with an always-run cleanup, and F-1 checks the mobile repo.
2. Screenshots are copied to evidence/mobile/ with a timestamp check.
3. The TC-12a restore always runs.
4. An off-screen row is treated as a plan error (scroll first).
5. The measured Tests= is recorded against the expected count.

The 622 count is consistent (31ce0a4 adds 4 assertions; the file has 32). Two nits were folded in by the lead: the header names 31ce0a4, and the scroll fix edits the `$T` copy.
