# 02 — Architecture: invites stay valid for 14 days

Stage 2 (Architect) of `/deliver`. Branch `feature/invite-14-days` (from `develop` @ 63887f5). Date 2026-10-29.
Input: [01-requirement.md](01-requirement.md) (approved in review-1 round 2; AC numbers unchanged) and [review-1.md](review-1.md).
Revised after [review-2.md](review-2.md):
- finding 1 → §2 and §4 (hop type `recovery`, identity check, profile lock, deleted-user test);
- finding 2 → §9;
- findings 3–10 → §2, §3.3, §4, §6, §8, §1, and the stage-3 handover in §11.
ADR: [0010](../../decisions/0010-own-invite-token-with-supabase-sign-in-hop.md) (Proposed, revised).

**Recommendation.** Supabase Auth no longer owns invite links. Instead:

- Our own token gives 256 bits of randomness. Only its SHA-256 is stored, in `private.invite_tokens`, with **one row per account**. It expires 336 h after the send.
- `account-admin` creates the token and emails it straight through the existing Resend/Mailpit transport. It does not use the outbox. Only after the transport accepts the email does it store the token, replacing the old one, and set `profiles.invited_at` in the same transaction.
- A new function, `invite-redeem`, has `verify_jwt = false`. The person clicks `Continue` on a new page, `/portal/invite`. The function claims the token once, checks the account is still invited and active, and calls `auth.admin.generateLink({ type: 'recovery' })`, which never creates a user, unlike `magiclink`. It checks that the reply's user is the invited account, and returns only `hashed_token`, which the browser passes straight to `verifyOtp`.
- Password reset, sign-in, `otp_expiry` and every hosted Auth setting stay unchanged.

There is one new edge function, one migration, and no new dependency, vendor or secret. **No `PAUSE FOR SAURABH` is needed** (§10).

## 1. Impact assessment (checked in the code)

