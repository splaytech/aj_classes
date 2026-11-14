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
