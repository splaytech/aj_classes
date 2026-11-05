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
  /** ISO dates for the Article structured data. Update `modified` whenever the facts are re-checked. */
  published: string;
  modified: string;
  seo: { title: string; description: string };
  sections: readonly GuideSection[];
  sources: readonly { label: string; url: string }[];
  /** The programme that prepares for this, linked at the end of the guide. */
  programme: ProgrammeSlug;
  /** Other programme pages that link to this guide too (more ways in for readers and crawlers). */
  relatedProgrammes?: readonly ProgrammeSlug[];
  /** Link text on the pages that point to this guide. */
  linkLabel: string;
  /** Slugs of other guides to list at the end of this one. */
  relatedGuides?: readonly string[];
};

export const RESOURCES = {
  heading: 'Parent guides',
  intro:
    'Plain-English guides to the exams and choices Victorian families face, checked against official sources.',
  seo: {
    title: 'Parent Guides: Selective Entry & NAPLAN | AJ Classes',
    description:
      'Plain-English guides for Victorian parents on the selective entry exam, NAPLAN and private school scholarships, checked against official sources.',
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
  relatedHeading: 'Related guides',
  footerLink: 'Parent guides',
} as const;

export const GUIDES: readonly Guide[] = [
  {
    slug: 'victorian-selective-entry-exam',
    title: 'The Victorian selective entry exam: a guide for parents',
    summary:
      'Which schools take part, who can apply, how places are offered, what the exam looks like, the yearly timeline and cost, and how to prepare sensibly.',
    checkedOn: '22 October 2026',
    published: '2026-10-22',
    modified: '2026-10-22',
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
    relatedProgrammes: [PROGRAMME_SLUGS.interviews, PROGRAMME_SLUGS.sealAndScholarships],
    linkLabel: 'Read our parent guide to the selective entry exam',
    relatedGuides: ['naplan-for-parents', 'victorian-school-scholarships'],
  },
  {
    slug: 'naplan-for-parents',
    title: 'NAPLAN: a guide for parents',
    summary:
      'What NAPLAN is, when it is held, what is tested, how results are reported, and what the official guidance says about preparing.',
    checkedOn: '5 November 2026',
    published: '2026-11-05',
    modified: '2026-11-05',
    seo: {
      title: 'NAPLAN: A Guide for Victorian Parents | AJ Classes',
      description:
        'What NAPLAN tests, when it is held, how results are reported and what ACARA says about preparing. A plain-English guide, checked against official sources.',
    },
    sections: [
      {
        heading: 'What NAPLAN is',
        paragraphs: [
          'NAPLAN is the National Assessment Program – Literacy and Numeracy. Students in Years 3, 5, 7 and 9 across Australia sit it each year. ACARA, the national body that runs it, says it is not about passing or failing: it shows how a student is progressing in key skills.',
        ],
      },
      {
        heading: 'When it is held',
        paragraphs: [
          'NAPLAN has been held in March since 2023 (from 2008 to 2022 it was held in May). The 2026 test window was 11 to 23 March, and the 2027 window is 10 to 22 March. Schools schedule the tests within the window.',
          "National results for 2026 were released on 5 August 2026. Your child's own report comes from their school later in the year; ACARA cannot provide individual student reports.",
        ],
      },
      {
        heading: 'What is tested',
        points: [
          'Reading',
          'Writing: a narrative or persuasive text, and the text type is revealed on the day, with no choice',
          'Conventions of language: spelling, grammar and punctuation',
          'Numeracy: number, algebra, measurement, space, statistics and probability',
        ],
        paragraphs: [
          'In Years 7 and 9, numeracy starts with a short section without a calculator, and an online calculator is available for the rest of the test.',
        ],
      },
      {
        heading: 'What the test is like',
        paragraphs: [
          'The tests are done online and are tailored: the questions a student sees get easier or harder depending on how they answer. Year 3 students still do the writing test on paper.',
          "ACARA's public demonstration site shows the types of questions and the online tools, so students can see how the screen works before the day.",
        ],
      },
      {
        heading: 'How results are reported',
        paragraphs: [
          'Results are reported as one of four proficiency levels, not as a pass or fail:',
        ],
        points: ['Exceeding', 'Strong', 'Developing', 'Needs additional support'],
      },
      {
        heading: 'About your child’s report',
        paragraphs: [
          'The individual student report summarises what each level means for the year level. If you do not receive a report, ask your child’s school, which can contact the state test authority.',
        ],
      },
      {
        heading: 'Adjustments and exemptions',
        paragraphs: [
          'Schools work with parents and students to decide reasonable adjustments, case by case, for students with disability or other needs. Some adjustments need approval from the state test authority.',
          'A formal exemption is possible only in exceptional circumstances: for a student whose disability severely limits their participation, or a recently arrived student from a non-English-speaking background. Ask your child’s principal about the process. If a student is absent, the school may arrange a make-up test.',
        ],
      },
      {
        heading: 'Preparing sensibly',
        paragraphs: [
          'ACARA says students are not expected to study for NAPLAN. It says the best preparation is good teaching of the curriculum, and that it does not recommend excessive preparation or the use of coaching providers.',
          'We agree that NAPLAN does not need cramming. Where extra help is useful, it is steady work on the skills the tests measure, so the test feels familiar and calm. At AJ Classes we start early, from Year 2, so a first NAPLAN in Year 3 is no surprise:',
        ],
        points: [
          'Read widely and talk about what is read',
          'Write regularly, including planning a short piece',
          'Practise spelling, grammar and punctuation in context',
          'Build number and problem-solving skills, with and without a calculator',
          'Try the demonstration site once, so the online format is familiar',
          'Keep it short and relaxed: sleep and wellbeing matter more than extra practice',
        ],
      },
      {
        heading: 'Where NAPLAN fits with other tests',
        paragraphs: [
          'NAPLAN is separate from the Victorian selective entry exam, which has its own application and is run by ACER. Some independent schools ask for NAPLAN results as part of a scholarship application.',
        ],
      },
    ],
    sources: [
      { label: 'ACARA: NAPLAN', url: 'https://www.nap.edu.au/naplan' },
      {
        label: 'ACARA: NAPLAN for parents and carers',
        url: 'https://www.nap.edu.au/naplan/for-parents-carers',
      },
      {
        label: 'ACARA: What is in the tests',
        url: 'https://www.nap.edu.au/naplan/whats-in-the-tests',
      },
      { label: 'ACARA: NAPLAN key dates', url: 'https://www.nap.edu.au/naplan/key-dates' },
      {
        label: 'ACARA: Proficiency level descriptions',
        url: 'https://www.nap.edu.au/naplan/results-and-reports/proficiency-level-descriptions',
      },
      {
        label: 'ACARA: Public demonstration site',
        url: 'https://www.nap.edu.au/naplan/public-demonstration-site',
      },
      {
        label: 'ACARA: Adjustments for students with disability',
        url: 'https://www.nap.edu.au/naplan/accessibility/adjustments-for-students-with-disability',
      },
    ],
    programme: PROGRAMME_SLUGS.naplan,
    linkLabel: 'Read our parent guide to NAPLAN',
    relatedGuides: ['victorian-school-scholarships'],
  },
  {
    slug: 'victorian-school-scholarships',
    title: 'Private school scholarships in Victoria: a guide for parents',
    summary:
      'What an academic scholarship is, the steps schools follow, how timing works, and what differs from school to school, with two schools as worked examples.',
    checkedOn: '5 November 2026',
    published: '2026-11-05',
    modified: '2026-11-05',
    seo: {
      title: 'Victorian School Scholarships: A Parent Guide | AJ Classes',
      description:
        'How academic scholarships at Victorian independent schools work: the steps, the timing and what differs, with two schools as examples from their own pages.',
    },
    sections: [
      {
        heading: 'What an academic scholarship is',
        paragraphs: [
          'Many independent schools offer academic scholarships to students who show strong ability. At Melbourne Grammar, for example, an academic scholarship is a partial remission of tuition fees, with priority to students whose families may not otherwise be able to attend. Awards are at the Headmaster’s discretion and vary from year to year, and the number awarded and the amount of remission are not published.',
          'Every school sets its own rules, so the schools below are examples, not a rule for all schools.',
        ],
      },
      {
        heading: 'The usual steps',
        paragraphs: ['The two schools we checked follow a similar pattern:'],
        points: [
          'Register or apply, often with school reports and other documents',
          'Sit a scholarship test',
          'Shortlisted students are invited to an interview',
          'Offers are made',
        ],
      },
      {
        heading: 'Example 1: Melbourne Grammar School',
        points: [
          'Academic scholarships for Year 7 and Year 9 entry',
          'One scholarship exam a year, sat in person at the school',
          'Year 7 applicants sit it in Year 5, about 18 months before entry',
          'The 2026 exam was on Saturday 29 August, and applications closed on Thursday 20 August',
          'Shortlisted students are invited to interview, and families may then be able to apply for means-testing',
          'Applicants must be Australian citizens or permanent residents when they register',
        ],
      },
      {
        heading: 'Example 2: Westbourne Grammar School',
        paragraphs: [
          'Westbourne Grammar School has a campus in Truganina. Dates below are for its 2028 entry round, as published on 5 November 2026.',
        ],
        points: [
          'Scholarships for students entering Years 7, 10 and 11 in 2028, open to domestic students',
          'Apply online with the latest two semester reports, NAPLAN results, certificates and a portfolio form; references are optional',
          'Academic Excellence, General Excellence and Sport applicants sit an online assessment at home through iDAT, with a $165 fee (including GST) paid to iDAT',
          'Music applicants audition, and First Nations applicants are interviewed',
          'Applications open 2 November 2026 and close 11 January 2027',
          'Testing is 18 to 23 January 2027, interview invitations go out on 26 March 2027 and offers on 30 April 2027',
        ],
      },
      {
        heading: 'What is the same, and what is not',
        paragraphs: [
          'Both schools use a scholarship test and an interview for shortlisted students, and both ask families to apply about 12 to 18 months before entry. They differ on the test (in person or online), the dates, the documents and the fees.',
          'Dates and fees change every year, so check the school’s own scholarship page for the current round. If your child is in Year 4 or 5, now is a good time to look at the schools you like and note their dates.',
        ],
      },
      {
        heading: 'How NAPLAN comes into it',
        paragraphs: [
          'Both schools refer to NAPLAN. Westbourne asks applicants to submit their latest NAPLAN results. Melbourne Grammar’s FAQ says that, as a guide, applicants typically achieve “Exceeding” in NAPLAN and above or well above standard in their school reports. Our NAPLAN guide explains the levels.',
        ],
      },
      {
        heading: 'Other scholarships',
        paragraphs: [
          'Schools usually offer other kinds too. Melbourne Grammar lists music (applicants first sit the academic exam, then audition), boarding for regional, rural and interstate students, general excellence, and First Nations scholarships. Westbourne lists general excellence, music, sport and First Nations scholarships.',
        ],
      },
      {
        heading: 'Preparing sensibly',
        paragraphs: [
          'The school pages we read give no advice on preparing, so there is nothing official to follow beyond reading each school’s information. Steady skills matter more than cramming:',
        ],
        points: [
          'Read widely and often, then talk about what was read',
          'Write regularly, and practise planning a piece quickly',
          'Keep maths sharp, including multi-step problems',
          'Practise reasoning with words, numbers and patterns',
          'Do some practice under timed conditions, so the pace feels familiar',
          'Look after sleep and balance: a calm student thinks more clearly',
        ],
      },
      {
        heading: 'A word on honesty',
        paragraphs: [
          'No tutor or school can promise a scholarship: awards are at each school’s discretion. At AJ Classes we teach the skills these tests reward, using our own material, and we never ask students about test content.',
        ],
      },
    ],
    sources: [
      {
        label: 'Melbourne Grammar School: Academic scholarships',
        url: 'https://www.mgs.vic.edu.au/admissions/scholarships/academic-scholarships',
      },
      {
        label: 'Melbourne Grammar School: Scholarship exam FAQ',
        url: 'https://www.mgs.vic.edu.au/admissions/scholarships/academic-scholarships/annual-scholarship-exam-frequently-asked-questions',
      },
      {
        label: 'Westbourne Grammar School: Scholarships',
        url: 'https://westbournegrammar.com/enrolments/scholarships/',
      },
    ],
    programme: PROGRAMME_SLUGS.sealAndScholarships,
    linkLabel: 'Read our parent guide to school scholarships',
    relatedGuides: ['naplan-for-parents'],
  },
];

/** Paths of every guide page, for the sitemap and pre-rendering. */
export const GUIDE_PATHS = GUIDES.map((guide) => resourcePath(guide.slug));

export function findGuide(slug: string | undefined): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
