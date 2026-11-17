# Review — stage 3 (03-design.md)

## Round 1

CHANGES_REQUESTED

Rulings on the four deviations from 02 (all sound; amend docs):
1. Question triggers `for update`: SOUND (`for share` lets two concurrent adds pass the 100 count; matches private.check_assignment_question, 20261007090320 from line 426). Amend 02 DEC-MT-4 and ADR-0012 decision 5.
2. `mock_move_question`: SOUND (single-UPDATE swap verified on temp tables in a rolled-back txn locally: passes with `deferrable initially immediate`, fails with plain unique). Amend 02's reorder paragraph.
3. Admin dashboard tile: SOUND (admin top bar is one ADMIN_LINK, PortalLayout.tsx:34). Amend 02's "Nav item added to the four area navs".
4. updated_at bumped by question edits: SOUND (AC 23). Add one line to 02 data model.

Blocking
1. §2.5 can_take_mock_tests(): students gated only by my_active_role(). Repo student gate private.my_student_id() (20261023100000:146-158) also requires students.is_active. Inactive student row + active profile would get mock tests (AC 6). Fix: student branch uses `private.my_student_id() is not null`; pgTAP case students.is_active=false → not_taker.
2. §2.6 #6 and §8 AC 24: AC 24 "no people's names" vs AC 23 "created by (name)". Fix: reword AC 24 in 01 to "no taker names, answers or scores"; test checks taker columns only.

Non-blocking
3. §7 routes.ts entries: 8, not 6.
4. §2.2 prompt check: use `char_length(trim(prompt)) between 1 and 2000` or drop the "cannot drift" claim.
5. Concurrency claims (start vs withdraw, 100 cap) unproven: name a two-session Tester check for AC 13, 19, 21.
6. Question delete leaves position gaps: mock_move_question picks nearest position like move_question; end moves are no-ops; UI numbers by order.
7. Triple-mounted route file with ids is feasible on React Router 8.4.0. No change.

Passed at design level: no taker grants/policies on the four tables; keys withheld until own submit; admin gates and execute grants per pattern; all cited helpers exist; AC-to-layer table covers all 44 ACs. Not run against code (migration doesn't exist yet).

## Round 2

(The first reviewer twice failed to deliver its round-2 report and was replaced by a fresh reviewer with a complete brief.)

CHANGES_REQUESTED

Round-1 finding 1 closed in 03 §2.5 only (checked against 20261023100000_invite_onboarding.sql:146-160). Findings 2–7 closed (AC 24, 8 routes, prompt matches 20261007090320:401, position gaps, two-session concurrency). L-1 to L-3 applied in 01, 02, 03 and ADR-0012.

1. Blocking: student-gate bug still in 02-architecture.md:49, :96 and ADR-0012:14 (`my_active_role() in ('student','parent','user')`); 02:54 says deactivation is cut at my_active_role(). Fix all three to `can_take_mock_tests()` = `my_active_role() in ('parent','user') or my_student_id() is not null`; add the students.is_active=false case to 02:82.
2. Nit: 03 §10 and 02:70 call D-1/D-3 TBC; say "ruled L-1/L-3; Saurabh may overrule".
3. Nit: 01:125 "Admins see counts only (AC-24)" → "counts and creator name only".
4. Nit: 03 §3.1 maps invalid_question to "invalidInput / notFound"; pick one.

## Round 3

APPROVED

All four round-2 findings closed: taker gate is can_take_mock_tests() (my_active_role() in ('parent','user') or my_student_id() is not null) in 02:49/54/82/96, ADR-0012:14, 03 §2.5 and 04-plan.md:48; D-1/D-3 ruled wording in 03 §10; 01:125 "counts and the creator name only"; invalid_question → notFound.

Nit (non-blocking, fixed in place by the team lead): 02-architecture.md:3 and :104 still said D-3/D-1–D-3 "open"; now "ruled; Saurabh may overrule".
