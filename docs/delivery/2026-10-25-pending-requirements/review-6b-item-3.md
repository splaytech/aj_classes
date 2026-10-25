APPROVED

# Review 6b, item 3, round 2: verdict APPROVED

> **Round 2** · 25 Oct 2026 · amended `06-security-item-3.md` (committed in `90a31d8`), judged against
> the landed code at HEAD (which includes `6aeb734`, written after Security's re-check). Local stack only.

## Round 2

Security has fixed all four round 1 findings. The document is complete against the diff, with sound
severities and real evidence. The landed code meets corrected 2(a) in effect, with one small mismatch
in how it refuses (finding R2-1 below). That doesn't block this gate, and Security's "no open
blocking finding" still holds.

### Round 1 findings, re-checked

| # | Status | Evidence |
|---|---|---|
| 1 [blocking] fix 2(a) contradicted its exploit | **Fixed** | Finding 2(a) is rewritten. It explains why the first version couldn't work, and tells hosted from local by the built-in `SUPABASE_URL`, which a `secrets set` can't override (checked with `printenv` in the local edge runtime: `http://kong:8000`). It names 2(b), the README rule, as the interim control, and the release gate follows from that. 2(c) stays Later |
| 2 no closure section | **Fixed** | "Round 2: re-check of the fix commits" covers S1–S8, each with its status and code or local evidence |
| 3 S7 side effect on AC-3.5 | **Fixed** | Finding 7 notes it, and 01's change log accepts it |
| 4 cron/pg_net coverage | **Fixed** | A new "What was checked" row, from a real cron run: `cron.job_run_details` holds only the command, with 0 `%secret%` matches. `net._http_response` holds counts only, with 0 secret or `@` matches. Finding 8 now adds that `net.http_request_queue` briefly holds the `x-notify-secret` header, readable by `authenticated` through SQL only. That's a good find, and it strengthens the "never expose `net`" rule |

### Does the landed code (`6aeb734`) match corrected 2(a)?

| Corrected 2(a) asks for | Landed code | Match |
|---|---|---|
| Hosted when `SUPABASE_URL` is https, or not localhost/127.0.0.1/kong | `isHostedProject()`, which also treats an unreadable value as hosted | Yes, and fail-safe |
| On hosted, Mailpit or a non-https `SITE_URL` → flag rows, 503, claim nothing | `isUsableConfig()` → `config_missing` → `notify_flag_config_missing`, 503 | Yes |
| On hosted, the local secret → **401 before any RPC** | Passes the secret check, then 503 at step 3, after the idempotent flag RPC | **Partly**: same outcome (no claim, no send, no attempt used), different status, and one RPC runs |
| No change locally | The end-to-end test sends to Mailpit locally (169 ok) | Yes |
| Unit tests on both sides | `isHostedProject` / `isUsableConfig` / `gateRequest` checks for hosted and local | Yes |

The Developer's new ordering also runs the "no transport → 503" kill switch before the secret check.
The doc doesn't cover that, because Security reviewed before it landed. I accepted it in review-5
round 3: one bit of state leaks, and the flag RPC is an idempotent no-op on repeats.

### New findings (round 2)

R2-1. **[minor] `06-security-item-3.md` finding 2 and its Round 2 S2 row are stale against the landed code.**
- They still say "Partly fixed … the Developer is building the corrected guard now".
- **Fix:** add one line closing S2 against `6aeb734`. Either accept 503 + the idempotent flag RPC as
  meeting 2(a), or keep the "401 before any RPC" wording and have the Developer add the one-line
  step-2 refusal (review-5 R3-1).
- In the same line, accept or reject the "503 before the secret check" ordering, so the security
  record covers it.

### Next

This gate passes. R2-1 is a doc line, or a one-line code change. It can ride with the Tester stage
and needs no further Reviewer round.

---

# Round 1 (kept for the record; its first line was `CHANGES_REQUESTED`)


# Review 6b, item 3: Security review gate (`06-security-item-3.md`)

> **Reviewer** · 25 Oct 2026 · reviewed against `git diff ba9e286..HEAD`, which includes the fix commits
> `e160995`..`02fb148`, and against review-5 round 1. Local stack only.

## Verdict

The review is thorough and evidence-based. Live REST and psql probes give status codes and error
codes for every role, and there's a dry run of `deploy.sh` with sentinel values. Its coverage of the
diff is close to complete, and the severities are reasonable.

One finding needs correcting before this gate passes. Finding 2's recommended fix (a) can't close the
exploit the finding itself describes, and the Developer built exactly that fix. It's a short doc edit.
The code follow-up is already tracked as review-5 R2-1 (minor).

## Findings

1. **[blocking] Finding 2: fix (a) contradicts its own exploit (`06-security-item-3.md` finding 2, "Exploit" and "Fix (a)").**
   - The exploit is a manual `supabase secrets set` copying config.toml's `[edge_runtime.secrets]` to
     hosted. That copy sets `NOTIFY_WORKER_SECRET=local-notify-secret` **and** `EMAIL_TRANSPORT=mailpit`
     and `MAILPIT_URL`. The text says so: "With transport `mailpit` they go nowhere…".
   - Fix (a) says "refuse … when the expected secret equals `local-notify-secret` and `EMAIL_TRANSPORT`
     isn't `mailpit`". In the described scenario the transport *is* `mailpit`, so the guard never
     triggers. The alternative, "refuse whenever `SITE_URL` isn't https", would break local runs.
   - The Developer implemented (a) as `config.ts` `isUsableConfig()`, which exempts Mailpit, and dev
     notes §8 lists S2 as fixed. In fact the hosted worker would still accept the public secret after
     such a copy.
   - **Change:**
     - Correct fix (a) to something that works in that state. For example: tell hosted from local by
       the built-in `SUPABASE_URL` (`https://…supabase.co`), and there refuse the local secret and a
       Mailpit transport.
     - Say plainly that until then, **2(b) (README: hosted secrets only through `deploy.sh`, now at
       README:33) is the control** that meets the release gate.
     - Restate the release gate accordingly. 2(c), the git-ignored `functions/.env`, is correctly
       deferred in 04 §7 Later.
   - The severity stays **minor**: it needs an operator mistake that the README now forbids, the impact
     is lost emails (no data leak), and recovery is to re-run `deploy.sh`.

2. **[minor] No round 2 / closure section.**
   - The review was written before the fix commits. Since DoD §8.4 needs "no open blocking finding",
     the doc should record what was re-checked in `02232ec..HEAD`.
   - S1: `oneLine()` covers C0 and C1 in the subject and body, with unit checks.
   - S2: partial, see 1.
   - S3: wording drafted, waiting on B17.
   - S4 and S8: runbook and go-live boxes.
   - S7: `private.trim_history()`, revoked from callers, with pgTAP.
   - A short table is enough.

3. **[minor] S7's recommendation had a side effect the review didn't note.**
   - Deleting `sent`/`skipped` rows after 90 days also removes their `email_outbox_once` key. A
     re-return more than 90 days later sends a second email, which AC-3.5 says shouldn't happen
     (review-5 R2-2).
   - This isn't a security issue, but finding 7 was raised as the reason for the change. Add one line
     so the PO can accept it.

4. **[minor] Coverage: one small area not mentioned.**
   - `cron.job_run_details` (kept 7 days) and `net._http_response` (6 hours) both store data.
   - Holds today: the cron command is `select private.kick_email_worker()`, so no secret appears in it.
     The secret is read from Vault inside the function. The worker's response body is counts only.
   - A line in "What was checked" would make the review complete against the "no secrets in logs"
     requirement (brief check 3).

## Severities and evidence

- Finding 1 (header injection) is correctly minor: Resend builds the MIME headers itself, and only a
  trusted tutor can type the title.
- Finding 3 (Privacy) and finding 5 (Spam Act) are correctly handed to B17 and item 8.
- Finding 6 (shared DB) and finding 8 (pg_net SSRF exposure) are correctly info with runbook
  actions. On finding 8, the `PGRST106` probe is the right evidence.
- I spot-checked the evidence claims against the code: `transport.ts` logs only the status,
  `admin_email_problems` caps rows at 500, and the posts column grant blocks filtering and ordering on
  `author_id`. All three match.

## Next

Security amends finding 2 (and adds 2-4), then hands back for a doc-only re-check. No code change is
needed to pass this gate. The code hardening is review-5 R2-1, which is minor and can ride with the
Tester loop.
