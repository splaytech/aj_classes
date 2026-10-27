# Security review: item 1 (News page)

> **Stage:** 6b (Security), `/deliver` pending-requirements, branch `feature/pending-requirements`
> **Scope:** `git diff c4e9447..HEAD -- apps/ supabase/` (28 files under `apps/web`, nothing under `supabase/`), read against
> `02-architecture.md` item 1, ADR-0001 and `03-design.md` part 1.
> **Method:** I read the code, scanned the committed files and `apps/web/build/` for secrets, and probed the **local** stack
> only (`127.0.0.1:55321`) with the local publishable and anon keys. I didn't touch the hosted Supabase.

**Verdict: no blocking findings.** Two minor findings (1, and 6, which is resolved) and six info notes.

> **Revised after review-6b** (`review-6b-item-1.md`): F2 re-tagged info, F6 re-tagged minor and marked resolved by `6a03de1`, the env-rule exception named in F4, and the column-privileges query added to F1's evidence.

---

## Findings

### 1. [minor] The public list fetches `author_id`, which the page never shows

- **Evidence:** `apps/web/src/services/post-rows.ts:10` `POST_COLUMNS = 'id, created_at, updated_at, title, body, author_id'`,
  used by the public client at `apps/web/src/services/public-posts.client.ts:46-47`. The design asks for this
  (`03-design.md:149`). `routes/posts.tsx:22-27` renders only `publishedAt`, `title` and `body`.
- **Database side:** the existing migration (`supabase/migrations/20261024120000_posts.sql`, not in this diff) gives
  `anon` a table-wide `SELECT` with `using (true)`. Local `information_schema.column_privileges` confirms that anon
  can read all 6 columns (query and output below; local DB only). So anyone with the publishable key gets the same data from `select=*`, whatever the client sends.
  ```sql
  -- local stack only, run via: docker exec -i supabase_db_aj_classes psql -U postgres -X
  select column_name, privilege_type
  from information_schema.column_privileges
  where grantee = 'anon' and table_schema = 'public' and table_name = 'posts'
  order by column_name;
  ```
  ```
   column_name | privilege_type
  -------------+----------------
   author_id   | SELECT
   body        | SELECT
   created_at  | SELECT
   id          | SELECT
   title       | SELECT
   updated_at  | SELECT
  (6 rows)
  ```
- **Exploit scenario:** `GET /rest/v1/posts?select=author_id` returns the admin's `auth.users` UUID. On its own that
  leaks nothing: anon gets 401 on `profiles` and every other table, and anon can't embed `author_id` (curl output below). It is
  still an internal identifier with no public purpose. If a later migration ever adds a public FK or view, it becomes
  the join key that de-anonymises the author.
- **Fix (worth doing, not blocking):**
  1. Public client: select only what the page needs, `select=id,created_at,title,body` (a separate
     `PUBLIC_POST_COLUMNS` in `post-rows.ts`). The admin service keeps `POST_COLUMNS`.
  2. New migration: `revoke select on public.posts from anon; grant select (id, created_at, updated_at, title, body) on public.posts to anon;`
     `authenticated` (admin page) is unaffected. Apply it with the next migration batch, after the change in step 1, because a `select=*` from anon would then fail with 401.

### 2. [info] Every post is public; nothing in the schema stops an unfinished post from going live

- **Evidence:** `posts` has no `published`/`status` column, and the anon policy is `using (true)`. Local probe: anon
  `select=*` returns every row. This matches the requirement ("an admin publishes, shown to every visitor"), so
  there are no "drafts" to leak today.
- **Risk:** a save on the admin page publishes the post to the whole internet at once, including typos or a pasted student
  name. This is a process risk, not a code defect.
- **Fix (eventually):** none needed for v1. If drafts are ever added, add a `published_at` column and change the anon policy to
  `using (published_at is not null and published_at <= now())`. Don't filter in the client.

### 3. [info] No injection or XSS path

- Titles and bodies render as React text children (`routes/posts.tsx:25-26`), so they are escaped. The body uses
  `white-space: pre-wrap` (`posts.module.css:42`), not HTML. `grep -rn "dangerouslySetInnerHTML\|innerHTML" apps/web/src`
  finds nothing outside tests.
