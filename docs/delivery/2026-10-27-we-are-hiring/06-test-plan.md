# 06 — Test plan: "We're hiring" page (web, `feature/we-are-hiring`)

Stage 6a of `/deliver`, Tester. Date: 2026-10-27. Inputs: [01](01-requirement.md) (AC-1 to AC-30), [03](03-design.md), [04](04-plan.md), [05](05-dev-notes.md).

**Build the plan was dry-run on:** `0aba784` (worktree `/Users/sjain/dev/work/aj_classes-hiring`), macOS, Node 24.15.0, Playwright Chromium 1248 from `e2e/`. Every expected value below was measured on that build, not copied from the design. The `/test-and-ship` run executes this plan and writes the TSR. It does not edit the plan.

**Site is light only.** `styles/theme.css` only lets the portal switch to dark, so there is no dark-mode case (01 decision 5).

**What this build has.** It uses the CI placeholder env (`ci.yml:116-124`): no Supabase URL, so **News is hidden** (no posts) and **the portal is off** (no "Sign in" in the footer, and `/portal/login` shows "Sign-in isn't available right now"). The expected footer row is therefore exactly `Parent guides · We're hiring · Privacy Policy`. The news-on and portal-on orders are covered by the unit test `Footer.test.tsx` 2b (TC-3). No local or hosted Supabase is started, stopped, reset or read.

**Fixtures:** none. No seed data is changed, so there is nothing to restore.

## Not covered — for Saurabh

Lead's ruling (review-6a): these five checks are **outside the frozen pass/fail set**. They need a real mail app, a real phone or the owner's judgement, so the gate does not count them, but the TSR must list them as not covered. **The TSR line for AC-10 must read exactly: "href verified; device behaviour not verified — Saurabh to check before production"**, never a plain PASS. Steps for him:

1. **TC-10b, mailto on desktop.** On a Mac with Mail (or Outlook) set as the default mail app, open `http://127.0.0.1:4173/careers` on the mirror and click **Email your application**. Expected: a new message opens, To = `hello@ajclasses.com.au`, Subject = `Tutor application` (with a space, not `%20`), body empty.
2. **TC-10c, mailto on iOS Safari.** The mirror only listens on 127.0.0.1, so a phone can't reach it. Use the Vercel preview of this branch once pushed (it sits behind Vercel SSO, so sign in first), or staging after merge. Tap **Email your application**. Expected: Mail (or the default mail app) opens a draft with the same To and Subject. Also long-press the plain address in the "How to apply" text and check it can be copied (AC-11).
3. **TC-10d, mailto on Android Chrome.** Same as 2 on an Android phone with Gmail. Expected: Gmail opens a draft with the same To and Subject.
4. **TC-15c, screen reader (optional but listed in AC-15).** VoiceOver on Mac (Cmd+F5) on `/careers`: the rotor's headings list reads "We're hiring" (level 1), then Roles, Who we're looking for, What you'll need, How to apply (level 2). The apply link reads "Email your application, link".
5. **TC-12b, copy read.** Read `/careers` once and confirm the wording is what you want (01 Q1, Q3, Q5, Q6). This is a copy sign-off, not a bug check.

Visual judgement cases (TC-4b, TC-14b, TC-26b) stay in the frozen set. The Tester does them from the `shots.mjs` screenshots. They are marked MANUAL below.

**Every shell block below starts with the same line**, because each tool call is a fresh shell and neither the env nor `$T` carries over. It sets the CI placeholder env (production), `cd`s to the worktree and sets `T=/private/tmp/aj-hiring-tsr` (the scratch folder for scripts and outputs, outside git). Never run a bare `pnpm build` without it.

## 0. Setup (run once, in this order)

Nothing may listen on 4173 before Lighthouse or the CSP suite (lhci and the CSP config start their own server there).

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
lsof -nP -iTCP:4173 -sTCP:LISTEN | wc -l        # expect 0
git rev-parse --short HEAD                      # record in the TSR
```

Scripts: save the five Playwright scripts (`sweep.mjs`, `careers.mjs`, `axe.mjs`, `walk.mjs`, `shots.mjs`) and `gates.sh` from the appendix into `$T`, and link the e2e modules there so `@playwright/test` resolves:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
mkdir -p "$T"; ln -sf /Users/sjain/dev/work/aj_classes-hiring/e2e/node_modules "$T/node_modules"
```

Order of the run: S-1 (`pnpm check`, which also builds production) → static gates → CSP suite → Lighthouse → start mirror → browser scripts → stop mirror → staging build (TC-17b/TC-21b) → rebuild production.

## 1. Suite and build cases

