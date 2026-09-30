// SEO metadata for each page (PRP F6). Business facts come from business.constants.ts.

export const SEO = {
  home: {
    title: 'AJ Classes | Selective Entry Exam Tutoring in Melbourne',
    description:
      'AJ Classes offers expert coaching for the Victorian selective entry high school exam and interview. Small groups for Years 2–10, in Truganina or online. Register your interest today.',
  },
  privacy: {
    title: 'Privacy Policy | AJ Classes',
    description: 'How AJ Classes collects, uses and protects your personal information.',
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
    'Mathematics',
    'Science',
    'English',
  ],
} as const;

export const ROBOTS = {
  allowAll: 'User-agent: *\nAllow: /',
} as const;