- URL building (`public-posts.client.ts:16-21,31,46-47`) uses only build-time config (`VITE_SUPABASE_URL`) and
  constants. No user, query-string or route input reaches the query. The News `href` is the constant `ROUTES.posts`.
- Sitemap XML (`routes/sitemap.ts:20-22`) interpolates only constant paths at build time.
- The DB caps the length of what's rendered (`title` 1-120, `body` 1-5000 chars).

### 4. [info] Secrets: only the publishable key ships

- `apps/web/.env.production` (tracked on purpose) holds `VITE_SUPABASE_URL`, an `sb_publishable_…` key, the
  Turnstile **site** key and a feature flag. All are public by design. Its only `sb_secret_`/`service_role` match is a
  warning comment (line 3).
- **Accepted exception to rule `env/env-files-should-not-be-tracked`:** public values only, see the file header.
  It predates this diff. If a secret is ever added to this file, it must move out and be rotated.
- `apps/web/build/client`: the only `sb_secret_` string is supabase-js's key-prefix check
  (``Ki=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`)``, `assets/dist-*.js`). It has no token after it.
  The `sb_publishable_` key appears in `assets/constants-*.js`, as expected.
- `git grep` on HEAD for `sb_secret_<token>`, JWT (`eyJhbGciOi…`) and `service_role=` values finds nothing. The diff adds no
  secret-looking lines. `.env.local` and `.env.development.local` are gitignored and untracked.
- The client sends only the `apikey` header, never `Authorization` (`public-posts.client.ts:18`).

### 5. [info] Headers unchanged; what item 5's public CSP needs

- `git diff c4e9447..HEAD -- apps/web/vercel.json apps/web/serve.railway.json` is empty. The `/portal` CSP,
  `noindex` and `no-store` rules are unchanged. `hosting-config.test.ts` checks that no rewrite catches `/posts`.
- `/posts` gets the same headers as every other public page: HSTS (Vercel), `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`. It has no CSP yet (backlog item 5).
- **For item 5's ACs:** public pages currently `fetch` these origins, so the public CSP needs at least
  `connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com https://app.convertkit.com`:
  1. 'self' covers Vercel Web Analytics (`/_vercel/insights`).
  2. The Supabase host covers the news check, the `/posts` list and `leads.client.ts`.
  3. `api.web3forms.com` is the enquiry form (`app.constants.ts:70`).
  4. `app.convertkit.com` is the Kit subscribe form (`app.constants.ts:78`, `kit.client.ts:25`).

  If the Supabase host is missing, the failure is silent: the News link never appears (fail-closed, AC-1.7). Item 5's
  tests should load a public page under the CSP and assert that the link shows.
- Supabase answers with `Access-Control-Allow-Origin: *` (local probe with `Origin: https://evil.example`). That's expected
  for a public read, and it's why the RLS/grants, not CORS, are the control (see finding 1).

### 6. [minor, resolved in `6a03de1`] Privacy-text accuracy: "We don't store it" was not true

- **Evidence:** `apps/web/src/constants/content.constants.ts`, the `PRIVACY` "Who handles it" text (the sentence added in this diff):
  "...shares your IP address and browser type with our database provider (Supabase, Sydney). We don't store it or use
  it to identify you."
- Supabase's API gateway keeps request logs for the project, for a limited period that depends on the plan. Its logging docs list
  the connecting-IP headers (`cf-connecting-ip`, `x-real-ip`) among the request headers attached to API logs. The owner can
  see these logs in the dashboard. "We don't store it" is true of AJ Classes' own tables, but Supabase does keep it for a while, on our behalf.
  Supabase's gateway runs behind Cloudflare, so the request may also pass through Cloudflare's network.
- **Why minor:** a privacy policy that makes a wrong public statement is a compliance issue, not just a note.
- **Resolved:** `6a03de1` applied the wording below. It still needs the owner's B1 approval.
- **Suggested wording for B1 (owner to approve):**
  > "When you visit a page, your browser asks our database provider (Supabase, Sydney) whether there is any news to show.
  > Like any web request, this sends your IP address and browser type. Supabase keeps these in short-lived
  > technical logs for security and troubleshooting. We don't save them in our own records or use them to identify you."
- Optional: Saurabh can check the Free-plan log retention in the dashboard (Logs → retention) and state it ("deleted after N days").
  The public pricing docs give 7 days for Pro but nothing for Free.

### 7. [info] Abuse and cost: proportionate, no change needed now

- **What's new:** every full public page load makes one ~100 B request (`select=id&limit=1`), plus one list request on `/posts`.
  `cache: 'no-store'` (`public-posts.client.ts:20`) is deliberate, so the link appears on the next page load after a post is published (AC-1.10). One check
  per page load is shared by the header and footer (`public-posts.client.ts:61-66`).
- **Flooding:** the REST endpoint and publishable key were already public (`leads.client.ts`), so this change doesn't
  create the attack surface. Supabase has no per-IP REST rate limit on Free. Supabase Free also has no overage billing, so
  the risk is **availability, not money**: if the 5 GB egress quota is exhausted, the project can be restricted, which would also take
  the portal down.
- **Amplification:** an attacker would call `posts?select=*` directly, not the site's `limit=1` check. Today that returns 1 row
  (~290 B). At full size (200 rows × ~5.3 KB, or up to `max_rows = 1000` in `supabase/config.toml:19` if
  they drop `limit`) a single response is ~1-5 MB. A few thousand scripted requests could then use up the month's egress.
  This only matters once there are hundreds of long posts.
- **Advice (eventually, numbered so Saurabh can pick):**
  1. Do nothing for v1: low traffic, and the admin writes short posts.
  2. If the site grows: cache the check for a few minutes in `sessionStorage` (this delays AC-1.10 slightly), or serve
     `/posts` data from a Vercel edge function with `s-maxage`. That's a cost/architecture call for later, not a fix.
  3. Enable Supabase usage alerts (dashboard) so egress spikes are noticed. This is the cheapest useful control.

### 8. [info] No new dependencies

- `git diff --stat c4e9447..HEAD -- '*package.json' pnpm-lock.yaml` is empty. The change uses only the platform `fetch` and
  `AbortSignal.timeout`.
- The test-setup stub (`apps/web/src/test/setup.ts`) makes `fetch` reject in every unit test. This is good for security too: tests
  can't quietly reach the local or hosted DB.

---

## Local probe evidence (local stack only, `127.0.0.1:55321`)

Run with the local `PUBLISHABLE_KEY`; the local `ANON_KEY` gave the same results. Bodies trimmed.

```
GET posts?select=*&limit=2                   -> 200 [{"id":"88427aca-…","created_at":…,"updated_at":…,"title":"Term 4 classes start on Monday","body":"…","author_id":null}]
GET posts?select=id&limit=1                  -> 200 [{"id":"88427aca-…"}]
GET posts?select=id,author_id,author:author_id(email) -> 400 PGRST200 (no relationship; auth.users not exposed)
GET enquiries|profiles|students|classes|assignments?select=* -> 401 42501 permission denied
GET leads|staff_accounts|parents|families    -> 404 PGRST205 (not exposed)
POST posts {"title":"x","body":"y"}           -> 401
DELETE posts?id=not.is.null                  -> 401
GET posts?select=*&limit=100000              -> 200 (1 row, 286 B; config max_rows = 1000)
Header: Access-Control-Allow-Origin: *
```

DB grants (`information_schema`, local): the only anon table grant in `public`/`private` is `SELECT` on `posts` (all 6
columns), and anon can execute no `public` functions.

## Summary

| # | Finding | Tag |
|---|---------|-----|
| 1 | Public list selects, and anon can read, `author_id` (admin UUID) | minor |
| 2 | No draft state: every saved post is public at once (by design) | info |
| 3 | No XSS or injection path | info |
| 4 | Only the publishable key ships; no secrets committed or bundled (tracked `.env.production` is an accepted env-rule exception) | info |
| 5 | Headers unchanged; `connect-src` list for item 5 | info |
| 6 | Privacy sentence: "We don't store it" should mention Supabase's short-lived logs | minor, resolved (`6a03de1`; B1 approval pending) |
| 7 | Request flooding is an availability risk, not a cost risk, on Free; usage alerts advised | info |
| 8 | No new dependencies | info |

**Verdict: no blocking.**
