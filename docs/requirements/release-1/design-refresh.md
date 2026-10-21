# Release 1 — Contact Form and Programmes Refresh

> **Status:** Built (21 Oct 2026). From client feedback: the contact form looked dated next to
> the rest of the site, and the Programmes cards (including NAPLAN) had uneven heights, fonts
> and spacing. Part of [Release 1](PRP.md).

## 1. Contact form

Owner direction: make it as easy as possible for anyone to send a query.

| Before | After |
|---|---|
| Name, email, how to contact you, phone, "I am a…", enquiry type, year level, message | **Name and email** (required), **phone** and **"How can we help?"** (both optional) |
| Plain stacked fields on the section background | The form sits on a raised white card (rounded corners, soft shadow), matching the contact details card beside it, which stays in view while scrolling on wide screens |
| One field per row | Email and phone share a row on wider screens |
| Default inputs | Taller inputs with a light fill; on focus they turn white with a blue outline and a soft focus ring; errors show a red outline |
| Small checkbox | Larger checkbox in the brand blue |
| Plain success line | A success card with a tick icon and the heading "Message sent" |
| Button at its natural width | Full-width button on phones |

The notification email's subject is now "[AJ Classes] Website enquiry — {name}". "Response time" no longer says "phone or email (your choice)". Unchanged: the hidden spam trap and how the form sends.

## 1a. Navigation

"Programmes" in the header has a sub-link **VCE** (to `/vce`; since replaced by a link to every programme page, see [programme-pages.md](programme-pages.md)): a small dropdown on hover or keyboard focus on desktop, indented under Programmes in the phone menu.

## 2. Programmes

| Before | After |
|---|---|
| 4 columns, so 9 cards ended with a lone card on the last row | 3 columns on desktop (3 × 3), 2 on tablets, 1 on phones |
| Card heights differed between rows | Every card is the same height on tablets and desktop (rows share one height) |
| Titles wrapped to 1–3 lines, so the points started at different heights | Titles get a fixed two-line space, so the points line up across a row |
| Tag rows and spacing varied | Same tag row, padding, title size, point size and gap in every card; a card's link sits at the bottom |

## 3. Gap review

| # | Gap | Fix |
|---|---|---|
| G1 | Equal heights on phones would add empty space. | Equal heights apply from tablet width up; phones use natural heights. |
| G3 | Colour contrast in the new input states. | Uses the existing theme colours (already AA-checked); focus ring is in addition to the border change. |
| G4 | No hard-coded colours (house rule F1.2). | All colours come from `theme.css` variables; the menu chevron is drawn with CSS borders, not an image. |
| G6 | Fewer fields means less context for the reply. | Message stays available (optional); everything else is asked when we call or email back. |
| G7 | A hover-only menu can't be reached by keyboard. | The dropdown also opens on keyboard focus (`:focus-within`). |
| G5 | A three-line title would overflow a two-line space. | The space is a minimum height, so a longer title grows the card instead of overlapping. |
