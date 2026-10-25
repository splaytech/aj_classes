# 06b — Security review: item 3 ("Work returned" email)

> **Stage:** 6b of /deliver (Security) · **Date:** 25 Oct 2026 · **Branch:** `feature/work-returned-email`
> **Scope:** `git diff ba9e286..HEAD` (37 files), against 02-architecture item 3, ADR-0004, 03-design §3,
> 05-dev-notes-item-3. Includes `20261025110100_posts_public_columns_and_trim.sql`.
> **Method:** code read plus live probes against the **local** stack only (API `127.0.0.1:55321`, DB via
> `docker exec supabase_db_aj_classes psql`, Mailpit `:55324`). Hosted Supabase was not touched.
> `supabase/.env.deploy` was not read. `deploy.sh` was dry-run from a scratchpad copy with fake values.
> The one `notification_settings` row the probe created was deleted again, so the table is empty as the
> Developer left it.
> **Round 2 (same day):** amended after `review-6b-item-3.md` (CHANGES_REQUESTED). Finding 2's fix is
> corrected, finding 7 notes the AC-3.5 side effect, a cron/pg_net log row is added to the coverage, and
> the fix commits `02232ec..HEAD` are re-checked (see "Round 2" at the end).

**Verdict (round 2): pass. No open blocking findings.** S1, S3, S4, S7 and S8 are fixed or drafted.
S2 is partly fixed: the README rule (2(b)) is the control that meets the gate, and the corrected
code guard (2(a)) is minor follow-up work, now being built. S5 is a constraint for item 8.

## What was checked and held up

