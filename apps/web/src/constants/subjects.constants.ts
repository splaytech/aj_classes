// Subjects a tutor can choose on their profile (R2a story US12).
//
// PLACEHOLDER LIST: to be confirmed by the owner (R2a review Q1).
// Only the `key` is saved in the database, so labels can change freely. Removing a subject hides it
// on profiles but keeps it in saved data (review G9, V28). Keys: lower case, letters/digits/dashes.

export const SUBJECTS = [
  { key: 'maths', label: 'Maths' },
  { key: 'english', label: 'English' },
  { key: 'science', label: 'Science' },
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
  { key: 'numerical-reasoning', label: 'Numerical reasoning' },
  { key: 'verbal-reasoning', label: 'Verbal reasoning' },
  { key: 'interview-preparation', label: 'Interview preparation' },
] as const;

export type SubjectKey = (typeof SUBJECTS)[number]['key'];
