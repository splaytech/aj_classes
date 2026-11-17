# 02 — Architecture: open sign-up for everyone (round 3)

Stage 2 (Architect) of `/deliver`. Branch `feature/open-sign-up`. Date 2026-11-14. Round 3, after `review-2.md` Round 2 and Saurabh's Round 2 answers in `00-decisions.md`:

- **v1 is e-mail plus Google only.** Facebook and Apple are deferred.
- Residuals R1 and R2 are accepted.
- No custom Auth domain.
- **A provider login never attaches itself to an existing account.**

ADR: [ADR-0011](../../decisions/0011-open-sign-up-supabase-public-and-google.md) (Proposed).

**Sources.** I used the repo, the mobile repo, and the Supabase Auth (GoTrue) source at **v2.197.0** (`supabase/auth` on GitHub, tag `v2.197.0`). That is the local image `public.ecr.aws/supabase/gotrue:v2.197.0` and matches `supabase/.temp/gotrue-version`. "GoTrue" line numbers refer to it. I accessed no hosted Supabase.

## Recommendation

1. **Supabase public sign-up**, with e-mail confirmations on and the existing native Turnstile.
   - The form takes name and e-mail. The browser sends a random password that it never keeps.
   - The parent types their real password on the finish step (`/portal/join`, user variant).
   - **Google** uses `signInWithOAuth`.
2. **Every new account is a `user`.** The tutor-by-default mapping and the `profiles.role` default both become `user`. `deploy.sh` runs migrations, checks their effect, and pushes the Auth settings that open sign-up **last**.
3. **Proving the mailbox wipes any earlier password.** A trigger fires when `email_confirmed_at` is first set on an unfinished `user`. It clears the stored password and deletes any authenticator. A stranger who used the raw API can therefore never sign in. Only the mailbox owner can have a session before the account is finished.
4. **One linking rule.** A Google identity may be added only to a **brand-new** account: role `user`, still `invited`, unconfirmed, with no identity yet. Every other case is refused, so a Google login never attaches to an existing account.
5. **A Postgres `before-user-created` hook** holds the kill switch (an admin toggle, default open), the 15-a-day cap on new e-mail sign-ups, and the rule that Google must give a verified e-mail.
6. **Promotion** to parent is one audited admin function. With Facebook gone, it needs no password or session clearing: every finished user has proven the mailbox, which is the same proof an invite relies on.

**Decisions for Saurabh: none open.** Every one from rounds 1 and 2 is answered in `00-decisions.md`. Cap strictness and the enum value are my calls, recorded under "Architect calls".

## GoTrue v2.197.0 facts this design relies on

1. `signup.go:194-197`: a repeat `signUp` for an **unconfirmed** e-mail never updates the user, so the password is unchanged, and the confirmation is sent again (`:250`).
2. `signup.go:293-300, 357`: with confirmations on, a **confirmed** e-mail gets 200 with a fake user (`identities: []`), and nothing is sent. This is R1, accepted.
3. `signup.go:334-338`: user data is stripped only when `invited_at` is set. Our `createUser` invites have none, so invites must be created **confirmed** (Q2).
4. `user.go:524-531`: `Confirm()` updates only `confirmation_token` and `email_confirmed_at`. A `before update` trigger can still change other columns of the row. The existing `on_auth_password_set` (after update of `encrypted_password`, non-empty only) does not fire when the password is cleared.
5. `hooks.go:35-113`, `signup.go:186`, `external.go:207`: `before-user-created` fires for e-mail sign-up and for a **new** OAuth account. It doesn't fire for linking, or for admin `createUser`. `signup.go:101`: the hook sees `app_metadata.provider`. For OAuth, the hook's `user_metadata` carries the provider claims, including `email_verified` (to confirm in spike S1).
6. `models/linking.go`: a verified OAuth e-mail **links automatically** to any existing user with that e-mail, confirmed or not. `external.go:426`: a new OAuth account inserts its identity **before** `Confirm()`.
7. `external.go:405`: banned users are refused.
8. `provider/google.go:25`: Google's `email_verified` is used. If Google says the e-mail isn't verified, GoTrue still creates the user, sends a confirmation, and returns an error (`external.go:430-452`). The hook stops this (Q5).
9. `verify.go:285`: a `token_hash` + `verifyOtp` session (any e-mail link) gets the `amr` method `otp`. A password sign-in gets `password`, OAuth `oauth` (`models/factor.go`). The full value list is in `factor.go:68-100`.
10. `resend.go:94-119`: `resend` for an unknown or confirmed e-mail returns 200 and sends nothing.

