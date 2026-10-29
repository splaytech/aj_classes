# 06 — Security review: invites stay valid for 14 days

Stage 6b of `/deliver`, Security. Branch `feature/invite-14-days`, diff `6a7d861..d35311c` (64 files). Date 2026-10-29.
Read against [02-architecture.md](02-architecture.md), [03-design.md](03-design.md), [05-dev-notes.md](05-dev-notes.md) and [ADR-0010](../../decisions/0010-own-invite-token-with-supabase-sign-in-hop.md). A code and config read only: the Tester owns the shared stack, so runtime facts (S1, log scans, REST 406) come from the dev notes.

**Verdict: APPROVED.** No Critical or High findings. Finding 1 (Medium) is cheap and goes into this branch before the `main` merge; it is not a gate (AC 8 is met as written). Findings 2–4 are Low; 5–9 are Info.

## What was checked

| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Token entropy | 32 bytes from `crypto.getRandomValues`, base64url, 43 characters (256 bits); shape checked before any DB call | `_shared/invite-token.ts:16-22`, `invite-redeem/redeem.ts:37` |
| 2 | Hash at rest | Only SHA-256 stored; `unique` and a hex check on the column; no salt needed at this entropy | migration `:14-21` |
| 3 | Single use, expiry | One `update … where used_at is null and expires_at > now() returning`; a parallel second claim gets null; 336 h set in SQL | migration `:120-126` |
| 4 | Only the newest link works | One row per account (PK `profile_id`); the store upserts the hash; release keys on the hash | migration `:65-71`, `:142` |
| 5 | Send, then store | A failed send stores nothing (old link survives); a failed store leaves a dead link (fail safe); a failed first invite deletes the account | `issue-invite.ts:33-38`, `handlers/invite.ts:34-37` |
| 6 | Claim guards | `status = 'invited' and is_active`, under `for share`, serialised with cancel | migration `:113-118` |
| 7 | Grants and RLS | Both tables: `revoke all` from public, anon, authenticated, service_role; RLS on, no policies; schema `private`. Functions: `security definer`, `search_path = ''`, execute only for service_role; pgTAP checks privileges, `prosecdef`, `proconfig`; REST `Accept-Profile: private` → 406 | migration `:38-41`, `:145-154`; `invite_tokens.test.sql:31-79` |
| 8 | Trigger change | Still `security definer`, `search_path = ''`; only the `invited_at` line changed (copies a new non-null value only) | migration `:164-183` |
| 9 | Recovery hop | `generateLink({type:'recovery'})` never creates a user; token returned only when `user.id === profile_id` and the type is `recovery`; `action_link`/`email_otp` dropped; browser verifies as `recovery` | `invite-redeem/index.ts:44-55`, `redeem.ts:62-64`, `confirmRecoveryLink` |
| 10 | Invite link to admin? | No: `admin_set_role` refuses unjoined accounts; at most a tutor, student or parent aal1 session | `20261007090320_student_parent_portal.sql:199-201` |
| 11 | Uniform refusals | Every token-dependent refusal is 200 `{ok:false,code:'invite_invalid'}`; 14 kinds byte-identical; no email input to enumerate | `index.ts:70-87` |
| 12 | CORS and origin | Exact-match `ALLOWED_ORIGINS` (hosted: prod + staging); other origins 403 | `_shared/cors.ts:10-21`, `deploy.sh:24` |
| 13 | `replaceState` before the POST | Yes (`invite.tsx:56` before `:60`), unit-tested; retry uses the in-memory token | `invite.tsx:47`, `:54-60` |
| 14 | Headers on `/portal/invite` | Portal CSP (`frame-ancestors 'none'`), `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: strict-origin-when-cross-origin`; no analytics on `/portal` | `apps/web/vercel.json`, `root.tsx:14-16` |
| 15 | Email | Constants only; link = `SITE_URL` + fixed path + base64url token, HTML-escaped; Resend JSON API; hosted refuses Mailpit and non-https `SITE_URL`; no fallback when `EMAIL_TRANSPORT` is unset | `invite-email.ts:21-62`; `_shared/email/config.ts:31-35` |
| 16 | Logging | Reason names, `error.name`/`error.code`, HTTP status only; token, hash and `tokenHash` absent from logs and `audit_log` | `redeem.ts:96-104`, `index.ts:86` |
| 17 | Response data | Success returns only `tokenHash` | `index.ts:83` |
| 18 | Injection | No dynamic SQL; parameterised RPCs; e2e helpers use placeholders | migration; `e2e/src/db/invites.ts` |
| 19 | Secrets | None in the diff or evidence; only the public publishable key in `deploy.sh` | diff scan |
| 20 | Dependencies | None added; lockfile untouched | `git diff --stat` |
| 21 | Git/config-driven execution | Not applicable | diff scan |

