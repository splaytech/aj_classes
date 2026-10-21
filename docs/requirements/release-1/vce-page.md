# Release 1 — VCE Tutoring Page

> **Status:** Built (21 Oct 2026). Owner request: a separate page about VCE tutoring and a short
> mention on the landing page, for five subjects, highlighting qualified teachers.
> Part of [Release 1](PRP.md) (public website).

## 1. Subject names (verified)

Names are the official VCAA study names, checked on the VCAA website on 21 Oct 2026. All five are
current VCE studies with scored assessment.

| Owner wrote | Official VCAA name | Learning area (VCAA) |
|---|---|---|
| Chemistry | **Chemistry** | Science |
| General Math | **General Mathematics** | Mathematics |
| Math method | **Mathematical Methods** | Mathematics |
| Psychology | **Psychology** | Science |
| Business Management | **Business Management** | Business and Economics |

Sources: [VCE study designs](https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/vce-study-designs),
[General Mathematics](https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/general-mathematics/vce-general-mathematics),
[Mathematical Methods](https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/mathematical-methods/vce-mathematical-methods),
[VCE and VET assessment summary](https://www.vcaa.vic.edu.au/administration/vce-administrative-handbook/vce-and-vet-assessment-summary).

## 2. Design

| Part | What |
|---|---|
| Page | `/vce`, pre-rendered like the Privacy page, in the sitemap, with its own title and description. |
| Page content | Heading and intro; one card per subject (official name, Units 1–4, what we cover in plain words); "Qualified VCE teachers"; "How we prepare students" (SACs, exam technique, practice under exam conditions, small groups); VCE subject-selection counselling; a Register Interest button to the home page form. |
| Landing page | A "VCE tutoring" card in Programmes (Years 11–12) naming the five subjects, with a "Learn more about VCE tutoring" link to `/vce`. |
| Text | All wording in `content.constants.ts` (`VCE_PAGE`) and `seo.constants.ts`; subject list defined once and reused by the card and the page. |

## 3. Stories

- **V1** As a parent of a Year 10–12 student, I want to see which VCE subjects AJ Classes teaches, by their official names, so I know it matches my child's subjects. *AC:* the page and the landing card list exactly the five official names.
- **V2** As a parent, I want to know who teaches VCE and how, so I can trust the classes. *AC:* the page explains the teachers' qualifications and the teaching approach without promising scores or ATARs.
- **V3** As a parent, I want to enquire straight from the VCE page. *AC:* a Register Interest button leads to the enquiry form.
- **V4** As a search engine, I can find and index the page. *AC:* pre-rendered HTML, in the sitemap, own title and description, one `h1`.

## 4. Gap Review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | REQ | Owner's names ("General Math", "Math method") differ from the official ones. | Use the official VCAA names (§1). |
| G2 | LEGAL | Promising results (scores, ATARs) could mislead (Australian Consumer Law). | Describe what we do and who teaches; no outcome promises. The site-wide disclaimer applies. |
| G3 | REQ | Teacher claims must be true. | Reuse the existing confirmed fact (qualified teachers, 20+ years combined experience, Working With Children Checks); no names or unconfirmed credentials. Owner to review the wording. |
| G4 | DES | Study designs change over time. | Describe content at a high level (Units 1–4 areas), not unit-by-unit outcomes; link to VCAA. |
| G5 | SEO | A page nobody links to isn't found. | Landing page card links to it; sitemap entry. |
| G6 | A11Y | Card links must say where they go. | "Learn more about VCE tutoring", not "Learn more". |
