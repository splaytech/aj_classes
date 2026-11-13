// Area pages at /tutoring/:slug (docs/requirements/local-seo.md): one for Melbourne's west and one
// for the north, each listing the suburbs around our classes, so a search such as "tutoring Tarneit"
// finds the suburb's name on a real page. The suburbs are listed as hashtags linking to Google Maps,
// with no descriptions (owner's choice, 5 Nov 2026); `teachesHere` marks the three where classes run
// (BUSINESS.suburbs). Everything on these pages is visible to visitors: hidden text for search
// engines breaks Google's spam rules.

import { PROGRAMME_SLUGS } from './programmes.constants';
import type { ProgrammeSlug } from './programmes.constants';
import { GUIDES } from './resources.constants';
import { areaPath, programmePath, resourcePath } from './routes.constants';

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
      // Leads with a nearby suburb, not a centre: "Truganina" here competed with its own page.
      title: "Tutoring in Melbourne's West & Tarneit | AJ Classes",
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
      title: "Tutoring in Melbourne's North & Roxburgh Park | AJ Classes",
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
 * Truganina, Williams Landing and Craigieburn are not here: they are centre pages again (CENTRES).
 */
export const LEGACY_SUBURB_REDIRECTS: Readonly<Record<string, string>> = {
  tarneit: 'melbourne-west',
  'point-cook': 'melbourne-west',
  werribee: 'melbourne-west',
  'hoppers-crossing': 'melbourne-west',
  'wyndham-vale': 'melbourne-west',
  melton: 'melbourne-west',
  aintree: 'melbourne-west',
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

// Centre pages, also at /tutoring/:slug: one for each suburb where in-person classes run
// (BUSINESS.suburbs), so a search for "tutoring in Truganina" finds a page about exactly that
// (local-seo.md, 13 Nov 2026). Each page has its own paragraphs and answers (a test checks; name-swapped
// copy is a doorway pattern). Facts: postcodes, councils and neighbouring suburbs from each suburb's
// Wikipedia infobox and Australia Post (checked 13 Nov 2026); Westbourne's Truganina campus and
// Suzanne Cory High School from our own parent guides. No result, distance or venue claims.

export type CentreLink = { label: string; href: string };
export type CentreQuestion = { question: string; answer: string };

export type Centre = {
  slug: string;
  name: string;
  areaSlug: string;
  intro: string;
  localHeading: string;
  localParagraphs: readonly string[];
  /** Neighbouring suburbs, named in the page and in the structured data's service area. */
  nearby: readonly string[];
  links: readonly CentreLink[];
  questions: readonly CentreQuestion[];
  seo: { title: string; description: string };
};

function guidePathFor(programme: ProgrammeSlug): string {
  const guide = GUIDES.find((item) => item.programme === programme);
  if (!guide) throw new Error(`No parent guide for ${programme}`);
  return resourcePath(guide.slug);
}

export const CENTRES: readonly Centre[] = [
  {
    slug: 'truganina',
    name: 'Truganina',
    areaSlug: 'melbourne-west',
    intro:
      'Small-group tutoring in Truganina for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. Taught in person in Truganina by qualified teachers, or live online.',
    localHeading: 'Classes in Truganina',
    localParagraphs: [
      'Our Truganina classes are small groups of up to 10 students, with two one-hour classes a week. Every class is live and led by a qualified teacher who holds a Working With Children Check.',
      'Truganina borders Tarneit, Hoppers Crossing, Williams Landing and Derrimut, and shares postcode 3029 with Tarneit and Hoppers Crossing, so families in those suburbs are close by. We also teach in neighbouring Williams Landing.',
      'Westbourne Grammar School has a campus in Truganina. If your child is aiming for a scholarship there or at another private school, our parent guide explains how scholarship rounds work.',
    ],
    nearby: ['Tarneit', 'Hoppers Crossing', 'Williams Landing', 'Derrimut', 'Laverton North'],
    links: [
      {
        label: 'Private school scholarships: a guide for parents',
        href: guidePathFor(PROGRAMME_SLUGS.sealAndScholarships),
      },
      {
        label: 'SEAL and scholarship exam preparation',
        href: programmePath(PROGRAMME_SLUGS.sealAndScholarships),
      },
      {
        label: 'Selective entry exam preparation',
        href: programmePath(PROGRAMME_SLUGS.selectiveEntry),
      },
    ],
    questions: [
      {
        question: 'Do you teach in person in Truganina?',
        answer:
          'Yes. Truganina is one of our three in-person centres, with Williams Landing and Craigieburn. We run live online classes too.',
      },
      {
        question: 'Can students from Tarneit or Hoppers Crossing join the Truganina classes?',
        answer:
          'Yes. Both suburbs share Truganina’s postcode, 3029. Students can join our Truganina classes, or learn from home in an online group.',
      },
      {
        question: 'Which year levels do you teach?',
        answer:
          'NAPLAN preparation starts in Year 2 and selective entry exam preparation in Year 6. Maths, Science and English run from Year 5 to Year 10, and we teach VCE as well. Tell us your child’s year level and we’ll suggest the right group.',
      },
      {
        question: 'How do I book a place in Truganina?',
        answer:
          'Register your interest with the form on our home page. We’ll reply within 3 business days to book an initial assessment and share fees, term dates and the timetable.',
      },
    ],
    seo: {
      title: 'Tutoring in Truganina: Selective Entry & VCE | AJ Classes',
      description:
        'Small-group tutoring in Truganina, Years 2–12: selective entry exam and interviews, NAPLAN, ICAS, Maths, Science, English and VCE. Online too.',
    },
  },
  {
    slug: 'williams-landing',
    name: 'Williams Landing',
    areaSlug: 'melbourne-west',
    intro:
      'Small-group tutoring in Williams Landing for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. In person in Williams Landing, or live online from home.',
    localHeading: 'Classes in Williams Landing',
    localParagraphs: [
      'In Williams Landing we teach small groups of up to 10 students, twice a week for an hour. Our teachers are qualified, and each holds a current Working With Children Check.',
      'Williams Landing (postcode 3027) borders Truganina, Point Cook, Hoppers Crossing and Laverton, and has its own railway station. Families in those suburbs can choose our Williams Landing classes or our Truganina classes just to the north.',
      'Suzanne Cory High School in Werribee is one of Victoria’s four selective entry high schools. Our selective entry programme prepares students for the exam, and our parent guide explains how the exam and places work.',
    ],
    nearby: [
      'Truganina',
      'Point Cook',
      'Hoppers Crossing',
      'Laverton',
      'Laverton North',
      'Seabrook',
    ],
    links: [
      {
        label: 'The Victorian selective entry exam: a guide for parents',
        href: guidePathFor(PROGRAMME_SLUGS.selectiveEntry),
      },
      {
        label: 'Selective entry exam preparation',
        href: programmePath(PROGRAMME_SLUGS.selectiveEntry),
      },
      {
        label: 'Selective school and scholarship interviews',
        href: programmePath(PROGRAMME_SLUGS.interviews),
      },
    ],
    questions: [
      {
        question: 'Where are your classes near Williams Landing?',
        answer:
          'We teach in person in Williams Landing itself and in Truganina, next door. Our third centre is in Craigieburn, in Melbourne’s north, and our classes also run online.',
      },
      {
        question: 'Can Point Cook students join the Williams Landing classes?',
        answer:
          'Yes. Point Cook borders Williams Landing to the south. Students can join our Williams Landing classes, or an online group if learning from home suits them better.',
      },
      {
        question: 'Do you prepare students for the selective entry exam?',
        answer:
          'Yes. Students sit the exam in Year 8 for a Year 9 place, and our preparation starts from Year 6. We cover reading, writing, mathematics, and verbal and quantitative reasoning, and we coach for interviews too.',
      },
      {
        question: 'How do I enrol in Williams Landing?',
        answer:
          'Send us your details with the form on our home page. Within 3 business days we’ll be in touch to arrange an initial assessment and explain fees and the timetable.',
      },
    ],
    seo: {
      title: 'Tutoring in Williams Landing: Selective & VCE | AJ Classes',
      description:
        'Small-group tutoring in Williams Landing, Years 2–12: selective entry and interviews, NAPLAN, ICAS, Maths, Science, English and VCE. In person or online.',
    },
  },
  {
    slug: 'craigieburn',
    name: 'Craigieburn',
    areaSlug: 'melbourne-north',
    intro:
      'Small-group tutoring in Craigieburn for students in Years 2 to 12: selective entry exam and interview coaching, NAPLAN, ICAS, Maths, Science and English, and VCE. Our in-person centre in Melbourne’s north, with live online classes too.',
    localHeading: 'Classes in Craigieburn',
    localParagraphs: [
      'Craigieburn is our centre in Melbourne’s north. Classes are small groups of up to 10 students, two one-hour classes a week, each led by a qualified teacher with a Working With Children Check.',
      'Craigieburn (postcode 3064, City of Hume) is surrounded by Roxburgh Park, Greenvale, Mickleham, Wollert and Donnybrook. Students from those suburbs can join our Craigieburn classes, or learn online in the same small-group format.',
      'Getting ready for NAPLAN? Our plain-English guide for parents explains what the tests cover and how to prepare without stress, and our NAPLAN classes start in Year 2.',
    ],
    nearby: ['Roxburgh Park', 'Greenvale', 'Mickleham', 'Wollert', 'Donnybrook', 'Kalkallo'],
    links: [
      { label: 'NAPLAN: a guide for parents', href: guidePathFor(PROGRAMME_SLUGS.naplan) },
      { label: 'NAPLAN preparation', href: programmePath(PROGRAMME_SLUGS.naplan) },
      {
        label: 'Maths, Science and English tutoring',
        href: programmePath(PROGRAMME_SLUGS.mathsScienceEnglish),
      },
    ],
    questions: [
      {
        question: 'Do you have classes in Craigieburn?',
        answer:
          'Yes. Craigieburn is our in-person centre in Melbourne’s north. Our other centres are in Truganina and Williams Landing, in the west, and we teach live online as well.',
      },
      {
        question: 'Can students from Roxburgh Park, Greenvale or Mickleham join?',
        answer:
          'Yes. All three are next to Craigieburn, so students there can join our Craigieburn classes. Online classes are an option for any suburb.',
      },
      {
        question: 'What do you teach?',
        answer:
          'Selective entry exam and interview coaching, NAPLAN and ICAS preparation, Maths, Science and English for Years 5 to 10, SEAL and scholarship preparation, and VCE. Tell us your child’s year level and we’ll suggest a group.',
      },
      {
        question: 'How do I join a class in Craigieburn?',
        answer:
          'Fill in the register-interest form on our home page. We answer within 3 business days, book an initial assessment, and take you through fees and term dates.',
      },
    ],
    seo: {
      title: 'Tutoring in Craigieburn: Selective Entry & VCE | AJ Classes',
      description:
        'Small-group tutoring in Craigieburn, Years 2–12: NAPLAN, selective entry and interviews, ICAS, Maths, Science, English and VCE. In person or online.',
    },
  },
];

/** Paths of every centre page, for the sitemap and pre-rendering. */
export const CENTRE_PATHS = CENTRES.map((centre) => areaPath(centre.slug));

export function findCentre(slug: string | undefined): Centre | undefined {
  return CENTRES.find((centre) => centre.slug === slug);
}

/** The centre page for a suburb name ("Williams Landing"), or undefined where there is none. */
export function centrePathFor(name: string): string | undefined {
  const centre = CENTRES.find((item) => item.name === name);
  return centre ? areaPath(centre.slug) : undefined;
}

// Labels shared by every centre page.
export const CENTRE_PAGE = {
  helpfulHeading: (name: string) => `Helpful for ${name} families`,
  questionsHeading: 'Common questions',
  reviewsLabel: 'Read our reviews on Google',
  otherHeading: 'Our other centres',
  areaLinkLabel: (areaName: string) => `Suburbs we serve in ${areaName}`,
} as const;
