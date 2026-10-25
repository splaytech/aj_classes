APPROVED

# Review 5: item 6 diff (CI quality gates)

**Scope:** `develop...HEAD` on `feature/ci-quality-gates` (10 commits, 81caa8c..3a07a95, 51 files). Checked against 01b item 6 (AC-6.1 to 6.14), ADR-0006, 03b §6 (including §6.11), 04b §4 (T6.0 to T6.14, the Q28 path B note) and 05-dev-notes-item-6 (D1 to D13, O1 to O5).

**Ran (read-only):** `pnpm format:check`, `lint`, `typecheck` clean. `pnpm test`: 56 files, 493 tests passing (matches the dev notes). `pnpm --filter aj-classes-e2e typecheck` clean. Moved files compared with `~/dev/work/aj_classes-e2e@488dde1` after prettier: byte-identical except the three files 03b and D10/D11 say change (`setup/global-setup.ts`, `src/config.ts`, `src/fixtures/test-fixtures.ts`) and `tsconfig.json`'s include list.

**Verdict:** matches 03b §6; all T6.11 checks hold; nothing blocks the merge. Path B leaves AC-6.1, 6.4 and 6.5 to be proven on GitHub after the `develop` merge; the TSR must carry them under "Not covered".

## T6.11 checks

1. **Thresholds (AC-6.7).** 0.9 / 0.9 / 0.9 / 1, median, only in `apps/web/lighthouserc.json:19-22`. No other `minScore`; no commented-out JS size assertion.
2. **Dev dependencies (AC-6.13).** Five, dev-only, exact pins; lockfile `specifier` = `version`; one-line reasons in dev notes §5. `supabase-js`, `typescript`, `@types/node` reuse `apps/web`'s ranges. No production dependency added.
3. **No deliberate-failure commit.** Only the 10 named commits; `git grep deliberately` finds nothing in `e2e/` or `.github/`.
4. **Permissions.** `permissions: contents: read` unchanged (`ci.yml:18-19`); no job widens it.
5. **No hosted ref or real key** across `git log -p develop..HEAD` (lockfile excluded): 0 hits. `e2e/.env.example` keeps placeholders; `e2e/.env` gitignored.
6. **D4 fix (3e57c91) is sound and tested.** `reportFor` merges `network-requests` and CSP-blocked `inspector-issues` URLs, de-duplicated; two new tests; the proof run failed as intended (18 runs, 18 `supabase.co`). LHCI 0.15.1 still uploads after a failed assertion.
7. **The e2e move (ADR-0006 decision 1).** Private workspace package; specs unchanged; dual-surface rule kept; every smoke spec runs under `hostedSupabaseGuard`; the CSP path imports nothing from `src/config|db|mail|auth`.
8. **ci.yml jobs.** `--frozen-lockfile` + pnpm cache; timeouts 15 / 10 / 10 min; hosted-ref check before the stack starts and before each gate build is used; `e2e-report` and `csp-report` on `if: failure()`, `lighthouse-report` on `if: always()`, `retention-days: 7`; Supabase CLI pinned `2.120.0`; Playwright install before LHCI (D5).
9. **Code quality.** Small functions, why-comments, no `console.log`/`TODO`/`: any`/dead code in the 28 changed `.ts`/`.mjs` files; LHR narrowed with type guards; lint clean.

## Deviations

- **D1 to D13 acceptable:** needed for the gate (D1, D2, D5, D6, D10, D12, D13), strengthening (D4, D7, D8, the D10 `PG_HOST` guard), or allowed cosmetic choices (D3, D9, D11). D3's `VITE_LEAD_CAPTURE=on` in `e2e/.env.example` still meets AC-6.3's intent.
- **Q30 deviation acceptable:** required checks on `main` only avoid blocking `/test-and-ship`'s merge pushes to `develop`. Put to Saurabh as a choice at hand-back.

## Blocking

None.

## Non-blocking

1. **A Lighthouse score miss hides the other two results** (`.github/workflows/ci.yml:139`, `:141`). Add `if: ${{ !cancelled() }}` to the "No Supabase requests; JS size per page" step and the CSP sweep.
2. **`act` instructions disagree with D13** (`docs/testing/ci-gates.md:148-161`): `pnpm db:stop` keeps the volume (false green). Say "Before:" `supabase stop --no-backup`, "After:" `supabase stop --no-backup` and `pnpm db:start`; keep the local-data warning.
3. **Programme and guide checks can turn off silently** (`apps/web/scripts/check-structured-data.ts:26,32-35`). Fail unless at least one `programme` and one `guide` page are found alongside home; add a unit test.
4. **e2e outside the local full check** (root `package.json` `lint`/`typecheck` only `--filter web`). Add `pnpm --filter aj-classes-e2e typecheck` to root `typecheck`; move the E2E job's typecheck step (`ci.yml:89`) above `supabase start`. ESLint for `e2e/` as a follow-up.
5. **Report CLI fails open** (`apps/web/scripts/lighthouse-report.ts:133`) if `import.meta.main` is undefined (engines allows `>=22.18`). Split into `check-lighthouse-report.ts` like `structured-data`, or bump engines to 24.
6. **Grammar** (`apps/web/scripts/structured-data.ts:85`): "has a AggregateRating node" → `has a node of type ${forbiddenType}`; update `structured-data.test.ts`.
7. **ADR-0006 drift** (`docs/decisions/0006-ci-gates-e2e-in-repo.md:20`, `:34`): `-o env` vs `-o json`; D4 also reads `inspector-issues`. Add a dated amendment line.
8. **CI env precedence undocumented** (`e2e/.env.example:17-20`, `ci.yml:62-67`). One-line comment that CI's job env wins (unconfirmed on a run).
9. **No PR description for AC-6.13 under path B.** Paste the five-dependency table into the `develop` merge commit body at `/test-and-ship`.
10. **Follow-up outside item 6: O1.** Flaky `ProfileForm.test.tsx` (AC-4.4) can turn `web` red. Log in `bugs/`, fix on its own branch before required checks are turned on.

## Still to prove after the `develop` merge (path B)

- The five check names on GitHub; three real durations (AC-6.4); 7-day retention (AC-6.5, may stay "Not covered"); `--no-sandbox` on x86-64; `::add-mask::` on a hosted runner; the `setup-cli` 2.120.0 download. If Lighthouse nears its 10-minute limit (O5), go to the PO; don't lower anything.
