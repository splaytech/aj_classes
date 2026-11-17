# Review: stage 3 (03-design.md, categories)

## Round 1

CHANGES_REQUESTED

Blocking:
1. A refused tag clear on a released test reuses `invalid_mock_tag`, so the page says the value is wrong. It needs its own `mock_tag_kept` message, error key and tests.
2. The fixture list is incomplete:
   - the `mock_tests_admin_list` key pin (10 keys become 14);
   - the admin file's lines 25 and 29;
   - the taker file's lines 44 to 54, whose direct `status='released'` the trigger refuses;
   - the closing file's lines 22, 23, 105 and 410;
   - name the two "new assertions".

Non-blocking:
3. The Release-button deviation from AC 14 needs an [ASSUMPTION] and the right reason.
4. Use one locked read of status and tags by `old.id`, and judge the clear on it.
5. NULL elements and non-1-based years: pgTAP cases, and refuse them or accept the 23514.
6. Specify the parity removal form, have the parser take 2 and 3 tuples, and record seed `do update` vs `do nothing`.
7. Range and any-year checks moved into the trigger: update the ADR item 3 and architecture §2.2 and §6B.
8. Use `findProgramme(slug)`.
9. Show a disabled `notSet` item when a value is null.
10. `renderValue: () => mockYearText(value)`.
11. Add `MockTestDialog.test.tsx` for AC 13.
12. `validateMockTest` takes `Pick<…,'title'|'instructions'>`.
13. Copy: lower case and "and".
14. Focus after the tags save, and MenuItem keys.
15. Stage explicit paths only.

Sound: migration order, the closing bodies preserved, the grants, the error-map order, AC coverage, and designer decisions 1, 3 and 4.

## Round 2

CHANGES_REQUESTED

Round-1 findings 1 to 15 are all resolved.
1. [BLOCKING] Steps 1 and 4 of the guard must be inside `if tg_op = 'UPDATE'`. Otherwise INSERT reads an unassigned `current_row` and every insert fails. Add a pgTAP insert case as an aal2 admin.
2. [NON-BLOCKING] The "changed" test should use `current_row`, not OLD, on UPDATE.

Lead disposition: both are applied in place by the team lead, with the reviewer's wording, in §1.3.4: the UPDATE block, the nested `if`, the INSERT pgTAP case, and step 2 on `current_row`. They go to round 3 for confirmation.

## Round 3

APPROVED in substance. The three round-2 fixes are correct. One doc-only contradiction remained: 02-architecture §2.3 still named `current_status` and `new.id`. The reviewer said a further review round wasn't needed once it was fixed. The team lead fixed it: §2.3 now uses `current_row` by `old.id`, inside `if tg_op = 'UPDATE'`, and ADR item 3 says the read is UPDATE-only.
