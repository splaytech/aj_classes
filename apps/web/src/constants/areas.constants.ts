// Area pages at /tutoring/:slug (docs/requirements/local-seo.md): one for Melbourne's west and one
// for the north, each listing the suburbs around our classes, so a search such as "tutoring Tarneit"
// finds the suburb's name on a real page. The suburbs are listed as hashtags linking to Google Maps,
// with no descriptions (owner's choice, 5 Nov 2026); `teachesHere` marks the three where classes run
// (BUSINESS.suburbs). Everything on these pages is visible to visitors: hidden text for search
// engines breaks Google's spam rules.

import { PROGRAMME_SLUGS } from './programmes.constants';
import { GUIDES } from './resources.constants';
import { areaPath, resourcePath } from './routes.constants';

export type AreaSuburb = {
  name: string;
  /** True only where in-person classes run (they are listed in BUSINESS.suburbs). */
  teachesHere: boolean;
};

export type Area = {
  slug: string;
  name: string;
  intro: string;
  suburbs: readonly AreaSuburb[];
  seo: { title: string; description: string };
};

export const AREAS: readonly Area[] = [
  {
    slug: 'melbourne-west',
    name: "Melbourne's West",
    intro:
      "Small-group tutoring in Melbourne's west for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. In person in Truganina and Williams Landing, or online from home.",
    suburbs: [
      { name: 'Truganina', teachesHere: true },
      { name: 'Williams Landing', teachesHere: true },
      { name: 'Tarneit', teachesHere: false },
      { name: 'Hoppers Crossing', teachesHere: false },
      { name: 'Point Cook', teachesHere: false },
      { name: 'Werribee', teachesHere: false },
      { name: 'Wyndham Vale', teachesHere: false },
      { name: 'Melton', teachesHere: false },
      { name: 'Aintree', teachesHere: false },
    ],
    seo: {
      title: "Tutoring in Truganina & Melbourne's West | AJ Classes",
      description:
        'Small-group tutoring for Truganina, Williams Landing, Tarneit, Point Cook, Werribee, Melton and more: selective entry, NAPLAN, ICAS and VCE. Online too.',
    },
  },
  {
    slug: 'melbourne-north',
    name: "Melbourne's North",
    intro:
      "Small-group tutoring in Melbourne's north for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. In person in Craigieburn, or online from home.",
    suburbs: [
      { name: 'Craigieburn', teachesHere: true },
      { name: 'Roxburgh Park', teachesHere: false },
      { name: 'Greenvale', teachesHere: false },
      { name: 'Wollert', teachesHere: false },
      { name: 'Epping', teachesHere: false },
    ],
    seo: {
      title: "Tutoring in Craigieburn & Melbourne's North | AJ Classes",
      description:
        'Small-group tutoring for Craigieburn, Roxburgh Park, Greenvale, Wollert and Epping: selective entry, NAPLAN, ICAS and VCE. In person or online.',
    },
  },
];

/** Paths of every area page, for the sitemap and pre-rendering. */
export const AREA_PATHS = AREAS.map((area) => areaPath(area.slug));

export function findArea(slug: string | undefined): Area | undefined {
  return AREAS.find((area) => area.slug === slug);
}

/** Suburbs we serve without teaching in person there, for the structured data's service area. */
export const NEARBY_SUBURB_NAMES = AREAS.flatMap((area) => area.suburbs)
  .filter((suburb) => !suburb.teachesHere)
  .map((suburb) => suburb.name);

/**
 * Addresses of the per-suburb pages we first published on 5 Nov 2026 and then folded into the two
 * area pages. Each one redirects to its area (vercel.json and serve.railway.json; a test checks).
 */
export const LEGACY_SUBURB_REDIRECTS: Readonly<Record<string, string>> = {
  truganina: 'melbourne-west',
  tarneit: 'melbourne-west',
  'williams-landing': 'melbourne-west',
  'point-cook': 'melbourne-west',
  werribee: 'melbourne-west',
  'hoppers-crossing': 'melbourne-west',
  'wyndham-vale': 'melbourne-west',
  melton: 'melbourne-west',
  aintree: 'melbourne-west',
  craigieburn: 'melbourne-north',
  'roxburgh-park': 'melbourne-north',
  greenvale: 'melbourne-north',
  wollert: 'melbourne-north',
  epping: 'melbourne-north',
};

const SELECTIVE_GUIDE = GUIDES.find((guide) => guide.programme === PROGRAMME_SLUGS.selectiveEntry);

// Labels shared by every area page.
export const AREA_PAGE = {
  title: (name: string) => `Tutoring in ${name}`,
  footerHeading: 'Tutoring near you',
  footerLabel: 'Tutoring areas',
  cta: 'Register interest',
  suburbsHeading: 'Suburbs we serve',
  /** "Williams Landing" -> "#WilliamsLanding". Visible text, like a social post. */
  hashtag: (name: string) => `#${name.replace(/\s+/g, '')}`,
  /** The state and country pick the right place: there is also an Epping in Sydney. */
  mapsUrl: (name: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} VIC Australia`)}`,
  programmesHeading: 'What we teach',
  programmeLine: (title: string, years: string) => `${title} (${years})`,
  howHeading: 'How our classes work',
  howPoints: [
    'Small groups of up to 10 students in person',
    'Two one-hour classes a week',
    'The same small-group format online',
    'Qualified teachers, each with a Working With Children Check',
  ],
  guideHeading: 'New to the selective entry exam?',
  guideText: 'Our plain-English parent guide explains how the exam and places work.',
  guideLinkLabel: 'Read the parent guide',
  guidePath: SELECTIVE_GUIDE ? resourcePath(SELECTIVE_GUIDE.slug) : null,
  otherHeading: 'Our other area',
  backHome: '← Back to home',
} as const;
