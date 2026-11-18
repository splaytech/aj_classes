# Review: stage 2 (02-architecture.md and ADR-0012 Amendment 1)

## Round 1

CHANGES_REQUESTED

Blocking:
1. The tag guard trigger must be SECURITY DEFINER. As invoker it can't read `private.mock_test_options`, so every tag write fails. The reviewer reproduced this on local Postgres in a rolled-back transaction. pgTAP must write as `authenticated` at aal2, not as the superuser.
2. The guard trusts OLD.status after a lock wait. There is a possible release-vs-clear race, reasoned but not reproduced. Prove it either way, or read the committed status in the trigger.

Non-blocking:
3. The production mismatch is overstated: `main` has no caller. The four replaced functions are miscounted as "three".
4. The release gate's locked select must return the tag columns.
5. Recommended: a BEFORE UPDATE trigger that enforces tags on draft→released for every writer.
6. ACs 12, 19, 22, 23, 26, 27 and 29 should be named as Stage 3's work.
7. Error mapping is needed for 23514, `mock_tags_missing` and `invalid_mock_tag`.
8. The parity test must replay every migration's options block in order, last write wins.

Checked and sound: the column grants under RLS and the freeze trigger, the additive migration, the S-1 carry-over, and client-side filtering.

## Round 2

CHANGES_REQUESTED

Blocking:
1. Order A of the race. The clear-refusal judges OLD.status, and the draft→released trigger doesn't fire on a tag-only update. Fix: in the guard, on UPDATE only, read the status with `select … for no key update` and judge the clear on that.

Non-blocking:
2. The draft→released trigger is missing from the §4 step list.
3. Write out the gate predicate: subject, stream, and (years or Any year).
4. The year-order failure hint is `year_levels`.
5. The removal form is `on conflict (kind, key) do update set active = excluded.active`.

Round 1 findings 1 and 3 to 8 are resolved.

Lead note: I believe Postgres already gives BEFORE ROW UPDATE triggers the latest row version after a lock wait (GetTupleForTrigger and EvalPlanQual). The in-guard read costs nothing extra and makes the design independent of that, so it is adopted. The two-session check in §6.6 proves both orders.

## Round 3

CHANGES_REQUESTED

Blocking:
1. §2.3 contradicted itself about the locked read, and stated the lock order wrongly.
2. The draft→released trigger judged NEW. A direct status write racing a tag clear could release a test with no tag.

Non-blocking:
3. The ADR wording on the lock order.
4. The locked read is missing from the §4 step.
5. The `year_levels` hint is missing from §1.3.2.

**Lead disposition (third rejection).** All five findings were concrete and fully specified, so the team lead applied them in place, quoting the reviewer's fixes. Saurabh's standing instruction is to do it himself using his recommendations (S-2).
- §2.3: the contradicting sentence is deleted and the lock order is corrected.
- §2.5 and §4 step 3: the release trigger reads the current tags `for no key update` on the transition and judges on that read.
- §6.6: a new two-session case for a direct status write.
- §1.3.2: names `year_levels`.
- ADR items 3 and 4: updated to match.

Not re-reviewed as a separate round. The stage 5 diff review and Security check the built triggers against this text, and the two-session checks prove them.
