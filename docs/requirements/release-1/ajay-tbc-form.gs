/**
 * AJ Classes: Release 1 "questions for Ajay" Google Form builder.
 *
 * Builds a Google Form covering items T1–T14 from
 * docs/requirements/release-1/PRP.md (Appendix A.10).
 * Every question is optional, and questions offer choices wherever possible.
 *
 * HOW TO RUN
 *   New form:      script.google.com → New project → paste this file → Run `buildAjayForm`.
 *   Existing form: open your form → ⋮ menu → Apps Script → paste → set CONFIG.FORM_ID → Run.
 *   Approve the permission prompt the first time (it only needs access to your Forms).
 *   The execution log prints the edit link and the link to share with Ajay.
 */

// ─── Config ─────────────────────────────────────────────────────────────────
const CONFIG = {
  // Leave empty to CREATE a new form. To reuse an existing form, paste its ID
  // (the long string between /d/ and /edit in the form's URL).
  FORM_ID: '',

  // Only applies when FORM_ID is set. true = DELETE all existing questions in
  // that form before adding these. Existing responses are NOT deleted, but
  // they lose their question headings. Use a copy of the form if unsure.
  CLEAR_EXISTING_QUESTIONS: false,

  TITLE: 'AJ Classes: a few questions for Ajay (website launch)',
  DESCRIPTION:
    'Hi Ajay! We are finishing the AJ Classes website (launching 11–20 October). ' +
    'These answers make sure everything on the site is accurate. ' +
    'Every question is optional, so skip anything you are unsure about. ' +
    'Pick the closest option, or use "Other" to write your own. Takes about 10 minutes.',
  CONFIRMATION: 'Thank you, Ajay! Your answers have been saved.',
};

// ─── Shared option lists ────────────────────────────────────────────────────
const YEAR_LEVELS = [
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5',
  'Year 6',
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
];
const PROGRAMMES = [
  'Selective entry: exam preparation',
  'Selective entry: interview preparation',
  'NAPLAN',
  'ICAS',
  'Maths (school support)',
  'Science (school support)',
  'English (school support)',
  'VCE subject-selection counselling',
];

