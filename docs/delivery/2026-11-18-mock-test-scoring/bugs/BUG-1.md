# BUG-1 — S-1: an untracked file outside this change fails the format check (claim: environment)

- **Type:** claim, environment (not an app bug). For the lead to rule.
- **Row:** S-1. **Severity:** none for the build.
- **Steps:** `pnpm format:check` at `399c8cf` (run-1/format.log).
- **Expected (frozen):** exit 1, listing only `actionItems.md` and `supabase/.temp/*`.
- **Actual:** exit 1, listing `actionItems.md`, `review-1.md` and `supabase/.temp/linked-project.json`.
- **Cause:** `review-1.md` is an untracked file at the repository root (`git status --short`: `?? review-1.md`, 136 bytes, 10:25 today). It is not part of `feature/mock-test-scoring` or of this run; the root also holds an untracked `00-decisions.md`, which Prettier accepts. Every tracked file is formatted.
- **Proposed ruling:** S-1 PASS on the frozen rule's intent (only files outside the change fail), after confirming the root `review-1.md` and `00-decisions.md` are stray copies that belong to nobody's branch. Alternatively, whoever owns them removes or formats them, and S-1 is re-run.

- **Round 2: ruled** an environment error caused by the team lead (06-test-plan.md §12.1). The stray root files were removed, and S-1 re-run on the same build: exit 1, only `actionItems.md` and `supabase/.temp/linked-project.json`. **PASS.**
