# BUG-1 — Finish step dead-ends when a verified authenticator exists on the account (CF-9)

- **Case:** CF-9 (AC-14 case 6, AC-17). Round 1, build `5b95315` (code `5e92ee6`), local stack.
- **Severity:** Low. Only the mailbox owner holds a session before finishing, and the plan's fixture (a
  `verified` factor inserted by SQL into an `aal1` link session) is not a state the UI or a stranger can create.
  The Tester also claims a **plan error** (below); the lead rules.

## Steps to reproduce
1. Sign up `t6-<run>-factor@local.test` on `/portal/sign-up`.
2. Open the confirmation link from Mailpit and press **Continue** (lands on `/portal/join`).
3. Insert a factor, as CF-9 says:
   `insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) select gen_random_uuid(), id, 't6-after', 'totp', 'verified', now(), now(), 'T6T6T6T6T6T6T6T7' from auth.users where email='t6-<run>-factor@local.test'`
4. On the finish step type a name, a 12+ password twice, tick, press **Finish**.

## Expected (plan CF-9)
After Finish the account is active, lands on `/portal/user`, and the factor count is `0`.

## Actual
- `PUT /auth/v1/user` → `401 {"code":"insufficient_aal","message":"AAL2 session is required to update email or password when MFA is enabled."}`
- The form shows `Please enter a code from your authenticator app first.` (`PORTAL_ERRORS.needsTwoStep`) and offers no
  code field, so the person can't go on from this page.
- `complete_sign_up` is never called; status stays `invited`; factor count stays `1`.

## Control (same build, same steps, factor `status = 'unverified'`, i.e. enrolled but not verified)
`PUT /auth/v1/user` 200, `complete_sign_up` 204, lands on `/portal/user`, status `active`, factor count `0`. The
"before confirmation" half of CF-9 also passed (planted factor `1` → `0` after Continue).

## Plan-error claim (Tester)
A real enrolment that is *verified* raises that session to `aal2`, so the owner could then save the password; a
verified factor next to an `aal1` link session can only come from SQL. The realistic fixture is an unverified
enrolment, which passes. If the lead rules the case as written stands, the fix is for the finish form to handle
`needsTwoStep` (ask for the authenticator code, or let `complete_sign_up` run before the password step).

## Evidence
`run-1/out/cf2.json` (CF-9: planted 1, afterContinue 0, afterInsert 1, landed `/portal/join`, afterFinish 1),
`run-1/out/cf9b.json` (verified vs unverified, with the network replies).

## Ruled plan error by lead (L-1), 2026-11-16 — re-run under L-1: still FAIL, for a different reason

The L-1 fixture was run as written on a fresh `t6-<run>-factor-real2` sign-up (a first attempt,
`t6-<run>-factor-real`, ended the same way before the harness recorded it; both are swept by R-9):

1. Confirmation link → Continue → `/portal/join`. Link session `aal1`, `amr [otp]`.
2. `POST /auth/v1/factors` (totp) 200 → `POST …/challenge` 200 → `POST …/verify` with a TOTP computed from the
   returned secret 200. New session: **`aal2`, `amr [totp, otp]`**. Factor `verified`.
3. With that session in the browser, open `/portal/join`.

**Actual:** the guard sends the person to `/portal/login?reason=finish-sign-up` with "To finish signing up, use the
link we e-mailed you, or Forgot password.", and revokes the session (sessions for the account: `0`).
`my_sign_up()` with the aal2 token returns `can_finish: false`. Status stays `invited`, factor count `1`. The
finish step is never shown, so "active, `/portal/user`, factor count `0`" can't be reached.

**Cause (from the code):** `private.session_can_finish_sign_up()` needs **every** `amr` entry to be one of `otp`,
`recovery`, `email/signup`, `magiclink`, `oauth` (03 §3.3, review-3 item 6: "fail closed"). A verified TOTP adds a
`totp` entry, so a link session that has verified an authenticator can never finish. Forgot password doesn't help
either: a new recovery session is `aal1` with a verified factor, so the password step gets `insufficient_aal`
(round 1's result).

**Reach:** only the mailbox owner, through the raw Auth API (the user Account page has no authenticator set-up).
Same Low class as the deferred item, but it is the case's own L-1 path, so the row is recorded FAIL for the lead to
rule (e.g. allow `totp` alongside a link method, or accept as a second deferred Low and rewrite the check).

**Second check (unchanged, round 1):** an unverified enrolment is removed on Finish: active, `/portal/user`, factor
count `0` (`run-1/out/cf9b.json`). **Evidence:** `run-1/out/cf9l1.json`, `run-1/pw/cf9l1.mjs`.
