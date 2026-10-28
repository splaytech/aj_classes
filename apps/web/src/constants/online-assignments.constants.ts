// Online assignments for staff (R3b stories FT1–FT3): questions, publishing, submissions and
// marking. The database enforces the same limits (R3b design §3).

export const QUESTION_LIMITS = {
  promptMax: 2000,
  optionsMin: 2,
  optionsMax: 6,
  optionMax: 300,
  marksMin: 1,
  marksMax: 100,
  explanationMax: 2000,
  questionsMax: 50,
  answerMax: 5000,
  answerFeedbackMax: 1000,
} as const;

export const QUESTION_KINDS = ['multiple_choice', 'written'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  multiple_choice: 'Multiple choice',
  written: 'Written answer',
};

export const ASSIGNMENT_STATE_LABELS = {
  draft: 'Draft',
  published: 'Published',
} as const;

/** Online work as staff see it: the student moves it along until it's returned. */
export const ONLINE_STATUS_LABELS = {
  not_submitted: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  marked: 'Submitted',
  returned: 'Returned',
} as const;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export const PUBLISHING = {
  draftNote:
    'Draft: students and parents can’t see this yet. Add questions for online work, or publish it as paper homework.',
  publish: 'Publish to class',
  publishing: 'Publishing…',
  confirmPublishTitle: 'Publish this assignment?',
  confirmPublishText: (className: string, online: boolean) =>
    online
      ? `Every student in ${className} will see it and can start answering. Questions can’t be changed after this.`
      : `Every student in ${className} and their parents will see it.`,
  published: 'Published. Students can see it now.',
  unpublish: 'Back to draft',
  confirmUnpublishTitle: 'Move back to draft?',
  confirmUnpublishText:
    'Students won’t see it until you publish again. This is only possible until someone starts.',
  unpublished: 'Moved back to draft.',
  noQuestionsYet: 'No questions: this will be paper homework.',
} as const;

export const QUESTION_BUILDER = {
  heading: 'Questions',
  total: (marks: number) => (marks === 1 ? 'Total 1 mark' : `Total ${marks} marks`),
  empty: 'No questions yet. Without questions, students hand this in on paper.',
  add: 'Add question',
  lockedNote: 'Questions are locked because the assignment is published.',
  number: (position: number) => `Question ${position}`,
  marks: (marks: number) => (marks === 1 ? '1 mark' : `${marks} marks`),
  correct: 'Correct answer',
  explanation: (text: string) => `Explanation (shown after return): ${text}`,
  edit: 'Edit',
  delete: 'Delete',
  moveUp: (position: number) => `Move question ${position} up`,
  moveDown: (position: number) => `Move question ${position} down`,
  confirmDeleteTitle: 'Delete this question?',
  confirmDeleteText: (position: number) => `Question ${position} will be removed.`,
  limitReached: `You’ve reached the limit of ${QUESTION_LIMITS.questionsMax} questions.`,
} as const;

/** The "hold results" switch on a draft with questions (ADR-0007, item 7). */
export const HOLD_RESULTS = {
  label: 'Hold results until I return them',
  // Short for phones (actionItems 27c): 3 lines at 360 px, from 5. Rule: ADR-0007.
  hint: 'Marks and answers stay hidden until you return the work. Any written question holds it all.',
  lockedNote: 'Locked because the assignment is published. Move it back to draft to change this.',
} as const;

export const QUESTION_DIALOG = {
  newHeading: 'New question',
  editHeading: 'Edit question',
  kindLabel: 'Type',
  promptLabel: 'Question',
  promptHint: 'Plain text. Line breaks are kept.',
  optionsLegend: 'Options (choose the correct one)',
  optionLabel: (letter: string) => `Option ${letter}`,
  correctLabel: (letter: string) => `Option ${letter} is correct`,
  addOption: 'Add option',
  removeOption: (letter: string) => `Remove option ${letter}`,
  marksLabel: 'Marks',
  explanationLabel: 'Explanation (optional)',
  explanationHint: 'Students and parents see this after the work is returned.',
  save: 'Save question',
  saving: 'Saving…',
} as const;

export const QUESTION_VALIDATION = {
  promptLength: `Please write the question (up to ${QUESTION_LIMITS.promptMax} characters).`,
  optionsCount: `Multiple choice needs ${QUESTION_LIMITS.optionsMin}–${QUESTION_LIMITS.optionsMax} options.`,
  optionLength: `Fill in every option (up to ${QUESTION_LIMITS.optionMax} characters each).`,
  correctOption: 'Choose the correct option.',
  marksRange: `Marks must be a whole number from ${QUESTION_LIMITS.marksMin} to ${QUESTION_LIMITS.marksMax}.`,
  explanationLength: `Please keep the explanation under ${QUESTION_LIMITS.explanationMax} characters.`,
} as const;

export const SUBMISSIONS = {
  heading: 'Submissions',
  columns: {
    student: 'Student',
    status: 'Status',
    submitted: 'Handed in',
    score: 'Score',
    open: '',
  },
  late: 'Late',
  score: (mark: string, total: number) => `${mark} / ${total}`,
  open: 'Mark',
  view: 'View',
  noStudents: 'No students are in this class yet.',
  draftNote: 'Publish the assignment to start collecting work.',
  progress: (returned: number, total: number) => `Returned ${returned} of ${total}`,
} as const;

export const SUBMISSION_PAGE = {
  back: (title: string) => `← ${title}`,
  heading: (student: string) => `${student}’s work`,
  submittedOn: (date: string) => `Handed in ${date}`,
  returnedOn: (date: string) => `Returned ${date}`,
  late: 'Late',
  score: (mark: string, total: number) => `Score ${mark} / ${total}`,
  notSubmitted: 'Not handed in yet. Answers can be marked once the student submits.',
  noAnswer: 'No answer.',
  chosen: 'Their answer',
  correct: 'Correct answer',
  autoMarked: (awarded: string, marks: number) => `${awarded} / ${marks} (marked automatically)`,
  marksLabel: (marks: number) => `Marks (out of ${marks})`,
  feedbackLabel: 'Feedback on this answer (optional)',
  commentHeading: 'Comment for the student and their parents',
  commentLabel: 'Overall comment',
  commentHint: 'Shown with the marks once the work is returned.',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  returnWork: 'Return to student',
  returning: 'Returning…',
  confirmReturnTitle: 'Return this work?',
  confirmReturnText: (student: string) =>
    `${student} and their parents will see the marks, feedback and comment.`,
  returned: 'Returned. The student and their parents can see the marks now.',
  returnedNote:
    'Already returned: changes you save are shown to the student and parents straight away.',
  needsAllMarks: 'Give every answer a mark before returning.',
  markRange: (marks: number) => `Enter a mark from 0 to ${marks}.`,
  feedbackLength: `Please keep feedback under ${QUESTION_LIMITS.answerFeedbackMax} characters.`,
  questionNumber: (position: number) => `Question ${position}`,
} as const;