## Q1 — Release safety and the kill switch

**Recommendation: check behaviour before and after migrating, then `config push` last. The kill switch is a database toggle.**

### `deploy.sh` order

| Step | What | On failure |
|---|---|---|
| 1 | link | stop |
| 2 | **gate:** sign-ups are off **or** `sign_up_guard_ready()` returns true | stop |
| 3 | `db push` | stop; sign-up still off |
| 4 | **check:** `sign_up_guard_ready()` returns true | stop; sign-up still off |
| 5 | functions | stop; sign-up still off |
| 6 | secrets (unchanged; **no new secret**) | stop; sign-up still off |
| 7 | `config push`: sign-up, Google, hook, confirmations, template | re-run; the database is already safe |

- **`public.sign_up_guard_ready()`** (granted to `anon`, returns a boolean only) checks **behaviour, not migration history** (review item 9). It returns true when all of these hold:
  - `private.role_from_app_metadata('{}') = 'user'`;
  - `role_from_app_metadata('{"account_role":"x"}') = 'user'`;
  - the column default of `profiles.role` is `'user'`;
  - the hook function and both triggers (Q3, Q4) exist.

  `deploy.sh` calls it with `curl` and the publishable key, the same way `signups_are_off` does today. Before the migration the function doesn't exist, so the check returns false and the gate falls back to "sign-ups are off", which is today's check.
- **Google credentials.** `deploy.sh` requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, used through `env()` in `[remotes.production.auth.external.google]`. If either is empty, it stops at "Checking what's needed", before anything runs. A provider is enabled only by a `config.toml` change, so v1 can't enable Facebook or Apple by accident: `config.toml` keeps them `enabled = false`.
- **AC-47 test:** a script runs `deploy.sh --dry-run` and checks gate → `db push` → guard check → functions → secrets → `config push`, in that order.
- **Kill switch.** One row, `private.sign_up_settings (open boolean not null default true)`.
  - Admin → Users toggles it through `admin_set_sign_up_open(open)` (admin, two-step, audited `sign_up_opened` / `sign_up_closed`).
  - The hook refuses every new account while it is closed.
  - `public.sign_up_status()` returns `open | busy | closed` for the page.
  - No migration, no secret, no redeploy (AC-48, AC-49).
  - Emergency fallback, a runbook line only: Dashboard → "Allow new users to sign up" off. The next `deploy.sh` turns it back on, so after using it, also close the admin toggle.
- **Release window** (review item 10): between steps 3 and 5, the old `account-admin` creates staff with no marker. The trigger makes them `user`, the role check deletes them, and the admin sees `server_error`. That is safe, but don't invite during a deploy. `templates/invite.html` is unused since ADR-0010; its condition becomes `eq . "parent"`.

## Q2 — What a new Auth user becomes

| Path | Set by server | Role | Status | `email_confirmed_at` |
|---|---|---|---|---|
| E-mail `signUp` | `provider: email` | `user` | invited | null until a link is used |
| New Google account | `provider: google` | `user` | invited | set by GoTrue |
| Staff invite | `account_role: tutor` | tutor | invited | set (`email_confirm: true`) |
| Student/parent invite | `account_role: student/parent` | student/parent | invited | set |

