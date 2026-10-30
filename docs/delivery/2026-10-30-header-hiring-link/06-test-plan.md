# 06 Test plan: "We're hiring" link in the site header

Stage 6a (Tester), 30 Oct 2026. Branch `feature/header-hiring-link`. Input: `01-requirement.md` (AC-1 to AC-14), `02-architecture.md` (DEC-HL-1 to DEC-HL-5), `03-design.md`, `05-dev-notes.md`, review-1 to review-5 (and review-6a on this plan), `git diff develop...HEAD`, and the Tester addendum (`~/second-brain/Projects/AJClasses/_agents/tester.md`).

This plan is not executed yet. `/test-and-ship` freezes it and runs it. Write each case's Actual and Result into the TSR as soon as the case runs.

## 0. Build under test and how expected values were derived

- Plan base: `95412b9` (HEAD of `feature/header-hiring-link`), against `develop` `3fadfea`. At run time, if `git diff --quiet 95412b9 HEAD -- apps/web/src e2e` fails, re-derive every count and expected value below from the files before comparing.
- Every expected value comes from the source, not from memory:
  - Label `"We're hiring"`: `CAREERS.linkLabel` (`careers.constants.ts:13`), exposed as `NAV.careersLink` (`content.constants.ts:56`). Path `/careers`: `ROUTES.careers`.
  - Header nav order (no posts): Programmes, Our Approach, About, FAQ, Contact, We're hiring (`NAV.links` plus `careersLink`). Programmes has 9 sub-links (`PROGRAMMES.items`, the same 9 `/programmes/*` paths in the sitemap). Actions: Sign in (portal flag), Register Interest.
  - Sizes from `theme.css`: `--font-size-sm` 15px, body 18px, `--font-weight-medium` 500, `--icon-size-md` 20px, `--header-height` 72px, `--color-text-emphasis` `rgb(23, 37, 84)`, `--color-primary` and `--color-focus` `rgb(37, 99, 235)`. Focus style from `global.css:62`: `outline: 3px solid var(--color-focus)`.
  - Logo gap expected per width from `02-architecture.md` DEC-HL-3: 14 / 83 / 110 / 110 / 46 / 46px at 1024 / 1093 / 1180 / 1279 / 1280 / 1440. Stop line: under 10px at 1024 (`04-plan.md:53`).
  - Analytics: `ANALYTICS_EVENTS.ctaClick` = `cta_click`, `CTA_LOCATIONS.header` = `header`, `CTA_LOCATIONS.mobileBar` = `mobile_bar`. `trackEvent` only sends when `APP_CONFIG.features.analytics` (production build only), so analytics cases run on the production gate build.
  - Suite counts, re-listed on this machine on 30 Oct: smoke **10 tests in 5 files**, CSP **21 tests in 1 file** (`playwright test --list`). Unit: dev notes report web **665 passed (76 files)** and e2e-unit **6**; the header and footer files hold **18** tests (develop had 10: 9 `it` blocks plus one 2-case `it.each`; branch has 16 blocks plus two 2-case `it.each`).
  - Sitemap: 15 URLs (`/sitemap.xml`). Prerendered HTML (excluding `__spa-fallback.html`): 18 files (15 sitemap pages plus `/subscribed`, `/404/index.html`, `/404.html`).
  - Local seed has **0** posts (`select count(*) from public.posts` returned 0), so News is hidden for real. The crowded case injects a News `<li>` in the browser DOM only. No DB writes.
- Every shell gate and browser harness below was dry-run on this machine on 30 Oct (zsh, BSD tools), and each gate was shown to fail on a planted bad input. Those dry runs are harness checks, not case results.

## 1. Pre-freeze findings for the lead

