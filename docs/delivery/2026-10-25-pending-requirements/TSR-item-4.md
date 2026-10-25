# Test Summary Report — item 4 (staff phone on My profile, plus the Privacy update)

- Date: 2026-10-26 · Branch: `feature/staff-phone-privacy` @ `949aa44` (the plan freeze commit). It descends from `FIX=2ff414f` (`git merge-base --is-ancestor 2ff414f HEAD` exits 0), and differs from it only in `06-test-plan-item-4.md`.
- Environment: local only.
  - **D:** the dev server, `http://localhost:5173` (strict port).
  - **P:** the production build on the item 1 Vercel mirror, `http://localhost:4173`.
  - **A:** the Android emulator `AJ_Test_Phone` (Chrome 133, `adb reverse` to D and DB).
  - Local Supabase: API `127.0.0.1:55321`, DB `:55322`, Mailpit `:55324`. It was started and reset from this worktree (edge-runtime mount check `1`, newest migration `20261026100000`).
  - Seed accounts are from `supabase/seed.sql`.
  - Every build used the local exports. The hosted project was never read or written. `supabase/.env.deploy` was never opened, and no banned CLI command ran.
- Full check (header of the plan, lines 1–4) → **PASS**, exit 0 (`evidence/E-04-fullcheck.log`, `evidence/E-06-e2e.log`):
  - format clean · lint 0 problems · typecheck clean · production build OK · hosted refs **0**;
  - `pnpm test` **51 files, 439 tests passed**;
  - `db:test` **14 files, 507 tests, PASS** (`staff_phone.test.sql` and `onboarding.test.sql` ok);
  - `test:functions` **169 `ok`, 0 `NOT OK`**;
  - E2E (external repo) **9 passed** (1.6 min). Afterwards: 0 `e2e-%` rows in profiles, posts and enquiries.
- Test plan: `06-test-plan-item-4.md`, **frozen at 75 cases** (`949aa44`). The review-6a changes are listed in the plan header under "Lines changed after review 6a round 1", so there's no second review round. Run in phase order: 0, 1, 2, then 7, then 3, 4, 5, 6.
- Evidence: `docs/test-reports/2026-10-26-feature-staff-phone-privacy/evidence/` holds:
  - the full-check and E2E logs;
  - per-leg browser counters (`legs.jsonl`, 88 Chromium legs);
  - the case outputs (`p3a.out` to `p3d.out`, `e70.out`);
  - the E-70/E-71/E-72 screenshots;
  - the grep pattern file, the snapshots and the sitemap list.