- **Role** comes only from server-set `app_metadata.account_role`. `student`, `parent`, `tutor` and `user` map to themselves; anything else, or nothing, maps to `user`. The `profiles.role` default becomes `'user'` (review item 4). `user` is added to the enum in its own migration file first (`20261007090319_family_roles.sql` precedent).
- **Name.** Only `full_name` is read from `user_metadata` (e-mail form or Google claims), and the finish step checks it again (AC-4).
- **Invites are created confirmed** (`createInvitedAccount` passes `email_confirm: true`). The migration sets `email_confirmed_at = now()` where it is null, for every existing non-`user` account. This does three things:
  1. With confirmations on, no active or invited account is locked out (AC-42).
  2. `signUp` with an invitee's e-mail gets Auth's quiet reply (200, `identities: []`; since `[auth.sms] enable_confirmations = true`, built in fix batch 2) and sends nothing (fact 3; AC-12, AC-13).
  3. The Q4 trigger never touches invitees.
- **`complete_onboarding` refuses `role = 'user'`.** `my_onboarding` excludes users, so mobile never shows "invited, unfinished" for one (AC-40). A new `my_sign_up()` serves the web.
- **Mobile is unchanged.** `RoleResolver` gives null for a `user`, so the app shows its "Unresolvable role" state, with no data and no crash. Mobile has no Google button, and a Google-only user has no password until they use Forgot password.

## Q3 — Linking: one rule

