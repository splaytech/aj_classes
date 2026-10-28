# review-6b — Stage 6b (Security) gate

APPROVED

Claims verified read-only on the local DB at migration 20261028110000:
- RLS: three policies; insert and update allowed for admins only.
- Grants: column INSERT/UPDATE for authenticated, with no grant on year_level; table-level SELECT only; anon has nothing.
- `year_level` is generated (`attgenerated = 's'`), and pgTAP #13 expects 428C9.
- Trigger function: `prosecdef = f`, `search_path=""`, execute revoked (checked at CREATE TRIGGER, not when it fires).
- The CHECK text matches the migration.
- No new data reaches families.

## Findings
1. Non-blocking: agree that adding an aal2 tutor-escalation variant is worthwhile.
2. Non-blocking (info): the order trigger fires only when an update touches year_levels. That's fine; the CHECK still applies if a future migration disables triggers.
3. The "PASS WITH NOTES" verdict is justified: no secrets, dependencies, dynamic SQL, raw HTML or console.log.
