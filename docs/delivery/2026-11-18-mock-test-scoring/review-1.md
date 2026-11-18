# Review — stage 1 (01-requirement.md)

## Round 1

CHANGES_REQUESTED

1. [BLOCKING] The privacy gate contradicts itself. 01-requirement.md line 176 (release gate) and line 193 (R-S1) say the Results view "stays off" and that approval comes before release to students. 00-decisions.md L-6 (line 10) says approval is needed before production and "does not block staging". The hosted DB is shared with production (closing 00-decisions S-2), so "staging uses the same DB" means the RPC is live there. No AC says how the view stays off. Fix: choose one rule (for example, the route and RPC ship dark until D-S8 is approved, or admin-only staging is accepted in writing). Add an AC that states the mechanism, and align L-6 with lines 176 and 193.
2. [BLOCKING] Decision IDs collide. The deferred list (lines 90–101) reuses D-S1, D-S2, D-S3, D-S4, D-S6, D-S7 and D-S8 with different meanings from the decisions list (lines 180–187). 00-decisions L-2 cites "D-S1" for who sees (01 says D-S2, line 181). L-3 cites "D-S6" for freeze (01 says D-S3, line 182). Fix: give the decisions list its own prefix (for example Q1–Q8) and correct the L-2 and L-3 references.
3. [BLOCKING] Closed tests and S-1 are only half handled. Line 72 and AC 27 cover the admin Results view only. No AC says that a submitted taker on a closed test still sees "N of M marks", the percentage and the label (AC 13 and 17), or that a non-submitter gets not_found. Fix: add an AC citing 2026-11-18 closing AC 5 (S-1) and ruling L-2.
4. [BLOCKING] Per-question marks visibility is ambiguous. AC 4 (line 112) sits under "A. Marks (admin)" but says "On the question page". AC 22 (line 142) treats the same marks as taker-facing. No AC covers a taker seeing marks before submit, which would also change 2026-11-17 AC 28. Fix: split AC 4 into an admin editor line and a taker question-page line, and state which one is intended.
5. [BLOCKING] D-B6 is reversed silently. 2026-11-17 01-requirement line 151 defers "Per-question marks and weighted scoring", and its M9 (line 29) says "no per-question marks". This doc never cites D-B6 or amends M9 or 2026-11-17 AC 32. R-S2 (line 194) records only AC 24, AC 37 and D-B7. Fix: extend R-S2 to say it moves D-B6 into v1 and amends M9 and AC 32.
6. [NON-BLOCKING] Bare cross-references. AC 9 cites "(AC 18)", AC 18 cites "(AC 9)" and AC 25 cites "(AC 18)". Under the doc's own convention (line 3), bare numbers mean 2026-11-17. Fix: write "this file's AC" or the full file name.
7. [NON-BLOCKING] AC 25 (line 148) takes "taker's full name" from profiles.full_name. No AC says what shows when the name is blank. Fix: add a constant fallback and an AC for it.
8. [NON-BLOCKING] AC 3 says "absent or disabled". Pick one, so the Tester has one check.

Checked and true: mock_submit counts unanswered as incorrect (20261118100000 lines 611–615). MOCK_RESULT.score at constants line 260. score and total are smallint. check_mock_question refuses any change when status is not draft. Assignment marks at 20261007090320 line 404. QUESTION_LIMITS marksMin, marksMax and the Marks label exist. No pass mark exists anywhere in the repo. The admin list returns only created_by_name. The rounding and pass rule is consistent (SC5, AC 12, AC 16, AC 20). Legacy attempts are covered by ACs 26 and 35–40. Privacy scope (admins only, no answers, no e-mail, aal2) matches ADR-0012 decision 3.

Lead ruling on finding 1: 00-decisions.md L-6 rewritten (admin-only on staging accepted in writing; the Privacy Policy line gates the merge to `main`). L-2 and L-3 references corrected.

## Round 2

CHANGES_REQUESTED (non-blocking only)

Round-1 findings 1–8 are all closed.

New findings:
1. [NON-BLOCKING] Line 66 says "(here ACs 42 to 44)"; after renumbering it should be 41 to 43.
2. [NON-BLOCKING] AC 37: a non-admin's direct call is refused (ADR-0012 decision 5), not an empty result.
3. [NON-BLOCKING] 00-decisions L-6: "admins who already hold every portal record" is vague; cite AC 36.

Lead: all three fixed in place by the team lead; no blocking findings remain, so stage 1 is approved.
