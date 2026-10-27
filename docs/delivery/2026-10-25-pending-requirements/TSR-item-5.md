# Test Summary Report — item 5 (enforcing CSP on public pages, plus the item 9 docs line)

- Date: 2026-10-26 · Branch: `feature/public-csp` @ `5e99440` (the plan freeze commit). It descends from `FIX=69c443a` (`git merge-base --is-ancestor 69c443a HEAD` exits 0), and the app code equals `9de84b3` (`git diff --quiet 9de84b3 HEAD -- apps package.json pnpm-lock.yaml supabase` exits 0).
- Environment: local only.
  - **P:** the local-Supabase production gate build (`VITE_LEAD_CAPTURE=on`, `VITE_FORM_ACCESS_KEY=local-placeholder`, `VITE_KIT_FORM_ID=0000000`, in a subshell) on `pnpm mirror`, `http://127.0.0.1:4173`.
  - **PS:** the same with `VITE_APP_ENV=staging` (E-60 only).
  - **R:** `PORT=4174 pnpm --filter web start:railway`, `curl` only.
  - **D:** dev server `localhost:5173` (the E2E suite's own, and the E-44 photo fixture).
  - Local Supabase: API `127.0.0.1:55321`, reset from this worktree (edge-runtime mount check `1`, newest migration `20261026100000`).
  - Browser: **Google Chrome 155.0.8059.85**, headless, through the E2E repo's Playwright (`channel: 'chrome'`).
  - The hosted project was never read or written; `supabase/.env.deploy` was never opened; no banned CLI command ran; nothing was sent to `ajclasses.com.au`, `*.vercel.app`, Web3Forms, Kit, WhatsApp or Zoho (all mocked with `context.route`). The only real non-local host contacted was `challenges.cloudflare.com` (Turnstile test widget) on portal legs.
- Full check (plan header) → **PASS**, exit 0 (`evidence/E-04-fullcheck.log`, `evidence/E-06-e2e.log`):
  - format clean · lint 0 problems · typecheck clean · production build OK · `check-hosted-ref: 0 files (of 153 scanned)`;
  - `pnpm test` **54 files, 462 tests passed** (hosting and script tests: 28, including `mirror-config.test.ts` › `inserts the local origin literally, even if it holds a $ pattern`);
  - `db:test` **14 files, 507 tests, PASS**;
  - `test:functions` **169 `ok`, 0 `NOT OK`**;
  - E2E (external repo) **9 passed** (1.6 min). Afterwards: 0 `e2e-%` rows in profiles, posts and enquiries; port 5173 free.
- Test plan: `06-test-plan-item-5.md`, **frozen at 50 cases** (`5e99440`). The review 6a changes are listed in its header ("Lines changed after review 6a round 1"), so there's no second review round.
- Evidence: `docs/test-reports/2026-10-26-feature-public-csp/evidence/` (not committed): `run.log` (curl and shell outputs), the full-check and E2E logs, per-leg JSONL (`E-21`, `E-26`, `misc`, `portal`, `inject`, `staging`), `E-81-legs.txt` (every leg's counters), 178 HARs, 128 sweep screenshots, the harness scripts, and the start/end snapshots.

**Run notes (read before the results).**
1. **Pre-freeze probes** (review 6a findings 5 and 7, on a gate build of `9de84b3`): the 11 E-51 probes gave exactly the 12 C4 lines recorded in the plan, 0 pageerror, 0 `example.com` hits, no WebSocket "connection failed" line. One admin sign-in on P (Turnstile, two-step, reload) logged 0 console lines and 0 violations. Nothing needed the lead's stop rule.
2. **Harness.** The two-step code is submitted by clicking `Verify` (pressing Enter in the code field didn't submit). The sweep loops ran in zsh, so word lists are read with `$(cat …)`; the first E-12 loop printed one unsplit line and was re-run straight away (the re-run is the measurement, in `run.log`).
3. **E-42.** The QR code appears only after the name step's `Continue`; the leg clicks it (`E-42-newadmin-qr`). The first `newadmin@` leg (landing only) is also recorded. This created one unverified factor, deleted in E-80.
4. **Data.** X1 (one post) was applied right before E-26 and deleted at the end of E-27. X2 (tutor photo) was uploaded and removed on D around E-44. The end snapshot equals the start snapshot (E-80).

## Round 1

### Phase 0 — safety guards

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-01 | Safety | Env local only | URL exact; key equal; env files and names; E2E `.env` local; no override names (incl. `MIRROR_SUPABASE_ORIGIN`); HEAD descends from `69c443a` | `http://127.0.0.1:55321`; `equal`; `.env.example`, `.env.production` with exactly the 4 names; E2E env local, `supabase.co` 0; no listed name set; `5e99440`, `0`, app diff `0`, `feature/public-csp`, only the untracked evidence folder | PASS |
| E-02 | Safety | Stack from this worktree; snapshot | reset 0; mount 1; `20261026100000` ×2; seed values | reset 0; mount **1**; both `20261026100000`; profiles 6, posts 0, enquiries 0, avatars 0, tutor photo null, newadmin factors 0, `e2e-%` 0 | PASS |
| E-03 | Safety | `.env.deploy`; banned commands | `0`; none | `git check-ignore` 0. The session's commands include no read of `.env.deploy`, no `link`/`db push`/`config push`/`functions deploy`/`secrets`/`--linked`/`--project-ref`, and no request to `ajclasses.com.au` or `vercel.app` | PASS |

### Phase 1 — repo checks and committed config

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-04 | Full check | Full check | exit 0; ≥ 54/462; 4 hosting files ≥ 28 with the S7 test; ≥ 14/507; ≥ 169 ok | exit 0; **54/462**; hosting 28, S7 test passing; **14/507 PASS**; **169 ok / 0 not ok**; `0 files (of 153 scanned)` | PASS |
| E-05 | Hosted refs | Full-check build | `0 files (of N)`, N = non-binary count; all-files grep 0; local origin ≥ 1 | `0 files (of 153 scanned)`, `find` = **153**; grep **0**; local origin **1** file | PASS |
| E-06 | E2E | External suite | 9 passed; 0 leftovers; port free | **9 passed**; 0 / 0 / 0; 5173 free | PASS |
| E-07 | Scope | 13 files; deps same; no runtime/DB change | exact 13; `0`; `0` | the 13 files exactly; `0`; `0` | PASS |
| E-08 | Code rules | Added lines; no HTML from data | 0; 0 | **0**; **0** | PASS |
| E-09 | Committed policy | Rules, equality, hosted host, directives, no wildcard/report, unchanged parts | 4 rules in order; equal ×3; 1 / 0 / 0; 11 directives; 0; 0; diffs 0 | `/(.*)`, lookahead with `__spa-fallback$`, `/__spa-fallback`, `/portal/:path*`; `pub-equal`, portal equal on Railway and on Vercel's fallback rule; hosted origin **1**, local **0**/**0**; exactly the 11 directives listed; wildcards **0**; report **0**; both `diff`s exit **0** | PASS |
| E-10 | Rationale | `'unsafe-inline'` reason in ADR-0005 | 1 hit; the block names nonces and hashes, **and** states inline `on*` handlers run | 1 hit (line 30). The block names nonces ("need a per-request server") and hashes ("change every build…"). The `on*` sentence ("Inline `on*` handlers run, as a consequence of `'unsafe-inline'`") is in decision 1, line 29, directly **above** the block, not in it | **FAIL (plan expectation; ruling R1)** |

### Phase 2 — gate build and headers

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-11 | Gate build | Guarded, local, loopback, private config | `0 files (of N)` + exit 0; grep 0; 1 `serve-mirror:` line; `127.0.0.1:4173` only; 700/600; 0 hosted; 3 local; stub 0 bytes; subscribe built; placeholder ≥ 1 | `0 files (of 153 scanned)`, `exit 0`, N=**153**; grep **0**; `serve-mirror: http://127.0.0.1:4173 (Supabase http://127.0.0.1:55321)` (1 line); `127.0.0.1:4173`; **700**/**600**; **0**; **3**; **0**; **1**; **1** | PASS |
| E-12 | CSP on public pages | 16 pages | 16 lines; 200 (`/nope` 404); `csp=1 kind=public-local`; report-only 0; meta CSP 0 | 16 lines, all `csp=1 kind=public-local`; 15 × `200`, `/nope` `404`; report-only **0**; meta CSP **0**. All 14 sitemap URLs are in the 16 | PASS |
| E-13 | Other responses | Variants, assets, query strings, redirects | `/404` 200, `/portalx` and `/__spa-fallbackx` 404, rest 200, all 1 public; redirects 301 → final 200 with 1 public | Exactly that (asset `/assets/account-client-loader-xsJghYcM.js`); `/privacy/` → `/privacy`, `/index.html` → `/index`, `/404.html` → `/404`, each final `200`, 1 public CSP | PASS |
| E-14 | Portal headers | 8 portal paths, redirects, `/PORTAL/login` | `200 csp=1 kind=portal-local`, robots 1, no-store 1; redirects to portal; record upper case | All 8 exactly that; `/portal/` → `/portal`, `/__spa-fallback.html` → `/__spa-fallback`, finals 1 portal CSP. Record: `/PORTAL/login` `200 csp=1 kind=portal-local` | PASS |
| E-15 | Other headers | nosniff, DENY, referrer once each; public robots 0 | 1/1/1 on all 24; robots 0 on public | 1/1/1 on all 24 responses; `X-Robots-Tag` **0** on the 16 public pages (1 on portal paths); HSTS absent on `serve` (non-bug 5) | PASS |
| E-16 | Railway | Committed config unsubstituted | public-hosted ×3 (`/nope` 404); portal-hosted ×3; robots 1 each | Exactly that; robots **1** on all 6; stopped, port free | PASS |
| E-17 | Rule order, S7 | Order; swap; mirror keys; `$` origin | committed order; swap → public on `/portal/login`; no robots on `**/*`; 3 literal, 0 hosted | `0 **/* Content-Security-Policy`, `1 __spa-fallback.html Cache-Control`; swapped `/portal/login` `csp=1 kind=public-local`; :4175 stopped (0 listeners); `**/*` keys without `X-Robots-Tag`, fallback keeps it; `http://a$&b` **3**, hosted **0** | PASS |
| E-18 | Guard (CLI) | Fail closed | a: 1/exit 1; b: 6 of 6/exit 1; empty: exit 1; clean: exit 0; missing: exit 1; both: 1; none: 1 | Exactly that (`p.png` skipped by design); messages as in the plan | PASS |
| E-19 | Mirror refuses | Planted ref | exit 1; 4176 not listening; check 1/exit 1; after removal 0/exit 0 | `serve-mirror: 1 files in …/build/client contain the hosted project ref, e.g. zz-hosted-probe.js`, exit **1**; 4176 listeners **0**; check `1 files (of 155 scanned)`, exit 1; after `rm`: `0 files (of 154 scanned)`, exit 0; P still 200 | PASS |

### Phase 3 — public sweep on P

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-20 | Smoke | `/`, `/privacy`, `/portal/login` | 200; 1 `h1`; clean | 200 ×3; 1 `h1` each; console 0, violations 0, hosted 0; portal leg has 1 portal CSP | PASS |
| E-21 | Load, no posts | 64 legs | all clean; defaults; background white in both schemes, colours equal; no marker | **64** legs: violations **0**, console **0** apart from the 4 `/nope` C1 lines, pageerror **0**, hosted **0**, unexpected **0**; status, 1 `h1`, robots (0 / 1 on `/subscribed`, `/nope`), overflow 0, images ok, 1 public CSP per document, all as expected; `rgb(255, 255, 255)` everywhere and dark colours identical to light (no contrast loss); no marker, no `[` title | PASS |
| E-22 | Phone menu | 32 legs at 360 | `true` + visible, then `false` | 32/32 | PASS |
| E-23 | News, no posts | Link hidden; check once; `/posts` empty | 0 links; 1 check `200 []`; empty text | 0 links on 64 legs; 1 check per load, 200, 0 rows; `/posts` "There are no news posts at the moment.", 0 items, no error text | PASS |
| E-24 | Enquiry (mocked) | 4 legs on `/` | W3F 1 to `/submit` with `local-placeholder`; leads 1; "Message sent" + thanks; enquiries delta 0 | 4/4 exactly that; enquiries 0 → 0 | PASS |
| E-25 | Subscribe (mocked) | 64 legs | Kit 1 `POST …/forms/0000000/subscriptions`; success text | 64/64 | PASS |
| E-26 | With 1 post (X1) | 64 legs | header 1 + footer 1 `News`; 1 row; `/posts` 1 item, title as text, `img[src=x]` 0, no dialog, title not `xss` | 64/64 clean; links 1 + 1 (`News`, `News`); `/posts` 1 item, `h2` exactly `e2e-item5 <img src=x onerror="document.title='xss'">`, title `Latest News \| AJ Classes`, `img[src="x"]` 0, dialogs 0; C1 only on the 4 `/nope` legs | PASS |
| E-27 | News failures | 500 and 6 s delay | links 0; error text; C3 = hits; then post deleted | 500: links 0 on `/` and `/posts`, "We couldn't load the news just now. Please try again later."; 3 route hits, 3 `500` lines (C3). Delay: link 0 after 8 s, 0 console lines. Post deleted, count **0** | PASS |
| E-28 | JSON-LD | Per page | 1 on 11 pages, 0 on 5; parse | Exactly that; all parse; types `EducationalOrganization`+`LocalBusiness`, `WebSite`, `FAQPage` (home), `Course`+`BreadcrumbList` (programmes), `Article`+`BreadcrumbList` (guide) | PASS |
| E-29 | Assets | 3 pages | images ok; icons 200 with types; fonts 0; manifest 0; og URL; 0 requests to ajclasses.com.au | 2/2 images each; `/favicon.svg 200 image/svg+xml`, `/apple-touch-icon.png 200 image/png`; font requests 0; manifest 0; `og:image` `https://ajclasses.com.au/og-image.png`, requests to it 0; clean | PASS |
| E-30 | WhatsApp | 6 legs | href, `_blank`, `noopener`; popup at the URL | 6/6: `https://wa.me/61469800685?text=…`, `_blank`, `noopener noreferrer`; popup opened at that URL (mocked); C1 only on `/nope` | PASS |
| E-31 | Analytics stub | Requests per load | 1 × `GET /_vercel/insights/script.js` 200, no violation | 1 per load on all 128 E-21/E-26 legs, 200, 0 violations | PASS |
| E-32 | No hosted (sweep) | Request URLs in `E-2*` + `E-30-*` HARs | `supabase.co` 0; origins exactly the list; Cloudflare only in E-20 portal leg; `wa.me` only in E-30 | 143 HARs, 3,851 requests, `supabase.co` **0**; origins: `127.0.0.1:4173`, `127.0.0.1:55321`, `api.web3forms.com`, `app.convertkit.com`, `wa.me` (E-30 HARs only), `challenges.cloudflare.com` (only `E-20-portal-login.har`) | PASS |
| E-33 | Other 404 paths | 4 legs | 404; 1 public CSP; `Page not found`; robots 1; C1 only | 4/4 exactly that | PASS |

### Phase 4 — portal on P

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-40 | Admin two-step | 1280 and 360 | Turnstile ≥ 1; token 200; verify; `/portal/admin` `Admin`, after reload too; 1 portal CSP per doc; clean | Both: Cloudflare responses 3; token 200; verify page; `/portal/admin` "Admin" before and after reload; every document 1 portal CSP (`$POR_LOCAL`); console 0, violations 0, hosted 0. No C6 lines | PASS |
| E-41 | Student and parent | 8 legs | right home, kept after reload; theme follows device; images ok | `student@` → `/portal/student` "Hi Aarav", `parent@` → `/portal/parent` "Hi Local", same after reload; theme `light`/`dark` as the device; images ok; all clean | PASS |
| E-42 | Tutor, new admin | Landing; QR | `/portal/tutor`; set-up screen; QR `data:` loads | `/portal/tutor` "Welcome, Local"; `newadmin@` → `/portal/account/two-step/setup`; after `Continue`, QR `data:` image loaded; clean (run note 3) | PASS |
| E-43 | Refused sign-in | `inactive@` | message; stays; 0 keys; only C2 | "Email or password is incorrect."; `/portal/login`; 0 token keys; console exactly the one `400` on `/auth/v1/token` (C2) | PASS |
| E-44 | Avatars (X2) | Admin staff page; My profile | avatar from local storage, loaded; clean; removed after | Both pages: 1 avatar `http://127.0.0.1:55321/storage/v1/object/public/avatars/…`, loaded; clean. Removed on D ("Photo removed."), `avatar_path` null, objects 0, 5173 free | PASS |
| E-45 | K1 (record only) | Preview on P | recorded | `blob:` preview not loaded; 1 violation `img-src\|blob\|enforce`; the one C5 console line; nothing uploaded | PASS (recorded; FU-K1) |

### Phase 5 — invalid states on P

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-50 | Unlisted script | `example.com/x.js` | 1 `script-src-elem` violation; 1 line; route 0 | Exactly that | PASS |
| E-51 | Exfiltration, embedding | 11 probes | directives in order; fetch/FontFace/beacon results; URL and baseURI unchanged; 12 C4 lines; route 0 | `connect-src`, `img-src`, `connect-src`, `connect-src`, `font-src`, `style-src-elem`, `frame-src`, `frame-src`, `object-src`, `base-uri`, `form-action`, all `enforce`; `TypeError: Failed to fetch`, `NetworkError`, `true`; URL and `baseURI` `http://127.0.0.1:4173/`; exactly the 12 C4 lines; pageerror 0; `example.com` hits 0 | PASS |
| E-52 | `eval` | Deferred probe | both `EvalError`; ≥ 1 `script-src\|eval`; only "Evaluating…" lines; pageerror 0 | `EvalError`, `EvalError`; 2 × `script-src\|eval\|enforce`; 0 console lines; pageerror 0 | PASS |
| E-53 | Inline code on purpose | `onclick`, inline script | title `ran`; `__inl` 1; 0 violations | `ran`; `1`; 0 violations. Inline `onclick` runs on purpose (`'unsafe-inline'`, ADR-0005 decision 1) | PASS |
| E-54 | Framing (X3) | Framer on :4177 | child frame `chrome-error://chromewebdata/`, **no `h1` readable**; 1 `frame-ancestors` line | Child frame `chrome-error://chromewebdata/` (the public page never loaded); exactly 1 line, `Framing 'http://127.0.0.1:4173/' violates … "frame-ancestors 'none'"…`. But the child's `h1` count read **1**: it's Chrome's own error page, `h1` "127.0.0.1 is blocked", no site header (`evidence/E-54-childframe.txt`) | **FAIL (plan expectation; ruling R2)** |

### Phase 6 — staging marker

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-60 | Staging marker | PS, 8 legs | `0 files`; grep 0; 1 public CSP; `[STAGING] ` title, `STAGING` label, staging favicon 200; robots ≤ 1; analytics 0; clean | `0 files (of 153 scanned)`; grep 0; `/` 200 and `/nope` 404, each 1 public CSP; 8/8 title `[STAGING] …`, label `STAGING`, `/favicon-staging.svg` 200, robots 1, analytics 0; clean apart from C1 on `/nope` | PASS |

### Phase 7 — docs

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-70 | PRP item 9 | Annotations, link, sample, no code | 3; 1 each; heading 1, slug; `4 2`, note after fence; 0, 0 | **3**; lines 407, 411, 537; heading **1**, slug `item-9--hreflang--geo-head-tags-dropped`; `4 2`, fence closes at 405, note at 407, sample lines 367–370 untouched; build **0**, src **0** | PASS |
| E-71 | `arch.md` | Paragraph | 1; 5 strings; before `**4. Backend` | Line 41; all 5 strings; Backend at line 49 | PASS |
| E-72 | Other docs | 03-design, ADR, go-live | 1; ≥ 1; 1 hit; 1 | 1; 2; `## 7c. Public CSP…` (line 111); 1 | PASS |

### Phase 8 — close-out

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-80 | Data restore | Snapshot, ports, repo | diff empty; 0 posts; ports 0; status clean apart from evidence and TSR; no probe file | 1 unverified `newadmin@` factor deleted; `diff` empty; `e2e-` posts 0; ports **0**; only the untracked evidence folder (and this TSR); no probe file | PASS |
| E-81 | Totals | Every leg | 0 everywhere apart from C1–C6; hosted 0 | 177 legs (`E-81-legs.txt`): pageerror **0**, hosted **0**, unexpected **0**. Console 35 lines = C1 16 (16 × 404 legs, 1 each) + C2 1 + C3 3 + C4 14 + C5 1; violations 15 = C4 14 + C5 1. C6 lines: **0**. No other line on any leg | PASS |

## Results

- **Pass rate: 48 / 50 (96%).** BLOCKED: 0. Not run: 0.
- **Defects: none.** No BUG-13 or later was raised. The 2 failures are plan expectations, not app faults:
  - **R1 (E-10):** the ADR does state that inline `on*` handlers run, one line above the "Why" block, in decision 1. The plan put it inside the block.
  - **R2 (E-54):** framing is blocked; the "no `h1` readable" sub-expectation didn't allow for Chrome's own error page in the frame.
- **Known, not item 5:** K1 / FU-K1 (portal photo preview blocked by the portal CSP's `img-src`), recorded in E-45.

## Not covered

1. Saurabh's and the team's live checks (plan §4): the Vercel preview, the live `curl` CSP counts (`/`, `/programmes/vce`, `/nope`, `/portal/login`, `/__spa-fallback`, `/PORTAL/login`, HSTS), and Vercel Analytics live.
2. Browsers other than Chrome; the Rich Results test (item 6); work-file downloads (held item 2, T2.15).
3. Looks: the 128 sweep screenshots in the evidence folder are for Saurabh's eye; layout was measured.

## Verdict

**APPROVED (auto).** Round 1: 48/50 as frozen. Under the team-lead rulings it is **50/50 = 100 %**, and the full check is green. Merged to `develop` and pushed by the team lead.

**Team lead rulings (2026-10-26):**
- **R1 (E-10): accepted.** ADR-0005 does contain the inline-handler consequence (decision 1, line 29). The plan only named the wrong place for it.
- **R2 (E-54): accepted.** Framing is blocked: the child frame is `chrome-error://`, with exactly one `frame-ancestors 'none'` line. The readable `h1` is Chrome's own error page, not site content.

Neither ruling weakens a measured intent.

**Evidence kept out of git:** the 178 HAR files (160 MB) hold full request and response bodies, including local sign-in tokens. They were moved out of the repo to the session scratchpad and are not committed. The per-leg JSONL, logs, case results and screenshots are committed.
