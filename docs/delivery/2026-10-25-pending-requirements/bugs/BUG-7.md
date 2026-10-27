# BUG-7 — `parent_child_assignment` answers HTTP 500 instead of 403/404 for someone who isn't the parent

- **Found:** 2026-10-25, `/test-and-ship` item 3, round 1, case E-22 (wrong-role open) · **Build:** `feature/work-returned-email` @ `4af50eb`
- **Severity:** Low. No data leaks, and the page correctly shows "You don't have access to this page". But a refused read comes back as a server error. It logs a 500 in the console, and a 500 would look like an outage in any hosted error monitoring. The function is older (R3b, `ab93064`). Item 3's parent email links make it easy to hit: a forwarded email, or a tutor opening a parent's link.

## Steps to reproduce

1. Local stack. As `tutor@local.test` (REST, or the dev server):
   `POST /rest/v1/rpc/parent_child_assignment` with `{"target_student":"<Aarav id>","target_assignment":"<Reasoning mock test 1 id>"}`.
2. Or, in the browser, signed in as `tutor@local.test`, open `/portal/parent/children/<Aarav id>/assignments/<id>`.

## Expected

A 403 (`42501`) or a 404, like its sibling `student_assignment`, which returns **403** to a parent opening the student link.

## Actual

`500 {"code":"P0002","message":"not_found"}`. The browser console shows `500 (Internal Server Error)` next to `403 POST /rest/v1/rpc/parent_children`.

## Likely cause

The function raises `not_found` with SQLSTATE `P0002` (no_data_found), which PostgREST doesn't map to a 4xx.

## Suggested fix

Raise with `errcode = '42501'` (as the other family functions do for "not yours"), or use a code PostgREST maps to 404. Add a pgTAP assert on the SQLSTATE.

## Evidence

TSR-item-3 E-22: `as.mjs tutor@local.test POST /rest/v1/rpc/parent_child_assignment …` → `500 {"code":"P0002",…}`.
