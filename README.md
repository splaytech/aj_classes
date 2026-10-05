# AJ Classes

Website (and later the learning platform) for AJ Classes: selective entry exam and interview coaching for Years 5–10, in Truganina and online.

- Requirements: [docs/requirements](docs/requirements/README.md) (start with the [Release 1 PRP](docs/requirements/release-1/PRP.md))
- Architecture: [docs/architecture/arch.md](docs/architecture/arch.md)
- Brand assets: [brand/](brand/)

## Getting started

Needs Node 24 (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Local development server with hot reload                |
| `pnpm build`     | Production build: pre-renders every page to static HTML |
| `pnpm preview`   | Serves the production build locally                     |
| `pnpm lint`      | ESLint, including the "no text in components" rule      |
| `pnpm typecheck` | TypeScript check                                        |
| `pnpm test`      | Unit tests (Vitest)                                     |
| `pnpm format`    | Formats every file with Prettier                        |
| `pnpm check`     | Everything above in one go. Run before pushing          |

Copy `apps/web/.env.example` to `apps/web/.env.local` and add the Web3Forms access key (enquiry form) and the Kit form ID (newsletter sign-up). Without the Kit form ID the newsletter form stays hidden.

## House rules

1. **Readable first.** Small, plain functions and components. Prefer obvious code over clever or "fast" code.
2. **No magic strings.** Every word, URL, email, ID and setting lives in `apps/web/src/constants/`. Components only reference constants. ESLint enforces this.
3. **No hard-coded styles.** Colours, fonts and spacing are CSS variables in `apps/web/src/styles/theme.css`.
4. **Env vars** are read only in `src/constants/app.constants.ts`.
5. **Only `src/services/` talks to a backend.** Components call plain functions such as `submitEnquiry()` from `@/services` and never import Supabase (or Web3Forms) themselves. ESLint enforces this.

## Where things live

```
aj_classes/
├── apps/
│   └── web/                         React + Vite + React Router (static, pre-rendered)
│       ├── public/                  Logo, favicon, hero illustration
│       ├── src/
│       │   ├── constants/           ALL text and settings (edit copy here)
│       │   │   ├── app.constants.ts        site URL, feature flags, form service, limits
│       │   │   ├── business.constants.ts   name, email, phone, suburb, social links
│       │   │   ├── content.constants.ts    every word on the page, by section
│       │   │   ├── error.constants.ts      validation and error messages, 404 copy
│       │   │   ├── seo.constants.ts        page titles, descriptions, preview image
│       │   │   ├── routes.constants.ts     page paths and section anchors
│       │   │   └── analytics.constants.ts  analytics event names
│       │   ├── styles/
│       │   │   ├── theme.css        brand colours, fonts, spacing (the only place)
│       │   │   └── global.css       base element styles
│       │   ├── components/
│       │   │   ├── ui/              small reusable pieces: Button, Section, Container, Logo
│       │   │   └── layout/          SiteLayout, Header, Footer (+ SubscribeForm), SkipLink
│       │   ├── sections/            one folder per home-page section
│       │   │   ├── hero/            Hero.tsx + Hero.module.css
│       │   │   ├── why-us/
│       │   │   ├── approach/
│       │   │   ├── about/
│       │   │   ├── faq/
│       │   │   └── contact/         ContactSection, ContactForm, FormField, build-submission
│       │   ├── services/            the ONLY code that talks to a backend (Web3Forms now, Supabase in R2)
│       │   │   ├── enquiry.service.ts       submitEnquiry()
│       │   │   ├── subscription.service.ts  subscribe()
│       │   │   ├── web3forms.client.ts      the one file that calls Web3Forms (enquiries)
│       │   │   ├── kit.client.ts            the one file that calls Kit (newsletter)
│       │   │   └── index.ts                 what components are allowed to import
│       │   ├── lib/                 plain helpers: validation, seo, analytics, social
│       │   ├── routes/              one file per URL: home, privacy, not-found, sitemap, robots
│       │   ├── routes.ts            maps URLs to the files in routes/
│       │   └── root.tsx             the HTML document shared by every page
│       ├── react-router.config.ts   static build + which pages to pre-render
│       ├── vercel.json              hosting config and security headers
│       └── eslint.config.js
├── brand/                           logo concepts and final logo
└── docs/                            requirements (PRPs) and architecture
```

### Naming

- React components: `PascalCase.tsx`, with a matching `PascalCase.module.css` beside them.
- Everything else: `kebab-case.ts` (e.g. `build-submission.ts`).
- Folders: `kebab-case`. Tests sit next to the file they test: `validation.test.ts`.

### Common changes

| I want to…                     | Edit                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| Change any wording             | `src/constants/content.constants.ts`                             |
| Add the phone or social links  | `src/constants/business.constants.ts`                            |
| Change a colour or font        | `src/styles/theme.css`                                           |
| Hide the announcement pill     | `APP_CONFIG.features.announcement` in `app.constants.ts`         |
| Change a page title for Google | `src/constants/seo.constants.ts`                                 |
| Change where a form sends data | the matching file in `src/services/` (components stay untouched) |
