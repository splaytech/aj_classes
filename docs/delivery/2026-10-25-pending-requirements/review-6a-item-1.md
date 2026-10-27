APPROVED

# Review 6a: item 1 test plan (`06-test-plan-item-1.md`)

> Round 1 verdict was CHANGES_REQUESTED (findings 1-2 blocking). Round 2 below closes them;
> the current verdict is the first line.

> **Stage:** Reviewer gate after 6a (Tester) · **Date:** 25 Oct 2026
> **Against:** 01-requirement.md AC-1.1 to AC-1.15, 03-design.md item 1 (§1.6),
> 05-dev-notes-item-1.md §7–§8, the code at HEAD (`0e03c5c`).

## What's good

- **Tracing.** Every AC from 1.1 to 1.15 is covered (§3 line 202). The count is right: 59 IDs
  (N-01..27, N-30..37, N-40..63), and the area table adds up to 59.
- **Measurability.** Expected results are numbers or exact strings. The cases that need taste
  (N-20, N-33, N-56, N-62) are clearly marked as Saurabh's call, not pass/fail.
- **Local only.** Builds always run after the local exports. N-01 and N-02 prove there's no
  hosted ref in the built JS. N-41 uses `$VITE_SUPABASE_URL`.
- **Fixtures.** Applied right before the case that needs them and restored right after.
- **N-60.** Its "byte-equal CSP" expectation can pass on the mirror. I checked that the
  `serve.railway.json` and `vercel.json` CSP values are identical.
- **Review-5 finding 1.** Covered by the key-empty build K (N-26).

## Round 1 findings

1. [blocking] `06-test-plan-item-1.md:134-138` (N-45, N-46, N-49) and §4 (lines 208-233) describe
   the admin page before the AC-1.14 fix. The fix (`686bfe5`) landed before this plan was
   committed, and the plan was never updated.
   - **What breaks:**
     - N-45 says today's page-level alert "fails" the case.
     - N-46 expects "an inline message" for an over-long value. That can't happen: `maxLength`
       still stops typing at 120 / 5000, so the over-long branch of `validatePost` can't be
       reached from the UI. The real signal is the counter.
     - N-49 says to raise a Low bug if a spaces-only title is saved. It's now refused inline.
     - A Tester running the frozen list would either fail N-46 against correct code, or have to
       guess what pass means.
   - **Fix:** keep the IDs and rewrite the expected results.
     - N-45: inline `POSTS_PAGE.titleLength` / `bodyLength` under the empty field(s), the field
       has `aria-invalid="true"`, no page-level alert, and the row count is unchanged. Do this for
       all three sub-steps.
     - N-46: field length stops at 120 / 5000; the body counter reads `5000 / 5000 characters`
       after the paste; the saved row is 120 / 5000.
     - N-49: spaces-only title, and also a spaces-only body, are refused inline and nothing is
       inserted. Add a step that `"  x  "` is stored as `x` (`q "select title …"`).
     - Replace §4 with a one-line note that the ruling was resolved by `686bfe5` (05 §7).
2. [blocking] N-51 (`:140`) runs the whole E2E suite, which writes to the database with the
   **service-role key** and a direct Postgres connection. Nothing in the plan checks where that
   suite points. The plan's claim that "N-01 and N-02 enforce this before anything else runs"
   (line 16) only covers the web build.
   - **What breaks:** the E2E repo reads its own `.env` and has no guard against the hosted
     project (`aj_classes-e2e/src/config.ts`). If that `.env` is wrong, N-51, N-53 and N-61
     write to and delete from the one database that holds real families.
   - **Fix:** add a step to N-01:
     `grep -E '^(SUPABASE_REST_URL|PG_HOST|PG_PORT|WEB_BASE_URL|MAILPIT_URL)=' ~/dev/work/aj_classes-e2e/.env`.
     Expected: REST is `http://127.0.0.1:55321`, PG is `127.0.0.1` / `localhost` on `55322`, web
     is `localhost:5173`, and there's no `supabase.co` anywhere in that file. If not, stop.
3. [minor] There are no cases for the follow-up code, so these could regress without the run
   noticing. Add them at the end as N-64 onwards, without renumbering:
   - N-64: on **P** `/posts`, the list request URL is
     `select=id,created_at,title,body&order=created_at.desc&limit=200` and has no `author_id`
     (Security finding 1).
   - N-65: `build/client/privacy/index.html` contains "Supabase keeps these in short-lived
     technical logs" and doesn't contain "We don't store it" (Security finding 6).
   - N-66: on **D**, edit an existing post so its title is only spaces: refused inline, no update
     sent, the row is unchanged.
4. [minor] Line 11-13: "must include the 3 review-5 fixes (`1143859`, `a8eb395`, `54b3058`)" is
   out of date. The build under test also needs `de58c40` and the follow-ups `5abe49c`,
   `686bfe5`, `68460ec`, `6a03de1`. Name them, or just require HEAD ≥ `0e03c5c`.
