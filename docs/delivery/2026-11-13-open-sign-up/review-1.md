CHANGES_REQUESTED

# Review — stage 1 (01-requirement.md), round 1

Facts 1–12 spot-checked in the repo (config.toml, deploy.sh, `role_from_app_metadata`, `handle_new_auth_user`, `complete_onboarding`, `my_active_role`, account-admin handlers, account.tsx, portal-access.ts, constants, posts RLS, mobile role.dart and access_state_service.dart): accurate. The problems are in the ACs and in what the doc leaves out.

1. [blocking] **AC-14 lets another person set the password on someone else's account.** "The password and kind from the newest sign-up count" + AC-17 (confirmed link signs in): owner signs up → attacker re-signs up with the same e-mail and their own password → owner clicks the newest link and is signed in, unaware the password is the attacker's → attacker can sign in to a verified account; once promoted (AC-33) it sees a child's data. Fix: no password is fixed before the mailbox is proven — either (a) the sign-up form takes no password and the confirm page asks for one after the click (like the invite flow: link → set password → active), or (b) the confirm click lands on a forced "choose your password" step before any session is usable. Rewrite AC-6, AC-14, AC-17. Add a function test: two sign-ups for one e-mail, the first link is dead, and no password chosen before confirmation can sign in afterwards.

2. [blocking] **AC-19 and AC-39 don't protect the shared e-mail quota; Decision 3 rests on a false premise.** AC-39 allows 10 sign-ups / 15 min / network ≈ 960 a day from one address; AC-19 limits resends per e-mail, not per sender. Resend Free = 100/day total; the app takes up to 70 (ADR-0004); invites go straight through Resend (DEC-IN-5); hosted `[auth.rate_limit] email_sent = 30`/hour is project-wide and pushed by config.toml. One script with rotating e-mails can use up the day's Auth e-mail, so resets, reauth codes and invites fail for everyone. Fix: AC for a site-wide daily cap on confirmation + resend e-mails (e.g. 20/day, a constant) below the Auth reserve; over the cap show a neutral "Sign-up is busy, please try again tomorrow" and send nothing. Restate Decision 3: the cap is what makes "launch on Free" safe.

3. [blocking] **Release safety must be an AC, not only Architect Q1.** `deploy.sh` step 2 runs `supabase config push` (writes `[auth]` incl. `enable_signup`, `enable_confirmations`, templates, rate limits to production); step 3 (sign-ups-off check) runs after; migrations only at step 4. Flipping `enable_signup = true` means step 2 opens production sign-up, step 3 fails, and production is left with open sign-up and the tutor-by-default trigger (fact 2) — the go-live.md §0 risk. Also contradicts release note #1 ("any hosted Auth change is done by you"). Fix: AC "production never accepts a sign-up while any migration that can create a `tutor` from sign-up is unapplied"; deploy.sh keeps refusing or is reordered (migrations first, auth settings last), with a dry-run test. Correct release note #1: hosted settings come from config.toml via `deploy.sh`; list which change.

4. [blocking] **Sign-up form rules must be enforced on the server.** With public Supabase sign-up anyone can POST `/auth/v1/signup` with any `user_metadata`, skipping kind (AC-3), name rules (AC-4), terms (AC-7), age statement (AC-9). Fix: AC that every rule in AC-3..AC-9 is checked server-side; a sign-up that skips any creates no usable account and sends no e-mail; kind, terms time and age statement are never read from user-editable `user_metadata` (rewritable via `updateUser`). Add a DB or function test that calls the API directly.

5. [non-blocking] **Mobile states missing.** (a) Promotion (AC-33..35) must also set `app_metadata.account_role` — mobile resolves student/parent only from it (role.dart); add to AC-35. (b) "Kind" must never be stored as `app_metadata.account_role = student|parent`; add to AC-40 or Q3. (c) If unverified users sit at `status = 'invited'`, mobile `my_onboarding` returns a row and shows `AccessInvitedUnfinished`; AC-40 should name the acceptable mobile screen and rule this out.

