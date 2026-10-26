# 04b — Build plan for items 4–8

> **Stage:** 4 of /deliver (Manager) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy` (worktree `aj_classes-items-4-9`, cut from `develop` at `fb738ea`; docs up to `182e44a`)
> **Input:** [01b](01b-requirement-items-4-9.md), [02b](02b-architecture-items-4-8.md), ADRs
> [0005](../../decisions/0005-public-csp-static-headers.md)–[0008](../../decisions/0008-scheduled-and-multi-kind-email.md),
> [03b](03b-design-items-4-8.md) (approved), [review-1b](review-1b-items-4-9.md),
> [review-2b](review-2b-items-4-8.md), [review-3b](review-3b-items-4-8.md) (all APPROVED);
> [04-plan](04-plan.md) for style, Q1–Q20 and the §2 ship rules.
> **Next stage:** Developer builds item 4 on this branch, ticking this file as each task is tested.

How to use this file (same as 04-plan):

- Tick a task (`- [x]`) only after its test passes. The app must still work at the end of every task.
- Make one or more conventional commits per task. Commit locally; only `/test-and-ship` pushes. Item 6 has the one exception: if Q28 = yes, T6.6 pushes the feature branch and the T6.7 proof runs go to its draft PR. If Q28 = no, nothing is pushed, and T6.6–T6.7 run locally with `act` instead (path B). Neither path ever commits a deliberate failure to `develop`.
- "03b #n" means row n of that item's "Files to touch" table in 03b.
- Stage 5–6 artifacts use the item suffix: `05-dev-notes-item-<n>.md`, `review-5-item-<n>.md`,
  `06-test-plan-item-<n>.md`, `06-security-item-<n>.md`, `TSR-item-<n>.md`, `bugs/item-<n>/BUG-<k>.md`.
- Item 9 is dropped. Its only work is the docs line AC-5.9, which ships in item 5 (T5.5).

---

## 0. Before any build: the local stack (read once)

**Finding (checked 26 Oct 2026).** All checkouts share one local Supabase stack, because
`project_id = "aj_classes"`. That stack was last started and reset from the **held item 2
checkout** (`/Users/sjain/dev/work/aj_classes`):

- The newest applied migration is item 2's `20261025134709`.
- The edge runtime mounts `/Users/sjain/dev/work/aj_classes/supabase/functions`.

So if you build here without a restart:

- `pnpm db:types` would write item 2's schema into this branch;
- `pnpm test:functions` would test the item 2 checkout's function code, not this branch's. That matters for item 8.

**Every checkout that shares the stack** (from `git worktree list`, 26 Oct 2026):

| Checkout | Branch | State |
|---|---|---|
| `/Users/sjain/dev/work/aj_classes` | `feature/homework-file-uploads` | Held item 2. The stack was last started and reset here |
| `/Users/sjain/dev/work/aj_classes-items-4-9` | `feature/staff-phone-privacy`, then items 5–8 | This plan |
| `/Users/sjain/dev/work/aj_classes/.claude/worktrees/magical-liskov-6b3b72` | `chore/dependabot-fixes` | Stale: last commit 3 days ago, uncommitted package changes, nothing running |

T4.0 fixes this. `[ASSUMPTION]` Restarting and resetting the shared **local** stack from this
worktree is fine.

- It wipes local data only: the local database rows, item 2's local Storage objects and every
  Mailpit message.
- Item 2's checkout gets its schema back with its own `pnpm db:reset` at T2.15. Its test uploads
  are lost, but T2.15 re-runs every case from scratch anyway.
- The restart and reset change only the Docker stack. No file in any of the three checkouts is
  touched, `magical-liskov-6b3b72` and its uncommitted changes included.

**Stack checks, repeated in every `T*.0` task** (run from this worktree):

- **Check 1, functions mount:**
  `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep -c aj_classes-items-4-9`
  must print `1`. If it doesn't, run `pnpm db:stop && pnpm db:start` from this worktree.
- **Check 2, newest migration:**
  `docker exec supabase_db_aj_classes psql -U postgres -Atc "select max(version) from supabase_migrations.schema_migrations"`
  must print the newest file on the branch (`ls supabase/migrations | tail -1`). Before item 4's
  migration exists, that's `20261025110100`.

**Every build terminal** (03b §0.3; never build browser-test copies against the hosted project):

```bash
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from pnpm db:status>
export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA   # Cloudflare's public always-pass test key
```

**The full check**, the same for every item. All of it was run once on this branch at `182e44a`:

- Results: format, lint, typecheck all clean; 398 unit tests; the build; 0 hosted refs; pgTAP 13 files and 454 tests; all function checks; E2E 9/9.
- The commands, in order:

1. Web check:
   `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build`
2. No hosted refs in the build. Items 4 and 5 (before T5.1):
   `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client | wc -l` must print `0`. From T5.1 on:
   `pnpm --filter web check:hosted-ref build/client` must print `0 files`.
3. Database and functions: `pnpm db:test && pnpm test:functions`.
4. E2E:
   - **Items 4 and 5** use the external repo, pointed at this worktree. Run it in a subshell, so the
     placeholder form key never reaches a build:
     ```bash
     (cd ~/dev/work/aj_classes-e2e && AJ_CLASSES_DIR=/Users/sjain/dev/work/aj_classes-items-4-9 \
       VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder npx playwright test)
     ```
     Expect `9 passed`. Without `VITE_FORM_ACCESS_KEY`, "Register Interest" fails, because this
     worktree has no `.env.local`. Global setup leaves its dev server running, so stop it
     afterwards: `lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill`.
   - **Items 6, 7 and 8 (from T6.2 on)** use the in-repo suite:
     `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke`,
     then, after the no-Supabase build (03b §0.3), `pnpm --filter aj-classes-e2e test:csp`.
     These commands don't exist until item 6 adds them.

Single unit test file: `pnpm --filter web exec vitest run <path>`. This was checked on
`src/routes/privacy.test.tsx`. Vitest's default include also picks up `apps/web/scripts/*.test.ts`.

Prettier: `prettier --check .` is clean on this branch, so running `pnpm format` across the repo
won't pull in unrelated reformatting.

---

## 1. Ship order and branches

| Order | Item | Branch | Cut from | Migration | Gate | Ends |
|---|---|---|---|---|---|---|
| 1st | 4 Staff phone + Privacy | `feature/staff-phone-privacy` (this one, already holds the 01b–04b docs) | `develop` @ `fb738ea` | `20261026100000_staff_phone_edit.sql` | full `/test-and-ship` | merged to `develop`, pushed |
| 2nd | 5 Public CSP (+ item 9 docs) | `feature/public-csp` | `develop` after item 4's merge | none | full `/test-and-ship` | merged, pushed |
| 3rd | 6 CI quality gates | `feature/ci-quality-gates` | `develop` after item 5's merge | none | full `/test-and-ship`, plus CI on a draft PR (path A, Q28 = yes) or `act` locally (path B) | merged, pushed |
| 4th | 7 Fair results | `feature/fair-results` | `develop` after item 6's merge | `20261027100000_fair_results.sql` | full `/test-and-ship` | merged, pushed |
| 5th | 8 More email alerts | `feature/more-email-alerts` | `develop` after item 7's merge | `20261028100000_more_email_alerts.sql` | full `/test-and-ship` | merged, pushed |
| held | 2 Homework uploads | `feature/homework-file-uploads` (in `/Users/sjain/dev/work/aj_classes`) | — | renamed at T2.15 | T2.15 (§7) | only after B3 (Q3) |

Rules (they add to 04-plan §2; they don't replace it):

1. **One item at a time, in this worktree.** Each new branch is cut here with
   `git checkout develop && git pull --ff-only && git checkout -b feature/<slug>`. It's cut only
   after the previous item's `/test-and-ship` has merged and pushed. `develop` isn't checked out
   in any other worktree (checked with `git worktree list`).
2. **Migration order 4 < 7 < 8, all later than everything on `develop`.** The file names come from
   03b §0.1. If a branch is cut on a later day than its file name, the Developer may use a fresh
   `supabase migration new <name>` stamp, as long as the order holds. Check with
   `ls supabase/migrations | tail -2`: the item's file must be last.
3. **Item 2 stays held** (04-plan §2 rules 1–2). Nothing in items 4–8 depends on it. Never run
   `deploy.sh` from its checkout.
4. **Releases chain** (04-plan §2 rule 5).
   - `main` is 85 commits behind `develop` (checked 26 Oct 2026). Items 1 and 3 are merged but not released.
   - A `release/<item>` branch cut at a later item's SHA ships every earlier merged item too, with
     their migrations, functions and secrets.
   - So each item's release below has a **precondition**: every earlier merged item has been
     released, or is released in the same run with all of its own steps. Q29 asks how to batch them.
5. **Item 6 has no release of its own.** Its workflow and `e2e/` reach `main` inside the next
   release branch (item 7's, or whichever comes first).

---

## 2. Item 4 — Staff phone on My profile, plus Privacy (branch `feature/staff-phone-privacy`)

Design: 03b §4 (16 files). One migration, no function deploy, no new dependency. AC-4.1–4.10.

- [x] **T4.0 Stack from this worktree.**
  - **Run:** `pnpm install --frozen-lockfile && pnpm db:stop && pnpm db:start && pnpm db:reset`.
  - **Test:**
    1. `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep -c aj_classes-items-4-9` prints `1`.
    2. `docker exec supabase_db_aj_classes psql -U postgres -Atc "select max(version) from supabase_migrations.schema_migrations"` prints `20261025110100`.
    3. `pnpm db:types && git diff --exit-code apps/web/src/services/database.types.ts` exits 0. That proves the stack now matches `develop`.
  - **Visible:** `pnpm dev` → `tutor@local.test` → My profile loads.
- [x] **T4.1 Phone grant and validating trigger (DB).**
  - **Files:** 03b #1, migration steps 1–2 (`grant update (phone)`, `private.check_profile_phone()` `security definer`, `profiles_check_phone`); #2 `staff_phone.test.sql` (fixtures a1, b1, b2, c1, c2, s1, p1 as in 03b §4.7).
  - **Tests:**
    - AC-4.2: five formats normalise to `+61…`.
    - AC-4.3: five bad values give `invalid_phone`, and b1's phone is unchanged.
    - AC-4.4: `''`, `'   '` and `null` over a saved number give `phone_required`; b2 saves `full_name` with a blank phone.
    - AC-4.7: other people's rows and family rows return 0 rows; a1 setting a family phone gives `invalid_input`; c1, c2 and an aal1 admin return 0 rows; `status`, `terms_accepted_at` and `password_set_at` give `42501`.
    - `onboarding.test.sql` stays green.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [x] **T4.2 `updated_at`, admin audit, grants (DB).**
  - **Files:** #1 steps 3–5 (the `profiles_set_updated_at` column list plus `phone`; the `audit_admin_profile_edit` body copied from `20261006004522` lines 237–263 plus the `phone` line; the trigger column list; the revoke; the column comment); #2 more cases.
  - **Tests:**
    - AC-4.6: as a1 aal2, one `profile_edited_by_admin` row with `fields ? 'phone'` and `details::text !~ '[0-9]'`; a self-edit, by b1 or a1, adds 0 audit rows; `admin_list_staff` shows the new number.
    - b1's `updated_at` goes up.
    - Nobody can execute `check_profile_phone`.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [x] **T4.3 Browser phone rule.**
  - **Files:** #9 `lib/profile-validation.ts` (`validateProfilePhone`, `validateProfile(values, savedPhone)`), #10 its test, #7 `PROFILE_VALIDATION.phoneRequired` (03b §4.5 text).
  - **Tests:** AC-4.2, 4.3 and 4.4 unit cases: the same five formats are accepted, the same bad ones refused, and `('', saved)` gives required while `('', null)` gives `undefined`.
  - **Run:** `pnpm --filter web exec vitest run src/lib/profile-validation.test.ts`.
- [x] **T4.4 Server error keys.**
  - **Files:** #5 `auth-errors.ts` (`phone_required: 'phoneRequired'`), #6 its test (`phone_required` and `invalid_phone`), #7 `PORTAL_ERRORS.phoneRequired`.
  - **Run:** `pnpm --filter web exec vitest run src/services/auth-errors.test.ts`.
- [x] **T4.5 The phone field, end to end.**
  - **Files:** #3 `profile.service.ts` (`PROFILE_COLUMNS`, `ProfileRow`, `updateProfile` sends `phone.trim() || null`, `toStaffProfile`), #4 `types.ts`, #11 `PortalField.tsx` (`type: 'tel'`, `inputMode`), #12 `ProfileForm.tsx` (field after Full name; phone server errors shown on the field), #8 `PROFILE_PAGE.labels.phone` / `.hints.phone`, #13 `ProfileForm.test.tsx` (new).
  - **Tests:**
    - AC-4.1: label, formatted value, empty for null, the hint, `type="tel"` and `inputMode="tel"`.
    - AC-4.3: `fail('invalidPhone')` puts the message on the field, not in an alert.
    - AC-4.5: `fail('phoneRequired')` keeps the bio edit and shows no "Profile saved."; success shows "Profile saved." once and calls `onSaved` once.
  - **Visible:**
    - `tutor@local.test` → My profile: change the phone, save, reload, and the formatted number shows.
    - `admin@local.test` → Admin → Staff → the tutor: change it, and the header link and the list's Phone column update.
  - **Run:** `pnpm --filter web exec vitest run src/components/portal/ProfileForm.test.tsx && pnpm typecheck`.
- [x] **T4.6 Privacy sentence and heading.**
  - **Files:** #14 `PRIVACY` (heading `'Portal accounts'`, the 03b §4.6 sentence, `lastUpdated` set to the build month, the code comment extended; no `[TBC]`, TODO or "draft" literal), #15 `privacy.test.tsx` (lookups renamed, AC-4.9 phrases, no old heading).
  - **Run:** `pnpm --filter web exec vitest run src/routes/privacy.test.tsx`.
- [x] **T4.7 Docs.**
  - **Files:** #16 `docs/requirements/invite-onboarding.md` "Fields".
  - **Run:** `pnpm format:check`.
- [x] **T4.8 Manual passes (scripted).** Record each result in the dev notes.
  1. **AC-4.8:** give the local tutors the seed numbers through My profile; run the local-Supabase gate build; then `grep -rlE` for every form (`+61…`, digits only, formatted) of the numbers actually stored on the local staff profiles finds nothing in `apps/web/build/client`. Don't use `0412 345 678`: it is the existing example in the invalid-phone error text, so it always matches (dev notes item 4, D2). The code grep in 03b §4.7 finds no profile phone in public services, `sitemap.ts` or `seo.ts`.
  2. **AC-4.10:** at 360 px, light and dark, on both pages, the field, hint and error are legible, and the keypad opens in Chrome device mode.
  3. **AC-4.6:** Admin → Activity shows "profile edited" with no number.
- [x] **T4.9 Full check.**
  - **Run:** §0 steps 1–4: the web check, 0 hosted refs, `pnpm db:test && pnpm test:functions`, and E2E from the external repo, 9 passed.
- [x] **T4.10 Dev notes.** `05-dev-notes-item-4.md`: what was built, deviations from 03b, the T4.8 measurements, and the full-check output.
- [x] **T4.11 Reviewer pass.**
  - **What:** Reviewer on `develop...HEAD` writes `review-5-item-4.md`.
  - **Gate:** loop to the Developer until it's APPROVED.
- [x] **T4.12 Test plan.** Tester writes `06-test-plan-item-4.md`. It covers every AC-4.x, the regression of onboarding, the admin staff list and the profile avatar, and E-01 (env local only).
- [x] **T4.13 Security review.** Security writes `06-security-item-4.md`. It covers:
  - the column grant and its scope;
  - `security definer` with `search_path = ''`;
  - no phone in `audit_log` or public bundles;
  - families can't hold a phone.
- [x] **T4.14 `/test-and-ship`.**
  - **Run:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-4.md`. It writes `TSR-item-4.md`, merges to `develop` and pushes.
  - **Close-out:** the message names the release SHA, from `git log --merges -1 --format=%H develop`.

**15 tasks.**

**Risks (item 4)**

| # | Risk | Mitigation |
|---|---|---|
| 1 | The build runs against the item 2 schema or functions on the shared local stack | T4.0's restart, plus its three checks |
| 2 | The audit body is copied from a stale source, and an admin edit loses a field | 03b names the lines (237–263, never redefined); the T4.2 pgTAP checks `fields` |
| 3 | A server phone error throws away the other edits | One PATCH statement; AC-4.5 unit test; form state untouched on error |
| 4 | Phone numbers leak into a public bundle or JSON-LD | T4.8 grep on the gate build; the Security review |
| 5 | Privacy text conflicts with held item 2 (same section, old heading in its tests) | Noted in T2.15 step 6: `'Portal accounts'`, keep both sentences |
| 6 | `lastUpdated` month is wrong if the release slips | Release step 2 checks it on the release branch |

---

## 3. Item 5 — Public CSP, plus item 9 docs (branch `feature/public-csp`)

Design: 03b §5 (16 files), ADR-0005. No migration, no runtime code, no new dependency. AC-5.1–5.11.

- [x] **T5.0 Branch.**
  - **Run:** `git checkout develop && git pull --ff-only && git checkout -b feature/public-csp && pnpm install --frozen-lockfile && pnpm db:reset`.
  - **Test:** §0 stack checks 1 and 2. Check 1 prints `1`; check 2 prints item 4's
    `20261026100000`.
- [x] **T5.1 Hosted-ref tool.**
  - **Files:** 03b #3 `scripts/hosting-constants.ts`, #6 `scripts/hosted-ref.ts`, #7 its test, #8 `scripts/check-hosted-ref.ts`, #10 `"check:hosted-ref"` in `apps/web/package.json`.
  - **Tests:** the temp-dir fixtures (`['a.js', 'sub/c.html']`, empty → `[]`); a path that doesn't exist exits 1.
  - **Visible:** run the local gate build, then `pnpm --filter web check:hosted-ref build/client` → `0 files`. A scratch file holding the ref, given as the path, exits 1.
  - **Run:** `pnpm --filter web exec vitest run scripts/hosted-ref.test.ts`.
- [x] **T5.2 Mirror config (pure).**
  - **Files:** #4 `scripts/mirror-config.ts`, #5 its test.
  - **Tests:**
    - `X-Robots-Tag` is dropped on `**/*` and kept on the fallback;
    - every hosted origin is replaced;
    - `public` is absolute;
    - a config without the hosted origin throws `MirrorConfigError`;
    - the input isn't mutated.
  - **Run:** `pnpm --filter web exec vitest run scripts/mirror-config.test.ts`.
- [x] **T5.3 Mirror server.**
  - **Files:** #9 `scripts/serve-mirror.ts`, #10 the `"mirror"` script, #13 root `"mirror"`.
  - **Visible:**
    - `pnpm mirror` serves :4173;
    - `curl -sI localhost:4173/portal/login` shows the **portal** CSP with `http://127.0.0.1:55321`;
    - `--write-only $TMPDIR/m.json` writes the config and exits;
    - on a build containing the ref, it refuses to start.
  - **Run:** `pnpm typecheck && pnpm lint`.