## Findings

1. **Medium (fix in this branch): the 14-day token stays in the URL and history from page load until Continue, and travels in the query string** (`invite.tsx:47`, `:56`; `invite-email.ts:22`; `vercel.json`). On a shared computer, `…/portal/invite?token=…` sits in (synced) history for up to 14 days; anyone who later clicks Continue takes the account. The full URL also reaches Vercel request logs and same-origin `Referer`. The window is 336 times the old link's. Fix: (a) strip the token on first render, keeping the in-memory copy; (b) carry it in the fragment (`/portal/invite#token=…`), which never reaches logs or `Referer`; update the constants, e2e regex and T4 test pattern. Recommend both.
2. **Low: a signed-out endpoint holds a `deleteUser` branch** (`redeem.ts:79-86`). Unreachable under `recovery` today, but if GoTrue ever returned a non-recovery type, a cancel-and-re-invite race could delete a real, fresh account from an unauthenticated request. Fix: drop the delete and only refuse, release and `console.warn('invite-redeem', 'mismatch')`; or add further guards (no token row, never confirmed, never signed in).
3. **Low (accepted residual, 02 §3.3): the rate limit keys on spoofable `x-forwarded-for`, and count-then-insert isn't atomic** (`client-address.ts:10-11`; migration `:97-104`). Bypass costs only function invocations (brute force stays infeasible); a known victim IP can be locked out for 15 min; NAT users share a bucket; a parallel burst can briefly exceed 10. Eventually: key on a proxy-set header verified on hosted, and optionally take an advisory lock; the same applies to `leads`.
4. **Low: no "stop redemption" kill switch** (`supabase/README.md`). Unsetting `EMAIL_TRANSPORT` stops new invites, but sent links stay valid for 14 days. Fix: document `update private.invite_tokens set used_at = now() where used_at is null;` (then re-send), and optionally `supabase functions delete invite-redeem`.
5. **Info: the success response has no `Cache-Control`** (`_shared/responses.ts:17-21`). Add `no-store` to `respond()` as defence in depth.
6. **Info: timing/status differs for a valid token, but only to its holder.** No change.
7. **Info: login CSRF is possible and mitigated** by `/portal/join` showing the account's email (`join.tsx:77`). No change.
8. **Info: the address-hash salt falls back to `''`** if `SUPABASE_SERVICE_ROLE_KEY` is missing (`client-address.ts:7`). Hosted always sets it; optionally refuse when empty.
9. **Info: the pre-join session is the same as the old invite's**, but each link is now a 14-day path to it (see finding 1).

## Residuals to accept (Saurabh)

1. Rate limiting is best-effort (finding 3); security rests on the 256-bit token.
2. If the tab closes between redeem and `verifyOtp`, the link is used up; the admin re-sends.
3. Mail scanners see the full link. GET doesn't consume it (Continue is required); a scanner that clicks buttons could; fix by re-send.
4. Whoever controls the invitee's mailbox for 14 days can take over the not-yet-joined account (inherent to email invites).
5. Hosted Auth logs show each redeem as `user_recovery_requested` plus a login; an outstanding reset token is cleared by the hop.
6. Staging and production share one project and are both allowed origins, so staging can redeem production invites (no new exposure).
