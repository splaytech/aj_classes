// "We're hiring" page (/careers, we-are-hiring 01). People apply by emailing the public inbox
// with a prefilled subject; the site stores nothing about applicants (DEC-WH-1).
// All wording is draft for the owner to confirm (01 Q1-Q6). Only business facts already in
// business.constants.ts are used: never a person's name, a street address or the ABN.

import { BUSINESS } from './business.constants';

// Used by both the visible copy and the mailto link, so the two can never disagree.
const APPLY_SUBJECT = 'Tutor application';

export const CAREERS = {
  footerLink: "We're hiring",
  heading: "We're hiring",
  intro: `AJ Classes is growing, and we're looking for tutors to join our small team. We teach small groups in person in ${BUSINESS.suburbsText}, and online across Australia.`,
  rolesHeading: 'Roles',
  roles: ['Tutor (casual)'],
  lookingFor: {
    heading: "Who we're looking for",
    points: [
      'People who enjoy helping students learn and build confidence.',
      'Strong in one or more of Maths, Science or English, or in exam preparation (selective entry, scholarship, NAPLAN or ICAS).',
      'Comfortable teaching small groups, primary to Year 10.',
      'Reliable, patient and clear communicators.',
    ],
  },
  needs: {
    heading: "What you'll need",
    points: [
      'A current Victorian Working with Children Check (or VIT registration), or a willingness to get one before you start.',
      'The right to work in Australia.',
      'Tutoring or teaching experience is a plus but not essential.',
    ],
  },
  apply: {
    heading: 'How to apply',
    text: `Email us at ${BUSINESS.email} with "${APPLY_SUBJECT}" in the subject. Tell us about your subjects, year levels and experience, and attach your CV. We'll only use your details to consider your application.`,
    linkText: 'Email your application',
    subject: APPLY_SUBJECT,
  },
  backHome: 'Back to home',
  seo: {
    title: 'Careers | AJ Classes',
    description: `AJ Classes is looking for tutors in ${BUSINESS.suburbsText}, and online. See who we're looking for and how to apply.`,
  },
  // Same wording as the posts page's boundary, retyped so careers doesn't depend on posts.
  errorBoundary: {
    heading: 'Something went wrong',
    text: "This page couldn't be shown. Please try again later.",
    backHome: 'Back to the home page',
  },
} as const;

/** A mailto link to the public inbox with the application subject already filled in. */
export function careersApplyHref(): string {
  return `mailto:${BUSINESS.email}?subject=${encodeURIComponent(CAREERS.apply.subject)}`;
}
