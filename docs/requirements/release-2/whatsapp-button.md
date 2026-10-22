# Release 2 — WhatsApp Chat Button

> **Status:** Built (22 Oct 2026). Owner request: a WhatsApp button at the lower right that opens
> a chat with the AJ Classes WhatsApp Business account. Part of [Release 2](PRP.md).

## 1. Design

| Part | What |
|---|---|
| Button | A round floating button (56px) at the lower right of every **public** page, WhatsApp green with the white WhatsApp logo. On desktop hover/focus it shows a "Chat on WhatsApp" label beside it. Not shown on `/portal` pages. |
| Link | `https://wa.me/61469800685?text=…` opens WhatsApp (app on phones, WhatsApp Web on desktop) with a short greeting already typed: "Hi AJ Classes, I'd like to know more about your classes." New tab. |
| Number | `BUSINESS.whatsappNumber` (international format, digits only). Set to the business phone, **owner to confirm it's the WhatsApp Business number**. If set to `null`, the button and footer link disappear. |
| Phones | Sits above the sticky "Register Interest" bar and clear of the iPhone home bar. |
| Footer | The same link appears under "Follow AJ Classes" (the existing WhatsApp slot). |
| Analytics | `whatsapp_click`, with no personal details. |

## 2. Stories

- **W1** As a parent on any public page, I can tap one button to start a WhatsApp chat with AJ Classes, with a greeting already typed.
- **W2** As a parent on a phone, the button never covers the "Register Interest" bar or the menu.

## 3. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | A11Y | An icon-only button has no name. | `aria-label` "Chat with AJ Classes on WhatsApp (opens WhatsApp)"; the logo is `aria-hidden`. |
| G2 | A11Y | Keyboard users must see it. | Focus ring and the same label as hover. |
| G3 | DES | Covering content or the phone bar. | Above the bar on phones (z-index under the header and open menu); 16px from the edges. |
| G4 | LEGAL | WhatsApp's brand rules. | Official logo shape and green, unaltered, used only to link to WhatsApp. |
| G5 | PRIV | Staff pages carry tokens in URLs. | Not shown on `/portal`; the link sends no page data. |
| G6 | REQ | Wrong number would send parents elsewhere. | One constant; owner to confirm before going live. |

## 4. Todo

- [x] T1 Number, message and labels in constants
- [x] T2 Button component on public pages; footer link
- [x] T3 Tests; check desktop and phone
