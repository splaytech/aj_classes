CHANGES_REQUESTED

# Review 3 — items 4–8 design (03b), round 1

**Scope.** Reviewed `26f6354` (03b only). Checked it against:
- 01b, 02b, ADRs 0005–0008, review-1b and review-2b;
- the migrations, the pgTAP tests, `vercel.json`, `serve.railway.json` and `ci.yml`;
- the eslint and vitest configs, and `apps/web/src`;
- item 2's migration and the `aj_classes-e2e` repo.

The DST and Melbourne-date SQL was run, rolled back, on the local DB.

**Verified correct:**
- **Item 4:** the RLS, column grant, definer trigger and audit columns.
- **Item 7:** the cited bodies, the drop-and-recreate plus re-grant, held return passing `check_assignment_result`, and rule (b) consistency.
- **Item 8:** the `supported_kinds` default, "at most once" (within the 90-day retention), the sweep before the early return, the cron guard, and every DST value.
- **Item 5:** the lookahead rule and last-wins header (one portal CSP).
- **Rest of the design:** §9 is complete, the §11 deviations are sound, and §14 is reasonable. The repo rules are followed.

## Blocking

1. **The CSP sweep can't load in the Lighthouse job** (§6.4, §6.5, §6.1 row 5). `test-fixtures.ts` imports the db clients, and those import `src/config.ts`. `loadConfig()` throws at import when the env is missing.
   - **Fix:** put `hostedSupabaseGuard` in its own `e2e/src/fixtures/hosted-guard.ts`, which imports only `@playwright/test`.
   - Have `test-fixtures.ts` extend it, and have `public-csp.spec.ts` import only it and `src/mocks/*`.
   - Neither `playwright.csp.config.ts` nor anything it loads may import `src/config.ts`.
2. **The AC-8.6 test contradicts the SQL and the AC** (§8.10). Work published `today - 1` IS queued, because §8.2 step 6 uses `< today`; work published `today` is not.
   - **Fix:** use those as the boundary cases, and reword the SQL comment.
3. **Item 8 breaks item 7's `fair_results.test.sql`.** It drops `private.work_returned_recipients`, and the new `new_assignment` rows inflate the outbox counts.
   - **Fix:** add the file to §8.1 (Changed) and to §15, using `private.email_recipients('work_returned', …)`.
   - Better: filter item 7's outbox assertions by `kind = 'work_returned'` from the start.

## Non-blocking

4. **The unlink test cites the wrong code** (§7.6/§7.7, AC-7.13). `parent_child_assignments` still raises P0002 through `require_my_child` (ITEM3-FU-1); only the singular one raises 42501. Name the RPC and the code for each call.
5. **AC-7.7 has no test row.** Give it one of its own.
6. **The automated CSP sweep never runs the Kit/Web3Forms code** (§6.5, §6.8). Set `VITE_FORM_ACCESS_KEY: local-placeholder` and `VITE_KIT_FORM_ID: '0000000'` in the Lighthouse build env.
7. **The AC-8.14 order test isn't fully determined.** Give it explicit `created_at` values, and add a third case showing `new_assignment` comes third.
8. **The AC-8.7 expiry test covers only one kind.** Add a pending `new_assignment` row past its `send_before`, which should be swept to `too_late`.
9. **The DST October pair has no false cases.** Add `2026-10-03 04:10Z` and `2026-10-05 05:10Z`, both expected false.
10. **e2e types:** `e2e/` must also declare `@types/node`, aligned with `apps/web`.
11. **Text fixes:**
    - §4.5: `JOIN_PAGE` is at line 213.
    - §8.2 step 9: the `kick_email_worker` body ends at line 336.
    - §14's closing line is stale: it should say "already in AC-8.4".

**Next steps:** fix 1–3 (4–11 optional, same pass), then re-check §6.4/§6.5 and §8.10.

---

APPROVED

# Review 3 — items 4–8 design (03b), round 2

Reviewed `52902e5` (+83/−29) against the 11 findings from round 1.

All 11 are resolved:
- **Finding 1, `config.ts`:** the CSP sweep no longer imports it. `hosted-guard.ts` imports only `@playwright/test`, and an import rule covers the whole chain.
- **Finding 2, the AC-8.6 boundary:** it matches `< today`.
- **Finding 3, `fair_results`:** its assertions filter by `kind`, and the file is listed in §8.1 row 3a, §8.10 and §15.
- **Findings 4–11:** done as asked. The October DST false cases were re-run on the local DB.

## New (non-blocking)

1. **Fixtures in the AC-8.7/8.14 rows can be wrongly skipped.** The claim's skip step runs first, so a hand-made `due_tomorrow` row whose assignment has `due_on <> melbourne_date(send_before)` is marked skipped. Add a note to the set-up: such rows use an online assignment that isn't handed in, with a matching `due_on`, and every recipient is still eligible. The team lead applied this note in §8.10.

The design is ready for the Manager.
