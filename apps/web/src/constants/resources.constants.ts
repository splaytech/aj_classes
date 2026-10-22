// Parent guides under /resources (SEO recommendation, completion-todo §5.3).
// Facts come only from the official sources listed with each guide, checked on the date given.
// All wording is our own. A guide never promises results (consumer law) and never discusses exam
// content (ACER treats that as misconduct).

import { BUSINESS } from './business.constants';
import { PROGRAMME_SLUGS } from './programmes.constants';
import { resourcePath } from './routes.constants';
import type { ProgrammeSlug } from './programmes.constants';

export type GuideSection = {
  heading: string;
  paragraphs?: readonly string[];
  points?: readonly string[];
};

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  checkedOn: string; // when the facts were last checked against the sources
  seo: { title: string; description: string };
  sections: readonly GuideSection[];
  sources: readonly { label: string; url: string }[];
  /** The programme that prepares for this, linked at the end of the guide. */
  programme: ProgrammeSlug;
};

export const RESOURCES = {
  heading: 'Parent guides',
  intro:
    'Plain-English guides to the exams and choices Victorian families face, checked against official sources.',
  seo: {
    title: 'Parent Guides: Selective Entry, NAPLAN and VCE | AJ Classes',
    description:
      'Plain-English guides for Victorian parents on the selective entry exam, NAPLAN, scholarships and VCE choices, checked against official sources.',
  },
  readGuide: 'Read the guide',
  readGuideLabel: (title: string) => `Read the guide: ${title}`,
  checkedOn: (date: string) => `Facts checked against official sources on ${date}.`,
  disclaimer:
    'Details change every year. Always confirm dates, fees and rules on the official websites below before you apply.',
  sourcesHeading: 'Official sources',
  ctaHeading: 'How AJ Classes can help',
  ctaText: `Small-group classes in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  ctaProgramme: (title: string) => `See our programme: ${title}`,
  ctaContact: 'Register interest',
  backToGuides: '← All parent guides',
  programmeLink: 'Read our parent guide to the exam',
  footerLink: 'Parent guides',
} as const;

export const GUIDES: readonly Guide[] = [
  {
    slug: 'victorian-selective-entry-exam',
    title: 'The Victorian selective entry exam: a guide for parents',
    summary:
      'Which schools take part, who can apply, how places are offered, what the exam looks like, the yearly timeline and cost, and how to prepare sensibly.',
    checkedOn: '22 October 2026',
    seo: {
      title: 'Victorian Selective Entry Exam: A Parent Guide | AJ Classes',
      description:
        "How Victoria's selective entry high school exam works: schools, eligibility, how places are offered, exam sections and timing, dates, fees and preparation.",
    },
    sections: [
      {
        heading: 'The four selective entry high schools',
        paragraphs: [
          'Victoria has four government selective entry high schools for academically able students in Years 9 to 12. Together they offer about 1,000 Year 9 places each year.',
        ],
        points: [
          'Melbourne High School, South Yarra (boys)',
          "The Mac.Robertson Girls' High School, Melbourne (girls)",
          'Nossal High School, Berwick (co-educational)',
          'Suzanne Cory High School, Werribee (co-educational)',
        ],
      },
      {
        heading: 'Who can apply',
        paragraphs: [
          'Students sit the exam in Year 8 (their second year of secondary school) for a place in Year 9. Each student can sit the Year 9 entry exam only once.',
          'Students from government, Catholic and independent schools can apply, as can home-schooled students registered with the VRQA. Applicants must be Australian citizens, New Zealand citizens living in Australia, or hold a visa that exempts them from international student fees. Fee-paying international students are not eligible.',
          'A small number of Year 10 and 11 places sometimes come up; those are managed by each school directly.',
        ],
      },
      {
        heading: 'How places are offered',
        points: [
          'About 85% of places go on merit, by ranking in the exam.',
          'Up to 10% are equity places, also based on the exam, for students whose parent or guardian holds a health care card or pensioner concession card, or who identify as Aboriginal or Torres Strait Islander.',
          'Up to 5% are principal discretion places: principals invite some students with strong results to apply, and shortlisted students have an interview at the school.',
          'Families list up to three schools in order of preference, and receive an offer from the highest preference they qualify for.',
          'No more than 4% of students from any one Year 8 school can receive merit or principal discretion offers.',
        ],
      },
      {
        heading: 'What the exam looks like',
        paragraphs: [
          'The exam is run once a year, in June, on paper at venues across Melbourne. It is managed by ACER for the Department of Education. The tasks take 2 hours 35 minutes, and the whole session, with registration and breaks, takes about four hours.',
        ],
        points: [
          'Mathematics and quantitative reasoning: 60 minutes',
          'Reading and verbal reasoning: 55 minutes',
          'Writing: two tasks in 40 minutes',
        ],
      },
      {
        heading: 'What it tests',
        paragraphs: [
          'The exam looks for higher-order thinking: reasoning, problem solving, comprehension, interpretation and creative thinking, and applying what students know to unfamiliar situations. The knowledge needed never goes beyond the Year 8 curriculum, but the questions are designed to stretch students. ACER notes that it is common to answer only about half the questions correctly, and many students do not finish. Calculators are not allowed.',
        ],
      },
      {
        heading: 'The yearly timeline',
        paragraphs: [
          'Dates for the next intake are published on the ACER website. As a guide, the 2026 cycle (for Year 9 in 2027) ran like this:',
        ],
        points: [
          'Applications open: early March (2 March 2026)',
          'Applications close: late April (24 April 2026)',
          'Exam: a Saturday in June (20 June 2026)',
          'Results and first-round offers: early August (3 August 2026), with further rounds through August',
          'Principal discretion interviews: October',
        ],
      },
      {
        heading: 'Cost',
        paragraphs: [
          'The application fee for the 2026 cycle was $175. It is free for families with a health care card or pensioner concession card, and for First Nations families; other families facing financial hardship can ask for a reduced fee.',
        ],
      },
      {
        heading: 'Preparing sensibly',
        paragraphs: [
          "ACER publishes sample questions so students know what to expect, and says there is no need to practise or revise specifically for the exam. That's because it tests skills built over years, so the most useful preparation is steady work on those skills, not memorising questions:",
        ],
        points: [
          'Read widely and often, then talk about what was read: fiction, non-fiction and poetry',
          'Write regularly, and practise planning a piece quickly, since there are two writing tasks in 40 minutes',
          'Keep maths sharp without a calculator, including multi-step problems',
          'Practise reasoning with words, numbers and patterns',
          'Do some practice under real timing, so the pace on the day feels familiar',
          'Look after sleep, wellbeing and balance: a calm student thinks more clearly',
        ],
      },
      {
        heading: 'A word on exam integrity',
        paragraphs: [
          'ACER treats discussing the content of the exam with tutoring companies, coaching colleges or other candidates as misconduct, and it can cost a student their place. Good preparation never asks students about the questions they sat. At AJ Classes we teach the skills the exam rewards, using our own material, and we never ask students about exam content.',
        ],
      },
    ],
    sources: [
      {
        label: 'Victorian Government: Selective entry high schools',
        url: 'https://www.vic.gov.au/selective-entry-high-schools',
      },
      {
        label: 'ACER: Victorian selective entry high schools exam',
        url: 'https://selectiveentry.acer.org/vic',
      },
      { label: 'ACER: Preparing for the exam', url: 'https://selectiveentry.acer.org/vic/prepare' },
      { label: 'ACER: How to apply', url: 'https://selectiveentry.acer.org/vic/apply' },
      {
        label: 'ACER: Results and selection',
        url: 'https://selectiveentry.acer.org/vic/results-and-selection',
      },
    ],
    programme: PROGRAMME_SLUGS.selectiveEntry,
  },
];

/** Paths of every guide page, for the sitemap and pre-rendering. */
export const GUIDE_PATHS = GUIDES.map((guide) => resourcePath(guide.slug));

export function findGuide(slug: string | undefined): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
