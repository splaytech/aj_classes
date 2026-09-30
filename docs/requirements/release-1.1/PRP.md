# PRP — Release 1.1: Calendar, Events and News & Updates

> **Status:** Draft, scoped and ready to elaborate once content arrives
> **Timeline:** 1–2 weeks after Release 1 goes live (about 1 day of build work)
> **Depends on:** [Release 1](../release-1/PRP.md) (static site, content model, pre-rendering, SEO)
> **Next release:** [Release 2](../release-2/PRP.md)

---

## 1. Objective

Keep the site feeling **active and current** (a key strength of melbournetutorials.com.au) by adding dated content: term dates, upcoming events, and short news updates. This gives parents reasons to come back and gives Google fresh, indexable pages.

**Still static, with no backend.** Content lives in files in the repo. Adding an event or news post is an edit plus `git push`, and it is live in about a minute. The content moves to Supabase with an Admin UI in Release 2 only if non-developers need to edit it.

## 2. Scope

| # | Feature | Where it appears |
|---|---|---|
| F1 | **Calendar (Term Dates)** | Homepage section (compact 4-term grid) + `/term-dates` page |
| F2 | **Events** | Homepage section (next 1–3 upcoming events) + `/events` page |
| F3 | **News & Updates** | Homepage section (latest 3 items) + `/news` list + `/news/<slug>` pages |
| F4 | Header nav update | Add **"What's On"** (or "News & Events"), keeping to at most 6 nav items + 1 CTA |

**Out of scope:** online event registration/RSVP (use the Register Interest form or an external link), comments, an RSS/email digest (R2 with the subscriber list), and Admin UI editing (R2).

## 3. Functional Requirements

### F1 — Calendar (Term Dates)

| ID | Requirement |
|---|---|
| F1.1 | Data in `src/content/calendar.ts`: `{ year, terms: [{ name, start, end, note? }] }`. |
| F1.2 | Homepage: 4 cards in a row on desktop, 2×2 on mobile. Each shows the term name and date range (e.g. "Term 1 · 2 Feb – 5 Apr"). The **current term is highlighted**. |
| F1.3 | Optional list of key dates (e.g. selective exam date, holiday classes) under the grid. |
| F1.4 | Dates are shown in Australian format (`d MMM`), with `<time datetime="…">` markup. |
| F1.5 | Once the year is over, the section shows next year's dates if provided; otherwise it is hidden. |

### F2 — Events

| ID | Requirement |
|---|---|
| F2.1 | Data in `src/content/events.ts`: `{ slug, title, date, startTime, endTime?, venueName, suburb, address?, online?, description, image?, ctaLabel?, ctaUrl? }`. |
| F2.2 | Homepage shows the **next 1–3 upcoming** events as cards: a date badge, title, venue, suburb and time. Past events are filtered out **at build time**. A daily scheduled Vercel redeploy (deploy hook + cron) keeps this correct without manual edits. |
| F2.3 | `/events` page: upcoming events, then a collapsed "Past events" list. |
| F2.4 | **"Add to calendar"** link on each event (a generated `.ics` file). |
| F2.5 | **SEO:** each event has `Event` JSON-LD (name, startDate, endDate, location / VirtualLocation, organizer = AJ Classes, eventStatus, eventAttendanceMode), so it can show up in Google's event listings. |
| F2.6 | No upcoming events means the homepage section is hidden. |

### F3 — News & Updates

| ID | Requirement |
|---|---|
| F3.1 | Posts are Markdown files in `src/content/news/*.md` with frontmatter: `title, date, summary, image?, tags?`. |
| F3.2 | Homepage shows the latest 3 posts as cards (date, title, 1–2 line summary, "Read more"). |
| F3.3 | `/news` lists all posts, newest first. `/news/<slug>` shows the full post, pre-rendered, with its own title, meta description, canonical, OG image and `NewsArticle` (or `BlogPosting`) JSON-LD. |
| F3.4 | Short updates are fine (e.g. "Term 4 groups now open"). Posts don't need to be long articles. |
| F3.5 | All news and event pages are added to `sitemap.xml` automatically at build. |
| F3.6 | Readability rules from R1 apply (F2.3 in R1): max ~70ch line length, 18px body, clear headings. |

### F4 — Navigation

| ID | Requirement |
|---|---|
| F4.1 | Add one nav item, **"What's On"**, which links to a combined section or page with Events and News. The nav keeps to 6 items + the "Register Interest" CTA. |
| F4.2 | The footer gets links to Term Dates, Events and News. |

## 4. Acceptance Criteria

- [ ] Adding an event file and pushing shows it on the homepage and `/events` within 2 minutes.
- [ ] An event whose date has passed disappears from the homepage within 24 hours with no manual action.
- [ ] The Rich Results Test detects `Event` markup on `/events` with no errors, and `NewsArticle` markup on a news post.
- [ ] The homepage stays within the R1 length budget (≤ ~6 screen heights on desktop). The new sections are compact previews that link out to full pages.
- [ ] With no events or news content, those sections and their nav link are hidden.

---

## Appendix — Content Placeholders

> **Owner to fill in.** Replace every `‹TBD›`.

### Calendar: Term Dates ‹Year TBD›

| Term | Start | End | Note |
|---|---|---|---|
| Term 1 | ‹TBD› | ‹TBD› | ‹TBD› |
| Term 2 | ‹TBD› | ‹TBD› | ‹TBD› |
| Term 3 | ‹TBD› | ‹TBD› | ‹TBD› |
| Term 4 | ‹TBD› | ‹TBD› | ‹TBD› |

**Key dates (optional):** ‹TBD› (e.g. selective entry exam date, holiday intensive dates)

### Events

| Title | Date | Time | Venue | Suburb | Online? | Description (≤ 50 words) | CTA |
|---|---|---|---|---|---|---|---|
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |

### News & Updates

| Title | Date | Summary (1–2 lines) | Full text | Image |
|---|---|---|---|---|
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
