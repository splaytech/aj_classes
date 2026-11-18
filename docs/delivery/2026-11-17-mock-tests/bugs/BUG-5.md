# BUG-5 — a long unbroken title or option pushes the whole page sideways

- Found in: BR-1 and BR-2 (round 1, 2026-11-18), build `124d3db`, dev server, Chrome (Playwright), 375 and 1280 wide,
  light and dark.
- Severity: **Minor** (needs a title or option with no spaces, e.g. a pasted URL or a long number string; the limits
  allow 150 and 300 characters). The page scrolls sideways at every width.
- Kind: app bug (the text has no `overflow-wrap`/`word-break`).

## Steps

1. Admin: make a draft whose title is 150 characters with no space (the plan's BR-1 fixture:
   `repeat('w', 150 - length('-<RUN>'))||'-<RUN>'`). Open `/portal/admin/mock-tests/<id>`.
2. Student: a released mock test whose first option is 300 characters with no space; open it in progress.
3. Read `document.documentElement.scrollWidth - document.documentElement.clientWidth`.

## Expected

`0` on every page (BR-1, BR-2). On the admin list the same title stays inside the table's own scroll container.

## Actual

| Page | 375 | 1280 |
|---|---|---|
| admin edit page, 150-character title (also with the New question and Release dialogs open over it) | 3444 | 2972 |
| take page and submit dialog, 300-character unbroken option | 2472 | 1667 |

Controls: the admin list with the same title → `0` (the table scrolls inside `TableContainer`, 623 > 341 at 375);
a 299-character option made of words → `0` at 375 (rows 317×250, 317×52, 317×52).

## Evidence

`docs/delivery/2026-11-17-mock-tests/run-1/out/br.json` (`BR-1`, `BR-2`), `run-1/out/br-probe.json`,
`run-1/shots/BR-1-edit-draft-*.png`, `run-1/shots/BR-2-take-300-option-*.png`, `run-1/shots/BR-2-take-300-spaced-375-light.png`.

## Round 2

**Fixed** at `ef5c571` (b47fc0f). Overflow 0 at 375 and 1280, light and dark, for the 150-char unbroken title (incl. New question and Release dialogs over it) and the 300-char unbroken and spaced options (RB-5, BR-1, BR-2 PASS). Evidence `run-2/out/br.json`, `run-2/out/br-probe.json`, `run-2/shots/V-1-new-question-over-150-title-375-*.png`.