| Area | Today | Change |
|---|---|---|
| Invite send | `inviteUserByEmail` in `account-admin/handlers/invite.ts:28`, `handlers/accounts.ts:86-89` (`sendInvite`), and `sendSetupLink` `:96-105`, which uses `resetPasswordForEmail` once the e-mail is confirmed | All four paths call one `issueInvite(account)`: make the token, send, then store. Staff accounts are created with `auth.admin.createUser`, as family accounts already are (`accounts.ts:61-82`). The `resetPasswordForEmail` branch goes (AC 14) |
| Admin gate | `requireActiveAdmin` runs before any action (`account-admin/index.ts:42-43`); `verify_jwt = true` (`config.toml:457-458`) | Unchanged. Redeem is **not** added here (§3) |
| Email transport | `pickTransport` / `sendEmail` in `notifications/transport.ts:19-30, 112-127`; hosted-safety check `isUsableConfig` in `notifications/config.ts:34-42` | Moved to `_shared/email/`, unchanged. `notifications` imports them from there. `account-admin` uses the same transport and hosted-safety check (without the worker secret) |
| Token storage | none | New `private.invite_tokens` (§2) |
| `profiles.invited_at` | Copied from `auth.users.invited_at` on every update of `email, email_confirmed_at, last_sign_in_at, invited_at` (`20261006004522_staff_accounts.sql:215-217`; body `20261023100000_invite_onboarding.sql:69-82`) | It is copied only when Auth's own `invited_at` changes to a non-null value, and set directly by our store step (§5) |
| Landing page | `auth-confirm.tsx:28-29` accepts `type=invite` or `recovery` and calls `verifyOtp` (`services/auth.service.ts:73-80`) | `recovery` is unchanged. `type=invite` becomes the old format: refused locally with AC 9, with no network call (§7). New route `/portal/invite` |
| Error boundary | Inherited from the portal layout: `routes/portal/portal-root.tsx:28` (`export function ErrorBoundary`), which wraps every portal route (`routes.ts:26-33`) | The new route sits inside the same `layout('routes/portal/portal-root.tsx', …)` and inherits it |
| CSP | The portal `connect-src` already allows the Supabase origin, and functions are served from it | None |
| Status rule | `account-status.ts:19` uses `AUTH_LIMITS.linkExpiryHours` (1), shared with forgot-password copy (`portal.constants.ts:153`) and the invite dialog (`:550`) | New `INVITE_LIMITS.linkLifetimeHours = 336`, used by `account-status.ts` and `INVITE_DIALOG.intro`. `AUTH_LIMITS.linkExpiryHours` stays 1 for reset (AC 32) |
| Config | `[functions.*]` blocks at `config.toml:457-468`; `FUNCTIONS=(account-admin leads notifications)` at `deploy.sh:27` | Add `[functions.invite-redeem] verify_jwt = false` and add `invite-redeem` to `FUNCTIONS`. No new secret |
| Templates | `supabase/templates/invite.html` (Auth's invite) | Kept and unused by app code (D6). Its look and copy are reproduced in the function's renderer (§6) |
| Runbook | "First admin": Dashboard → **Invite user** (`supabase/README.md:52`) sends the old format, which is now refused | Proposed: Dashboard → **Add user**, then **Send password recovery**. The recovery link (1 h, unchanged) lands on the setup form because the account is still invited (`accounts.ts:91-95` comment). The Dashboard may insist on a password for Add user, which is harmless: the person sets their own on the setup form. The Developer confirms the exact Dashboard steps locally in Studio before rewriting `README.md:52` (finding 10) |
| Mobile (shipped) | Reads `profiles.invited_at`, 1-hour rule (`account_status.dart`) | Nothing removed or renamed (AC 27). It still shows `Invite expired` after 1 h until D1 ships |

## 2. Where the token lives (Q1) — decision DEC-IN-1

**Decision.** A new table, `private.invite_tokens`:

| Column | Type | Notes |
|---|---|---|
| `profile_id` | `uuid primary key references public.profiles (id) on delete cascade` | **One live link per account, enforced by the key.** A re-send replaces the row, and cancel deletes the auth user, then the profile, then the token by cascade |
| `token_hash` | `text not null unique` | Lower-case hex SHA-256 of the raw token. The raw token is never stored or logged |
| `sent_at` | `timestamptz not null` | The moment the row was stored, after the transport accepted the email |
| `expires_at` | `timestamptz not null` | `sent_at + interval '336 hours'`, set by the store function. Keeping a column, not computing it in the query, lets Tester back-date one row (AC 5) |
| `used_at` | `timestamptz` | Set by the claim. Null means unused |

- **Schema `private`.** PostgREST exposes only `public` and `graphql_public` (`config.toml:14`), so no REST or GraphQL path reaches it.
  - `private` grants `usage` to `authenticated` (`20261006004522_staff_accounts.sql:16`). So the migration also runs `revoke all on table private.invite_tokens from public, anon, authenticated, service_role`.
  - It enables RLS with **no policies** (defence in depth, same as `enquiry_rate_limits`, `20261022090000_enquiries.sql:36-40`).
- **Access only through `security definer` functions in `public`**, each with `set search_path = ''` and `execute` revoked from `public, anon, authenticated` and granted only to `service_role`. This follows `admin_log` (`staff_accounts.sql:454`) and `notify_claim_emails`:
  1. `invite_token_store(target uuid, hash text) returns timestamptz`. In one transaction it:
     - locks the profile row;
     - returns null unless `status = 'invited'`;
     - upserts the row (new hash, `sent_at = now()`, `expires_at = now() + 336 h`, `used_at = null`);
     - sets `profiles.invited_at = now()`;
     - returns that time.
  2. `invite_token_claim(hash text, ip_hash text) returns uuid`. It applies the rate limit (§3.3), then locks the account's profile `for share` while it is `status = 'invited' and is_active` (§4, so it serialises with `cancel-invite`). Then it runs one `update … set used_at = now() where token_hash = hash and used_at is null and expires_at > now()`, `returning profile_id`. It returns null in every refused case.
  3. `invite_token_release(hash text)`. It sets `used_at = null` again, and only for that row while it is still the account's row. The redeem calls it only when `generateLink` fails after a successful claim, so a Supabase outage doesn't burn a valid link.
- **pgTAP:** a `select` on `private.invite_tokens` and `private.invite_redeem_attempts` as `anon` and as `authenticated` (staff, family and student JWT claims) is refused. The three functions aren't executable by `anon` or `authenticated`. `invite_token_store` on an active account returns null.
- **REST, by hand (finding 8).** pgTAP can't reach PostgREST. `private` isn't in `api.schemas` (`config.toml:14`), so Tester checks by hand that `GET /rest/v1/invite_tokens` with `Accept-Profile: private` is refused for the anon and an authenticated key on the local stack.

**Alternatives rejected.**

- A table in `public` with RLS and no policies: one grant mistake from being readable over REST.
- A column on `profiles`: `profiles` is table-`select` to `authenticated` (`staff_accounts.sql:426`), and the hash would be one column grant away from being read by its owner and admins.
- Several rows per account with a "current" flag: the one-row primary key makes "only the newest link works" (AC 12, 13) structural rather than procedural.

## 3. Redeem endpoint (Q2) — decision DEC-IN-2

### 3.1 Separate function

**Decision.** A new edge function, `invite-redeem`, with `[functions.invite-redeem] verify_jwt = false`. The person redeeming is signed out, and with the new publishable keys the gateway would refuse a non-JWT apikey anyway.

Why not an action in `account-admin`:

- That function admits nobody who isn't an active admin with two-step (`index.ts:42-43`), and the gateway check (`verify_jwt = true`) is the first layer AC 20 relies on.
- Adding a signed-out action means turning `verify_jwt` off for every admin action and moving the admin check below the dispatch. A future action added without the check would then be open to the internet. Keeping the two separate keeps the blast radius apart.
- `leads` shows the cost: `verify_jwt = false`, with an admin check inside one action (`leads/index.ts:4`, `:33-36`). That is fine for leads, but not for the function that creates accounts.

Request: `POST { token }`. Like `leads` `submit` (`leads/index.ts:29`), the function requires `isAllowedOrigin(origin)`, so another site's page can't drive it from a visitor's browser.

### 3.2 Token entropy and format

- The token is 32 bytes from `crypto.getRandomValues`, base64url without padding: 43 characters, 256 bits.
- The function checks the shape before any database call (`^[A-Za-z0-9_-]{43}$`). A badly shaped token gets the same refusal as any other.
- SHA-256 needs no salt or pepper at this entropy: the hash can't be reversed, and looking it up by equality on a hash leaks nothing useful through timing.
- Link: `${SITE_URL}/portal/invite#token=<43 chars>` (AC 31).

### 3.3 Rate limiting and brute force

- Guessing is infeasible: 2^256, and only one live token per invited account. So the limit exists only to bound cost and log noise.
- **Decision:** 10 redeem attempts per 15 minutes per salted IP hash. A new table, `private.invite_redeem_attempts (ip_hash text, created_at timestamptz)`, uses the same locking-down as §2. The check runs inside `invite_token_claim`, with the same salted-hash method as `leads/rate-limit.ts:10-16`, and rows older than 15 minutes are deleted on each call.
- A limited request gets **the same refusal** as any other (AC 11). The function logs only the count `redeem rate_limited`.
- GoTrue's own `token_verifications = 30` per 5 minutes per IP (`config.toml:207`) still covers the browser's `verifyOtp` hop.
- **Header and trust (finding 3).** The key is the leftmost `x-forwarded-for` entry, as in `leads/rate-limit.ts:11-12`.
  - A client can spoof that entry. So an attacker can dodge the limit by rotating it, or fill one victim's bucket if they know the victim's address.
  - Both are accepted. The limit is a cost bound, not the security control: 256-bit entropy is.
  - Stage 3 may switch to a proxy-set header (for example `cf-connecting-ip`) only if the Developer confirms on the local stack, and Saurabh on hosted, that it is present and can't be overridden. Otherwise keep `x-forwarded-for`.
- **Index:** `(ip_hash, created_at)` on `private.invite_redeem_attempts`.
- **Locally,** every request comes through one Docker gateway address and shares one bucket. The test plan clears `private.invite_redeem_attempts` in the **local** database (`delete from private.invite_redeem_attempts;` as `postgres`) before each redeem-heavy spec, and one spec checks the 11th attempt is refused.

### 3.4 Reply shape (nothing leaks to someone without the token)

| Case | HTTP | Body |
|---|---|---|
| Success | 200 | `{ ok: true, data: { tokenHash } }`. No e-mail, user id, role or expiry |
| Expired, used, replaced, cancelled, garbled, unknown, active, deactivated, rate-limited | 200 | `{ ok: false, code: 'invite_invalid' }`, identical in every case |
| Not POST / bad JSON / origin not allowed | 405 / 400 / 403 | As `leads`. None of these needs a token |
| `generateLink` failed after a claim | 500 | `server_error`, after `invite_token_release` |

Logs hold the outcome and error name only, never the token, hash, e-mail or user id (AC 8). No audit entry is written on redeem (AC 22 lists the actions, and redeem isn't one).

## 4. How redeem signs the person in (Q3) — decision DEC-IN-3

*Revised after review-2 finding 1. The hop now uses type `recovery`, not `magiclink`, plus an identity check on the reply.*

```
browser /portal/invite#token=T         invite-redeem (service key)             Supabase Auth
  page load: nothing sent (AC 6)
  [Continue] ── history.replaceState(…/portal/invite) ── POST {token:T} ──▶
                                        shape check → claim(sha256(T), ipHash)   (§2: locks the profile)
                                        null → {ok:false, invite_invalid}
                                        profile_id → getUserById(profile_id) → email
                                          (no user → release, invite_invalid)
                                        generateLink({type:'recovery', email}) ──▶ new one-time token
                                          (404 user_not_found → release, invite_invalid)
                                        check user.id === profile_id
                                          and verification_type === 'recovery'
                                          (else release, invite_invalid; delete only a new user
                                           on a non-recovery reply)
                                        ◀── properties.hashed_token (action_link, email_otp dropped)
  ◀── {ok:true, data:{tokenHash}} ──
  verifyOtp({ token_hash, type:'recovery' }) ─────────────────────────────────▶ session
  navigate('/portal/join', replace)
```

- **Why `recovery`, not `magiclink` or `invite`.**
  - **The `magiclink` hole (finding 1).** For an e-mail that has no user, admin `generateLink` type `magiclink` quietly switches to a **signup** and creates the user. It doesn't check `disable_signup` (GoTrue v2.197.0 `mail.go:76-84`).
    - So a redeem that races `cancel-invite`'s `deleteUser` would create a fresh, orphan `invited` tutor profile through `handle_new_auth_user`.
    - With a `type: 'email'` verify, the holder could even confirm it (`verify.go:735-742`).
  - **What `recovery` does.** For a missing user, `recovery` returns **404 `user_not_found`** and creates nothing (`mail.go:85-86`). For an existing user it does exactly what `magiclink` does:
    - generating the link writes only `recovery_token` and `recovery_sent_at` and sends no email (`mail.go:146-160`);
    - verifying it runs `recoverVerify`, which confirms an unconfirmed e-mail (`verify.go:258`);
    - the session is issued the same way (`verify.go:285`).

    The difference that matters is structural: there's no signup path at all.
  - **Why not `invite`.** It refuses a confirmed e-mail, which breaks AC 14 re-sends, and it re-stamps `auth.users.invited_at`.
  - **Client side.** supabase-js emits `PASSWORD_RECOVERY` rather than `SIGNED_IN` for this verify (`@supabase/auth-js` 2.117.2 `GoTrueClient.js:2067`, in `verifyOtp`). The app's only auth listener reacts to `SIGNED_OUT` alone (`services/auth.service.ts:209-211`), so nothing routes to set-password. The page navigates to `/portal/join` itself, and an `invited` account can't skip the setup form (`auth-confirm.tsx:3-4`).
  - **No `type: 'email'` fallback.** It is dropped. `email` checks both the confirmation and recovery tokens (`verify.go:735-742`), which is wider than needed.
- **Identity check on the reply (finding 1a, belt and braces).** After `generateLink`, the function requires `data.user.id === profile_id` and `data.properties.verification_type === 'recovery'`.
  - If either fails, it returns `invite_invalid` after `invite_token_release`.
  - Any mismatch, whatever the type, refuses, releases the claim and logs `console.warn('invite-redeem', 'mismatch')`; the function never deletes a user (fix batch 1, 06-security finding 2). (Earlier rounds deleted a stray non-recovery user under a minute old; that branch was removed, so this signed-out endpoint can't delete a real account.)
- **Profile lock in the claim (finding 1c).** `invite_token_claim` is plpgsql, in this order:
  1. look up the token row;
  2. `select … from public.profiles where id = row.profile_id and status = 'invited' and is_active for share`;
  3. only then the single-use `update … set used_at = now() where used_at is null and expires_at > now()`.
  - `cancel-invite`'s `update profiles set is_active = false` (`cancel-invite.ts:28-35`) needs a row lock that conflicts with `for share`, so the two serialise.
  - If cancel wins, the claim sees `is_active = false` and refuses.
  - If the claim wins and cancel then deletes the user before `generateLink`, `getUserById` fails, or `recovery` returns 404, and the redeem refuses.
  - If cancel deletes the user after `generateLink`, `verifyOtp` fails, because the token goes with the user, and the page shows AC 9.
- **Replay.**
  - Our token is claimed before `generateLink`, so a second redeem gets `invite_invalid` (AC 7).
  - `hashed_token` is Supabase's own single-use token, with a 1 h life (`otp_expiry = 3600`, `config.toml:235`, unchanged). It is returned once, only to whoever presented the valid invite token.
  - Generating another link for the same account replaces it.
  - Verifying it runs `Recover`, which clears **every** one-time token for that user. So a password-reset link that happens to be outstanding for that invited account also dies, which is harmless (finding 9).
  - Two parallel redeems race on one `update … where used_at is null`, and exactly one wins.
- **A claimed link the browser never uses (finding 4) — decision.**
  - The page keeps `tokenHash` in memory. If `verifyOtp` fails with a network error, it retries once automatically. If that fails too, it shows the existing `PORTAL_ERRORS.network` (`error.constants.ts:49`), not AC 9, with a `Try again` button that reuses the same `tokenHash` for up to its 1 h.
  - A 500 from redeem (after release) shows `PORTAL_ERRORS.serverProblem` (`:54`) with the same `Try again` (a new POST), because the link is still valid.
  - **Accepted residual.** If the tab is closed between the redeem reply and a successful `verifyOtp`, the link is used up, and the admin re-sends (one click). This is stated in the README's troubleshooting note.
- **Token off the page.** `replaceState` runs before the POST, as `auth-confirm.tsx:58` does today (AC 8).
- **Defence in depth (AC 17, 18).** The claim needs `status = 'invited' and is_active`, under the profile lock above.
- **Service boundary.** `services/invites.service.ts` makes both calls (functions invoke, then `verifyOtp`). The page never calls HTTP itself (repo rule).
- **Spike S1 (Developer, first task, local only).** On the local stack, confirm that `generateLink({ type: 'recovery' })` with `verifyOtp({ token_hash, type: 'recovery' })` signs in two accounts: (a) one created by `createUser` that was never confirmed, and (b) one confirmed but still `invited`. Also confirm that `auth.users.invited_at` is untouched, and that `generateLink({ type: 'recovery' })` for a deleted e-mail returns 404 and creates no user.
  - If (a) fails, create accounts with `email_confirm: true`. Nothing reads `email_confirmed_at` for status any more (`invite_onboarding.sql:44`).
  - There is no other fallback type. If S1 fails in any other way, stop and return to the Architect.
  - Record the result in the dev notes.
- **Required test (finding 1d).** A function test that redeems a valid token whose account was deleted between claim and `generateLink` (by stubbing the order, or by deleting the auth user directly in the **local** database after the claim). It expects `invite_invalid`, the same number of `auth.users` rows before and after, and no new `profiles` row.

**Alternatives rejected.**

- `magiclink` with the identity check only: the check runs after GoTrue has already created the stray user, so it is clean-up, not prevention.
- The function returns `action_link` and the browser follows it: the token lands in a Supabase URL and its redirect, which needs a redirect allow-list entry, and the session arrives in the URL fragment.
- The function returns `email_otp` and the browser calls `verifyOtp({ email, token })`: the e-mail would be sent to the client.
- The function mints a session itself: the admin API has no supported way to do that.

## 5. `profiles.invited_at` (AC 40) and the mobile rule (D1) — decision DEC-IN-4

**Decision: how AC 40's `invited_at` is set.**

1. `invite_token_store` sets `profiles.invited_at = now()` in the same transaction that stores the token. It runs only after the transport has accepted the email, so `invited_at` is the time of the latest **successful** send, for all three roles and for re-sends.
2. The migration redefines `private.handle_updated_auth_user()` so it copies `invited_at` only when `new.invited_at is distinct from old.invited_at and new.invited_at is not null`.
   - Without this, the sign-in hop updates `last_sign_in_at`, and the trigger would overwrite our value with Auth's (null for `createUser` accounts) the moment the person redeems.
   - The guarded copy keeps any real Supabase invite, such as a Dashboard "Invite user", consistent. It is also safe in the deploy window, when the old `account-admin` still uses `inviteUserByEmail`.
   - `handle_new_auth_user` (insert) still copies, which is null for `createUser`.
3. **AC 25.** The migration nulls `invited_at` for `status = 'invited'` accounts, because none of them has a new-style link. So web and mobile both show `Invite expired`.
   - The web status rule already treats null as expired (`account-status.ts:18`).
   - The `Invited on …` lines (`admin-staff-member.tsx:143`, `admin-student.tsx:256`) must be hidden when `invitedAt` is null, rather than formatting null. The Solution Designer specifies this.
   - Saurabh re-sends pending invites at release ("For Saurabh" item 6), which sets real dates again.
4. A failed send never reaches step 1, so the chip, date and token are untouched (AC 39).
5. **The web status rule** becomes `now - invitedAt < INVITE_LIMITS.linkLifetimeHours × 1 h` (strict `<`, matching the SQL `expires_at > now()`; AC rule line). The constant comment cross-references the migration's `336 hours`, the same way `notifications/copy.ts:9-10` cross-references `EMAIL_KINDS`.
6. **Mobile (D1).** No schema change. The shipped build reads the same `profiles.invited_at`, which is now correct, and applies its own 1-hour rule. Until D1 ships, mobile admins see `Invite expired` for valid invites more than an hour old. The only harm is an unneeded re-send, which costs one email. D1 is a one-constant change in `account_status.dart`, plus a store release.

## 6. Sending path (Q5) — decision DEC-IN-5

**Decision: direct send from `account-admin`, not through the outbox.**

- The result has to be known synchronously. AC 21 deletes the new account, and AC 39 keeps the old link, when the send fails, and the admin sees the outcome in the dialog. The outbox only reports minutes later.
- Invites must not wait up to 5 minutes, and must not be blocked by the outbox's 70-a-day cap (A5).
- **Budget is unchanged.** ADR-0004 capped app email at 70 to leave at least 30 of Resend Free's 100 a day for Auth email, and invites were part of that 30 (Auth SMTP). They still are: same Resend account, now through the API instead of SMTP. No cap is added for invites. Admins send a handful a day.
- **Shared transport.** `pickTransport`, `sendEmail`, `outcomeForStatus` and the hosted-safety part of `isUsableConfig` (no Mailpit, `SITE_URL` must be https on hosted) move to `supabase/functions/_shared/email/`, with no change in behaviour. `notifications` imports from there, and its Node test script keeps working because the modules stay free of Deno globals.
  - `account-admin` sends one message with a fresh random UUID as the `Idempotency-Key`. There's no automatic retry, so idempotency is moot.
  - Any non-`sent` outcome, including `retry`, is `email_failed`.
- **Renderer.** A new `account-admin/invite-email.ts`, with copy in `account-admin/invite-copy.ts`. The edge runtime can't import `apps/web/src/constants`, which is the same reason as `notifications/copy.ts:1-5`.
  - It reproduces `invite.html`: the same subject, heading, role-worded label and body (from `profiles.role`: tutor/admin → Staff, student → Students, parent → Parents), the `Accept invite` button and the ignore line, and the new expiry line (AC 28, 29).
  - It sends HTML and plain text, and the text contains the full link (AC 30). The person's name is HTML-escaped and passed through `oneLine`.
- **Send ordering (AC 39; coordinator Q3) — decision.** The old link is switched off **only after the transport has accepted the new email**. `issueInvite(account)`:
  1. makes the raw token and its hash in memory;
  2. renders the email and sends it;
  3. if the outcome isn't `sent`, returns `email_failed`. Nothing has been written, so the old row and `invited_at` are untouched. A first-time invite then deletes the account, as today (AC 21);
  4. calls `invite_token_store(account, hash)`. That single statement replaces the old row and sets `invited_at`;
  5. if `store` returns null (the person joined in the meantime) or errors, returns `email_failed`, deleting the account for a first-time invite. The email just sent then carries a link that was never stored, which is refused. The old link and date are unchanged;
  6. writes the audit entry, unchanged (AC 22).
  - **A send that timed out may still have been delivered (finding 5).** `sendEmail` maps a 10 s timeout to `retry network` (`transport.ts:119-122`), which `issueInvite` treats as `email_failed`. The person may then receive an email whose link was never stored, and it is refused with AC 9. That fails safe: the old link and date are unchanged, and the admin's retry sends a working one.
  - In the few milliseconds between steps 2 and 4, the new link isn't live yet. A person can't click that fast, and a scanner's page load doesn't redeem (AC 6).
- **Kill switch (A5; coordinator Q1) — decision: unsetting `EMAIL_TRANSPORT` stops invites as well as app email.**
  - Every invite and re-send then fails with `email_failed`: no account is left behind, and a re-send changes nothing.
  - Linking an existing parent is unaffected (AC 41).
  - Password reset, sign-in codes and reauthentication are **not** stopped, because they still go through Auth SMTP.
  - That is exactly what AC 36 requires, and one switch for "everything our code emails" is simpler to reason about than two.
  - `supabase/README.md:167` must say so: "stops app emails and invites; doesn't stop password-reset or sign-in emails". No separate invite switch.
  - The README's other switch, `cron.unschedule('email-worker-kick')`, stops **only queued app email**. Invites don't go through the outbox, so it doesn't touch them (finding 6). The README states both.
- **Mailpit locally.** `account-admin` gets `EMAIL_TRANSPORT=mailpit` and `MAILPIT_URL` from `[edge_runtime.secrets]`, which apply to every local function (`config.toml:408-427`). Nothing new is needed. With `EMAIL_TRANSPORT` unset, `pickTransport` returns null and nothing falls back (AC 36).

## 7. Old-format links and the Supabase invite template (Q6) — decision DEC-IN-6

- **Web.** On `/portal/auth/confirm`, `type=invite` is still recognised, but only to refuse it.
  - The page shows `Continue`, like any link with a token. Clicking it shows AC 9 (`PORTAL_ERRORS.inviteExpired` plus `alreadySetUp`) and calls **no** `verifyOtp`.
  - Missing parameters still show `invalidLink` (AC 10).
  - So an old link looks like every other refused link (AC 11, 38). `type=recovery` is untouched (AC 32).
- **Server side.** An old token stays valid inside Supabase for at most an hour after it was sent.
  - Someone holding it could call Auth's `/verify` directly, without the page, and get a session for an account that is still `invited`. That only leads to the setup form, and only for the person the email was sent to.
  - Clearing those tokens would mean writing to `auth.users` / `auth.one_time_tokens` in a migration, which Supabase discourages and may not allow.
  - **Decision:** accept this residual risk. It is bounded by "no invites sent in the hour before release", which Saurabh controls as the only sender, and Tester checks AC 38 through the UI.
- **Template.** `supabase/templates/invite.html` and `[auth.email.template.invite]` stay for now (D6). App code no longer calls `inviteUserByEmail`, and a Dashboard "Invite user" link would be refused, so the "First admin" runbook changes as in §1.

## 8. Migration (Q7) — decision DEC-IN-7

- **Filename:** `supabase/migrations/20261030100000_invite_tokens.sql`.
  - That is later than `develop`'s latest, `20261029100000_more_email_alerts.sql`.
  - It doesn't collide with the unmerged `feature/homework-file-uploads` file `20261025134709`, which is that branch's problem under ADR-0007 §4.
  - If another branch merges first with a later timestamp, this file is renamed under the same rule.
- **Contents:**
  - the two `private` tables with revokes and RLS (§2, §3.3);
  - the three `public` service-only functions;
  - `handle_updated_auth_user` redefined (§5.2), from its current body (`invite_onboarding.sql:69-82`);
  - the one-off `update public.profiles set invited_at = null where status = 'invited'` (§5.3).
- **Additive.** Nothing the shipped mobile build or the old `account-admin` reads is removed or renamed.
- **Down path (if ever needed):** drop the tables and functions, then restore the trigger body.
- **The nulled `invited_at` can be restored (finding 9).** For accounts that were invited the old way, `auth.users.invited_at` still holds the original send time. Restoring is one `update public.profiles p set invited_at = u.invited_at from auth.users u where u.id = p.id and p.status = 'invited' and p.invited_at is null`. The migration doesn't delete anything to make this possible, so the data change is reversible.

## 9. Deploy order (coordinator Q4; revised for review-2 finding 2) — decision DEC-IN-8

**Hosting facts:**
- `develop` auto-deploys to `staging.ajclasses.com.au`, and `main` deploys to `ajclasses.com.au` (Vercel), as review-2 finding 2 states.
- Staging and production share **one** Supabase project (`config.toml:471`).
- The hosted `SITE_URL` is production (`deploy.sh:25`), so every invite email from hosted links to `https://ajclasses.com.au`, whichever site the admin used.

**Decision: production web first, then `deploy.sh` (migration, then functions), then re-send pending invites.**

1. **Production web (`main`) is live.**
   - Merge to `main`, let Vercel's production deploy finish, then open `https://ajclasses.com.au/portal/invite` with no token.
   - It must show `This link has expired or has already been used.` / `This link is incomplete. Please use the button in the email.` (AC 10). A not-found page means the deploy isn't live yet, so don't go on.
   - No new-format link exists yet, so nothing calls `invite-redeem` before it's deployed.
2. **`supabase/scripts/deploy.sh`:** `db push` (the migration), then the functions loop, which now includes `invite-redeem`. The functions are deployed together.
3. **Saurabh re-sends every invite still pending** ("For Saurabh" item 6).

**No invites between steps 1 and 2.** Saurabh is the only sender, so he controls this.

**Staging note.**
- Once this lands on `develop`, staging runs the new web against the shared project while hosted functions are still old.
- Hosted invite emails link to production, not staging, so staging refusing old-format `type=invite` links affects only a link someone pastes into the staging domain by hand.
- Staging's `/portal/invite` would fail with `invite_invalid` until step 2, because `invite-redeem` doesn't exist yet. No email points there.
- Don't test invites on staging between the `develop` merge and step 2.

**Rollback: web and functions go back together.**
- Mixing them breaks one direction:
  - old web with new functions sends `/portal/invite` links to a site with no such route;
  - new web with old functions sends old-format links that the new web refuses.
- So a rollback means:
  1. redeploy the previous `main` on Vercel (and the previous `develop` on staging);
  2. redeploy `account-admin` and `notifications` from the same previous commit;
  3. undeploy `invite-redeem` (`supabase functions delete invite-redeem`), or leave it, since it is harmless with no new tokens being issued.
- The migration stays. It is additive, and the old code runs on it unchanged: the guarded `invited_at` copy still records `inviteUserByEmail` sends (§5.2).
- After a rollback, run the restore in §8 (or re-send pending invites), because the migration nulled their dates.

**Why not the reverse, and why not make the new page accept both.**
- With functions first, new-format emails sent before the web deploy would point at `/portal/invite` on the old production site, which has no such route. The recipient would see a not-found page and have no way forward.
- With web first, the only exposure is an invite sent with the *old* function during the window. Its old-format link is refused with the normal expired message, which tells the person to ask for a new one, and step 3 fixes it.
- Accepting both formats would mean keeping the old `verifyOtp(type: 'invite')` path alive, which contradicts AC 38.

This replaces 01's "usual order" (migration, `account-admin`, web) for this release only. The Manager's stage-4 plan carries it.

## 10. Irreversible or costly — pause check (Q8)

- **No `PAUSE FOR SAURABH` is needed.**
  - **Auth architecture.** Saurabh has already approved the move to our own invite token. It is reversible: going back means calling `inviteUserByEmail` again, and the tables can be dropped. No Supabase Auth setting changes (A8), so nothing about password reset, MFA or sessions is locked in.
  - **Vendors and cost.** There is no new vendor. Resend is already used. Invites move from Resend SMTP to the Resend API on the same account and the same Free quota, and the daily total doesn't change. Nothing is paid.
  - **Data.** Two new private tables. The only data change is nulling `invited_at` on pending invites (§5.3), and Saurabh's step-3 re-send rewrites those dates.
- **For information, not a pause:**
  1. The "First admin" runbook changes (§1).
  2. Old tokens can be used directly against Auth for up to an hour (§7).
  3. Mobile shows invites as expired after an hour until D1 ships (§5.6).

## 11. Open items for the Solution Designer

1. Exact constant names (`INVITE_LIMITS`, `PORTAL_ROUTES.invite`, `PORTAL_QUERY.inviteToken`) and the page copy, reusing `AUTH_CONFIRM_PAGE.heading.invite` and `intro.invite`.
2. Hiding the `Invited on` line when `invitedAt` is null (§5.3).
3. The `_shared/email/` module split, and how the Node test script imports it.
4. Test list against AC 37, including pgTAP for the grants (§2), the store/claim/release functions, the trigger guard (§5.2) and back-dating `expires_at` (AC 5).
5. README updates: both kill switches (§6), "First admin" (§1, confirmed by the Developer), the local invite flow in Mailpit, clearing the local redeem bucket (§3.3), and "a link used up by a closed tab: re-send" (§4).

### Handover for stage 3 (review-2 findings 7 and others)

1. **AC 10 on `/portal/invite`:**
   - no `token` parameter → `invalidLink` card with no `Continue`;
   - any non-empty `token`, including a badly shaped one → `Continue`, then AC 9 from the server's `invite_invalid`.

   The page does **no** client-side shape check, so a garbled token looks like every other refusal (AC 11).
2. **AC 5 vs AC 23.** To back-date a link, Tester changes `private.invite_tokens.expires_at` **and** `public.profiles.invited_at` by the same amount in the **local** database, so the link and the chip agree.
3. **AC 38 fixture.** An account invited with `generateLink({ type: 'invite' })` gets an Auth `invited_at`. The guarded trigger copies it, so the admin chip shows `Invited`, which is expected for this fixture. The check is only that the old-format link is refused.
4. **AC 34.** "Unchanged" means the existing sign-in, two-step and password-reset tests pass as they are. The invite e2e (`invite-onboarding.spec.ts`) changes, per AC 37.
5. **AC 26.** The dialog's "14 days" is derived from `INVITE_LIMITS.linkLifetimeHours / 24`, not hard-coded.
6. **Deleted-user redeem test** (§4, finding 1d) and the rate-limit spec (§3.3).
7. **Manual REST check** of `private` (§2, finding 8).

## Decisions (for `_knowledge/decisions.md`)

1. **DEC-IN-1 (ADR-0010):** Invite tokens live in `private.invite_tokens`: one row per account (primary key `profile_id`, cascade from `profiles`), SHA-256 hex `token_hash` unique, `sent_at`, `expires_at = sent_at + 336 h`, `used_at`.
   - Revoked from `public, anon, authenticated, service_role`; RLS on with no policies.
   - Reached only through `public.invite_token_store`, `invite_token_claim` and `invite_token_release` (`security definer`, `search_path ''`, `service_role` execute only).
2. **DEC-IN-2 (ADR-0010):** Redeem is a separate function, `invite-redeem`, with `verify_jwt = false`, allowed origins only, and `POST { token }`. Its admin function stays `verify_jwt = true`.
   - The token is 32 random bytes as base64url (43 characters, 256 bits).
   - 10 attempts per 15 minutes per salted IP hash.
   - Every refusal gets the same reply, `invite_invalid`.
3. **DEC-IN-3 (ADR-0010):** Redeem claims the token, holding a `for share` lock on the profile. It then calls `auth.admin.generateLink({ type: 'recovery' })`, never `magiclink`, which signs up unknown e-mails.
   - It requires `user.id === profile_id` and `verification_type === 'recovery'`; otherwise it releases the claim and refuses. Any mismatch, whatever the type, refuses, releases the claim and logs `console.warn('invite-redeem', 'mismatch')`; the function never deletes a user (fix batch 1, 06-security finding 2).
   - It returns only `hashed_token`. The browser calls `verifyOtp({ token_hash, type: 'recovery' })`, retrying once and offering `Try again`, then opens `/portal/join`.
   - There is no `type: 'email'` fallback. Spike S1 and a deleted-user test confirm this locally.
4. **DEC-IN-4:** `profiles.invited_at` is set by `invite_token_store` after a send has been accepted. The auth update trigger copies Auth's `invited_at` only when it changes to a non-null value. The migration nulls `invited_at` on pending invites (AC 25). Mobile is unchanged (D1).
5. **DEC-IN-5 (ADR-0010):** Invites are sent directly from `account-admin` through the shared Resend/Mailpit transport (moved to `_shared/email/`), not through the outbox and not under the 70 cap.
   - The token is stored, and the old link switched off, only after the transport accepts the email.
   - Unsetting `EMAIL_TRANSPORT` stops invites and app email, but not Auth email.
6. **DEC-IN-6:** Old-format `type=invite` links are refused on the page without calling `verifyOtp`. The up-to-1-hour server-side residual is accepted. The Supabase invite template stays until D6. The "First admin" runbook moves to Add user plus password recovery.
7. **DEC-IN-7:** The migration is `20261030100000_invite_tokens.sql`, and it is additive.
8. **DEC-IN-8:** Release order:
   1. production web (`main`) live, checked at `https://ajclasses.com.au/portal/invite`;
   2. `deploy.sh` (migration, then functions including `invite-redeem`);
   3. re-send pending invites.

   No invites are sent in between, and no invite tests run on staging until step 2. A rollback moves web and functions back together and keeps the migration.
