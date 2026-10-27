APPROVED

# Review 6b: security review (round 1)

**Verified:**
- The line references are correct. The test references are off by 1–2 lines (href check at 45-48, ABN guard at 77-79).
- CSP coverage holds for `vercel.json:31,34` and `serve.railway.json:7,26`, and a `mailto:` link isn't governed by `form-action` or `connect-src`.
- There's no injection path and no PII in the doc.
- Low severity is right for finding 7.

## Non-blocking

1. **Finding 7:** say *when*, not just who: before production.
2. **The address now appears in one more plain-text place.** That's no new exposure, because it's already in the footer.

**Lead note:** 1 is added to 06 "Pending for Saurabh".
