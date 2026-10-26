# BUG-15 — A deactivated student's open page sends two refused sign-outs (two 403 console lines)

- **Found:** 2026-10-26, `/test-and-ship` item 7, round 1, case E-73 step 2 (also fails E-91) · **Build:** `feature/fair-results` @ `4c84dbd` (code `995c9ee`)
- **Severity:** Low. No data is shown and the person ends up signed out on `/portal/login`, which is right. But the frozen plan's strict console rule allows only A4 here (at most 1 refused `not_student` read per reload). This leg logs two other lines: the app sends the same sign-out twice, and the server refuses both.
- **Item 7?** No. No item 7 file is involved (`lib/portal-guard.ts` was last changed in `d01f43b`, item 3). Item 7's runbook (`supabase/README.md`, step (b)) now points admins at this exact action, so the leg is tested here for the first time.

## Steps to reproduce
1. Local stack, dev server on :5173 (`pnpm db:reset` seed).
2. Context A: sign in as `student@local.test`, stay on `/portal/student`.
3. Context B: sign in as `admin@local.test` (two-step), open Admin → Students → Aarav Demo → Student account → **Deactivate**, confirm ("Deactivate this account?").
4. In context A, reload the page. Count `console` errors and the requests to `127.0.0.1:55321`.

## Expected
Signed out to `/portal/login` (or the "Your student account isn’t active." message), with **at most 1** console line: the refused `not_student` read (ruling 3, A4). The app sends one sign-out at most.

## Actual
- Context A lands on `/portal/login` (correct).
- Two `POST /auth/v1/logout?scope=local` requests, both **403**. Each is logged as `Failed to load resource: the server responded with a status of 403 (Forbidden)`, so there are 2 console lines and neither is the `not_student` read A4 allows.
- A `POST /rest/v1/rpc/my_onboarding` is also sent on the same reload (200 or refused; not logged).

## Likely cause
`member-layout.tsx` and `student-layout.tsx` both run `guardPortalPage()` (`lib/portal-guard.ts`) in their `clientLoader`s, and React Router runs them in parallel. Both read the same access state, both get `decision.kind === 'signOut'`, and each calls `signOut()` (`services/auth.service.ts:38`, `supabase.auth.signOut({ scope: 'local' })`). The ban has already revoked the session, so GoTrue answers 403 to both. The local session is cleared anyway.

## Suggested fix
- Make the guard's sign-out happen once per navigation, for example a module-level in-flight promise in `signOut()` (the same pattern as `d01f43b`'s shared access read).
- When the session is already invalid, clear the local session without the server call. supabase-js treats a 403/401 from `/logout` as "already signed out", so the request only adds a console line.
- Unit test: two parallel guard calls that both decide `signOut` → one `auth.signOut` call.

## Evidence
`evidence-item-7/browser-legs-summary.json` → `ph4d.json` → `e73.step2` (URL, the two 403 `logout` lines, the `my_onboarding` write). Raw run output is in the session scratchpad (`item7-run/out/ph4d.json`).
