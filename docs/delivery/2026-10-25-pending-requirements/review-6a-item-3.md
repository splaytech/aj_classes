CHANGES_REQUESTED

# Review 6a, item 3: test plan gate (`06-test-plan-item-3.md`)

> **Reviewer** · 25 Oct 2026 · plan at `4af50eb` (93 cases, E-01–E-105), against 01 item 3 (AC-3.1–3.11 and its
> change log), 03 §3, and the landed code at HEAD (`config.ts` gate order, `deploy.sh`, migration, seed).
> I checked the expected results against the running local stack, read-only.

## Verdict

This is a strong plan:
- Every AC is traced (§3 coverage line). The untestable parts are named, each with an owner (§4, §5).
- Hosted is fenced off: E-01 to E-03 come first, and `deploy.sh` runs only as a copy under `env -i`,
  with fake `supabase` and `curl` and no `.env.deploy` next to the copy (E-60 checks that).
- The fixtures have a clear apply and restore order (X1–X13). The IDs are stable and append-only.
- The expected results match the landed behaviour on the points asked about:
  - 503 before 401 when the transport is unset (E-50, E-98, E-103, known non-bug 9);
  - 503 for local values on hosted (team-lead decision 2, E-102);
  - `daily-history-trim` (E-100);
  - the 90-day `[ASSUMPTION]` (E-105);
  - network-stop attempts (decision 1).

Two problems would make the Tester record false failures, so they block the freeze. Both are small
text fixes.

## Findings

1. **[blocking] E-19: the seed's `sent` rows break the cap case.**
   - The local outbox already has 2 `sent` rows ("Number patterns check"). They were sent about 55 minutes
     ago when I checked, and by E-19 they will still be inside 24 hours. E-04 and E-05 add and remove more.
   - With the cap replaced by 2, `emails_sent_last_day()` is already ≥ 2 before the case inserts anything.
   - So **B is 0, not 1**. A and C come out 0 too, but for the wrong reason, so they prove nothing.
   - **Fix:** start `cap.sql` with `delete from public.email_outbox;` (it's rolled back). Or set the
     override to `select 2 + <count of sent/sending in the last 24 h taken at the start>`. Say which one in
     the Steps.

2. **[blocking] E-63 and E-64(e): the expected messages are from before `eee5bd3`.** The landed `deploy.sh` prints:
   - success: `Hosted function settings checked: no local values, NOTIFY_WORKER_SECRET as deployed, EMAIL_TRANSPORT=resend, SITE_URL=https://ajclasses.com.au`.
     E-63 expects the old text without `NOTIFY_WORKER_SECRET as deployed`.
   - local digest on hosted: `NOTIFY_WORKER_SECRET on the hosted project isn't the value you deployed (missing, or the local one).`
     E-64(e) expects "…is the local value", which is only E-62's pre-flight message.
   - **Fix:** copy both strings from `deploy.sh:101-110`. E-94(a)/(b) and E-64(e) then all expect the
     same "isn't the value you deployed" message.

3. **[minor] E-18: both concurrent `WORKER` calls write `$SCR/worker.json`.** You can't then tell which call
   reported `sent: 2` and which `claimed: 0`. Give `WORKER` an output-file argument, or run two explicit
   `curl -o $SCR/w1.json` / `-o $SCR/w2.json` calls.

4. **[minor] E-21: the digit grep runs on text that contains UUID links.**
   - `grep -cE '42|…'` on `.Text` and the HTML also scans the "View feedback" and Account URLs.
   - Today's `$MOCK` and `$AARAV` ids contain no "42", but the seed's ids are random. After any
     `db:reset` the chance of a false fail is real (~1 in 5 for two UUIDs).
   - **Fix:** strip `https?://\S+` first, as `test-notifications.mjs` does.

5. **[minor] E-105: the roles aren't switched in the transaction.**
   - After the `return-mock.sql` body (`set local role authenticated`), the next steps fail as
     `authenticated` with "permission denied". Those steps are the `update public.email_outbox …` and
     `select private.trim_history()` (no grant to `authenticated`).
   - **Fix:** write `reset role;` before each outbox update and trim, and set the claims and
     `set local role authenticated` again before each re-return.

6. **[minor] E-93: stale text, plus two ordering risks.**
   - (a) It still says "record it and ask the team lead". Team-lead decision 1 has ruled, so expect
     +1 attempt per row as a pass.
   - (b) It says "with X7's second parent in place", but X7 is restored in E-46, and E-93 is placed
     "phase 4, cron off" with no exact slot. Name the slot (between E-40 and E-46), or use only the
     "insert 3 eligible rows" option.
   - (c) It stops and starts `supabase_inbucket_aj_classes`. Check whether Mailpit keeps its messages
     across a container restart. If it doesn't, run E-93 after E-53, which needs E-20's messages, or
     have E-53 send fresh ones.

7. **[minor] E-61: `wc -l < $F/calls.log` fails if the file doesn't exist** (a dry run calls the fake
   nothing). Expect "absent, or 0 lines", or `touch` the file when the sandbox is set up.

## Checks asked for

| Check | Result |
|---|---|
| Every AC traced | Yes. 3.1–3.11 each have ≥ 1 case (§3), the AC-3.6 ruling has E-34/E-101, and 3.1 file hand-in, 3.9 domain and 3.11 hosted are in §4/§5 with owners |
| Measurable, matching landed behaviour | Yes, apart from findings 1 and 2. I checked against the code: the gate order (`gateRequest`: transport → secret → hosted-local), the `admin_email_problems` columns (E-11), the reason labels and order (E-47), the counts (E-04: 352 / 450 / 169 at `716c283`), the job names (E-100), and the seed roster (Noah only on NAPLAN with `admin@` as tutor; Leo and Isla roster-only with no parent: E-15, E-26–28) |
| Locally runnable | Yes. Every server and helper is defined in §1, and the hosted-only legs are unit-only or listed in §4 |
| Safe | Yes. E-01 is a full stop-gate. Hard rules 1–5. Phase 5 runs the copy at `$F/repo/supabase/scripts/` under `env -i` with fake values, and E-60 checks the sandbox before any run. Transports are Mailpit, or `smtp`, which can't send (X12). No Resend key anywhere. Every SQL probe that changes a function or Vault is rolled back, or restored and verified (X9 checks `pg_get_functiondef` again) |
| Fixtures applied and restored in order | Yes (§1 table, E-02 snapshot, E-90 diff). Only the X7/E-93 overlap (finding 6b) |
| IDs stable | Yes. Append-only; E-19a–c and E-80–82 keep their numbers; the total of 93 matches |

## Next

The Tester fixes findings 1 and 2 (text only), and preferably 3–7 too, then freezes the plan. No
Reviewer round is needed for the text fixes if the changed lines are listed in the TSR header. Nothing
needs Saurabh.
