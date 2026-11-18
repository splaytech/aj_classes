# Test Summary Report — mock test scoring

- Date: 2026-11-18 · Branch: `feature/mock-test-scoring` @ `399c8cf`, the commit the plan was frozen in (code = `031e552`: `git diff --quiet 031e552 HEAD -- apps/web/src supabase e2e package.json` → 0, so the plan's values stand) · Environment: local Supabase (API :55321, DB :55322), dev server http://localhost:5173 (Sittings 3 and 4), Playwright with the installed Chrome (`channel: 'chrome'`), en-AU, Australia/Melbourne.
- Plan: [06-test-plan.md](06-test-plan.md), 113 rows, frozen at `399c8cf` (review-6a APPROVED, round 2). Evidence: `run-1/` (excluded by a `docs/delivery/2026-11-18-mock-test-scoring/run-*/` line in `.git/info/exclude`; **that file is local to this clone**, so another clone would show `run-1/` as untracked). One owner throughout (the Test Manager): the stack, the dev server and the browser, sittings in §0.4 order.
- Start: LG-1 first (`supabase db reset --version 20261120100000`, legacy fixture, `supabase migration up --local`), then `pnpm db:reset` exit 0, then S-0 matched the plan exactly (`run-1/s0-start.txt`). Request guard self-test: `fetch('https://example.com')` aborted and counted; `challenges.cloudflare.com` allowed. The guard aborted 0 other requests in every browser script.
- Scripts: every Appendix A script was extracted from the frozen plan into `run-1/` and run as written. Each rolled-back script's output equals Appendix B line for line once the run id is masked, except one line of `dr-score.sh` (SC-2, BUG-2). `ts-real.sh` and `h-real.sh` match with `elapsed=` masked; every B session waited (4.2 s).
- Full check: `pnpm format:check` exit 1 (S-1, BUG-1); `pnpm lint` 0; `pnpm typecheck` 0; `pnpm test` 121 files / 1255 tests; production and CSP gate builds 0, `check-hosted-ref` 0 of 188; `pnpm db:test` Files=26, Tests=2184 PASS; `pnpm test:functions` 0; e2e smoke 18 passed; CSP 23 passed.

## Round 1

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| S-1 | Suites | format | As in the plan, S-1 | exit=1; [warn] actionItems.md, review-1.md, supabase/.temp/linked-project.json. `review-1.md` is an untracked file at the repo root (dated 10:25 today, not part of this branch; `git status` also shows an untracked root `00-decisions.md`, which Prettier accepts). The frozen value allows only actionItems.md and supabase/.temp/* (format.log). Claim BUG-1. | FAIL |
| S-2 | Suites | lint | As in the plan, S-2 | exit=0 (lint.log) | PASS |
| S-3 | Suites | typecheck | As in the plan, S-3 | exit=0, web and e2e (typecheck.log) | PASS |
| S-4 | Suites | pnpm test | As in the plan, S-4 | exit=0; web Test Files 121 passed (121), Tests 1255 passed (1255); e2e unit ℹ tests 6, ℹ fail 0; All checks passed.; files on disk 121. JSON re-run (vitest.json): all 17 named feature files passed (mock-tests 81, parity 6, scope 3, service 64, MockResultsTable 5, StatusChips 3, QuestionDialog 14, TestDialog 10, TakeForm 13, TestResult 9, admin-mock-test-results 10, admin-mock-test 39, admin-mock-tests 8, mock-test 18, mock-tests 15, load-error 5, privacy 11) | PASS |
| S-5 | Suites | production build and hosted-ref | As in the plan, S-5 | VITE_APP_ENV=production pnpm build exit=0; CSP gate build (ci-gates.md:127) exit=0; check-hosted-ref: 0 files (of 188 scanned) (build.log, build-gate.log, hosted-ref.log) | PASS |
| S-6 | Suites | pnpm db:test | As in the plan, S-6 | run after the mid-sitting clean-up (rm_t8 0, profiles 7, sign_up_emails 0, S-0 identical); cron jobs all active; exit=0; Files=26, Tests=2184, Result: PASS; mock_tests_admin, _categories, _closing, _scoring, _taker and open_sign_up_access each ok (dbtest.log) | PASS |
| S-7 | Suites | pnpm test:functions | As in the plan, S-7 | edge runtime restarted; exit=0; 0 "not ok"; sign_up_emails 0 (functions.log) | PASS |
| S-8 | Suites | e2e smoke | As in the plan, S-8 | local-env, then test:smoke: 18 passed incl. "scores marks and a pass mark end to end"; e2e- rows 0\|0\|0\|0; its webServer left node PID 73215 on [::1]:5173 (cwd apps/web), stopped by PID (smoke.log) | PASS |
| S-9 | Suites | CSP sweep | As in the plan, S-9 | on the ci-gates.md:127 gate build: 23 passed; nothing on 4173 or 5173 afterwards (csp.log) | PASS |
| S-10 | Suites | deploy order and scope | As in the plan, S-10 | test-deploy-order exit 0; deploy.sh lines 279, 296, 334; supabase/scripts, functions, config.toml diff empty; migrations diff exactly 20261121100000_mock_test_scoring.sql; the three applied mock migrations 0 lines; attempts writes in the new migration 1 (s10.txt) | PASS |
| LG-1 | Legacy | before and after the migration | As in the plan, LG-1 | lg.sh output equals Appendix B line for line: reset exit=0, 20261120100000, 0, {"score": 1, "total": 2}, before parent null/null and student 1/2, up exit=0, 20261121100000, cmp exit=0, 2\|2, null, list\|submitted\|1\|2\|50\|null, earned\|1/1,0/1, parent submit {"score": 2, "total": 2, "passed": null, "percentage": 100}, results Aarav Demo 1/2 50 null, Local Parent 2/2 100 null. Two attempts compared (one submitted, one in progress). Then pnpm db:reset and S-0 matched (out-lg.sh.txt, lg-before.txt, lg-after.txt) | PASS |
| GR-1 | Catalogue | functions | As in the plan, GR-1 | gr.sql output equals Appendix B: the eight function lines and both return shapes exactly (out-gr.sql.txt) | PASS |
| GR-2 | Catalogue | columns, checks, triggers | As in the plan, GR-2 | as frozen: score/total smallint, marks smallint NOT NULL default 1, pass_mark smallint null; both range checks; the seven triggers, each O (out-gr.sql.txt) | PASS |
| GR-3 | Catalogue | grants, policies, comment | As in the plan, GR-3 | colgrants_tests and colgrants_questions exactly as frozen; anon_cols 0; attempts_answers_grants 0; policies 0; the four admin question policies; comment_score as frozen (out-gr.sql.txt) | PASS |
| MK-1 | Marks | marks on a draft | As in the plan, MK-1 | dr-marks.sh MK-1 block equals Appendix B: nomarks/m1/m100 ok; m0, mneg, m101 23514 marks_range; mnull 23502; mdec ok, stored 1,1,100,3; upd ok, upd0 23514, after 7,1,100,3 (out-dr-marks.sh.txt) | PASS |
| MK-2 | Marks | pass mark on a draft | As in the plan, MK-2 | as frozen: pnull/p1/p100 ok; p0, pneg, p101 23514; pdec ok; u60 ok, u0 23514, unull ok, u75 ok; made p1:1 p100:100 pdec:61 pnull:null; X\|75 | PASS |
| MK-3 | Marks | frozen when released or closed | As in the plan, MK-3 | as frozen: pchg, pnull, qmarks, qsame, qins, qdel, cset, cqmarks P0001 mock_released; psame ok; ctag ok; owner and ownerq mock_released; X released\|60, 3,2; Y released\|null\|true\|english, 3,2 | PASS |
| MK-4 | Marks | take back keeps the pass mark | As in the plan, MK-4 | withdraw ok, kept draft\|60, p80 ok, qm ok, after 80\|3,4 | PASS |
| MK-5 | Marks | release needs a question only | As in the plan, MK-5 | zeroq mock_no_questions, nopass ok, withpass ok, st r0:draft:60 r1:released:null r2:released:100 | PASS |
| SC-1 | Scoring | helpers | As in the plan, SC-1 | pct 66 0 100 33 59 60 100 0 null null 0; pass true false false true true false true true false false null null false true; auth pct/pass permission denied for function; anon permission denied for schema private (out-dr-score.sh.txt) | PASS |
| SC-2 | Scoring | sum of marks, blanks, repeat | As in the plan, SC-2 | all five submit replies exactly as frozen. The last line came out as `stored\|parent@local.test:2/10 student@local.test:1/2 student@local.test:8/10 user@local.test:0/10`, while the frozen line has student@'s two attempts the other way round (8/10 before 1/2). Same four values; the script orders by e-mail only, so the two student@ rows tie and their order is not fixed. Claim BUG-2. | FAIL |
| SC-3 | Scoring | boundaries end to end | As in the plan, SC-3 | every line as frozen: 3/5 at 60 Pass 60; 59/100 Not yet 59; saved 100, 10000/10000 100 Pass; saved 4, 400/400 at 90 Pass; 300/400 75 false; 2/3 at 67 false 66; 0/5 0; 5/5 100; 3/3 at 67 Pass | PASS |
| SC-4 | Scoring | a total of 1 | As in the plan, SC-4 | 1 of 1 Pass 100; 0 of 1 false 0; list submitted\|1\|1\|100\|true; open q 1\|1\|1 | PASS |
| SH-1 | Taker shapes | before Start | As in the plan, SH-1 | dr-shapes.sh equals Appendix B: ns top keys, ns vals not_started\|2\|5\|60\|null\|null\|null\|null\|[], ns list, nopass ns null\|2 (out-dr-shapes.sh.txt) | PASS |
| SH-2 | Taker shapes | in progress | As in the plan, SH-2 | ip vals in_progress\|null\|null\|null\|5; ip qkeys id,marks,options,position,prompt,selected_option; ip marks 3,2; ip leak f; ip list in_progress, all null | PASS |
| SH-3 | Taker shapes | submitted | As in the plan, SH-3 | submit {"score": 3, …, "percentage": 60}; sub vals submitted\|3\|5\|60\|true\|5\|60; sub qkeys with marks_earned; sub earned 3/3,0/2; sub list; nopass sub 50\|null; nopass list submitted\|1\|2\|50\|null | PASS |
| SU-1 | Sums | per-question marks add up | As in the plan, SU-1 | dr-sum.sh equals Appendix B: student A 8\|8\|8, parent A 7\|7\|7, parent legacy 2\|2\|2, legacy list submitted\|2\|3\|66\|null, legacy earned 1/1,1/1,0/1, legacy repeat ok + 2/3 66, user A 0\|0\|0 (out-dr-sum.sh.txt) | PASS |
| SU-2 | Sums | no recalculation | As in the plan, SU-2 | rows 4, close ok\|ok, reopen ok\|ok, tags ok, changed 0 | PASS |
| CS-1 | Closed | submitter keeps the result | As in the plan, CS-1 | dr-closed.sh equals Appendix B: each of student@, parent@, user@: list ca:submitted:true:3/5:60:true; open submitted\|3\|5\|60\|true\|3/3:1:Because B1.,0/2:1:; again not_found twice (out-dr-closed.sh.txt) | PASS |
| CS-2 | Closed | in progress can't open, save, submit | As in the plan, CS-2 | each role B not_found ×3; B attempts true:1 true:1 true:1 | PASS |
| CS-3 | Closed | never started sees nothing | As in the plan, CS-3 | each role C not_found ×2 | PASS |
| CS-4 | Closed | admin results for closed tests | As in the plan, CS-4 | admin Aarav Demo/Local Parent/Local User 3/5 60 true; admin B 0; admin list ca:3 cb:0 cc:0 | PASS |
| RS-1 | Results function | rows, order, count, shape | As in the plan, RS-1 | dr-results.sh equals Appendix B: cols; rows Local Parent 2/5 40 false 2, Aarav Demo 5/5 100 true 2; count 2\|2; draft none; nobody none; unknown not_found; no at 0; list keys as frozen (out-dr-results.sh.txt) | PASS |
| RS-2 | Results function | ties and closing | As in the plan, RS-2 | tie t; close ok; closed rows t\|2 | PASS |
| RS-3 | Results function | name fallback | As in the plan, RS-3 | named Local User / Local Parent / Profile Aarav; blank null / null / Roster Aarav | PASS |
| AZ-1 | Authorisation | results role matrix | As in the plan, AZ-1 | dr-az.sh equals Appendix B: not_admin for all nine (tutor aal1/aal2, parent, student, user aal1/aal2, inactive tutor, newadmin aal1, admin aal1); admin aal2 ok\|1; inactive admin aal2 not_admin; anon permission denied for function mock_test_results (out-dr-az.sh.txt) | PASS |
| AZ-2 | Authorisation | no direct reads | As in the plan, AZ-2 | each of the nine: permission denied for mock_test_attempts and mock_test_answers, with the frozen hints | PASS |
| AZ-3 | Authorisation | no marks or pass-mark writes | As in the plan, AZ-3 | each of the nine: passmark 0, marks 0; anon passmark permission denied with the frozen hint; D 50\|1 | PASS |
| PV-1 | Privacy | own result only | As in the plan, PV-1 | dr-reg.sh equals Appendix B: student 10/10\|100\|true\|10; parent 2/10\|20\|false\|2; parent sees 10 0\|0; user in_progress null null null (out-dr-reg.sh.txt) | PASS |
| PV-2 | Privacy | taker gate | As in the plan, PV-2 | draft not_found; listdraft 0; tutor not_taker; admin as taker not_taker | PASS |
| TS-1 | Two sessions | release holds, pass-mark write refused | As in the plan, TS-1 | A\|\|elapsed=4.2; B\|ERROR:  mock_released\|elapsed=4.2 (waited); after released\|50\|null\|false\|2\|inv=0 (out-ts-real.sh.txt) | PASS |
| TS-2 | Two sessions | pass-mark write first, release waits | As in the plan, TS-2 | A, B no error, B elapsed 4.2; after released\|80\|null\|false\|2\|inv=0; later write ERROR:  mock_released, released\|80\|null\|false | PASS |
| TS-3 | Two sessions | submit holds, pass-mark write refused | As in the plan, TS-3 | A {"score": 2, "total": 2, "passed": true, "percentage": 100} 4.2; B ERROR:  mock_released 4.2; after released\|50\|…\|2\|inv=0 | PASS |
| TS-4 | Two sessions | release holds, marks write refused | As in the plan, TS-4 | B ERROR:  mock_released elapsed 4.2; after released\|50\|null\|false\|2\|inv=0 | PASS |
| TS-5 | Two sessions | marks write first, release keeps it | As in the plan, TS-5 | no errors, B 4.2; after released\|50\|null\|false\|7\|inv=0; take → {"score": 7, "total": 7, "passed": true, "percentage": 100} | PASS |
| TS-6 | Two sessions | take-back holds, pass-mark write lands | As in the plan, TS-6 | no errors, B 4.2; after draft\|80\|null\|false\|2\|inv=0; attempts empty | PASS |
| H-1 | PostgREST | role matrix by HTTP | As in the plan, H-1 | tutor, parent, student, user, admin (aal1) 403 not_admin exactly as frozen; anon 401 permission denied for function mock_test_results; inactive token empty, tokstatus user_banned 400 (out-h-real.sh.txt) | PASS |
| H-2 | PostgREST | admin aal2 row, unknown id | As in the plan, H-2 | tok2 admin2 aal=aal2; 200, 1 row, sorted keys as frozen, Aarav Demo 3 5 60 True 1; unknown id 404 not_found | PASS |
| H-3 | PostgREST | taker calls carry new keys | As in the plan, H-3 | student open 200 3 5 60 True 5 60 [(3, 3), (2, 0)]; list [('submitted', 3, 5, 60, True)]; repeat submit 200 same JSON; parent list [('not_started', None, None, None)] | PASS |
| H-4 | PostgREST | no taker or anon pass-mark write | As in the plan, H-4 | parent PATCH 204, state released\|60\|null\|false; anon 401 with the frozen body | PASS |
| H-5 | PostgREST | more than 1000 rows | As in the plan, H-5 | 200, 1000 rows, total_rows 1003, first Bulk 1003, last Bulk 0004, Content-Range: 0-999/*; bulk accounts removed (profiles like t8-bulk 0) | PASS |
| BM-1 | Marks | Marks field, default 1 | As in the plan, BM-1 | dialog New question; Marks spinbutton value 1, min 1, max 100, step 1, after the options and before Explanation; saved 3 → "Question 2 3 marks", "Question 1 1 mark"; marks_of 1,3; Scoring Total 4 marks | PASS |
| BM-2 | Marks | Marks values refused | As in the plan, BM-2 | ""→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; "0"→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; "-1"→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; "2.5"→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; "101"→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; "1e2"→"Marks must be a whole number from 1 to 100." invalid=true open=true writes=0; 100 saved (1,3,100); question 3 deleted → 1,3 | PASS |
| BM-3 | Marks | Edit a question's marks | As in the plan, BM-3 | prefill 3 → 5: "Question 2 5 marks", Total 7 marks, db 2,5; back to 3: Total 5 marks, db 2,3 | PASS |
| BM-4 | Marks | Scoring card | As in the plan, BM-4 | order Tags,Scoring,Instructions,Questions; bdr Total 5 marks\|Pass mark: 60%, "Total 5 marks" ×1, 2 of 100 questions, cards 2 marks / 3 marks; bdr1 Total 4 marks\|No pass mark; bm4 Total 1 mark\|No pass mark | PASS |
| BM-5 | Marks | No marks control when released or closed | As in the plan, BM-5 | bs and bcl: no Add/Edit/Delete/Marks, locked note, 3 marks / 2 marks, Scoring Total 5 marks\|Pass mark: 60% ; Total 5 marks\|Pass mark: 60% | PASS |
| BP-1 | Pass mark | Pass mark in New mock test | As in the plan, BP-1 | field empty, min 1 max 100 step 1; instructions-before-passmark=true passmark-before-first-tag-select=true; hint shown; bp1 → Total 0 marks\|Pass mark: 60%, db 60; bp1b (Maths / NAPLAN / Any year) → Total 0 marks\|No pass mark, db null\|maths\|naplan\|true | PASS |
| BP-2 | Pass mark | Pass mark values refused | As in the plan, BP-2 | 0→"Please enter a whole number from 1 to 100, or leave the pass mark empty." invalid=true writes=0; -1→"Please enter a whole number from 1 to 100, or leave the pass mark empty." invalid=true writes=0; 60.5→"Please enter a whole number from 1 to 100, or leave the pass mark empty." invalid=true writes=0; 101→"Please enter a whole number from 1 to 100, or leave the pass mark empty." invalid=true writes=0; 1e2→"Please enter a whole number from 1 to 100, or leave the pass mark empty." invalid=true writes=0; then bp2:1 bp2b:100 | PASS |
| BP-3 | Pass mark | Change and clear on a draft | As in the plan, BP-3 | prefill 60 → 75: Details saved., Pass mark: 75%, db 75; cleared → No pass mark, db null | PASS |
| BP-4 | Pass mark | Release without a pass mark | As in the plan, BP-4 | dialog "Release this mock test? Students, parents and signed-up users will be able to take it free of cost. Questions and details can’t be changed after this. Takers filter mock tests by these, so set them be", no pass-mark field; Released. People can take it now.; Scoring Total 1 mark\|No pass mark; student intro has "Total 1 mark" and no "Pass mark" | PASS |
| BP-5 | Pass mark | Take back keeps it, editable | As in the plan, BP-5 | released: no Edit details, Pass mark: 70%; Back to draft., kept 70; Edit details prefill 70 → 65: Pass mark: 65%; state draft\|65\|null\|false | PASS |
| BE-1 | Edit page state | Draft | As in the plan, BE-1 | chips Draft; notice "Draft: only admins can see this mock test. Release it when it is ready."; buttons Results,Edit details,Release,Delete draft; no hints; cards Tags,Scoring,Instructions,Questions; scoring Total 5 marks\|Pass mark: 60%; instructions and 2 of 100 questions, Add question | PASS |
| BE-2 | Edit page state | Released, open | As in the plan, BE-2 | chips Released; notice "Released: students, parents and signed-up users can take it. It can only go back to draft until someone submits it."; buttons Results,Edit tags,Set closing date,Close now,Take back to draft; scoring Total 5 marks\|Pass mark: 60%; locked note | PASS |
| BE-3 | Edit page state | Closed | As in the plan, BE-3 | chips Released,Closed; "Closed 18 Nov 2026, 11:07 am"; notice "Closed: people who haven’t submitted it can’t see or take it. People who submitted it still see their result. Open it again with Set closing date."; buttons Results,Edit tags,Set closing date,Take back to draft; scoring Total 5 marks\|Pass mark: 60%; no "can take it" | PASS |
| BA-1 | Results view | List: Results link, no names | As in the plan, BA-1 | headers Title,Status,Tags,Questions,Submitted,Created by,Last changed,Results; 16 rows, each with Results link "Results for <title>" → …/results; bs Submitted 2; no names, scores, %, Pass, Not yet or @ in the list | PASS |
| BA-2 | Results view | Page with rows | As in the plan, BA-2 | MISMATCH req count: got 3 want 2 \|\| h1 Results: t8-1794959933-bs; intro, back link, meta Pass mark: 60%; headers Name,Submitted,Score,Percentage,Result; rows Local Parent \| 18 Nov 2026, 11:07 am \| 2 of 5 marks \| 40% \| Not yet // Aarav Demo \| 18 Nov 2026, 11:07 am \| 3 of 5 marks \| 60% \| Pass; controls 0, links ← Back to mock test; requests GET profiles?select=full_name,role,is_active&id=eq.8e81912d-fd74-42f3-a40b-b4d2b770ec59 ; GET mock_tests?select=id,title,status,closes_at,pass_mark&id=eq.82d24c89-ed28-4af6-9421-d74a52435aea ; POST rpc/mock_test_results | FAIL |
| BA-3 | Results view | Draft and nobody submitted | As in the plan, BA-3 | bdr: h1, Pass mark: 60%, empty text (colour rgb(75, 85, 99)), no table; bnew: empty + Pass mark: 60%; bdr1: empty, no meta line, no chip; empty-text colour equals the intro's secondary colour rgb(75, 85, 99) | PASS |
| BA-4 | Results view | Closed test | As in the plan, BA-4 | Closed chip + Pass mark: 60%; rows Aarav Demo \| 18 Nov 2026, 11:07 am \| 5 of 5 marks \| 100% \| Pass; reopened: same rows, no chip; closed again; screenshots shots/BA-4-bcl-results-* | PASS |
| BA-5 | Results view | No pass mark, legacy, total of 1 | As in the plan, BA-5 | bnp: Local Parent \| 18 Nov 2026, 11:07 am \| 1 of 2 marks \| 50% \| ; bleg and b1 rows as frozen | PASS |
| BA-6 | Results view | Name fallback | As in the plan, BA-6 | rows Name not set \| 18 Nov 2026, 11:07 am \| 0 of 1 mark \| 0% \| Not yet // Aarav Demo \| 18 Nov 2026, 11:07 am \| 1 of 1 mark \| 100% \| Pass; restored names: admin@local.test\|Local Admin inactive@local.test\|Inactive Tutor newadmin@local.test\|New Admin parent@local.test\|Local Parent student@local.test\|Aarav Demo tutor@local.test\|Local Tutor user@local.test\|Local User | PASS |
| BA-7 | Results view | More than 1000 submissions | As in the plan, BA-7 | note "Showing 1000 of 1003 submissions. The oldest are not listed."; 1000 rows; first Bulk 1003 \| 2 Nov 2026, 2:43 am \| 1 of 2 marks \| 50% \| Pass; last Bulk 0004 \| 1 Nov 2026, 10:04 am \| 1 of 2 marks \| 50% \| Pass; Bulk 0001-0003 absent; bs no note; removed, profiles 7; screenshots shots/BA-7-bulk-results-* | PASS |
| BA-8 | Results view | Not found and failed load | As in the plan, BA-8 | unknown id: Not found + text, rpc calls 0; aborted rpc: alert "We couldn't reach the server. Check your connection and try again. Try again" + Try again; after Try again 2 rows; console (excl. the aborted request) 0 | PASS |
| BA-9 | Results view | Nobody else gets in | As in the plan, BA-9 | MISMATCH newadmin verify: /portal/account/two-step/setup \|\| tutor: refused, requests 0; parent: refused, requests 0; student: refused, requests 0; user: refused, requests 0; newadmin: /portal/account/two-step/setup, rpc 0; signed out: /portal/login?next=%2Fportal%2Fadmin%2Fmock-tests%2F82d24c89-ed28-4af6-9421-d74a52435aea%2Fresults; inactive: message 1 | FAIL |
| BA-10 | Results view | Results button and back | As in the plan, BA-10 | bdr: first Results\|true, round trip ok h1 t8-1794959933-bdr; bs: first Results\|true, round trip ok h1 t8-1794959933-bs; bcl: first Results\|true, round trip ok h1 t8-1794959933-bcl | PASS |
| PR-1 | Privacy | Privacy sentence | As in the plan, PR-1 | 375: 200, sentence present, h1 1, overflow 0, console 0, robots 1; 1280: 200, sentence present, h1 1, overflow 0, console 0, robots 1; static 1,1 | PASS |
| BT-1 | Taker | Start page with a pass mark | As in the plan, BT-1 | card t8-1794959933-bnew 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Not started Start; intro "← All mock tests t8-1794959933-bnew Not started Subject: Maths Stream: NAPLAN Year level: Any year Instructions Fixture instructions for bnew. 2 questions Total 5 marks Pass mark: 60% Start" | PASS |
| BT-2 | Taker | Start page, no pass mark, total 1 | As in the plan, BT-2 | bnew2 (user@): ← All mock tests t8-1794959933-bnew2 Not started Subject: Maths Stream: NAPLAN Year level: Any year Instructions Fixture instructions for bnew2. 2 questions Tot; b1 (parent@): ← All mock tests t8-1794959933-b1 Not started Subject: Maths Stream: NAPLAN Year level: Any year Instructions Fixture instructions for b1. 1 question Total 1 ma | PASS |
| BT-3 | Taker | Marks per question before submit | As in the plan, BT-3 | bs list card (in progress): chips In progress, buttons Continue; bnew Q1 "3 marks", Q2 "2 marks"; open response keys id,marks,options,position,prompt,selected_option / id,marks,options,position,prompt,selected_option, percentage null, passed null | PASS |
| BT-4 | Taker | Submit: score, %, Pass | As in the plan, BT-4 | dialog "Submit this mock test? 1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this. Cancel Submit"; result 3 of 5 marks (60%), chips Submitted,Pass; Q1 "Question 1 Q1 of bnew? 3 of 3 marks Your answer: B. B1 Correct answer: B. B1 Explanation: Because B1."; Q2 "Question 2 Q2 of bnew? 0 of 2 marks Your answer: No answer. Correct answer: B. B2"; chip class MuiChip-root MuiChip-outlined MuiChip-sizeSmall MuiChip-colorDefault, color rgb(23, 32, 51), border rgb(189, 189, 189); card t8-1794959933-bnew 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 3 of 5 marks (60%) Pass View result; db user@local.test\|true\|3\|5 | PASS |
| BT-5 | Taker | Not yet | As in the plan, BT-5 | b59 card t8-1794959933-b59 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 59 of 100 marks (59%) Not yet View result; q 59 of 59 marks, 0 of 41 marks; bs (parent) card t8-1794959933-bs 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 2 of 5 marks (40%) Not yet View result; q 0 of 3 marks, 2 of 2 marks | PASS |
| BT-6 | Taker | No pass mark | As in the plan, BT-6 | card t8-1794959933-bnp 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 1 of 2 marks (50%) View result; result 1 of 2 marks (50%), labels 0; q 1 of 1 mark, 0 of 1 mark | PASS |
| BT-7 | Taker | A total of 1 reads "mark" | As in the plan, BT-7 | student: 1 of 1 mark (100%), Pass, q "1 of 1 mark"; user: 0 of 1 mark (0%), Not yet, q "0 of 1 mark" | PASS |
| BT-8 | Taker | Closed test, submitter | As in the plan, BT-8 | card t8-1794959933-bcl 2 questions Subject: English Stream: VCE Tutoring Year level: Years 11, 12 Submitted Closed 5 of 5 marks (100%) Pass View result chips Submitted,Closed,Pass; result 5 of 5 marks (100%) Pass; q 3 of 3 marks, 2 of 2 marks | PASS |
| BT-9 | Taker | Closed test, everyone else | As in the plan, BT-9 | parent: not listed, link Not found, rpc 404; user: not listed, link Not found, rpc 404 | PASS |
| BT-10 | Taker | Legacy-shaped attempt | As in the plan, BT-10 | card t8-1794959933-bleg 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 1 of 2 marks (50%) View result; result 1 of 2 marks (50%), no label; q 1 of 1 mark, 0 of 1 mark | PASS |
| BT-11 | Taker | Parent sees only own result | As in the plan, BT-11 | list and bs result 2 of 5 marks (40%); no "3 of 5 marks" or "60%" on list, bs or bnp result; rpc bs score 2 | PASS |
| BK-1 | Keyboard | New admin fields by keyboard | As in the plan, BK-1 | Tab → Add question (visible true); dialog order New questionQuestion *Question *Plain text. Line b > Question > Option A is correct > Option A > Option B is correct > Option B > Add option > Marks > Explanation (optional) > Cancel > Save question; Enter saved, card "Question 3 4 marks"; focus after on BUTTON "Add question"; New mock test by Enter; order New mock testTitle *Title *Instructions (optional) > Title > Instructions (optional) > Pass mark (%, optional); keys 5,0 → "50"; Escape → focus "New mock test"; question removed, marks_of 1,3; console 0 | PASS |
| BK-2 | Keyboard | Results by keyboard | As in the plan, BK-2 | MISMATCH opens by Space: http://localhost:5173/portal/admin/mock-tests/82d24c89-ed28-4af6-9421-d74a52435aea \|\| Tab reaches "Results for t8-1794959933-bdr1" (focus visible true); results page Tab stops in main: ← Back to mock test; edit page Results (first header button) opens by Enter; and by Space false; console 0 | FAIL |
| BK-3 | Keyboard | Names and roles | As in the plan, BK-3 | table "Mock test results" ×1; columnheaders Name,Submitted,Score,Percentage,Result; body rows 2 with 5,5 cells, role=cell 10, rows 3; spinbutton Marks ×1, Pass mark (%, optional) ×1 | PASS |
| BR-1 | Widths | Admin pages and dialogs | As in the plan, BR-1 | 24 measurements: list@375/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls true; list@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls true; list@1280/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls false; list@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls false; bdr-edit@375/light: overflow 0, light, rgb(255, 255, 255), console 0; bdr-edit@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; bdr-edit@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; bdr-edit@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; question-dialog-error@375/light: overflow 0, light, rgb(255, 255, 255), console 0; question-dialog-error@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; question-dialog-error@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; question-dialog-error@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; test-dialog-error@375/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls true; test-dialog-error@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls true; test-dialog-error@1280/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls false; test-dialog-error@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls false; bs-results@375/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls true; bs-results@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls true; bs-results@1280/light: overflow 0, light, rgb(255, 255, 255), console 0, table container scrolls false; bs-results@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0, table container scrolls false; bdr-results-empty@375/light: overflow 0, light, rgb(255, 255, 255), console 0; bdr-results-empty@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; bdr-results-empty@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; bdr-results-empty@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; header toggle → dark rgb(11, 18, 32) | PASS |
| BR-2 | Widths | Taker pages | As in the plan, BR-2 | 20 measurements: intro-bnew2-user@375/light: overflow 0, light, rgb(255, 255, 255), console 0; intro-bnew2-user@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; intro-bnew2-user@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; intro-bnew2-user@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; intro-b1-parent@375/light: overflow 0, light, rgb(255, 255, 255), console 0; intro-b1-parent@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; intro-b1-parent@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; intro-b1-parent@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; question-bs-user@375/light: overflow 0, light, rgb(255, 255, 255), console 0; question-bs-user@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; question-bs-user@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; question-bs-user@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; result-bs-student@375/light: overflow 0, light, rgb(255, 255, 255), console 0; result-bs-student@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; result-bs-student@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; result-bs-student@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0; list-student@375/light: overflow 0, light, rgb(255, 255, 255), console 0; list-student@375/dark: overflow 0, dark, rgb(11, 18, 32), console 0; list-student@1280/light: overflow 0, light, rgb(255, 255, 255), console 0; list-student@1280/dark: overflow 0, dark, rgb(11, 18, 32), console 0 | PASS |
| BR-3 | Widths | Result line wraps, no overflow | As in the plan, BR-3 | light: result {"scoreRight":292.078125,"chipRight":93.140625,"sameLine":false,"chipBelow":true,"wrap":"wrap"}; card {"scoreRight":208.53125,"chipRight":272.671875,"sameLine":true,"chipBelow":false,"wrap":"wrap"}; dark: result {"scoreRight":292.078125,"chipRight":93.140625,"sameLine":false,"chipBelow":true,"wrap":"wrap"}; card {"scoreRight":208.53125,"chipRight":272.671875,"sameLine":true,"chipBelow":false,"wrap":"wrap"} | PASS |
| R-1 | Regression | Nav and the way in | As in the plan, R-1 | student nav ["My work","Timetable","Mock tests","Account"]; student link card → /portal/student/mock-tests (in-app true); parent nav ["My children","Mock tests","Account"]; parent link card → /portal/parent/mock-tests (in-app true); user nav ["Latest news","Mock tests","Account"]; user link card → /portal/user/mock-tests (in-app true); tutor nav ["Dashboard","Timetable","Classes","Assignments","My profile","Account"]; admin nav ["Dashboard","Timetable","Classes","Assignments","My profile","Admin","Account"]; admin shortcut → /portal/admin/mock-tests | PASS |
| R-2 | Regression | Refused and signed out | As in the plan, R-2 | tutor refused, admin_list requests 0; parent refused, admin_list requests 0; signed out → /portal/login?next=%2Fportal%2Fuser%2Fmock-tests%2F82d24c89-ed28-4af6-9421-d74a52435aea | PASS |
| R-3 | Regression | Questions on a draft | As in the plan, R-3 | 2 added; move 2 up → first "What is 3 + 3?"; edit → "What is 3 + 3, edited?"; delete first → 1 of 100 questions; positions 2 (gap kept); "Question 1 1 mark", Total 1 mark; console 0 | PASS |
| R-4 | Regression | Take, submit, result | As in the plan, R-4 | card Not started; header tag line; Question 1 of 2 with "1 mark"; B → Saved; dialog "Submit this mock test? 1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this. Cancel Submit"; result 1 of 2 marks (50%), no label; card t8-1794959933-r4 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted 1 of 2 marks (50%) View result | PASS |
| R-5 | Regression | Answer key hidden until submit | As in the plan, R-5 | in-progress open response (720 bytes) has no correct_option, explanation or marks_earned; dr-shapes.sh ip qkeys\|id,marks,options,position,prompt,selected_option | PASS |
| R-6 | Regression | Take-back on an open test | As in the plan, R-6 | r6 → Back to draft., attempts 0; bs refused with the frozen text, still released | PASS |
| R-7 | Regression | Draft and unknown ids not found | As in the plan, R-7 | draft: Not found true, rpc 404; random: Not found true, rpc 404 | PASS |
| R-8 | Regression | Sign-in and reload for each role | As in the plan, R-8 | admin → /portal/admin, reload /portal/admin, console 0; tutor → /portal/tutor, reload /portal/tutor, console 0; student → /portal/student, reload /portal/student, console 0; parent → /portal/parent, reload /portal/parent, console 0; user → /portal/user, reload /portal/user, console 0; inactive → /portal/login, "Email or password is incorrect." 1 | PASS |
| R-9 | Regression | Public pages carry no results | As in the plan, R-9 | 22 sitemap URLs × 2 = 44 loads, failures []; /privacy "mock test" count 375: 1, 1280: 1; built html with "mock test": apps/web/build/client/privacy/index.html; words in html: ""; sitemap mock 0; changed route files 12; scope grep ""; functions/templates diff "" | PASS |
| R-10 | Regression | Mobile and roles untouched | As in the plan, R-10 | mobile HEAD bf14460174abb00978b3ec1631d0c23204235807; status lines 0, same as run start; app_role in migrations diff 0 | PASS |
| R-11 | Regression | Students' and parents' other pages | As in the plan, R-11 | student home: My work, the three seed titles and the link card; parent home lists Aarav and Noah; console 0 | PASS |
| R-12 | Regression | Delete draft | As in the plan, R-12 | dialog "Delete this draft? “t8-1794959933-r12” and its questions will be removed. Cancel Delete draft"; back on the list, r12 gone; rows 0, questions 0; bs has no Delete draft | PASS |
| R-13 | Regression | In-progress answer survives a reload | As in the plan, R-13 | after reload In progress, B selected true, Answered 1 of 2; db 1\|1 | PASS |
| R-14 | Regression | Taker filters still work | As in the plan, R-14 | pre-check 12; All: 12 cards b1,b59,bcl,bleg,bnew,bnew2,bnp,bp1b,bs,r13,r4,r5; English → bcl; VCE Tutoring → bcl; Writing → no match + Clear filters; cleared → 12, focus H1 Mock tests | PASS |
| R-15 | Regression | Close now and reopen, scores untouched | As in the plan, R-15 | confirm text as frozen; "Closed. Only people …"; user card t8-1794959933-r15 2 questions Subject: Maths Stream: NAPLAN Year level: Any year Submitted Closed 3 of 5 marks (60%) Pass View result chips Submitted,Closed,Pass; cleared "Closing date cleared. It never closes."; attempts user@local.test\|true\|3\|5 → user@local.test\|true\|3\|5 | PASS |
| R-16 | Regression | Edit tags with a pass mark | As in the plan, R-16 | Tags saved.; Pass mark: 60%; state released\|60\|null\|false; results Local Parent\|2\|5\|40\|false\|2 Aarav Demo\|3\|5\|60\|true\|2 (unchanged) | PASS |
| CL-1 | Clean-up | end of every writing sitting | As in the plan, CL-1 | Sitting 1: rm_t8 0, S-0 identical (cl1-s1.txt). Sitting 2: mid-sitting clean-up before S-6 and again at the end, S-0 identical (midclean.txt, cl1-s2.txt). Sitting 4: rm_t8 0, mock_tests 0, attempts 0, profiles 7, sign_up_emails 0, S-0 identical (cl1-final.txt, s0-final.txt); no *.hdr, tokstatus, last.* or status.json left; anon.hdr deleted; dev server PID 74772 (cwd apps/web) stopped; nothing on 5173 or 4173 | PASS |
| V-1 | Lead visual | marks and pass-mark fields, Scoring card | As in the plan, V-1 | screenshots shots/BR-1-bdr-edit-*, BR-1-question-dialog-error-*, BR-1-test-dialog-error-* (375 and 1280, light and dark) | LEAD |
| V-2 | Lead visual | Results page | As in the plan, V-2 | shots/BR-1-bs-results-*, BR-1-bdr-results-empty-*, BA-4-bcl-results-*, BA-7-bulk-results-* | LEAD |
| V-3 | Lead visual | Pass / Not yet and per-question marks | As in the plan, V-3 | shots/BR-2-result-bs-student-*, BR-2-list-student-*, BR-3-result-b59-375-*, BR-3-card-b59-375-*; chip style in bt4-chip.json | LEAD |
| V-4 | Lead visual | start page totals and marks line | As in the plan, V-4 | shots/BR-2-intro-bnew2-user-*, BR-2-intro-b1-parent-*, BR-2-question-bs-user-* | LEAD |

Pass rate: 104/113 = 92.0% · Counts (recounted by `run-1/recount.py`, which counts row IDs inside this round only): PASS 104, FAIL 5, BLOCKED 0, LEAD 4 · Defects: no app bug; five claims (BUG-1 to BUG-5).

### By section

| Section | Rows | PASS | FAIL | LEAD |
|---|---|---|---|---|
| Suites (S) | 10 | 9 | 1 | 0 |
| Legacy, catalogue, marks, scoring, shapes, sums (LG, GR, MK, SC, SH, SU) | 18 | 17 | 1 | 0 |
| Closed, results, authorisation, privacy (CS, RS, AZ, PV) | 12 | 12 | 0 | 0 |
| Two-session (TS) | 6 | 6 | 0 | 0 |
| PostgREST (H) | 5 | 5 | 0 | 0 |
| Browser: admin (BM, BP, BE) | 13 | 13 | 0 | 0 |
| Browser: Results view and privacy (BA, PR) | 11 | 9 | 2 | 0 |
| Browser: taker (BT) | 11 | 11 | 0 | 0 |
| Browser: keyboard, widths (BK, BR) | 6 | 5 | 1 | 0 |
| Lead visual (V) | 4 | 0 | 0 | 4 |
| Regression (R) | 16 | 16 | 0 | 0 |
| Clean-up (CL) | 1 | 1 | 0 | 0 |
| **Total** | **113** | **104** | **5** | **4** |

## Defects

None. No row found an app bug.

## Claims for the lead (not ruled by the Test Manager)

| Claim | Row | Kind | Summary | Proposed |
|---|---|---|---|---|
| [BUG-1](bugs/BUG-1.md) | S-1 | environment | `format:check` also lists `review-1.md`, an untracked file at the repo root that is not part of this branch. | PASS once the stray root files are confirmed or removed |
| [BUG-2](bugs/BUG-2.md) | SC-2 | case error | The `stored` line orders student@'s two tied rows the other way round; same four values. | plan error, PASS |
| [BUG-3](bugs/BUG-3.md) | BA-2 | case error | A third request, the portal layout's read of the admin's own profile, besides the two the plan named. | plan error, PASS |
| [BUG-4](bugs/BUG-4.md) | BA-9 | case error | newadmin@ (no authenticator) lands on `/portal/account/two-step/setup`, not `/portal/login/verify`; no results request. | plan error, PASS with that page |
| [BUG-5](bugs/BUG-5.md) | BK-2 | case error (minor a11y note) | The edit page's `Results` is a link-button, so Enter opens it and Space doesn't. | plan error, PASS on Enter |

Also for the lead: in BT-9 the console holds two `Failed to load resource … 404` lines. They are the row's own `rpc/mock_test_open` 404s, which §0.1 excludes; no other console error was seen in any browser row. V-1 to V-4 wait for the lead's visual judgement (`run-1/shots/`, 375 and 1280, light and dark).

## Method notes (harness errors, re-run; not app defects)

Two first attempts failed on the harness, not on the build. Each was fixed and re-run in full, and only the re-run is in the table. The first attempts' lines are kept in `run-1/browser-results-attempt1.tsv` and `browser-results-s3b-attempt1.tsv`.
- **Sitting 3, part A (13 rows):** the first harness read the edit page straight after a dialog closed, before the page refreshed (a probe showed the new value 300 ms later). It also counted the question cards' `Correct answer` chips as header chips, and looked for tag-select `<label>`s the MUI select doesn't have. Its delete step then removed the wrong question on `bdr1`. Before the re-run, the first attempt's admin fixtures (`bp1`, `bp1b`, `bp2`, `bp2b`, `bp5`, `bm4`) were removed and `bdr1` was rebuilt as frozen (one 1-mark question). The re-run waits for the refresh. All 13 rows passed.
- **BA-2, BA-3, BA-5, BA-10:** the first harness read the h1 and title before the Results route's loader finished (React Router keeps the old page meanwhile). It compared an empty last cell without its trailing space, and looked for `Outlined` where MUI writes `MuiButton-outlined`. In the re-run, BA-3, BA-5 and BA-10 passed; BA-2 failed again, only on its request count (BUG-3).
- The first `s3b` run also stopped on a SQL precedence slip in the harness (`||` before `#>>`) after BA-1, which had already passed. BA-1 was not re-run.

## Not covered

NC-1 to NC-8 of the plan (§5): Saurabh's staging check, the hosted migration, the production deploy, other browsers and screen readers, the mobile app, the deferred items, the decimal limit (frozen as a known limit), and the owner-written pass-mark race. No hosted service was touched.

## State left behind

- Database: migrated (`20261121100000`) and at the seed state. `run-1/s0-final.txt` is identical to `s0-start.txt`: 0 mock tests, 0 attempts, 7 profiles, `private.sign_up_emails` 0, and no `t8-bulk` accounts.
- Processes: the dev server PID 74772 (cwd `apps/web`) and the smoke's leftover PID 73215 (cwd `apps/web`) were stopped by PID. Nothing listens on 5173 or 4173.
- Removed: `anon.hdr`, every token, `.tokstatus` and `last.*` file, `status.json`, and `e2e/.env`.
- No code edits and no commits.

## Verdict

**Pending lead.** 104/113 PASS. Five FAIL rows are claims (one environment, four case errors), with no app defect. Four LEAD rows wait for the V judgement. If the five claims are ruled as proposed and V-1 to V-4 pass, the round stands at 113/113.

## Round 2

Build: the same, `399c8cf` (`git diff 399c8cf HEAD -- apps supabase e2e` is empty; the only change since round 1 is the lead's §12 ruling appended to `06-test-plan.md`). Re-run: S-1 only, after the lead removed the stray root files `review-1.md` and `00-decisions.md`. Ruled to PASS by §12: SC-2, BA-2, BA-9 and BK-2 (plan errors). Every other round-1 PASS row is carried on the identical build. V-1 to V-4 stay LEAD.

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| S-1 | Suites | format | As in the plan, S-1 | Re-run in round 2 on the same build: exit=1; [warn] only actionItems.md and supabase/.temp/linked-project.json; the filter for other files prints no lines (run-1/format-r2.log). The lead removed the stray root files (§12.1). | PASS |
| S-2 | Suites | lint | As in the plan, S-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-3 | Suites | typecheck | As in the plan, S-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-4 | Suites | pnpm test | As in the plan, S-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-5 | Suites | production build and hosted-ref | As in the plan, S-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-6 | Suites | pnpm db:test | As in the plan, S-6 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-7 | Suites | pnpm test:functions | As in the plan, S-7 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-8 | Suites | e2e smoke | As in the plan, S-8 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-9 | Suites | CSP sweep | As in the plan, S-9 | Carried from round 1 (PASS) on the identical build. | PASS |
| S-10 | Suites | deploy order and scope | As in the plan, S-10 | Carried from round 1 (PASS) on the identical build. | PASS |
| LG-1 | Legacy | before and after the migration | As in the plan, LG-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| GR-1 | Catalogue | functions | As in the plan, GR-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| GR-2 | Catalogue | columns, checks, triggers | As in the plan, GR-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| GR-3 | Catalogue | grants, policies, comment | As in the plan, GR-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| MK-1 | Marks | marks on a draft | As in the plan, MK-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| MK-2 | Marks | pass mark on a draft | As in the plan, MK-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| MK-3 | Marks | frozen when released or closed | As in the plan, MK-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| MK-4 | Marks | take back keeps the pass mark | As in the plan, MK-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| MK-5 | Marks | release needs a question only | As in the plan, MK-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| SC-1 | Scoring | helpers | As in the plan, SC-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| SC-2 | Scoring | sum of marks, blanks, repeat | As in the plan, SC-2 | Round 1 actual stands (see round 1); ruled a plan error, PASS (ruling §12.2). | PASS |
| SC-3 | Scoring | boundaries end to end | As in the plan, SC-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| SC-4 | Scoring | a total of 1 | As in the plan, SC-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| SH-1 | Taker shapes | before Start | As in the plan, SH-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| SH-2 | Taker shapes | in progress | As in the plan, SH-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| SH-3 | Taker shapes | submitted | As in the plan, SH-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| SU-1 | Sums | per-question marks add up | As in the plan, SU-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| SU-2 | Sums | no recalculation | As in the plan, SU-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| CS-1 | Closed | submitter keeps the result | As in the plan, CS-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| CS-2 | Closed | in progress can't open, save, submit | As in the plan, CS-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| CS-3 | Closed | never started sees nothing | As in the plan, CS-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| CS-4 | Closed | admin results for closed tests | As in the plan, CS-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| RS-1 | Results function | rows, order, count, shape | As in the plan, RS-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| RS-2 | Results function | ties and closing | As in the plan, RS-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| RS-3 | Results function | name fallback | As in the plan, RS-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| AZ-1 | Authorisation | results role matrix | As in the plan, AZ-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| AZ-2 | Authorisation | no direct reads | As in the plan, AZ-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| AZ-3 | Authorisation | no marks or pass-mark writes | As in the plan, AZ-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| PV-1 | Privacy | own result only | As in the plan, PV-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| PV-2 | Privacy | taker gate | As in the plan, PV-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-1 | Two sessions | release holds, pass-mark write refused | As in the plan, TS-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-2 | Two sessions | pass-mark write first, release waits | As in the plan, TS-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-3 | Two sessions | submit holds, pass-mark write refused | As in the plan, TS-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-4 | Two sessions | release holds, marks write refused | As in the plan, TS-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-5 | Two sessions | marks write first, release keeps it | As in the plan, TS-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| TS-6 | Two sessions | take-back holds, pass-mark write lands | As in the plan, TS-6 | Carried from round 1 (PASS) on the identical build. | PASS |
| H-1 | PostgREST | role matrix by HTTP | As in the plan, H-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| H-2 | PostgREST | admin aal2 row, unknown id | As in the plan, H-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| H-3 | PostgREST | taker calls carry new keys | As in the plan, H-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| H-4 | PostgREST | no taker or anon pass-mark write | As in the plan, H-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| H-5 | PostgREST | more than 1000 rows | As in the plan, H-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| BM-1 | Marks | Marks field, default 1 | As in the plan, BM-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BM-2 | Marks | Marks values refused | As in the plan, BM-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| BM-3 | Marks | Edit a question's marks | As in the plan, BM-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BM-4 | Marks | Scoring card | As in the plan, BM-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| BM-5 | Marks | No marks control when released or closed | As in the plan, BM-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| BP-1 | Pass mark | Pass mark in New mock test | As in the plan, BP-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BP-2 | Pass mark | Pass mark values refused | As in the plan, BP-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| BP-3 | Pass mark | Change and clear on a draft | As in the plan, BP-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BP-4 | Pass mark | Release without a pass mark | As in the plan, BP-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| BP-5 | Pass mark | Take back keeps it, editable | As in the plan, BP-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| BE-1 | Edit page state | Draft | As in the plan, BE-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BE-2 | Edit page state | Released, open | As in the plan, BE-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| BE-3 | Edit page state | Closed | As in the plan, BE-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-1 | Results view | List: Results link, no names | As in the plan, BA-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-2 | Results view | Page with rows | As in the plan, BA-2 | Round 1 actual stands (see round 1); ruled a plan error, PASS (ruling §12.3). | PASS |
| BA-3 | Results view | Draft and nobody submitted | As in the plan, BA-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-4 | Results view | Closed test | As in the plan, BA-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-5 | Results view | No pass mark, legacy, total of 1 | As in the plan, BA-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-6 | Results view | Name fallback | As in the plan, BA-6 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-7 | Results view | More than 1000 submissions | As in the plan, BA-7 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-8 | Results view | Not found and failed load | As in the plan, BA-8 | Carried from round 1 (PASS) on the identical build. | PASS |
| BA-9 | Results view | Nobody else gets in | As in the plan, BA-9 | Round 1 actual stands (see round 1); ruled a plan error, PASS (ruling §12.4). | PASS |
| BA-10 | Results view | Results button and back | As in the plan, BA-10 | Carried from round 1 (PASS) on the identical build. | PASS |
| PR-1 | Privacy | Privacy sentence | As in the plan, PR-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-1 | Taker | Start page with a pass mark | As in the plan, BT-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-2 | Taker | Start page, no pass mark, total 1 | As in the plan, BT-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-3 | Taker | Marks per question before submit | As in the plan, BT-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-4 | Taker | Submit: score, %, Pass | As in the plan, BT-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-5 | Taker | Not yet | As in the plan, BT-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-6 | Taker | No pass mark | As in the plan, BT-6 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-7 | Taker | A total of 1 reads "mark" | As in the plan, BT-7 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-8 | Taker | Closed test, submitter | As in the plan, BT-8 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-9 | Taker | Closed test, everyone else | As in the plan, BT-9 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-10 | Taker | Legacy-shaped attempt | As in the plan, BT-10 | Carried from round 1 (PASS) on the identical build. | PASS |
| BT-11 | Taker | Parent sees only own result | As in the plan, BT-11 | Carried from round 1 (PASS) on the identical build. | PASS |
| BK-1 | Keyboard | New admin fields by keyboard | As in the plan, BK-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BK-2 | Keyboard | Results by keyboard | As in the plan, BK-2 | Round 1 actual stands (see round 1); ruled a plan error, PASS (ruling §12.5). | PASS |
| BK-3 | Keyboard | Names and roles | As in the plan, BK-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| BR-1 | Widths | Admin pages and dialogs | As in the plan, BR-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| BR-2 | Widths | Taker pages | As in the plan, BR-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| BR-3 | Widths | Result line wraps, no overflow | As in the plan, BR-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-1 | Regression | Nav and the way in | As in the plan, R-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-2 | Regression | Refused and signed out | As in the plan, R-2 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-3 | Regression | Questions on a draft | As in the plan, R-3 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-4 | Regression | Take, submit, result | As in the plan, R-4 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-5 | Regression | Answer key hidden until submit | As in the plan, R-5 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-6 | Regression | Take-back on an open test | As in the plan, R-6 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-7 | Regression | Draft and unknown ids not found | As in the plan, R-7 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-8 | Regression | Sign-in and reload for each role | As in the plan, R-8 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-9 | Regression | Public pages carry no results | As in the plan, R-9 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-10 | Regression | Mobile and roles untouched | As in the plan, R-10 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-11 | Regression | Students' and parents' other pages | As in the plan, R-11 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-12 | Regression | Delete draft | As in the plan, R-12 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-13 | Regression | In-progress answer survives a reload | As in the plan, R-13 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-14 | Regression | Taker filters still work | As in the plan, R-14 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-15 | Regression | Close now and reopen, scores untouched | As in the plan, R-15 | Carried from round 1 (PASS) on the identical build. | PASS |
| R-16 | Regression | Edit tags with a pass mark | As in the plan, R-16 | Carried from round 1 (PASS) on the identical build. | PASS |
| CL-1 | Clean-up | end of every writing sitting | As in the plan, CL-1 | Carried from round 1 (PASS) on the identical build. | PASS |
| V-1 | Lead visual | marks and pass-mark fields, Scoring card | As in the plan, V-1 | Carried from round 1; screenshots in run-1/shots/; awaiting the lead. | LEAD |
| V-2 | Lead visual | Results page | As in the plan, V-2 | Carried from round 1; screenshots in run-1/shots/; awaiting the lead. | LEAD |
| V-3 | Lead visual | Pass / Not yet and per-question marks | As in the plan, V-3 | Carried from round 1; screenshots in run-1/shots/; awaiting the lead. | LEAD |
| V-4 | Lead visual | start page totals and marks line | As in the plan, V-4 | Carried from round 1; screenshots in run-1/shots/; awaiting the lead. | LEAD |

Pass rate: 109/113 = 96.5% · Counts (recounted by `run-1/recount.py` on this round only): PASS 109 (re-run 1, ruled 4, carried 104), FAIL 0, BLOCKED 0, LEAD 4 · Defects: none.

### Verdict (round 2)

**Pending lead.** 109/113 PASS: one row re-run, four ruled, and 104 carried on an identical build. V-1 to V-4 wait for the lead's visual judgement. No app defect is open. State: DB migrated and at the seed state, nothing listening, no key files, no commits.

### Round 2 — lead V rows and verdict (team lead)
Recount by script (row IDs within round 2 only): 109 PASS, 0 FAIL, 0 BLOCKED, 4 LEAD of 113. Every round-1 result was taken on the identical build: `git diff 399c8cf HEAD -- apps supabase e2e` is empty, so nothing is carried across builds.
V rows, judged from `run-1/shots/` (Playwright screenshots, not the AJClassesBrowser profile):
- **V-1 PASS:** Marks and pass-mark fields with and without the error are clear in both themes at 375 and 1280. The Scoring card ("Total 5 marks", "Pass mark: 60%") is calm, shown once.
- **V-2 PASS, with an observation:** the Results page shows rows, empty state, Closed and pass-mark meta, and "showing 1000 of N" (BA-7) correctly. At 375 the table scrolls sideways inside its container (page overflow 0), and long names can break mid-word ("Local Paren t"). The existing admin mock-test list has the same narrow-table look at 375 and was accepted at the last gate, so this is recorded as one follow-up ("admin tables at phone width") for Saurabh, not a defect of this feature.
- **V-3 PASS:** the taker's result "3 of 5 marks (60%)" has a neutral Pass chip and per-question "3 of 3 marks" / "0 of 2 marks"; list cards show "1 of 1 mark (100%)" singular. No grade colours.
- **V-4 PASS:** start-page totals and the question-page marks line are secondary text, not mistaken for a score.

**Pass rate: 113/113 = 100%.** Full check green (vitest 1255, pgTAP 2184, smoke 18, CSP 23, lint, typecheck, build; format:check lists only the accepted untracked files). Bugs: BUG-1 was the lead's stray files (removed); BUG-2 to BUG-5 were ruled plan errors (06-test-plan §12). No app bugs.

## Verdict
APPROVED (auto)

## Not covered
- V rows were judged from screenshots, not in the AJClassesBrowser Chrome profile.
- Hosted staging sits behind Vercel SSO: Saurabh checks there.
- `.git/info/exclude` (run evidence) is local to this clone.
- Admin tables at phone width (follow-up, above).
