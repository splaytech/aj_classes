# Review 6a: Test plan, header "We're hiring" link

Reviewer, 30 Oct 2026. Reviewed `06-test-plan.md` against 01 (AC-1 to AC-14), 03, 05, review-5's "For the Tester" list and the AJ Classes Tester addendum. Re-ran S-01 and S-02 on `95412b9`.

## Verdict: CHANGES_REQUESTED

What holds:
- Every AC is traced to a case (section 6); every review-5 Tester item is covered (AC-5/6/8/10/13 by hand with News and portal on; e2e smoke G-02; WebKit at 1024 D-07; real Safari left to Saurabh).
- Review-5 finding 1 (portal-off AC-4) is closed for real by S-03 on the portal-off gate build (Sign in count 0).
- Crowded case adds News in the browser only (D-01 to D-06, P-04, K-02); the real 0-post state is also checked (D-09, R-02).
- Regression flows next to the header are all there; addendum cases included (sweep at 375 and 1280, sign-in per seeded role, inactive account refused, `e2e-%` and port cleanup).
- Expected values are measurable and match the source (S-02, S-03 pattern, K-01's 19 tab stops, `invalidCredentials`, `aj-classes-portal-theme`).

Findings:
1. **Blocking:** S-01's expected footer count is wrong. `grep -c` counts lines, and `Footer.tsx:81` has both uses on one line, so it prints `Footer.tsx:1` where the plan expects 2. Fix the expected value or use `grep -o … | wc -l`, then dry-run it before freezing.
2. **Non-blocking:** add review-5 to the inputs and note in section 6 that its finding 1 is closed by S-03.
3. **Non-blocking:** `pnpm test:functions` is skipped (no function change); put the reason in the TSR's not-run list.
4. **Nit:** A-02 only points to R-11 and S-03; could be dropped (46 → 45).

Settled by the team lead (not flagged): tracked-files-only Prettier check; the lead stops the 5173 dev server before the run; G-03 rebuilds the gate build before serving.

## Round 2

APPROVED

1. Finding 1 resolved: S-01 uses `grep -o … | wc -l`; re-run prints `literal-hits=0`, `Header.tsx=4`, `Footer.tsx=2`, `footerLink-uses=0`, as expected.
2. Finding 2 resolved: review-5 in the inputs; S-03 (portal off) closes its finding 1 on the AC-4 row.
3. Finding 3 resolved: the `test:functions` skip has its reason and goes in the TSR "Not run" list.
4. Finding 4 resolved: A-02 dropped, A-03 renumbered; section 8 sums to 45.

No new findings. The plan can be frozen.
