CHANGES_REQUESTED

# Review 6a — item 5 test plan, round 1

**Reviewed:** the plan at `09baea0`, 49 cases, against the code and config on `9de84b3`, `serve-handler` 6.1.7, `build/client` and the local DB. Read only.

**Verified:**
- E-12–E-16: header counts per path, and the redirects.
- E-17: Railway order and the swap result; the local origin appears 3 times.
- Robots counts: 14 × 0, plus 1 each for `/subscribed` and `404`.
- JSON-LD on 11 pages; 16 paths.
- E-18/E-19: `check:hosted-ref` strings and exit codes.
- E-07, E-09, E-70–E-72: counts.
- UI strings and the seed, with the newest migration `20261026100000`.
- S1, S3, S4 and S5 each have a case.
- The deferred `eval` probe.
- C1–C5 are narrow.
- Nothing hosted or real is used.
- X1–X4 are restored, and E-80 diffs.

## Blocking

1. **E-32: the origin glob is wrong.** `E-2*.har` includes E-20's portal leg, which loads Turnstile from `challenges.cloudflare.com`. It also leaves out E-30, the only legs that open `wa.me`. Read `E-2*.har E-30-*.har`, and expect `challenges.cloudflare.com` from the portal leg only.
2. **E-11 step 2:** pnpm prints `$ …` lines first. Use `grep '^serve-mirror:'` and expect exactly 1 line.

## Minor

3. Mocks and the host counter must use `context.route` and `context.on('request')`, so they cover E-30's popup.
4. C4 must include the same-origin `/privacy` frame line from E-51.
5. **E-51:**
   - Catch the `fetch` and `FontFace` rejections.
   - Before freezing, run the probes not yet run: `sendBeacon`, `WebSocket`, `FontFace`, `link`, `object`, `base` and `form`.
   - Record their exact lines in C4, including any WebSocket "connection failed" line.
6. **E-54:** allow `127.0.0.1:4177` for the framer leg only.
7. **Portal legs:** before freezing, run one admin sign-in on P and record the console. Turnstile iframe lines need a ruling (C6).
8. **S7 evidence:** E-04 must name the `$`-pattern test (`mirror-config.test.ts:60`). Alternatively, add an E-17 `--origin 'http://a$&b'` step that expects 3.

## Nits

9. **E-80:** use E-01's "clean apart from the evidence folder" wording.
10. **E-17:** wait for :4175, and give the stop command.
11. **E-01:** `MIRROR_SUPABASE_ORIGIN` must also be unset.
12. **C1:** either drop `/portalx` and `/__spa-fallbackx`, or add browser legs for them.

**Next:** fix 1–2 (ideally 3–8 too), then freeze. If the changed lines are listed in the TSR header, no second round is needed.
