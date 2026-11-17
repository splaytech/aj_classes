# Mock tests: closing date and close now

Saurabh, 18 Nov 2026, verbatim: "there should be an expiry as well, or way to deactivate test so its not visible to anyone anymore"

Team lead, acting as Product Owner. The team made the [ASSUMPTION] calls below; each one is cheap to flip.

## Model
- One nullable column, `mock_tests.closes_at timestamptz`.
- A released test is **open** while `closes_at` is null or in the future, and **closed** from `closes_at` on.
- "Close now" sets `closes_at` to the server's `now()`. Expiry and deactivation are therefore the same state.

## Acceptance criteria
1. When releasing, an admin can optionally set a closing date and time, which must be in the future. Leaving it empty means the test never closes.
2. On a released test, any admin can set, change or clear the closing date and time. A new date must be in the future.
3. On an open released test, any admin can **Close now** after a confirmation. This works even when attempts have been submitted, unlike take-back.
4. Reopen [ASSUMPTION]: on a closed test, an admin can clear the date or set a future one, and the test is open again.
5. From closing time, for every taker (student, parent, user):
   - the test is not in their list;
   - a direct link shows the same "not found" message as now;
   - an in-progress attempt can't save or submit (`not_found`, HTTP 404);
   - [ASSUMPTION, literal reading of "not visible to anyone"] their submitted result is also hidden.
6. Admins still see closed tests:
   - the admin list shows "Closed" and the date;
   - an open test with a date shows "Closes <date, time>";
   - the questions stay frozen, exactly as for a released test.
7. Take-back to draft keeps its current rule. Taking a test back clears `closes_at`.
8. A test with a closing date in the past is never shown to takers, even if the page is open across the moment it closes: the database decides on every call.
9. Dates show in the app's existing date format and in the viewer's local time. No new time-zone setting.

## Limits
- New migration only: `20261118100000_mock_tests.sql` is already applied to the hosted database and must not change.
- Writes go only through security-definer functions; `closes_at` is never column-granted to `authenticated`. Same gates as release: admin at aal2, and the test row locked `for update`.
- No email, no scheduled job: closing is decided at read time.

## Deferred
- An archive or hide view in the admin list.
- Notifying takers before a test closes.
- An opening date (scheduled release).
