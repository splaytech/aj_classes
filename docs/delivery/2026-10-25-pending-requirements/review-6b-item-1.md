APPROVED

# Review 6b: item 1 security review (`06-security-item-1.md`)

> **Stage:** Reviewer gate after 6b (Security) · **Date:** 25 Oct 2026
> **Against:** `git diff c4e9447..553cf27 -- apps/ supabase/` (the scope it states), plus the
> follow-ups that acted on it (`68460ec`, `6a03de1`).

## Completeness

It covers every security-relevant part of the diff:
- the public REST read and what it exposes (F1);
- the publish model (F2);
- rendering, URL building and sitemap XML (F3);
- secrets in the repo and in the build (F4);
- hosting headers and what the future public CSP will need (F5);
- the accuracy of the privacy text (F6);
- abuse and cost (F7);
- dependencies and the test fetch stub (F8).

Nothing in the diff is left out. The `connect-src` list for item 5 (F5) is useful forward work.

## Evidence spot-checks (all real)

Every reference I checked matches the repo:
- `supabase/config.toml:19` `max_rows = 1000`;
- `posts.module.css:42` `pre-wrap` (at `553cf27`);
- `app.constants.ts:70` (Web3Forms) and `:78` (Kit);
- `.env.production` line 3 is the warning comment;
- `vercel.json` and `serve.railway.json` are unchanged.

The local probe outputs are specific: status codes, PostgREST error codes (PGRST200, 42501,
PGRST205) and response sizes. They're consistent with the migration's table-wide anon `SELECT`.
The review states it was run against the local stack only.

## Findings

1. [minor] F2 severity (`06-security-item-1.md:33`, summary row 2). It's tagged **minor**, but the
   text says it's by design, a process risk and "no fix needed for v1". That's **info**. Re-tag it
   so a later reader doesn't count it as an open defect.
2. [minor] F6 severity. It's tagged **info**, but the Privacy Policy said "We don't store it",
   which was a factually wrong public statement. That's at least **minor**, because a privacy
   policy that's wrong is a compliance issue, not a note. It's already fixed (`6a03de1`), so
   re-tag it and mark it resolved.
3. [minor] F4 says `apps/web/.env.production` is "tracked on purpose" without saying this goes
   against the repo's own KINET rule `env/env-files-should-not-be-tracked`.
   - The exception is real and documented in the file header (public values only), and it's
     older than this diff.
   - Security should name the rule conflict so it's a known, accepted exception, not an
     unnoticed one. One line is enough: "Exception to env/env-files-should-not-be-tracked: public
     values only, see file header."
4. [minor] F1's database fix (column grant) and the spaces-only `btrim` check (05 §7) are
   deferred, but they're recorded only in 05 and 06. Neither is in `04-plan.md`'s backlog or
   later bucket. Per ways-of-working ("defer explicitly"), add one line for each to 04, under
   "next migration batch".
5. [minor] F1 says local `information_schema.column_privileges` "confirms" that anon can read all
   6 columns, but it doesn't show the query or its output, unlike the REST probes. Add the query
   to the evidence block so it can be re-run.

None of these block. The verdict ("no blocking") is right: there's no exploitable path, and the
only data exposure (the admin UUID) has no join route for anon, as the review demonstrates.
