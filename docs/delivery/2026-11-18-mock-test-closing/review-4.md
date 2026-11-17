# Review: stage 4 (04-plan.md)

## Round 1

CHANGES_REQUESTED

Blocking:
1. Slices are not green on their own. Merge slices 1 and 2; make `tags` optional until 7a or move the type change; add typecheck and lint per slice.
2. The e2e tag write is anchored at the wrong line. Do it after the draft is created and before Release, then reload.
3. The guard's `if tg_op = 'UPDATE'` with `current_row` by `old.id`, and the INSERT pgTAP case, are missing.
4. The disabled `notSet` item when the field can't be cleared is dropped.
5. The 2-D refusal and the `year_levels` hint asserts are missing.
6. The deploy needs a read-only `migration list` pre-check that the pending set is exactly the two migrations.

Non-blocking:
7. drop-then-create for return-type changes, and keep the `mock_release` parameter names.
8. Fixture notes: admin line 45 stays; line 431 changes; nothing to remove; line 29 needs the `old.id` read.
9. `mockTagNamesText` is missing.
10. Coverage: AC 29 grep, AC 27 current-values filters, the release-button assumption, the tester-ui rows.
11. The parity removal form uses its own marked block.
12. The architecture says `do nothing` (fixed by the lead).
13. The false Risk 7 and the intro.
14. The key count, `db:types`, and the rollback wording.

## Round 2

CHANGES_REQUESTED, on one finding only:
- A. Slice 5 required `tags` on the view types, but 11 typed test fixtures lack it, so typecheck fails.
- B (non-blocking). The paths for the sitemap and email sources.
- C (non-blocking). The tester-ui rows were placed both before the gate and after the push.

All 14 round-1 findings are fixed. The reviewer expected APPROVED once A was fixed.

Lead disposition: applied in place.
- A: option (a). 5.1 lists the 11 fixture sites and records the slice output.
- B: names `routes.ts` and the notification templates.
- C: the tester-ui rows run before the merge.

Stage 4 closed as APPROVED.