6. [non-blocking] **Promotion conflicts with a current guard.** `private.handle_auth_role_assigned()` changes role only while `status = 'invited'`. Promoting a verified active user needs a new, audited server path. Add as fact 13 and an Architect question.

7. [non-blocking] **Turning on e-mail confirmation could lock out existing accounts.** `enable_confirmations` is global; invited accounts are made with `createUser` without `email_confirm` (accounts.ts). Add to AC-42: before release, check every active and invited account still signs in with confirmation on (pending invites, Studio-created first admin, seed users).

8. [non-blocking] **AC-7 reuses `JOIN_PAGE.terms`** ("emails, SMS and calls about classes, my account and invoices") — false for a user. Sign-up gets its own terms line, cross-checked (team-lead rule 6) against AC-43 Privacy text, which must also replace "A student's account is only created after a parent or guardian agrees".

9. [non-blocking] **Decisions in the wrong owner's column.** (a) Decision 1 (role vs flag vs table) is the Architect's (Q3); Saurabh's words settle the product side. (b) Decision 5 is not a decision; drop it. (c) A9 (link only on Sign in page; header/footer deferred D10) is a product/marketing call — make it a decision for Saurabh. (d) Add an honest decision: v1 gives users nothing the public site doesn't (posts are already public, fact 8) while collecting personal data, incl. from 15-year-olds, for no current service (APP 3 "reasonably necessary"). Options: launch now as a waiting list, or hold sign-up until mock tests.

10. [non-blocking] **Untestable / ambiguous ACs.** (a) AC-12 timing: replace with "same code path + fixed minimum delay (constant)", or drop. (b) AC-26 lists avatars, but `avatars` is `public = true` (staff_accounts.sql:493) and no work-files bucket exists; reword to "cannot list or write storage objects; public avatar URLs stay public". (c) AC-6: short password shows `PORTAL_VALIDATION.passwordTooShort` client-side, not `weakPassword`; name both. (d) AC-39: "network" = salted IP hash (DEC-IN-2). (e) AC-38: Forgot password already has Turnstile — mark as regression check.

11. [non-blocking] **Dead end for an existing account holder.** AC-12 + D9: someone who forgot they have an account gets "Check your e-mail" and nothing arrives. Fix: AC-10 message adds "Already have an account? Sign in or reset your password" with links.

12. [non-blocking] **Admin view of kind during promotion.** AC-33/34 can silently turn a "Student" sign-up into a parent or vice versa. Invite/link result tells the admin "This e-mail belongs to a signed-up user (signed up as …); they will become …". Keep the audit.

13. [non-blocking] **Bloat.** Trim: AC-12 timing (10a); reactivate + Activity entry in AC-32 (deactivate only, reactivate → D6); AC-21 reuses the `/posts` list component; release blocked until Decisions 2 and 4 are answered — say so under "For Saurabh at release".

Files referenced: 01-requirement.md; supabase/scripts/deploy.sh (114–142); supabase/config.toml (174, 195–235, 482–500); supabase/migrations/20261023100000_invite_onboarding.sql; supabase/migrations/20261006004522_staff_accounts.sql:493; supabase/functions/account-admin/handlers/accounts.ts:75; apps/web/src/constants/portal.constants.ts:237; aj_classes_mobile/lib/core/domain/role.dart; aj_classes_mobile/lib/core/domain/access_state_service.dart:39–62.

## Round 2

CHANGES_REQUESTED

All 13 round-1 findings re-checked. 2, 3, 5–13 resolved. 1 resolved for passwords (no unfinished sign-up has a usable password; AC-44 tests two sign-ups for one e-mail). 4 resolved for the form. Removing the password from the form opened two gaps (items 1–2). Facts re-checked: `PORTAL_ROUTES.forgotPassword`, `invalidCredentials`, fact 13 match the code.

