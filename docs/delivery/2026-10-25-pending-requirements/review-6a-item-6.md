CHANGES_REQUESTED

# Review 6a — item 6 test plan, round 1

**Reviewed:** the draft `06-test-plan-item-6.md` (54 pre-merge cases, plus P-01 to P-08 and R-01) against 01b item 6, 03b §6 (§6.10, §6.11), 04b §0 and §4 path B, dev notes (incl. §11), review 5 rounds 1–2 and 06-security, at code `815135d`. Read-only.

**Verified (match the plan):** root, `e2e` and `web` scripts; `ci.yml` timeouts 15/20/15/10/10, 5 `if:` (95, 144, 147, 149, 155), 1 `id: hosted-ref` (127), one `permissions`, 0 hosted ref/`secrets.`/`github.event.`, every step name in E-63/E-65/E-66/E-75, line 117 and lines 120/121; `act -l` 5 rows (E-13); E-11 54 files; E-14 29/30 scanned; E-15 `lighthouserc.json`; every CLI string in E-34 and E-43 (incl. (k) = 8 pages); `local-env.mjs`, `local-hosts.ts`, `config.ts`, global-setup messages; test counts 25 / 9 / 6 (2 suites), 56 files, 496 = 493 + 3; 9 smoke and 19 CSP titles; 18 HTML files and the JSON-LD facts; 14 migrations, newest `20261026100000`; E-12, E-17, E-24, E-70 line length; E-01 tool versions; `act` log formats; rulings R1–R3 applied consistently; the five deliberate failures restored in-case, E-75 before E-74, E-74 last; post-merge §4 excluded from the 54.

## Blocking

1. **E-70 → E-71:** the `database` proof run reuses E-70's stack (D13; `ci-gates.md:170-174`). Add `supabase stop --no-backup` to E-70 step 5, then E-64's two counts expecting `0` and `0`.
2. **E-66 and P-06:** "`Started supabase…` `0`" is wrong: the line is on stderr, which `> /dev/null` keeps. Right value `1`; the S4 measures are the three key-value greps (each `0`) plus a key-shape grep (`0`).
3. **E-70 step 4b:** the `*.supabase.co/` trace grep hits doc-comment hosts in the dev-served supabase-js bundle (`example`, `xyzcompany`, `project-id`, `myproject`). Grep only the trace's network log (`'*.network'`, `"url":"https://…supabase.co`), expecting none, or drop 4b.
4. **E-73 step 2:** `| head -5` can't show 6 failures. Use `grep -ac 'categories:performance failure'` expecting `6` [measure].
5. **E-18 step 5:** `-A3` stops at the code fence; `pnpm install` is on `ci-gates.md:21`. Use `-A4`.
6. **E-27 / E-81:** the external suite `488dde1` has no hosted guard. Give E-27 an env measure (local `VITE_SUPABASE_URL`, no hosted `VITE_SUPABASE_*URL`, and the 5173 process env shows the local URL) and drop E-27 from E-81's guard sum as env-only.

## Non-blocking

7. E-66: `grep -ac '\*\*\*'` expect `≥ 1`.
8. E-66 (AC-6.2): assert `14` `Applying migration`, the last `20261026100000_staff_phone_edit.sql...`, and `Seeding data from supabase/seed.sql...`.
9. E-72 / E-81: the `hosts` value is `example.supabase.co/` (trailing slash).
10. E-72 step 1: 4 lines at `815135d` (120, 121, 180, 181); edit 120 and 121 only.
11. §1: `ci.yml` lines 176 to **182**.
12. E-20: exact count **23**.
13. E-33: a blank line between the 6 rows and `lighthouse-report: …`.
14. E-13: `grep -c 'retention-days: 7' .github/workflows/ci.yml` → `3` (lines 102, 154, 162), for AC-6.5.
15. E-16 step 3: use `grep -cE '^[|] .(@playwright/test|pg|@types/pg|dotenv|@lhci/cli). [|]' …/05-dev-notes-item-6.md` → `5`.
16. §3: add E-64 to the Safety row.
17. `$SCR`: use a fresh subfolder (`<scratchpad>/item6-run`) so the Developer's logs aren't globbed or overwritten.
18. R2 wording: the fix is already in the build (`5485710`).
19. §5: list S1, S5, S6 as deferred; E-18 could check `grep -c signing_keys_path docs/testing/ci-gates.md` → `1`.
20. E-42: Vitest prints ` > `, not `›`; match on the title text.

**Next:** fix 1–6 (ideally 7–9), then freeze. If the TSR header lists the changed lines, no second round is needed.
