# Release 1 — UI Polish: Results, Approach, Programmes Menu, Credential Badge

> **Status:** Built (22 Oct 2026). From client feedback on scannability and consistency.
> Part of [Release 1](PRP.md). Builds on [design-refresh.md](design-refresh.md) and
> [programme-pages.md](programme-pages.md).

## 1. Icons

One outline icon set for the whole site: **Lucide** (`lucide-react`, ISC licence, 24px grid,
2px stroke). Only the icons used are bundled. Icons are decoration (`aria-hidden`); the text
beside them always says the same thing. Which icon goes where is set in one file,
`src/components/icons/site-icons.ts`, keyed by the same ids as the content.

## 2. Design tokens (added to `theme.css`)

| Token | Value | Used for |
|---|---|---|
| `--color-primary-soft` | primary at 8% on white | Menu row hover, icon circles |
| `--color-primary-softer` | primary at 4% on white | Lightest step tint |
| `--color-success-soft` | success green at 10% on white | Credential badge background |
| `--icon-size-sm` / `--icon-size-md` / `--icon-size-lg` | 1rem / 1.25rem / 1.5rem | Badge, menu, cards |

Step tints are mixed in CSS from `--color-primary` at 3%, 6%, 9% and 12%, so they follow the theme.

## 3. Changes

| # | Area | Before | After |
|---|---|---|---|
| 1 | **2026 results** | Big number, label, then a dense line "Melbourne High School (4) · Suzanne Cory…" | Each card: icon in a soft circle, **big figure**, short label, then a breakdown list with the school on the left and its **bold count** on the right. The NAPLAN/ICAS note becomes a small callout with a trend icon. |
| 2 | **Our Approach** | Four identical white cards with a number | Each card has its own icon (Assess: clipboard check, Plan: target, Practise: timer, Review: chat), a "Step 1 of 4" label, a background tint that deepens step by step, and a top progress bar filling ¼, ½, ¾ and full. |
| 3 | **Programmes menu** | Plain text links, mixed case | Each row has three slots: **[icon] [Title Case name] [chevron, or a "New" tag]**. The whole row is the link. Hover/focus: soft blue pill. Current page: stronger pill, blue text, `aria-current="page"`. Same rows in the phone menu. |
| 4 | **"Working With Children Check held"** | Green bold text on white, looked out of place | A credential pill: soft green background, dark muted text, a small green verified-tick icon. Reusable `CredentialBadge` for the staff profile cards when Release 2 merges. |

Menu names (Title Case): Selective Entry Exam, Interviews, SEAL and Scholarships, NAPLAN, ICAS,
Maths, Science and English, VCE Tutoring, VCE Subject Selection, UCAT and GAMSAT.

### Follow-up (22 Oct 2026)

- **Results:** the John Monash and scholarship cards looked empty. Each card now ends with a link
  to the programme that prepares for it (bottoms line up), and those two cards get one line of
  general context (what John Monash Science School is; how scholarships are usually awarded).
  No new figures or claims.
- **Badge:** links to the Victorian Government's page,
  https://www.vic.gov.au/working-with-children-check (new tab; screen readers hear where it goes).

### Follow-up 2 (22 Oct 2026)

- **Results cards:** white-to-tint gradient, a hairline border and a soft layered shadow
  (`--shadow-card`), so they lift off the page. Cards were already equal height (grid stretch).
- **Scholarships card:** two ticked points about how we prepared these students (exam practice
  in each school's style and timing; mock interviews with written feedback), both services we
  already describe. No scholarship values or school names until the owner confirms them.

### Follow-up 3 (22 Oct 2026): results typography, icons, links and banner

| Feedback | Change |
|---|---|
| Labels compete with the numbers | Card titles are semibold (was bold), tighter line height, in a new dark slate `--color-text-slate` (#334155) instead of navy. |
| Breakdown rows too airy | Compact rows with hairline dashed dividers; counts right-aligned in tabular figures. |
| Icons small and disconnected | Solid blue 52px circle with a white icon and a soft blue halo. |
| Bottom links look standard | Soft blue pills reading "How we prepare →" that fill solid blue on hover/focus; screen readers hear the full destination (e.g. "How we prepare for scholarships"). Same short text on every card, so none wraps. |
| NAPLAN/ICAS box looks like an alert | Full width of the cards (was capped at the reading width), green left border, green-to-blue soft gradient, card shadow, icon in a solid green circle. |

New tokens: `--color-text-slate`, `--font-weight-semibold` (600), `--color-border-soft`, `--shadow-card`.

## 4. Stories

- **U1** As a parent, I can read each 2026 result (number and what it's for) at a glance.
- **U2** As a parent, I can tell the four approach steps apart and see the order at a glance.
- **U3** As a parent, the Programmes menu is easy to scan, and I can click anywhere on a row.
- **U4** As a parent, I see child-safety checks presented as a clear credential.

## 5. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | A11Y | Icons could be read out twice or carry meaning alone. | `aria-hidden` on every icon; text always present. |
| G2 | A11Y | Tinted backgrounds and pills must keep text contrast. | Tints are 3–12% over white; text colours unchanged (AA). Badge text is dark, not green. |
| G3 | A11Y | Hover-only states don't help keyboard users. | The same pill shows on `:focus-visible`; the current page is marked with `aria-current`. |
| G4 | DES | No hard-coded colours (F1.2). | All new colours are tokens mixed from existing theme colours. |
| G5 | PERF | An icon library could bloat the page. | Lucide imports per icon (tree-shaken); MUI icons (used in the portal) would pull in Material UI. |
| G6 | REQ | The "team page" with profile cards is part of Release 2 (not on `develop`). | Badge built as a shared component; used now in the About team card, ready for the staff profiles. |
| G7 | DES | Results numbers must stay accurate. | The breakdown uses the same confirmed figures, now as data rather than one text line. |

## 6. Todo

- [x] T1 Lucide added; tokens in `theme.css`
- [x] T2 Results cards with icons and breakdown lists
- [x] T3 Approach steps with icons, tints, step label, progress bar
- [x] T4 Programmes menu rows (icon, Title Case, chevron/tag, pill states, current page)
- [x] T5 Credential badge
- [x] T6 Tests; check desktop and phone; full check; commit
