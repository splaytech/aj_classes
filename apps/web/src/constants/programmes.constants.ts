// Our programmes: one list feeds the home page cards, the Programmes menu and each programme's
// own page (Release 1, docs/requirements/release-1/programme-pages.md).
// Exam facts were checked on 21 Oct 2026 (§5 G3). Details that change every year (dates,
// providers' test formats) are kept general on purpose. No result promises (G4).

import { BUSINESS } from './business.constants';
import { programmePath } from './routes.constants';

// VCE subjects we teach, by their official VCAA names (checked 21 Oct 2026, vce-page.md §1).
// Used by the VCE card on the home page and by the VCE page.
export const VCE_SUBJECTS = [
  {
    name: 'Chemistry',
    area: 'Science',
    summary:
      'From atomic structure, bonding and reactions to the design of chemical processes and carbon-based compounds, with strong practical and data-analysis skills.',
  },
  {
    name: 'General Mathematics',
    area: 'Mathematics',
    summary:
      'Data analysis, recursion and financial modelling, matrices, and networks and decision mathematics, applied to real-world problems.',
  },
  {
    name: 'Mathematical Methods',
    area: 'Mathematics',
    summary:
      'Functions, algebra, calculus, and probability and statistics, building the depth and fluency needed for both technology-active and technology-free exams.',
  },
  {
    name: 'Psychology',
    area: 'Science',
    summary:
      'How behaviour and mental processes are shaped, how we learn and remember, and how mental wellbeing is supported, with a focus on scientific research skills.',
  },
  {
    name: 'Business Management',
    area: 'Business and Economics',
    summary:
      'How businesses are planned, established, managed and transformed, using real case studies to apply key knowledge to new situations.',
  },
] as const;

export const PROGRAMME_SLUGS = {
  selectiveEntry: 'selective-entry',
  interviews: 'interviews',
  sealAndScholarships: 'seal-and-scholarships',
  naplan: 'naplan',
  icas: 'icas',
  mathsScienceEnglish: 'maths-science-english',
  vce: 'vce',
  vceSubjectSelection: 'vce-subject-selection',
  ucatAndGamsat: 'ucat-and-gamsat',
} as const;

export type ProgrammeSlug = (typeof PROGRAMME_SLUGS)[keyof typeof PROGRAMME_SLUGS];

export type Programme = {
  slug: ProgrammeSlug;
  title: string;
  /** Shorter name for the Programmes menu, in Title Case (ui-polish.md §3). */
  menuLabel: string;
  years: string;
  /** Three short points for the home page card. */
  points: readonly string[];
  isNew: boolean;
  seo: { title: string; description: string };
  /** Opening paragraph on the programme's page. */
  intro: string;
  /** "What is it?" for the exam or program, where there is one (merged pathway info). */
  about?: { heading: string; paragraphs: readonly string[] };
  /** How we help, as ticked points. */
  help: readonly string[];
};