### S-1 — `pnpm check` (AC-24)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm check > "$T/check.log" 2>&1; echo "exit=$?"; tail -3 "$T/check.log"
grep -E "Test Files|Tests  " "$T/check.log"
```

Expected: exit 0; `Test Files  63 passed (63)` and `Tests  542 passed (542)`. (Dry-run: exact match. Baseline on develop was 62 / 527.)

### S-2 — Hosted-ref and structured data (DoD 2, AC-22)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm --filter web check:hosted-ref build/client | tail -1
pnpm --filter web check:structured-data | tail -1
```

Expected: `check-hosted-ref: 0 files (of 156 scanned)` and `check-structured-data: 19 pages, 0 problems`.

### S-3 — Feature unit tests (AC-2, 3, 8-13, 16-20 at unit level)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm --filter web exec vitest run src/routes/careers.test.tsx src/routes/sitemap.test.ts src/components/layout/footer/Footer.test.tsx 2>&1 | grep -E "Test Files|Tests "
```

Expected: `Test Files  3 passed (3)`, `Tests  20 passed (20)`.

### S-4 — Static gates on the production build (AC-1, 2, 3, 7, 8, 10, 12, 17, 19, 20, 21, 22)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
BUILD=/Users/sjain/dev/work/aj_classes-hiring/apps/web/build/client sh "$T/gates.sh"
```

Expected last line: `gates: 0 failures`, and no `FAIL` lines. The script checks all 17 pre-rendered `index.html` files plus `404.html`. **Proven to fail:** on a copy of the build with the link removed from `/privacy`, the row reordered on `/`, a broken title, mailto, canonical, an extra h1, a robots tag, JSON-LD, "$30 per hour", the sitemap entry removed and `Disallow: /` appended, it printed all 12 `FAIL` lines and `gates: 12 failures` (two planted runs, 10 + 2).

### S-5 — CSP e2e (AC-29)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm --filter aj-classes-e2e test:csp 2>&1 | tail -2
```

Expected: `21 passed`, including `/careers loads and is used with no CSP violations` at 360 px and 1280 px. Then `lsof -nP -iTCP:4173 -sTCP:LISTEN | wc -l` → 0.

### S-6 — Lighthouse (AC-15, AC-25)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
export CHROME_PATH="$(cd e2e && node -e "import('@playwright/test').then(({chromium})=>console.log(chromium.executablePath()))")"
pnpm --filter web lighthouse > "$T/lh.log" 2>&1; echo "exit=$?"; grep -E "Checking assertions|All results processed" "$T/lh.log"
pnpm --filter web lighthouse:report | tail -1
```

Expected: exit 0; `Checking assertions against 7 URL(s), 21 total run(s)` then `All results processed!` (no assertion failures listed); the JS table lists `/careers` (dry-run 179.7 KB); last line `lighthouse-report: 21 runs, 0 supabase.co requests`. Afterwards `git status --short` shows no changes outside `docs/delivery/2026-10-27-we-are-hiring/` (Lighthouse reports are gitignored).

### Browser setup (after S-6)

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm --filter web mirror      # run this block in the background; ready line: "Accepting connections at http://127.0.0.1:4173"
```

Then, in a new call once the ready line shows:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
cd "$T" && node sweep.mjs > sweep.json && node careers.mjs > careers.json && node axe.mjs > axe.json && node walk.mjs > walk.json && node shots.mjs && ls *.json *.png
```

Print the sweep table with:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
cd "$T" && node -e 'const o=require("./sweep.json");for(const [k,v] of Object.entries(o))console.log(k,v.status,"n="+v.count,"vis="+v.visible,"tgt="+v.target,"same="+v.sameStyleAsGuides,"scroll="+v.scroll,"h1="+v.h1,"robots="+v.robots,"msgs="+v.msgs.length,JSON.stringify(v.legal[0]))'
```

The sweep covers 9 pages × 2 widths (375 × 800, 1280 × 800): `/`, `/programmes/vce`, `/resources`, `/resources/victorian-selective-entry-exam`, `/posts`, `/privacy`, `/subscribed`, `/nope`, `/careers`.

## 2. Acceptance-criteria cases

### Footer link (US-1)

**TC-1 (AC-1) Link on every public page.** S-4 `G-footer-count` (exactly one `href="/careers"` in each of the 18 HTML files), plus the sweep. Expected for all 18 sweep rows: `n=1 vis=true`. Dry-run: 18 / 18.

**TC-2 (AC-2) href and same tab.** S-4 `G-footer-order` contains `<a href="/careers">We&#x27;re hiring</a>` (no `target`). Sweep: `tgt=null` on all 18 rows. Unit: Footer 2a (in S-3).

