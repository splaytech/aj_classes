// Suburb pages at /tutoring/:slug (docs/requirements/local-seo.md). Each page answers one local
// search such as "tutoring Tarneit". Every suburb has its own wording; only facts we have checked
// go in (postcodes and neighbours from Australia Post and Wikipedia, 5 Nov 2026). A page never says
// we teach in person in a suburb unless BUSINESS.suburbs lists it.

import { BUSINESS } from './business.constants';
import { PROGRAMME_SLUGS } from './programmes.constants';
import { GUIDES } from './resources.constants';
import { resourcePath, suburbPath } from './routes.constants';

export type Suburb = {
  slug: string;
  name: string;
  /** True only where in-person classes run (they are listed in BUSINESS.suburbs). */
  teachesHere: boolean;
  intro: string;
  localHeading: string;
  localParagraphs: readonly string[];
  seo: { title: string; description: string };
};

const seoTitle = (name: string) => `Tutoring in ${name}, Melbourne | AJ Classes`;

export const SUBURBS: readonly Suburb[] = [
  {
    slug: 'truganina',
    name: 'Truganina',
    teachesHere: true,
    intro:
      'Small-group tutoring in Truganina for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE.',
    localHeading: 'Classes in Truganina',
    localParagraphs: [
      'We teach in person in Truganina in small groups of up to 10 students, with two one-hour classes a week. Every class is led by a qualified teacher who holds a Working With Children Check.',
      'Truganina shares its postcode (3029) with Tarneit and Hoppers Crossing, so families in those suburbs are close by too. Prefer to learn from home? The same small-group classes run online.',
    ],
    seo: {
      title: seoTitle('Truganina'),
      description:
        'Small-group tutoring in Truganina for Years 2–12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science, English and VCE. Online too.',
    },
  },
  {
    slug: 'tarneit',
    name: 'Tarneit',
    teachesHere: false,
    intro:
      'Looking for tutoring in Tarneit? Our small-group classes run in neighbouring Truganina and in Williams Landing, and online anywhere in Australia, for students in Years 2 to 12.',
    localHeading: 'Tutoring close to Tarneit',
    localParagraphs: [
      'Tarneit borders Truganina, where we teach in person in small groups of up to 10 students. We also teach in Williams Landing, and our classes run online for families who would rather learn from home.',
      "Tarneit and Truganina share postcode 3029. If your child is preparing for the selective entry exam, NAPLAN, ICAS or VCE, tell us their year level and we'll suggest the right small group.",
    ],
    seo: {
      title: seoTitle('Tarneit'),
      description:
        'Tutoring for Tarneit students: small-group selective entry exam, NAPLAN, ICAS and VCE classes in neighbouring Truganina and Williams Landing, or online.',
    },
  },
  {
    slug: 'williams-landing',
    name: 'Williams Landing',
    teachesHere: true,
    intro:
      'Small-group tutoring in Williams Landing for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE.',
    localHeading: 'Classes in Williams Landing',
    localParagraphs: [
      'We teach in person in Williams Landing in small groups of up to 10 students, with two one-hour classes a week, led by qualified teachers who each hold a Working With Children Check.',
      'Our other in-person classes are in Truganina and Craigieburn, and the same small-group classes run online anywhere in Australia.',
    ],
    seo: {
      title: seoTitle('Williams Landing'),
      description:
        'Small-group tutoring in Williams Landing for Years 2–12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science, English and VCE.',
    },
  },
  {
    slug: 'craigieburn',
    name: 'Craigieburn',
    teachesHere: true,
    intro:
      'Small-group tutoring in Craigieburn for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE.',
    localHeading: 'Classes in Craigieburn',
    localParagraphs: [
      'We teach in person in Craigieburn in small groups of up to 10 students, with two one-hour classes a week, led by qualified teachers who each hold a Working With Children Check.',
      'Roxburgh Park, Mickleham, Greenvale and Donnybrook are all close to Craigieburn. Families there can join our Craigieburn classes, or learn online with the same small-group format.',
    ],
    seo: {
      title: seoTitle('Craigieburn'),
      description:
        'Small-group tutoring in Craigieburn for Years 2–12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science, English and VCE. Online too.',
    },
  },
  {
    slug: 'point-cook',
    name: 'Point Cook',
    teachesHere: false,
    intro:
      'Looking for tutoring in Point Cook? Our small-group classes run in Williams Landing and Truganina, and online from home, for students in Years 2 to 12.',
    localHeading: 'Tutoring for Point Cook families',
    localParagraphs: [
      "Our in-person classes are in Williams Landing and Truganina, in Melbourne's west, in small groups of up to 10 students. Point Cook students can also join online and learn from home with the same small-group format.",
      "We help students from Year 2 to Year 12, from NAPLAN and ICAS through the selective entry exam and interviews to VCE. Tell us your child's year level and we'll suggest the right group.",
    ],
    seo: {
      title: seoTitle('Point Cook'),
      description:
        'Tutoring for Point Cook students: small-group selective entry exam, NAPLAN, ICAS and VCE classes in Williams Landing and Truganina, or online from home.',
    },
  },
  {
    slug: 'werribee',
    name: 'Werribee',
    teachesHere: false,
    intro:
      'Looking for tutoring in Werribee? Our small-group classes include selective entry exam and interview coaching, in Williams Landing and Truganina or online from home, for students in Years 2 to 12.',
    localHeading: 'Tutoring for Werribee families',
    localParagraphs: [
      "Werribee is home to Suzanne Cory High School, one of Victoria's four selective entry high schools. If your child is thinking about it, we run selective entry exam preparation and interview coaching in small groups.",
      'Our in-person classes are in Williams Landing and Truganina, and the same small-group classes run online, so Werribee students can learn from home.',
    ],
    seo: {
      title: seoTitle('Werribee'),
      description:
        'Tutoring for Werribee students: selective entry exam and interview coaching in small groups in Williams Landing and Truganina, or online from home.',
    },
  },
];

/** Paths of every suburb page, for the sitemap and pre-rendering. */
export const SUBURB_PATHS = SUBURBS.map((suburb) => suburbPath(suburb.slug));

export function findSuburb(slug: string | undefined): Suburb | undefined {
  return SUBURBS.find((suburb) => suburb.slug === slug);
}

/** Suburbs we serve without teaching in person there, for the structured data's service area. */
export const NEARBY_SUBURB_NAMES = SUBURBS.filter((suburb) => !suburb.teachesHere).map(
  (suburb) => suburb.name,
);

const SELECTIVE_GUIDE = GUIDES.find((guide) => guide.programme === PROGRAMME_SLUGS.selectiveEntry);

// Labels shared by every suburb page.
export const SUBURB_PAGE = {
  title: (name: string) => `Tutoring in ${name}`,
  /** Link text in the footer and in the list of other areas. */
  linkLabel: (name: string) => `Tutoring in ${name}`,
  footerHeading: 'Tutoring near you',
  footerLabel: 'Tutoring areas',
  deliveryText: `Small groups, in person in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  cta: 'Register interest',
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
  otherHeading: 'Other areas',
  backHome: '← Back to home',
} as const;