1. **F-1 (environment, not this branch): `pnpm format:check` fails on two local files.** It flags `actionItems.md` (untracked, repo root) and `supabase/.temp/linked-project.json` (ignored by `supabase/.gitignore`, which Prettier doesn't read). Every tracked file passes (`git ls-files` variant, exit 0). CI checks out tracked files only, so CI is unaffected. Plan: G-01 runs the tracked-file variant as the gate and records the raw `pnpm format:check` output as evidence. Lead decision (30 Oct): `actionItems.md` stays untracked, and the tracked-files-only check is the accepted gate.
2. **F-2: `apps/web/build/` is currently a `.env.production` build.** `check:hosted-ref build/client` exits 1, and the prerendered pages show Sign in, so it references the hosted project. Don't serve it. Lead decision (30 Oct): G-03 rebuilds the gate build before anything is served. All 4173 cases (S-03, D-12, AN-*) need that rebuild.
3. **F-3: the smoke reuses whatever is on 5173.** A dev server is already listening on `[::1]:5173` (pid 16833 at plan time, `react-router dev` from this checkout, started by the lead). Global setup reuses a running server "as it is", without the `VITE_*` values from `e2e/.env`. Lead decision (30 Oct): the lead stops that dev server before the run, so the smoke's global setup starts its own with the `e2e/.env` values. G-02 checks 5173 is free first (`5173-before.txt` empty) and stops if it isn't. One owner for start, stop and smoke runs: the Tester during the gate, nobody else.
4. **F-4 (observation, not a bug): the font stack starts with `'Inter'`, but no web font is loaded,** so every visitor sees the system font. This Mac has no Inter, so all measurements are SF Pro (Chromium, WebKit) plus forced Arial and Helvetica. A visitor with Inter installed locally isn't measured. Listed under "Not covered".
5. **F-5 (observation for the PO): phone-menu links are 45px tall, under `--tap-target` 48px.** That's true of every menu link on `develop` too. AC-6 only asks for the same height as the other menu links, so it's not a defect here.

No finding contradicts an AC.

## 2. Environment and run order

- Dev server: `http://localhost:5173` (strict port; take the URL from the run log). Mirror for the production gate build: `http://127.0.0.1:4173` (`pnpm --filter web mirror`, started by `test:csp` or by hand).
- Local Supabase API `:55321`, DB `:55322`. Read-only except the smoke suite, which creates and deletes its own `e2e-<runId>-` rows.
- Browser harnesses (Playwright 1.64 from `e2e/node_modules`, Chromium 1248 and WebKit 2370 installed) are in the scratchpad: `/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl/`
  - `desktop.cjs <base> <chromium|webkit> <font|-> <path> <widths...>`: injects News if absent, prints per width the item order, logo gap, Sign in icon width, header height, one-row flag, sideways scroll, and the careers / News / Sign in / CTA / sub-link computed styles.
  - `phone.cjs <base> <widths...>`: closed state, opens the menu, order, heights, font, actions, taps the link, records the landing URL, h1, menu button state and `aria-current`.
  - `keys.cjs <base> <path> <width> [news]`: Tab sequence from page load to the header Register Interest, the focus style on the careers link, then Enter.
  - `analytics.cjs <base> <width>`: wraps `window.va`, clicks the careers link (navigation prevented) then the header Register Interest, prints the calls and any `supabase.co` request.
  - `sweep.cjs <base> <width> <paths...>`: status, console errors, sideways scroll, h1 count, `meta[name=robots]` count, header and footer careers links, exit 1 on any failure.
  - If the folder is gone, rebuild each harness from its description above before running.
- Each tool call is a fresh zsh shell: each block starts with its own `cd` and `export`, and exit codes are captured with `cmd > log 2>&1; echo "exit=$?"`.
- Order: G-01 → S-01, S-02 → G-02 (smoke) → dev-server browser cases (D, P, K, A, R) → G-03 (gate build, CSP) → S-03, D-12, AN-* on 4173 → G-04 cleanup.
- Light/dark: the public site has no dark theme. Dark mode is portal-only (`[data-portal-theme='dark']`, `theme.css:80`). R-12 checks the public header stays light even when the portal theme is dark.

Scratch and evidence folder for the run:

```bash
export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; export H=$S/hl; mkdir -p $S/run && echo ok
```

## 3. Gates (commands)

### G-01 Full repo check (AC-14)

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm format:check > $S/run/format-raw.log 2>&1; echo "raw-exit=$?"; git ls-files -z | xargs -0 pnpm exec prettier --check --ignore-unknown > $S/run/format.log 2>&1; echo "tracked-exit=$?"
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm lint > $S/run/lint.log 2>&1; echo "lint=$?"; pnpm typecheck > $S/run/typecheck.log 2>&1; echo "typecheck=$?"
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm test > $S/run/test.log 2>&1; echo "test=$?"; grep -E "Test Files|Tests |# (tests|pass|fail)" $S/run/test.log
```

```bash
cd /Users/sjain/dev/work/aj_classes/apps/web && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm exec vitest run src/components/layout/header src/components/layout/footer > $S/run/header-footer.log 2>&1; echo "exit=$?"; grep -E "Test Files|Tests " $S/run/header-footer.log
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; VITE_APP_ENV=production pnpm build > $S/run/build.log 2>&1; echo "build=$?"; ls apps/web/build/client/careers/index.html
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm db:test > $S/run/db-test.log 2>&1; echo "db-test=$?"; tail -3 $S/run/db-test.log
```

Expected: tracked-exit 0 (raw-exit 1 only on the two F-1 files, else it's a real failure), lint 0, typecheck 0, test 0 with web **665 passed (76 files)** and e2e-unit **6 pass, 0 fail**, header and footer **18 passed (2 files)**, build 0 and `careers/index.html` exists, db-test 0 (no DB change, run as a regression). The plain production build is replaced by the gate build in G-03, so don't serve it (F-2).

### G-02 E2E smoke (AC-13, AC-14)

Precondition: the lead has stopped the 5173 dev server (F-3). If `5173-before.txt` below is not empty, stop and tell the lead; do not run the smoke against it.

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; lsof -nP -iTCP:5173 -sTCP:LISTEN > $S/run/5173-before.txt; cat $S/run/5173-before.txt; node e2e/scripts/local-env.mjs > e2e/.env; echo "env=$?"
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm --filter aj-classes-e2e test:smoke > $S/run/smoke.log 2>&1; echo "smoke=$?"; grep -E "passed|failed|flaky|skipped" $S/run/smoke.log | tail -3
```

Expected: smoke 0, **10 passed**, 0 failed, 0 skipped.

### G-03 Production gate build, hosted-ref, CSP (AC-14; feeds S-03, D-12, AN-*)

Rebuild the gate build right before `test:csp` (addendum), and don't run another build until S-03, D-12 and AN-* are done.

```bash
cd /Users/sjain/dev/work/aj_classes/apps/web && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 pnpm build > $S/run/gate-build.log 2>&1; echo "gate-build=$?"; pnpm --filter web check:hosted-ref build/client > $S/run/hosted-ref.log 2>&1; echo "hosted-ref=$?"; grep -E "files" $S/run/hosted-ref.log | tail -1
```

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; pnpm --filter aj-classes-e2e test:csp > $S/run/csp.log 2>&1; echo "csp=$?"; grep -E "passed|failed|skipped" $S/run/csp.log | tail -3
```

Expected: gate-build 0, hosted-ref 0 with `0 files`, csp 0 with **21 passed**. `/careers` is already in the CSP page list (`e2e/csp/public-csp.spec.ts:29`).

Lighthouse and structured data aren't in the AC set (no SEO, JSON-LD or performance change). Not run; listed under "Not covered".

### G-04 Cleanup (addendum)

```bash
cd /Users/sjain/dev/work/aj_classes && docker exec supabase_db_aj_classes psql -U postgres -At -c "select 'posts', count(*) from public.posts where title like 'e2e-%' union all select 'enquiries', count(*) from public.enquiries where name like 'e2e-%' or email like 'e2e-%' union all select 'profiles', count(*) from public.profiles where email like 'e2e-%' union all select 'auth.users', count(*) from auth.users where email like 'e2e-%';"; lsof -nP -iTCP:5173 -sTCP:LISTEN; lsof -nP -iTCP:4173 -sTCP:LISTEN; echo done
```

Expected: `posts|0`, `enquiries|0`, `profiles|0`, `auth.users|0` (marker columns from `e2e/src/fixtures/markers.ts` and the specs: post title, enquiry name and email, invitee email; dry-run 30 Oct gave all 0). Port 5173: nothing (stop the server the smoke's global setup left running; it was started by the gate). Port 4173: nothing (stop the mirror). Kill only servers the gate started.

## 4. Static gates

### S-01 Label has one source (AC-2)

```bash
cd /Users/sjain/dev/work/aj_classes && n=$(grep -rnE "We're hiring|We\\\\'re hiring" apps/web/src/components apps/web/src/routes --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' | wc -l | tr -d ' '); echo "literal-hits=$n"; for f in apps/web/src/components/layout/header/Header.tsx apps/web/src/components/layout/footer/Footer.tsx; do echo "$(basename $f)=$(grep -o 'NAV\.careersLink' $f | wc -l | tr -d ' ')"; done; echo "footerLink-uses=$(grep -rn 'CAREERS\.footerLink' apps/web/src | wc -l | tr -d ' ')"
```

Expected output, exactly: `literal-hits=0`, `Header.tsx=4`, `Footer.tsx=2`, `footerLink-uses=0`. It counts matches with `grep -o | wc -l`, not lines: `Footer.tsx:81` has both uses on one line, so `grep -c` would print 1 (review-6a finding 1). Dry-run on `95412b9` after the fix printed exactly those four lines. Proof of fail: a planted `.tsx` with `<a>We're hiring</a>` gives 1 (dry-run 30 Oct).

### S-02 No rule targets the link alone (AC-4, AC-7)

```bash
cd /Users/sjain/dev/work/aj_classes && f=apps/web/src/components/layout/header/Header.module.css; re='careers|hiring|last-child|nth-child|nth-of-type|last-of-type|\[href|aria-current'; base=$(git show develop:$f | perl -0pe 's#/\*.*?\*/##gs' | grep -ciE "$re"); head=$(perl -0pe 's#/\*.*?\*/##gs' $f | grep -ciE "$re"); echo "develop=$base head=$head"; [ "$base" = "$head" ]; echo "css-gate=$?"; for c in $(grep -rliE 'careers|hiring' apps/web/src --include='*.css'); do echo "$c $(perl -0pe 's#/\*.*?\*/##gs' $c | grep -ciE 'careers|hiring')"; done; sed -n '/<li key={NAV.careersLink.href}>/,/<\/li>/p' apps/web/src/components/layout/header/Header.tsx | grep -cE 'className|hidden|aria-hidden|style=|hasNews|APP_CONFIG'
```

Expected: `develop=2 head=2` (the two existing `.subLinks a[aria-current]` rules), `css-gate=0`; every CSS file listed shows 0 (only comments mention it); the JSX block count is 0 (no class, hidden flag, style, News or portal condition). Proof of fail: appending `.links > li:last-child > a { display: none; }` makes head 3 (dry-run 30 Oct).

### S-03 Prerendered HTML has the link, in order, on every page (AC-1, AC-3, AC-4, AC-9, AC-12; production build)

Runs on the G-03 gate build (portal off, no posts at build time).

```bash
cd /Users/sjain/dev/work/aj_classes && export S=/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad; zsh $S/prerender-gate.sh apps/web/build/client; echo "exit=$?"; grep -c 'href="/portal/login"' apps/web/build/client/index.html
```

`prerender-gate.sh` (scratchpad) checks every `.html` except `__spa-fallback.html`: exactly one header match of `Contact</a></li><li><a href="/careers"( aria-current="page")?>We&#x27;re hiring</a></li></ul><div class="_actions_`, exactly one footer match of `Parent guides</a><a href="/careers">We&#x27;re hiring</a><a href="/privacy">`, and `aria-current="page"` on the careers link once on `careers/index.html` and zero times elsewhere. If the script is missing, recreate it from that description.

Expected: `pages=18 fail=0`, exit 0; the Sign in count is 0 (portal off in the gate build, so this is the AC-4 "portal flag off" case on a real build). Proof of fail: a copy with the header `<li>` removed from `privacy` and `aria-current` added to the home footer link fails both pages, exit 1 (dry-run 30 Oct).

## 5. Browser cases

Unless a case says otherwise: Chromium, dev server, home page `/`, fresh page per width, wait for `networkidle` before measuring.

### Desktop, crowded header (News injected in the DOM, portal on) (AC-5, AC-10, AC-13 exception)

```bash
cd /private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl && node desktop.cjs http://localhost:5173 chromium - / 1024 1093 1180 1279 1280 1440 > ../run/desktop-chromium.log 2>&1; echo "exit=$?"; cat ../run/desktop-chromium.log
```

For D-01 to D-06, pass needs all of these: `injected:true`; `order` = `Programmes|Our Approach|About|FAQ|Contact|News|We're hiring`; `oneRow:true`; `hScroll:0`; `headerH:72`; `signInIconW:20`; `logoGap` ≥ 10 and within ±3px of 02's figure; `careers.visible:true`, `careers.lines:1`, `careers.ws:nowrap`; careers and News both `15px` / `500` / `rgb(23, 37, 84)`; `signInFont:15px`; `ctaFont:18px`; `subFont:18px`; `consoleErrors:0`.

| ID | AC | Width | Expected logo gap | Method |
|---|---|---|---|---|
| D-01 | AC-5, AC-10 | 1024 | 14px (stop line 10) | browser |
| D-02 | AC-5 | 1093 (1366 at 125%) | 83px | browser |
| D-03 | AC-5 | 1180 (iPad landscape) | 110px | browser |
| D-04 | AC-5 | 1279 (last band width) | 110px | browser |
| D-05 | AC-5 | 1280 (normal gaps return) | 46px | browser |
| D-06 | AC-5 | 1440 | 46px | browser |

| ID | AC | Steps | Expected | Method |
|---|---|---|---|---|
| D-07 | AC-5 (review-2 finding 4) | `node desktop.cjs http://localhost:5173 webkit - / 1024 1280` | Same pass rules as D-01 and D-05 in WebKit (Safari's engine): gaps 14 and 46 (±3), one row, icon 20 | browser (WebKit) |
| D-08 | AC-5 (font fallbacks) | `node desktop.cjs http://localhost:5173 chromium Arial / 1024` then the same with `"Helvetica Neue"` | One row, no sideways scroll, icon 20, gap ≥ 10 (Arial was 35 in review-2) | browser |
| D-09 | AC-3, AC-4, AC-5 | Real state, no injection: in DevTools/Playwright at 1024 and 1280, read the nav `> ul > li > a` texts and tops | 6 items, ends `Contact|We're hiring`; no News; one row; careers visible | browser |
| D-10 | AC-10 | At 1280 (crowded): count nav elements with a non-transparent background or a border (`getComputedStyle`); compare careers to News at rest and on hover (`page.hover`) | Exactly 1 filled element in the header nav (Register Interest); careers has `backgroundColor rgba(0, 0, 0, 0)`, `borderStyle none`, no `svg` child; hover colour `rgb(37, 99, 235)` for both careers and News; screenshot saved for Saurabh's visual check | browser + screenshot |
| D-11 | AC-13 | At 1280 crowded, hover Programmes, then move to a sub-link | Dropdown shows 9 sub-links, `visibility: visible`, sub-links 18px; the dropdown box doesn't cover the careers link's row text after moving away (it closes on mouse-out) | browser |
| D-12 | AC-5, AC-13 (production build) | After G-03, with the mirror on 4173: `node desktop.cjs http://127.0.0.1:4173 chromium - / 1024 1280` | Gate build has portal off, so `signInIconW:null` and `signInFont:null`; order with News injected same as D-01; one row; `hScroll:0`; careers 15px/500; `consoleErrors:0`; logo gap ≥ the D-01/D-05 figure (less crowded without Sign in) | browser (prod) |

### Phone and tablet menu (AC-3, AC-6, AC-7)

```bash
cd /private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl && node phone.cjs http://localhost:5173 375 768 1023 > ../run/phone.log 2>&1; echo "exit=$?"; cat ../run/phone.log
```

| ID | AC | Width | Expected | Method |
|---|---|---|---|---|
| P-01 | AC-3, AC-6, AC-7 | 375 | Closed: careers `visible:false` and Contact `visible:false` (same reason: `navDisplay:none`), no `aria-hidden` or `hidden` ancestor. Open: `expanded:"true"`, careers visible, order `Programmes|Our Approach|About|FAQ|Contact|We're hiring`, all heights equal (45 each), font 18px, actions `Sign in|Register Interest` after the list, `hScroll:0`. Tap: lands on `/careers` (a full load, `sameDocument:false`), h1 `We're hiring`, menu button `Open menu` / `aria-expanded:"false"`, link `aria-current:"page"` | browser (touch) |
| P-02 | as P-01 | 768 | as P-01 | browser (touch) |
| P-03 | as P-01 | 1023 | as P-01; and the menu button is still shown at 1023 (`.menuButton` visible) | browser (touch) |
| P-04 | AC-3, AC-6 | 375, News injected after the menu opens (clone of Contact before careers) | Open menu order ends `Contact|News|We're hiring`, then the actions; News and careers the same height | browser |

### Keyboard and focus (AC-8, AC-3)

```bash
cd /private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl && node keys.cjs http://localhost:5173 / 1280 > ../run/keys-1280.log 2>&1; echo "exit=$?"; node keys.cjs http://localhost:5173 / 1024 news > ../run/keys-1024-news.log 2>&1; echo "exit=$?"; cat ../run/keys-*.log
```

| ID | AC | Steps | Expected | Method |
|---|---|---|---|---|
| K-01 | AC-8, AC-3, AC-13 | `keys.cjs` at 1280, real state | Tab stops, in order (19): Skip to main content, AJ Classes home, Programmes, the 9 sub-links (`/programmes/selective-entry` … `/programmes/ucat-and-gamsat`, focus opens the dropdown), Our Approach, About, FAQ, Contact, **We're hiring /careers**, Sign in /portal/login, Register Interest /#contact. Focus style on careers: `solid 3px rgb(37, 99, 235)`, `:focus-visible` true. Enter: `/careers`, h1 `We're hiring` | browser (keyboard) |
| K-02 | AC-8, AC-3 | `keys.cjs` at 1024 with News injected | Same sequence with `News /posts` between Contact and We're hiring (20 stops); Enter opens `/careers` | browser (keyboard) |
| K-03 | AC-8, AC-6 | 375: Tab to the menu button, Enter, Tab on to the careers link, read focus style, Enter | Menu opens on Enter; Tab reaches careers after Contact, before Sign in; focus style as K-01; Enter lands on `/careers` | browser (keyboard) |

### aria-current (AC-9)

| ID | AC | Steps | Expected | Method |
|---|---|---|---|---|
| A-01 | AC-9 | Dev server: load `/careers` and `/careers/` (fresh page each), read the header careers link | `aria-current="page"` on both | browser |
| A-02 | AC-9 | On `/careers`, check the footer careers link and the Programmes sub-links | Footer link has no `aria-current` (unchanged footer, AC-12); no sub-link has it | browser |

### Analytics, production gate build on the mirror (AC-11, AC-13)

```bash
cd /private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl && node analytics.cjs http://127.0.0.1:4173 1280 > ../run/an-1280.log 2>&1; echo "exit=$?"; node analytics.cjs http://127.0.0.1:4173 375 > ../run/an-375.log 2>&1; echo "exit=$?"; cat ../run/an-*.log
```

| ID | AC | Steps | Expected | Method |
|---|---|---|---|---|
| AN-01 | AC-11 | `analytics.cjs` at 1280 | `vaPresent:true` (else the case is invalid, not passed); `afterCareers: []`; `afterCta` has exactly one call `["event",{"name":"cta_click","data":{"location":"header"}}]`; `hosted:0` | browser (prod) |
| AN-02 | AC-11, AC-6 | `analytics.cjs` at 375 (menu opened before each click) | Same as AN-01 | browser (prod) |
| AN-03 | AC-13 | Mirror, 375, home: wrap `window.va` as in AN-01, scroll until `#hero` is above the viewport and `#contact` is below, wait for `aside[aria-label="Register interest"]`, click its Register Interest | Bar appears; exactly one call `cta_click` with `location: mobile_bar`; bar hides once the contact form is in view | browser (prod) |

### Regression next to the header (AC-12, AC-13)

| ID | AC | Steps | Expected | Method |
|---|---|---|---|---|
| R-01 | AC-13 | 1280 and 375 (menu open): click Programmes > Selective Entry Exam | Lands on `/programmes/selective-entry`; that sub-link has `aria-current="page"`; careers link has none | browser |
| R-02 | AC-4, AC-13 | Dev server with the real seed (0 posts, read with `docker exec supabase_db_aj_classes psql -U postgres -At -c "select count(*) from public.posts;"`) at 1280 and 375 | News absent from header and footer; careers present in both; with posts, News-before-careers is covered by unit T1 and `is second to last of 7 nav items` (no DB writes) | browser + unit |
| R-03 | AC-13 | 1280: click Sign in; 375: open menu, tap Sign in | `/portal/login` loads; the Sign in icon is 20px at 1280 (from D-05) | browser |
| R-04 | AC-13 (addendum) | Sign in at `/portal/login` as `tutor@`, `student@`, `parent@`, `admin@` (dev server enters the two-step code), `newadmin@local.test` (password from `supabase/seed.sql`), then reload | Lands on `/portal/tutor`, `/portal/student`, `/portal/parent`, `/portal/admin`, and the two-step setup screen `/portal/account/two-step/setup?next=…` for `newadmin@` (`portal-access.ts:110`); each survives reload | browser |
| R-05 | AC-13 (addendum) | Sign in as `inactive@local.test` | Refused with "Email or password is incorrect." (`error.constants.ts`); stays on `/portal/login` | browser |
| R-06 | AC-13 | 1280: click header Register Interest; 375: open menu, tap it | URL `/#contact`, the contact section is in view below the sticky header; on 375 the menu closes (`aria-expanded="false"`) | browser |
| R-07 | AC-12 | 1280 and 375: read the footer legal row, click its We're hiring | Order `Parent guides, We're hiring, Privacy Policy, Sign in` (News first only when posts exist); href `/careers`, no `target`; click lands on `/careers` | browser |
| R-08 | AC-13 | Dev server, 375, home: scroll past the hero, then to the contact form | Mobile CTA bar appears after the hero and hides at the form; it isn't shown at 1024+ | browser |
| R-09 | AC-13 | 375 and 1280 on `/`, `/careers`, `/privacy`; then `/portal/login` | WhatsApp button (`WHATSAPP_BUTTON.ariaLabel`) visible bottom-right on public pages, not on `/portal/login` | browser |
| R-10 | AC-13 | `git diff --quiet develop HEAD -- apps/web/src/routes/careers.tsx; echo $?` and `git diff develop HEAD -- apps/web/src/constants/careers.constants.ts`; then load `/careers` at 375 and 1280 | Exit 0 for the route; the constants diff is only the `footerLink` → `linkLabel` rename and its comment; page 200, one h1 `We're hiring`, the same h2s as develop (from `CAREERS`), no console errors | git + browser |
| R-11 | AC-1, AC-9, AC-13 (addendum sweep) | `sweep.cjs` at 375 and 1280 on every sitemap path plus `/subscribed` (block below) | Each width: `pages:16 bad:0`. Per page: 200, no console errors, `hScroll:0`, one h1, one `meta[name=robots]` (BUG-1 guard), header link `/careers` (`/careers@page` only on `/careers`), footer link `/careers`, last nav item `We're hiring` | browser |
| R-12 | AC-13 (light/dark) | Dev server, Playwright `colorScheme: 'dark'`, set `localStorage['aj-classes-portal-theme']='dark'`, load `/` and `/careers` at 1280 | No `data-portal-theme` attribute on the page; header background `rgb(255, 255, 255)` and careers colour `rgb(23, 37, 84)` (light, same as without the setting) | browser |
| R-13 | AC-1 (assumption 3) | Load `/portal/login` | The public header (`nav#main-navigation`) isn't on the page, so no careers header link in the portal | browser |
| R-14 | AC-6, AC-13 | 375: open the menu, tap Contact, then reopen and tap We're hiring | Contact closes the menu and scrolls (same-document hash change); careers does a full load to `/careers`; neither leaves the menu open | browser |

R-11 command:

```bash
cd /private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/hl && P=$(curl -s http://localhost:5173/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed -E 's#<loc>https://ajclasses.com.au##; s#</loc>##' | tr '\n' ' '); echo "$P" | wc -w; for w in 375 1280; do node sweep.cjs http://localhost:5173 $w ${=P} /subscribed > ../run/sweep-$w.log 2>&1; echo "w=$w exit=$?"; tail -1 ../run/sweep-$w.log; done
```

Expected: 15 paths from the sitemap, then `exit=0` and `bad:0` at each width. Proof of fail: `/robots.txt` (no header) gives `bad:1`, exit 1 (dry-run 30 Oct).

## 6. Traceability

| AC | Cases |
|---|---|
| AC-1 | S-03, R-11, A-01, R-13, unit T1/T2 (G-01) |
| AC-2 | S-01, unit T2 + Footer test (G-01) |
| AC-3 | S-03, D-01..D-06, D-09, P-01..P-04, K-01..K-03, unit T1/T3 |
| AC-4 | S-02, S-03 (portal off), D-09, R-02, unit T1 |
| AC-5 | D-01..D-09, D-12 |
| AC-6 | P-01..P-04, K-03, R-14, AN-02, unit T5 |
| AC-7 | S-02, P-01..P-03 (hidden for the same reason as Contact), unit T7 |
| AC-8 | K-01..K-03, unit T3 |
| AC-9 | A-01, A-02, S-03 (all prerendered pages), R-11 (every sitemap page), unit T4 |
| AC-10 | D-01..D-06 (style fields), D-10; visual sign-off for Saurabh (section 7) |
| AC-11 | AN-01, AN-02, unit T6 |
| AC-12 | S-03, R-07, A-02, Footer tests |
| AC-13 | G-02, G-03, D-11, D-12, AN-03, R-01..R-14 |
| AC-14 | G-01, G-02, G-03 |

Review-5 finding 1 (AC-4's portal-off case rested on code review, since no unit test renders with the portal flag off) is closed by S-03: the gate build has the portal flag off, and S-03 checks the link is on all 18 prerendered pages with Sign in absent.

## 7. Not covered (outside the frozen pass/fail set)

For Saurabh (needs his eyes or devices; the TSR words AC-5 and AC-10 as "partly verified" for these parts, never a plain PASS on them):

1. Visual judgement of emphasis (AC-10, assumption 1): open the D-10 screenshots (1024 crowded, 1280, 375 menu) and confirm "We're hiring" reads as a peer link and Register Interest is still the only button. If the owner still wants "big", that's D1d.
2. Real Safari on a Mac at 1024px wide (D-07 covers the WebKit engine, not the Safari app with its own font settings), and a real iPhone tap on the menu link.

Not covered at all, with the reason:

3. A visitor with Inter installed locally, and Windows Segoe UI (F-4). Neither font is on this Mac. D-08 covers Arial and Helvetica Neue.
4. Firefox (no Playwright Firefox installed; installing a browser isn't in scope for this item).
5. News with real posts on screen: needs a DB write to `posts`, which this plan avoids. Covered by unit tests and DOM injection.
6. Lighthouse and structured data: no performance, SEO or JSON-LD change in this diff.
7. `pnpm test:functions`: not run. The diff changes no Supabase function (front end only, `03-design.md`: no backend, data or migration change), and the suite writes to the local database. The TSR must list it under "Not run" with this reason (review-6a finding 3).

## 8. Case count

- Gates: 4 (G-01 to G-04). Static: 3 (S-01 to S-03).
- Browser: desktop 12 (D-01 to D-12), phone 4 (P-01 to P-04), keyboard 3 (K-01 to K-03), aria-current 2 (A-01, A-02; the old A-02 only pointed at S-03 and R-11, so it was dropped per review-6a finding 4), analytics 3 (AN-01 to AN-03), regression 14 (R-01 to R-14).
- **Total: 45 frozen cases**, plus 2 "For Saurabh" checks outside the pass/fail set.