- [x] **T5.4 The public CSP headers.**
  - **Files:**
    - #1 `vercel.json`: the new rule between the global rule and the portal rule;
    - #2 `serve.railway.json`: the CSP as the last header of `**/*`;
    - #11 `src/hosting-csp.test.ts`: checks 1–7;
    - #12 `src/hosting-config.test.ts`: `PORTAL_ONLY_HEADERS`, and only `/portal/:path*` carries the portal CSP.
  - **Tests:** AC-5.1, 5.2, 5.5 and 5.6 (unit parts), and 5.7.
  - **Visible:** the 03b §5.7 AC-5.1 `curl` loop on the mirror prints `1` on every line; `/portal/login` shows exactly 1 CSP.
  - **Run:** `pnpm --filter web exec vitest run src/hosting-csp.test.ts src/hosting-config.test.ts`.
- [x] **T5.5 Docs (AC-5.9, AC-5.10).**
  - **Files:**
    - #14 `arch.md` §3: the paragraph;
    - #15 `release-1/PRP.md`: the three item 9 annotations, each with the 01b link;
    - #16 `03-design.md`: the §1.6 superseded line.
  - **Run:** `pnpm format:check`.
- [x] **T5.6 Manual sweep on the mirror.** Use the 03b §5.7 gate set-up: Web3Forms and Kit placeholders, DevTools request blocking, and at least one local post. Record a table of page × width × result:
  - AC-5.3: 0 CSP violations on every AC-5.1 page at 360 and 1280 px, with the menu, the News link with and without posts, enquiry and subscribe;
  - AC-5.4: JSON-LD, assets, `wa.me`, the staging marker;
  - AC-5.5: admin sign-in with two-step on the mirror, avatars, 0 violations;
  - AC-5.6: global headers;
  - AC-5.7: Railway on :4174;
  - AC-5.8: injected script and `fetch` blocked; inline `onclick` runs on purpose;
  - AC-5.11: HAR `grep -c supabase.co` = 0.
