# Portal polish: developer notes

Branch `fix/portal-polish`, from `origin/develop` at `82a60ef`. Local only: not pushed.
Sources: TSR item 5 E-45 (FU-K1), `actionItems.md` items 27 and 53, and the item 4 and item 7
dev notes (O1, O2, O3, O5).

## What changed

| # | Fix | Behaviour now | Files |
|---|-----|---------------|-------|
| 1 | FU-K1: photo preview | The portal CSP `img-src` allows `blob:`, so a newly chosen profile photo shows its preview before upload. Changed on `/portal/*` and `/__spa-fallback` (Vercel) and `__spa-fallback.html` (Railway mirror). The public CSP is unchanged. | `apps/web/vercel.json`, `apps/web/serve.railway.json`, `hosting-csp.test.ts`, `docs/architecture/arch.md` |
| 2a | DEV badge over the name | On portal pages the environment label sits bottom right. The top strip is unchanged, and public pages keep the label top left under the header. The label moves just after hydration: portal pages hydrate from the pre-rendered fallback, and React keeps a pre-rendered class name that differs. | `EnvironmentMarker.tsx` and its `.module.css`, `root.tsx`, `environments.md` |
| 2b | Grey text not grey | MUI 9 removed system props, so `<Typography color="text.secondary">` was ignored and rendered in the body colour. All **75 uses in 26 files** now use `color="textSecondary"`, which maps to `--color-text-muted`. A test fails if `color="text.*"` comes back. | 26 portal files, `lib/portal-theme-text.test.tsx` |
| 2c | Long hints | Staff phone hint: "So AJ Classes can reach you. Only admins see it; it's never on the website." Hold-results hint: "Marks and answers stay hidden until you return the work. Any written question holds it all." (review follow-up, matching ADR-0007). At 360 px the phone hint is 2 lines, from 3, and the hold hint is 3 lines, from 5. | `portal.constants.ts`, `online-assignments.constants.ts`, 03b design table |
| 2d | Focus without scroll | If Save finds a problem on My profile or the admin staff page, the first bad field gets focus and scrolls to the middle of the screen, so its label and error show. A phone number the server refuses is shown the same way. Fields are reached through refs, not `document.getElementById`. | `ProfileForm.tsx`, `PortalField.tsx`, `QualificationsEditor.tsx`, `lib/reveal-field.ts`, `test/setup.ts` |
| 3 | Footer focus ring (item 53) | New token `--color-focus-inverse` (`#93c5fd`). The footer and the navy feature band (`Section` `inverse`) point `--color-focus` at it, so the global `:focus-visible` ring uses it. | `theme.css`, `Footer.module.css`, `Section.module.css`, `theme-contrast.test.ts` |
| 4 | Dead constant | `CLASSES_PAGE.saved` removed. Nothing referenced it, directly or by destructuring, and the text "Class saved." appears nowhere else. | `portal.constants.ts` |
| + | House rule | `QualificationsEditor` focuses a new line through a ref, not `document.getElementById`. This clears the kinet `react/no-direct-dom-mutation` flag in a file this branch touched. | `QualificationsEditor.tsx` (+ test) |

## Measured contrast (focus ring, WCAG 1.4.11 needs 3:1)

| Ring | Background | Before | After |
|------|------------|--------|-------|
| Light theme, footer and navy band | `#172554` | `#2563eb`: **2.84:1** | `#93c5fd`: **8.15:1** |
| Dark theme navy (`--color-bg-inverse`) | `#1e3a8a` | `#2563eb`: 2.00:1 | `#93c5fd`: **5.74:1** |
| Normal ring, light (unchanged) | `#ffffff` | `#2563eb`: 5.17:1 | same |
| Normal ring, dark (unchanged) | `#0b1220` | `#93c5fd`: 10.38:1 | same |