5. [minor] N-03 (`:97`): the counts "≥ 41 files / ≥ 304 tests" are behind HEAD, which has 44 files
   and 326 tests. "≥" still passes, but use the real numbers so a dropped test file shows up.

The fix for findings 1 and 2 is text in the plan only. No code changes.

---

## Round 2

> **Date:** 25 Oct 2026 · **Plan:** 62 cases (N-01..27, N-30..37, N-40..66), uncommitted working copy
> **Verdict: APPROVED.** Both blocking findings are closed. The two minor notes below can be fixed
> at freeze or left as they are.

### Round 1 findings re-checked

| # | Status | Evidence |
|---|---|---|
| 1 | **Closed** | N-45 (`:138`) now expects the inline messages with their exact text (they match `POSTS_PAGE.titleLength` / `bodyLength`), `aria-invalid`, no page-level alert, and the row count unchanged, for all three sub-steps. N-46 (`:139`) expects the field to stop at `maxLength`, the counter to read `5000 / 5000 characters`, and the row to be 120 / 5000. It also says plainly that no length message is expected. N-49 (`:142`) is now spaces-only refused plus outer spaces trimmed, with a bracketed `q` to prove the trim, and the API-only gap is noted as a known limit. §4 is reduced to "resolved" |
| 2 | **Closed** | N-01 (`:99`) greps the E2E `.env` and says to stop the whole run if a check fails. The intro (`:16-18`) says why. Details below |
| 3 | **Closed** | N-64, N-65, N-66 were added at the end, with no renumbering. Checked below |
| 4 | **Closed** | `:11-14`: HEAD must be `0e03c5c` or a descendant, checked with `git merge-base --is-ancestor`, and every commit is named |
| 5 | **Closed** | N-03 now expects ≥ 44 files / ≥ 326 tests, and says that fewer is a fail. That matches my run at HEAD |

### The N-01 E2E guard: correct and runnable

- **Variable names match the E2E repo.** All five grep keys are in `requiredKeys` in
  `~/dev/work/aj_classes-e2e/src/config.ts`: `WEB_BASE_URL`, `PG_HOST`, `PG_PORT`,
  `SUPABASE_REST_URL` and `MAILPIT_URL`. `SUPABASE_REST_URL` and the `PG_*` keys are the ones that
  matter, because they carry the service-role and direct Postgres writes.
- **I ran it against today's `.env`.** All five lines print and match the expected values
  exactly: `http://localhost:5173`, `127.0.0.1`, `55322`, `http://127.0.0.1:55321` and
  `http://127.0.0.1:55324`. `supabase.co` occurs 0 times. I printed only these URL and host
  values, no keys.
- **If the `.env` is missing,** grep prints an error and no lines, which fails step 2, so the run
  stops. That's the right behaviour.

### New cases

- **N-64.** Correct.
  - The expected query string is exactly what `fetchPublicPosts` builds, and
    `public-posts.client.test.ts` pins the same string.
  - It runs on **P**, the production build against the local stack. `fetch` doesn't
    percent-encode the commas, so the recorded URL will match.
- **N-65.** Correct and runnable. I rebuilt with Supabase off; the build made no network calls.
  - `grep -c 'Supabase keeps these in short-lived technical logs'` gives **1**.
  - `grep -cE "We don(&#x27;|')t store it"` gives **0**.
  - Allowing for `&#x27;` is right: React's pre-render escapes the apostrophe. I saw
    `We don&#x27;t save them` in the output.
- **N-66.** Correct.
  - `saveEdit()` returns before `updatePost`. That function uses supabase-js `.update()`, which is
    a PATCH, so "0 PATCH requests" plus an unchanged `updated_at` is the right proof.
  - `POSTS_PAGE.cancel` exists, so the Cancel step works.

### Minor notes (optional, not blocking)

6. [minor] N-45 (`:138`) says "the filled field has neither" (`aria-invalid` nor
   `aria-describedby`). `PortalField` always renders `aria-invalid={Boolean(error)}`, so a filled
   field has `aria-invalid="false"`, not a missing attribute
   (`components/portal/PortalField.tsx:23`).
   - The risk: a Tester who checks "has no `aria-invalid` attribute" would fail correct code.
   - Fix: reword to "`aria-invalid` is not `"true"` and `aria-describedby` is absent". The
     describedby half is accurate: the counter isn't linked and no hint is passed.
7. [minor] N-01 step 2 checks the E2E `.env` file only. The E2E repo loads it with
   `import 'dotenv/config'`, and dotenv never overrides variables already set in the shell.
   - The risk: a stray `export SUPABASE_REST_URL=…` in the Tester's terminal would win over a
     correct file.
   - Fix: add step 4,
     `env | grep -E '^(SUPABASE_REST_URL|PG_HOST|PG_PORT|WEB_BASE_URL|MAILPIT_URL)='`.
     Expected: no output. The plan's own exports are `VITE_*`, `SCR` and `EVD`, so they don't
     collide.

A note on the `\|` in the table cells: it's Markdown table escaping, used the same way throughout
the plan. The Tester types `|`.
