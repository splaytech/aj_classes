APPROVED

# Review: BUG-15 fix (security and code), `8d29762..5d4ca64`

Read auth-js / supabase-js 2.117.2 source; the 4 new tests pass; lint and typecheck clean. No hosted contact, no edits.

1. **Storage key matches exactly** supabase-js's default (`SupabaseClient.ts:333`: `sb-${hostname.split('.')[0]}-auth-token`), checked against a real client for the local URL and `https://<ref>.supabase.co` (with and without trailing slash, with spaces). No one is signed out by the change.
2. **No live session left in memory:** with `persistSession: true`, auth-js reads storage on every `getSession`/`_useSession` (`GoTrueClient.ts:3014`); an in-flight refresh is discarded by the commit guard; no realtime channels.
3. **Only reachable** for a signed-in session with no readable active profile and no onboarding (`portal-access.ts`); errors throw instead of signing out. User-chosen sign-outs still call `signOut()`.
4. **The `ban_failed` gap is acceptable.** Note: auth-js already ignored the 403 from `/logout`, so BUG-15 was only console noise.
5. **Tests** prove the guard behaviour and the key formula; repo rules met.

## Blocking

None.

## Non-blocking

1. Other tabs aren't told (no `SIGNED_OUT` broadcast); low severity. Record as an accepted gap, or post on a `BroadcastChannel(storageKey)`.
2. The key test checks a hardcoded string. Build a real client without `storageKey` and assert `client.auth.storageKey === sessionStorageKey(url)`; optionally `getSession()` is `null` after `clearStoredSession()`.
3. `portal-guard.ts:33` comment overstates "only a deactivated account"; reword to "an account with no readable active profile (deactivated)" and add the no-profile case to the residual note.
4. Theoretical TOCTOU inside `_saveSession` for a `ban_failed` account; no change.
