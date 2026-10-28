# review-4 — Stage 4 (Plan) gate

APPROVED

Deviations confirmed:
- **P1:** `20261028100000` clashes with feature/more-email-alerts, which is already applied to the shared local DB. `20261028110000` sorts after both branches. The ADR-0007 §4 rule is stated correctly.
- **P2:** moving `db:types` to S3 avoids a typecheck break in `saveClass`. CI doesn't check that the types match the schema.

Slices are thin and each leaves the build green. AC 1–19 are all closed by a slice. Commit messages follow Conventional Commits. The DoD is complete. The baseline format gate is correct. The shared-DB note is sound: item 8 is parked at 89337aa.

## Findings

1. Non-blocking: DB ownership passes from the Developer to the Tester at the S6 handoff. Security stays read-only.
2. Non-blocking: the S3 grep will still match `CLASS_DIALOG.labels/hints.yearLevel` and onboarding/student code. The real check is that no `ClassSummary`/`ClassInput` `yearLevel` readers remain.
3. Non-blocking: commit stage docs as you go (01–04 and reviews 1–4 now), add a TSR commit, and change DoD 4 to "S1–S5 plus docs/TSR commits".
4. Non-blocking: S5 accepting ADR-0009 supersedes 03 §11. Say so in the plan.
