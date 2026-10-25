APPROVED

# Review 2 — items 4–8 architecture (02b)

**Scope.** Reviewed `78b635d`, which touches only the 4 ADRs, the README rows and 02b. Checked against:
- 01b and review-1b, 02, and ADRs 0001–0004;
- `vercel.json`, `serve.railway.json` and `ci.yml`;
- the migrations up to `20261025110100`, `notifications/index.ts` and `config.toml`;
- item 2's migration, `serve-handler@6.1.7`, and the tracked `aj_classes-e2e` files.

**Verified:**
- **Decisions:** every decision is made, with alternatives and risks.
- **Vercel lookahead:** it parses (path-to-regexp accepts `(?!`/`(?:`), and it excludes `/portal`, `/portal/…` and the fallback on either path.
- **`serve` headers:** `serve` is last-wins (`appendHeaders` does `target[key]=value`), so the portal gets exactly one CSP.
- **Cron times:** `10 4,5 * * *` plus the hour-15 guard runs once a day, at 15:10 AEDT/AEST.
- **Old worker:** it keeps working after the migration, because the new parameter has a default and the function is dropped and recreated (the reverse order is finding 1).
- **E2E specs in public:** they expose nothing new. The only values are local demo values that are already in public `seed.sql`, and no JWTs are committed.
- **Production:** no local or CI path touches production.
- **Item 2 migration order:** safe.
- **PAUSE:** it is owner-only, and it gates only the item 8 release.
- **ADRs:** they follow the README.

## Non-blocking

1. **Deploy order** (§8.5, ADR-0008 d6). If the function is deployed first, it calls `notify_claim_emails(supported_kinds)` against the old zero-argument function. That gives PGRST202 and a 500, so all email stops until the migration lands. Say "migration first, then function", and list that order in item 8's release steps.
2. **Own-hand-in branch** (§7.1 pt 7). Item 2's `can_read_assignment_file` own-hand-in branch (`target_student = my_student_id() and assignment_visible_to(...)`) must also switch to `assignment_readable_by`. Otherwise AC-7.15 fails for a student who has left the class.
3. **False Failed rows** (§8.4, ADR-0008 d2). A "new assignment" row for work due today or already past due would be queued already expired, and would then show as a false Failed. Don't queue when `send_before <= now()`, or use the end of the due date. Carry this into the PO confirmation.
4. **`cron.timezone`** (§8.3, §8.7). The hour-15 guard assumes pg_cron runs in UTC. Either assert `cron.timezone` is GMT/UTC in pgTAP, or schedule `10 * * * *` with the exact-hour guard. Also correct the `daily-history-trim` DST remark: it is simply a UTC time.
5. **Item 5 gate build env** (§5.4 pt 3). It needs the full override set: the local URL, the local publishable key, and the Turnstile test site key. Otherwise local REST calls return 401 and the mirror sign-in fails.
6. **AC-6.14 for Lighthouse.** Fail the job on any `supabase.co` URL in LHCI's `network-requests` audit, or make the Playwright sweep mandatory.
7. **ADR-0005 alternatives.** Record the build-time meta CSP with per-page hashes as rejected for v1, and point the Later-bucket line at it.
8. **Item 4 trigger.**
   - Treat `nullif(trim(new.phone),'')` as null, so a blank field still lets the other fields save (AC-4.4).
   - `check_profile_phone()` must be `security definer`, because `normalise_au_phone` execute is revoked from `authenticated`.
9. **Item 2 migration check** (§7.3, ADR-0007 d4).
   - The `supabase migration list` check happens when item 2 is rebased.
   - Correct the reason: hosted `db push` refuses an older file unless `--include-all` is used.

## Nits

10. Add the 404 page (`curl -sI https://ajclasses.com.au/nope`) to item 5's live check.
11. Tell Saurabh that `vercel.live` toolbar CSP violations are expected on the preview, and that the host must not be added to the policy.
12. In the README, mark 0004 as "extended by [0008]".

The stage can go to the Solution Designer, and ADRs 0005–0008 can become Accepted.
