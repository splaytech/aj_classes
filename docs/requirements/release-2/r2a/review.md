# R2a — Tutor & Admin Logins: Verification and Gap Review

> **Date:** 6 Oct 2026 · **Result:** 44 gaps found in the first draft and fixed in the design and stories. A second check found 14 more problems, also fixed. Build step 1 (the database, run against a real local Supabase) found 6 more (V15–V20), fixed in the docs before going on. 10 behaviours still need confirming while building (spikes SP1–SP10 in design §19). 6 questions are open for the owner, and none of them blocks starting.
> **Design:** [design.md](design.md) · **Stories:** [stories.md](stories.md) · **PRP:** [../PRP.md](../PRP.md#r2a--tutor--admin-logins)

## 1. What Was Reviewed, and How

**Input:** the first R2a draft in the PRP (6 Oct 2026: 5 decisions, 10 stories, FA1–FA5), the owner's answers (6 Oct 2026), the rest of the R2 PRP, `arch.md`, `budget.md`, the current web app (`apps/web`), and the Supabase docs and CLI config (CLI 2.99.0, `supabase-js` 2.117).

**Four checks:**

1. **Requirements.** Does every owner need and PRP item have a story? Is every lifecycle state covered (invited, joined, deactivated, returning, leaving, locked out)?
2. **Security.** Checked against OWASP ASVS (v4 L2) chapters on authentication (V2), sessions (V3), access control (V4), input and output (V5), stored data (V8), files (V12) and configuration (V14), plus Supabase-specific traps (default grants, `security definer`, user metadata, service keys).
3. **Design.** Does it fit the static pre-rendered site, the house rules, both hosts and the free tiers? Is every failure path defined?
4. **Traceability.** Every story → design section → test (§4 below). Done after the fixes, as a second check.

## 2. Gaps in the First Draft, and the Fixes

Type: **REQ** = requirement, **SEC** = security, **DES** = design, **OPS** = operations.

| ID | Type | Gap found | Fix | Where |
|---|---|---|---|---|
| G1 | SEC | Supabase gives `anon` and `authenticated` full table privileges by default. RLS limits rows but not columns, so a user could update any column of their own row. | Revoke all, then grant `select` and `update` on named columns only. RLS on for every table. | Design §7.1 · US12 AC5 |
| G2 | SEC | A trigger that reads the role from user metadata would let users make themselves admin (metadata is user-editable). | The trigger only reads `full_name`. Role always starts as `tutor`. `role` and `is_active` change only through admin functions. | Design §6.2, §6.3 |
| G3 | SEC | The draft required admin two-step in the UI only. An admin's stolen password would still open admin data through the API. | `is_admin()` requires `aal = 'aal2'` in SQL. The edge function checks it too. Password reset gives only `aal1`. | Design §4.2, §6.1 · US5 AC5, US7 AC7 |
| G4 | SEC | "Last admin can't be removed" had a race condition: two admins demoting each other at once could leave none. | Advisory transaction lock in both guard functions. | Design §6.3 · US16 AC3 |
| G5 | SEC/DES | Standard email links break when mail scanners open them first, and PKCE links fail in a different browser. Invites don't support PKCE at all. | Token-hash links to our own page, with a **Continue** button that does the verify. | Design §9.1 · US2 AC1 |
| G6 | REQ | No plan for an admin who loses their phone. Supabase has no backup codes. | Up to 2 authenticators, reset by another admin, a backup admin (Q2), break-glass runbook. | Design §4.2, §16.3 · US9, US10 |
| G7 | SEC | `?next=` after sign-in was an open redirect risk. | `safeNextPath` accepts only same-site `/portal/…` paths. | Design §11.3 · US3 AC5 |
| G8 | SEC | Password guessing on login, and reset-email bombing. | Turnstile captcha on login and forgot-password, the Supabase rate limits, a 60 s gap between emails. | Design §8 · US3 AC1, US5 AC2 |
| G9 | REQ | The subject list isn't confirmed (owner, 6 Oct). A database enum would need a migration for every change. | Keys in a text array, labels and list in constants, placeholder until confirmed. Unknown keys kept and hidden. | Design §5 · US12 AC6 |
| G10 | SEC | A 10-character minimum is weak for tutors, who sign in with a password only. The leaked-password check is Pro-only. | Minimum 12, no composition rules. Leaked-password check listed under Q5. | Design §8 · US2 AC3 |
| G11 | SEC | After deactivation, the user's access token stays valid for up to 1 hour. | RLS checks `is_active` on every request (data access is cut immediately), the ban stops refresh, and the client signs out when it can no longer read its profile. | Design §6.1, §10, §11.3 · US17 AC2 |
| G12 | SEC | Token-hash links put the token in the URL (analytics, history, server logs). | Strip it with `replaceState` after verify, no analytics on `/portal`, existing `strict-origin-when-cross-origin` referrer policy. Tokens are single-use and expire in 1 hour. | Design §9.1, §13.3 · US2 AC2 |
| G13 | SEC | `security definer` functions in `public` are callable by anyone, and are open to `search_path` attacks. Postgres grants `EXECUTE` to `PUBLIC` by default. | Helpers in a `private` schema, `search_path = ''`, revoke from `public` and `anon`, explicit grants. | Design §6 |
| G14 | SEC | Nothing stopped the service (secret) key from reaching the browser bundle. | No `VITE_` prefix for secrets, `.env` files ignored, a build check that fails on secret patterns. | Design §14.1 · NFR2 |
| G15 | SEC | Edge function caller checks and CORS weren't specified. | Exact origin allowlist, POST only, JWT + `aal2` + active admin check, input validation. | Design §10 |
| G16 | SEC | Bio and qualifications are free text that will be shown on screens (and the public site later). | Always rendered as text, never HTML. ESLint `react/no-danger`. | Design §5, §11.7 · US12 AC4 |
| G17 | SEC | Login and reset messages could reveal which emails have accounts. | One message for a wrong email or password. Forgot-password always gives the same answer. "Not active" shows only after a correct password. | Design §11.4 · US3 AC2, US5 AC1 |
| G18 | SEC | Photo uploads: SVG/HTML could carry script, large files cost storage, and users could write into other folders. | Bucket limits (JPEG/PNG/WebP, 2 MB), own-folder policies, a database check on `avatar_path`. | Design §7.3 · US13 |
| G19 | SEC | Nothing tells the account owner if someone else changes their password or two-step. | Supabase security notification emails turned on. | Design §8 · US5 AC4, US7 AC4, US9 AC4, US10 AC2 |
| G20 | SEC | Private pages could be indexed, and analytics would record staff URLs. | `noindex` header and meta, `robots.txt` Disallow, no analytics under `/portal`. | Design §13 · US20 AC4 |
| G21 | DES | Private routes were spread over many top-level paths, which meant many rewrite rules and header rules per host. Also: `budget.md` plans Cloudflare Pages, but the owner said Railway + Vercel. | Everything under `/portal`: one rule per host. Cloudflare rule written down in case it is chosen (Q3). | Design §11.1, §13.1 · US20 AC3 |
| G22 | SEC | Sessions are stored in `localStorage`, so XSS could steal them, and there was no CSP. | CSP on `/portal/*` with strict `connect-src`, `img-src`, `frame-src` and `frame-ancestors`. Hash-based scripts later (R2 hardening). No third-party scripts on portal pages except Turnstile on two pages. | Design §13.2 · NFR7 |
| G23 | DES | A top-level Supabase client would (a) add `supabase-js` to every public page, and (b) crash pre-rendering when env vars are missing. | `getSupabase()` creates the client on first use. A build check confirms public chunks don't include it. | Design §11.4 · NFR3 |
| G24 | SEC | "Cancel invite" deletes an account, which could wipe someone who had already joined. | Allowed only if they never confirmed **and** never signed in. Checked in the function. | Design §10 · US15 AC3 |
| G25 | SEC | After a reset or password change, other sessions (e.g. on a stolen laptop) stayed signed in. | `signOut({ scope: 'others' })` after any password change. | Design §11.4 · US5 AC4, US6 AC3 |
| G26 | DES | Deactivation touches two systems (database and auth ban). A half-finished action wasn't defined. | Order chosen so a half-finished action always leaves **no** access. | Design §10 `set-active` |
| G27 | DES | Guard behaviour wasn't defined beyond "redirect or forbidden". | Eight-row decision table in one tested pure function. | Design §11.3 · US20 |
| G28 | DES | Matching Supabase error **messages** is fragile. | Map error **codes** in one file. Texts in `error.constants.ts`. | Design §11.4 |
| G29 | DES | A role or status change, or a sign-out in another tab, could leave a stale UI. | Cache cleared on every auth event. `SIGNED_OUT` sends every tab to login. | Design §11.3 · US4 AC3 |
| G30 | DES | A missing env var could break the public site, or show a broken login. | `features.portal` off unless all portal env vars are set. Friendly "not available" page. | Design §11.6 · US21 |
| G31 | SEC | A tutor promoted to admin would have admin powers without two-step. | Admin powers need `aal2` (G3), and the guard forces setup. | Design §4.2 · US7 AC6 |
| G32 | REQ | Invite links expire after 1 hour, and there was no "invited / expired" state or way to resend. | Derived statuses, **Resend invite**. | Design §5, §10 · US14, US15 |
| G33 | REQ | An invite sent to a mistyped email couldn't be fixed (D5 said "never delete"). | **Cancel invite** for never-joined accounts. D5 amended. | Design §10 · US15 AC2 |
| G34 | DES | Re-uploading a photo to the same path shows the old cached image, and replaced files are left behind. | Unique file names, delete the previous file after saving. | Design §7.3 · US13 AC3 |
| G35 | REQ | No way to change your password while signed in. | Account page → Change password. | Design §11.4 · US6 |
| G36 | REQ | Admins need to tidy tutor bios before they go on the website. | Admin can edit any staff profile; audited. | Design §6.2, §7.2 · US18 |
| G37 | SEC/REQ | No record of who invited, promoted or deactivated whom. | `audit_log` table, written only by functions, read only by admins. | Design §5, §6.3 · US19 |
| G38 | REQ | Owner answers (6 Oct): Ajay is admin + tutor; profiles need bio and qualifications; admins need two-step. | One `admin` role includes tutor powers. `bio`, `qualifications` fields. Two-step for admins. | Design §4, §5 · US7–US12 |
| G39 | REQ | The draft said "Admin → Tutors", but admins are staff too and must be listed. | "Staff" list with a role column. | Design §11.1 · US14 |
| G40 | OPS | Free Supabase projects pause after 1 week idle, have no backups, and have no session timeouts. | Runbooks, plus Pro before real use raised as Q5. | Design §16 · NFR8 |
| G41 | DES | RLS was "covered by tests" with no plan for how. | pgTAP tests per matrix row, run with `pnpm db:test`. | Design §15 |
| G42 | REQ | Email changes weren't specified (Supabase lets a signed-in user request one). | Out of scope in the UI. Double confirmation is on, and triggers keep the profile in sync. | Design §1, §6.2, §8 |
| G43 | SEC | Sessions persist on shared computers. | **Accepted risk** for R2a: clear Sign out, cross-tab sign-out. Inactivity timeout needs Pro (Q5). | Design §1 |
| G44 | DES | Two-step makes local testing slow, and seed data must never reach a remote project. | Local-only seed users, generated TOTP in E2E, `db push` never runs the seed. | Design §15, §16.1 |

**Decision changes caused by the review:**
- **D5** "never delete accounts" now has one exception: a never-joined invite can be cancelled (G33).
- Private routes moved from `/login`, `/tutor`, `/admin` to `/portal/...` (G21).
- Password minimum moved from 10 to 12 (G10).
- The admin page is "Staff", not "Tutors" (G39).

## 3. Second Check (after the fixes)

The finished design and stories were checked again, story by story and section by section. Problems found, all now fixed:

| ID | Problem | Fix |
|---|---|---|
| V1 | Design §10 used an `am_i_admin()` RPC that §6.3 didn't define. | Added to §6.3. |
| V2 | `admin_log` was "not granted to authenticated" but its caller wasn't stated. | Granted to `service_role` only. |
| V3 | The `profiles_audit_admin_edit` trigger runs as the editing user, who can't insert into `audit_log`. | Trigger function is `security definer`. |
| V4 | Gap tags in the design pointed to the wrong IDs in three places. | Re-tagged to G12, G19 and G22. |
| V5 | The CSP allowed Google Fonts, but the site doesn't load any web fonts. | Removed. |
| V6 | `features.portal` ignored the Turnstile site key. With captcha on in Supabase, login would always fail. | All three env vars are required. |
| V7 | If an inactive user's page stays open, their next data call returns nothing, and the UI didn't say what happens then. | "Signed in but no readable profile" counts as inactive: sign out. |
| V8 | US20 said E2E would test Vercel rewrites with `vite preview`, which ignores `vercel.json`. | E2E tests the Railway config through `serve`. Vercel is checked by hand after deploy. |
| V9 | NFR4 used axe through Vitest, which isn't installed. | Axe runs in Playwright (`@axe-core/playwright`). |
| V10 | US1 assumed a failed invite email leaves a visible pending account. Supabase's behaviour isn't known. | Wording covers both cases. Added to SP1. |
| V11 | Choosing between two authenticators at sign-in wasn't designed. | Choice by name in US8 AC2 and design §11.4. |
| V12 | An admin could remove their **last** authenticator and then be stuck. | Blocked (US9 AC3) and in the design. |
| V13 | The number of TOTP attempts allowed wasn't known. | SP10. |
| V14 | Actions for pending invites versus joined staff overlapped (deactivate a pending invite?). | Pending: resend / cancel only. Joined: role / deactivate. |

### 3.1 Found while building step 1 (local Supabase, 6 Oct)

| ID | Problem | Fix |
|---|---|---|
| V15 | The admin functions checked "caller is admin" **before** taking the lock. Two admins demoting each other at once could both pass the check and leave no admin. | The lock is taken first, then the caller is checked. |
| V16 | Storage trusts the declared file type (an SVG sent as `image/png` is accepted), and phone photos carry GPS location in EXIF. | The browser resizes and re-encodes every photo as WebP before upload. |
| V17 | `[auth.email] enable_signup = false` turns off **email sign-in** as well, not just sign-up. | Only `[auth] enable_signup = false`. Checked: sign-up is refused, sign-in works. |
| V18 | A banned account gets `user_banned` even with a wrong password, so "Your account is not active" would reveal deactivated emails. | Banned shows the generic sign-in message. |
| V19 | Supabase ignores `current_password` on a password change, and refuses a change from a password-only session when two-step is on. | Change password uses an emailed re-authentication code. Set-password asks for the authenticator code when two-step is on. |
| V20 | Two-step codes: no attempt limit in the local stack; hosted is 15/min per IP; the lockout hook needs the Team plan. | Accepted risk (§5), with the reasoning recorded. |

### 3.2 Found while building steps 2–5 (web sign-in, 7 Oct)

Tested in the browser against the local stack: guards, tutor and admin sign-in, two-step setup and code step, forgot password with a scanner-style pre-fetch, used links, change password, sign-out across Back, production build served like Railway.

| ID | Problem | Fix |
|---|---|---|
| V21 | Supabase checks the emailed re-authentication code **only for sessions over 24 hours old**. A wrong code was accepted on a fresh session, so asking for it every time proved nothing. | Ask for the code only when Supabase requires it. Accepted risk for fresh sessions (§5). Verified: an aged session refuses a wrong code and accepts the right one. |
| V22 | The default magic-link email would give staff a password-free (and, for admins, code-free first step) way in, since Supabase still sends magic links to existing users. | Magic-link template carries no token; it points to the sign-in page. |
| V23 | On Railway (`serve`), header rules match the rewritten file, so the `/portal` CSP and `no-store` weren't sent. | Header rule targets `__spa-fallback.html`. Verified with `curl`. |
| V24 | A stored session for an account that no longer exists (e.g. a cancelled invite) has no readable profile. | Treated like deactivated: signed out, "account not active" shown. Checked after a local reset. |

### 3.3 Change request CR1: skip two-step when developing locally (7 Oct)

Checked before building, as for every change:

| Check | Result |
|---|---|
| Can it reach staging or prod? | No. The authenticator key exists only in `seed.sql` (never pushed) and `.env.development.local` (git-ignored, ignored by `pnpm build`). The code runs only under `import.meta.env.DEV`, which production builds set to `false`. Verified: the production build contains neither the key nor its variable name; the inert code generator remains. |
| Does it weaken a rule anywhere? | No. The database still requires `aal2` for admin powers; the local admin really completes two-step, it is just typed for them. |
| Does it hide bugs? | Partly: the setup screen is no longer seen with the default admin. Covered by `newadmin@local.test` (admin, no authenticator). |
| Tests | Database tests unchanged (they remove the seed accounts first). New unit test of the code generator against the RFC 6238 test vector. |

Design §16.1.

### 3.4 Step 6 check before building, and testing: profile and photo (8 Oct)

Re-read US12, US13 and design §5, §7.3, §11.5 against the database already built.

| ID | Gap | Fix |
|---|---|---|
| V25 | Phone photos can be 10–30 MB, and iPhones take HEIC, which most browsers can't decode. | The file picker accepts JPEG, PNG and WebP only (iPhones then hand over a JPEG). Files over 15 MB are refused before resizing, so the browser doesn't run out of memory. |
| V26 | A new photo is uploaded first and the profile updated second; if the update fails, the new file is left behind. | Upload → update profile → delete the old file. If the update fails, delete the file just uploaded. |
| V27 | The database refuses blank qualification lines (`items_within_length` needs 1+ characters). | Lines are trimmed and empty ones dropped before saving. |
| V28 | Saving the subject checkboxes would silently drop saved subjects that are no longer in the list (G9 said they're kept). | Unknown keys from the loaded profile are kept on save. |
| V29 | An update that RLS filters out returns no error, just zero rows, so "Profile saved" could show when nothing was saved. | The update asks for the saved row back; no row means failure. |
| V30 | The header shows the old name after saving (US12 AC3). | After a save, the page reloads the staff layout's data. |
| V31 | The design said "photo with preview" but not when it is stored. | Choosing a photo shows a preview; **Use this photo** uploads it straight away (separate from the text form), **Remove photo** clears it, each with its own message. |
| V32 | Found while testing: after **Add a qualification** focus stayed on the button, so typing went nowhere (keyboard and screen-reader users included). | Focus moves into the new box. |

## 4. Traceability (story → design → test)

| Story | Design | Tests |
|---|---|---|
| US1 Invite | §8, §10, §12.1 | FN, E2E |
| US2 Accept invite | §9.1, §12.1 | UNIT, E2E, MAN |
| US3 Sign in | §8, §11.3, §11.4 | UNIT, E2E, MAN |
| US4 Sign out | §11.3 | UNIT, E2E |
| US5 Forgot password | §8, §9 | E2E, MAN |
| US6 Change password | §11.4, SP2 | UNIT, E2E |
| US7 Set up two-step | §4.2, §11.3, §12.2 | DB, UNIT, E2E |
| US8 Two-step code | §11.4, §12.2 | UNIT, E2E |
| US9 Manage authenticators | §4.2, §11.4 | UNIT, E2E |
| US10 Reset two-step | §10, §16.3 | FN, E2E |
| US11 Tutor dashboard | §11.1, §11.5 | UNIT, E2E |
| US12 Profile | §5, §7, §11.5 | DB, UNIT, E2E |
| US13 Photo | §7.3 | DB, UNIT, E2E |
| US14 Staff list | §5, §6.3 | DB, UNIT, E2E |
| US15 Resend / cancel | §10 | FN, E2E |
| US16 Role | §6.3 | DB, E2E |
| US17 Deactivate | §6.3, §10, §12.3 | DB, FN, E2E |
| US18 Admin edits profile | §6.2, §7.2 | DB, E2E |
| US19 Audit | §5, §6.3 | DB |
| US20 Private pages | §11.3, §13 | UNIT, E2E, MAN |
| US21 Portal off | §11.6 | UNIT, build |
| US22 Emails | §8, §9.2 | MAN |
| NFR1–8 | §4.3, §13, §14, §15, §16 | DB, build, lint, E2E, MAN |

Every design section is used by at least one story. Every requirement in the first draft (FA1–FA5) maps to a story.

## 5. Accepted Risks

| Risk | Why accepted | Revisit |
|---|---|---|
| `'unsafe-inline'` scripts in the portal CSP | React Router inlines its start-up script. The strict connect/img/frame rules still block the main ways to send data out. | R2 hardening (hash-based CSP) |
| Sessions in `localStorage` | Needed by a static site with no server. Mitigated by CSP, no `dangerouslySetInnerHTML`, no third-party scripts. | If a BFF ever appears |
| No inactivity timeout | Pro feature. Mitigated by sign-out and sign-out everywhere on password change. | Q5 |
| Up to 1 hour before a deactivated user's open page notices | Their data access stops immediately (RLS). Only the page shell stays. | — |
| No leaked-password check | Pro feature. Mitigated by the 12-character minimum, captcha and rate limits. | Q5 |
| A fresh session (under 24 h) can change the password without an emailed code (V21) | Supabase's rule. Whoever holds a fresh session can already do everything the account can. The owner gets a "password changed" email, other sessions are signed out, and a reset by email takes the account back. Admins' sessions are also two-step. | If a shared-computer problem is ever reported |
| Two-step codes can be guessed at up to 15 a minute per IP (V20) | Guessing needs the admin's password first (12+ chars, captcha, rate limited). Even then, about 3 in a million codes are valid per try. Admins are asked to use a password manager. The lockout hook needs the Team plan (≈ US$599/mo). | If an admin account is ever targeted, or on a plan change |
| Free-tier pause and no backups | Cost goal. | Q5, before real family data |

## 6. Open Questions for the Owner

| # | Question | Default if no answer | Blocks |
|---|---|---|---|
| Q1 | Which subjects go in the list? (Maths, English, Reading, Writing, Numerical Reasoning, Verbal Reasoning, Interview Preparation…?) | Placeholder list marked "to be confirmed" | Nothing. It's a constants change. |
| Q2 | Who is the **backup admin**? (Recommended: the developer's own account.) | Developer account | Two-step recovery (US10) |
| Q3 | `budget.md` plans **Cloudflare Pages** (Vercel Hobby doesn't allow commercial use). Stay on Railway + Vercel for now? | Railway (staging) + Vercel, Cloudflare rule documented | Hosting for prod |
| Q4 | Invite and reset links last **1 hour** (Supabase's recommended default). Is that OK given admins can resend? | 1 hour | Nothing |
| Q5 | Move prod to **Supabase Pro** (≈ US$25/mo: no pausing, daily backups, leaked-password check, session timeouts) before real family data arrives? | Free until R2 lead backend | Go-live with family data |
| Q6 | Tutors' photos, bios and qualifications may later appear on the public site. Do we need tutors' written OK, like the testimonial consent? | Notice on the profile page; consent when the public display is built | Public tutor profiles (later) |
