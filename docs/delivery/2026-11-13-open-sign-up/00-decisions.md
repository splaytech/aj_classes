# Saurabh's decisions — 2026-11-14

Asked after stage 2 (Architect). Answers verbatim in quotes; lead's reading in [ASSUMPTION] lines he can overrule.

1. **Launch:** "Live at release". Sign-up opens when this is deployed — no off-by-default switch.
   - [ASSUMPTION] A way to close sign-up again (kill switch) is still wanted for abuse, but it defaults to open.
2. **Minors / who can sign up:** "Parents only". Only parents/guardians can self sign up. No student self sign-up, so no age tick.
   - [ASSUMPTION] Students still only get accounts through staff invites, as today. A signed-up parent is still only a "user" (not linked to any student) until staff link them.
3. **How sign-up is built:** "use public sign up with sign up with google and fb options and apple as well". Supabase public sign-up (email) plus Google, Facebook and Apple sign-in. Replaces the own-function + invite-token design.
   - [ASSUMPTION] Provider accounts and credentials (Google Cloud OAuth client, Meta app, Apple Developer / Services ID + key) are Saurabh's to create; the team builds and documents, and tests OAuth with whatever local credentials exist.
4. **Other recommendations:** "Accept all three" — Resend Free with a 15-a-day sign-up email cap (Pro ~A$31/month only if "busy" shows on real days); a Terms page must exist before sign-up is open; the "Sign up" link appears on the Sign in page only.
   - Consequence of 1 + 4: the Terms page must ship in this release (or the release waits for it).

## Round 2 — 2026-11-14 (after stage 2 review round 2: third round of takeover edge cases, simpler options offered)

5. **Sign-up options:** "Email + Google + Apple (Recommended)" — Facebook left out of v1 (deferred).
6. **Residual risks R1 (raw sign-up reply reveals whether an e-mail exists) and R2 (resends outside the 15/day cap could use up Resend Free's 100/day and stop resets, e-mailed sign-in codes, invites and portal e-mails until the next day):** "Accept both (Recommended)". Move to Resend Pro (~A$31/month) if e-mail ever runs out.
7. **Apple Developer membership:** "No, skip Apple for now". Combined with 5, **v1 = e-mail + Google only**. Apple and Facebook are deferred.
8. **Custom Auth domain (~US$10/month):** "Not now (Recommended)".
- Linking policy: in every option, a provider login never attaches itself to an existing account (stated in the question, not objected to).
- [ASSUMPTION] Cap strictness (count new sign-ups only) and the new `user` enum value are the Architect's call (review-2 round 2 item 10); recorded, not asked.

## Lead assumptions on stage 3 open questions — 2026-11-14 (no reply from Saurabh yet; overrulable)
- [ASSUMPTION] Q1 AC-15: if Supabase's sign-up e-mail is HTML only, "the full link is visible as text in the e-mail" satisfies the plain-text part.
- [ASSUMPTION] Q2 AC-32: a deactivated account's password sign-in keeps today's "Email or password is incorrect" (R2a V18, deliberate); AC-32's "not active" applies only where the app already shows it.
- [ASSUMPTION] Q3: e-mail sign-up may go live before Google. `deploy.sh` must not require Google credentials; the Google button stays hidden until the provider is configured (AC-51).
- [ASSUMPTION] Q4: no footer Terms link in v1 (not in any AC); the Terms page is linked from the sign-up and setup forms.

## Lead assumptions on stage 6b security findings — 2026-11-14 (no reply from Saurabh yet; overrulable, confirm before release)
- [ASSUMPTION] 06 finding 1 → **R4 (proposed):** about 15 captcha solves a day can fill the cap and show "busy" to everyone for 24 h, and resends to the fake addresses can spend most of a day's Resend Free quota on hard bounces; a high bounce rate can get Resend sending paused, which also stops invites, password resets and portal e-mails. Mitigations (in fix batch 2, not yet verified): unconfirmed sign-ups are deleted after 7 days; a release-notes "Watch" line tells the admin to close sign-up, deactivate odd rows and check Resend bounces. Freeing a cap slot on deactivation is not built (needs the cap table to hold an account id, which the design avoided).
- [ASSUMPTION] 06 finding 2 → **extends R1 and R2:** any signed-in account can test whether an e-mail exists through `PUT /auth/v1/user` (no captcha, about 30 per 5 min per IP) and can send e-mail-change mail within Auth's 30/h limit. No Supabase setting turns it off; the real fix (custom Auth domain + WAF rule) was declined in Decision 8.
- [ASSUMPTION] 06 finding 10: `[auth.sms] enable_confirmations = true` is to be set in fix batch 2 (SMS sign-up stays off), so the raw sign-up API answers an existing confirmed e-mail with the same quiet reply. Reversible config tightening of R1.
- [DECISION, after review-6b] Finding 5 is fixed, not deferred: e-mail codes become 8 digits (`otp_length = 8`) with their own length constant, so the authenticator (TOTP) code stays 6.
- [ASSUMPTION] Deferred, recorded as known Low: finding 7 (`posts.author_id` readable by any signed-in account; staff UUIDs are useless under `profiles` RLS) and the Google half of finding 9 (fix before Google is switched on).

## Lead rulings on stage 6a ambiguous ACs — 2026-11-14 (overrulable)
- AC-12: "the same HTTP status and body" applies to what the page shows and does. Any difference in Supabase's raw reply (status, or `identities: []` in the quiet reply) is R1, accepted in Decision 6. 01 is reworded to say so.
- AC-27: a permission rule, not a screen. A user may not change any profile column except `full_name` (and the password through Auth). v1 has no name-edit screen after the finish step, and none is needed.
- AC-40: the shipped mobile app's response to `Unresolvable role` (back to the sign-in screen with "Something went wrong. Please try again.") is today's error state, so it meets AC-40. No mobile change.
- D8 (clean-up of unfinished sign-ups) moves into v1 as unconfirmed sign-ups deleted after 7 days (security finding 8). 01 is updated.
