// Mock tests (docs/delivery/2026-11-17-mock-tests): every limit, label and word on the admin and
// taker pages. The database enforces the same limits. The feature is called "mock test" everywhere,
// and nothing here talks about price (AC 9, AC 41).

import {
  QUESTION_LIMITS,
  QUESTION_VALIDATION,
  QUESTION_DIALOG,
} from './online-assignments.constants';

/**
 * Prompt, option and explanation limits are the assignment ones (QUESTION_LIMITS), so the two
 * features cannot drift apart. Only the limits of the test itself are new.
 */
export const MOCK_TEST_LIMITS = {
  titleMin: 2,
  titleMax: 150,
  instructionsMax: 4000,
  questionsMax: 100,
} as const;

export const MOCK_TEST_STATUSES = ['draft', 'released'] as const;

export const MOCK_TEST_STATUS_LABELS = {
  draft: 'Draft',
  released: 'Released',
} as const satisfies Record<(typeof MOCK_TEST_STATUSES)[number], string>;

export const MOCK_TAKE_STATUSES = ['not_started', 'in_progress', 'submitted'] as const;

export const MOCK_TAKE_STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
} as const satisfies Record<(typeof MOCK_TAKE_STATUSES)[number], string>;

function questionCountText(count: number): string {
  return count === 1 ? '1 question' : `${count} questions`;
}

export const MOCK_TESTS_ADMIN_PAGE = {
  heading: 'Mock tests',
  intro:
    'Write mock tests here. Students, parents and signed-up users can take them once released.',
  newButton: 'New mock test',
  empty: 'No mock tests yet.',
  tableLabel: 'Mock tests',
  columns: {
    title: 'Title',
    status: 'Status',
    questions: 'Questions',
    submitted: 'Submitted',
    createdBy: 'Created by',
    changed: 'Last changed',
  },
} as const;

export const MOCK_TEST_DIALOG = {
  newHeading: 'New mock test',
  editHeading: 'Edit mock test',
  titleLabel: 'Title',
  instructionsLabel: 'Instructions (optional)',
  instructionsHint: 'Shown before the mock test starts. Plain text. Line breaks are kept.',
  create: 'Create mock test',
  creating: 'Creating…',
  save: 'Save',
  saving: 'Saving…',
} as const;

export const MOCK_QUESTION_DIALOG = {
  newHeading: 'New question',
  editHeading: 'Edit question',
  promptLabel: QUESTION_DIALOG.promptLabel,
  promptHint: QUESTION_DIALOG.promptHint,
  optionsLegend: QUESTION_DIALOG.optionsLegend,
  optionLabel: QUESTION_DIALOG.optionLabel,
  correctLabel: QUESTION_DIALOG.correctLabel,
  addOption: QUESTION_DIALOG.addOption,
  removeOption: QUESTION_DIALOG.removeOption,
  explanationLabel: 'Explanation (optional)',
  explanationHint: 'Shown with the correct answer once the mock test has been submitted.',
  save: QUESTION_DIALOG.save,
  saving: QUESTION_DIALOG.saving,
} as const;

export const MOCK_QUESTION_LIST = {
  heading: 'Questions',
  count: (count: number) => `${count} of ${MOCK_TEST_LIMITS.questionsMax} questions`,
  empty: 'No questions yet.',
  add: 'Add question',
  edit: 'Edit',
  delete: 'Delete',
  number: (position: number) => `Question ${position}`,
  correct: 'Correct answer',
  explanation: (text: string) => `Explanation: ${text}`,
  moveUp: (position: number) => `Move question ${position} up`,
  moveDown: (position: number) => `Move question ${position} down`,
  confirmDeleteTitle: 'Delete this question?',
  confirmDeleteText: (position: number) => `Question ${position} will be removed.`,
  limitReached: `You’ve reached the limit of ${MOCK_TEST_LIMITS.questionsMax} questions.`,
  lockedNote: 'This mock test is released, so its questions can’t change.',
} as const;

