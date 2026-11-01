# Phone number update: requirement, architecture, design and plan (stages 1–4)

Requested 1 Nov 2026 by Saurabh for the owner: "update the number on the website to 0450853131. This is a
personal number but he needs to update to this." A constants-only change, so stages 1–4 share one doc.

## 1. Requirement (Product Owner)

**Story:** As a parent, I see and can call or WhatsApp the owner's current number, so I reach AJ Classes.

**Acceptance criteria**
1. Every public page shows `+61 450 853 131` wherever it showed `+61 469 800 685` (contact card, footer).
2. Every call link is `tel:+61450853131`.
3. The WhatsApp button opens `https://wa.me/61450853131?text=…` with the same greeting as before.
4. The home page JSON-LD `telephone` is `+61 450 853 131`, and the structured data check passes on every page.
5. No built page or source file (outside dated delivery evidence) still contains `469 800 685` or `469800685`.
6. The full check (format, lint, typecheck, tests, build) passes.

**Assumptions**
- [ASSUMPTION] The WhatsApp button moves to the new number too. The site has always used one number for calls
  and WhatsApp (PRP O3, whatsapp-button.md), and the request says "the number", singular. If WhatsApp should stay
  on the old number, `whatsappNumber` is a one-line revert.
- [ASSUMPTION] Display format stays international (`+61 450 853 131`), matching the current number's style.
- [ASSUMPTION] Publishing a personal number is the owner's explicit choice ("he needs to update to this"); no
  privacy wording changes are needed because the privacy page doesn't list the number.

**Deferred / out of scope (Saurabh or owner to do)**
- Google Business Profile, Facebook, Instagram and WhatsApp Business app numbers: account settings, not code.
- Dated delivery evidence and test reports keep the old number; they record what was true then.

## 2. Architecture (Architect)

No architecture impact. The number lives in `BUSINESS` (`business.constants.ts`), the single source of truth for
the page content, footer, WhatsApp button and JSON-LD. Nothing irreversible or paid.

## 3. Design (Solution Designer)

Files to touch:
- `apps/web/src/constants/business.constants.ts`: `phone`, `phoneDial`, `whatsappNumber`; drop the stale
  "owner to confirm" comment.
- `apps/web/scripts/fixtures/structured-data/home-valid.html`: refresh from a production build (it mirrors real output).
- Living docs that state the current number: `docs/requirements/brand-guidelines.md`,
  `docs/social-media/setup-runbook.md`, `docs/social-media/launch-kit.md` (current-state lines), with a dated note.

Tests: existing component and SEO tests read `BUSINESS`, so they follow the constant. AC 1–5 are checked on the
production build by grepping the built HTML (Tester).

## 4. Plan (Manager)

- [x] Branch `feature/phone-number-update` from `develop` 62f8ba3.
- [ ] Update the three constants and the comment.
- [ ] Update living docs with a dated note.
- [ ] Production build; refresh the structured-data fixture; full check.
- [ ] Reviewer pass on the diff; Tester greps the build for AC 1–5.
- [ ] Merge to `develop` and push.

Done when AC 1–6 pass and `develop` is pushed. Production (merge to `main`) stays with Saurabh.