**The rule** (fixes review item 2 and Saurabh's "never attaches"): a `before insert` trigger on `auth.identities` (security definer).

- An `email` identity is always allowed.
- A `google` identity is allowed **only if** the user's profile has `role = 'user'`, `status = 'invited'`, `auth.users.email_confirmed_at is null`, **and** the user has **no identity yet**. That describes a brand-new account in the transaction GoTrue is creating it in (fact 6).
- **Any other non-e-mail provider is refused** (fail closed).

| Google e-mail matches | GoTrue does | Trigger | Person sees |
|---|---|---|---|
| nothing | creates account | allow | finish step |
| account made with this Google | signs in (no insert) | not reached | as normal |
| unconfirmed e-mail sign-up | link | **refuse** | message M |
| finished user (e-mail) | link | **refuse** | message M |
| tutor / admin / invitee / parent / student | link | **refuse** | message M |
| deactivated, any kind | link | **refuse** | message M |
| promoted parent who signed up with Google | signs in (no insert) | not reached | parent home |

- **Message M** (one for every refusal): `This e-mail already has an AJ Classes account. Sign in with your e-mail and password, use Forgot password, or use the link we e-mailed you.` The callback page shows it for any error from the Google round trip. Spike S3 confirms what the page receives.
- A deactivated person who then signs in by e-mail sees today's "not active" message.
- Showing M isn't enumeration: Google has just shown the person controls that mailbox.
- Manual linking stays deferred (D13), and `enable_manual_linking = false` stays.

## Q4 — E-mail sign-up and the confirm-time wipe

**Recommendation: no password on the form. A throwaway random password is sent. A `before update of email_confirmed_at` trigger on `auth.users` wipes any password and authenticator when an unfinished `user` first proves the mailbox.**

**Trigger `private.wipe_unproven_credentials()`.** It fires when `old.email_confirmed_at is null and new.email_confirmed_at is not null` and the profile is `role = 'user'`, `status = 'invited'`. It:
- sets `new.encrypted_password = null`, as GoTrue's own `RemoveUnconfirmedIdentities` does (`user.go:1023`);
- deletes that user's `auth.mfa_factors` (a defence: an unconfirmed account can't sign in, so it can't enrol one).

It fires for:
- the confirmation link;
- Forgot password on an unconfirmed sign-up (`verify.go` `recoverVerify` confirms, `:378-385`);
- a new Google account (harmless: no password, no factors).

**Why this closes review item 1.**
- With confirmations on, no password sign-in works before confirmation (spike S4).
- At confirmation, every earlier password is gone: the stranger's P1 and the form's throwaway.
- So before the account is finished, the only sessions that can exist are e-mail-link sessions, which only the mailbox owner can start. A stranger has nothing to loop `updateUser` with and nothing to enrol TOTP with.

**Finish step: `complete_sign_up(new_full_name, accepts_terms)`.** It requires:
1. the caller is `role = 'user'`, `status = 'invited'`, `is_active`;
2. the session's `amr` has **at least one** entry in {`otp`, `recovery`, `email/signup`, `magiclink`, `oauth`}. Anything else fails closed: a session holding only `password`, `token_refresh` or an unknown value can't save. Our e-mail links use `token_hash` + `verifyOtp`, so they give `otp` (fact 9), and Google gives `oauth`. The other values are listed so a later move to PKCE e-mail links (review item 6) can't silently lock people out. Spike S5 confirms the values;
3. for an account with no `google` identity, a password set in this session: `password_set_at >= (select created_at from auth.sessions where id = (auth.jwt() ->> 'session_id')::uuid)`;
4. the AC-4 name rule, and `accepts_terms` true.

It then:
- sets `terms_accepted_at`, `status = 'active'` and `joined_at`;
- **deletes the user's `auth.mfa_factors`** (review item 1), and deletes every other `auth.sessions` row;
- audits `account_activated` with `{ role: 'user', via: 'email' | 'google' }`.

**Live access tokens (stage-1 Round 6 note 1): reword, not an RLS change.** Deleting sessions revokes their refresh tokens. An access token already issued stays valid up to `jwt_expiry` (3600 s). After the wipe, only the mailbox owner can hold such a token, and while the account is a `user` it reads only its own profile and posts. A `session_id` check in RLS would protect nobody else and would touch every policy, so I recommend the reword in "Changes to 01".

**Other unfinished states**
- **Password sign-in to an unfinished account.** This is only possible with a password the owner set in a step that then failed to save. The web reads `my_sign_up()`, sees the session is `password`-only, signs out, and shows the AC-20 message.
- **Enumeration.** The page shows one message (AC-10, AC-12). The raw reply differs (R1, accepted).

## Q5 — Cap, kill switch and verified e-mail in one hook

`public.hook_before_user_created(event jsonb)` (security definer, executable only by `supabase_auth_admin`) runs under one global `pg_advisory_xact_lock(<constant>)`. It refuses with `{"error": {"http_code": 429, "message": "…"}}` when:
1. `private.sign_up_settings.open` is false (any provider);
2. the provider is `google` and the hook `user` has `user_metadata.email_verified` not true, or an empty e-mail (review item 5). No user is created, no confirmation is sent, and the empty-e-mail `profiles.email` clash can't happen;
3. the provider is not `email` or `google` (fail closed);
4. the provider is `email` and `private.sign_up_emails` holds `private.sign_up_daily_cap()` (= 15) rows newer than 24 hours.

Otherwise it inserts a row (for `email` only) and allows.

- **A slot is used even if the sign-up then fails** (review item 8). The hook runs outside GoTrue's transaction, and it errs on the side of using a slot.
- **The cap filling between `sign_up_status()` and `signUp`.** The page shows "busy" on the 429. In that moment, a new e-mail gets "busy" while an existing one gets "Check your e-mail". This is part of R1, accepted.
- **Outside the cap** (R2, accepted): confirmation resends (60 s per address, plus Auth's `email_sent = 30` per hour), Forgot password, and Google sign-ups (no e-mail).
- **Confirmations on**:
  - a branded `[auth.email.template.confirmation]` (`supabase/templates/confirmation.html`), linking to `/portal/auth/confirm?token_hash={{ .TokenHash }}&type=email`;
  - `auth-confirm` accepts `type=email`;
  - AC-42's lock-out tests apply.

## Q6 — Captcha

Keep the native `[auth.captcha]` Turnstile. It already guards sign-in, Forgot password and mobile login, and it also guards `/signup` and `/resend` (spike S2). Nothing changes for existing flows or mobile. Google's own sign-in is the bot check for the Google button, and the hook still holds the switch.

## Q7 — Google setup, redirects, CSP, local testing

- **Saurabh's setup** (credentials in `.env.deploy` and the password manager):
  - A Google Cloud project, with the OAuth consent screen set to External, In production, scopes `openid email profile`. These are non-sensitive scopes, so Google's app verification isn't needed.
  - A Web client with authorised redirect `https://unzjnxctkyahtmrkinyr.supabase.co/auth/v1/callback` and JavaScript origin `https://ajclasses.com.au`.
  - The consent screen will name `unzjnxctkyahtmrkinyr.supabase.co`. That was accepted with "no custom domain".
- **Redirects.** `additional_redirect_urls` gains `https://ajclasses.com.au/portal/auth/callback` and the staging one; local config gains `http://localhost:5173/portal/auth/callback`. The new `/portal/auth/callback` page calls `exchangeCodeForSession`. The client keeps `detectSessionInUrl: false`.
- **CSP.** No change. OAuth is a top-level navigation, and the code exchange is a fetch to the Supabase origin, which `connect-src` already allows. `form-action 'self'` is unaffected.
- **Button.** It shows only when public `GET /auth/v1/settings` lists Google as enabled.
- **Local testing without real credentials**
  - pgTAP inserts `auth.users` and `auth.identities` rows shaped like Google, covering every row of the Q3 table, the hook, both triggers and `complete_sign_up`.
  - The e2e covers e-mail sign-up through Mailpit. The Google button is checked for presence and for the URL it builds.
  - Optional: a dev Google client with redirect `http://127.0.0.1:54321/auth/v1/callback` allows one manual local run.
  - Staging shares the production project, so the real Google check after deploy is Saurabh's.

## Q8 — Access sweep, grants, promotion, reactivate

- **Access sweep.** Unchanged from the earlier design, and confirmed in review-2. Every rule a `user` reaches is a closed list. The only open rule is "read your own profile". Users have no profile update. Web: `AppRole += 'user'`, the member area includes `user`, a user home with the `/posts` list, and Notifications only for `student`/`parent`.
- **Grants.** Every new function starts with `revoke execute … from public, anon, authenticated`:

  | Function | Executable by |
  |---|---|
  | `hook_before_user_created` | `supabase_auth_admin` |
  | `sign_up_status`, `sign_up_guard_ready` | `anon`, `authenticated` |
  | `complete_sign_up`, `my_sign_up` | `authenticated` |
  | `admin_set_sign_up_open`, `admin_promote_user`, `admin_user_sign_in_methods` | `authenticated` (checks `is_admin()` inside) |
  | trigger functions, `private.*` | nobody |

  `private.sign_up_settings` and `private.sign_up_emails` have all rights revoked, and RLS is on with no policies. All of these go into the AC-26 sweep.
- **Data model.** The enum value `user` and the default `'user'`. No new profile columns. The sign-up method comes from `admin_user_sign_in_methods(target)` (`auth.identities.provider`) and shows as `E-mail` or `Google`.
- **Promotion (parent only).**
  1. `invite-parent` with an active, finished user's e-mail returns `needsConfirmation` with the sign-up date and method.
  2. After the admin confirms, `admin_promote_user(target, student)` runs under the admin's session, in one transaction: `is_admin()`, lock the profile, `role = 'parent'`, insert `student_guardians`, audit `parent_linked` with `{ promoted_from: 'user' }`.
  3. Then `app_metadata.account_role = 'parent'`; `syncAccountRole` heals a failed step on retry.
  4. **No password, factor or session clearing** (review item 3, re-checked for Google). An unfinished account can't be promoted, and every finished account has proven the mailbox: an e-mail link (after the Q4 wipe) or a Google-verified e-mail. That is the proof an invite relies on. Google only marks an address verified after the Google account holder has confirmed it. No one else can hold a password, factor or session on the account, so there is nothing to clear. This changes back if Facebook comes in (see Deferred).
  5. `invite-student` and `Invite staff` with a finished user's e-mail stay `already_exists`. Any invite replaces an unfinished sign-up (cancel-invite's race-safe delete). The fact-13 guard is untouched.
- **Reactivate.** Through the existing `set-active`. `admin_set_active` stops refusing "never joined" for `role = 'user'`. A deactivated user is banned, so Google refuses too (fact 7). The trigger already refuses any new link.

## Stage-5 spikes: the Developer's first tasks, each with a test

| # | Spike | Test |
|---|---|---|
| S1 | `before-user-created` works locally and on the hosted plan. Saurabh checks Dashboard → Authentication → Hooks (read-only, his to do). The `{"error":{"http_code":429,"message"}}` format reaches the client. A `security definer` hook works. The hook input has `app_metadata.provider` and, for Google, `user_metadata.email_verified` | integration: 16th e-mail sign-up gets 429; switch closed gets 429; Google with `email_verified=false` creates nothing |
| S2 | Native captcha covers `/signup` and `/resend` | integration: both without `captcha_token` are refused |
| S3 | `postgres` can create the `auth.identities` and `auth.users` `before` triggers and delete from `auth.mfa_factors` and `auth.sessions`. Locally by test; hosted, the migration fails at step 3 if not, and sign-up stays closed. What the callback page receives when the trigger raises | pgTAP for the triggers; e2e: callback with an error shows message M |
| S4 | Password sign-in to an unconfirmed e-mail returns `email_not_confirmed`, and the page shows `Email or password is incorrect.` | integration + web unit |
| S5 | `amr` values at v2.197.0: `token_hash`+`verifyOtp` (signup, recovery) → `otp`; Google PKCE → `oauth`; password → `password`; refresh keeps the entries. Unknown values fail closed | integration: finish saves from link and Google sessions, refused from a password session |
| S6 | The Q4 wipe survives GoTrue's later writes in the same verify (no write puts the old hash back) | integration: AC-14 cases 1, 3, 4, 5, and a factor inserted before confirmation is gone after it |
| S7 | Google with `flowType: 'pkce'` doesn't change today's recovery and e-mail-change links (`token_hash`). Otherwise, a separate PKCE client for Google only | e2e: reset and e-mail change still work |

## Changes to 01 (AC by AC; the PO copies these so 01 and 02 match)

1. **Scope v1 item 1**: "name, e-mail, Turnstile". There is no password on the form (matches AC-2).
2. **Scope v1 item 2 / AC-2 / AC-51**: only `Continue with Google`. Facebook and Apple move to Deferred (new D14 Facebook, D15 Apple). A13 covers only the Google Cloud OAuth client.
3. **AC-6**: add "Any password stored before the mailbox was proven is wiped when it is proven (02 Q4), so the finish-step password is the first one that works."
4. **AC-14, opening**: "A password stored before the mailbox was proven is wiped the moment it is proven (by the confirmation link or a Forgot-password link). Before that, no password can sign in, because confirmations are on. So before the finish step, only the mailbox owner can hold a session." Cases:
   1. A signs up; B finishes from the link and types P2: only P2 signs in.
   2. *(Replaced)* A signs up; B uses Google with that e-mail: refused with message M (AC-54). B finishes from the link or Forgot password: only B's password signs in.
   3. A then B sign up; B finishes from the newest link: only B's password.
   4. B then A sign up; B finishes from the newest link: only B's password.
   5. *(Replaced)* A signs up through the raw API with P1; B clicks the link but doesn't finish; A tries P1: `Email or password is incorrect.` A never gets a session. When B finishes, only B's password signs in.
   6. *(New)* An authenticator row present before confirmation is gone after it, and one enrolled before finishing is gone after the save.

   Session wording: "Saving deletes every other session. An access token already issued to another of the owner's own sessions keeps working until it expires (at most 1 hour), and reads only the user's own profile and posts."
5. **AC-17**: replace the `amr` sentence with "The server saves the step only from a session made by an e-mail link (confirmation or Forgot password) or a Google sign-in, never from a password-only session; unknown session types are refused (02 Q4). Saving also deletes any authenticator."
6. **AC-19 / AC-20**: one hint wording, `To finish signing up, use the link we e-mailed you, or Forgot password.` This replaces "Already confirmed? Use Forgot password to finish." in AC-19, so AC-19 and AC-20 show the same text.
7. **AC-31**: sign-up method is `E-mail` or `Google`.
8. **AC-33**: message `This e-mail belongs to a signed-up user. They'll become a parent of <child>.` Drop the sign-out and Facebook text.
9. **AC-35**: "A promoted account keeps its password and its Google sign-in, and its sessions." Drop the Facebook and sign-out sentences.
10. **AC-43**: "…sign in with Google, and we get only their name and e-mail from Google."
11. **AC-44**: drop the Facebook promotion test. Add:
    - AC-14 cases 1–6;
    - each row of the Q3 linking table;
    - the hook's three refusals (closed, cap, unverified Google);
    - a promoted Google user still signs in with Google as a parent;
    - the `deploy.sh` dry-run order and `sign_up_guard_ready()`;
    - each stage-5 spike's test (S1–S7).

    Provider testing becomes "Google only".
12. **AC-46, R2 text**: "…After that, password resets, e-mailed sign-in codes, invites and portal e-mails (new work, due tomorrow, returned work) fail for everyone until the next day." Also add: "A sign-up whose slot was taken but then failed still uses that slot."
13. **AC-48**: add "Emergency fallback: Dashboard → Allow new users to sign up. The next deploy turns it back on, so close the admin control too."
14. **AC-52**: "provider" becomes "Google".
15. **AC-53**: "If Google gives no e-mail or doesn't say it is verified, no account is created and no e-mail is sent (the hook refuses). The page says `We couldn't get a verified e-mail address from Google. Please sign up with your e-mail instead.`" Drop the Apple relay sentence (D12 moves under D15).
16. **AC-54** (Saurabh: never attaches): replace bullets 2–4 with one: "Matching **any** existing account that wasn't made with Google (including an unfinished sign-up and a deactivated account): no sign-in and no link. It shows one message, `This e-mail already has an AJ Classes account. Sign in with your e-mail and password, use Forgot password, or use the link we e-mailed you.`" Bullet 1 stays (an account made with Google signs in as normal). Drop the [ASSUMPTION].
17. **US8, AC-28, AC-45, AC-55, D3, D13**: "provider" means Google in v1.
18. **Decisions list**: Decision 1 (Facebook safeguard) is moot. Decisions 4 (cap) and 6 (enum) are the Architect's calls. Saurabh has nothing open.

## Architect calls (recorded, not asked)

1. **Cap strictness**: the hook counts new e-mail sign-ups only. An Auth send-email hook (every Auth e-mail through our code) is the later option if R2 bites. Saurabh's fallback is Resend Pro.
2. **The `user` enum value**: kept. It is effectively permanent, and an unused value is harmless.
3. **Live access tokens**: reworded (AC-14), not enforced with an RLS `session_id` check, because only the owner can hold one (Q4).

## Decisions for Saurabh (pause)

**None open.** Rounds 1 and 2 of `00-decisions.md` answered everything:

1. live at release;
2. parents only;
3. Supabase sign-up;
4. Free with the cap, a Terms page first, the link on Sign in only;
5. Google only (Facebook and Apple deferred);
6. R1 and R2 accepted;
7. no custom domain;
8. no attaching to existing accounts.

## Deferred: adding Facebook or Apple later

- **Facebook** (D14):
  - GoTrue marks every Facebook e-mail verified (`provider/facebook.go:96`), so a Facebook-made account isn't proof of the mailbox.
  - Adding it needs: the hook allowing `facebook`; and promotion of an account that has or had a Facebook identity clearing its password and `auth.mfa_factors`, deleting the identity and sessions, and (for live tokens) a `session_id` check in `my_active_role` / `my_student_id`. The parent then sets a password with Forgot password.
  - The linking rule above already covers it, unchanged.
  - Meta app setup (Facebook Login, a data-deletion URL, Live mode, possibly business verification).
- **Apple** (D15):
  - Apple Developer membership (US$99 a year, unless the mobile app's membership exists), a Services ID, a `.p8` key, and a client-secret JWT renewed **every 6 months**.
  - Register `ajclasses.com.au` for Apple's private e-mail relay, or confirmation and reset e-mails to relay addresses bounce.
  - The name arrives only the first time.
  - Relay addresses make staff linking harder (D12).
  - Add `apple` to the hook and the trigger's allowed list.
  - Apple can't be tested on localhost.

## What changes where

| Area | Change |
|---|---|
| Migrations | `…_user_role.sql` (enum); `…_open_sign_up.sql`: role mapping and default; confirm existing non-user e-mails; `sign_up_settings`, `sign_up_emails`; hook; `auth.identities` linking trigger; `auth.users` confirm-time wipe trigger; `complete_sign_up`, `my_sign_up`, `sign_up_status`, `sign_up_guard_ready`, `admin_set_sign_up_open`, `admin_promote_user`, `admin_user_sign_in_methods`; guards in `complete_onboarding`, `my_onboarding`, `admin_set_active`; audit actions |
| `config.toml` | `enable_signup = true`, `enable_confirmations = true`, `[auth.hook.before_user_created]`, confirmation template, `[auth.external.google]` (local off) and `[remotes.production.auth.external.google]` with `env()`, redirect URLs. Facebook and Apple stay off |
| `deploy.sh` | Q1 order, guard check, Google env requirement, dry-run order test |
| Functions | `account-admin`: `email_confirm: true` and `account_role: 'tutor'`; promotion confirm in `invite-parent`; `replaceUnfinishedSignUp`; `resend-invite` refuses users. No new function |
| Web | `/portal/sign-up`; `/portal/auth/callback`; `auth-confirm` `type=email`; `/portal/join` user variant; user home; Account trim; Admin → Users (list, method, Deactivate/Reactivate, switch); Sign in link and Google button; Terms page; Privacy text |
| Mobile | none |

## Release order and rollback

1. Production web first. The link and button stay hidden while Auth says sign-up is off.
2. `deploy.sh`, whose step 7 opens sign-up.
3. Saurabh tests e-mail sign-up and Google on production.
4. To close: Admin → Users switch (instant). To roll back fully: `enable_signup = false` in `config.toml`, then `deploy.sh`. The migration stays.

## Risks

1. **R1 and R2**: accepted by Saurabh.
2. **The design depends on `postgres` creating triggers on, and deleting from, `auth` tables on hosted (S3).** If it can't, the migration fails and sign-up stays closed.
3. **GoTrue upgrades** could change linking, the hook or `Confirm()`. The pgTAP and integration tests from S1–S6 run on every local stack bump.
4. **The enum value is permanent** (Architect call 2).

## Decisions recorded (for `_knowledge/decisions.md` once approved)

- **DEC-OS-1 (ADR-0011):** Supabase public sign-up (e-mail, confirmations on, native Turnstile) plus Google only. The form sends a throwaway password; the real one is set on the finish step. Facebook and Apple are deferred.
- **DEC-OS-2 (ADR-0011):** No marker → `user` (mapping and column default). Staff invites set `account_role = 'tutor'`. Invites are created confirmed, and the migration confirms existing non-user accounts.
- **DEC-OS-3 (ADR-0011):** `deploy.sh`: gate (off, or `sign_up_guard_ready()`) → `db push` → guard check → functions → secrets → `config push` last.
- **DEC-OS-4 (ADR-0011):** The `before-user-created` hook enforces the kill switch (`private.sign_up_settings.open`, admin toggle, default open), a verified non-empty Google e-mail, fail-closed providers, and 15 new e-mail sign-ups per rolling 24 h under one advisory lock.
- **DEC-OS-5 (ADR-0011):** One linking rule: a `google` identity is inserted only for a `user` that is `invited`, unconfirmed and has no identity. Everything else is refused.
- **DEC-OS-6 (ADR-0011):** At first mailbox proof, the `auth.users` trigger clears `encrypted_password` and deletes `auth.mfa_factors` for an unfinished `user`. `complete_sign_up` needs an e-mail-link or Google `amr`, a password set in that session (e-mail accounts) and Terms. It deletes factors and other sessions.
- **DEC-OS-7:** Promotion (parent only) is `admin_promote_user` plus `app_metadata.account_role`, with no credential clearing while only e-mail and Google exist. Reactivate is in v1.
