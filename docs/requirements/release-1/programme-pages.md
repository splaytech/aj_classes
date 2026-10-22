# Release 1 — Programme Pages

> **Status:** Built (21 Oct 2026). Owner request: review the programmes and academic pathways
> on melbournetutorials.com.au, cross-check with ours, merge, and give every programme its own
> page as a sub-menu item under **Programmes**. No separate "Academic pathways" menu.
> Part of [Release 1](PRP.md). Builds on [vce-page.md](vce-page.md) and [design-refresh.md](design-refresh.md).

## 1. What Melbourne Tutorials lists (reviewed 21 Oct 2026)

Used only to see which programmes exist and how they're grouped. None of their wording is copied.

| Their menu | Item | What it is (our summary) |
|---|---|---|
| Programs | Lower Primary | Grades 1–4, literacy and numeracy foundations, one class a week |
| Programs | Upper Primary | Grades 5–6, the start of Selective Entry, SEAL and scholarship preparation |
| Programs | Lower Secondary | Years 7–10, Selective Entry exam preparation, curriculum ahead of school level |
| Programs | Selective Entry Intensive | One-year intensive for current Year 7s, before the Year 8 exam |
| Programs | Scholarship Preparation | Scholarship, SEAL and accelerated program preparation for Grade 5s |
| Academic Pathways | Selective Entry Schools | The four Victorian selective entry high schools and how entry works |
| Academic Pathways | SEAL Programs | What SEAL is and how entry tests work |
| Academic Pathways | NAPLAN | What NAPLAN tests and when |
| Academic Pathways | ICAS | What ICAS is (their page still says it's run by UNSW Global; it is now run by Janison) |
| Also on their site | Academic assessments, exam preparation, skills improvement, individual support, interview and application preparation | Service pages |

## 2. Cross-check and merge

The pathway information becomes part of the matching programme page: a parent reads what the
exam or program is, then how we prepare for it. Each row is one page.

| # | Our programme (page) | Theirs it merges | Path |
|---|---|---|---|
| 1 | Selective entry exam preparation | Lower Secondary, Selective Entry Intensive, Selective Entry Schools, exam preparation | `/programmes/selective-entry` |
| 2 | Selective school and scholarship interviews | Interview and application preparation | `/programmes/interviews` |
| 3 | SEAL and scholarship preparation | Upper Primary, Scholarship Preparation, SEAL Programs | `/programmes/seal-and-scholarships` |
| 4 | NAPLAN preparation | NAPLAN | `/programmes/naplan` |
| 5 | ICAS preparation | ICAS | `/programmes/icas` |
| 6 | Maths, Science and English tutoring | Lower Primary (foundations), skills improvement | `/programmes/maths-science-english` |
| 7 | VCE tutoring | — (we offer it, they don't) | `/programmes/vce` (moved from `/vce`, not yet live) |
| 8 | VCE subject-selection counselling | — | `/programmes/vce-subject-selection` |
| 9 | UCAT and GAMSAT preparation | — | `/programmes/ucat-and-gamsat` |

**Not added (owner to decide):** these would be new offerings, so we don't claim them without
confirmation.
- Year-group programmes for Grades 1–4 (we start at Year 2, with NAPLAN, and tutoring from Year 5)
- A one-year Selective Entry intensive as a separate course
- Pages for individual (1-to-1) support, academic assessments, fees, term dates, test papers,
  an essay checker, a parent login (the portal covers this in Release 2)

## 3. Design

| Part | What |
|---|---|
| Content | One list of programmes in `programmes.constants.ts`: slug, title, year levels, card points, page intro, key facts, "about the exam" section (where there is one), "how we prepare" points, and an optional "New" badge. The home page cards, the menu and the pages all read it. |
| Pages | One page template (`routes/programme.tsx`) at `/programmes/:slug`, pre-rendered for every programme; VCE keeps its own page (subject cards) at `/programmes/vce`. Unknown slugs show the 404 page. |
| Home page | Every Programmes card ends with a "Learn more →" link to its page (screen readers hear "Learn more about {programme}"). |
| Menu | Programmes → a dropdown listing all nine (desktop), indented in the phone menu. |
| SEO | Each page has its own title and description, and is in the sitemap. |

## 4. Stories

- **P1** As a parent, I can open a page for any programme from the menu or its card, and see year levels, what it covers and how AJ Classes prepares students.
- **P2** As a parent new to Victorian schooling, I can read what the selective entry exam, SEAL, NAPLAN, ICAS, UCAT and GAMSAT are, on the programme's page.
- **P3** As a parent, I can enquire from every programme page.
- **P4** As a search engine, every programme page is pre-rendered, in the sitemap, with its own title and description.

## 5. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | LEGAL | Copying a competitor's text is a copyright risk. | All wording is ours; their site is only a list of topics. |
| G2 | LEGAL | Claiming programmes we don't run (e.g. Grades 1–4) would mislead. | Only programmes we already list; the rest is in "Not added". |
| G3 | REQ | Exam facts must be right. | Facts checked: four selective schools and Year 9 entry via a Year 8 exam; NAPLAN Years 3, 5, 7, 9 in March, run by ACARA; ICAS run by Janison; GAMSAT run by ACER. Kept general where details change yearly. |
| G4 | REQ | No result promises (consumer law). | Pages describe what we do; results stay on the home page as reported. |
| G5 | DES | Nine items make a long dropdown, and the phone menu grew taller than a phone screen. | Short titles in the menu, kept on one line; the phone menu now scrolls inside the screen. |
| G6 | DES | Duplicated text drifts apart. | One list feeds the cards, menu and pages. |
| G8 | REQ | NAPLAN and ICAS cards had two points, UCAT/GAMSAT had no year tag. | Added a third point to each (what the test covers) and the tag "Medicine and health", so all nine cards match. |
| G7 | SEO | `/vce` was pushed to `develop` (not live) and is moving. | Move now, before it goes live; nothing links to the old path outside the site. |

## 6. Todo

- [x] T1 Programme content list (all nine) with facts checked
- [x] T2 Page template and routes, VCE moved under `/programmes`, 404 for unknown slugs
- [x] T3 Home cards link to pages; menu lists all programmes
- [x] T4 Sitemap, pre-rendering, page titles and descriptions
- [x] T5 Tests: every programme has a page, card link and menu link; VCE names unchanged
- [x] T6 Check in the browser (desktop and phone), full check, commit