**TC-3 (AC-3) Order.** S-4 `G-footer-order`: every page contains exactly the row `<a href="/resources">Parent guides</a><a href="/careers">We&#x27;re hiring</a><a href="/privacy">Privacy Policy</a>`. Sweep `legal` column: `["Parent guides","We're hiring","Privacy Policy"]` on all 18 rows. News-on and portal-on orders: Footer 2b in S-3 (built from `APP_CONFIG`). Note: AC-3 says "Resources"; the live label is `RESOURCES.footerLink` = "Parent guides". Not a defect.

**TC-4a (AC-4) Fits, no overlap, same style, 375 and 1280.** Sweep: `scroll=0` and `same=true` on all 18 rows (`same` compares colour, font size, weight, decoration and family with "Parent guides"; dry-run value `rgb(248, 250, 252)|15px|400|underline|Inter, …`). `careers.json` → `footerOverlap: false` at both widths. Link box dry-run: 82 × 24 px at both widths.

**TC-4b (AC-4) MANUAL visual.** Open `footer-375.png` and `footer-1280.png` (from `shots.mjs`, appendix). Expected: the three links sit on one line, evenly spaced, same underline and colour; nothing clipped. Contrast is inherited from the same class as the neighbours, so it is equal by construction.

**TC-5 (AC-5) Keyboard to the footer link.** `careers.json`:
- `<width> careers` → `toFooter`: `text "We're hiring"`, `focusVisible: true`, `outline "solid 3px rgb(37, 99, 235)"`. Dry-run: 9 Tab presses after the apply button at both widths.
- `<width> home->footer` → `homeFooter.focusVisible: true` and `urlAfterEnter: "http://127.0.0.1:4173/careers"`, `title: "Careers | AJ Classes"`. (Press count from `/` was 53 at 375 and 67 at 1280. This is informational only, because home links can change.)

