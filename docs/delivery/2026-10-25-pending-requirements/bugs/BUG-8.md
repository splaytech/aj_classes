# BUG-8 — E2E spec "RLS: anon can read posts" still selects `*`, which the posts migration now refuses

- **Found:** 2026-10-25, `/test-and-ship` item 3, round 1, case E-88 · **App build:** `feature/work-returned-email` @ `4af50eb` · **E2E repo:** `~/dev/work/aj_classes-e2e` @ `f5b7024`
- **Severity:** Medium for the gate, none for the app. The E2E suite is red (8 passed, 1 failed), so `/test-and-ship` can't reach 100%. The app behaves as designed: `20261025110100_posts_public_columns_and_trim.sql` gives visitors column grants only, so `select=*` (which includes `author_id`) is refused. Plan known non-bug 5 covers this, and E-80 confirms it. The fix belongs in the E2E repo.

## Steps to reproduce

1. Local stack at this branch (both item 3 migrations applied), dev server on :5173.
2. `cd ~/dev/work/aj_classes-e2e && pnpm test`

## Expected

All 9 specs pass.

## Actual

`tests/admin-posts.spec.ts:172` "RLS: anon can read posts but cannot write them" fails at line 192:
`expect(selectResult.error).toBeNull()` received
`{"code":"42501","message":"permission denied for table posts","hint":"Grant the required privileges … GRANT SELECT ON public.posts TO anon;"}`.
`anonDb.select('posts')` asks for every column.

## Suggested fix (E2E repo)

- Select the public columns: `id, created_at, updated_at, title, body`, the same as `PUBLIC_POST_COLUMNS`.
- Add an assert that an anonymous `select=author_id` is refused with `42501`, so the spec now guards the new rule as well.

## Evidence

`docs/test-reports/2026-10-25-feature-work-returned-email/evidence/E-88-e2e.log`.
