# 05 — Developer notes: item 4 (staff phone on My profile, plus the Privacy update)

> **Stage:** 5 of /deliver (Developer) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy`
> (worktree `aj_classes-items-4-9`, cut from `develop` @ `fb738ea`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 4 (AC-4.1–4.10), [02b](02b-architecture-items-4-8.md) §4,
> [03b](03b-design-items-4-8.md) §0 and §4, [04b](04b-plan-items-4-8.md) §0 and T4.0–T4.10.
> **Next:** T4.11 Reviewer (`review-5-item-4.md`), then T4.12 Tester, T4.13 Security and T4.14 `/test-and-ship`.
> Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`). Nothing touched the
hosted project. I didn't read `supabase/.env.deploy`, and I didn't run `link`, `db push` or
`functions deploy`. Every build used the local exports from 04b §0. 0 browser requests went to
`supabase.co`.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T4.0 Stack from this worktree | Done | `pnpm install --frozen-lockfile && pnpm db:stop && pnpm db:start && pnpm db:reset`. Check 1 printed `1`. Check 2 printed `20261025110100`. Check 3 (`db:types` + `git diff --exit-code`) exited 0 |
| T4.1 Grant and validating trigger | Done | Migration steps 1–2; `staff_phone.test.sql` covers AC-4.2, 4.3, 4.4 and 4.7. `onboarding.test.sql` is green |
| T4.2 `updated_at`, audit, grants | Done | Migration steps 3–5; AC-4.6, `updated_at` and no-execute cases. Mutation check: with the role check and the audit `phone` column removed, 10 of the 47 tests fail (`phone_required` ×3, family `invalid_input` ×2, family-phone count, audit ×4) |
| T4.3 Browser phone rule | Done | `validateProfilePhone` and `validateProfile(values, savedPhone)`. 4 new unit cases |
| T4.4 Server error keys | Done | `phone_required → phoneRequired`. Test covers that key and `invalid_phone` |
| T4.5 The phone field, end to end | Done | Service, types, `TextInput` `tel`/`inputMode`, the form field after Full name, `ProfileForm.test.tsx` (7). Browser: §3 |
| T4.6 Privacy | Done, one deviation (D1) | Heading `'Portal accounts'`, the 03b §4.6 sentence word for word. `privacy.test.tsx`: 2 tests renamed, 2 added |
| T4.7 Docs | Done | `docs/requirements/invite-onboarding.md` "Fields" |
| T4.8 Manual passes (scripted) | Done, one deviation (D2) | §3 |
| T4.9 Full check | Done | §2 |
| T4.10 Dev notes | Done | This file |
| T4.11–T4.14 | **Not started** | Reviewer, Tester, Security, `/test-and-ship` |

I didn't tick 04b. The Manager owns that file while this stage runs.

## 2. Commits and full check

Commits (oldest first; the Manager's 04b commits in between aren't listed):

1. `2d418fe` feat(profiles): let staff and admins change a staff phone, normalised and audited by name
2. `4a0a417` feat(profiles): explain a refused or removed staff phone
3. `c7b3921` feat(profiles): add the phone field to My profile and the admin staff page
4. `9f625b8` feat(privacy): say we keep staff phone numbers and rename the portal section
5. `d6d4d85` docs(onboarding): note that staff and admins can change a staff phone later
6. This file (docs commit).

T4.3 shipped in commit 3, not on its own. `validateProfile` reads the new
`ProfileChanges.phone`, so splitting it out would leave a commit that doesn't typecheck.

The full check, from the repo root with the 04b §0 exports
(`VITE_SUPABASE_URL=http://127.0.0.1:55321`, the local publishable key, and the Turnstile test key):

