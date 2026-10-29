APPROVED

# Security review: item 8 ("new assignment" and "due tomorrow" emails)

> **Stage:** 6b (Security, T8.15) · **Date:** 26 Oct 2026 · **Branch:** `feature/more-email-alerts`
> **Scope:** `git diff 8e2af88...HEAD` without docs-only 996bfbe: the migration `20261028100000_more_email_alerts.sql`, `email_alerts.test.sql`, `supabase/functions/notifications/{copy,template,index}.ts`, `account.tsx`, `admin-emails.tsx`, `notifications.service.ts`.
> **Method:** code reading; probes on the **local** stack only inside `begin … rollback`; `pnpm db:test`; `template.ts` rendered under Node with hostile inputs. No hosted project, `.env*` or `supabase/.env.deploy`; no `test:functions`, reset, stop or start.

**Verdict:** nothing blocking. S1 answers 01b assumption 11: on by default is fine. S2–S5 are residuals or notes.

## Checked and held up

| Area | Evidence |
|---|---|
| Rule (b) doesn't widen to the new kinds | `email_still_relevant` (:113-125) uses `assignment_visible_to` for `new_assignment` and `due_tomorrow`; only `work_returned` uses `assignment_readable_by`. A removed student with a returned result: `due_tomorrow` 0, `new_assignment` 0, `work_returned` 2. A reminder queued before removal ends `skipped` at claim |
| Archived class, deactivated, unlinked, off switch | Archived class publish queues 0; deactivated roster row 0; deactivated login + unlinked parent 0; switches are per kind |
| Staff never receive | People set needs `role` student or parent (:146, :153) |
| No instructions, marks or answers | `copy.ts:52-80`: first names, title, class name, due date; "hasn't been handed in yet" only |
| HTML and header injection | `escapeHtml` and `oneLine` on every field; `<img onerror>`, `"><script>`, `'` breakout and CRLF + `Bcc:` titles produced no live markup and a one-line subject, all three kinds |
| Links | `SITE_URL` + fixed path + UUIDs; no `next=` in emails; sign-in `next` goes through `safeNextPath` |
| Definer functions | All 9 have `search_path=""`, schema-qualified names, no dynamic SQL; the 5 non-definer helpers pin `search_path` too |
| Execute grants | Private helpers `{postgres=X}`; `notify_claim_emails(text[])` `{postgres, service_role}`; `admin_email_problems(int)` adds `authenticated` and checks `is_admin`. Student and anon calls denied; `work_returned_recipients` dropped |
| Outbox unreachable by clients | Student SELECT and tutor INSERT denied |
| Own-row switches only | Insert or update another's row refused; `profile_id` not updatable; policies need an active student or parent |
| Admin list hides addresses | Returns `id, created_at, kind, recipient_role, assignment_title, state, reason` only |
| Deploy order | Migration first proven (dev notes §4), pinned in pgTAP; `deploy.sh` `set -euo pipefail`, `db push` before `functions deploy` |
| Storm and cap | Reminders first, then oldest; sweep before the cap's early return; terminal states; ≤ 3 attempts; every new-kind row has a deadline; kick posts only with cap room |
| Cron and Vault | Job runs `select private.queue_due_tomorrow_emails()` with no secret; Vault reads unchanged |
| Worker secret | `config.ts` and `gateRequest` unchanged |
| Frontend | Calls only via `services/notifications.service.ts`; no secrets, hosted ref, `innerHTML` or new dependency |
| pgTAP | 16 files, 704 tests, PASS |

## Findings

1. **S1 — Recommendation: on by default is fine for both new kinds** (01b assumption 11).
   - They tell existing account holders, or the parent who agreed to the account, facts about their own schoolwork; not offering or promoting anything, so not commercial electronic messages under the Spam Act 2003 s6. At worst they're Schedule 1 cl 2 "factual information" messages: exempt from consent (s16) and unsubscribe (s18), but must identify the sender (s17).
   - Sender identification is met: From `AJ Classes <hello@ajclasses.com.au>`, reply-to the same, brand header, footer "You're getting this because you have an AJ Classes portal account". Each kind has its own off switch, linked from every email.
   - **Conditions:** (a) never add promotional content (enrolment offers, upsells, "book a class") to these templates, or they become commercial messages needing consent and a working unsubscribe; (b) the Privacy sentence (`content.constants.ts:404`) stays accurate, approval with Saurabh under B17 / Q7.
2. **S2 — Low, accepted residual: a by-hand function-first deploy stops all email.** `index.ts:53-56`: the new worker's `notify_claim_emails(supported_kinds)` gets `PGRST202` on the old database, so "work returned" stops too until the migration lands; nothing is lost. Mitigated by the default argument, `deploy.sh` order and README/go-live. **Optional hardening:** on `PGRST202`, retry the claim with no argument.
3. **S3 — Low, availability.** Under cap pressure a "new assignment" backlog can delay "work returned" (FIFO after reminders), and a far-future due date's rows don't expire (`send_before` = due + 1). Fails visibly on Admin → Emails; chosen on purpose (ADR-0008, 02b §8.8 risk 2). Watch for a fortnight; later, cap the deadline at `least(due + 1, published + 7 days)` or claim `work_returned` second.
4. **S4 — Informational, for Saurabh at release (Q31).** Staging and prod share one database: the first 15:10 Melbourne run after the hosted migration reminds **real** families about published online work due the next day; from then on any staging publish emails real families. No backfill of "new assignment" for work published before the migration. State it in the TSR and release note.
5. **S5 — Informational:** the stale JSDoc at `account.tsx:276` (also review 5 finding 2).

## Residual risks

1. S2 and S3 as stated.
2. At release, read-only on hosted: migration applied before the function; `anon`/`authenticated` can't execute `notify_claim_emails(text[])` or any `private.email_*`/`private.queue_*` helper; `due-tomorrow-reminders` active.
3. T2.15: when `is_online_assignment` changes for file hand-in, reminders follow; re-run the grant query and the removed-student probe there.

**Lead note:** a local-only incident during the fix (dev notes §9) replaced the local seed with item 7 fixture data from about 05:05 UTC until the Developer's `pnpm db:reset`. This review's probes overlap that window. Its findings rest on code reading and `pnpm db:test` (which builds its own fixtures), so the verdict stands; the round 1 test run re-checks the recipient rules on the seed.