| Area | Evidence |
|---|---|
| `email_outbox`: no direct access for anyone | anon `GET /rest/v1/email_outbox` → 401 `42501`; student, parent, tutor, admin aal1 and admin aal2 → 403 `42501`. RLS is on with no policies, and all grants are revoked (migration step 3). |
| Worker RPCs (`notify_claim_emails`, `notify_record_result`, `notify_flag_config_missing`): service role only | All six callers → 401/403 `permission denied for function …`. `private.kick_email_worker` isn't reachable over REST (404 PGRST202). |
| `admin_email_problems`: active admin with two-step only | anon 401; student, parent, tutor and admin **aal1** → 403 `not_admin`; admin aal2 → 200. `max_rows: 100000` is capped at 500 (`least(greatest(…),500)`). It returns no address, name or body. |
| `notification_settings`: own row only, family roles only | Tutor and admin inserting for the parent → 403 RLS. Student inserting for the parent → 403. Student `PATCH` of the parent's row → 200 `[]` (row unchanged). Parent `PATCH profile_id` → 403, because there is no column grant. Parent `PATCH updated_at` → 403. Parent upsert with merge-duplicates → 403. `DELETE` → 403. Each person reads only their own row. |
| Who can make the trigger fire | `assignment_results` UPDATE/INSERT is limited to `private.can_manage_assignment` (admins and the class tutor), and `marked_by` isn't client-writable. Families can't make a return happen. |
| Worker endpoint auth | `GET` → 405. `POST` with no header, a wrong header, an empty header, or a user JWT and no header → 401 `not_allowed`. `secret.ts` uses `timingSafeEqual` and refuses an unset or empty expected value. |
| HTML injection | Rendered with `<img src=x onerror=alert(1)>"'&` in every name, title and class field: no raw `<img` in the HTML. Every interpolated value goes through `escapeHtml` (`template.ts:76-85`). The plain-text part has no HTML context. |
| Links | Both `href`s are `SITE_URL` + a fixed path + DB UUIDs (`template.ts:35-46`). No request input reaches a URL, so there is no open redirect. |
| No marks or feedback (AC-3.3) | The claim RPC returns no mark or feedback columns. The last Mailpit message's text has a title, class and links only (checked live). |
| No PII or raw provider errors stored or logged | `reason` is a fixed-code CHECK. `sendEmail` logs only the HTTP status (`transport.ts:118`). The catch logs `error.name` (`index.ts:62`). The batch logs counts. No address or body is stored. |
| No default transport | `pickTransport` returns null unless `EMAIL_TRANSPORT` is exactly `resend`+key or `mailpit`+URL (`transport.ts:21-32`). Null means a 503 and a "Set-up error" flag, and nothing is claimed. |
| Vault | `authenticated` has no SELECT on `vault.decrypted_secrets`, and `service_role` does. The migration holds no secret, and the cron function reads both values from Vault. |
| `deploy.sh` | Dry run with fake values: the password shows as `--password …`, every `NAME=value` shows as `NAME=…`, and 0 fake values appear in the output. With `NOTIFY_WORKER_SECRET=local-notify-secret` it stops: `✖ NOTIFY_WORKER_SECRET is the local value…`. After `secrets set` it unsets `MAILPIT_URL`/Zoho fakes and checks the hosted digests (transport `resend`, SITE_URL, not the local secret). |
| No committed live secret | Diff grep for `re_…`, `sk_`, JWTs and private keys: none. `local-notify-secret` and the Mailpit URL are local placeholders, and deploy.sh guards against them reaching hosted (see finding 2). |
| Test scripts can't reach a real inbox | `local-test-helpers.mjs:7-8` hard-codes `127.0.0.1:55321` and `:55324`. `sql()` is `docker exec` on the local DB container. The seed accounts are all `@local.test`. Mailpit never relays. |
| No retroactive email | The trigger fires only on a new transition to `returned` with `marked_by` set, and the migration has no backfill. Past returns on the shared DB email nobody. |
| Email bombing | Unique `(kind, assignment_id, student_id, recipient_id)` plus `old.status = 'returned'` early exit. pgTAP covers it (`email_outbox.test.sql:135`, return → mark → return again: still one per person). A global cap of 70 per rolling 24 h holds whatever staff do, and at least 30 a day stay free for sign-in email. |
| Posts migration (item 1 carry-over) | Anon: `select=id,title` → 200. `select=author_id`, `select=*`, `author_id=eq.…&select=id`, `order=author_id&select=id` and `select=id,author:author_id` → all 401 `42501`. The column grant blocks reading, filtering and ordering on `author_id`. The public client asks for `PUBLIC_POST_COLUMNS` only. |
| No secrets in the cron log or pg_net's tables | Local psql, after a real cron run. `cron.job` commands are `select private.kick_email_worker()` and `select private.trim_history()`. `cron.job_run_details` (kept 7 days) logs only that command text: 0 rows match `%secret%`. The worker URL and secret are read from Vault inside the function, so they never appear in the logged command. `net._http_response` (pg_net keeps about 6 hours) holds the response only: `200 {"ok":true,"data":{"claimed":2,"sent":2,"retrying":0,"failed":0}}`, with 0 rows matching `%secret%` or `%@%`. `net.http_request_queue` does hold the `x-notify-secret` header, but only until pg_net sends the request (0 rows at check time). It's readable only through SQL, not the API (see finding 8). |
| Dependencies | None added. `package.json` only changes the `test:functions` script. The worker uses the built-in `node:crypto` and plain `fetch`, with no SDK. No lockfile change. |

## Findings

1. **[minor] A tutor-typed title can put CR/LF into the email subject.**
   - *What:* `COPY.subject` puts `assignment_title` and the child's first name into `subject` with no filtering (`copy.ts:26-28`). `assignments.title` only checks length (`20261007061232_…sql:74`), so it can hold `\r\n`.
   - *Evidence:* rendering a title of `…\r\nBcc: x@y` gives `subject: "…\r\nBcc: x@y"`.
   - *Exploit:* small. Resend's JSON API builds the MIME headers itself, so a real header injection is unlikely. A tutor (a trusted role) could still produce a broken or odd subject, and Mailpit's API may behave differently.
   - *Fix:* in `renderWorkReturned`, swap control characters for a space in the subject (`subject.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ')`), and add a unit check to `test-notifications.mjs`.