- [x] **T5.7 Full check.** §0 steps 1–4. Step 2 now uses `check:hosted-ref`. E2E is still the external repo.
- [x] **T5.8 Dev notes.** `05-dev-notes-item-5.md`, with the T5.6 table.
- [ ] **T5.9 Reviewer pass.** `review-5-item-5.md`, until it's APPROVED.
- [ ] **T5.10 Test plan.** `06-test-plan-item-5.md`. It covers every AC-5.x, item 1's `/posts` behaviour under the CSP, and the hosted-request checks.
- [ ] **T5.11 Security review.** `06-security-item-5.md`. It covers:
  - `'unsafe-inline'` (an accepted residual);
  - the `connect-src` list;
  - `frame-ancestors`;
  - no overlap on `/portal/*`;
  - the mirror never serving a hosted-ref build.
- [ ] **T5.12 `/test-and-ship`.**
  - **Run:** `/test-and-ship …/06-test-plan-item-5.md`. It writes `TSR-item-5.md`, merges and pushes.
  - **Close-out:** the release SHA, plus a reminder of release step 1 (the preview check).

**13 tasks.**

**Risks (item 5)**

| # | Risk | Mitigation |
|---|---|---|
| 1 | Vercel's negative-lookahead `source` behaves differently from local `serve`, so `/portal/*` gets two CSPs, or public pages get none | `hosting-csp.test.ts` check 6 (the regex); Saurabh's preview check before `main` (Q32); live `curl` count after release; the fallback is to revert (config only) and list public paths explicitly |
| 2 | A public feature silently breaks under the policy (News check, enquiry, Kit) | T5.6 sweep with 0 violations; item 6 automates it in CI (T6.3) |
| 3 | The mirror serves something other than the committed policy | `buildMirrorConfig` throws without the hosted origin; consistency test keeps both files equal |
| 4 | A gate build or sweep reaches the hosted project | `check:hosted-ref` before serving; `serve-mirror` refuses on a hit; HAR count 0 |
| 5 | `vercel.live` toolbar violations on the preview are mistaken for a bug, and its host gets added | Release step 1 says they're expected; never add the host (ADR-0005) |

---

## 4. Item 6 — CI quality gates (branch `feature/ci-quality-gates`)

Design: 03b §6 (36 files), ADR-0006. No runtime change, no migration. It adds five dev
dependencies: `@playwright/test`, `pg`, `@types/pg`, `dotenv` (in `e2e/` only) and `@lhci/cli`
(in `apps/web`). AC-6.1–6.14.

- **AC-6.13 (where the dependency reasons go):** a one-line reason per dependency goes in the
  dev notes (T6.10) and in the `develop` merge-commit body (T6.14). If Q28 = yes, they also go in
  the draft PR description. They're repeated in the description of the `release/*` PR that
  carries item 6 to `main` (§8.3).

**Two paths, decided by Q28.** Both build the same files (T6.0–T6.5, T6.8). They differ only in
where the workflow is proven:

- **Path A (Q28 = yes): GitHub.**
  - The feature branch is pushed with a draft PR to `develop`.
  - The deliberate failures go on a **throwaway** branch, `ci-proof/item-6`, cut from the feature
    branch, with its own draft PR. That PR is closed and the branch deleted afterwards.
  - The failing commits never enter `feature/ci-quality-gates`, so the `--no-ff` merge can't
    bring them into `develop`.
- **Path B (Q28 = no): local, with `act`.**
  - `act` runs the workflow's jobs in the local Docker. The Developer installs it as a dev tool on
    the laptop: `brew install act`. It is **not** a repo dependency, and nothing is added to
    `package.json`.
  - Deliberate failures are made as **uncommitted** edits in the working tree, because `act` runs
    the working tree as it is. They're then undone with `git restore`. Nothing is pushed.
  - The GitHub-side evidence (the check names on GitHub, the run logs, the three durations, the
    7-day artifact retention) is collected on the first `develop` push after the merge. Until
    then, `TSR-item-6.md` lists it under **"Not covered"**.
  - If `act` can't run a job, the fallback for that job is the same: verify it on `develop` after
    the merge, listed under "Not covered". The local by-hand runs of its steps (T6.3–T6.5) stay as
    the pre-merge evidence.
  - `act` isn't installed yet, so none of the `act` commands below have been run.
- **Never on either path:** a deliberate failure committed to `develop` or to the feature branch.

- [x] **T6.0 Branch.**
  - **Run:** `git checkout develop && git pull --ff-only && git checkout -b feature/ci-quality-gates && pnpm db:reset`.
  - **Test:** §0 stack checks 1 and 2. Check 2 prints item 4's `20261026100000` (item 5 adds no
    migration).