export const MOCK_TEST_EDIT_PAGE = {
  back: '← All mock tests',
  detailsHeading: 'Details',
  instructionsHeading: 'Instructions',
  noInstructions: 'No instructions.',
  editDetails: 'Edit details',
  detailsSaved: 'Details saved.',
  draftNote: 'Draft: only admins can see this mock test. Release it when it is ready.',
  releasedNote:
    'Released: students, parents and signed-up users can take it. It can only go back to draft if nobody has started it.',
  release: 'Release',
  releasing: 'Releasing…',
  releaseNeedsQuestions: 'Add at least one question to release this mock test.',
  confirmReleaseTitle: 'Release this mock test?',
  confirmReleaseText:
    'Students, parents and signed-up users will be able to take it free of cost. Questions and details can’t be changed after this.',
  released: 'Released. People can take it now.',
  takeBack: 'Take back to draft',
  takingBack: 'Taking back…',
  confirmTakeBackTitle: 'Take this mock test back to draft?',
  confirmTakeBackText:
    'People won’t see it until you release it again. This only works while nobody has started it.',
  takenBack: 'Back to draft.',
  deleteDraft: 'Delete draft',
  confirmDeleteTitle: 'Delete this draft?',
  confirmDeleteText: (title: string) => `“${title}” and its questions will be removed.`,
} as const;

export const MOCK_TESTS_LIST = {
  heading: 'Mock tests',
  intro: 'Free practice. You get one go at each mock test.',
  empty: 'No mock tests yet.',
  questions: questionCountText,
  actions: {
    not_started: 'Start',
    in_progress: 'Continue',
    submitted: 'View result',
  } as const satisfies Record<(typeof MOCK_TAKE_STATUSES)[number], string>,
} as const;

export const MOCK_TAKE_PAGE = {
  back: '← All mock tests',
  instructionsHeading: 'Instructions',
  noInstructions: 'No instructions.',
  questions: questionCountText,
  start: 'Start',
  starting: 'Starting…',
  questionOf: (position: number, total: number) => `Question ${position} of ${total}`,
  optionsLabel: (position: number) => `Answer for question ${position}`,
  previous: 'Previous',
  next: 'Next',
  answered: (answered: number, total: number) => `Answered ${answered} of ${total}`,
  saving: 'Saving…',
  saved: 'Saved',
  notSaved: 'Not saved',
  saveFailed: 'Not saved. Check your connection, then choose your answer again.',
  submit: 'Submit',
  submitting: 'Submitting…',
  confirmSubmitTitle: 'Submit this mock test?',
  confirmSubmitText: (unanswered: number) =>
    unanswered === 0
      ? 'You’ve answered every question. You can’t change your answers after this.'
      : `${unanswered === 1 ? '1 question isn’t' : `${unanswered} questions aren’t`} answered yet and will count as incorrect. You can’t change your answers after this.`,
} as const;

export const MOCK_RESULT = {
  heading: 'Your result',
  score: (score: number, total: number) => `${score} of ${total} correct`,
  answersHeading: 'Your answers',
  question: (position: number) => `Question ${position}`,
  yourAnswer: 'Your answer',
  correctAnswer: 'Correct answer',
  noAnswer: 'No answer.',
  explanation: 'Explanation',
} as const;

export const MOCK_TESTS_ERROR_BOUNDARY = {
  heading: 'Something went wrong',
  text: "This page couldn't be shown. Please try again, and contact AJ Classes if it keeps happening.",
  tryAgain: 'Try again',
} as const;

export const MOCK_TESTS_LINK_CARD = {
  heading: 'Mock tests',
  text: 'Practise for free with the mock tests we have released.',
  link: 'See mock tests',
} as const;

export const MOCK_VALIDATION = {
  title: `Please give the mock test a title (${MOCK_TEST_LIMITS.titleMin}–${MOCK_TEST_LIMITS.titleMax} characters).`,
  instructions: `Please keep the instructions under ${MOCK_TEST_LIMITS.instructionsMax} characters.`,
  prompt: QUESTION_VALIDATION.promptLength,
  optionsCount: `A question needs ${QUESTION_LIMITS.optionsMin}–${QUESTION_LIMITS.optionsMax} options.`,
  optionLength: QUESTION_VALIDATION.optionLength,
  correctOption: QUESTION_VALIDATION.correctOption,
  explanation: QUESTION_VALIDATION.explanationLength,
} as const;
