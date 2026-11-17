# Mock tests — team-lead rulings

No reply from Saurabh yet on D-1 to D-3; each ruling below is cheap to flip and Saurabh may overrule any of them.

- **L-1 (D-1, review-1 #1):** every signed-in non-staff portal account takes released mock tests free: student (via `private.my_student_id()`), parent and user (via `private.my_active_role()`). Tutors don't. Follows his words "all signed up users".
- **L-2 (review-1 #2):** question prompt limit is `char_length(trim(prompt)) between 1 and 2000`, matching assignments.
- **L-3 (D-3):** any admin may edit, release or take back any draft or test, not only its creator.
- **D-2 (assumption):** after their own submit, a taker sees the correct answers and explanations.
- **L-4 (stage 4):** `.worktrees/` is added to `.prettierignore`. Repo-wide `format:check` may fail only on the untracked `actionItems.md` and `supabase/.temp/linked-project.json`.
- **L-5 (06-security #1), amends AC 21 and AC 35:** take-back is allowed while no attempt is **submitted**; it deletes in-progress attempts and their answers in the same transaction. Once any attempt is submitted, take-back is refused (known limit: a wrong key in a test with submitted attempts is fixed by releasing a corrected new test; recorded in ADR-0012). Reason: under the old rule a stranger who signs up and presses Start could freeze a test forever.
- **L-6 (06-security #2):** accepted risk. Submitting with no answers reveals the key; mock tests are practice only and no credential attaches to a score. Recorded in ADR-0012. Requiring at least one answer is deferred.
- **06-security #3:** fix in the stage-5 fix batch (`check_mock_question` raises `not_found` on insert or update for a missing test).
- **06-security #4:** the Privacy Policy line ("scores are kept until the account is deleted") is Saurabh's to approve before release; not in this branch.
- **L-7 (review-5 #1), reading of AC 8:** AC 8 contradicted M15 and 03 §1 #4 / §4.5 in the same approved docs. M15 and the design govern: the mock-tests link *card* appears on the student, parent and user homes only; the top-bar "Mock tests" item (student, parent, user) and the admin dashboard tile stay.
- **L-8 (06-test-plan §6):** F-4 (`not_found`/P0002 HTTP status): accepted pending the run; TK-13, BE-3 and BM-21 record the real status, and a 500 becomes a bug. F-6 (submit confirmation counts a choice whose save failed as answered): fix — the count uses saved answers only. F-7 (unused `MOCK_TAKE_PAGE.optionsLabel`): remove. F-8 (36 px move buttons): no AC sets a size; V-1 judges, deferred unless it fails.
