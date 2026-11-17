# Mock test closing and categories: rulings

- **S-1 (Saurabh, 18 Nov 2026), AC 5:** "Yes if someone has submitted they should be able to see, but if someone has not submitted they should not be able to see." After a test closes, a taker who submitted keeps the test in their list, marked closed, with their result. Everyone else can't see it.
- **S-2 (Saurabh, 18 Nov 2026), verbatim:** "now do yourself using your recommendations and release as well everything with DB and till staging, I will verify once in staging and then deploy to prod". So:
  1. The decisions in `01-requirement.md` take their working answers: the existing `SUBJECTS` list without Interview preparation (C1, the team's recommendation); general subjects only, not VCE subject names; the stream labels as proposed; and the tags can be corrected on released tests.
  2. After the gate passes, the team lead merges to `develop`, pushes (which builds staging) and applies the new migrations to the hosted database. That database is shared with production, and Saurabh authorised it in the same message.
  3. The merge to `main` and the production deploy are Saurabh's.
- **L-1 (Part A hand-back):** Close now on a test that is already closed does nothing and keeps the first closing time. Accepted.
- **L-2:** after closing, `mock_submit` returns `not_found` even for someone who already submitted, and their result still opens through `mock_test_open`. Accepted: a repeat submit is not a user action in the UI.