In Chromium at 360 and 1280 px, all 7 footer links show `solid 3px rgb(147, 197, 253)` on
`rgb(23, 37, 84)`, which is 8.15:1. The hero's navy "Our 2026 results" card keeps the blue ring.
That ring sits 2 px outside the card, on white (5.17:1), so it needs no change. The public site
never shows dark mode. The dark row is checked by `theme-contrast.test.ts` only.

## What I checked in a browser (no database)

I made a staging-mode build with no Supabase config, as CI's Lighthouse job does. I served it
with `serve.railway.json` on `127.0.0.1:4181` and drove it in Playwright Chromium.

1. **CSP:** `/portal/login` sends `img-src 'self' data: blob: <hosted>`, and a `blob:` PNG loads
   with 0 CSP lines. On `/`, the same `blob:` image is still blocked (1 `img-src` line).
2. **Label:** on `/portal/login` at 360 and 1280 px the label is bottom right (0 px from the
   right and bottom). On `/` it is still top left at 72 px. Before the hydration fix, the portal
   label stayed top left in the real build even though the unit tests passed.
3. **Footer ring:** the measurements in the table above.
4. **Hint lengths**, measured in Chromium at the 360 px widths (328 px field at 15 px; 302 px
   card at 14 px): the phone hint is 2 lines and the hold hint is 3. The old wording measured 3
   and 5 lines, which matches the earlier reports. A 2-line hold option with the same rule (81
   characters, measured): "Results stay hidden until you return the work. Any written question
   holds it all." It is not applied.

## How to verify in a browser (Tester or Saurabh: needs a signed-in local portal)

Use 360 × 800, then 1280 × 800, in light and then dark (the theme switch in the portal header).

1. **Photo preview (FU-K1):** run the mirror (`pnpm mirror`), sign in as `tutor@`, go to My
   profile and choose a photo. The preview shows, and the console has no `img-src` violation.
   This is TSR item 5 E-45 run again. Also check the live `curl -sI …/portal/login` once it's
   deployed.
2. **DEV label:** signed in on `pnpm dev`, the red `DEV · …` label is bottom right. The signed-in
   name and role in the header are fully readable at 360 px.
3. **Muted text:** on My work, an assignment's "Total N marks", the question explanations and the
   hold-results hint are grey, not body colour. Expect `#4B5563` in light and `#A6B3C7` in dark.
4. **Hints:** on My profile, the phone hint is 2 lines at 360 px. On an assignment draft with
   questions, the hold-results hint is 3 lines.
5. **Focus and scroll:** on My profile (tutor) and Admin → staff member, clear Full name, scroll
   to Save and press it. The page scrolls so Full name sits mid-screen with its error showing,
   and it has focus. Repeat with a bad phone (`12345`).
6. **Footer ring:** on any public page, Tab to a footer link. The ring is light blue on navy.

## Deviations and notes

- **D1. Where the label goes.** The brief said "the DEV badge overlaps the name". I moved the
  portal label to the bottom right rather than shrinking it, so it never sits over the header,
  whatever the name length. MUI dialogs (z-index 1300) cover it, and it has
  `pointer-events: none`.
- **D2. The hint wording is new copy.** It keeps both promises (admins only and never on the
  website; hidden until returned, and any written question holds everything, per ADR-0007). The 03b design table shows
  the old wording struck out and the new wording beside it.
- **D3. An extra commit for 2a (`4930d96`).** The hydration fix was found by the browser pass
  after `bb40b6d`. It is a separate commit, not an amended one.
- **Sibling not changed:** the public `ContactForm` still focuses its first bad field with
  `document.getElementById` and does no scroll. It is a short form on the public site, outside
  this portal brief. Suggested as a follow-up.
- **Review follow-ups (2026-10-29):** a re-added qualification line now gets focus every time,
  and a qualifications error focuses the first box, not the fieldset. The hold hint follows
  ADR-0007 and the scroll-test spies are restored in `afterEach`.
- **kinet validate:** 46 findings remain. All were there before this branch, and none is in
  lines it changed. The two `document.getElementById` calls this branch touched (ProfileForm,
  QualificationsEditor) are gone.
