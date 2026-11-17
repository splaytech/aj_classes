# Review — stage 4 (04-plan.md)

## Round 1

CHANGES_REQUESTED

Blocking
1. §6 items 8–9 and §3 S7 run `pnpm test:smoke` / `pnpm test:csp`; root package.json has neither. Use `pnpm --filter aj-classes-e2e test:smoke` and `test:csp` (ci.yml:94, :148).
2. §6 says `pnpm check` "passes except" two format exceptions; root `check` chains `format:check &&` so lint, typecheck, test, build never run. List the five steps as separate commands.
3. §7 treats staging and production as two databases; deploy.sh:26 one PROJECT_REF, :30 "one database serves staging and prod". Run `supabase db push` (deploy.sh:279) once, then build web; staging web sees migrated production data.
4. AC 34 (start after submit adds no attempt) and AC 38 (profile_id = auth.uid(), no other name on pages) have no named S2 case (03 rows 34, 38 require them).
5. S1 "reorder swaps" is old wording; review-3 finding 6 untested. Add: positions 1 and 3 after deleting 2; move 1 down swaps with 3; end move no-op.

Non-blocking
6. Whitespace-only prompt refused case (S1, S3).
7. Drop the eslint edit (`pnpm lint` runs `eslint .` inside apps/web; root .worktrees never scanned). Add .prettierignore to §8 dev-ms list.
8. S2 should name private.can_take_mock_tests() (03 §2.5).
9. No named case for AC 15 (second admin updates), AC 22 (status check, no schedule column), AC 37 (admin cannot select attempts).

Passed: all 44 ACs in a slice; gate, 8 routes, AC 24, S8 two-session match 03; deferred list equals 01 (B1–B16); dev-ms/dev-web files don't overlap; deploy.sh order (279, 296, 334) matches test-deploy-order.mjs; migration 20261118100000 after 20261117100000; scripts exist.

## Round 2

APPROVED

All nine round-1 findings closed (checked against the text): e2e commands via `pnpm --filter aj-classes-e2e`; five DoD steps separate; one database, one `supabase db push`; AC 34/38 in S2; gap reorder case in S1; whitespace prompt/title cases; eslint edit dropped, .prettierignore in dev-ms list; can_take_mock_tests() named; AC 15/22/37 named.

Non-blocking nits:
- §6 note "Items 1 and 2 ... only allowed exceptions" → "item 1's two exceptions" (fixed in place by the team lead).
- S1 lists a UI check ("the UI numbers by order") in a pgTAP list; move to S4 or S8 (folded into the stage-5 brief).
