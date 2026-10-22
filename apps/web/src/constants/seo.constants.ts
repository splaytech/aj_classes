// SEO metadata for each page (PRP F6). Business facts come from business.constants.ts.

import { BUSINESS } from './business.constants';

export const SEO = {
  home: {
    title: 'AJ Classes | Selective Entry Exam Tutoring in Melbourne',
    description: `AJ Classes offers expert coaching for the Victorian selective entry exam and interview, plus NAPLAN, ICAS, scholarship, UCAT and GAMSAT preparation. Small groups in ${BUSINESS.suburbsText}, or online.`,
  },
  privacy: {
    title: 'Privacy Policy | AJ Classes',
    description: 'How AJ Classes collects, uses and protects your personal information.',
  },
  subscribed: {
    title: 'Subscribed | AJ Classes',
    description: 'Thanks for subscribing to the AJ Classes weekly update.',
  },
  notFound: {
    title: 'Page not found | AJ Classes',
    description: 'This page could not be found.',
  },
} as const;

export const SOCIAL_PREVIEW = {
  imagePath: '/og-image.png',
  imageWidth: '1200',
  imageHeight: '630',
  imageAlt: 'AJ Classes: Selective Entry Exam Tutoring',
  shortDescription:
    'Expert coaching for the Victorian selective entry exam. Register your interest today.',
} as const;

export const STRUCTURED_DATA = {
  description: 'Expert coaching for the Victorian selective entry high school exam and interview.',
  logoPath: '/logo-512.png',
  knowsAbout: [
    'Victorian Selective Entry High School Exam',
    'Selective school exam preparation',
    'Selective school interview preparation',
    'NAPLAN',
    'ICAS',
    'VCE subject selection counselling',
    'SEAL program preparation',
    'Private school scholarship preparation',
    'John Monash Science School entry',
    'UCAT preparation',
    'GAMSAT preparation',
    'Mathematics',
    'Science',
    'English',
  ],
} as const;

export const ROBOTS = {
  rules: 'User-agent: *\nAllow: /\nDisallow: /portal', // staff pages stay out of search (R2a)
  disallowAll: 'User-agent: *\nDisallow: /', // staging and dev (environments.md G6)
} as const;
