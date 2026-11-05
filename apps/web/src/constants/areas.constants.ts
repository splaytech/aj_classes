// Area pages at /tutoring/:slug (docs/requirements/local-seo.md): one for Melbourne's west and one
// for the north, each listing the suburbs around our classes, so a search such as "tutoring Tarneit"
// finds the suburb's name on a real page. Postcodes and neighbours come from Australia Post and
// Wikipedia (5 Nov 2026). A suburb is described as "in-person classes" only when BUSINESS.suburbs
// lists it; "families here already learn with us" is the owner's statement (Melton, Aintree).
// Everything on these pages is visible to visitors: hidden text for search engines breaks Google's
// spam rules.

import { BUSINESS } from './business.constants';
import { PROGRAMME_SLUGS } from './programmes.constants';
import { GUIDES } from './resources.constants';
import { areaPath, resourcePath } from './routes.constants';

export type AreaSuburb = {
  name: string;
  /** True only where in-person classes run (they are listed in BUSINESS.suburbs). */
  teachesHere: boolean;
  /** One short, true line about this suburb. */
  note: string;
};

export type Area = {
  slug: string;
  name: string;
  intro: string;
  localHeading: string;
  localParagraphs: readonly string[];
  suburbs: readonly AreaSuburb[];
  seo: { title: string; description: string };
};

const TEACHES = 'In-person classes';

export const AREAS: readonly Area[] = [
  {
    slug: 'melbourne-west',
    name: "Melbourne's West",
    intro:
      "Small-group tutoring in Melbourne's west for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. In person in Truganina and Williams Landing, or online from home.",
    localHeading: 'Where we teach in the west',
    localParagraphs: [
      'We teach in person in Truganina and Williams Landing, in small groups of up to 10 students, with two one-hour classes a week. Every class is led by a qualified teacher who holds a Working With Children Check.',
      "Students from across Melbourne's west can join, in person or online from home. Tell us your child's year level and we'll suggest the right small group.",
    ],
    suburbs: [
      { name: 'Truganina', teachesHere: true, note: TEACHES },
      { name: 'Williams Landing', teachesHere: true, note: TEACHES },
      { name: 'Tarneit', teachesHere: false, note: 'Borders Truganina, same postcode (3029)' },
      { name: 'Hoppers Crossing', teachesHere: false, note: 'Same postcode as Truganina (3029)' },
      {
        name: 'Point Cook',
        teachesHere: false,
        note: 'Classes in Williams Landing and Truganina, or online',
      },
      {
        name: 'Werribee',
        teachesHere: false,
        note: 'Home of Suzanne Cory High School, a selective entry school',
      },
      { name: 'Wyndham Vale', teachesHere: false, note: 'In the City of Wyndham, in the west' },
      { name: 'Melton', teachesHere: false, note: 'Families here already learn with us' },
      {
        name: 'Aintree',
        teachesHere: false,
        note: 'In the City of Melton; families here already learn with us',
      },
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
    localHeading: 'Where we teach in the north',
    localParagraphs: [
      'We teach in person in Craigieburn, in small groups of up to 10 students, with two one-hour classes a week, led by qualified teachers who each hold a Working With Children Check.',
      "Students from across Melbourne's north can join, in Craigieburn or online from home. Tell us your child's year level, and whether they are preparing for the selective entry exam, NAPLAN, ICAS or VCE, and we'll suggest the right group.",
    ],
    suburbs: [
      { name: 'Craigieburn', teachesHere: true, note: TEACHES },
      {
        name: 'Roxburgh Park',
        teachesHere: false,
        note: 'Borders Craigieburn; both are in the City of Hume',
      },
      { name: 'Greenvale', teachesHere: false, note: 'Borders Craigieburn' },
      {
        name: 'Wollert',
        teachesHere: false,
        note: 'Borders Craigieburn; in the City of Whittlesea',
      },
      {
        name: 'Epping',
        teachesHere: false,
        note: 'In the City of Whittlesea; our northern classes are in Craigieburn',
      },
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
  /** Link text in the footer and in the list of other areas. */
  linkLabel: (name: string) => `Tutoring in ${name}`,
  footerHeading: 'Tutoring near you',
  footerLabel: 'Tutoring areas',
  deliveryText: `Small groups, in person in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  cta: 'Register interest',
  suburbsHeading: 'Suburbs we serve',
  suburbsIntro: 'Families in these suburbs can join our classes:',
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
