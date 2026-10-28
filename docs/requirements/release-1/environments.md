# Release 1 — Telling Production, Staging and Dev Apart

> **Status:** Built (21 Oct 2026). Owner request: make it obvious which copy of the site is open,
> from the Chrome tab and the page itself. Production must look and behave exactly as before.
> Part of [Release 1](PRP.md).

## 1. The setting

`VITE_APP_ENV` says which copy of the site a build is: `production`, `staging` or `development`.

| Where | Value | How |
|---|---|---|
| Vercel → Production (`main`, ajclasses.com.au) | `production` | Vercel → Settings → Environment Variables, ticked for Production only |
| Vercel → Preview (`develop` and any other branch) | `staging` | Same variable, ticked for Preview only |
| Local dev server (`pnpm dev`) | `development` | Automatic, nothing to set |
| Local or CI build (`pnpm build`) | must be set | e.g. in `.env.local` |

A build with the setting missing or misspelt **fails** instead of guessing (§4 G1).

## 2. What changes per environment

| | Production | Staging | Dev |
|---|---|---|---|
| Tab title | unchanged | `[STAGING] …` | `[DEV] …` |
| Tab icon | gold logo | amber tile with navy "S" | red tile with white "D" |
| Ribbon | none | 5px amber strip across the top | 5px red strip |
| Corner label | none | "STAGING · develop · a847dd0" under the header, top left (portal pages: bottom right, so it never covers the signed-in name) | "DEV" (plus branch and commit when known) |
| Phone browser bar colour | brand blue | amber | red |
| Search engines | allowed | `noindex` on every page, `robots.txt` disallows all | same as staging |
| Vercel Analytics | on | off | off |

The ribbon and label are decoration only: hidden from screen readers and they never block a
click. Branch and commit come from Vercel's build (`VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_COMMIT_SHA`).

Not code, but recommended:
- **Separate enquiry inbox for staging:** create a second Web3Forms access key that emails the
  developer, and set it as `VITE_FORM_ACCESS_KEY` for Preview only.
- **Separate Chrome profile** with its own colour for staging work.

## 3. Stories

- **E1** As the owner, I can tell from a Chrome tab alone (title and icon) whether it's production, staging or dev.
- **E2** On the page, a coloured strip and label show staging or dev, and which branch and commit it is.
- **E3** Production looks exactly as before: no strip, label, prefix or changed icon.
- **E4** Staging never appears in Google and never counts in the site's visitor numbers.

## 4. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | REQ | A forgotten setting could mark production as staging, or make staging look like production. | Builds fail at the start, with a message naming `VITE_APP_ENV`, without a valid value (checked in `vite.config.ts`); only the local dev server has a default. |
| G2 | DES | Blue would blend with the brand colour. | Amber for staging (owner's choice), red for dev. |
| G3 | DES | The gold tab icon makes an amber dot invisible. | Staging and dev get their own letter tiles. |
| G4 | A11Y | A fixed strip or label could cover links or confuse screen readers. | `aria-hidden`, `pointer-events: none`, 5px strip; the label is small and sits below the header (bottom right on portal pages, 2026-10-29). |
| G5 | A11Y | Label text contrast. | Navy on amber and white on red, both above 4.5:1. |
| G6 | SEO | Staging pages copying production into Google. | `noindex` meta and a disallow-all `robots.txt` outside production; Vercel's login protection also blocks crawlers. Canonical links already point to the production domain. |
| G7 | DES | No hard-coded colours in CSS (F1.2). | Colours are theme variables; the phone bar colour and icon files hold their own values, like the existing brand blue. |
| G8 | OPS | Every non-`main` branch on Vercel is "Preview", so all show as staging. | Accepted; the label shows the branch name. |
| G10 | DES | "Production unchanged" | Production renders no strip, label, prefix or noindex and keeps its icon and robots.txt (checked in a production build). The marker words are still in the shared code bundle, but never shown. |
| G9 | OPS | Another host (e.g. the old Railway config) would now fail to build. | It must set `VITE_APP_ENV` too; noted in `.env.example`. |

## 5. Todo

- [x] T1 Setting read and checked in `app.constants.ts`; build fails on a missing value
- [x] T2 Title prefix, tab icon and phone bar colour per environment
- [x] T3 Ribbon and corner label component, theme colours
- [x] T4 `noindex`, `robots.txt` and analytics off outside production
- [x] T5 Branch and commit from Vercel in the label
- [x] T6 Tests; check each environment in the browser; production build unchanged