export const PROGRAMMES = {
  heading: 'Programmes',
  intro: 'Small-group classes and coaching from Year 2 through to university entry.',
  newBadge: 'New',
  moreLink: 'Learn more →',
  /** Screen-reader name for a card's link; starts with the visible text. */
  moreLinkLabel: (title: string) => `Learn more about ${title}`,
  items: [
    {
      slug: PROGRAMME_SLUGS.selectiveEntry,
      title: 'Selective entry exam preparation',
      menuLabel: 'Selective Entry Exam',
      years: 'Years 6–10',
      points: [
        'Reading comprehension and creative and persuasive writing',
        'Mathematics, plus verbal and quantitative reasoning',
        'Timed practice under exam conditions',
      ],
      isNew: false,
      seo: {
        title: 'Selective Entry Exam Preparation in Melbourne | AJ Classes',
        description:
          'Small-group coaching for the Victorian selective entry high school exam: reading, writing, mathematics, and verbal and quantitative reasoning, with timed practice.',
      },
      intro:
        'Focused, small-group coaching for the Victorian selective entry exam, building the reading, writing, maths and reasoning skills the test rewards, and the calm, timed exam technique that brings them together on the day.',
      about: {
        heading: 'About the selective entry exam',
        paragraphs: [
          "Victoria's selective entry high schools, including Melbourne High School, The Mac.Robertson Girls' High School, Nossal High School and Suzanne Cory High School, offer places from Year 9 based on a single entrance exam.",
          'Students sit the exam in Year 8. It covers reading comprehension, mathematics, verbal reasoning, quantitative reasoning and writing, and places are offered on the results.',
          'Because the exam rewards skills built over years, many families start preparing in Year 6 or Year 7.',
        ],
      },
      help: [
        'Reading comprehension across fiction, non-fiction and poetry',
        'Creative and persuasive writing, with detailed written feedback',
        'Mathematics beyond the school year level, taught step by step',
        'Verbal and quantitative reasoning, with strategies for each question type',
        'Full practice tests under real exam timing',
        'Progress updates for parents after each block of practice tests',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.interviews,
      title: 'Selective school and scholarship interviews',
      menuLabel: 'Interviews',
      years: 'Years 8–10',
      points: [
        'One-on-one and group mock interviews with written feedback',
        'Coaching on common questions and help with applications',
        // Short for the card; the page lists every school (see `help` below).
        'For selective schools, John Monash and scholarships',
      ],
      isNew: false,
      seo: {
        title: 'Selective School and Scholarship Interview Coaching | AJ Classes',
        description:
          'Mock interviews, feedback and application help for selective school and private school scholarship interviews in Melbourne.',
      },
      intro:
        'An interview is a chance for a student to show who they are beyond a test score. We help students prepare thoughtfully, so they walk in confident, clear and genuinely themselves.',
      about: {
        heading: 'Where interviews come in',
        paragraphs: [
          'Some specialist schools and many private school scholarship programs include an interview or a written application as part of selection.',
          'Interviewers usually want to hear about a student’s interests, achievements, goals and how they think, not rehearsed speeches.',
        ],
      },
      help: [
        'One-on-one and small-group mock interviews',
        'Written feedback after every mock interview',
        'Practice with the kinds of questions students are commonly asked',
        'Help shaping answers from the student’s own experiences',
        'Support with written applications and personal statements',
        "For Melbourne High School, The Mac.Robertson Girls' High School, Nossal High School, Suzanne Cory High School, John Monash Science School and private school scholarships",
      ],
    },
    {
      slug: PROGRAMME_SLUGS.sealAndScholarships,
      title: 'SEAL and scholarship preparation',
      menuLabel: 'SEAL and Scholarships',
      years: 'Accelerated pathways',
      points: [
        'Preparation for SEAL program entry',
        'Private school scholarship exams',
        'Practice in the style and timing of the real tests',
      ],
      isNew: false,
      seo: {
        title: 'SEAL and Scholarship Exam Preparation | AJ Classes',
        description:
          'Small-group preparation for SEAL program entry tests and private school scholarship exams in Melbourne, in person or online.',
      },
      intro:
        'Preparation for the entry tests to accelerated programs and private school scholarships, with practice in the style and timing of the real tests.',
      about: {
        heading: 'About SEAL and scholarship tests',
        paragraphs: [
          'SEAL (Select Entry Accelerated Learning) programs run in a number of Victorian government secondary schools. Students in a SEAL class move through the curriculum faster and in more depth.',
          'Entry is set by each school and usually includes a test taken in Year 6, for a place in Year 7.',
          'Many private schools offer academic scholarships based on their own exams, which are often run by independent testing organisations. Each school sets its own year levels and dates.',
        ],
      },
      help: [
        'Reading, writing and mathematics beyond the school year level',
        'Verbal and numerical reasoning practice',
        'Practice tests in the style and timing of the real tests',
        'Guidance for parents on choosing which programs and scholarships to apply for',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.naplan,
      title: 'NAPLAN preparation',
      menuLabel: 'NAPLAN',
      years: 'Years 2–9',
      points: [
        'Starts in Year 2, ahead of the first NAPLAN in Year 3',
        'Continues through to Year 9',
        'Reading, writing, language conventions and numeracy',
      ],
      isNew: false,
      seo: {
        title: 'NAPLAN Preparation from Year 2 | AJ Classes',
        description:
          'Small-group NAPLAN preparation in reading, writing, language conventions and numeracy, from Year 2 through to Year 9.',
      },
      intro:
        'Steady, low-stress NAPLAN preparation that starts in Year 2, so students meet their first NAPLAN in Year 3 with the skills and the confidence to show what they know.',
      about: {
        heading: 'About NAPLAN',
        paragraphs: [
          'NAPLAN (the National Assessment Program – Literacy and Numeracy) is sat by students across Australia in Years 3, 5, 7 and 9. It is run by ACARA and held each year in March.',
          'It covers four areas: reading, writing, conventions of language (spelling, grammar and punctuation) and numeracy. Results show how a student is tracking against national standards.',
        ],
      },
      help: [
        'Reading comprehension and vocabulary',
        'Narrative and persuasive writing',
        'Spelling, grammar and punctuation',
        'Numeracy, from number sense to problem solving',
        'Familiarity with the online test format, so nothing on the day is a surprise',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.icas,
      title: 'ICAS preparation',
      menuLabel: 'ICAS',
      years: 'Years 5–10',
      points: [
        'Preparation for the ICAS academic competitions',
        'Problem solving and higher-order thinking',
        'Our students improved significantly in ICAS in 2026',
      ],
      isNew: false,
      seo: {
        title: 'ICAS Preparation | AJ Classes',
        description:
          'Small-group preparation for the ICAS academic competitions, building problem solving and higher-order thinking in Maths, Science and English.',
      },
      intro:
        'ICAS rewards students who can think, not just recall. Our preparation stretches students with challenging problems and the reasoning behind them.',
      about: {
        heading: 'About ICAS',
        paragraphs: [
          'ICAS is a set of academic competitions for primary and secondary students, run by ICAS Assessments. Subjects include English, Mathematics, Science, Writing, Spelling and Digital Technologies.',
          'Students usually take part through their school. Questions go beyond the classroom, testing how students apply what they know to unfamiliar problems.',
        ],
      },
      help: [
        'Challenging problems in Maths, Science and English',
        'Strategies for multiple-choice questions under time limits',
        'Reasoning and problem-solving skills that carry into school work',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.mathsScienceEnglish,
      title: 'Maths, Science and English tutoring',
      menuLabel: 'Maths, Science and English',
      years: 'Years 5–10',
      points: [
        'Regular term-by-term tutoring',
        'Builds strong foundations',
        'Keeps students ahead at school',
      ],
      isNew: false,
      seo: {
        title: 'Maths, Science and English Tutoring, Years 5–10 | AJ Classes',
        description:
          'Regular small-group tutoring in Maths, Science and English for Years 5–10, building strong foundations and keeping students ahead at school.',
      },
      intro:
        'Regular, term-by-term tutoring that fills gaps, builds strong foundations and keeps students a step ahead of their class.',
      help: [
        'Mathematics: number, algebra, geometry, measurement and statistics',
        'Science: clear explanations of key ideas and how to apply them',
        'English: reading, vocabulary, grammar and writing',
        'Homework and practice matched to what each student needs',
        'Regular progress updates for parents',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.vce,
      title: 'VCE tutoring',
      menuLabel: 'VCE Tutoring',
      years: 'Years 11–12',
      points: [
        VCE_SUBJECTS.map((subject) => subject.name).join(', '),
        'Units 1–4, taught by qualified teachers',
        'SAC preparation and exam technique',
      ],
      isNew: false,
      seo: {
        title: 'VCE Tutoring in Melbourne | AJ Classes',
        description:
          'Small-group VCE tutoring in Chemistry, General Mathematics, Mathematical Methods, Psychology and Business Management, Units 1–4, taught by qualified teachers. In person or online.',
      },
      // The VCE page has its own layout (routes/vce.tsx, VCE_PAGE below).
      intro: '',
      help: [],
    },
    {
      slug: PROGRAMME_SLUGS.vceSubjectSelection,
      title: 'VCE subject-selection counselling',
      menuLabel: 'VCE Subject Selection',
      years: 'Students + parents',
      points: [
        'Sessions with students and parents together',
        'Complete guidance on choosing VCE subjects',
        'Clear advice on pathways and prerequisites',
      ],
      isNew: false,
      seo: {
        title: 'VCE Subject Selection Counselling | AJ Classes',
        description:
          'Counselling sessions for students and parents together, to choose VCE subjects with a clear view of pathways and university prerequisites.',
      },
      intro:
        'Choosing VCE subjects shapes the next three years and beyond. Our counselling sessions bring students and parents together to make that choice with confidence.',
      about: {
        heading: 'Why subject choice matters',
        paragraphs: [
          'Students usually choose their VCE subjects in Year 10. Many university courses have prerequisite subjects, so an early choice can open or close a pathway.',
          'The best choice balances a student’s strengths, interests and goals, and the right mix often isn’t obvious.',
        ],
      },
      help: [
        'Sessions with students and parents together',
        'A clear look at the student’s strengths, interests and goals',
        'Advice on pathways and the prerequisites for courses they’re considering',
        'A subject plan the whole family understands',
      ],
    },
    {
      slug: PROGRAMME_SLUGS.ucatAndGamsat,
      title: 'UCAT and GAMSAT preparation',
      menuLabel: 'UCAT and GAMSAT',
      years: 'Medicine and health',
      points: [
        'For medical and health-science entry tests',
        'Enrolments are open now',
        'Classes start in January 2027',
      ],
      isNew: true,
      seo: {
        title: 'UCAT and GAMSAT Preparation | AJ Classes',
        description:
          'New for 2027: small-group preparation for the UCAT and GAMSAT medical and health-science entry tests. Classes start in January 2027.',
      },
      intro:
        'New for 2027: preparation for the entry tests to medicine and other health-science degrees. Enrolments are open now, and classes start in January 2027.',
      about: {
        heading: 'About the UCAT and GAMSAT',
        paragraphs: [
          'The UCAT ANZ is used by many universities in Australia and New Zealand for entry to undergraduate medicine, dentistry and some other health-science degrees. Most students sit it in Year 12.',
          'The GAMSAT, run by ACER, is used for entry to graduate-entry medicine and some other health courses. It is taken by university students and graduates.',
        ],
      },
      help: [
        'Clear strategies for each part of the test',
        'Practice questions under strict time limits',
        'Feedback that targets each student’s weakest areas',
      ],
    },
  ] satisfies readonly Programme[],
};

/** The programme pages that use the shared template (VCE has its own page). */
export const TEMPLATE_PROGRAMMES = PROGRAMMES.items.filter(
  (programme) => programme.slug !== PROGRAMME_SLUGS.vce,
);

export function findProgramme(slug: string | undefined): Programme | undefined {
  return TEMPLATE_PROGRAMMES.find((programme) => programme.slug === slug);
}

/** Paths of every programme page, for the sitemap and pre-rendering. */
export const PROGRAMME_PATHS = PROGRAMMES.items.map((programme) => programmePath(programme.slug));

// Labels shared by every programme page.
export const PROGRAMME_PAGE = {
  helpHeading: 'How we help',
  deliveryText: `Small groups, in person in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  cta: 'Register interest',
  otherHeading: 'Other programmes',
  backHome: '← Back to home',
} as const;

// The VCE tutoring page (/programmes/vce). Describes what we do and who teaches; no score or
// ATAR promises (vce-page.md G2). Teacher wording uses only confirmed facts (G3); owner to review.
export const VCE_PAGE = {
  heading: 'VCE Tutoring',
  intro:
    'Expert, small-group VCE tutoring for Units 1–4, led by qualified teachers who know what the VCAA study designs ask of students, and how to help them deliver it.',
  subjectsHeading: 'Subjects we teach',
  subjectsIntro:
    'Each subject follows the current VCAA study design, from Unit 1 through to the Unit 3 and 4 exam.',
  unitsLabel: 'Units 1–4',
  teachersHeading: 'Taught by qualified teachers',
  teachersText: [
    'Every VCE class is led by a qualified teacher. Our teachers bring more than 20 years of combined teaching experience and each holds a Working With Children Check.',
    'They teach to the VCAA study design, explain difficult ideas clearly, and give students the precise, exam-ready language that assessors look for.',
  ],
  approachHeading: 'How we prepare students',
  approachPoints: [
    'Small groups, so every student gets real attention and feedback',
    'Clear explanations of key knowledge and key skills, unit by unit',
    'Preparation for School-Assessed Coursework (SACs)',
    'Exam technique, with practice questions under timed exam conditions',
    'Regular progress updates for parents',
  ],
  counsellingHeading: 'Choosing VCE subjects?',
  counsellingText:
    'Our VCE subject-selection counselling sessions help students and parents choose subjects together, with a clear view of pathways and prerequisites.',
  counsellingLink: 'About VCE subject-selection counselling',
  deliveryText: `In person in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  cta: 'Register interest',
  studyDesignsLink: 'Read the VCAA study designs',
  studyDesignsUrl:
    'https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/vce-study-designs',
  backHome: '← Back to home',
} as const;
