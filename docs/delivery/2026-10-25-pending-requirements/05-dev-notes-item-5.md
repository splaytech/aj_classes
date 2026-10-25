# 05 — Developer notes: item 5 (public CSP, plus the item 9 docs line)

> **Stage:** 5 of /deliver (Developer) · **Date:** 26 Oct 2026 · **Branch:** `feature/public-csp`
> (worktree `aj_classes-items-4-9`, cut from `develop` @ `38412c5`, after item 4's merge)
> **Input:** [01b](01b-requirement-items-4-9.md) item 5 (AC-5.1–5.11), [02b](02b-architecture-items-4-8.md) §5,
> [ADR-0005](../../decisions/0005-public-csp-static-headers.md), [03b](03b-design-items-4-8.md) §0 and §5,
> [04b](04b-plan-items-4-8.md) §0 and T5.0–T5.12.
> **Next:** T5.9 Reviewer (`review-5-item-5.md`), then T5.10 Tester, T5.11 Security and T5.12 `/test-and-ship`.
> Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`). Nothing touched the
hosted project. I didn't read `supabase/.env.deploy`, and I didn't run `link`, `db push` or
`deploy`. Every build used the 04b §0 exports (local URL, local publishable key, Turnstile test
site key) and was checked for the hosted ref before it was served. The committed `vercel.json` and
`serve.railway.json` carry the hosted origin; the local origin only ever appears in the mirror's
config, which is written to `os.tmpdir()`.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T5.0 Branch and stack | Done | Branch was already cut at `38412c5`. `pnpm install --frozen-lockfile`, `pnpm db:reset`. Check 1 printed `1`. Check 2 printed `20261026100000`. `develop` CI for `38412c5`: `completed / success` (was `in_progress` at the start; checked again before the full check) |
| T5.1 Hosted-ref tool | Done | `hosted-ref.test.ts` 5 tests. Gate build → `check-hosted-ref: 0 files`, exit 0. A scratch file holding the ref → `1 files`, exit 1. `build/nope` → "no such path", exit 1 |
| T5.2 Mirror config | Done | `mirror-config.test.ts` 5 tests: noindex dropped on `**/*` and kept on the fallback; all 3 hosted origins replaced; `public` absolute; no hosted origin → `MirrorConfigError`; input unchanged |
| T5.3 Mirror server | Done | `pnpm mirror` serves :4173; `/portal/login` shows the portal CSP with `http://127.0.0.1:55321`; `--write-only` writes and exits; with a planted file holding the ref it exits 1 ("the build contains the hosted project ref in 1 files"); SIGTERM stops `serve` (port freed) |
| T5.4 Headers and tests | Done | `hosting-csp.test.ts` 7 tests, `hosting-config.test.ts` 6 (1 added). Mutation check below. AC-5.1 `curl` loop: every page prints `1` |
| T5.5 Docs | Done | PRP 3 annotations, `arch.md` paragraph, `03-design.md` §1.6 line. Each grepped after the edit (3 / 1 / 1 hits) |
| T5.6 Manual sweep | Done, one deviation (D5) | §3 |
| T5.7 Full check | Done | §2 |
| T5.8 Dev notes | Done | This file |
| T5.9–T5.12 | **Not started** | Reviewer, Tester, Security, `/test-and-ship` |

I didn't tick 04b. The Manager owns that file while this stage runs.

**Mutation check (T5.4).** Each change below, made to the working copy and then restored, fails
the hosting tests:

1. Railway's public CSP drops Kit → 1 failed (files differ).
2. A local origin added to both public CSPs → 2 failed.
3. The Vercel lookahead `source` replaced by `/(.*)` → the CSP test file fails to load (no rule
   with `PUBLIC_CSP_SOURCE`).
4. `https:` added to `img-src` in both → 1 failed (wildcard).
5. Railway rule order reversed → 1 failed.
6. A host added to the portal CSP in both → 1 failed (portal changed).

## 2. Commits and full check

Commits (oldest first):

1. `5f43fce` feat(hosting): add a hosted-ref check for gate builds
2. `b6d131d` feat(hosting): build the local mirror config from serve.railway.json
3. `90e9baa` feat(hosting): add pnpm mirror, the local production mirror
4. `d40096a` feat(hosting): send an enforcing CSP on public pages
5. `7d79682` docs: record the public CSP hosts and close item 9
6. This file (docs commit).

All staged by name. The branch diff is exactly the 16 files in 03b §5.1.

The full check, from the repo root with the 04b §0 exports:

| Step | Result |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` | Pass |
| `test` | **54 files, 457 tests** (51 / 439 after item 4; +3 files, +18 tests) |
| `VITE_APP_ENV=production pnpm build` | Pass |
| `pnpm --filter web check:hosted-ref build/client` | **`0 files`**, exit 0. Cross-check `grep -rl unzjnxctkyahtmrkinyr apps/web/build/client \| wc -l` = **0** |
| `db:test` (after `db:reset`) | **14 files, 507 tests, PASS** |
| `test:functions` | **169 `ok`, 0 failed** (the 5 "fail" words in the log are test names) |
| E2E (external repo, `AJ_CLASSES_DIR` = this worktree, `VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder`) | **9 passed** (1.6 min). Dev server on :5173 stopped afterwards |

`kinet validate` couldn't run ("KINET not initialised"), and I didn't run `kinet init`. Instead I
grepped the 9 changed TS files for `console.log`, `console.debug`, `TODO`, `: any`, `style={{`,
`innerHTML`, `querySelector` and `getElementById`: 0 hits. The CLIs write with
`process.stdout.write` / `console.error`, as 03b §0.2 says.

E2E runs on the dev server, which sends no CSP, so it proves nothing broke in the app but doesn't
exercise the policy. The sweep below does that.

## 3. Sweep (T5.6; production gate build on `pnpm mirror` :4173)

**Set-up.** The 03b §5.7 build: the 04b §0 exports plus `VITE_LEAD_CAPTURE=on`,
`VITE_FORM_ACCESS_KEY=local-placeholder`, `VITE_KIT_FORM_ID=0000000`;
`VITE_APP_ENV=production pnpm build`; `check:hosted-ref` → `0 files`; `pnpm mirror`. Browser:
**Google Chrome 155.0.8059.85** (the installed Chrome, driven headless by Playwright 1.64.1 from
the e2e repo, `channel: 'chrome'`). Each page × width got a fresh context and its own HAR.

**Mocks (AC-5.3).** `route.fulfill` for `https://api.web3forms.com/**`,
`https://app.convertkit.com/**` and `http://127.0.0.1:55321/functions/v1/leads**`. Nothing went to
Web3Forms, Kit or Zoho. Chrome checks CSP before Playwright's interception sees the request, so a
policy gap still shows as a violation. AC-5.8 below proves that: the `example.com` route was set
up too, and it was hit 0 times while its three requests were blocked.

**Violation count.** Two sources per page, de-duplicated: a `securitypolicyviolation` listener
installed before any page script, and console messages matching "Content Security Policy".

### 3.1 AC-5.3: public pages (16 pages × 2 widths × 2 data states = 64 passes)

The 16 pages: `/`, `/privacy`, `/resources`, `/posts`, `/subscribed`, `/nope`, the 9 programme
pages (`icas`, `interviews`, `maths-science-english`, `naplan`, `seal-and-scholarships`,
`selective-entry`, `ucat-and-gamsat`, `vce`, `vce-subject-selection`) and the one guide
(`/resources/victorian-selective-entry-exam`). That's every folder under `build/client/programmes`
and `build/client/resources`.

Each pass: load and hydration (`networkidle` + 0.5 s); at 360 px open and close the phone menu;
the News link check; on `/posts` the list; on `/` the enquiry submit; on every page the footer
subscribe.

| State | Passes | CSP violations | `supabase.co` requests | HTTP ≥ 400 (other than `/nope`) | What happened |
|---|---|---|---|---|---|
| 1 local post | 32 | **0** | **0** | 0 | News link shown on all 32. `/posts` lists 1 post at both widths. Menu opened (`aria-expanded=true`) and closed on all 16 at 360. Enquiry on `/` at both widths: Web3Forms mock hit 1, `leads` mock hit 1, form shows "Message sent / Thank you!…". Subscribe: Kit mock hit 1 on all 32 |
| 0 posts (deleted locally) | 32 | **0** | **0** | 0 | News link hidden on all 32. `/posts` shows no list; its REST read returned 200 `[]`, so it's the empty state, not the error state. Rest as above |

Origins requested across the sweep: `http://localhost:4173`, `http://127.0.0.1:55321`, and the two
mocked hosts. **HAR check (AC-5.11):** 65 HAR files, 1,793 requests, **0** request URLs containing
`supabase.co`; `grep -l supabase.co *.har` = **0** files.

### 3.2 Other ACs

| AC | Check | Result |
|---|---|---|
| 5.1 | `curl -sI` on the 16 pages: count of `Content-Security-Policy` | **1** on every page (`/nope` is a 404 with it). The mirror's `/` header equals `vercel.json`'s public policy with the local origin substituted (string compare: yes). Also 1 on `/favicon.svg` and an `/assets/*.js` file (03b §5.3: harmless) |
| 5.4 | JSON-LD on `/`, `/programmes/vce`, the guide | 1 `application/ld+json` each |
| 5.4 | Images on those 3 pages | 2/2 loaded on each. `/favicon.svg`, `/logo.svg`, `/apple-touch-icon.png`, `/logo-512.png`: 200. 0 violations on the asset pass |
| 5.4 | Fonts, manifest, OG image | Not present in the repo (see O1). Nothing to break |
| 5.4 | WhatsApp | The button's `href` is `https://wa.me/61469800685?text=…` on all 3 pages (a plain link; CSP doesn't govern navigation) |
| 5.4 | Environment marker | Staging build (`VITE_APP_ENV=staging`, same exports, `0 files`) on the mirror: "STAGING" shows on `/`, `/programmes/vce`, `/posts`, `/nope` at 360 and 1280; 0 violations; 0 `supabase.co` |
| 5.5 | `curl -sI` on `/portal`, `/portal/login`, `/portal/admin/staff` | Exactly **1** CSP each, equal to the committed portal CSP with the local origin (string compare: yes). `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` on each |
| 5.5 | Sign-in on the mirror as `admin@local.test`, at 360 and 1280 | Turnstile loaded from `challenges.cloudflare.com`, its token was sent with the sign-in (`auth/v1/token` 200), two-step page asked, TOTP accepted, landed on `/portal/admin`. On Admin → Staff → Local Tutor, with a local test photo uploaded to the local `avatars` bucket: the photo loads from `127.0.0.1:55321/storage/…` (2/2 images). **0 violations**, 0 `supabase.co`. File downloads: item 2 is held (03b §9) |
| 5.6 | `curl -sI localhost:4173/` | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`; no `X-Robots-Tag`. HSTS: unit test check 7 and the release check (`serve` doesn't send it) |
| 5.7 | `PORT=4174 pnpm --filter web start:railway` | `/`, `/programmes/vce`, `/nope`: 1 CSP each, naming the hosted origin, no Cloudflare. `/portal/login`: exactly 1 CSP, the portal one. Only `curl` was used against it; stopped afterwards |
| 5.8 | On the mirror's `/`: injected `<script src="https://example.com/x.js">`, `fetch('https://example.com/data')`, `new Image().src = 'https://example.com/beacon.gif'` | 3 violations: `script-src-elem`, `connect-src`, `img-src`. `fetch` rejected ("Failed to fetch"). The `example.com` route was hit **0** times |
| 5.8 | `document.body.setAttribute('onclick', 'document.title = "ran"')`, then a click | Title became `ran`: inline handlers **run on purpose** under `'unsafe-inline'` (ADR-0005 decision 1) |
| 5.9, 5.10 | Docs | §1, T5.5 |
| 5.11 | `check:hosted-ref` on both gate builds (production and staging) | `0 files` each; the mirror re-checked before serving |

The local post, the test photo and its profile path were removed by the `db:reset` before
`db:test`. The scripts and HARs are in the session scratchpad, not the repo
(`…/scratchpad/sweep/sweep.mjs`, `*.har`, `*.json`).

## 4. Deviations and `[ASSUMPTION]`s

- **D1. `findHostedRefs` on a single file returns that path as given**, not relative (there's
  nothing to be relative to). The CLI prints folder hits joined with their folder, so a hit can be
  opened straight from the output.
- **D2. Extra unit cases** beyond 03b §5.5: `hosted-ref.test.ts` also checks that
  `node_modules`, non-text files and symlinked folders are skipped, a single file as the root, and
  that a missing path throws. `hosting-config.test.ts` gained one test (only `/portal/:path*`
  carries the portal CSP), as 03b says.
- **D3. One `hosting-config.test.ts` title changed.** 03b says the Railway test is "unchanged".
  Its assertion is unchanged, but `PORTAL_ONLY_HEADERS` no longer contains the CSP, so the old title
  ("sends the portal CSP and no-store on Railway…") would claim something it no longer checks. It
  now reads "sends noindex and no-store on Railway only with the portal fallback page". The
  Railway portal CSP is covered by `hosting-csp.test.ts` checks 1 and 5.
- **D4. `arch.md` paragraph: two sentences more** than 03b §5.6: that the portal keeps its own,
  non-overlapping CSP, and that `pnpm mirror` serves a gate build with these headers locally.
- **D5. The sweep was scripted, not clicked by hand in DevTools.** 03b §5.7 describes DevTools
  request blocking. I used Playwright with the installed Chrome instead, and real `route.fulfill`
  mocks (closer to "mocked at the network layer" than blocking). It covers more than a hand pass:
  64 public passes, both widths, two data states, every programme page. **What it doesn't cover:**
  it's headless Chrome only. A headed look in Safari or Firefox wasn't done (not asked for by
  AC-5.3, which records "the browser").
- **D6. The mirror binds `serve -l 4173`** as 03b §5.4 step 5 says. `serve` reports
  `http://localhost:4173`.
- `[ASSUMPTION]` 03b's "the Railway mirror stays unsubstituted" holds: `start:railway` was only
  `curl`ed, never opened in a browser, so its hosted origin was never contacted.

## 5. Observations (not changed, outside item 5)

- **O1. The OG image and web manifest don't exist.** `og:image` and `twitter:image` point at
  `https://ajclasses.com.au/og-image.png`, but there is no `og-image.png` in `apps/web/public`,
  and the live site returns 404 for it (`curl -sI`, read-only). The same goes for
  `/site.webmanifest`. So link previews on WhatsApp and Facebook show no image today. PRP F6.3.3
  asks for a 1200×630 OG image. Worth a ticket: it needs the image (Saurabh or a designer), then
  one file in `public/`. The CSP already allows it (`img-src 'self'`). No web fonts are
  self-hosted either (system font stack), so `font-src 'self'` has nothing to load yet.
- **O2. E2E doesn't see the CSP.** The external suite runs on the dev server (no headers). Item 6's
  `e2e/csp/public-csp.spec.ts` against the mirror closes that gap (03b §6.5).

## 6. What I didn't verify

1. **The negative-lookahead `source` on real Vercel** (02b §5.6 risk 1). The regex is unit-tested
   and `serve` is checked locally, but only a Vercel deploy proves Vercel matches it the same way.
   That's Saurabh's preview check (release step 1), then the team's live `curl` count.
2. **Vercel Analytics under the CSP.** The mirror stubs `/_vercel/insights/script.js`; the real
   script and beacon are only checked on the live site (AC-5.4 release check).
3. **HSTS on a response.** `serve` doesn't send it; the unit test proves the global Vercel rule is
   unchanged, and the release check `curl`s it.
4. **Work-file downloads under the portal CSP.** Item 2 is held; its T2.15 re-test covers them.
5. **Browsers other than Chrome** (D5).

## 7. Release steps for Saurabh (from 03b §5.8 and 04b §8.2)

1. **Before the merge to `main`:** open the `develop` preview (behind Vercel's login), DevTools →
   Network. The `/portal/login` document has exactly **one** `content-security-policy`, the portal
   one (it names `challenges.cloudflare.com`); `/` has the public one. `vercel.live` toolbar
   violations on the preview are expected. Never add that host.
2. Normal production release (`release/public-csp`). No migration or function.
3. **After release (team, read-only):** `curl -sI` on `/`, `/programmes/vce`, `/nope` shows the
   public CSP; `/portal/login` shows exactly 1 CSP, the portal one;
   `/_vercel/insights/script.js` → 200; HSTS present; the live home page shows 0 CSP violations in
   Chrome. If `/portal/*` ever shows two CSPs, revert the release (config only).
