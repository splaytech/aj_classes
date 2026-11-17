# BUG-4 — keyboard focus falls to the page body after several mock test actions

- Found in: BK-3 and BK-2 (round 1, 2026-11-18), build `124d3db`, dev server, Chrome (Playwright), 1280×800.
- Severity: **Minor** (accessibility, WCAG 2.4.3 focus order): a keyboard or screen-reader user is sent back to the
  top of the page after the action and has to find their place again.
- Kind: app bug. Take back to draft is the counter-example: focus lands on `Edit details`.

## Steps (each completed by keyboard: focus the button, Enter; in the dialog focus the confirm button, Enter)

1. Admin, draft with two questions: `Delete` on a question → confirm `Delete`.
2. Same page: `Release` → confirm `Release`.
3. User, released one-question mock test: `Start` (Enter), then `Submit` → confirm `Submit`.
4. User, released two-question mock test: on Question 1 press `Next` (Enter).

## Expected

BK-3: after each confirmation `document.activeElement` is not `body` ("a focus that lands on body is a FAIL").
BK-2: "After Next, focus is not lost to body".

## Actual

| Action | Focus after |
|---|---|
| delete-question confirm | `BODY` |
| release confirm | `BODY` |
| take-back confirm | `BUTTON "Edit details"` (fine) |
| submit confirm | `BODY` |
| `Next` onto the last question (Next becomes disabled) | `BODY` |
| `Start` (the button is replaced by the first question) | `BODY` (not frozen by the plan; recorded) |

## Evidence

`docs/delivery/2026-11-17-mock-tests/run-1/out/bk.json` (`BK-3`, `BK-2.focusAfterNext`, `BK-2.focusAfterStart`),
harness `run-1/h/bk.mjs`.

## Round 2

**Fixed** at `ef5c571` (b47fc0f). Delete question → "Questions" heading; release → page h1; submit → "Your result"; Next onto the last question → Previous; Start → "Question 1 of 2"; take-back → Edit details (RB-4, BK-2, BK-3 PASS). Evidence `run-2/out/bk.json`.
