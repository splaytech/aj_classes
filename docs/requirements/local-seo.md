# Local SEO: suburb pages, guide links and search result text

> 5 Nov 2026. Goal from the owner: appear at the top for searches like "tutoring Truganina" and
> "tutoring Tarneit". No one can promise a position, and Google decides. This work gives Google
> the pages, wording and signals it needs, honestly.

## What was built

| Item | Detail |
|---|---|
| Area pages | `/tutoring/melbourne-west` and `/tutoring/melbourne-north`, each with a visible list of the suburbs it covers. Wording and rules live in `constants/areas.constants.ts`. (First built as 14 separate suburb pages; see "Change of plan".) |
| Links to them | Footer "Tutoring near you" (two links, every page), "Our other area" on each page, and the sitemap. |
| Home description | Cut from 220 to 150 characters (Google shows about 160). Names the three suburbs. |
| Structured data | `Service` + breadcrumb on each area page, listing every suburb it covers. The home page's service area now also lists the nearby suburbs. The guide's `Article` now has `datePublished`, `dateModified` and an image. |
| Guide links | The selective entry guide (Google had crawled but not indexed it) is now linked from the home page Programmes section, and from the Interviews and SEAL pages as well as Selective Entry, and from both area pages. |

## Honesty rules (the page may not say more than we can back up)

1. **In-person claims only for suburbs in `BUSINESS.suburbs`** (Williams Landing, Truganina, Craigieburn). Nearby suburbs say "close to", "neighbouring" or "online", never "we teach in Tarneit". A test enforces it.
2. **Every note and paragraph is different.** Name-swapped copy is a "doorway" pattern Google ranks down. A test checks that no two suburb notes or paragraphs match.
3. **Everything is visible to visitors.** No hidden text, no text hidden with CSS, no crawler-only content: Google's spam policy treats that as a violation and can demote the whole site, including the #1 spot for "AJ Classes". The legitimate place for "extra for search engines" is structured data (`areaServed`), which lists every suburb.
4. No result promises, and no unverified claims (distances, travel times, school catchments).

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

## Round 3 (13 Nov 2026): centre pages for "tutoring in {suburb}"

Owner's goal: appear at the top when someone searches "tutoring in {suburb}". He asked the team to
decide and not ask, except for logins.

**Audit (Google, 13 Nov 2026, `pws=0`, signed in as the AJ Classes Tech account):** AJ Classes was
not in the top 30 for "tutoring in truganina", nor on page 1 for "tutoring in williams landing" or
"tutoring in craigieburn". Every page-1 result was one of three things: a map-pack listing with an
address in that suburb and many reviews (Aspire Academics 119, Right Steps 69, Hunar 108); a page
built for exactly "Tutoring in <Suburb>" (title, heading and address); or a directory (Yellow Pages,
HighSchoolTutors, Superprof). Google still listed our old `/tutoring/truganina` page by name, even
though it now redirected: the suburb page was already working. In Google Maps itself (not the Search map pack) AJ Classes was 3rd for "tutoring truganina", shown as "Tutoring service" with 5.0 from 14 reviews; the Search pack shows only 3, so the profile is close (signed-in result, so treat as indicative).

**Built (`feature/seo-centre-pages`):**

