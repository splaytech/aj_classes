CHANGES_REQUESTED

# Review 1: requirement (round 1)

**Verified against the code:**
- The footer legal row order is News (posts only), Resources, Privacy, Sign in (portal only). `.legal` wraps.
- The header cap of 6 items is real (`Header.test.tsx:53-57`).
- `SiteLayout` is on every public route, and no portal route renders `Footer`.
- The site is light only (`styles/theme.css:6-14`).
- `buildPageMeta` provides the prefix, the canonical and noindex outside production. og:description is always `SOCIAL_PREVIEW.shortDescription`.
- The sitemap's `ALWAYS_LISTED` works for this page.
- There's no personal name, street address or ABN, and no new vendor or data store.

## Blocking

1. **The SEO description says "tutors in Melbourne's west".** Craigieburn is in the north, and the site never says "Melbourne's west". Build it from `BUSINESS.suburbsText` instead (e.g. "AJ Classes is looking for tutors in Williams Landing, Truganina, Craigieburn and online. …"), or say "in Melbourne and online".

## Non-blocking

2. **AC-7:** name `ROUTES.careers` in the `prerender` list (`apps/web/react-router.config.ts`), plus `routes.constants.ts` and a `route()` before `route('*')` in `src/routes.ts`.
3. **AC-6:** drop the hedge. Portal pages don't show the link.
4. **AC-14:** the privacy page has no lists. Reword to "spacing and headings match the privacy page; bullet lists use the site's default list style".
5. **WWCC:** add "(or VIT registration)", because registered teachers are exempt. Add this to Q3.
6. **A2/Q1:** consider adding exam preparation (selective entry, NAPLAN, ICAS) to the role scope.
7. **AC-24:** name the exact check command.
8. **AC-10:** give the exact href `mailto:hello@ajclasses.com.au?subject=Tutor%20application`.

---

## Round 2

APPROVED

All eight round 1 findings are fixed:
- The description is built from `BUSINESS.suburbsText` (~135 characters), and AC-18 rules out region wording.
- AC-7 names all three files.
- AC-6 and AC-14 are reworded.
- WWCC now says "or VIT registration", and it agrees across AC-9, the copy, the note and Q3.
- The role scope matches `programmes.constants.ts`.
- AC-24 says `pnpm check`, and AC-10 gives the exact href.

There are no new findings: no personal data and no new vendor or data store.