1. [blocking] **Age gate bypass; terms tick may not be the owner's (AC-9, 14, 17, 45).** (a) AC-17 lets kind change on the choose-password step: sign up as Parent (no age tick), switch to Student after the link — never states 15+. (b) Under AC-14 the terms and age ticks come from whoever submitted the newest sign-up, who may not own the mailbox. Fix: move the age statement and Terms checkbox to the choose-password step; store `terms_accepted_at` and age-statement time from that step; switching to Student there requires the tick; extend AC-45 to enforce on that step; add a Parent→Student switch test.

2. [blocking] **Daily cap re-opens e-mail enumeration (AC-12 vs AC-46).** If "busy" shows only when an e-mail would be sent, after the cap an existing account gets "Check your e-mail" while a new address gets "busy". Spend the cap with 15 sign-ups, then enumerate for 24 h. Fix: once the cap is reached, every sign-up and resend request gets the busy message regardless of e-mail; add a test to AC-44.

3. [non-blocking] **Decision 3 overstates the cap.** 100 − 70 = 30; 15 for sign-up leaves 15; fits under `email_sent = 30`/h. But resets, codes, invites have no cap of their own. Reword: "sign-up can never use more than 15 of the 30; resets, codes and invites share the other 15, as today."

4. [non-blocking] **AC-20 Forgot-password rule is the costlier option.** Simpler: a recovery link for an unfinished sign-up opens the same choose-password step (with item 1's ticks); removes the "I only remember Forgot password" dead end. Also `Send the link again` for a verified, password-less account can't be Auth's sign-up resend (refused for confirmed users); say it sends a choose-password link, mechanism → Architect Q2.

5. [non-blocking] **AC-12 / AC-14 overlap.** Deactivated unfinished sign-up matches both. State deactivated wins (nothing sent). Same in AC-36: an invite does not replace a deactivated unfinished sign-up without the admin seeing it.

6. [non-blocking] **Privacy text wrong while the switch is off (AC-43 vs AC-49).** Either word it to hold in both states ("by invitation, or by signing up when sign-up is open"), or publish the new text when the switch goes on. Adjust release note 1.

Item 1 is the only takeover-class issue left (consent, not access). No other takeover or dead-end states found.

## Round 3

APPROVED

All 6 round-2 findings resolved: (1) Terms + age given by the mailbox owner on the choose-password step; Parent→Student needs the tick; server-enforced; tested (AC-2, 7, 9, 14, 17, 45). (2) Cap reached → busy for every sign-up and resend; tested for new e-mail, existing account, resend (AC-46). (3) Decision 3 says only what the cap guarantees. (4) Forgot password and resend send a choose-password link for an unfinished sign-up, both counted in the cap; mechanism → Architect Q2 (AC-19, 20). (5) Deactivated wins (AC-12, 36). (6) Privacy text true in both switch states; release note 1 matches (AC-43).

No takeover or enumeration path: every link goes only to the mailbox owner; no password or consent exists before the owner acts. Cap arithmetic holds (100 − 70 = 30; 15 for sign-up; under `email_sent = 30`/h). Forgot password always shows its neutral message, so counting it in the cap reveals nothing.

Non-blocking — fold into the Architect's brief:
1. **AC-45 wording:** read as "each rule is checked where it is asked" — kind, name, e-mail, Turnstile at sign-up; name, kind, Terms, age tick, password at the choose-password step.
2. **Deactivated accounts are a dead end in v1 (AC-36 + D6):** invite refused, reactivate/delete deferred → a mistaken deactivation needs Studio. Either bring reactivate into v1 (one audited action, exists for staff) or let AC-33/34 promotion handle a deactivated finished user. Saurabh's call if not cheap.
3. **Collection notice at sign-up (APP 5):** one line linking the Privacy Policy under the sign-up button. Unfinished sign-ups hold data until D8 clean-up; decide D8's "N days" with Decision 1.
4. **Cap reached during Forgot password (AC-20):** sends nothing, neutral message — state it in the AC so the Tester doesn't log it as a bug.

## Round 4 (amendment after Saurabh's decisions)

CHANGES_REQUESTED

Amendment matches 00-decisions.md without tightening (AC-48; AC-3/9 removed, AC-34 changed, D11; AC-51..55; AC-46/50/1). Keeping invited staff/families off provider sign-in (D3) is a stated safety reading. Nothing left of the student/age path outside historical response sections. AC-54 staff/student/parent/invited bullet is safe and testable with a stand-in provider (AC-44); Architect Q6 owns Supabase's own linking.

1. [blocking] **AC-14 / AC-6 re-open the round-1 takeover; tests miss the main case.** AC-6 allows a password on the form and public `signUp` stores it before confirmation. A signs up B's e-mail with P1; B never fills the form but clicks A's link (or uses Google, AC-54 b1) and finishes; if the finish step doesn't ask for a password (AC-17 "if stage 2 puts it here"), P1 still works. Both AC-14 test orders have B submitting the form. "or confirmed it" lets a "keep this password" button count. Fix: add tests "A signs up with P1; B finishes from A's link" and "… B finishes by provider sign-in" — P1 never signs in; define "confirmed" as B typing the password after the mailbox is proven, or drop it; simplest build: e-mail sign-up always sets its password on the finish step, replacing anything stored before.
2. [blocking] **AC-34 lets anyone block a student invite.** Refuses a student invite to a user's e-mail "finished or not"; AC-36 only lets staff/parent invites replace an unfinished sign-up; reactivate/delete D6, clean-up D8 → breaks AC-42. Fix: AC-34 refuses only **finished** users; an unfinished sign-up is replaced by a student invite as in AC-36.

Non-blocking — fold into the Architect's brief:
3. **AC-54 message** wrong for invited accounts (no password). One message: "This e-mail already has an AJ Classes account. Sign in with your e-mail and password, or use the invite we e-mailed you."
4. **AC-50 / A14 Terms scope:** linked from the existing setup form too, so it covers every portal account. Add the route to CSP e2e and `hosting-csp.test.ts` path lists (as `/careers`, DEC-WH-1).
5. **AC-48 while closed:** say whether a finished e-mail user linking Google for the first time is allowed while closed (recommend allow; creates no account).
6. **Finished user who is really a student (AC-34):** can't be invited as student; note the workaround (different e-mail) in Users page copy, or move admin delete for users out of D6.
7. **AC-53 for Facebook:** Supabase marks a returned Facebook e-mail as verified; acceptable, but Q6 confirms at the running Auth version.

## Round 5

CHANGES_REQUESTED

Round-4 blocking items resolved: AC-6/14/17 put the password on the finish step every time, replacing anything stored; "confirmed" gone; AC-14 has four cases incl. "B finishes from A's link" and "B finishes by provider". AC-34 refuses only finished users; AC-36 lets a student invite replace an unfinished sign-up; AC-44 tests it.

1. [blocking] **A password sign-in can still reach the finish step (AC-14, 17, 20).** 02 accepts that a raw-API `signUp` password works once the owner confirms, relying on the finish step needing an e-mail-link session; 01 doesn't say so. AC-20 reads as "a password sign-in opens the finish step"; AC-14 only needs the password "typed after the mailbox was proven". Sequence: A raw-API signs up B's e-mail with P1 → B clicks the link but doesn't finish → A signs in with P1, reaches the finish step, types P3, saves → A owns B's account. Fix: AC-17 — the finish step saves only from a session from the confirmation link, a Forgot-password link or a provider sign-in, never a password sign-in. AC-14 — an earlier password may give a session, but it can't save the finish step or read anything; when the owner finishes, all other sessions are deleted. AC-44 — add "A raw-API signs up with P1; B clicks the link; A signs in with P1 before B finishes and can't save the finish step".

2. [non-blocking] **Residuals not yet stated honestly.** Decision 3 (line 245) still says "never more than 15 of the 30", contradicted by AC-19/46. AC-46's resends "bounded" by 60 s/address and 30/hour: 30/hour uses Resend Free's 100/day in ~4 hours and blocks resets, codes, invites (round-1 finding 2) — say so. AC-12: the raw reply reveals any *existing* e-mail, not only confirmed ones.
3. [non-blocking] **AC-54 dead end:** confirmed-but-unfinished owner trying Google is told to use a password they don't have; add "or reset your password".
4. [non-blocking] **Facebook-only users and promotion (AC-33, 35):** no password; admin message says they'll use Forgot password; add to AC-44.

Facts still check out (`email_sent = 30`/h, `sign_in_sign_ups = 30`/5 min).

## Round 6

APPROVED

Blocking item 1 closed across AC-14, 17, 20, 44: finish step saves only from a confirmation-link, Forgot-password-link or provider session, never a password session; saving deletes every other session; a password sign-in to an unfinished account is signed out with a message revealing no more than "Email or password is incorrect"; fifth AC-14 case added and tested. No path left where anyone but the mailbox owner can finish an account. R1 and Decision 3 now honest; Decision 6 puts both risks to Saurabh and blocks release until answered.

R2 wording (non-blocking, fix before it goes to Saurabh): two-step is authenticator-app only (`[auth.mfa.totp]`), so it's the e-mailed reauthentication code (setup form `JOIN_PAGE.codeSent`, Change password) that fails, not "two-step codes"; and portal e-mails (new work, due tomorrow, returned) also fail once Resend's 100/day is used — the app's 70 cap doesn't protect them. Suggested: "…that would stop password resets, e-mailed sign-in codes, invites and portal e-mails for everyone until the next day."

Notes for the Solution Designer (non-blocking):
1. AC-14 "A's session is gone": deleting sessions revokes refresh tokens, but an issued access token stays valid up to `jwt_expiry = 3600`. Either have user RLS also require the token's `session_id` in `auth.sessions`, or reword AC-14 ("refresh revoked; remaining access token expires within 1 h and reads only own profile and posts"). Make sure promotion's sign-out (AC-35) covers live access tokens.
2. AC-17 `amr`: confirm actual values at the local version; fail closed on unknown values.
3. AC-19 / AC-20: align the "Already confirmed? Use Forgot password to finish" hint with the AC-20 sign-out message.

## Round 7 (alignment with 02 round 3 and Saurabh's Round 2 answers)

APPROVED

01 matches 02's 18-item "Changes to 01" one for one (scope, AC-2/51/A13 Google only; Facebook/Apple → D14/D15; AC-6 wipe; AC-14 six cases + session wording; AC-17 e-mail-link or Google session only, unknown refused, factors deleted; AC-19/20 same hint; AC-31/33/35/43/44; AC-46 R2 text + failed sign-up uses its slot; AC-48 Dashboard fallback; AC-52..55 Google, AC-54 single "never attaches" bullet with message M; Decisions closed). Saurabh's words reflected exactly. No Facebook/Apple in any v1 AC. No earlier blocking item reopened (takeover: wipe + confirmations → A never gets a session; enumeration on the page unchanged; blocked invites unchanged).

Notes for the Solution Designer (non-blocking):
1. AC-20's first sentence can't be triggered any more (no password works on an unfinished account; AC-14 case 5 expects `Email or password is incorrect.`). Keep as a server-side safeguard tested at the Auth boundary, or drop it.
2. A parent promoted from a Google-only account can't use the mobile app at first (no Google sign-in on mobile, D4); add a line to the AC-33 admin message or first-sign-in help: set a password with Forgot password.
