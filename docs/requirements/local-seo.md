# Local SEO: suburb pages, guide links and search result text

> 5 Nov 2026. Goal from the owner: appear at the top for searches like "tutoring Truganina" and
> "tutoring Tarneit". No one can promise a position, and Google decides. This work gives Google
> the pages, wording and signals it needs, honestly.

## What was built

| Item | Detail |
|---|---|
| Suburb pages | `/tutoring/:slug` for 14 suburbs. Where we teach in person: Truganina, Williams Landing, Craigieburn. Nearby: Tarneit, Point Cook, Werribee, Hoppers Crossing, Wyndham Vale, Roxburgh Park, Greenvale, Wollert, Epping, Melton, Aintree. Wording, SEO text and rules live in `constants/suburbs.constants.ts`. |
| Links to them | Footer "Tutoring near you" (every page), "Other areas" on each suburb page, and the sitemap. |
| Home description | Cut from 220 to 150 characters (Google shows about 160). Names the three suburbs. |
| Structured data | `Service` + breadcrumb on each suburb page. The home page's service area now also lists the nearby suburbs. The guide's `Article` now has `datePublished`, `dateModified` and an image. |
| Guide links | The selective entry guide (Google had crawled but not indexed it) is now linked from the home page Programmes section, and from the Interviews and SEAL pages as well as Selective Entry, and from every suburb page. |

## Honesty rules (the page may not say more than we can back up)

1. **In-person claims only for suburbs in `BUSINESS.suburbs`** (Williams Landing, Truganina, Craigieburn). Nearby suburbs say "close to", "neighbouring" or "online", never "we teach in Tarneit". A test enforces it.
2. **Every page has its own wording.** Name-swapped pages are "doorway pages" and Google ranks them down. A test checks that no two pages share a paragraph.
3. No result promises, and no unverified claims (distances, travel times, school catchments).

## Facts used, and where they come from (checked 5 Nov 2026)

- Truganina, Tarneit and Hoppers Crossing share postcode 3029: [Australia Post](https://auspost.com.au/postcode/3029).
- Tarneit borders Truganina: [Wikipedia: Truganina](https://en.wikipedia.org/wiki/Truganina).
- Roxburgh Park, Mickleham, Greenvale and Donnybrook are around Craigieburn: [Wikipedia: Craigieburn](https://en.wikipedia.org/wiki/Craigieburn,_Victoria), [Australia Post 3064](https://auspost.com.au/postcode/3064).
- Suzanne Cory High School is in Werribee: the selective entry guide (Victorian Government source).
- **Not verified, so not used:** Wyndham Vale as a neighbour of Truganina; travel times; Point Cook's exact border with Williams Landing.

## Added 5 Nov 2026 (second round)

- **Eight more suburbs** at the owner's request: Hoppers Crossing, Wyndham Vale, Roxburgh Park, Greenvale, Wollert, Epping, Melton, Aintree. "Families from Melton / Aintree already learn with us" is the owner's statement; the other six pages make no such claim.
- **Epping page does not say it borders Craigieburn.** The two sources disagreed (Craigieburn's list includes Epping, Epping's does not), so it says only that our northern classes are in Craigieburn.
- **Two new parent guides**, each fact checked against official pages twice (read, then re-checked by a second reader):
  - `/resources/naplan-for-parents`: [ACARA NAP site](https://www.nap.edu.au/naplan). Includes ACARA's own statement that students aren't expected to study for NAPLAN and that it doesn't recommend excessive preparation or coaching providers. We kept it: it is accurate, and it is why our NAPLAN advice is "steady and low-stress". Owner to approve this wording.
  - `/resources/victorian-school-scholarships`: Melbourne Grammar and Westbourne Grammar (which has a Truganina campus), from the schools' own pages. Two schools are worked examples, not a rule for all schools. Dates and the $165 fee are for Westbourne's 2028 round, as published on 5 Nov 2026. **The guide ages quickly: re-check Westbourne's dates and add the next round each year.**
- Guides link to each other, to the programme pages, the home page Programmes section and the footer.
- Home page Programmes section now lists all three guides.

## Not used, and why

- **SEAL guide:** the Department's SEAL page could not be found (the vic.gov.au address returned 404), and school leaflets alone would be second-hand. Add it when the official page is located.
- **Scholarship pages that failed to load:** PEGS and Victory Lutheran (404), Scotch (403), Wesley (DNS), Ivanhoe Grammar (PDF unreadable). Adding them would make the "what varies" section stronger.
- **VCAA's Victorian NAPLAN page** did not load; the guide uses ACARA only.

## Deferred (smallest slice first)

- Pages for Mickleham and other suburbs: add only with something real to say; thin pages hurt.
- A `/tutoring` hub page listing the areas.
- More parent guides (VCE, SEAL, John Monash Science School entry: its official facts were already gathered on 5 Nov 2026). Each needs facts checked against official sources first.

## Owner actions (need your logins; see the SEO summary)

1. Merge `develop` to `main` to publish.
2. Search Console: request indexing for the new pages (and the guide).
3. Google Business Profile: add the nearby suburbs as service areas, and check categories and the description.
4. Reviews: ask families for Google reviews (the review link is still a [TBC] in `docs/social-media/tbc-consolidated.md`).
