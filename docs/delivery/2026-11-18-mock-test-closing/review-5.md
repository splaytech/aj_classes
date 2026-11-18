# Review: stage 5 (diff develop...5cb0810)

## Round 1

CHANGES_REQUESTED

1. [BLOCKING, docs] ADR-0012 has no closing amendment, and decision 5 ("two functions") is now false. Amendment 1 has a wrong AC 15 reference.
2. [NON-BLOCKING, fix before hosted apply] Taker predicates use `now()`, the transaction start, so a submit that waited on Close now can still land. Use `clock_timestamp()`, and add a two-session check.
3. Clear filters drops focus to the page body.
4. Take back drops focus (this was already on develop).
5. The year multi-select can be emptied on a released test, which conflicts with design §5.1.
6. Test gaps:
   - questions unchanged after a tag edit;
   - AC 25 tag-independent visibility;
   - Clear filters focus.
7. Regenerate the generated types after the migrations.
8. The `mockTagsMissing` text names all three fields.
9. Nit: the `kept` boolean argument.
10. Run the format gate from a clean checkout.

Sound: definer functions and `search_path`, grants, lock order, both triggers as designed, additive for hosted, the S-1 clause verbatim, the two-session output, L-3 and L-4, error mapping, the web rules, and the fixtures.

Lead disposition: items 1 to 8 go to the Dev Lead as fix batch 1. Item 9 is accepted as is (L-4). Item 10 is noted, since the two failing files are untracked.

## Round 2

APPROVED

Review-5 items 1 to 8 and the F-1 copy are all resolved at `e947687`:
- `clock_timestamp()` is in every taker closed check and in `mock_close_now`.
- ADR Amendment 2 is accurate.
- Focus is fixed for Clear filters and Take back.
- The years on a released test can't be emptied.
- New pgTAP covers questions unchanged after a tag edit and AC 25.
- The casts are tidied.
- The S-1 copy is fixed.

Open, non-blocking:
- `database.types.ts` still types nullable returns as non-null. The casts stay; there is no runtime risk.
- The clock fix is proven by a recorded two-session run, not by a repeatable pgTAP case.