**Run notes (read before the results).**
1. **X1 fixture.** A plain superuser `update … phone = null` is refused with `phone_required` (dev notes §8, S4). X1 uses `session_replication_role = replica` for that one statement, as the frozen plan says.
2. **E-62 harness.** The first attempt timed out: the photo "Remove" button is `Remove photo`, and the app asks `window.confirm` first. The harness now accepts dialogs, the partial upload was removed through the UI, and the case was re-run from scratch. Not an app fault.
3. **E-72 harness.** Playwright's `_android.launchBrowser()` hung on Chrome's first-run screens. I used the plan's fallback: dismiss the first-run and notification screens with `adb`, then `adb forward … chrome_devtools_remote` plus `connectOverCDP`.
   - A CDP mouse "click" was taken as a stylus, so Gboard opened its handwriting tutorial. I removed that with `settings put secure stylus_handwriting_enabled 0`, and restored it afterwards with `settings delete`.
   - The measured tap is a real finger tap (`adb shell input tap` at the field's centre).
4. **E-95 part 1.** The first two `pp` calls printed nothing (a shell slip in the same command that set `ADM8`). The database showed nothing had changed, so I re-ran them. The re-run is the measurement.
5. Audit rows are judged as deltas, as the plan says. 10 `profile_edited_by_admin` rows from this run stay in the local `audit_log`. The snapshot doesn't cover `audit_log`.

## Round 1

### Phase 0 — safety guards

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-01 | Safety | Env local only | URL exact; key equal; only `.env.example`/`.env.production`; E2E `.env` local, 0 `supabase.co`; no overrides; no deploy names; HEAD descends from `33c8573` | `http://127.0.0.1:55321`; `equal`; `.env.example`, `.env.production`; E2E `SUPABASE_REST_URL=http://127.0.0.1:55321`, `PG_HOST=127.0.0.1`, `PG_PORT=55322`, `WEB_BASE_URL=http://localhost:5173`, `MAILPIT_URL=http://127.0.0.1:55324`, `supabase.co` 0; overrides none; deploy/Resend names none; `949aa44`, `0`, `feature/staff-phone-privacy` | PASS |
| E-02 | Safety | Stack from this worktree; snapshot | reset 0; mount 1; `20261026100000` ×2; 4 staff `+61400000000`, families null, `inactive@` `f` | reset exit 0; mount **1**; both `20261026100000`; snapshot as expected (6 profiles, guardians 2, avatars 0, Aarav's consent kept, `inactive@` banned `true`, `tutor@` `null`) | PASS |
| E-03 | Safety | `.env.deploy` ignored; no banned command | `0`; none | `git check-ignore` 0. The run log has no read of `.env.deploy` and no `link`, `db push`, `config push`, `functions deploy`, `secrets *`, `--linked` or `--project-ref`. Only `supabase status` / `db reset` / `db:test` / `gen types --local` ran | PASS |

### Phase 1 — repo checks

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-04 | Full check | Repo full check | exit 0; ≥ 51/439 incl. the 5 named files; ≥ 14/507 with both SQL files; ≥ 169 ok | exit 0; lint 0; **51/439** (the 5 files listed by `vitest list`); **14/507** PASS; **169 ok / 0 NOT OK** | PASS |
| E-05 | Hosted refs | Build greps | `unzjnxctkyahtmrkinyr` 0; `supabase\.co` **0**; `127.0.0.1:55321` ≥ 1; admin key 0 | 0; **1 file**; 1; 0. The `supabase.co` hit is `assets/dist-DvjAMUvs.js`, the supabase-js vendor bundle: a hostname allow-list literal (`` `*.supabase.co`,`*.supabase.in` ``), not a URL the app calls. It's the same file hash item 3's TSR recorded on `develop` (E-06 `SB=dist-DvjAMUvs.js`). Browsers made 0 `supabase.co` requests (E-91) | **FAIL (plan expectation; ruling R1)** |
| E-06 | E2E | External suite | 9 passed; 0 `e2e-%`; port free | **9 passed**; 0 / 0 / 0; 5173 free | PASS |
| E-07 | Scope guard | 20 files; untouched list; onboarding not redefined | the exact 20; `0`; `complete_onboarding` grep **0** | List matches the 20 exactly (`diff` empty); `0`; grep **2**. Both hits are comment lines in the new migration (lines 26 and 55: "complete_onboarding() passes unchanged…", "…sets the first number before two-step exists"). No `create … function … complete_onboarding` in the diff | **FAIL (plan expectation; ruling R2)** |
| E-08 | Code rules | Added lines | 0 | 0 | PASS |
| E-09 | Types | `db:types` no diff | `0` | `0` | PASS |

### Phase 2 — DB and API

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-10 | Accepted formats | 10 formats as tutor | each 200, normalised as listed | All 10 **200**, stored `+61491570156`, `+61491570157`, `+61255501234`, `+61355501234`, `+61755501234`, `+61855501234`, `+61491570158`, `+61255509876`, `+61491570159`, `+61491570110` (tab-separated included) | PASS |
| E-11 | Invalid (API) | 16 bad values | each 400 `invalid_phone`; never 500; unchanged; 6 profiles | All 16 **400** `P0001` `invalid_phone`, including the JSON number `123`, the 5,000-character string and the SQL-looking string; phone `+61400000000` after each; 6 profiles | PASS |
| E-12 | Blank (API) | `""`, `"   "`, `null`; whole form | 400 `phone_required`; row unchanged | All **400** `phone_required`; the whole-form write **400** `phone_required`, row unchanged | PASS |
| E-13 | No phone yet (API) | X1 | name saves with blank/null; then number saves; restored | `200` `Local Tutor B` / `null` twice; `200` `+61491570156`; restored `+61400000000`, `Local Tutor` | PASS |
| E-14 | One statement | Bad phone in whole-form write | 400; nothing saved | **400** `invalid_phone`; name, bio, quals, subjects, phone unchanged | PASS |
| E-15 | Tutor | Others' phones | PATCH `200 []` ×4; GET `[]`; list 1 row; RPC refused | **200 `[]`** ×4; `[]`; 1 row (`$TUT`); `admin_list_staff` **403** `not_admin`; all four phones unchanged | PASS |
| E-16 | Families | Own and tutor phones | `200 []`; own row only, `null`; RPC refused | Student and parent: own PATCH **200 `[]`**, tutor PATCH **200 `[]`**, GET own row only with `phone: null`, RPC **403** `not_admin`; phones null / null / `+61400000000` | PASS |
| E-17 | Families | Admin can't give one a phone | 400 `invalid_input` ×2; name with blank 200 | **400** `invalid_input` ×2; name write **200**, phone `null`; name restored | PASS |
| E-18 | aal1 admin | On a tutor | `200 []`; unchanged; audit N | **200 `[]`**; `+61400000000`; audit 1 → 1 | PASS |
| E-19 | Signed out | Read and write | 401 or `[]` | Write **401** `42501`; read **401** `42501`; phone unchanged | PASS |
| E-20 | Ungranted columns | 7 tutor bodies, 3 aal2 bodies | 401/403 `42501`; row unchanged | All 10 **403** `42501`; row unchanged | PASS |
| E-21 | Deactivated | Stale token (X2); unbanned inactive (X4) | `f`; `200 []`; re-sign-in; `200 []`; 0 chars | `set-active` 200; `f`; stale token **200 `[]`**, unchanged; reactivated, sign-in OK, `banned_until` null; unbanned `inactive@` signs in, PATCH **200 `[]`**; re-banned, sign-in **0** chars | PASS |
| E-22 | Still invited | X3 via the real admin UI invite | `tutor\|invited\|null`; three `200 []`; console 0, hosted 0 | `tutor\|invited\|null`; **200 `[]`** ×3; name and phone unchanged; both legs console **0**, hosted **0** | PASS |
| E-23 | Onboarding refuses family phone | X5; password first | password 200, `t`; RPC 400 `invalid_input`; `invited\|null`; console 0 | `PUT /auth/v1/user` **200**; `password_set_at` `t`; RPC **400** `invalid_input`; `invited\|null`; legs console 0, hosted 0; X5 removed (count 0, guardians back to 2) | PASS |
| E-24 | Admin change: audit | `(03) 5550 4321` | 200; N+1; exact row; digits 0; list | **200** `+61355504321`; audit 1 → **2**; `$ADM\|$TUT\|{"fields": ["phone"]}`; digit/number count **0**; `admin_list_staff` `+61355504321` | PASS |
| E-25 | Same value | Two equal formats | 200 ×2; audit N; `updated_at` recorded | **200** ×2, `+61355504321`; audit 2 → 2. `updated_at` (record only) moved from 18:50:38.29 to 18:50:39.77, as review 6a predicted | PASS |
| E-26 | Self-edit | Tutor and admin own | audit N; `updated_at` up | Both **200**; audit 2 → 2; tutor `updated_at` up (`t`) | PASS |
| E-27 | Several fields | Name + phone | N+1; `["full_name", "phone"]` | **200**; 2 → **3**; `{"fields": ["full_name", "phone"]}` | PASS |
| E-28 | Other staff rows | newadmin, inactive | 200 ×2; N+2 | **200** `+61491570159`, `+61855501234`; 3 → **5**; targets `$NADM`, `$INA`, each `["phone"]` | PASS |
| E-29 | Invited row | Admin sets X3's phone | 200; `invited\|+61491570110` | **200**; `invited\|+61491570110` | PASS |
| E-30 | Trigger function | Closed and safe | RPC 404; anon/auth `f`; no public X; secdef, `search_path=""`; 3 triggers `O` | **404** `PGRST202`; `f\|f`; `proacl {postgres=X/postgres}`; `t`, `{"search_path=\"\""}`; `profiles_audit_admin_edit:O`, `profiles_check_phone:O`, `profiles_set_updated_at:O` | PASS |
| E-31 | DB exposure | Functions, views, grants, publications | exactly 2 functions; 0 ×4; no anon execute | `admin_list_staff`, `complete_onboarding`; 0, 0, 0, 0; `admin_list_staff` ACL `postgres, authenticated, service_role` (no anon) | PASS |
| E-32 | Concurrency | Tutor and admin at once | both 200; final one of the two; list agrees; N+1 | Both **200**; final `+61491570157` (admin wrote last); list agrees; audit 6 → **7** | PASS |

### Phase 7 — Security S1 (run after phase 2)

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-92 | aal1 admin, own phone | API refusals; re-send passes | 1–3: 400 `insufficient_aal`, unchanged; audit N; 6: 200 | `admin-aal1` own, `newadmin@` own, `admin-aal1` `03 5550 4321`: all **400** `insufficient_aal`; both still `+61400000000`; audit 7 → 7. Step 6 (bio + `0400 000 000`): **200** `+61400000000`. Step 5 (record only): name-only edit at aal1 **200** (security residual 1); name and bio restored | PASS |
| E-93 | aal2 admin, own phone | Succeeds | 200; N | **200** `+61491570156`; 7 → 7 | PASS |
| E-94 | Real paths | aal2 UI saves; aal1 can't reach form | saved ×2, `+61491570158`; two-step screen, 0 field; console 0 | "Profile saved." ×2 (My profile, own staff page), no field error, `+61491570158`, PATCHes 2. `newadmin@` → `/portal/account/two-step/setup`, `#profile-phone` 0. Console 0, hosted 0, 4xx 0 on both legs. (The aal1 leg read its own profile, 200 and not refused) | PASS |
| E-95 | Invited admin | Exemption, both sides (X8) | own token `200 []`; aal2 200 `+61491570110`; join → `admin\|active\|+61491570159`; aal1 after join 400 `insufficient_aal` | Own token **200 `[]`**; aal2 **200** `+61491570110`; row `invited\|+61491570110`. Join completes → `/portal/account/two-step/setup`, no alert; `admin\|active\|+61491570159`. Password sign-in (`aal1`) → **400** `insufficient_aal`, phone unchanged. Console 0, hosted 0; X8 removed (count 0) | PASS |
| E-96 | Runbook, pgTAP | Greps | 1, 1; ≥ 1; ≥ 1; newest file; README 1, 1 | design.md line 643: 1, 1; pgTAP 1; migration 1; newest `20261026100000_staff_phone_edit.sql`; README 1, 1; E-04 shows `staff_phone.test.sql` ok | PASS |

### Phase 3 — portal on D

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-40 | Smoke | Key pages | 200 ×3; 1 `h1`; 1 robots; overflow 0; console 0 | 200 ×3; each 1 `h1`, 1 robots meta, overflow 0, console 0, hosted 0 | PASS |
| E-41 | Sign-in | 5 roles + reload | right landing, kept after reload; console 0 | admin `/portal/admin` "Admin"; newadmin `/portal/account/two-step/setup`; tutor `/portal/tutor`; student `/portal/student`; parent `/portal/parent`. The same after reload; console 0, hosted 0 ×5 | PASS |
| E-42 | Sign-in | Inactive refused | message; stays; 0 keys; only A1 | "Email or password is incorrect." 1; `/portal/login`; 0 token keys; console: exactly one `400` (`POST /auth/v1/token`), which is **A1** | PASS |
| E-43 | Field (tutor) | Label, order, value, attrs, hint, 1 button | as listed | `Phone number` (1 label); after Full name; `0400 000 000`; `tel`/`tel`/`tel`; `aria-describedby` → the exact hint; 1 "Save profile" | PASS |
| E-44 | Field (admin) | Same | as E-43 | Same values | PASS |
| E-45 | Save and reload | `0491-570-156` | saved once; `0491 570 156` before/after; PATCH 1; `+61491570156`; audit N | Exactly that; audit delta 0 | PASS |
| E-46 | Other formats | `+61 2 …`, `(08) …` | formatted; stored | `(02) 5550 9876` / `+61255509876`; `(08) 5550 1234` / `+61855501234`; saved once each, 1 PATCH each | PASS |
| E-47 | Invalid (browser) | 6 values | exact error; `aria-invalid`; error described; focus; no alert; PATCH 0 | All 6: exact text, `aria-invalid="true"`, error in `aria-describedby`, focus `profile-phone`, no alert, no "Profile saved.", PATCH **0**; DB `+61400000000` | PASS |
| E-48 | Blank (browser) | `""`, `"   "` | required text; focus; PATCH 0 | Both: exact required text, focus `profile-phone`, PATCH 0; DB unchanged | PASS |
| E-49 | No phone yet (browser) | X1 | empty + hint; bio saves with null; then number | Empty, hint shown; "Profile saved.", PATCH 1, DB `null` + bio; then `0491 570 159` after reload, `+61491570159`; restored | PASS |
| E-50 | Edits survive | 4 edits + `abc`, then fix | edits kept, PATCH 0; then saved once, PATCH 1, header refreshed, DB all 5 | Name/subject/bio/qualification kept, PATCH 0; fix: "Profile saved." once, PATCH 1, header shows `Local Tutor D` without reload; DB `Local Tutor D\|D\|{"Test cert"}\|{maths}\|+61491570157`; restored | PASS |
| E-51 | Server refusal | Rewritten PATCH | field errors (invalid, then required); no alert; bio kept; DB unchanged; only A2 | Exactly that; 2 × `400 PATCH /rest/v1/profiles`; console: exactly those 2 lines (**A2**) | PASS |
| E-52 | Double save | `dblclick` | PATCH 1; saved once | PATCH **1**; once; no alert | PASS |
| E-53 | Network failure | Aborted PATCH | network alert; no field error; value kept; only A2 | "We couldn't reach the server. Check your connection and try again." (`network`); no field error; `0491 570 159` kept; DB unchanged; console: 1 `net::ERR_FAILED` (**A2**) | PASS |
| E-54 | Admin correction | Staff page and list | list before `0400 000 000`; saved; link `tel:+61355504321`; list after; N+1 | Exactly that, the link without a reload; audit +1 `{"fields": ["phone"]}` | PASS |
| E-55 | Activity | Field name only | contains the 3 parts; no number; no `tel:` | "26 Oct 2026, 5:59 am Local Admin Edited profile of Local Tutor Fields: phone"; 0 number forms; 0 `tel:` | PASS |
| E-56 | Admin invalid/blank | Same rules | invalid / required; PATCH 0 | Both exact; PATCH 0; DB unchanged | PASS |
| E-57 | Own page, other admin | 0 vs 1 audit | own 0; other +1 | Title "Local Admin (you)"; own saved, delta **0**; New Admin saved, **+1** target `$NADM` `["phone"]`; list `0491 570 156` / `0491 570 157` | PASS |
| E-58 | Deactivated, invited | Inactive form; invitee cell | saved; `tel:+61755501234`; `0491 570 110` | List `0400 000 000`; form shown; saved; `tel:+61755501234 (07) 5550 1234`; invitee `0491 570 110` | PASS |
| E-59 | Deactivated on page | X2 | alert or redirect; not saved; console 0 | Alert "Your changes weren't saved. Please try again." (alert, not redirect); no "Profile saved."; `+61400000000`; console 0, 4xx 0 | PASS |
| E-60 | Permissions (UI) | 13 legs | right screen; field 0; staff number 0 in DOM **and in any response body**; 0 4xx; console 0; only the access read | Signed out ×2 → `/portal/login?next=…`, 0 requests. Tutor/student/parent ×9 → "You don't have access to this page", and the only page request is the layout's access read. `newadmin@` → two-step set-up. `admin@` on a family id → "Not found". Field 0, DOM numbers 0, 4xx 0, console 0, hosted 0 on all 13. **But** "response body" hits on 4 legs: the 3 tutor legs carry the tutor's **own** profile (`+61400000000`), fetched by `/portal/tutor` during sign-in, before the navigation under test. The admin-on-family leg carries `admin_list_staff`, which the admin is allowed to read | **FAIL (plan expectation; ruling R3)** |
| E-61 | Onboarding with a phone | X3 joins | `active\|+61491570157`; My profile shows it; change saves; delta 0 | Join → `/portal/tutor`; `active\|+61491570157` (replaced the admin's `+61491570110`); field `0491 570 157`; saved `+61491570158`; audit delta **0**; console 0 | PASS |
| E-62 | Photo | Upload, phone save, remove; admin photo audit | as listed; N+2 `avatar_path` | alt `Photo of Local Tutor`, the photo kept after the phone save and reload, `0491 570 156`; removed → "No photo yet"; admin upload + remove → **+2** `{"fields": ["avatar_path"]}`; avatar objects 0 (snapshot) | PASS |
| E-63 | Other fields | Admin edits 4 | saved; N+1 exact list | Saved and kept after reload; **+1** `{"fields": ["full_name", "bio", "qualifications", "subjects"]}`; restored | PASS |
| E-64 | Sign-in after change | Out and in | staff home; `0491 570 159` | `/portal/login` → `/portal/tutor`; `0491 570 159` | PASS |

### Phase 4 — UI matrix and device

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-70 | UI: tutor | 4 legs | overflow 0; in viewport; contrast ≥ 4.5; lines; 1 `h1`; console 0 | All 4: overflow 0; field 112–752 (1280) and 16–344 (360); contrast (light / dark) label 14.69 / 17.09, text 16.27 / 15.19, hint 7.56 / 8.82, error 6.47 / 6.77; hint 2 / error 1 at 1280, hint 3 / error 2 at 360; 1 `h1`; console 0, hosted 0. `data-portal-theme` light/dark confirmed | PASS |
| E-71 | UI: admin | 4 legs | as E-70 plus link | All 4: overflow 0; field 129–1151 / 33–327; label 14.69 / 15.48, text 16.27 / 15.19, hint 7.56 / 7.99, error 6.47 / 6.13, `tel:` link 5.17 / 7.36; lines as E-70; console 0, hosted 0 | PASS |
| E-72 | Keypad | Android Chrome, both pages | `mInputShown=true`; focused editor **`inputType=0x3`**; keypad in screenshots; overflow 0; console 0 | Both pages: `mInputShown=true`, `mIsInputViewShown=true`, focused editor **`inputType=0x4003`** (class bits `0x3` = `TYPE_CLASS_PHONE`, plus Chrome's `0x4000` flag); the screenshots show the phone keypad (`E-72-tutor.png`, `E-72-admin.png`); width 412 CSS px; overflow 0; focus `profile-phone`; console 0, hosted 0, 4xx 0 | **FAIL (plan expectation; ruling R4)** |

### Phase 5 — exposure and Privacy on the build

The build was redone after X6, without `VITE_LOCAL_ADMIN_TWO_STEP_KEY`. Re-running E-05's greps gave 0, 1 (the same vendor literal), 1 and 0.

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-80 | Build grep (D2) | Stored numbers | ≥ 21 patterns, none `0412 345 678`; 0 files; example only | **28** patterns from 4 stored numbers (`+61491570156`, `+61255501234`, `+61400000000`, and X3's `+61491570158`), none `0412…`/`412345678`; hits **0 files**; `0412 345 678` only in "…phone number, like 0412 345 678." (2 contexts, both the error text) | PASS |
| E-81 | Code grep | Public services, sitemap, SEO; family | only `leads.client.ts` and `BUSINESS.phone`; family 0 | `leads.client.ts:21`, `seo.ts:99` (`BUSINESS.phone`); family 0 | PASS |
| E-82 | JSON-LD | `telephone` values | all `+61 469 800 685` | 18 HTML files; 1 `telephone`, `+61 469 800 685`; other values 0 | PASS |
| E-83 | Network exposure | Family and public pages | 0 matches; ≥ 10 responses; console 0 | 41 responses (student 13, parent 26, signed out 2) across 13 pages; matches **0**; console 0, hosted 0, 4xx 0 | PASS |
| E-84 | Privacy page | P and D | heading 1, old 0, unique; exact sentence once, after the anchor; rest unchanged; old phrases 0; `October 2026`; 1 `h1`; **1 robots meta**; console 0 | Both: "Portal accounts" 1, old 0, unique; the exact S3 text once, right after "…sign-in times."; the rest of the section equals `develop`'s text; old phrases 0 / 0; `Last updated: October 2026`; 1 `h1`; console 0, hosted 0. Robots meta: D **1**, P **0**. On production, indexable pages carry no robots meta; item 1 recorded that as the expected value (TSR-item-1 N-10, N-57: "robots meta 0") | **FAIL (plan expectation; ruling R5)** |
| E-85 | Privacy in the build | Prerendered HTML | 1; 0; ≥ 1; 1; 0 | 1; 0; 1; 1; 0 | PASS |
| E-86 | No draft marker | Diff, build, docs | 0; 0; ≥ 1 | 0; 0; 1 | PASS |
| E-87 | Public sweep | 14 URLs × 2 | 200; console 0; overflow 0; 1 `h1`; **1 robots meta**; hosted 0; production `robots.txt` | 28 loads: all 200, console 0, overflow 0, 1 `h1`, hosted 0; robots meta **0** on all (as E-84 and item 1 N-57); `robots.txt` has the production rules (`Disallow: /portal`, `Sitemap:` line) | **FAIL (plan expectation; ruling R5)** |

### Phase 6 — close-out

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-90 | Data restore | Back to the seed | `diff` empty; `e2e-%` 0; `t`; `t`; ports free | X6 restored; X3/X8 deleted; `diff snapshot-start snapshot-end` **empty**; `e2e-%` 0 (profiles and `auth.users`); `inactive@` banned `t`; `tutor@` active `t`; 5173 and 4173 free; emulator stopped, `adb` forwards removed | PASS |
| E-91 | Console and hosted total | All legs | 0 except A1 (1) and A2 (2 + 1); hosted 0 | 88 Chromium legs plus 2 emulator legs. Console lines: only E-42 (1, A1), E-51 (2, A2), E-53 (1, A2). `pageerror` 0. Hosted **0** in total | PASS |

**Pass rate:**
- As frozen, read literally: **69/75 = 92.0%**. The six not passed are E-05, E-07, E-60, E-72, E-84 and E-87.
- If the team lead accepts rulings R1–R5 below: **75/75 = 100%**.

**Defects open:** none. No `BUG-13` was filed. Each of the six failures is a mistake in the plan's expected value: the build behaves as intended and as earlier items recorded. So none of them is a Developer fix.

### Rulings needed (team lead)

Each item says why the case failed, what the measurement shows, and the proposed ruling. A frozen case isn't weakened here. If a ruling is accepted, this TSR records it, and the plan's wording is fixed in a later revision. If one is refused, the case stays FAIL, and it needs a plan change and a new round.

- **R1 (E-05).** The `supabase.co` string is supabase-js's own host allow-list in the vendor bundle (`dist-DvjAMUvs.js`). It's byte-identical to the `develop` build item 3 tested, and it isn't a configured URL. The hosted-ref check (`unzjnxctkyahtmrkinyr` = 0) and the browser count (0 `supabase.co` requests) both pass.
  - Proposed: PASS. The correct expectation is "0 files outside the supabase-js vendor literal".
- **R2 (E-07).** The two `complete_onboarding` hits are comments in the new migration. No function is redefined.
  - Proposed: PASS, with the grep narrowed to `function public.complete_onboarding`.
- **R3 (E-60).** Every wrong-role leg sent only the layout's access read: no refused request, no 4xx and no console line. No staff number reached the DOM. The 1996c62 fix is verified.
  - The four "response body" hits are the tutor's own number, loaded on the tutor's own home during sign-in, and the admin's authorised staff list. Neither is a disclosure to a wrong role.
  - Proposed: PASS, scoping the body check to responses after the navigation under test, and to non-admin legs.
- **R4 (E-72).** The focused field is `TYPE_CLASS_PHONE`. Android reports `0x4003` because Chrome sets an extra flag bit. `mInputShown=true` on both pages, and the screenshots show the dial-pad keyboard.
  - Proposed: PASS, with the check read as "class bits `0x3`".
- **R5 (E-84 P leg, E-87).** Production public pages are indexable, so they carry no robots meta. Item 1 recorded 0 as the expected value (N-10, N-57). The dev server's 1 is right too. The real BUG-1 regression check is "never more than one", and that holds: 0 on P, 1 on D, never 2.
  - Proposed: PASS, with the expectation "≤ 1, and 0 on production public pages".

**Team lead rulings (2026-10-26):** R1–R5 are accepted. In each case the frozen wording measured the wrong thing, and the intent of the case is met and measured:
- **R1:** no hosted ref, and 0 hosted requests.
- **R2:** no function is redefined.
- **R3:** no number is shown to the wrong role, and no refused request is made.
- **R4:** the phone keypad class is used.
- **R5:** there is never more than one robots tag.

The strict rules are unchanged: every other leg still had 0 console errors (apart from A1/A2) and 0 hosted requests. The plan wording will be corrected in a later revision. **Round 1 under the rulings: 75/75 = 100 %.** The full check is green.

## Verdict

**APPROVED (auto).** 75/75 under rulings R1–R5, with the full check green. Merged to `develop` and pushed by the team lead. Saurabh's B17 approval of the Privacy wording is a release gate (go-live), not a `develop` gate.

## Not covered

1. **Hosted:** the migration on the hosted project and the live `/privacy` check are Saurabh's release steps. Not run.
2. **iOS Safari keypad:** only Android Chrome was driven (E-72). The `type="tel"` signal is the same.
3. **Screen reader:** `aria-describedby` links were measured (E-43, E-47). VoiceOver output wasn't listened to.
4. **Looks:** the E-70/E-71 (8) and E-72 (2) screenshots are in `evidence/` for Saurabh. The cases passed on measured contrast, overflow and line counts.
5. **Other admin pages (dev notes §7 follow-up):** pages beyond staff, staff member and activity (classes, emails, posts…) weren't checked for wrong-role reads. Out of item 4's scope; E-60 covered the three named pages.
6. **B17 / Q7:** approving the Privacy wording is Saurabh's, and it's still pending.