**TC-6 (AC-6) Portal has no link.** `careers.json` → `<width> portal`: `hiringLinks: 0`, `careersHrefs: 0`, `contentinfo: 0`, `h1 ["Sign-in isn't available right now"]`, `title "Sign in | AJ Classes Portal"`. Supporting evidence only (not a pass/fail gate; the portal-on case can't be built without Supabase config). The portal routes don't import the public footer:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -rlE "Footer|SiteLayout" apps/web/src/routes/portal | wc -l     # expect 0
```

### Careers page (US-2)

**TC-7 (AC-7) Pre-rendered, 200.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
test -f apps/web/build/client/careers/index.html && grep -o 'Tutor (casual)' apps/web/build/client/careers/index.html | wc -l   # 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/careers                                                       # 200
```

Unit 1j (prerender list) in S-3.

**TC-8 (AC-8) SiteLayout and one h1.** S-4 `G-h1`. Sweep `/careers`: `h1=1`. `careers.json` headings start with `H1:We're hiring`. The 1280 screenshot shows the normal header and footer.

**TC-9 (AC-9) Blocks and order.** `careers.json` at both widths: `headings` = `["H1:We're hiring","H2:Roles","H2:Who we're looking for","H2:What you'll need","H2:How to apply"]`, `listItems` = `[1,4,3]`. WWCC/VIT:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -o 'Working with Children Check (or VIT registration)' apps/web/build/client/careers/index.html | wc -l   # 1
```

No literals in JSX: covered by lint in S-1.

**TC-10a (AC-10) Exact mailto.** S-4 `G-mailto`; `careers.json` → `mailtoInMain: ["mailto:hello@ajclasses.com.au?subject=Tutor%20application"]` (one mailto in main), `applyTarget: null`. Unit 1c. Address built from `BUSINESS.email`:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -c 'hello@ajclasses' apps/web/src/constants/careers.constants.ts apps/web/src/routes/careers.tsx   # both :0
```

**TC-10b/c/d (AC-10): not covered, for Saurabh** (see "Not covered — for Saurabh" 1-3). AC-10 in the TSR: "href verified; device behaviour not verified — Saurabh to check before production".

**TC-11 (AC-11) Link text and plain address.** `careers.json` → `toApply.text "Email your application"`, `emailText: true`. Unit 1c, 1d.

**TC-12a (AC-12) No pay, hours, dates, people, address, ABN.** S-4 `G-content-guard`; unit 1g. Business facts used:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -oE 'BUSINESS\.[a-zA-Z]+' apps/web/src/constants/careers.constants.ts | sort -u    # BUSINESS.email, BUSINESS.suburbsText
```

**TC-12b: not covered, for Saurabh** (copy read, item 5).

**TC-13 (AC-13) What to include and how details are used.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -oE 'attach your CV|only use your details to consider your application' apps/web/build/client/careers/index.html | sort | uniq -c   # 1 each
```

**TC-14a (AC-14) Layout at 375 and 1280.** Sweep `/careers`: `scroll=0` both widths. `careers.json`: `listStyles ["disc","disc","disc"]`; `applyBox.height` ≥ 44 (dry-run 56.8 at both widths, width 241); heading sizes and section padding equal privacy's (`375`: h1 34.6px, h2 28.025px, padTop 56px; `1280`: 52px, 38px, 80px — compare `<width> careers` with `<width> privacy`).

**TC-14b (AC-14) MANUAL visual.** Open `careers-375.png` and `careers-1280.png`. Expected: readable text, lists wrap at paragraph width, button clear of the paragraph, spacing like `/privacy`. Known non-bug: at 375 the fixed WhatsApp button overlaps a list item in a full-page screenshot; it does that on every page (05 note 3).

**TC-15a (AC-15) Keyboard and focus on every stop.** `walk.json`: `noRing` contains only the final `BODY|…` entry (the wrap-around past the last element, not a page element). Dry-run: 15 real stops at 375, 29 at 1280, all with `:focus-visible` and a 3 px outline. The skip link is stop 1 and the apply button is reached before "Back to home".

**TC-15b (AC-15) Skip link and axe.** `axe.json`: for `/careers` at both widths, `axe` has no `serious:` or `critical:` entry (dry-run: only `moderate:region:1`, identical on `/privacy`, so it is pre-existing) and `tabAfterSkip` = `{ text: "Email your application", inMain: true }`. Headings: TC-9 (h1 → h2, nothing skipped). Lighthouse a11y: S-6 passing.

**TC-15c: not covered, for Saurabh** (screen reader, item 4).

**TC-16 (AC-16) Back to home.** `careers.json` → `backHome: ["/"]` (exactly one). Unit 1f.

### SEO

**TC-17a (AC-17) Title, production.** S-4 `G-title` (`<title>Careers | AJ Classes</title>`).

**TC-18 (AC-18) Description.** `walk.json` → `descLen: 136` (< 160). Exact text:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
grep -oF 'content="AJ Classes is looking for tutors in Williams Landing, Truganina and Craigieburn, and online. See who we&#x27;re looking for and how to apply."' apps/web/build/client/careers/index.html | wc -l   # 1
grep -o "Melbourne" apps/web/build/client/careers/index.html | wc -l                                                                           # 0
```

**TC-19 (AC-19) Canonical.** S-4 `G-canonical`: `<link rel="canonical" href="https://ajclasses.com.au/careers"/>`. Unit 1h.

**TC-20 (AC-20) Sitemap.** S-4 `G-sitemap`; mirror `curl -s http://127.0.0.1:4173/sitemap.xml | grep -o '<loc>[^<]*</loc>' | wc -l` → 14, last `<loc>` is `https://ajclasses.com.au/careers`. Unit 3 (with and without Supabase).

**TC-21a (AC-21) Production indexes.** S-4 `G-robots-prod` (0 robots tags) and `G-robots-txt-prod` (no exact `Disallow: /` line; production `robots.txt` is `User-agent: *` / `Allow: /` / `Disallow: /portal` / `Sitemap: https://ajclasses.com.au/sitemap.xml`).

**TC-17b + TC-21b (AC-17, AC-21) Staging.** Stop the mirror first. Then:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
VITE_APP_ENV=staging pnpm build > "$T/build-staging.log" 2>&1; echo "exit=$?"
C=apps/web/build/client/careers/index.html
grep -o '<meta name="robots"[^>]*>' $C           # <meta name="robots" content="noindex"/>
grep -o '<title>[^<]*</title>' $C                # <title>[STAGING] Careers | AJ Classes</title>
grep -cx 'Disallow: /' apps/web/build/client/robots.txt   # 1
pnpm build > /dev/null 2>&1 && grep -o '<title>[^<]*</title>' $C   # production again: <title>Careers | AJ Classes</title>
```

Run the mirror stop and this block in that order; the last line rebuilds production in the same shell. Use `grep -cx`, not `grep -c`: production's `Disallow: /portal` also matches a plain grep.

**TC-22 (AC-22) No JobPosting; other JSON-LD unchanged.** S-4 `G-no-jsonld`; S-2 `19 pages, 0 problems`. JSON-LD counts per page (dry-run, unchanged from the pages' own designs):

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
cd apps/web/build/client && for f in $(find . -name index.html | sort); do printf '%s %s\n' $f $(grep -o 'ld+json' $f | wc -l | tr -d ' '); done; cd -
```

Expected: 1 on `./index.html`, each of the 9 `./programmes/*` and `./resources/victorian-selective-entry-exam`; 0 on `404`, `careers`, `posts`, `privacy`, `resources`, `subscribed`. `grep -rl JobPosting apps/web/build/client | wc -l` → 0. Source: `git diff develop --stat -- apps/web/src/lib | wc -l` → 0.

### Quality bar

**TC-23 (AC-23) No console errors or warnings.** `sweep.mjs` waits 500 ms after network idle before reading the console. Sweep `msgs=0` for `/careers` and `/` at both widths (and every other page except `/nope`). `/nope` shows exactly one `error: Failed to load resource: the server responded with a status of 404 (Not Found)`; that is the document's own 404, expected and pre-existing.

**TC-24 (AC-24)** = S-1.

**TC-25 (AC-25) No new dependency, env var or third-party request.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
git diff develop --name-only | grep -E '(^|/)package\.json$|pnpm-lock\.yaml|(^|/)\.env' | wc -l    # 0
```

Requests: compare `sweep.json` `reqs` for `1280 /careers` and `1280 /privacy`:

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
cd "$T" && node -e 'const o=require("./sweep.json");const a=o["1280 /careers"].reqs,b=o["1280 /privacy"].reqs;console.log(a.filter(x=>!b.includes(x)), a.filter(x=>!x.startsWith("http://127.0.0.1:4173")).length)'
```

Expected: `[ 'http://127.0.0.1:4173/careers' ] 0` (only the document differs; no off-origin request). S-6: 0 supabase.co.

### Must NOT change

**TC-26a (AC-26) Header, CTA, WhatsApp.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
pnpm --filter web exec vitest run src/components/layout/header/Header.test.tsx src/components/layout/WhatsAppButton.test.tsx src/hosting-csp.test.ts 2>&1 | grep -E "Test Files|Tests "   # 3 passed (3), 16 passed (16)
git diff develop --stat -- apps/web/src/components/layout/header apps/web/src/components/layout/WhatsAppButton.tsx | wc -l   # 0
```

`careers.json`: `1280 home.navLinks` = `["Programmes","Our Approach","About","FAQ","Contact","Register Interest"]`; `375 menu.linksAfterOpen` has 15 entries (Programmes, 9 programme links, Our Approach, About, FAQ, Contact, Register Interest) and `hiringInMenu: 0`; `whatsapp: 2` at both widths.

**TC-26b MANUAL visual.** At 375 on `/` and `/careers`: the mobile CTA bar and the WhatsApp button look as on `develop` (compare with a `develop` screenshot if in doubt).

**TC-27 (AC-27) Enquiry path untouched.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
git diff develop --stat -- apps/web/src/services apps/web/src/sections/contact | wc -l   # 0
```

The home form still renders: `careers.json` → `home.forms[0]` = `{ id: "ask-a-question", fields: ["name","email","phone","message","botcheck"], submit: "Register interest" }`. No submission is made (Web3Forms is mocked only inside the CSP suite).

**TC-28 (AC-28)** `git diff develop --stat -- supabase | wc -l` → 0.

**TC-29 (AC-29)** `git diff develop --stat -- apps/web/vercel.json apps/web/serve.railway.json apps/web/src/routes/robots.ts | wc -l` → 0; S-5; `hosting-csp.test.ts` in TC-26a.

**TC-30 (AC-30)** `git diff develop --stat -- apps/web/src/constants/content.constants.ts | wc -l` → 0; RG-3.

**Diff hygiene (rules, DoD 5).**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
git diff develop -U0 -- apps/web/src e2e | grep -E '^\+' | grep -E 'console\.|style=\{\{|TODO|fetch\(|axios' | wc -l   # 0
```

**Proven to fail:** the stat gate returned 2 on commit `1707ee3` (which touches `services/`), the hygiene grep returned 2 on planted `+console.log` and `+style={{…}}` lines, and the `.env` grep returned 1 on `apps/web/.env.local`.

## 3. Smoke

**SM-1 Home.** Sweep `375 /` and `1280 /`: `200`, `h1=1`, `scroll=0`, `msgs=0`, `robots=0`.

**SM-2 Nav.** TC-26a nav lists (desktop 6 links, phone menu 15 after "Open menu").

**SM-3 Footer on several public pages.** TC-1/TC-3 rows for `/programmes/vce`, `/resources`, the guide, `/posts`, `/privacy`, `/subscribed`, `/nope`, `/careers`.

**SM-4 Portal sign-in has no hiring link.** TC-6.

**SM-5 Edge URLs.**

```
cd /Users/sjain/dev/work/aj_classes-hiring && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hiring-tsr
for p in /careers/ '/careers?x=1' /CAREERS; do printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://127.0.0.1:4173$p")"; done
```

Expected: `/careers/ 301 http://127.0.0.1:4173/careers`, `/careers?x=1 200`, `/CAREERS 200`. The last one is the Mac's case-insensitive disk (`/PRIVACY` also returns 200 on the mirror), not app behaviour; the canonical stays `/careers`.

## 4. Regression

**RG-1 Header nav** = TC-26a.

**RG-2 Enquiry form renders** = TC-27 form check.

**RG-3 Privacy page.** Sweep `/privacy`: `200`, `h1=1`, `msgs=0`, `robots=0`; `axe.json` `/privacy` has no serious/critical; footer row as TC-3.

**RG-4 Sitemap.** TC-20: 14 `<loc>` entries, `/careers` last, `/posts` absent on this no-Supabase build.

**RG-5 404.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/nope` → `404`. Sweep `/nope`: `h1=1`, `robots=1` (exactly one robots tag: BUG-1 regression check), footer link present. Also `/subscribed` `robots=1`.

**RG-6 One robots tag per page.** Sweep `robots` column is 0 or 1 on every row, never 2.

**Teardown.** Stop the mirror (`pkill -f serve-mirror.ts`), confirm `lsof -nP -iTCP:4173 -sTCP:LISTEN | wc -l` → 0, confirm `build/` is production (TC-17b last line) and `git status --short` shows no changes outside `docs/delivery/2026-10-27-we-are-hiring/`.

## Defects found while planning

None against AC-1 to AC-30. Dry-run results on `0aba784`: S-1 63/542 pass, S-2 0 files / 0 problems, S-3 20/20, S-4 0 failures, S-5 21/21, S-6 all assertions pass with 0 supabase.co, all browser checks gave the values above.

Observations, not defects of this feature (for the lead to decide whether to ticket):

1. **The focus ring is low-contrast on the navy footer (pre-existing, every footer link).** `--color-focus` `#2563eb` on `--color-bg-inverse` `#172554` is 2.84:1, under the 3:1 non-text contrast guideline (WCAG 1.4.11). The ring is visible (3 px, offset 2 px), so AC-5 passes as written. It affects every footer link and the Subscribe button, not just "We're hiring". Severity: low. Repro: Tab to any footer link on any page at 1280 px; the measured outline is `solid 3px rgb(37, 99, 235)` on a `#172554` background.
2. **The footer legal links are 24 px tall** (82 × 24 at both widths). That meets WCAG 2.5.8's 24 px minimum but not the 44 px used for the apply button. It is the same as "Parent guides" and "Privacy Policy", and AC-4 asks for the same style, so this isn't a defect.

## Appendix: scripts (dry-run exactly as below)

The run creates the PNGs and JSON in `$T`. Keep them out of git.

### `gates.sh`

```sh
# Usage: BUILD=<dir of build/client> sh gates.sh   -> prints FAIL lines; last line "gates: N failures"
fails=0
ROW='<a href="/resources">Parent guides</a><a href="/careers">We&#x27;re hiring</a><a href="/privacy">Privacy Policy</a>'
for f in $(find "$BUILD" -name index.html) "$BUILD/404.html"; do
  n=$(grep -o 'href="/careers"' "$f" | wc -l | tr -d ' ')
  [ "$n" = 1 ] || { echo "FAIL G-footer-count $f: $n"; fails=$((fails+1)); }
  grep -qF "$ROW" "$f" || { echo "FAIL G-footer-order $f"; fails=$((fails+1)); }
done
C="$BUILD/careers/index.html"
[ "$(grep -o '<h1' "$C" | wc -l | tr -d ' ')" = 1 ] || { echo "FAIL G-h1"; fails=$((fails+1)); }
grep -qF '<title>Careers | AJ Classes</title>' "$C" || { echo "FAIL G-title"; fails=$((fails+1)); }
grep -qF '<link rel="canonical" href="https://ajclasses.com.au/careers"/>' "$C" || { echo "FAIL G-canonical"; fails=$((fails+1)); }
grep -qF 'href="mailto:hello@ajclasses.com.au?subject=Tutor%20application"' "$C" || { echo "FAIL G-mailto"; fails=$((fails+1)); }
[ "$(grep -o 'name="robots"' "$C" | wc -l | tr -d ' ')" = 0 ] || { echo "FAIL G-robots-prod"; fails=$((fails+1)); }
grep -qE 'JobPosting|ld\+json' "$C" && { echo "FAIL G-no-jsonld"; fails=$((fails+1)); }
grep -qE '\$[0-9]|per hour|hourly|start date|ABN|Melbourne&#x27;s west' "$C" && { echo "FAIL G-content-guard"; fails=$((fails+1)); }
[ "$(grep -o "<loc>https://ajclasses.com.au/careers</loc>" "$BUILD/sitemap.xml" | wc -l | tr -d " ")" = 1 ] || { echo "FAIL G-sitemap"; fails=$((fails+1)); }
grep -qx 'Disallow: /' "$BUILD/robots.txt" && { echo "FAIL G-robots-txt-prod"; fails=$((fails+1)); }
echo "gates: $fails failures"
```

### `sweep.mjs`

```js
// Dry-run sweep for the we-are-hiring test plan. Usage (from e2e/): node <this file>
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const PAGES = [
  '/', '/programmes/vce', '/resources', '/resources/victorian-selective-entry-exam',
  '/posts', '/privacy', '/subscribed', '/nope', '/careers',
];
const WIDTHS = [375, 1280];
const out = {};

const browser = await chromium.launch();
for (const width of WIDTHS) {
  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await ctx.newPage();
    const msgs = [];
    const reqs = new Set();
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push(`pageerror: ${e.message}`));
    page.on('request', (r) => reqs.add(new URL(r.url()).origin + new URL(r.url()).pathname.replace(/\/assets\/.*/, '/assets/*')));
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // late console messages (review-6a N3)
    const link = page.locator('footer').getByRole('link', { name: "We're hiring", exact: true });
    const guides = page.locator('footer').getByRole('link', { name: 'Parent guides', exact: true });
    const res = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: document.querySelectorAll('h1').length,
      robots: document.querySelectorAll('meta[name="robots"]').length,
      legal: [...document.querySelectorAll('footer a[href="/careers"]')].map((a) => [...a.parentElement.querySelectorAll('a')].map((x) => x.textContent)),
    }));
    const count = await link.count();
    let box = null, style = null, gstyle = null, visible = false, target = null;
    if (count) {
      await link.scrollIntoViewIfNeeded();
      visible = await link.isVisible();
      box = await link.boundingBox();
      target = await link.getAttribute('target');
      const pick = (el) => { const s = getComputedStyle(el); return [s.color, s.fontSize, s.fontWeight, s.textDecorationLine, s.fontFamily].join('|'); };
      style = await link.evaluate(pick);
      gstyle = await guides.evaluate(pick);
    }
    out[`${width} ${path}`] = { status: resp.status(), count, visible, target, sameStyleAsGuides: style === gstyle, style, box, ...res, msgs, reqs: [...reqs].sort() };
    await ctx.close();
  }
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
```

### `careers.mjs`

```js
// Careers page, keyboard, portal and regression dry-run. Usage: node careers.mjs
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const out = {};

async function tabUntil(page, predicate, max = 200) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      const s = getComputedStyle(a);
      return { text: a.textContent.trim(), href: a.getAttribute('href'), tag: a.tagName, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, focusVisible: a.matches(':focus-visible') };
    });
    if (predicate(info)) return { presses: i, ...info };
  }
  return null;
}

for (const width of [375, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/careers`, { waitUntil: 'networkidle' });
  const main = page.getByRole('main');
  const apply = main.getByRole('link', { name: 'Email your application', exact: true });
  const r = await page.evaluate(() => {
    const m = document.querySelector('main');
    const lists = [...m.querySelectorAll('ul')];
    const sibs = [...document.querySelectorAll('footer a[href="/careers"]')][0].parentElement.querySelectorAll('a');
    const rects = [...sibs].map((a) => a.getBoundingClientRect());
    let overlap = false;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap = true;
    }
    const pm = document.querySelector('main h1');
    return {
      headings: [...m.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => `${h.tagName}:${h.textContent}`),
      listStyles: lists.map((l) => getComputedStyle(l).listStyleType),
      listItems: lists.map((l) => l.children.length),
      mailtoInMain: [...m.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href')),
      backHome: [...m.querySelectorAll('a')].filter((a) => a.textContent === 'Back to home').map((a) => a.getAttribute('href')),
      emailText: m.textContent.includes('hello@ajclasses.com.au'),
      footerOverlap: overlap,
      h1Font: getComputedStyle(pm).fontSize,
      h2Font: getComputedStyle(m.querySelector('h2')).fontSize,
      mainPadTop: getComputedStyle(m.querySelector('section') || m).paddingTop,
      skipHref: document.querySelector('a[href="#main-content"]')?.textContent,
      mainId: m.id,
    };
  });
  const box = await apply.boundingBox();
  const target = await apply.getAttribute('target');
  // Keyboard: from top of page, Tab to the skip link, then to the apply button, then the footer link.
  const skip = await tabUntil(page, (i) => i.href === '#main-content', 3);
  await page.keyboard.press('Enter');
  const afterSkip = await page.evaluate(() => ({ active: document.activeElement.id || document.activeElement.tagName, hash: location.hash }));
  await page.goto(`${BASE}/careers`, { waitUntil: 'networkidle' });
  const toApply = await tabUntil(page, (i) => i.text === 'Email your application');
  const toFooter = await tabUntil(page, (i) => i.href === '/careers');
  out[`${width} careers`] = { ...r, applyBox: box, applyTarget: target, skip, afterSkip, toApply, toFooter };

  // Privacy for spacing comparison
  await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });
  out[`${width} privacy`] = await page.evaluate(() => {
    const m = document.querySelector('main');
    return { h1Font: getComputedStyle(m.querySelector('h1')).fontSize, h2Font: getComputedStyle(m.querySelector('h2')).fontSize, mainPadTop: getComputedStyle(m.querySelector('section') || m).paddingTop };
  });

  // Footer link from home: Tab to it, Enter opens /careers
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const homeFooter = await tabUntil(page, (i) => i.href === '/careers');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/careers'); await page.waitForLoadState('networkidle');
  out[`${width} home->footer`] = { homeFooter, urlAfterEnter: page.url(), title: await page.title() };

  // Portal sign-in page: no hiring link, no public footer
  await page.goto(`${BASE}/portal/login`, { waitUntil: 'networkidle' });
  out[`${width} portal`] = {
    hiringLinks: await page.getByRole('link', { name: "We're hiring" }).count(),
    careersHrefs: await page.locator('a[href="/careers"]').count(),
    contentinfo: await page.getByRole('contentinfo').count(),
    h1: await page.locator('h1').allTextContents(),
    title: await page.title(),
  };

  // Regression: header nav and enquiry form on home
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const nav = page.locator('#main-navigation');
  out[`${width} home`] = {
    navLinks: await nav.getByRole('link').allTextContents(),
    navVisible: await nav.isVisible(),
    forms: await page.locator('form').evaluateAll((fs) => fs.map((f) => ({ id: f.id, fields: [...f.querySelectorAll('input,select,textarea')].map((e) => e.name || e.id).filter(Boolean), submit: f.querySelector('button[type=submit],button:not([type])')?.textContent }))),
    whatsapp: await page.locator('a[href^="https://wa.me/"]').count(),
  };
  if (width === 375) {
    const toggle = page.getByRole('button', { name: /menu/i });
    out['375 menu'] = { toggles: await toggle.count() };
    if (await toggle.count()) {
      await toggle.first().click();
      out['375 menu'].linksAfterOpen = await nav.getByRole('link').allTextContents();
      out['375 menu'].hiringInMenu = await nav.getByRole('link', { name: "We're hiring" }).count();
    }
  }
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
```

### `axe.mjs`

```js
// axe + skip-link dry-run. Usage: node axe.mjs
import { chromium } from '@playwright/test';
const AXE = '/Users/sjain/dev/work/aj_classes-hiring/node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core/axe.min.js';
const browser = await chromium.launch();
const out = {};
for (const width of [375, 1280]) for (const path of ['/careers', '/privacy']) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await window.axe.run()).violations.map((v) => `${v.impact}:${v.id}:${v.nodes.length}`));
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => ({ text: document.activeElement.textContent.trim(), inMain: !!document.activeElement.closest('main') }));
  out[`${width} ${path}`] = { axe: r, tabAfterSkip: next };
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
```

### `walk.mjs`

```js
// Tab through every focusable element on /careers; report any without :focus-visible or outline.
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const out = {};
for (const w of [375, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto('http://127.0.0.1:4173/careers', { waitUntil: 'networkidle' });
  const seen = []; let first = null;
  for (let i = 0; i < 60; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a);
      return { key: a.tagName + '|' + (a.getAttribute('href') || a.getAttribute('name') || a.textContent.trim().slice(0, 30)), fv: a.matches(':focus-visible'), ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 }; });
    if (f.key === first) break; if (!first) first = f.key; seen.push(f);
  }
  const desc = await p.locator('meta[name="description"]').getAttribute('content');
  out[w] = { stops: seen.length, noRing: seen.filter((s) => !s.fv || !s.ring).map((s) => s.key), order: seen.map((s) => s.key), descLen: desc.length };
  await p.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close();
```

### `shots.mjs`

```js
import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const w of [375, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto('http://127.0.0.1:4173/careers', { waitUntil: 'networkidle' });
  await p.screenshot({ path: `careers-${w}.png`, fullPage: true });
  await p.locator('footer').screenshot({ path: `footer-${w}.png` });
  await p.close();
}
await b.close();
```
