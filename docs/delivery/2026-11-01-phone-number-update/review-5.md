# Review 5: phone number update (diff `develop...feature/phone-number-update`)

## Round 1 (d94551e): CHANGES_REQUESTED

1. Blocking: `business.constants.ts:8` comment contained the old number, failing AC 5. Fixed: comment now "Calls and WhatsApp share one number."
2. Non-blocking: `go-live.md:85` (O2) and `owner-decisions-reminder.md:8` still asked to confirm the old WhatsApp number. Fixed: now "move WhatsApp Business to +61 450 853 131".
3. Non-blocking: `whatsapp-button.md` link and "owner to confirm" clause. Fixed.
4. Non-blocking: YouTube channel description missing from the deferred owner list. Fixed.
5. Nit: plan boxes unticked. Fixed.
6. Nit: launch-kit "(update to …)" read as done. Fixed: "(owner to update to …)".
7. Nit: PRP O3 dated change note. Fixed.

Verified in round 1: digits correct in all three forms; 19 built pages, none with the old number; 19 `tel:+61450853131`; 36 `wa.me/61450853131` with the same greeting; one JSON-LD telephone `+61 450 853 131`; fixture matches the build; nothing in `supabase/`, privacy page, portal or tests holds either number.

## Round 2 (506008f): APPROVED

Reviewer: all 7 round-1 findings fixed, no new issues. A repo-wide grep finds no `469 800 685` or `469800685` in `apps/` or `supabase/`. In living docs the old number appears only in dated "was" notes and in records of what was entered on Facebook, YouTube and Google earlier. Rebuilt build: no old number; 19 `tel:+61450853131`; 36 `wa.me/61450853131`; one JSON-LD telephone `+61 450 853 131`.
