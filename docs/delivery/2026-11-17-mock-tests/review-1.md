# Review — stage 1 (01-requirement.md)

## Round 1

CHANGES_REQUESTED

Reviewed docs/delivery/2026-11-17-mock-tests/01-requirement.md against Saurabh's verbatim ask and the codebase. Checked: roles (`app_role` has `user` via 20261114100000), `private.my_active_role()`, the MCQ constraints in 20261007090320 and 20261027100000, the title/instructions limits in 20261007061232, and the portal routes. AC count is 44 and numbered. Most facts are accurate.

1. [BLOCKING] M6, line 26. The doc says a parent "is not a signed-up user in the literal sense". A parent who signed up and was later linked is still a signed-up user, so this narrows Saurabh's words ("all signed up users ... even if they are not yet students"). The default also removes access from people he included. Fix: delete the "not ... in the literal sense" reasoning. Keep parents out only as an [ASSUMPTION] that contradicts his literal wording, and leave D-1 as an open question that Saurabh must answer before build. Note that AC 7 and US-P1 rely on this.
2. [BLOCKING] M11, line 31. It says the limits "match the assignments limits where they exist". That is false for the question prompt. Assignment prompts are `char_length(trim(prompt)) between 1 and 2000` (20261007090320, line 401). AC 12 uses 300, which is a new limit and not a match. Fix: either set the prompt limit to 2000 to match, or label 300 as a new v1 choice with its reason. Correct the sentence either way.
3. [NON-BLOCKING] M3, lines 23 and AC 15, US-A3. Saurabh wrote "single admin can create". The doc widens this to any admin editing and releasing any draft. It is labelled as an assumption, but it is a product call and should be listed under Decisions needed (D-3) so he can rule on it.
4. [NON-BLOCKING] Smallest slice. Take-back (AC 20–21), attempt counts (AC 23, US-A5), reorder (AC 13), explanations (AC 12, 32), and the post-submit answer reveal (D-2) are not in his ask. They are the team's additions. Mark each one as "added, cut if not wanted" so v1 can be trimmed before build.
5. [NON-BLOCKING] AC 35 is contradictory. It says the student "is not affected", then "this case must not arise; a test in this state is refused". AC 20–21 already prevent the state. Replace AC 35 with one line: "take-back is refused once any attempt exists".
6. [NON-BLOCKING] AC 17 vs AC 11. "A blank title can't be released" cannot happen, because AC 11 already refuses a title shorter than 2 characters. Either remove it or state that the rule applies to a title that is blank after saving.
7. [NON-BLOCKING] AC 18 says "without a reload-based workaround: a fresh visit shows it". This is untestable as written. Replace it with the expected result for a student who already has the list open, or drop the phrase.

Fix items 1 and 2 and re-submit as review-2. Items 3–7 can be fixed in the same pass.

## Round 2

APPROVED

Round-1 findings 1–7 all closed (M6/L-1 with D-1 open; prompt 1–2000; D-3; team additions tagged "cut if not wanted"; AC 35 one rule; AC 17 blank-title removed; AC 18 "after a page refresh").

Non-blocking:
- M19 label "Pure list items with no team addition" is confusing; reword to "[ASSUMPTION] team choice".
- AC 35 repeats AC 21; acceptable.