- [x] **T6.1 Move the E2E suite in.**
  - **Copy:** `mkdir e2e && git -C ~/dev/work/aj_classes-e2e archive 488dde1 setup src tests playwright.config.ts tsconfig.json .env.example | tar -x -C e2e`.
    - That's 20 tracked files (`tar -t` lists 28 entries, including directories).
    - There's no `.env`, no `node_modules` and no lockfile.
    - `488dde1` is the E2E repo's current HEAD on `feature/playwright-e2e-harness`.
  - **Files:**
    - 03b #1 `pnpm-workspace.yaml`;
    - #2 `e2e/package.json`. Besides the dev dependencies above, it declares `typescript`
      (`^6.0.3`), `@types/node` (`^26.6.3`, replacing the old repo's `^20`) and
      `@supabase/supabase-js`, all at `apps/web`'s ranges (review-3b finding 10), so the
      workspace has one version of each;
    - #3 `tsconfig.json`;
    - #4 `playwright.config.ts` (trace, video, reporter, `outputDir`);
    - #6 `.env.example` (placeholders for every key; `AJ_CLASSES_DIR=..`);
    - #9 `src/config.ts` (default dir = repo root, `assertLocalUrl`);
    - #36 `.gitignore` and `.prettierignore` entries, plus `pnpm-lock.yaml`.
  - **Tests:**
    - `pnpm install && pnpm --filter aj-classes-e2e typecheck && pnpm format:check` (prettier formats the moved specs to this repo's config);
    - `git status --porcelain` shows no `.env`.
- [x] **T6.2 Local env and the hosted guard.**
  - **Files:** #7 `e2e/scripts/local-env.mjs`, #10a `src/fixtures/hosted-guard.ts`, #10 `test-fixtures.ts` (extends the guard).
  - **Tests:**
    - `node e2e/scripts/local-env.mjs` prints the local URL and refuses if `API_URL` isn't `http://127.0.0.1:55321`;
    - with `GITHUB_ACTIONS=true` it writes `::add-mask::` lines on stderr only.
  - **Visible:** `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke` gives the same 9 passing tests as the external run.
- [x] **T6.3 Automated CSP sweep.**
  - **Files:** #11 `src/mocks/public-services.ts`, #5 `playwright.csp.config.ts`, #26 `csp/public-csp.spec.ts`.
  - **Tests:**
    1. The import-rule check finds nothing: `grep -rnE "src/(config|db|mail|auth)|test-fixtures" e2e/csp e2e/playwright.csp.config.ts e2e/src/fixtures/hosted-guard.ts e2e/src/mocks`.
    2. Run the no-Supabase build with `VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000` (03b §6.8 Lighthouse env), then `check:hosted-ref build/client`.
    3. Then `env -u SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY pnpm --filter aj-classes-e2e test:csp` passes: 0 violations on every page at both widths, and the negative test sees one `script-src-elem` entry.
- [x] **T6.4 Lighthouse.**
  - **Files:** #27 `lighthouserc.json`, #28 `scripts/lighthouse-report.ts`, #29 its test, #34 `@lhci/cli` plus the `lighthouse` and `lighthouse:report` scripts.
  - **Tests:** `lighthouse-report.test.ts`: an LHR with a `supabase.co` URL gives one entry, a clean one none, and the median bytes are right.
  - **Visible:** on the no-Supabase build, `pnpm --filter web lighthouse && pnpm --filter web lighthouse:report` passes the assertions and prints the JS KB table. Confirm the `serve` ready text against `startServerReadyPattern`.
- [x] **T6.5 Structured-data check.**
  - **Files:** #30 `scripts/structured-data.ts`, #31 its test, #32 eight fixtures, #33 `scripts/check-structured-data.ts`, #34 the `check:structured-data` script.
  - **Tests:** AC-6.9: the valid fixtures pass and `pageKindFor` maps correctly. AC-6.10: each invalid fixture gives exactly one problem naming the file.
  - **Visible:** on the no-Supabase build, `pnpm --filter web check:structured-data` exits 0.
- [x] **T6.6 Workflow.**
  - **Files:** #35 `ci.yml`: the five jobs, the header comment, and the Supabase CLI pinned at `2.120.0`.
  - **Local test:** `pnpm --filter web check:hosted-ref ../../.github/workflows ../../e2e` → `0 files`.
  - **Path A:** push the branch and open a **draft** PR to `develop`. The run shows the "E2E
    smoke", "Lighthouse" and "Structured data" checks, all green (AC-6.1, 6.2, 6.6).
  - **Path B:**
    1. Install and list: `brew install act && act --version && act -l`. The list shows the five
       jobs.
    2. Then run, with `ART=$TMPDIR/act-artifacts`:
       `act pull_request -j <job> -P ubuntu-latest=catthehacker/ubuntu:act-latest --artifact-server-path "$ART"`
       for `web`, `database`, `e2e`, `lighthouse` and `structured-data`. Each one passes.
    3. **Before the `database` and `e2e` jobs, run `pnpm db:stop`.** Their `supabase start`
       uses the same `aj_classes` container names and ports as the local stack, through the
       host's Docker. Afterwards, run `pnpm db:start` and the §0 stack checks.
    4. A job `act` can't run (for example, Supabase's bind mounts failing inside the `act`
       container) goes to the fallback above. Record the error in the dev notes.
- [x] **T6.7 CI proof runs.** These never touch `develop` or the feature branch's history.
  1. **Broken spec** (AC-6.1, 6.5): a wrong heading in `our-approach.spec.ts` fails only the E2E
     job, and the report and trace are uploaded.
     - **Path A:** a commit on `ci-proof/item-6` with its own draft PR. Check the `e2e-report`
       artifact and its 7-day retention.
     - **Path B:** an uncommitted edit, then `act pull_request -j e2e … --artifact-server-path "$ART"`
       fails, and `$ART` holds `e2e-report` with the HTML report and a trace. Then
       `git restore e2e/tests/our-approach.spec.ts`. The 7-day retention is a GitHub setting, so it
       goes to "Not covered".
  2. **Hosted-URL proof** (AC-6.14): a Lighthouse build with `VITE_SUPABASE_URL=https://example.supabase.co`
     fails the report step.
     - **Path A:** a second commit on `ci-proof/item-6`.
     - **Path B:** an uncommitted edit to the job's build `env` in `ci.yml`, then
       `act pull_request -j lighthouse …` fails at "No Supabase requests". Then
       `git restore .github/workflows/ci.yml`.
     - Either way, `git status --porcelain` is clean afterwards.
  3. **Durations** (AC-6.4): E2E ≤ 15 min, the other two ≤ 10 min, the workflow ≤ 20 min. If E2E
     goes over, add `--grep-invert "Invite onboarding"` (03b §6.8).
     - **Path A:** three green runs on the feature PR, using `gh run rerun`.
     - **Path B:** the `act` timings go in the dev notes as indicative only. The three GitHub runs
       come from the first `develop` push and reruns of it (`gh run rerun <id>`), recorded in the
       TSR. Until then they're under "Not covered".
  4. **JS size decision** (AC-6.8): if every page's median is ≤ 102,400 bytes, add the
     `resource-summary:script:size` assertion. Otherwise put the baseline in the dev notes and the
     gate in Later.
     - **Path A:** the figures come from the PR's step summary.
     - **Path B:** they come from `pnpm --filter web lighthouse:report`, run locally in T6.4.
  5. **Path A clean-up:** close the `ci-proof/item-6` PR, then
     `git push origin --delete ci-proof/item-6 && git branch -D ci-proof/item-6`.
- [x] **T6.8 Docs.**
  - **Files:** `docs/testing/ci-gates.md` (new, every gate's exact commands), the README "Checks" link, `arch.md` §2 (the five jobs).
  - **Test (AC-6.12):** follow `ci-gates.md` from a clean `git worktree add $TMPDIR/ci-check HEAD` and run each gate. Then `git worktree remove $TMPDIR/ci-check`.
  - **Run:** `pnpm format:check`.
- [x] **T6.9 Full check.** §0 steps 1–3, then E2E with the **in-repo** commands (`test:smoke`,
  and `test:csp` after the no-Supabase build). The structured-data check and Lighthouse run too.
  - **Path A:** the latest CI run on the draft PR is green.
  - **Path B:** every `act` job from T6.6 is green, or is under the fallback.
- [x] **T6.10 Dev notes.** `05-dev-notes-item-6.md`. It records:
  - the path taken (A or B);
  - the run URLs (A) or the `act` commands and output (B), and any `act` fallback with its error;
  - the durations;
  - the JS baseline and the size-gate decision;
  - the five dev dependencies, each with its one-line reason (AC-6.13);
  - **one deviation:** Q30 recommends required checks on `main` only, while 03b §6.11 says
    `develop` and `main`. The reason: `/test-and-ship` pushes merge commits straight to
    `develop`, and a required check there would block that push.
- [x] **T6.11 Reviewer pass.** `review-5-item-6.md`, until it's APPROVED. The reviewer checks:
  - the thresholds are 0.9 / 0.9 / 0.9 / 1 and live only in `lighthouserc.json` (AC-6.7);
  - the dependency reasons (AC-6.13): in the dev notes on both paths, and in the draft PR description on path A;
  - no deliberate-failure commit in `git log develop..HEAD`.
- [x] **T6.12 Test plan.** `06-test-plan-item-6.md`: every AC-6.x, plus the local runbook.
- [x] **T6.13 Security review.** `06-security-item-6.md`. It covers:
  - no keys or hosted values in the workflow or in `e2e/`;
  - `::add-mask::` on stderr;
  - local demo values only in the public repo;
  - `filesystem` upload, never `temporary-public-storage`;
  - the `permissions: contents: read` setting is kept.
- [ ] **T6.14 `/test-and-ship`.**
  - **Run:** `/test-and-ship …/06-test-plan-item-6.md`. It writes `TSR-item-6.md`, merges and
    pushes. The `--no-ff` merge commit's body lists the five dev dependencies with their reasons
    (AC-6.13).
  - **Path A:** close the feature draft PR once the merge to `develop` is pushed.
  - **Path B:** straight after the push, collect the GitHub-side evidence from the `develop` run
    (the three named checks, the logs, and three durations using `gh run rerun`). Append it to
    `TSR-item-6.md` and clear those "Not covered" lines. That's a docs-only commit, made on a fresh
    `docs/*` branch. It is merged and pushed to `develop` only through `/test-and-ship`, the one
    command that authorises a `develop` push, run as a short docs-only gate; never pushed
    directly.
  - **If the `develop` CI run goes red** (on either path): fix forward on a fresh
    `fix/ci-quality-gates` branch from `develop`, with its own gate, **before T7.0**. Never revert
    or re-break on `develop` itself.
  - **Close-out:** the SHA. There's no release of its own (§1 rule 5).

**15 tasks.**

**Risks (item 6)**

| # | Risk | Mitigation |
|---|---|---|
| 1 | The CI-only ACs can't be verified before merge, because the branch is local-only | Path A (Q28): a pushed draft PR, with failures on a throwaway `ci-proof/item-6` branch. Path B: `act` locally, with uncommitted failures. The GitHub-only evidence is "Not covered" until the first `develop` run; a red `develop` run is fixed forward before T7.0 |
| 1a | `act`'s `supabase start` clashes with the running local stack (same container names and ports), or can't bind-mount inside the `act` container | `pnpm db:stop` first, then restart and run the §0 stack checks afterwards; a job that can't run takes the fallback, recorded in the dev notes |
| 2 | Flaky E2E from a cold Supabase start, Mailpit timing or a Cloudflare outage | Pinned CLI; existing poll budgets; `retries: 0` so flakes show; 7-day traces; the 3 recorded runs |
| 3 | The CSP spec imports the E2E config and throws in the Lighthouse job | The `hosted-guard.ts` split and the T6.3 grep. The CSP step runs with no E2E env |
| 4 | A gate quietly talks to the hosted project | `check:hosted-ref` on both builds and on the workflow and `e2e/`; the guard fixture in every spec; `lighthouse:report` fails on `supabase.co`; the T6.7 proof run |
| 5 | Lighthouse misses the thresholds on shared runners | Median of 3. Thresholds are never lowered: fix it if small, otherwise write it up for a PO call before merge |
| 6 | Two copies of the specs drift | ADR-0006: `e2e/` is canonical. The external repo is frozen after T6.1, and items 7–8 add specs here |
| 7 | The moved specs pick up a hosted value or a key | `.env.example` placeholders; the `check:hosted-ref` step; Security T6.13 |

---

## 5. Item 7 — Hold results, and returned work outlives enrolment (branch `feature/fair-results`)

Design: 03b §7 (25 files), ADR-0007. One migration, no function deploy, no new dependency.
AC-7.1–7.17. The file half of AC-7.2 and all of AC-7.15 move to T2.15. Every new outbox assertion
filters `kind = 'work_returned'` from the start (review-3b finding 3).

- [x] **T7.0 Branch and migration file.**
  - **Precondition:** the latest `develop` CI run is green:
    `gh run list -R splaytech/aj_classes -b develop -e push -L 1 --json conclusion,headSha -q '.[0].conclusion + " " + .[0].headSha'`
    prints `success <SHA>`, where the SHA is `develop` HEAD's own run. `ci.yml` cancels
    superseded runs, so an older run may show as `cancelled`. If HEAD's run is `cancelled`, run
    `gh run rerun <id>` (no fix-forward). If it's red, finish the T6.14 fix-forward first.
  - **Run:** `git checkout develop && git pull --ff-only && git checkout -b feature/fair-results && pnpm db:reset`.
  - **Test:** §0 stack checks 1 and 2 (check 2: item 4's `20261026100000`). Then create `supabase/migrations/20261027100000_fair_results.sql`, or a fresh `supabase migration new fair_results` stamp per §1 rule 2. `ls supabase/migrations | tail -2` shows it last.
- [x] **T7.1 Hold flag and its guard (DB).**
  - **Files:** 03b #1 steps 1–2 (column, grant, `check_hold_results`, trigger); #2 `fair_results.test.sql` (fixtures from 03b §7.7, starting with `delete from public.email_outbox`).
  - **Tests:**
    - AC-7.1: default false; set on a draft with questions; `assignment_published` after publishing; back to draft unlocks it; b2 gets 0 rows; a1 aal2 succeeds.
    - AC-7.2 (paper half): `hold_needs_questions` on insert and on update.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [x] **T7.2 Read rule and held submit (DB).**
  - **Files:** #1 steps 3–4. `assignment_readable_by`; `student_submit` copied from `20261007090321` lines 463–528 with the `or hold_results` branch. Before copying, check with `grep -n "function public.student_submit" supabase/migrations/*.sql | tail -1` that it's still the current body.
  - **Tests:**
    - AC-7.3: held work stays `submitted` and hides answers and marks;
    - AC-7.4: a staff return is allowed, sets `marked_by`, and queues 3 `work_returned` rows;
    - AC-7.5: unheld MCQ still auto-returns with no outbox rows;
    - AC-7.6: the parent and student views before return.
    - `family_portal.test.sql` D8 stays green.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [x] **T7.3 List builder, wrappers and view (DB).**
  - **Files:** #1 steps 5–6. Drop and recreate `assignments_for_student`, `student_assignments` and `parent_child_assignments` with rule (b) and `is_past_class`, re-granted exactly as `20261007090321` lines 786–830. `assignment_view` gains `isPastClass`.
  - **Tests:**
    - AC-7.8: removal;
    - AC-7.9: archive;
    - AC-7.10: non-returned work is hidden, and so is the timetable;
    - AC-7.11: no writes;
    - AC-7.13: other students; deactivated (42501); unlinked (`parent_child_assignments` gives P0002, `parent_child_assignment` gives 42501); cascade; re-enrol;
    - the grants row.
    - The whole pgTAP suite, `family_portal.test.sql` included, stays green.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [x] **T7.4 Email recipients follow rule (b) (DB).**
  - **Files:** #1 steps 7–8: `work_returned_recipients` copied from `20261025110000` lines 115–138 with `assignment_readable_by`; the revokes.
  - **Tests:**
    - AC-7.14: after removal, `parent_child_assignment(d1, r1)` returns JSON and the recipients still list s1, p1 and p2;
    - `email_outbox.test.sql` stays green.
  - **Then:** `pnpm db:types` (#10) and `git diff --stat` shows only `database.types.ts`.
  - **Run:** `pnpm db:reset && pnpm db:test && pnpm db:types && pnpm typecheck`.
- [x] **T7.5 Hold switch in the portal.**
  - **Files:**
    - #3 `assignments.service.ts` (`hold_results` column, `holdResults`, `setHoldResults`), #4 `types.ts`, #7 `services/index.ts`;
    - #8 and #9 `auth-errors` and its test (`holdNeedsQuestions`), #11 `PORTAL_ERRORS.holdNeedsQuestions`, #12 `HOLD_RESULTS`;
    - #14 `HoldResultsSetting.tsx`, #15 its test, #18 the exports;
    - #19 `assignment-detail.tsx` (below `QuestionList` when `questionCount > 0`).
  - **Tests:** `HoldResultsSetting.test.tsx`: a draft is enabled and calls `setHoldResults(id, true)` then `onChanged`; a published one is disabled with the locked note; an error shows an alert; the text comes from `HOLD_RESULTS`.
  - **Visible:** `tutor@local.test` on an MCQ draft ticks the box, publishes, and it's locked; a paper draft shows no box.
  - **Run:** `pnpm --filter web exec vitest run src/components/portal/HoldResultsSetting.test.tsx src/services/auth-errors.test.ts`.
- [x] **T7.6 "Past class" for families.**
  - **Files:** #5 `family-data.ts`, #6 `family-data.test.ts` (new), #4 `types.ts`, #13 `FAMILY_TAGS.pastClass`, #16 `StatusChips.tsx` (`PastClassChip`), #17 its test (new), #18 the exports, #20–23 the four family routes.
  - **Tests:** the mapping `is_past_class` → `isPastClass`; the chip renders "Past class".
  - **Visible:** remove `student@local.test` from the seeded class. Their returned work shows "Past class" on student home and on the parent's child page and both assignment pages, read-only; non-returned work disappears.
  - **Run:** `pnpm --filter web exec vitest run src/services/family-data.test.ts src/components/portal/StatusChips.test.tsx`.
- [x] **T7.7 Docs (AC-7.17).**
  - **Files:** #24 `r3b/review.md` (F8 and F28 resolved, link to 01b), #25 `r3b/design.md` (§4 rule (b), the D8 note).
  - **Run:** `pnpm format:check`.
- [x] **T7.8 Manual passes.** Record each in the dev notes.
  - AC-7.4 browser leg: a held submission is returned with a comment, and the email reaches Mailpit within 5 minutes.
  - AC-7.7 and AC-7.16: the switch and the chip at 360 px, light and dark.
  - AC-7.14: the Mailpit "View feedback" link opens after the student has been removed.
  - AC-7.12: after removal, the "Past class" tag shows in the student's list and on the
    assignment page. With no returned work, student home shows "Nothing returned yet."
- [x] **T7.9 Full check.** §0 steps 1–3, plus the in-repo `test:smoke` and `test:csp`.
- [x] **T7.10 Dev notes.** `05-dev-notes-item-7.md`. It names every function body that was copied, with its source file and lines, for T2.15.
- [ ] **T7.11 Reviewer pass.** `review-5-item-7.md`, until it's APPROVED. The reviewer diffs each rebuilt body against its cited source.
- [ ] **T7.12 Test plan.** `06-test-plan-item-7.md`: the 03b §7.6 status table as cases, plus the family regression.
- [ ] **T7.13 Security review.** `06-security-item-7.md`. It covers:
  - rule (b) is read-only and writes keep `assignment_visible_to`;
  - "removal no longer revokes returned work" (02b §7.4 risk 1, an accepted residual);
  - re-grants after drop and recreate;
  - answers and marks hidden before return.
- [ ] **T7.14 `/test-and-ship`.** `…/06-test-plan-item-7.md` → `TSR-item-7.md`, merge, push. The close-out names the SHA.

**15 tasks.**

**Risks (item 7)**

| # | Risk | Mitigation |
|---|---|---|
| 1 | A rebuilt family function loses a column, a grant or a later fix | Copy only from the cited current body (the `grep … \| tail -1` check); the whole pgTAP suite, the grants row and the family regression in the TSR |
| 2 | Rule (b) leaks writes or pre-return answers | Writes keep `assignment_visible_to` (AC-7.11 tests); before-return hiding unchanged (AC-7.3, 7.6) |
| 3 | Held work never gets its email | AC-7.4 pgTAP (`marked_by`, 3 rows) and the Mailpit leg in T7.8 |
| 4 | A student enrolled by mistake keeps their returned marks | Accepted residual. To cut access, an admin deactivates the student or deletes the roster row. "Revoke past-class access" goes to Later |
| 5 | Held item 2's rebase overwrites item 7's bodies | T2.15 (§7) rebuilds from the current bodies and keeps `fair_results.test.sql` green |

---

## 6. Item 8 — "New assignment" and "due tomorrow" emails (branch `feature/more-email-alerts`)

Design: 03b §8 (25 files), ADR-0008, extending ADR-0004. One migration and one function deploy,
no new dependency. AC-8.1–8.17. The file hand-in parts of AC-8.1 and AC-8.5 move to T2.15. All
email goes to Mailpit.

- [ ] **T8.0 Branch, migration file, constraint names.**
  - **Run:** `git checkout develop && git pull --ff-only && git checkout -b feature/more-email-alerts && pnpm db:reset`.
  - **File:** create `20261028100000_more_email_alerts.sql`, or a fresh stamp later than item 7's (§1 rule 2).
  - **Precondition:** the latest `develop` CI run is green (the T7.0 command).
  - **Tests:**
    1. §0 stack checks 1 and 2. Check 2 prints item 7's stamp before this item's file is created.
       Check 1 matters most here, because item 8 changes the `notifications` function.
    2. `docker exec supabase_db_aj_classes psql -U postgres -Atc "select conname from pg_constraint where conrelid='public.email_outbox'::regclass"` lists `email_outbox_kind_check`, `email_outbox_reason_check` and `email_outbox_once`. They were already confirmed on 26 Oct 2026; re-check on the branch.
- [ ] **T8.1 Switches, outbox columns, Melbourne helpers (DB).**
  - **Files:** 03b #1 steps 1–3; #2 `email_alerts.test.sql` (fixture block copied from `email_outbox.test.sql`, the 03b §8.10 set-up rules).
  - **Tests:**
    - the "DST and schedule" row: every `is_reminder_hour` true and false case, and `melbourne_day_start`;
    - the "new assignment" deadline helper;
    - the new columns default true;
    - `email_outbox.test.sql` stays green.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [ ] **T8.2 One recipient function (DB).**
  - **Files:** #1 steps 4 and 7 (`email_still_relevant`, `email_recipients`; `queue_work_returned_email` copied from `20261025110000` lines 149–163 and switched to `email_recipients('work_returned', …)`); #3a `fair_results.test.sql` (its one AC-7.14 call renamed).
  - **Leave for now:** `work_returned_recipients` stays until T8.4, because the old claim still calls it.
  - **Tests:** item 3's AC-3.1 and AC-3.2 cases in `email_outbox.test.sql` stay green; the switch-per-kind cases.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [ ] **T8.3 Queue on publish, and the hourly reminder job (DB).**
  - **Files:** #1 steps 5–6 (`queue_new_assignment_emails` and its trigger; `queue_due_tomorrow_emails_for`, `queue_due_tomorrow_emails`, `cron.schedule('due-tomorrow-reminders', '10 * * * *', …)`); #3 `email_outbox.test.sql` (delete the outbox again after its fixtures).
  - **Tests:**
    - AC-8.1: incl. two rows for parent2 across two children, paper, and inserted as published;
    - AC-8.3 (within the 90-day retention, as AC-3.5);
    - AC-8.4;
    - AC-8.5 and AC-8.6: the publish-date boundary, `today - 1` queued and `today` not;
    - AC-8.8;
    - AC-8.11;
    - AC-8.12: `lives_ok` with the cap at 0 and with no Vault secret;
    - publishing after the due date queues nothing;
    - `cron.job` has the new job.
  - **Run:** `pnpm db:reset && pnpm db:test`.
- [ ] **T8.4 Claim, sweep, admin list, clean-up (DB).**
  - **Files:**
    - #1 steps 8–11: drop and recreate `notify_claim_emails(supported_kinds text[] default array['work_returned'])` with the claim order; the `kick_email_worker` sweep (body lines 299–336); drop and recreate `admin_email_problems` with `kind`; drop `work_returned_recipients`; the grants.
    - #3: the `proargnames` checks filtered by `proargmodes = 't'`.
  - **Tests:**
    - AC-8.7: both kinds swept to `too_late`, `work_returned` untouched;
    - AC-8.13;
    - AC-8.14: the three caps, and no argument returns only `work_returned`;
    - AC-8.15.
  - **Deploy-order proof (old worker against the new DB):** with the function **not yet changed**, `pnpm test:functions` still passes item 3's checks.
  - **Then:** `pnpm db:types`.
  - **Run:** `pnpm db:reset && pnpm db:test && pnpm test:functions && pnpm db:types && pnpm typecheck`.
- [ ] **T8.5 Worker renders three kinds.**
  - **Files:** #4 `copy.ts` (`EMAIL_KINDS`, the 03b §8.5 wording), #5 `template.ts` (`ClaimedRow.kind` and `.due_on`, `formatDueDate`, `renderShell`, the three renderers, `renderEmail`), #6 `index.ts` (`supported_kinds: [...EMAIL_KINDS]`), #7 `test-notifications.mjs`.
  - **Unit tests:**
    - AC-8.2: `formatDueDate`, the new-assignment body with and without a due date, the button and links, no instructions;
    - AC-8.9;
    - dispatch for each kind;
    - escaping.
  - **End-to-end tests:** drain the seed's new rows, then one new-assignment and one due-tomorrow round trip. Pause `due-tomorrow-reminders` with the same `cron.alter_job` rule, and resume it in `finally`.
  - **Test:** AC-8.16: `From` and the header block.
  - **Then:** after the run, `select jobname, active from cron.job` shows both jobs `t`.
  - **Run:** `pnpm test:functions`.
- [ ] **T8.6 Three switches on Account → Notifications.**
  - **Files:** #9 `types.ts` (`NotificationSettings`, `EmailKind`, `EmailProblem.kind`, `'too_late'`), #10 `notifications.service.ts`, #11 its test, #13 `account.tsx` (three rows, one Save), #17 `ACCOUNT_PAGE.notifications.newAssignment` / `.dueTomorrow`, #24 `account.module.css` only if needed.
  - **Tests (AC-8.10):** the select lists three columns; no row means all true; save sends all three.
  - **Visible:** as the student and the parent, three switches, Save shows "Saved…", and they survive sign-out. Staff see none.
  - **Run:** `pnpm --filter web exec vitest run src/services/notifications.service.test.ts`.
- [ ] **T8.7 Admin → Emails "Type" column.**
  - **Files:** #14 `admin-emails.tsx`, #15 `lib/email-problems.ts`, #16 its test, #17 `EMAILS_PAGE.columns.type`, `.kinds`, `.reasons.too_late`, `.intro`, and the extended comment.
  - **Tests:** every kind and `too_late` are labelled (AC-8.7, 8.13).
  - **Visible:** a hand-made `too_late` row shows "Due tomorrow · Too late to send".
  - **Run:** `pnpm --filter web exec vitest run src/lib/email-problems.test.ts`.
- [ ] **T8.8 Privacy sentence.**
  - **Files:** #18 `PRIVACY` (the 03b §8.9 sentence replaces item 3's two), #19 `privacy.test.tsx`.
  - **Run:** `pnpm --filter web exec vitest run src/routes/privacy.test.tsx`.
- [ ] **T8.9 Docs.**
  - **Files:**
    - #8 `supabase/README.md`: "Portal emails"; three kinds; the job and its kill switch `select cron.unschedule('due-tomorrow-reminders');`; migration first, then the function;
    - #20 `arch.md`;
    - #21 `budget.md`: §2, plus the §5 trigger as Q27's answer, or "pending Q27";
    - #22 `release-5/PRP.md`;
    - #23 `release-2/go-live.md`: §6.5's steps as unticked boxes.
  - **Run:** `pnpm format:check`.
- [ ] **T8.10 Manual passes.** Record each in the dev notes.
  - the AC-8.2 signed-out link → sign-in → assignment page;
  - AC-8.12: publish with `docker stop supabase_edge_runtime_aj_classes` and see no error, then `docker start` it;
  - AC-8.13 and AC-8.17 at 360 px, light and dark, with both new emails in Mailpit's preview at 360 px.
- [ ] **T8.11 Full check.** §0 steps 1–4 (in-repo E2E).
- [ ] **T8.12 Dev notes.** `05-dev-notes-item-8.md`. It names the copied bodies for T2.15.
- [ ] **T8.13 Reviewer pass.** `review-5-item-8.md`, until it's APPROVED. The reviewer checks the `supported_kinds` default, the claim order, and that the sweep runs before the early return.
- [ ] **T8.14 Test plan.** `06-test-plan-item-8.md`. It includes item 3's full regression (the claim, the cap, the kick, the admin list) and item 7's AC-7.14 under the new function.
- [ ] **T8.15 Security review.** `06-security-item-8.md`. It covers:
  - the "on by default" Spam Act call for the two new kinds (01b assumption 11);
  - no instructions, marks or answers in the emails;
  - definer functions and their revokes;
  - the deploy-order failure mode;
  - publish-storm behaviour under the cap.
- [ ] **T8.16 `/test-and-ship`.** `…/06-test-plan-item-8.md` → `TSR-item-8.md`, merge, push. The close-out names the SHA and repeats release step 1 (function never first).

**17 tasks.**

**Risks (item 8)**

| # | Risk | Mitigation |
|---|---|---|
| 1 | The function is deployed before the migration, so `PGRST202` stops **all** email, item 3's included | `supported_kinds` default, so the old worker works with the new DB (T8.4 proof); release step: `deploy.sh` pushes migrations then functions; never the function first |
| 2 | Real families are emailed during testing (one DB for staging and prod) | All tests run local, in Mailpit; the release check uses only the seeded fake family; Q31 tells Saurabh that the first 15:10 run reaches real families |
| 3 | Volume beyond the 70-a-day cap delays or drops "new work" emails | Reminders first, then oldest; `too_late` expiry shown to admins; Q27's upgrade trigger; watch Admin → Emails for a fortnight |
| 4 | DST or time-zone mistakes send reminders at the wrong hour or twice | Hourly job with the Melbourne-hour guard; pgTAP pins both DST changes and `melbourne_day_start` |
| 5 | Tests pass against stale function code on the shared stack | T8.0 edge-mount check |
| 6 | Item 3's and item 7's tests break on the new shapes | Named regressions in T8.2–T8.4 (`email_outbox.test.sql`, `fair_results.test.sql` row 3a) |
| 7 | A reminder is sent for work that was already handed in, re-dated or left | The claim re-checks `email_still_relevant` against the queued due date (AC-8.6, 8.8) |

---

## 7. Held item 2 — T2.15 release refresh (replaces 04-plan T2.15's text)

Only after Saurabh approves B3 (Q3). The work happens in item 2's own checkout
(`/Users/sjain/dev/work/aj_classes`, branch `feature/homework-file-uploads`), after items 4–8
have merged. It follows 03b §9 exactly.

- [ ] **T2.15 Refresh, rebuild and re-gate item 2.**
  1. **Migration check first (Saurabh).** He runs `supabase migration list` against the hosted
     project and confirms `20261025134709` was **never applied** there (ADR-0007 decision 4).
     Rename nothing before he confirms.
     - **If it _was_ applied on hosted:** stop. Don't rename, merge or deploy. Escalate to the
       Architect, because renaming would leave hosted with an applied migration that no file
       matches. The refresh only continues on the Architect's written decision.
  2. **Bring in `develop`:** `git fetch && git merge origin/develop` into the branch. Then
     `git mv` the migration to a fresh stamp later than every file on `develop`, including
     `20261028100000` or its renamed stamp. Check with `ls supabase/migrations | tail -2`.
  3. **Reset from this checkout:** `pnpm db:stop && pnpm db:start && pnpm db:reset`. The
     edge-mount check must point at `/Users/sjain/dev/work/aj_classes`.
  4. **Rebuild from the current bodies** (never item 2's snapshot; find each with
     `grep -n "function <schema>.<name>" supabase/migrations/*.sql | tail -1`):
     - `student_submit`: keep item 7's `or hold_results` branch, and add `handin` and `no_files`;
     - `assignments_for_student` and both wrappers: keep the left join, rule (b) and `is_past_class`, and add `is_file_handin`;
     - `assignment_view`: keep `isPastClass`, and add `isFileHandin` and the files;
     - `can_read_assignment_file`: every family branch uses `assignment_readable_by`, the own-hand-in branch included;
     - `is_online_assignment`: item 2's version;
     - upload, register and remove checks keep `assignment_visible_to`.
  5. **Tests:** `fair_results.test.sql` and `email_alerts.test.sql` stay green. New cases:
     - `hold_results` on a file hand-in gives `hold_needs_questions` (AC-7.2, file half);
     - a removed student reads their returned hand-in's files and the tutor's attachments, but can't upload or remove (AC-7.15);
     - publishing a file hand-in queues "new assignment" (AC-8.1, file part);
     - a due-tomorrow file hand-in that isn't handed in queues a reminder (AC-8.5, file part).
     - Re-apply item 2's 35-line `email_outbox.test.sql` change on top of item 8's version.
     - Re-test AC-5.5 for signed-URL downloads under the portal CSP.
  6. **Privacy:** item 2's sentences go into the `'Portal accounts'` section next to item 4's,
     and its `privacy.test.tsx` lookups use the new heading.
  7. Run `pnpm db:types` and T2.13 again: the full check, plus the manual phone-photo passes.
  8. Re-run `/test-and-ship` from step 0. That's a new TSR round with every case re-run. Then
     merge to `develop`, push, and name the release SHA.

**Risk:** a stale snapshot overwrites items 7 and 8's function bodies. **Mitigation:** step 4's
rule, plus step 5's pinned suites.

---

## 8. Release steps for Saurabh (per item, migration first)

Every release follows 04-plan §2 rule 5:

1. Cut `release/<item>` at the item's `develop` merge SHA, named in its close-out message.
2. Run `supabase/scripts/deploy.sh` from that branch, when the release carries a migration or a function.
3. Merge **that branch** into `main` through a PR. Never `develop` HEAD.
4. Live fixes go on the release branch and are merged back to `develop`.

**Every release needs these first:**

- Items 1 and 3 released, through Q1 and Q2 and their 04-plan §6.1 and §6.3 steps, or included in this run with all of their steps (§1 rule 4);
- `NOTIFY_WORKER_SECRET` in `supabase/.env.deploy`, because `deploy.sh` has required it since item 3.

### 8.0 B17 Privacy wording: one batched review (Q7)

Saurabh approves this set together. Each item releases only once its own sentence is approved.

1. Item 1: the news-check sentence (Q1 wording).
2. Item 2: 03 §2.8 (released with item 2 only).
3. Item 3: 03 §3.8. If item 8 releases before it's approved, Saurabh approves item 8's §8.9 replacement instead.
4. Item 4: the heading change "Student and parent portal accounts" → **"Portal accounts"**, and the 03b §4.6 staff-phone sentence.
5. Item 8: the 03b §8.9 sentence covering all three service emails.

### 8.1 Item 4 (release `release/staff-phone-privacy`)

**Preconditions:** the item 4 wording in §8.0 is approved; the items above it have been released.

1. `git fetch && git checkout -b release/staff-phone-privacy <item-4 SHA>`.
2. Check `PRIVACY.lastUpdated` names the release month. If it doesn't, the team commits the fix
   on the release branch, and that becomes the SHA used in the next steps.
3. From that branch: `supabase/scripts/deploy.sh`. It pushes `20261026100000_staff_phone_edit.sql`. No function change.
4. Merge `release/staff-phone-privacy` into `main` through a PR.
5. Checks:
   - `curl -s https://ajclasses.com.au/privacy | grep -c "For tutors and other staff"` = 1 (team);
   - Saurabh's own My profile shows his phone. Open it only; don't save.

### 8.2 Item 5 (release `release/public-csp`)

1. **Before the merge to `main` (Saurabh, Q32).** Item 5's push to `develop` builds a Vercel preview.
   - Open the `develop` preview behind Vercel's login, then DevTools → Network.
   - The `/portal/login` document has exactly **one** `content-security-policy`, the portal one.
   - `/` has the public one.
   - `vercel.live` toolbar violations are expected there. Never add that host.
2. `git fetch && git checkout -b release/public-csp <item-5 SHA>`. No migration or function since
   item 4, so no `deploy.sh`, unless item 4 is being released in the same run.
3. Merge `release/public-csp` into `main` through a PR.
4. **After release (team, read-only):**
   - `curl -sI` on `/`, `/programmes/vce` and `/nope`: each shows the public CSP;
   - `curl -sI …/portal/login | grep -ci '^content-security-policy:'` = 1, the portal one;
   - `curl -sI …/_vercel/insights/script.js` → 200;
   - HSTS is present;
   - the live home page in Chrome shows 0 CSP violations.
   - If `/portal/*` ever shows two CSPs, revert the release (config only).

### 8.3 Item 6 (no release of its own)

1. Nothing to deploy. The workflow and `e2e/` reach `main` in the next release branch. That
   `release/*` PR's description lists item 6's five dev dependencies with their reasons, copied
   from `05-dev-notes-item-6.md` (AC-6.13).
2. Optional, after the merge (Q30): make the five checks required on `main` in GitHub settings.
3. Within a week of the next production release (team): run Google Rich Results and Schema
   Markup Validator on live `/`, `/programmes/vce` and one guide. Record "no errors" with the
   date in `TSR-item-6.md` (AC-6.11).

### 8.4 Item 7 (release `release/fair-results`)

1. `git fetch && git checkout -b release/fair-results <item-7 SHA>`. This also carries item 6.
2. From that branch: `supabase/scripts/deploy.sh`. It pushes `20261027100000_fair_results.sql`. No function change.
3. Merge `release/fair-results` into `main` through a PR.
4. Check with the seeded test class only: an all-MCQ draft shows "Hold results until I return
   them"; a paper draft doesn't. Delete the test assignment.
5. Item 2 stays held. When it's refreshed, §7 applies.

### 8.5 Item 8 (release `release/more-email-alerts`)

**Preconditions:**

- **Q27 answered** (Resend volume rule). This gates item 8 only.
- The item 8 wording in §8.0 is approved.
- Item 3 released and its AC-3.11 check done.
- Q31 accepted.

1. `git fetch && git checkout -b release/more-email-alerts <item-8 SHA>`.
2. From that branch: `supabase/scripts/deploy.sh`. One run pushes the migration and **then**
   deploys `notifications`. If done by hand, run `supabase db push` first, then
   `supabase functions deploy notifications`. **Never the function first**, because it stops all
   email (`PGRST202`).
3. Merge `release/more-email-alerts` into `main` through a PR.
4. Release check, with the seeded fake family and the test class only:
   - publish one paper assignment, and both test inboxes get "New work set" within 5 minutes;
   - set up one online assignment due tomorrow, published 2 or more days earlier, and after 15:10 Melbourne both inboxes get "Due tomorrow";
   - `/portal/admin/emails` is empty. Delete the test class afterwards.
5. On the first 15:10 run, already-published online work due the next day sends reminders to
   real families. That's by design (Q31).
6. For the first fortnight, watch Admin → Emails for "Daily limit" and "Too late to send". This is
   Q27's trigger. Tick the item 8 boxes in `go-live.md`.
7. Kill switch if needed: `select cron.unschedule('due-tomorrow-reminders');` in the SQL Editor.

### 8.6 Item 2: see §7 and 04-plan §6.2. Its release steps are unchanged.

---

## 9. Deferred (not in items 4–8)

1. **Item 4:** verifying a changed number (SMS or WhatsApp), phones for students or parents, a
   "last changed" date, and showing staff phones to same-class tutors.
2. **Item 5:** violation reporting (`report-to`, which waits for Sentry, Q9), hash-based
   `script-src` and the build-time meta CSP (ADR-0005), `upgrade-insecure-requests`, Trusted
   Types, and tightening the portal's `'unsafe-inline'`. The Railway mirror file stays: when
   Railway is cleaned up, rename it rather than delete it.
3. **Item 6:**
   - the full E2E suite on every PR, including new specs for items 2, 3, 7 and 8 beyond the smoke;
   - Lighthouse on portal pages;
   - visual regression;
   - E2E against hosted staging;
   - the JS size gate, if T6.7 records a gap (with the MUI chunk split);
   - required checks (Q30 is the owner step).
4. **Item 7:**
   - "Return all submitted" for held quizzes;
   - turning hold off after publishing;
   - hold as the default;
   - returning work for a student who has left;
   - showing a left student's non-returned work;
   - a "past classes" filter;
   - a "revoke past-class access" action;
   - clearing a stale `hold_results` after every question is deleted.
5. **Item 8:**
   - reminders for paper homework;
   - emails for students enrolled after publishing;
   - a configurable or second reminder;
   - a catch-up for a missed 15:10 run;
   - a daily digest (the next lever after Resend Pro);
   - tutor-side alerts;
   - SMS and push;
   - notifying a new class when a published assignment moves to it;
   - at-most-once beyond the 90-day retention.
6. **Moved to T2.15 (item 2):** AC-7.2 (file half), AC-7.15, the file hand-in parts of AC-8.1 and
   AC-8.5, and AC-5.5 for signed-URL downloads.
7. **Programme:** item 9 (dropped), everything blocked in 04-plan §1.2, the Later bucket, and
   mobile.

---

## 10. Definition of done

Common to items 4–8 (as 04-plan §8):

1. Every task in the item's section is ticked, and each tick means its test ran and passed.
2. Every AC has a passing test: unit, pgTAP, script, CI run, or a recorded manual result in the TSR. Hosted-only parts are written as §8 release steps, and ACs moved to T2.15 are named in the TSR's "Not covered".
3. The full check in §0 is green, with 0 hosted refs, `pnpm db:test`, `pnpm test:functions` and E2E. From item 6 on, CI is green as well: on the PR or `act` before the merge, and on `develop` after it. Any GitHub-only evidence still missing is named under "Not covered" until the `develop` run supplies it.
4. `review-5-item-<n>.md` is APPROVED, and `06-security-item-<n>.md` has no open blocking finding.
5. `TSR-item-<n>.md` is at 100%, with "Not covered" filled in.
6. The close-out message names the release SHA and its `release/<item>` branch, and repeats the item's §8 steps and preconditions.

| Item | Docs updated | Merge and push |
|---|---|---|
| 4 | `invite-onboarding.md`; `PRIVACY` | Merged to `develop`, pushed |
| 5 | `arch.md` §3; `release-1/PRP.md` (item 9, 3 lines); `03-design.md` §1.6 line | Merged, pushed |
| 6 | `docs/testing/ci-gates.md`, README "Checks", `arch.md` §2; dependency reasons in the dev notes and the merge-commit body (and the draft PR on path A) | Merged, pushed; path A: draft PR closed and `ci-proof/item-6` deleted; path B: `develop`-run evidence appended to the TSR |
| 7 | `r3b/review.md` F8/F28, `r3b/design.md` §4 and D8 | Merged, pushed |
| 8 | `supabase/README.md`, `arch.md` §4, `budget.md` §2 and §5, `release-5/PRP.md`, `go-live.md` boxes | Merged, pushed |
| 2 | 03b §9 carry list applied | Done again only after B3, through T2.15 |

---

## 11. Questions for Saurabh (continue from Q20; answer by number)

The new questions start at Q27 (review-4b finding 3), to stay clear of 01b's Q21 (a private
E2E repo, never asked, because ADR-0006 chose option (a)). 02b and ADR-0006 still cite that Q21.
01b's Q22 was dropped. Q23–Q26 are unused. None of these questions blocks building items 4–8.

27. **[Item 8 release: Resend volume, 02b Decision 1]** "Item 8 roughly doubles app email. On
    Resend Free the app can send 70 a day, which covers about 30 active portal students. Do you
    approve this rule:
    - we stay on Free;
    - you upgrade to Resend Pro (≈ A$31/month) when active portal students go over about 30, or
      when **Daily limit** rows show up on Admin → Emails in two separate weeks?

    Or would you rather upgrade before item 8 goes live?" **Recommendation:** approve the rule and
    stay on Free.

28. **[Item 6: CI before merge]** "To prove the new CI checks before merging, can we push
    `feature/ci-quality-gates` to GitHub and open a **draft** PR to `develop`? Also, can we push a
    throwaway `ci-proof/item-6` branch with a second draft PR? It would hold two deliberately failing
    commits, and we'd close it and delete the branch from GitHub afterwards. Neither deploys
    anything to Supabase, but Vercel may build previews of them." You can say yes to the first
    part only; then the deliberate failures run locally with `act`, as in path B.
    **Recommendation:** yes to both. If you'd
    rather not, we prove the jobs locally with `act` before the merge, including the deliberate
    failures. Only the GitHub-side evidence (check names, logs and three durations) waits for the
    `develop` push after the merge.
29. **[Release cadence]** "Every release from now on also ships items 1 and 3, which are merged
    but not yet live (`main` is 85 commits behind). How do you want to release?
    1. One at a time, as each item merges.
    2. Batched: 1 + 3 first (Q1, Q2), then 4 + 5 together after the B17 wording, then 7 (item 6 rides along), then 8 after Q27.
    3. Everything at once after item 8."

    **Recommendation:** 2. It needs fewer release runs, and each batch is still small enough to
    check.

30. **[Item 6, optional]** "After item 6 merges, do you want the five checks made **required** in
    GitHub? **Recommendation:** on `main` only. `/test-and-ship` pushes merge commits straight to
    `develop`, and a required check there would block that push." (03b §6.11 says `develop` and
    `main`. T6.10 records this deviation.)
31. **[Item 8 go-live]** "After item 8 is released, the first 3:10 pm run will email real
    families about already-published online work due the next day, and from then on publishing
    emails families straight away. OK?" **Recommendation:** yes. That's the feature. Release
    checks use only the fake test family.
32. **[Item 5 preview check]** "After item 5 merges, can you open the `develop` preview on Vercel
    (behind your login) and check the header count on `/portal/login` and `/` (§8.2 step 1, about
    2 minutes)? Or should we rely on the live `curl` check straight after release, with a
    config-only revert if it's wrong?" **Recommendation:** do the preview check. The Vercel rule
    form hasn't been proven on this project yet.

Still open from 04-plan and leaned on here (not re-asked):

- Q1 and Q2: release items 1 and 3. Every item 4–8 release depends on them.
- Q3 (B3): item 2's gate.
- Q7 (B17): the §8.0 wording batch.
- Q9 (B14): Sentry, for item 5's deferred reporting.

---

## 12. Assumptions made in this plan

1. `[ASSUMPTION]` Restarting and resetting the shared local Supabase stack from this worktree is
   fine (§0). It wipes local data only, and item 2's checkout restores its schema at T2.15
   step 3.
2. `[ASSUMPTION]` The item 6 move uses `git archive` of the E2E repo at `488dde1`, its current
   HEAD. If that repo gets a newer commit before T6.1, use the newer one and name it in the dev
   notes.
3. `[ASSUMPTION]` Items 4 and 5 run E2E from the external repo. The placeholder form key is
   passed on the command line rather than in a new gitignored env file, so nothing extra is
   left in the worktree.
4. `[ASSUMPTION]` Item 5's release skips `deploy.sh` when item 4 is already live, because there's
   no migration or function change in between. If they release together, item 4's §8.1 steps
   cover it.

---

## Change log

| Date | Change | Why |
|---|---|---|
| 26 Oct 2026 | First version, items 4–8 | /deliver stage 4 for 01b, 02b and 03b |
| 26 Oct 2026 | Revised after [review-4b](review-4b-items-4-8.md) round 1 (findings 1–7) | See below |

**Review-4b changes (26 Oct 2026):**

1. **Item 6 without a pushed PR** (header, §4 intro, T6.6, T6.7, T6.9–T6.11, T6.14, risks 1 and 1a, §8.3, §10):
   - path A uses a throwaway `ci-proof/item-6` branch for the deliberate failures;
   - path B runs the jobs with `act` and uncommitted failures, and lists GitHub-only evidence under "Not covered" until the `develop` run;
   - AC-6.13's reasons go in the dev notes, the merge-commit body and the `release/*` PR;
   - a red `develop` run is fixed forward before T7.0, and T7.0 and T8.0 require a green `develop` run first.
2. **Shared stack** (§0, T5.0–T8.0): §0 names all three checkouts, including the stale `magical-liskov-6b3b72`, and says its files aren't touched. The reset also wipes item 2's local Storage objects and Mailpit. Stack checks 1–2 are repeated in every T*.0.
3. **Questions renumbered** Q21–Q26 → Q27–Q32 (§11), and assumption 5 removed.
4. **T6.1:** the archive holds 20 files, not 28. `e2e/package.json` declares `typescript`, `@types/node` and `@supabase/supabase-js` at `apps/web`'s ranges.
5. **T2.15 step 1:** if the migration was applied on hosted, stop and escalate to the Architect.
6. **T7.8:** AC-7.12's manual leg added.
7. **Q30:** the deviation from 03b §6.11 is recorded in T6.10.
