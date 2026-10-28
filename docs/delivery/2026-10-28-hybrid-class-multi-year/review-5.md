# review-5 — Stage 5 (Code) gate

APPROVED

Diff develop...HEAD (070c002..7e527ef) checked against 01–04 and reviews 1–4.

Reviewer ran (read-only, CI_ENV set):
- lint, typecheck (web and e2e) and the baseline format gate pass;
- vitest: 66 files, 568 tests, up from 63/543;
- actionItems.md is in 0 commits;
- psql shows migration 20261028110000 applied, the seed rows correct and both triggers enabled.

Verified:
- The migration follows 03 §2 steps 1–8 and the R2-1..3 and R3-2 fixes.
- pgTAP covers all 15 cases, and #13 expects 428C9.
- Seed and supabase/README match.
- `Delivery` is derived from DELIVERIES, and `DELIVERY_LABELS` uses `satisfies`.
- `sortedYears` is pure and tested, and `classYearLabel` matches every AC 13 row.
- ClassDialog's multi-select has displayEmpty with "Any year", checkboxes and the hint wired up.
- Displays are switched.
- House rules hold.
- The commits are conventional, one per slice.
- Mobile passes a desk check.

Developer deviations 1–4 accepted:
1. P1 migration filename.
2. S5 commits only the plan, ADR, README row and Supabase README.
3. The MUI `aria-hidden` workaround in tests, with a comment.
4. The dialog keeps tick order and the service sorts.

## Findings
1. Non-blocking: pgTAP was not run here because of DB ownership. S6 must run db:reset + db:test green and record the AC 12 backfill check.
2. Non-blocking: AC 9 keyboard use is covered only by the S6 browser pass. Don't skip it.
3. Non-blocking (process): S6 and the TSR are outstanding, so the branch is not ready to merge until they are done.
4. Non-blocking (deploy): check the migration ordering against feature/more-email-alerts at merge time (ADR-0007 §4).
