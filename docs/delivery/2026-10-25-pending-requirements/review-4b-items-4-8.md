CHANGES_REQUESTED

# Review 4 — items 4–8 build plan (04b), round 1

**Scope.** Read `aa9ee18` in full. Checked against:
- 01b, 02b, ADRs 0005–0008;
- 03b (§0, every files and tests table, §9, §13);
- reviews 1b–3b;
- 04-plan §2 and `/test-and-ship`'s push authority.

Checked claims against the repo: the worktrees, the newest migration (`20261025110100`), the shared `project_id`, the `ci.yml` triggers, and `deploy.sh` ordering (db push before functions). Also checked that the E2E repo is at `488dde1`.

**Passes:**
- **Coverage:** every 03b file and every AC is covered.
- **Slices:** thin and ordered.
- **Branches:** discipline is correct, and item 2 stays held.
- **T2.15:** follows 03b §9.
- **Releases:** migration-first, and every hosted step is Saurabh's.
- **Closing tasks:** present for every item.
- **Risks:** real, with mitigations.
- **Questions:** owner-only, and none re-asks an earlier one.
- **Count:** 75 tasks.

## Blocking

1. **No working "Q22 = no" path for item 6** (T6.6–T6.14, header line 13, §10 DoD 3).
   - **What depends on a PR:** T6.7 (the broken-spec, Lighthouse-proof and rerun runs), T6.9 (green on the draft PR), T6.11/AC-6.13 (the PR description) and T6.14 (close the PR).
   - **Why "do it on develop" doesn't work:** the deliberate-failure runs (AC-6.1, AC-6.5, AC-6.14) can't be done as commits on `develop`.
   - **Fix:**
     - (a) Prove the jobs locally with `act`. That includes the broken-spec case and the `example.supabase.co` case, plus `--artifact-server-path` for AC-6.5.
     - (b) Move only the CI-only evidence (check names, logs, three durations) to after the merge, listed under "Not covered" in the TSR until then.
     - (c) For AC-6.13, put the dependency reasons in the merge-commit body and the dev notes, then in the `release/*` PR to `main`.
     - (d) If `develop` CI goes red, fix forward on a fresh branch before item 7. Make the T7.0 precondition "latest `develop` CI green".
     - (e) Make T6.9, T6.11 and T6.14 conditional on Q22, and fix header line 13 to cover T6.7.

## Non-blocking

2. **Shared stack** (§0, T5.0–T7.0). Repeat T4.0's checks 1–2 in every T*.0, and name all checkouts, including `.claude/worktrees/magical-liskov-6b3b72`. Also note that T4.0 wipes item 2's local Storage objects and Mailpit.
3. **Q21/Q22 reuse** clashes with the accepted ADR-0006 and 02b, which use "Q21" for the private E2E repo. Renumber the new questions Q27–Q32.
4. **T6.1 count.** The archive extracts 20 files, not 28. Add `typescript` and `@types/node` at `apps/web`'s ranges to `e2e/package.json` (review-3b finding 10).
5. **T2.15 step 1.** If `20261025134709` was applied on hosted, stop and escalate to the Architect; don't rename.
6. **AC-7.12 manual leg.** Add it to T7.8.
7. **Q24 deviation.** Q24 recommends required checks on `main` only, while 03b §6.11 says develop and main. Record it as a deviation in `05-dev-notes-item-6.md`.

**Next steps:** fix finding 1, then re-check item 6 only. Items 4 and 5 can go to the Developer as written.

---

CHANGES_REQUESTED → fixed by the team lead → APPROVED

# Review 4 — items 4–8 build plan (04b), round 2

Reviewed `aa9ee18..63a0a4f`, the changed parts only. Round 1 findings 2–7 are resolved, and finding 1 is mostly resolved.

1. **Blocking: Q28 didn't ask for everything path A pushes.** Path A also pushes a throwaway `ci-proof/item-6` branch, opens a second draft PR, and deletes the remote branch. **Fix (team lead):** Q28 now asks for both pushes and the deletion, and allows "yes to the first part only". In that case the failures run under `act`.
2. **Non-blocking: T7.0/T8.0 could see a `cancelled` run.** **Fix (team lead):** they check HEAD's own run, and a `cancelled` run is rerun, not fixed forward.
3. **Non-blocking: the T6.14 docs commit could read as a direct push.** **Fix (team lead):** it goes through `/test-and-ship` as a short docs-only gate.

The reviewer said no further round is needed if the fix is wording only. These three fixes are wording only, so the plan is approved.