2. **[minor] A known, committed worker secret can reach the hosted project through any `supabase secrets set` that skips `deploy.sh`.**
   - *What:* `config.toml:420-426` commits `NOTIFY_WORKER_SECRET = "local-notify-secret"`, `EMAIL_TRANSPORT = "mailpit"` and `SITE_URL = "http://localhost:5173"`. By the repo's own note, the CLI copies `[edge_runtime.secrets]` to hosted on `secrets set`. `deploy.sh` overrides these and then checks them, but a one-off manual command (say, rotating a Zoho token with `supabase secrets set ZOHO_REFRESH_TOKEN=…`) would push the local values back.
   - *Exploit:* once that happens, the hosted worker accepts a secret anyone can read on GitHub. Anyone can then POST to `/functions/v1/notifications` and make the worker claim queued rows. With transport `mailpit` they go nowhere, so rows burn their 3 attempts and end "failed". Real emails stop (cron's Vault secret no longer matches), with no data leak.
   - *Fix:*
     - (a) **Corrected in round 2.** The first version of this fix said: refuse the local secret only
       when `EMAIL_TRANSPORT` isn't `mailpit`. That can't work, because the copy described above also
       sets `EMAIL_TRANSPORT=mailpit` (and `MAILPIT_URL`), so the guard never triggers. The worker
       has to tell hosted from local by something the copy can't change: the platform's built-in
       `SUPABASE_URL`. It is `http://kong:8000` on the local runtime (checked with `printenv` in
       `supabase_edge_runtime_aj_classes`) and `https://<ref>.supabase.co` on hosted, and
       `secrets set` can't override it.
       - Treat the worker as **hosted** when `SUPABASE_URL` is `https://` and its host isn't
         `localhost`, `127.0.0.1` or `kong`.
       - On hosted, refuse if the expected secret is the committed `local-notify-secret`. Do this in
         the secret check, with a 401 before any RPC, so nobody holding the public value can trigger
         a claim.
       - On hosted, also treat `EMAIL_TRANSPORT=mailpit`, or a `SITE_URL` that isn't `https://`, as a
         set-up error: flag rows `config_missing`, return 503, claim nothing.
       - Locally (Mailpit, `http://localhost`, the local secret) nothing changes.
       - Unit-test both sides with an injected `SUPABASE_URL`.
       - The current `config.ts` `isUsableConfig()` exempts Mailpit, so it doesn't close this
         scenario (review-5 R2-1). The Developer is building the corrected guard now.
     - (b) **The control in the meantime:** `supabase/README.md:33` now says hosted function secrets
       change only through `deploy.sh`, and never by hand with `supabase secrets set`. Each
       `deploy.sh` run then checks the hosted digests and fails on a leftover local value. The
       deploy-time check now compares against the value just deployed (`deploy.sh:99-103`), and
       Saurabh is the only operator. So this rule is enough to meet the release gate until (a) lands.
     - (c) Later (04 §7 Later): move the local values to a git-ignored `supabase/functions/.env`, so
       nothing local can be copied. Check first that `supabase start` loads it.
   - *Severity stays minor.* It needs an operator mistake the README now forbids. The impact is lost
     or failed emails, with no data leak, and re-running `deploy.sh` fixes it.

3. **[minor] The Privacy Policy doesn't name the email provider or say it is overseas.** (For B17 wording; not edited.)
   - *What:* the new sentence (`content.constants.ts:403`) says families get the email. It doesn't say the email, with the recipient's name, address, child's first name and assignment title, is processed by Resend, a US service. The same section names Supabase and Cloudflare Turnstile and says they "may process data outside Australia", so leaving Resend out makes the policy incomplete. This gap was already there for sign-in emails.
   - *Why it matters:* APP 1.4(f)-(g) asks a privacy policy to say whether personal information is likely to go overseas, and to which countries where practical. AJ Classes may fall under the small-business exemption, but a published policy that leaves out a processor can still mislead.
   - *Fix:* change the end of the Supabase/Turnstile sentence to something like "…Cloudflare Turnstile to check that you are a person, and Resend (United States) to send sign-in and portal emails; all of these may process data outside Australia."

4. **[minor] Pasting the Vault secret into the Dashboard SQL Editor can leave it saved there.**
   - *What:* the release step (README "Work returned emails"; `deploy.sh` final heredoc) has Saurabh paste `NOTIFY_WORKER_SECRET` into the SQL Editor. The editor keeps queries as snippets/history.
   - *Fix:* add one line to the runbook: after running it, delete the snippet. Or run the two lines through `psql` against the hosted DB from a terminal with `HISTCONTROL=ignorespace`. Then check the value is only in Vault and the password manager.

5. **[minor] On-by-default is fine under the Spam Act today, but the off switch would not pass as an unsubscribe if the email ever becomes commercial.**
   - *Assessment:* as built, the message isn't a "commercial electronic message" (Spam Act 2003 s6). It reports one event about the recipient's own schoolwork, with no offer or promotion. The header "AJ Classes" isn't a link, and both links go to the portal. So consent and an unsubscribe facility (ss16, 18) aren't legally required, and on-by-default is OK. The off switch is good practice beyond the minimum.
   - *The catch:* ACMA has said that a promotional line, or even a link to the general homepage (including one hidden in a logo), can make a "service" email commercial. Then the Spam Regulations 2021 forbid unsubscribes that need a login. The current switch needs a sign-in, and D6 notes the `#notifications` hash is lost on sign-in.
   - *Fix:*
     - Keep this template free of marketing, and don't link the header to the homepage.
     - If item 8 adds anything promotional (term enrolments, new classes), it needs inferred or express consent and a one-click, no-login unsubscribe link (a signed token), working within 5 business days.
     - Optional now: add `List-Unsubscribe` headers when that token route exists.

6. **[info] Shared staging/prod DB: every staff return on either site emails real families.** This is by design (ADR-0004, Consequences) and the README says so. Two practical points for the release:
   - The trigger is live from `db push` (release step 2). Rows queued before the Vault entries (step 4) go out as soon as Vault is set. Run step 4 straight after step 2, and use the README kill switch (`cron.unschedule`) if the AC-3.11 test fails.
   - Testers on staging must use only the fake test family. Returning a real student's work on staging is a real return and sends a real email.

7. **[info] The outbox has no retention, and waiting rows never expire.**
   - Rows are bounded (one per return per person) and cascade with their assignment, so growth is slow.
   - Under a large backlog (70 a day), an email can go out days after the return.
   - Worth doing eventually: in the existing daily cron, delete `sent`/`skipped`/`failed` rows older than ~90 days. Optionally skip `pending` rows older than ~7 days with a new reason code.
   - **Side effect (round 2):** the 90-day trim also deletes the `email_outbox_once` key that enforces AC-3.5. So if work is returned, then un-returned and returned again **more than 90 days later**, the family gets a second email (review-5 R2-2). That isn't a security issue: it's one extra email per person per assignment at most, and the 70-a-day cap still applies. **The team lead has accepted it.** If it ever matters, keep a slim `(kind, assignment_id, student_id, recipient_id)` key table, or keep `sent` rows longer than the term.

8. **[info] pg_net is now enabled. `anon` and `authenticated` have USAGE on schema `net`, and `authenticated` can EXECUTE `net.http_post` (Supabase's default grants).**
   - It isn't reachable today: `POST /rest/v1/rpc/http_post` with `Content-Profile: net` → `PGRST106 Invalid schema: net`. Only `public, graphql_public` are exposed.
   - Keep `net` out of Dashboard → API → Exposed schemas on hosted. Otherwise any signed-in user gets server-side requests (SSRF).
   - Round 2: `authenticated` also has SELECT on `net.http_request_queue` and `net._http_response`. The queue briefly holds the cron call's `x-notify-secret` header. That's another reason never to expose `net`: exposing it would let a signed-in user read the worker secret as well. (`authenticated` has no USAGE on schema `cron`, so it can't read `cron.job_run_details`.)

9. **[info] Secrets travel as command-line arguments in a real `deploy.sh` run.** `supabase secrets set NAME=value …` and `--password` show in `ps` while running. That's fine on a single-user Mac. Note it if the script ever runs on shared CI.

10. **[info] Smaller notes, no action needed.**
    - `secretMatches` returns early on a length mismatch, so timing reveals the secret's length only. That's fine for a long random value.
    - Signed-in users can still read `posts.author_id` (`posts.test.sql:72`). That's intended, and a staff UUID is low-sensitivity.
    - If `seed.sql` were ever run against hosted (`db reset --linked`), it would also write the local Vault entries. That's harmless (wrong URL, a 401 secret), but it's another reason never to run that command.

## Release gates from Security

Restated in round 2:

- **Before merge:** finding 1 (done) and finding 2(b) (done, `supabase/README.md:33`). These meet the gate.
- **Minor follow-up, not gating:** the corrected 2(a) guard (`SUPABASE_URL`-based, review-5 R2-1). It
  should be in the release SHA if it lands during the Tester loop. If it isn't, the release still
  passes under 2(b), and the guard ships with the next deploy. The Tester re-runs
  `pnpm test:functions` once it's in.
- **Before telling families:** B17 approves the Privacy wording, including Resend (finding 3, drafted).
  Follow the runbook's snippet clean-up and "keep `net` unexposed" steps (findings 4 and 8, now go-live §7a boxes).
- **Before item 8 adds any promotional email:** a no-login unsubscribe (finding 5).

## Round 2: re-check of the fix commits (`git diff 02232ec..HEAD`)

Read-only, local stack only. Commits `e160995`, `794fe1a`, `eee5bd3`, `e6b1601`, `2bd6550`, `02fb148`.
S*n* = finding *n* above.

| # | Status | Evidence (code read and local checks) |
|---|---|---|
| S1 subject CR/LF | **Fixed** | `template.ts` `oneLine()` turns C0/C1 controls (`[\u0000-\u001f\u007f-\u009f]`) into a space. It covers the title, class, child name and greeting, so both subject and body. Escaping is unchanged. Unit check: `Fractions\r\nBcc: x@y` → subject `…Fractions Bcc: x@y`, with no control characters (`test-notifications.mjs`). |
| S2 local secret on hosted | **Partly fixed** | `config.ts` `isUsableConfig()` returns true for any Mailpit transport, so it doesn't fire in the copy scenario (see finding 2(a), corrected). The README rule is in (`README.md:33`), and it's the interim control. `deploy.sh:99-103` now requires the hosted digest to equal `sha256` of the deployed secret, which is stronger than "not the local value". |
| S3 Privacy names Resend | **Drafted, waiting on B17** | `content.constants.ts`: "…and Resend (United States) sends our sign-in and portal emails; all of these may process data outside Australia." `privacy.test.tsx` +1. |
| S4 secret in SQL Editor | **Fixed (runbook)** | README "Work returned emails" and the Vault heredoc `deploy.sh` prints both say to delete the query from snippets and history. go-live §7a box. |
| S5 Spam Act | **No change needed now** | The template is still factual only, and the header isn't a link (`template.ts` unchanged there). This is still a constraint for item 8. |
| S6 shared DB | **Fixed (runbook)** | go-live §7a: run the Vault lines "straight after the deploy". README test-family check unchanged. |
| S7 retention | **Fixed** | `private.trim_history()` is `security definer`, `search_path = ''`. It deletes cron log rows older than 7 days and `sent`/`skipped`/`failed` outbox rows older than 90 days, and keeps waiting rows. Job `daily-history-trim` runs `select private.trim_history()`, and `cron-history-trim` is gone (local `cron.job`: 2 jobs, both active). Execute is revoked from public, anon and authenticated: local `has_function_privilege` gives `f`/`f`. pgTAP covers delete and keep, the job command, and "Nobody else can run the trim". Side effect on AC-3.5 accepted (finding 7). The migration was edited in place, which is fine because it has never been pushed to hosted. |
| S8 `net` schema | **Fixed (runbook)** | README paragraph plus a go-live §7a box: exposed schemas stay `public` and `graphql_public`. |
| Other changes in the range | No new risk | Network errors now stop the batch, and released rows keep the same reason: fewer stranded `sending` rows, and the cap is unchanged. The test script resumes cron before restoring and checks the seed ids before pausing (local-only helpers unchanged). pgTAP covers the `no_address` path, which adds no PII. The posts migration changed only a comment. No new dependencies. No secrets in the diff. |

Round 2 result: no open blocking finding. S2(a) (corrected) is still open as minor.