// ─── Questions ──────────────────────────────────────────────────────────────
// type: section | checkbox | choice | grid | checkboxGrid | text | paragraph | date
// `other: true` adds an "Other: ____" option (checkbox/choice only).
const QUESTIONS = [
  { type: 'text', title: 'Your name', help: 'So we know who answered.' },

  // ── Section 1: Programmes & subjects ──
  { type: 'section', title: 'Programmes & subjects', help: 'What we teach, and to which year levels.' },
  {
    id: 'T1', type: 'checkbox', other: true,
    title: 'Which selective entry exam sections do we teach?',
    help: 'Tick all that apply.',
    choices: [
      'Reading comprehension',
      'Writing (creative / narrative)',
      'Writing (persuasive)',
      'Mathematics',
      'Verbal reasoning',
      'Quantitative / numerical reasoning',
    ],
  },
  {
    id: 'T2', type: 'checkbox',
    title: 'Which year levels is Science taught for?',
    choices: YEAR_LEVELS,
  },
  {
    id: 'T3', type: 'checkboxGrid',
    title: 'Which year levels does each programme cover?',
    help: 'Tick every year level that applies for each programme.',
    rows: PROGRAMMES, columns: YEAR_LEVELS,
  },
  {
    id: 'T4a', type: 'checkbox', other: true,
    title: 'What does interview preparation include?',
    choices: [
      'One-on-one mock interviews',
      'Group interview practice',
      'Coaching on common interview questions',
      'Help with application forms / written statements',
      'Written feedback after mock interviews',
    ],
  },
  {
    id: 'T4b', type: 'checkbox', other: true,
    title: 'Which schools do we prepare students to interview for?',
    choices: [
      'Melbourne High School',
      "The Mac.Robertson Girls' High School",
      'Nossal High School',
      'Suzanne Cory High School',
      'John Monash Science School',
      'Private school scholarship interviews',
    ],
  },
  {
    id: 'T5', type: 'checkbox', other: true,
    title: 'Do we also offer any of these?',
    choices: ['SEAL program preparation', 'Private school scholarship preparation', 'Neither'],
  },
  {
    id: 'T6', type: 'choice', other: true,
    title: 'Do we offer general school support outside the exam programmes?',
    choices: [
      'Yes: regular term-by-term tutoring',
      'Yes: homework help only',
      'No: exam programmes only',
    ],
  },

  // ── Section 2: Classes ──
  { type: 'section', title: 'Classes', help: 'How classes run (small groups, 1 hour, twice a week).' },
  {
    id: 'T7', type: 'grid',
    title: 'Maximum number of students per group',
    help: 'Pick one size for each.',
    rows: ['In person (Truganina)', 'Online'],
    columns: ['Up to 4', 'Up to 6', 'Up to 8', 'Up to 10', 'Up to 12', 'Varies'],
  },
  {
    id: 'T8a', type: 'choice', other: true,
    title: 'Which platform do we use for online classes?',
    choices: ['Zoom', 'Google Meet', 'Microsoft Teams'],
  },
  {
    id: 'T8b', type: 'choice', other: true,
    title: 'What are online classes like?',
    choices: [
      'Live and interactive (students talk, ask questions, share work)',
      'Live, mostly teacher-led',
      'Recorded lessons plus live Q&A',
    ],
  },
  {
    id: 'T9', type: 'choice', other: true,
    title: 'Is there a trial class or assessment before enrolling?',
    choices: [
      'Free trial class',
      'Free initial assessment',
      'Both a free trial class and a free assessment',
      'Paid assessment',
      'Neither: students start directly',
    ],
  },

  // ── Section 3: Enrolment ──
  { type: 'section', title: 'Enrolment', help: 'Start dates and what happens after a parent registers interest.' },
  { id: 'T10a', type: 'date', title: 'Start date of the October 2026 batch (the 2027 batch)' },
  {
    id: 'T10b', type: 'paragraph',
    title: '2027 term dates (if known)',
    help: 'e.g. Term 1: 2 Feb – 5 Apr. Rough dates are fine.',
  },
  {
    id: 'T10c', type: 'choice', other: true,
    title: 'Can students join mid-term?',
    choices: ['Yes, any time', 'Only at the start of a term', 'Case by case'],
  },
  {
    id: 'T11a', type: 'choice', other: true,
    title: 'Who contacts parents after they register interest?',
    choices: ['Ajay', 'Another tutor', 'An admin / coordinator'],
  },
  {
    id: 'T11b', type: 'checkbox', other: true,
    title: 'What happens on that first call or email?',
    choices: [
      "Discuss the child's needs and goals",
      'Book an assessment or trial class',
      'Recommend a group / class',
      'Explain fees',
      'Share term dates and timetable',
    ],
  },
  {
    id: 'T11c', type: 'choice', other: true,
    title: 'How quickly can we promise to get back to parents?',
    choices: ['Within 1 business day', 'Within 2 business days', 'Within 3 business days'],
  },

  // ── Section 4: Fees & free places ──
  { type: 'section', title: 'Fees & free places', help: 'Fees are not shown on the website. These questions are about how we describe free places.' },
  {
    id: 'T12a', type: 'choice', other: true,
    title: 'How should the website describe free places?',
    choices: [
      '"Families facing financial hardship can study with us free."',
      '"Fee support, including free places, is available for families who need it."',
      '"We believe every child should learn. Ask us about fee support."',
      'Do not mention free places on the website',
    ],
  },
  {
    id: 'T12b', type: 'choice', other: true,
    title: 'How should a family ask for a free place?',
    choices: [
      'A tick-box on the website form ("I would like to ask about fee support")',
      'Mention it in the form message',
      'Privately, during the first phone call',
    ],
  },
  {
    id: 'T12c', type: 'choice', other: true,
    title: 'Is there a limit on free places?',
    choices: ['No fixed limit', 'A limited number per term', 'Decided case by case'],
  },

  // ── Section 5: Team & results ──
  { type: 'section', title: 'Team & results', help: 'Everything we claim on the website must be accurate and checkable.' },
  {
    id: 'T13a', type: 'choice', other: true,
    title: 'The website says "a team of skilled teachers and professors". Is "professors" accurate?',
    help: '"Professors" usually means current or former university academics.',
    choices: [
      'Yes: keep "teachers and professors"',
      'No: use "experienced teachers and subject specialists"',
      'No: use "qualified teachers"',
    ],
  },
  {
    id: 'T13b', type: 'choice', other: true,
    title: 'Combined teaching experience of the team',
    choices: ['5+ years', '10+ years', '15+ years', '20+ years', '30+ years'],
  },
  {
    id: 'T14a', type: 'paragraph',
    title: 'Past results: selective school offers',
    help: 'e.g. "2025: 6 offers (3 Melbourne High, 2 Suzanne Cory, 1 Mac.Rob)". Rough numbers are fine.',
  },
  {
    id: 'T14b', type: 'paragraph',
    title: 'Other results (NAPLAN, ICAS, scholarships)',
  },
  {
    id: 'T14c', type: 'choice', other: true,
    title: 'Can we back these results up if asked?',
    choices: [
      'Yes: we have offer letters / records',
      'Partly: for some results',
      'Not yet',
    ],
  },
  {
    id: 'T14d', type: 'choice', other: true,
    title: 'Can we name successful students on the website (like an honour board)?',
    help: 'Students are minors, so we need written permission from a parent for each name.',
    choices: [
      'Yes: we already have written parent permission',
      'We can ask parents for permission',
      'Prefer not to name students: show numbers only',
    ],
  },

  // ── Wrap-up ──
  { type: 'section', title: 'Anything else?' },
  { type: 'paragraph', title: 'Anything else the website should say (or avoid saying)?' },
];

