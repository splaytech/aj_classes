CHANGES_REQUESTED

# Review 1: 01-requirement.md (round 1)

Branch `feature/invite-14-days` @ 63887f5. Checked against `supabase/functions/account-admin`, `apps/web/src`, `supabase/config.toml`, `supabase/templates`, `e2e/`, `supabase/scripts/deploy.sh`, the mobile repo and decisions.md. Almost every claim about current behaviour checks out: the four send paths and audit actions, `sendSetupLink` calling `resetPasswordForEmail` when `email_confirmed_at` is set, the quoted strings and constants, the template footers and subjects, `otp_expiry = 3600`, the env names, the e2e `extractLink`, and mobile's 1-hour `inviteLinkExpiry`.

## Blocking

1. **AC 36 on re-send would delete a real account; a failed re-send is undefined.** Limit "no account behind" to the three first-time invites. Add an AC for a failed re-send: the account and its links stay, the admin sees `The invite e-mail couldn't be sent. Please try again.`, and say whether the previous link keeps working. Add the parent-link case (no email, so `EMAIL_TRANSPORT` doesn't matter).
2. **AC 20 is wrong for a signed-out caller.** `config.toml:457-458` sets `verify_jwt = true`, so a call with no `Authorization` gets 401 from the gateway, not `not_admin`. Fix: signed-out → 401 from the gateway (or `not_admin` 403); all others → `not_admin` 403; never an email or a token.
3. **AC 10 misstates a cut URL.** `auth-confirm.tsx:47-49` shows `invalidLink` only when `token_hash` or `type` is missing; a truncated token gets `Continue` then `inviteExpired`. Restate it for the new link: missing token or required parameter → `invalidLink`; a present but garbled token is refused like any other (AC 9, AC 11).

## Non-blocking

4. **`invited_at` source.** Only Supabase's `inviteUserByEmail` sets `auth.users.invited_at`, which the profile trigger copies. Without it, `Invited on` is blank and web and mobile show `Invite expired` at once. Add the fact, and an AC that `profiles.invited_at` holds the latest send after every invite and re-send (web and shipped mobile). The mechanism is stage 2's.
5. **Forgot-password copy shares `AUTH_LIMITS.linkExpiryHours`** (`portal.constants.ts:153`). Extend AC 32: it still reads "It expires in 1 hour."; the invite lifetime is a separate constant.
6. **Old-format links after release.** Add an AC: refused with AC 9 (matches AC 25).
7. **"For Saurabh" item 1 overstates the evidence** (fake-CLI and dry-run files). Reword: deploy.sh sets and checks these; confirm with `supabase secrets list` after deploy.
8. **The email kill switch now stops invites** (`supabase/README.md:167`). Add to "For Saurabh", and to A5 as a question for the Architect.
9. **AC 17 and AC 18 states are hard to reach.** Name the route, or mark them defence-in-depth checks set up in the database.
10. **AC 23's dashboard invites count can't change** (`admin-dashboard.tsx:42-44`). Drop it or say it's unchanged.
11. **AC 28 wording:** the heading is the same for every role; say "role-worded brand label and body" (`invite.html:39-50`).
12. **AC 2 and AC 3 boundary:** state the rule once (valid while now < sent + 336 h); AC 2–4 are samples of it.

## Round 2

APPROVED

All 12 round-1 findings are fixed; the new claims were re-checked against the code, and AC 38–41 are testable and consistent. New non-blocking findings, fixed in place by the team lead:

1. AC 18: the `set-active` set-up route can't work (`admin_set_active` raises `not_joined`); keep only "set `is_active = false` in the local database".
2. Fact 12: deploy.sh checks `EMAIL_TRANSPORT` and `SITE_URL` but not `RESEND_API_KEY` (only required and set).
3. AC 38: say how the Tester makes an old-format link.
4. For stage 2/4: between the function deploy and the web deploy, new-format links reach the old landing page. Deploy web first, or have the new page accept both. Note it in "For Saurabh" item 5.
