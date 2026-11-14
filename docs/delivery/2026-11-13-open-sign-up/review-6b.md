# Review 6b: Security review (`06-security.md`), code pinned to `8a33156`

## Round 1

**CHANGES_REQUESTED**

**Accuracy.** 12 file:line claims sampled; all hold at `8a33156`:
- finding 1 (`open_sign_up.sql:155-160`, `:419-432`)
- finding 3 (`deploy.sh:204`, `:221`, `:251`, header file `:198-200`)
- finding 5 (`config.toml:241-243`)
- finding 6 (`deploy.sh:159-164`)
- finding 7 (`posts.sql:24`, `posts_public_columns_and_trim.sql:8-9`)
- finding 9 (`open_sign_up.sql:138-145`, `:140`, `:151`, `FinishSignUpForm.tsx:48`)
- finding 10 (`config.toml:292-296`)
- finding 11 (`:12-24`, `:134`, `:178-213`, `:685-725`, `auth-callback.tsx:79`, `:84`, `invite-parent.ts:44-63`, `:108-125`)

**Finding 2 is plausible.** GoTrue v2.197.0 matches the local image tag. In `api.go`, `/user` PUT has only `requireAuthentication` and `limitHandler(limiterOpts.User)`, no `verifyCaptcha`. In `user.go`, `IsDuplicatedEmail` returns 422 `ErrorCodeEmailExists` before `db.Transaction` and before `sendEmailChange`. Non-admin `AppData` is refused (403). The `apilimiter` package wasn't read, so "30 per 5 min" is unconfirmed, though consistent with `sign_in_sign_ups = 30`. With `double_confirm_changes = true` (`config.toml:232`), change mail also goes to the attacker's own old address.

**Coverage.** Nothing material missing:
- RLS is on for all 16 `public` tables. Every SELECT policy except posts runs through `is_admin()`, `is_active_staff()`, `my_active_role()` or own-row checks; none admit `user`.
- All 34 security definer functions callable by `authenticated` check the role or act only on the caller's own row. `private.handle_auth_password_set` is executable by PUBLIC, but it is a trigger function in an unexposed schema (Info).
- Open redirect: the production allow-list holds exact URLs only (`config.toml:509-513`); the callback navigates only to a fixed route.
- Dependencies: the only `package.json` change is to scripts.
- Secrets: none in the diff; Google secrets are `env(...)` references and `.env.*` is git-ignored.

### Findings

1. **Blocking.** Finding 5 is rated Low and its deferral in `00-decisions.md` rests on understated math (`config.toml:214` `token_verifications = 30`, `:241-243`). "About 1,400 IPs for 50%" counts only one code's one-hour life. A resend (one Turnstile solve, one e-mail to the victim) restarts the hour, so each hour gives about 360/10^6 per IP, independently: 1 IP ≈ 23% a month; 10 IPs ≈ 45% a week. A win gives a confirmed account at the real parent's address, which also defeats finding 4's safeguard (it *is* the address on the enrolment record). **Fix:** re-rate as Medium with the cumulative math, and either make it an explicit decision for Saurabh (R5) or fix it: `PortalField.tsx:217` shares `AUTH_LIMITS.codeLength` with the TOTP field; a separate e-mail-code length constant plus `otp_length = 8` fixes it without touching TOTP. Shortening `otp_expiry` alone doesn't change the guess rate.
2. **Non-blocking.** `00-decisions.md` says the 7-day clean-up is "built" and `enable_confirmations = true` "is set"; neither is true at `8a33156` or HEAD `7a0b2d9`. **Fix:** land both before release or reword as planned; the Tester verifies at the new SHA.
3. **Non-blocking.** Finding 1's bounce risk is understated: resends to the 15 fake addresses can use the whole `email_sent = 30`/h, so nearly a day's Free quota can go to hard bounces. Medium and R4 remain right; add "bounce rate" to the R4 text so Saurabh accepts that a Resend pause also stops invites, resets and portal mail.
4. **Non-blocking.** The handling of finding 7 is sound (no data impact under `profiles` RLS). Add it to `03 §14` so the reversal of the earlier hardening decision is on record.
5. **Non-blocking (Info).** The production redirect allow-list (`config.toml:511`, `:513`) includes `staging.ajclasses.com.au`. PKCE keeps it unexploitable (the verifier stays on the starting origin). Worth a line in 06 §11.5.

The other ratings (2, 3, 4, 6, 8, 9, 10) are reasonable. Finding 3 is already fixed after the pin in `19905ba`; re-check at the next SHA.

## Lead note (round 1)

Finding 5 will be **fixed**, not deferred: a separate e-mail-code length and `otp_length = 8` go to the Developer in fix batch 2 (the mobile app has only a TOTP code field, so it is unaffected). Items 2 and 3: the lead's `00-decisions.md` lines are reworded. Item 4 goes to the Developer. Security revises `06-security.md` for items 1, 3 and 5.