// ─── Builder ────────────────────────────────────────────────────────────────
function buildAjayForm() {
  const form = CONFIG.FORM_ID ? FormApp.openById(CONFIG.FORM_ID) : FormApp.create(CONFIG.TITLE);

  if (CONFIG.FORM_ID && CONFIG.CLEAR_EXISTING_QUESTIONS) {
    form.getItems().forEach((item) => form.deleteItem(item));
  }

  form
    .setTitle(CONFIG.TITLE)
    .setDescription(CONFIG.DESCRIPTION)
    .setConfirmationMessage(CONFIG.CONFIRMATION)
    .setProgressBar(true)
    .setAllowResponseEdits(true);

  QUESTIONS.forEach((q) => addQuestion(form, q));

  Logger.log('Edit the form:   ' + form.getEditUrl());
  Logger.log('Send to Ajay:    ' + form.getPublishedUrl());
}

function addQuestion(form, q) {
  const title = q.id ? `${q.title}  (${q.id})` : q.title;
  let item;

  switch (q.type) {
    case 'section':
      form.addPageBreakItem().setTitle(q.title).setHelpText(q.help || '');
      return;
    case 'checkbox':
      item = form.addCheckboxItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    case 'choice':
      item = form.addMultipleChoiceItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    case 'grid':
      item = form.addGridItem().setRows(q.rows).setColumns(q.columns);
      break;
    case 'checkboxGrid':
      item = form.addCheckboxGridItem().setRows(q.rows).setColumns(q.columns);
      break;
    case 'text':
      item = form.addTextItem();
      break;
    case 'paragraph':
      item = form.addParagraphTextItem();
      break;
    case 'date':
      item = form.addDateItem();
      break;
    default:
      throw new Error('Unknown question type: ' + q.type);
  }

  item.setTitle(title).setRequired(false);
  if (q.help) item.setHelpText(q.help);
}