| Step | Result (on `develop` @ `182e44a`, per 04b §0) |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` | Pass |
| `test` | **50 files, 412 tests** (398 tests) |
| `VITE_APP_ENV=production pnpm build` | Pass |
| Hosted refs: `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client \| wc -l` | **0** |
| `db:test` | **14 files, 501 tests, PASS** (13 files, 454) |
| `test:functions` | **169 `ok`, 0 failed**: account-admin 49, leads 30, notifications 90 |
| E2E (external repo, `AJ_CLASSES_DIR` = this worktree, `VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder`) | **9 passed** (1.6 min). This includes invite onboarding, so `complete_onboarding()` still works with the new trigger in place |
| `db:types` after the migration | No diff (`phone` was already a column) |

My first E2E run gave 8 failures. That was my mistake: I had unset the Supabase exports in the
subshell, so the dev server started by global setup had no Supabase config and showed "Sign-in
isn't available". With the 04b §0 exports set, it passed 9/9. 04b §0 already says to run it from a
build terminal; this note is for whoever runs it next.

`kinet validate` couldn't run: KINET isn't initialised in this worktree, and I didn't run
`kinet init`. Instead I grepped the changed TS/TSX files for `console.log`, `style={{`, `: any`,
`TODO`, `fetch(` and DOM queries. The only match is the existing first-error
`document.getElementById(...).focus()` in `ProfileForm.tsx`. It was already there, and 03b §4.4
keeps it.

## 3. Browser pass (T4.8; dev server :5173, Chromium via Playwright, scripted)

I drove `tutor@local.test` on My profile and `admin@local.test` on Admin → Staff → Local Tutor.
I did this at 1280 and 360 px, in light and dark (`colorScheme` emulation; the portal's default
appearance is "system"). That's 8 runs.

| Check | Result |
|---|---|
| AC-4.1 pre-fill | Seed `+61400000000` shows as `0400 000 000`. Later runs show the last saved value, formatted (`0412 345 678`, `(03) 9876 5432`) |
| AC-4.1 / 4.10 input | `type="tel"` and `inputmode="tel"` in every run |
| AC-4.2 save and reload | Tutor saves `0412-345-678` → "Profile saved." → reload shows `0412 345 678` (4/4) |
| AC-4.3 browser check | `12345` (tutor) and `abc` (admin) show "Please enter an Australian phone number, like 0412 345 678." on the field. Focus moves to the field (but see O1) |
| AC-4.4 blank | Blank over a saved number shows "Please enter a phone number. You can change it, but you can't remove it." |
| AC-4.6 admin change | Admin saves `(03) 9876 5432`. The page's `tel:` link becomes `tel:+61398765432`, and the Admin → Staff list shows `(03) 9876 5432` (4/4) |
| AC-4.6 Activity | Each admin change shows "Local Admin · Edited profile of · Local Tutor · Fields: phone". The page text has no digits of the number. DB: 4 `profile_edited_by_admin` rows with `phone`, and 0 with any digit in `details` |
| AC-4.10 layout | 0 px sideways overflow in all 8 runs. Field width: 640 (tutor) / 1022 (admin) at 1280; 328 / 294 at 360 |
| AC-4.10 legibility | Light: text `#172033` on white, hint `#4B5563`, error `#B91C1C`. Dark: text `#E2E8F0` on `#0B1220`, hint `#A6B3C7`, error `#F87171`. All of these are well above 4.5:1. I also looked at the field screenshots at 360 px in both appearances |
| AC-4.10 line counts | At 1280: hint 2 lines, error 1. At 360: hint **3 lines**, error 2 (see O2) |
| AC-4.8 build grep | D2 |
| AC-4.8 code grep | In `public-*.ts`, `*.client.ts`, `sitemap*` and `seo.ts`, the only `phone` hits are `leads.client.ts` (the enquiry form's own phone field) and `seo.ts`'s `BUSINESS.phone` (JSON-LD `telephone`). Neither is a profile phone |
| Requests to `supabase.co` | 0 |

The screenshots are in the session scratchpad, not the repo: `phone-field-error-{light,dark}-360.png`,
`tutor-invalid-*`, `admin-invalid-*`.

**Observations (not changed, outside item 4's scope):**
- **O1. Focus doesn't scroll the field into view.** When the browser check fails, focus moves to
  the first bad field, but in Chromium the page stays scrolled down at the Save button. The field
  ends up 477 px above the viewport. `develop` does the same with Full name (672 px above), and it
  happens on both mobile and desktop viewports. So item 4 didn't cause it. It's a one-line fix
  (`scrollIntoView` with the focus, or `focus()` after the errors render). Worth a ticket.
- **O2. The phone hint wraps to 3 lines at 360 px.** The wording is the PO's (AC-4.1, 03b §4.5).
  It's legible, but it's the longest hint on the form. If Saurabh wants 2 lines, a shorter version
  would be "So AJ Classes can reach you. Only admins see it; it's never on the website." That needs
  the PO or Saurabh to agree, so I didn't change it.

## 4. Deviations and `[ASSUMPTION]`s

- **D1. No code comment change in `PRIVACY`.** 03b §4.6 asks for the existing comment ("Wording
  for the owner to review") to gain "and the staff phone sentence (item 4)". AC-4.9 and this
  stage's brief both say `PRIVACY` gets no approval comment. So I left the existing comment exactly
  as it was and added nothing. Approval is tracked only as B17 / Q7.
- **D2. The AC-4.8 build grep needs a narrower pattern.** The 03b §4.7 / 04b T4.8 pattern
  `412345678|0412 345 678|398765432` gets **1 hit** on the gate build, in
  `assets/constants-*.js`. The hit is the example in the existing error messages
  `PORTAL_ERRORS.invalidPhone` and `PORTAL_VALIDATION.phoneInvalid` ("…like 0412 345 678."), which
  were already on `develop`. It isn't a staff number. I ran the check with the numbers actually
  stored on the local staff profiles at build time (tutor `+61398765432`, seed `+61400000000`):
  - `398765432|9876 5432|400000000|0400 000 000` → **0 files**;
  - `412345678` (the `+61` form) → 0 files;
  - `0412 345 678` anywhere except the "phone number, like " example → 0;
  - every prerendered `.html` file with any of these → 0.

  **For the Tester (T4.12):** use a number that isn't `0412 345 678`, or exclude the example text.
  The build is static and reads no profile at build time, so this grep is a guard against someone
  hard-coding a number, not a data check.
- **D3. `PRIVACY.lastUpdated` is unchanged.** It already says "October 2026", which is the build
  month. If the release slips into November, 04b risk 6 (the release step) updates it.
- **D4. Two extra pgTAP cases** beyond 03b §4.7:
  - a whole-form save with a bad phone refuses the name too (the database side of AC-4.5);
  - an admin saving a family profile with a blank phone still saves its other fields. A blank
    field is "no change", so the family `invalid_input` rule never blocks an unrelated edit.
- **D5. Extra unit case:** a browser-side blank over a saved number (`ProfileForm.test.tsx`
  "refuses clearing a saved number in the browser"), alongside the server-side `phoneRequired`
  case 03b lists.
- **D6. In the AC-4.5 component test, the phone is typed, not cleared.** 03b says "edit bio and
  phone, `onSave` → `fail('phoneRequired')`". Clearing a saved number is caught in the browser
  before `onSave`, so the test types a valid number and lets the mocked server refuse it. That
  still proves the bio edit and the typed phone survive a server refusal.
- The 03b `[ASSUMPTION]` holds: the admin staff page shows the same "you" hint, because it's the
  shared form.

## 5. What I didn't verify

1. **That the phone keypad really opens.** I checked `type="tel"` and `inputmode="tel"` in the DOM.
   Headless Chromium shows no on-screen keyboard, so the keypad itself needs a real iOS or Android
   device, or a look in Chrome device mode (Tester, T4.12).
2. **The hosted migration.** Saurabh runs it at release (03b §4.8). I didn't check whether hosted
   staff rows hold a phone that `normalise_au_phone` would change. It can't matter: the trigger only
   runs on an `UPDATE OF phone`, and the check constraint has only ever allowed `+61…` values.
3. **The admin at aal1 in the browser.** The pgTAP test covers it (0 rows). The UI path asks for
   two-step before the page opens, so I didn't drive it.
4. **Held item 2 merge conflict.** As 03b §9 expects, item 2 will conflict on the `PRIVACY` portal
   text and on its tests' old heading. Whichever merges second keeps both sentences and uses
   `'Portal accounts'`.
5. **Screen-reader output.** Hint and error are linked through `aria-describedby` (asserted in
   `ProfileForm.test.tsx`), but I didn't listen to them with VoiceOver.

## 6. Release steps for Saurabh (from 03b §4.8)

1. B17: approve the Privacy sentence and the heading change (Q7, batched with items 2 and 3).
2. Hosted migration `20261026100000_staff_phone_edit.sql` (`supabase db push`, or `deploy.sh`,
   which pushes migrations first). No function deploy.
3. Merge to `main` per the 04b §1 rule 4 precondition. Items 1 and 3 must be released first or in
   the same run.
4. Read-only check: `curl -s https://ajclasses.com.au/privacy | grep -c "For tutors and other staff"`
   should print `1`.