| Item | Detail |
|---|---|
| Centre pages | `/tutoring/truganina`, `/tutoring/williams-landing`, `/tutoring/craigieburn`: one per suburb in `BUSINESS.suburbs`, about 560 words each. Title and heading lead with "Tutoring in <Suburb>". Own paragraphs, neighbouring suburbs, three helpful links, four questions, a Google reviews link, the programmes, and links to the other centres and the area page. `CENTRES` in `areas.constants.ts`. |
| Redirects | The three addresses no longer redirect (`vercel.json`, `serve.railway.json`); the other 11 still do. |
| Links to them | Each programme page's "Small groups, in person in …" line now links the three names (`CentreLinks`), and the area pages' centre hashtags open the centre page instead of Google Maps. The footer keeps its two area links (owner's tidy-footer choice stands). |
| Area titles | No longer lead with a centre suburb, so they don't compete with the centre pages, and say "near" for a suburb we don't teach in: "Tutoring in Melbourne's West, near Tarneit", "Tutoring in Melbourne's North". The west description now leads with the nearby suburbs. |
| Wording rules | The site never says "centre" to visitors (it would imply a venue): "the suburbs where we teach". Each centre page's opening, description, paragraphs and answers are its own: a test compares every pair across pages by 4-word runs (must share under half), and another bans in-person claims for every neighbouring suburb plus distance, travel-time and results words. Both were checked by breaking the copy on purpose. |
| Structured data | Each centre page: `Service` with the centre and its neighbours as `areaServed`, breadcrumb Home › area › centre. Sitemap 19 → 22 pages. |

**Why this goes against the 5 Nov fold, and why only three:** the fold note said "if a suburb matters a
lot, give it its own page again". The three centre suburbs are where we teach, so their pages can say
true, specific things; pages for suburbs we don't teach in would be thin and are what the fold removed.

**Facts used (checked 13 Nov 2026):** Wikipedia infoboxes: Truganina borders Tarneit, Hoppers Crossing,
Williams Landing, Derrimut, Laverton North, postcode 3029; Williams Landing 3027, City of Wyndham,
borders Truganina (north), Point Cook (south), Hoppers Crossing, Laverton, Seabrook, has a railway
station; Craigieburn 3064, City of Hume, neighbours Roxburgh Park, Greenvale, Mickleham, Wollert,
Donnybrook, Kalkallo. Epping is still not described as a neighbour (sources disagree, see above).
Westbourne's Truganina campus and Suzanne Cory High School come from our own checked guides. Class
facts (up to 10, twice a week, WWCC, reply within 3 business days) come from the site FAQ.

**Not done by the website (needs the owner, see the session summary):** Search Console access (neither
signed-in Google account can see the property on 13 Nov), Google Business Profile work (reviews,
replies, photos, posts, services), and directory listings (Yellow Pages, True Local, Hotfrog, Bing
Places). For "tutoring in {suburb}" the map pack sits above every web result, and it ranks on the
Business Profile, mainly reviews and distance to the searcher, so that work matters as much as the pages.

## Change of plan (5 Nov 2026, later): 14 suburb pages became 2 area pages

The owner found 14 suburb pages too much for the site (the footer listed all of them) and asked for one page for Melbourne's west and one for the north, with the surrounding suburbs listed on them.

- **Now:** `/tutoring/melbourne-west` (Truganina, Williams Landing, Tarneit, Hoppers Crossing, Point Cook, Werribee, Wyndham Vale, Melton, Aintree) and `/tutoring/melbourne-north` (Craigieburn, Roxburgh Park, Greenvale, Wollert, Epping). The suburbs show as one line of plain hashtags (`#Truganina #WilliamsLanding`), with no descriptions and no separate "where we teach" section (owner's choice: the intro already says where classes run). `teachesHere` still marks the three centre suburbs, and a test keeps it equal to `BUSINESS.suburbs`.
- **Hashtag trade-off:** a multi-word suburb written as one word (`#WilliamsLanding`) matches a search for "Williams Landing" less well than the spaced name. The structured data (`areaServed`) keeps the proper spaced names, and the intro names Truganina and Williams Landing in words.
- **Old addresses redirect for good** (`/tutoring/truganina`, `/tutoring/tarneit` and the other 12) to the right area, in `vercel.json` and `serve.railway.json`. Truganina and Tarneit had already been submitted to Google, so the redirects pass that on. A test checks all 14.
- **Trade-off:** one page per suburb ranks better for that suburb's own name than a list on a regional page. We accepted a weaker position for the small suburbs in return for a tidier site. If a suburb matters a lot, give it its own page again.
- **Declined: crawler-only hidden text** (suburbs in text visitors can't see). It breaks Google's spam rules. The visible list on each area page does the same job.
- **After going live:** re-submit `sitemap.xml` (19 pages, was 31) in Search Console and request indexing for the two area pages.
- **Owner's review, same day:** the footer links now say just "Melbourne's West" and "Melbourne's North" under "Tutoring near you" (the page's own heading keeps "Tutoring in"). The line naming all three centres came off the area pages, because Craigieburn on the west page confused the two areas; the intro already says where each area's classes run. The suburbs moved to second from the bottom, in smaller text, and each hashtag now opens that suburb in Google Maps.

