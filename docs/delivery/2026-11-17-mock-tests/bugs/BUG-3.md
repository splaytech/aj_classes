# BUG-3 — focused text and icon buttons on the mock test pages show no outline or ring

- Found in: BK-1 (round 1, 2026-11-18), build `124d3db`, dev server, Chrome (Playwright, `channel: 'chrome'`), 1280×800 light.
- Severity: **Minor** (accessibility, WCAG 2.4.7). Focus is not invisible: MUI paints its focus ripple (a filled
  tint) on the focused button, see the screenshots. But the plan measures "outline or ring with non-zero width",
  and the move buttons' tint is a pale grey circle.
- Kind: app behaviour against the plan's measure; **house-wide** (the pre-existing header `Switch to dark mode`
  icon button is the same), so the lead may rule it a plan error or out of scope for this feature.

## Steps

1. Sign in as `admin@local.test`; open a draft mock test with two questions (`/portal/admin/mock-tests/<id>`).
2. Tab through the page from the top.
3. For each focused element read `getComputedStyle(el).outlineStyle/outlineWidth` and `boxShadow`.

## Expected

BK-1: "focus is visible on each (outline or ring with non-zero width)".

## Actual

Links (logo, nav, `← All mock tests`, title links) and contained buttons pass (links `solid 3px` outline; the
contained `Release`/`New mock test` get an elevation shadow). These have `outline: none 0px`, `box-shadow: none`
when focused, and only gain `.Mui-focusVisible` plus a `.MuiTouchRipple-ripplePulsate` child:
`Edit details`, `Delete draft`, `Move question 1 down`, `Move question 2 up`, both `Edit`, both `Delete`,
`Add question`, and the header `Switch to dark mode`.

## Evidence

`docs/delivery/2026-11-17-mock-tests/run-1/out/bk.json` (`BK-1.list`, `BK-1.edit`: per-stop outline and shadow),
`run-1/out/bk1-probe.json` (before/after focus styles), `run-1/shots/BK-1-focus-edit-details.png`,
`run-1/shots/BK-1-focus-move-down.png`.

## Round 2

**Fixed** at `ef5c571` (1b76b22). Focused Edit details, Delete draft, Add question, Move, Edit, Delete and the header toggle: `outline: solid 3px` (RB-3, BK-1 PASS). Evidence `run-2/out/bk.json`, `run-2/out/bk1-probe.json`, `run-2/shots/BK-1-focus-*.png`.
