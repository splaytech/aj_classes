CHANGES_REQUESTED

# Review 2: 02-architecture.md and ADR-0010 (round 1)

Checked against 01 (approved), the code, decisions.md, and the GoTrue source at the local version (v2.197.0, read-only). Database claims were checked on temp tables in a rolled-back transaction. Sound: the one-row primary key, the upsert, the cascade on cancel, the single-use claim, the guarded `invited_at` copy, `magiclink` over `invite` (admin `generateLink` magiclink on an existing user writes only `recovery_token`/`recovery_sent_at`, sends no email, leaves `invited_at` and `email_confirmed_at` alone; `recoverVerify` confirms an unconfirmed e-mail), equivalence to today's link, uniform refusals, no pgTAP breakage from the trigger change, the migration timestamp, the README row.

## Blocking

1. **`generateLink` magiclink creates a new user when the e-mail no longer exists** (`mail.go` `IsNotFoundError` → `signup`, no `disable_signup` check). A claim racing `cancel-invite`'s `deleteUser` makes an orphan `invited` tutor profile (`handle_new_auth_user`); with S1's `type: 'email'` fallback the holder could finish as an active tutor (`verify.go:735-742`). The claim doesn't lock the profile row, so "a redeem racing a cancel loses" isn't guaranteed. Fix: (a) after `generateLink` require `data.user.id === profile_id` and `verification_type === 'magiclink'`, else delete the stray user, release and refuse; (b) drop the `type: 'email'` fallback; (c) optionally lock the profile in the claim (`for share`); (d) a test for `generateLink` on a deleted user.
2. **"Web first" doesn't say which web.** `develop` auto-deploys to staging, the Supabase project is shared and `SITE_URL` is production. Step 1 must be "production web (`main`) live", confirmed by opening `https://ajclasses.com.au/portal/invite`; note that staging refuses old links once `develop` lands; the down path must roll web and functions back together.

## Non-blocking

3. Rate limit: name the header and its trust assumption (leftmost `x-forwarded-for` can be spoofed and can fill a victim's bucket); add an `(ip_hash, created_at)` index; locally all requests share one Docker gateway IP, so give the test plan a way to clear `private.invite_redeem_attempts`.
4. A claimed link is burned even if the browser never signs in. The page should retry `verifyOtp` once with the same `tokenHash`, and show a try-again message (not AC 9) for a 500 after release; or accept and state the risk.
5. A send that times out may still have been delivered (`transport.ts:119-122` maps a timeout to `retry network`). It fails safe; note it beside §6 step 5.
6. README kill switches: only `secrets unset EMAIL_TRANSPORT` stops invites, not `cron.unschedule('email-worker-kick')`.
7. AC homes: AC 10 on `/portal/invite` (no token → `invalidLink`; a badly shaped token → `Continue` then AC 9; no client pre-check); AC 5 vs AC 23 (back-date `expires_at` and `profiles.invited_at` together); AC 38 fixture shows `Invited` (expected); AC 34 "unchanged" means the sign-in, two-step and reset tests; AC 26 days derived from 336 h, not hard-coded.
8. §2: a REST `select` on `private.invite_tokens` can't be tested in pgTAP (`config.toml:14`); test role grants in pgTAP, check REST by hand.
9. "No pause" is justified. Add to §8 that the nulled `profiles.invited_at` can be restored from `auth.users.invited_at`. For information: verifying a new link runs `Recover`, which clears every one-time token for that user.
10. First-admin runbook: Dashboard "Add user" may need a password (harmless); the Developer confirms the exact steps before rewriting `supabase/README.md:52`.

## Round 2

APPROVED

The switch to `generateLink({ type: 'recovery' })` was verified against GoTrue v2.197.0 and auth-js 2.117.2: an unknown e-mail gets 404 and creates nothing; there is no `max_frequency` check on admin `generateLink`; `Recover` on an unconfirmed invited user confirms the e-mail, clears one-time tokens and stores no temporary password; `PASSWORD_RECOVERY` is emitted but nothing in `apps/web/src` reacts to it; `verifyOtp` accepts `type: 'recovery'`. The profile lock serialises with `cancel-invite` without a deadlock. Findings 1 and 2 are fully fixed, and 3–10 are placed.

Nits (fixed in place by the team lead): 1. stale "magic-link" wording in §5.2 and ADR decision 5; 2. `GoTrueClient.js:2070` → `:2067`; 3. for stage 3: hosted Auth logs a redeem as `user_recovery_requested` plus a login, so add a README troubleshooting line.
