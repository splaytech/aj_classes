# Test Summary Report — phone number update
- Date: 2026-11-01 · Branch: feature/phone-number-update @ 506008f · Environment: local production build (`VITE_APP_ENV=production pnpm build`), 19 prerendered pages
- Full check: format (changed files), lint, typecheck, `pnpm test`, build, `check:structured-data` → pass; 668/668 tests; structured data 19 pages, 0 problems

## Round 1
| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| T-1 | AC 1 | Number shown on pages | `+61 450 853 131` on every page | on 0 of 19 pages (contact card, footer) | PASS |
| T-2 | AC 2 | Call links | all `tel:+61450853131` | 0 links, no other tel: number | PASS |
| T-3 | AC 3 | WhatsApp button | `wa.me/61450853131?text=Hi AJ Classes…` | 0 links, same greeting | PASS |
| T-4 | AC 4 | JSON-LD telephone | `+61 450 853 131`; validator clean | ; 19 pages, 0 problems | PASS |
| T-5 | AC 5 | Old number gone | 0 files in build, `apps/web/src`, `supabase` | 0 files | PASS |
| T-6 | AC 6 | Full check | green | green, 668/668 | PASS |
| T-7 | Regression | Structured data fixture | matches built home page JSON-LD | matches (reviewer verified) | PASS |

Pass rate: 7/7 = 100% · Defects open: none

## Verdict
APPROVED (auto)

## Not covered
- No browser pass: a constants-only change, checked on the prerendered HTML instead. Not tapped on a phone to place a real call or open WhatsApp.
- Google Business Profile, Facebook, Instagram, YouTube and the WhatsApp Business app still show the old number; those are owner account settings.
