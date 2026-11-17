# Review — stage 6a (06-test-plan.md)

## Round 1

CHANGES_REQUESTED

Read-only review at 124d3db (catalogue queries and anonymous API probes only).

1. **Blocking.** §0.1 line 42: request guard aborts every non-localhost host, which blocks Turnstile (`apps/web/.env.local` enables the test key; `@marsidev/react-turnstile` loads `challenges.cloudflare.com/turnstile/v0/api.js`). The widget never reaches `Success!` (line 45), so no browser row can sign in. Fix: allow that host (not Supabase, Vercel or Google) or stub it; say which.
2. **Blocking.** Admin state unreachable. `is_admin()` reads only the JWT `aal` claim (20261006004522_staff_accounts.sql:132-135); a probe of `newadmin@` at aal2 with no factor returned the admin list, but GoTrue never issues that token. AZ-9 (363), AD-12 (495), AD-16 (517), AD-17 (521), CC-1 to CC-8 (644-692) pass on an impossible state. Fix: apply FX-NA at the start of Sitting 1, remove in CL-1.
3. **Blocking.** BR-1 fixture (1094) is 151 chars (`repeat('w',140)||'-<RUN>'`, 10-digit RUN); `mock_tests_title_check` (:19) refuses it. Fix: `repeat('w', 150 - length('-<RUN>'))`.
4. **Blocking.** BM-20 (896) needs BT-1 to BT-12 done, but §0.4 (172) runs BM before BT → Submitted 0. Fix: run BM-20 after BT-18.
5. Non-blocking. AZ-4 (340) real-account line needs BA-7 (Sitting 3). Move it.
6. Non-blocking. R-1 restore (1126-1128) "…same…", "(by id, recorded)": write the SQL.
7. Non-blocking. AZ-1 (313) names `as_anon` (one argument) while the probe block is e-mail based; write the anon loop.
8. Non-blocking. BT-2 (922) doesn't name the account for the B1 double-press; give FX-NA apply and restore points for BA-5 to BM-11.
9. Non-blocking. HTTP status for P0002 (625, 905, 1043) unverified; record it and let the lead rule. — *Lead: already ruled L-8 (record the real status; a 500 is a bug).*
10. Non-blocking. Standing rule puts AJ Classes browser work in the AJClassesBrowser Chrome; §0.1 (40) says Playwright `channel: 'chrome'`. — *Lead ruling L-9: the AJClassesBrowser rule covers the Claude-in-Chrome extension and real accounts (Google, Search Console, Meta). Tester rows on localhost use Playwright with the installed Chrome (`channel: 'chrome'`, fresh profile, no real accounts); the lead's V rows use AJClassesBrowser via switch_browser.*

Held: GR-1 to GR-4 (13 column grants, 13 functions, 8 policies); AZ-2 (anon REST 401/42501); AZ-3 (tutor not_taker, 0 rows); AD-3, AD-4, AD-11 constraint names and btrim pin of 2; AD-13, TK-1 result strings; TK-2 keys; TK-10, BT-16 (no minimum-answer check, 592-603); CC-1, CC-5 to CC-8 vs migration 137-150, 310, 327, 500, 526, 574; copy in 12 browser rows matches constants exactly; S-0 matches live DB; 18 S-4 files exist; S-8 has 17 tests; S-10 line numbers hold; 140 rows, §10 sum and AC 1–44 traced; L-5, L-6 pinned; no row needs production. Note: tracked `apps/web/.env.production` holds the hosted URL baked by S-5's plain build; nothing contacts it.

## Round 2

APPROVED

All ten round-1 findings closed: Turnstile allowed only for challenges.cloudflare.com with a self-test (§0.1, 43-48); FX-NA applied at Sitting 1, removed in CL-1, with Sitting 3 apply/remove at BA-5 (762) and BM-11 (876), apply SQL checked against live auth.mfa_factors; BR-1 title exactly 150 (1133); AZ-1 anon_rb loop (nine functions, four reads, four writes; never commits); AZ-4 real-account line moved to BA-7 (777); R-1 restore columns exist, seed has no answers/results for "Times tables warm-up" (241-260) so 0|0|0 is right; BM-20 after BT (182-183); BT-2 names student@; L-8 and L-9 reflected. Nothing new broken. Non-blocking: R-1's `T0='<saved>'` is a row-specific placeholder.
