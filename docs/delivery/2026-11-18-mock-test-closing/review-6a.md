# Review: stage 6a (06-test-plan.md)

## Round 1

CHANGES_REQUESTED

Blocking:
1. BR-1 and CL-1 rename and delete released fixtures, which the v1 freeze trigger refuses. Fix: build as a draft, rename, then release. In CL-1, reset to draft before the delete.
2. Sitting 4 has no fixtures after CL-1. It needs a committed "Sitting 4 fixtures" block.
3. The release trigger is UPDATE-only, so a postgres or service-role INSERT of a released untagged row gets through. AC 14 says "every writer".

Non-blocking:
4. VCE Subject Selection is not tested as a refused stream.
5. No DB row for frozen questions on a closed test.
6. The `dr-closing.sh` headers don't match the row IDs.
7. BR-1 has 6 pages, not 7.
8. Separate the stream list items with semicolons.
9. Add regression rows R-12 (Delete draft) and R-13 (an in-progress answer survives a reload).
10. Commit the frozen plan.
11. S-1: the TSR states that the two format failures are pre-existing.
12. `pg_sleep` in every TS row, and "compare shape" for wall-clock values.
13. S-8 and S-9 servers in Sitting 2.
14. Name the DB owner for Sittings 3 and 4.
15. Drop the `window.confirm` stub.
16. BG-5 is carried as an [ASSUMPTION] with F-3.

Sampled and correct: all the copy strings, labels, lists, the filter table, the error mapping, the counts and the traceability.

Lead ruling on 3: option (a). The release trigger is extended to INSERT (judging NEW when the inserted status is released), with a pgTAP case and plan row TG-2b.

## Round 2

APPROVED

All 3 blocking and 13 non-blocking round-1 items are fixed at `1a1260a` (104 rows). The new rows CD-6, TG-2b, TG-3 vcesel, R-12 and R-13 were sampled against the source and are correct. The lead fixed nits 2 and 3 in place (BK-1 now uses `k-tb`; the §0.1 dev-server note). Nit 4 (the pgTAP title) is left as is. Nit 5: the TSR records the re-dry-run as the Test Manager's claim.
