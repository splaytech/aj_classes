// All user-facing copy on the site, grouped by section (PRP Appendix A).
// To change any wording, edit it here. Components never contain text of their own.
// A section with empty content is hidden automatically.

import type { ContactMethod, EnquirerRole, EnquiryType } from './app.constants';
import type { SocialPlatform } from './business.constants';
import { SECTION_IDS } from './routes.constants';

export const TAGLINE = 'Every student can rise.';

export const LOGO = {
  alt: 'AJ Classes logo',
  wordmarkBold: 'AJ',
  wordmarkRegular: 'Classes',
};

export const A11Y = {
  skipToContent: 'Skip to main content',
  mainNavigation: 'Main navigation',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  homeLink: 'AJ Classes home',
  socialLinks: 'AJ Classes on social media',
  captcha: 'Spam protection check',
};

export const NAV = {
  links: [
    { label: 'Programmes', sectionId: SECTION_IDS.programmes },
    { label: 'Our Approach', sectionId: SECTION_IDS.approach },
    { label: 'About', sectionId: SECTION_IDS.about },
    { label: 'FAQ', sectionId: SECTION_IDS.faq },
    { label: 'Contact', sectionId: SECTION_IDS.contact },
  ],
  cta: 'Register Interest',
};

export const ANNOUNCEMENT = {
  icon: '🔥',
  text: 'Enrolling now for 2027:',
  cta: 'Register interest →',
};

export const HERO = {
  headline: 'AJ Classes: Selective Entry Exam & Interview Coaching',
  supporting:
    'Small-group coaching in Maths, Science and English for Years 5–10, plus NAPLAN preparation from Year 2. In person in Truganina or online anywhere in Australia.',
  primaryCta: 'Register Interest',
  secondaryCta: 'Ask a Question',
  proofPoints: [
    '7 selective school offers in 2026',
    '20+ years of teaching experience',
    'Small groups, twice a week',
  ],
  imageAlt: 'Illustration of three rising gold lines, representing students moving forward',
};

export const WHY_US = {
  heading: 'Why AJ Classes',
  cards: [
    {
      title: 'Exam and interview ready',
      text: 'We cover every part of selective entry, from reading, writing, maths and reasoning to mock interviews with written feedback.',
    },
    {
      title: 'Small groups, real attention',
      text: 'Two 1-hour classes a week in small groups (up to 10 students in person), so every student is seen, heard and challenged.',
    },
    {
      title: 'Qualified, checked teachers',
      text: 'Qualified teachers with more than 20 years of combined teaching experience, each holding a Working With Children Check.',
    },
    {
      title: 'Learning for everyone',
      text: 'We believe every child should learn. Ask us about fee support.',
    },
  ],
};

export const RESULTS = {
  heading: 'Our 2026 results',
  items: [
    {
      value: '7',
      label: 'Selective high school offers for Year 9',
      detail: '2 Melbourne High · 3 Suzanne Cory · 1 Mac.Robertson · 1 Nossal',
    },
    {
      value: '5',
      label: 'John Monash Science School offers',
      detail: '3 for Year 10 · 2 for Year 11',
    },
    {
      value: '3',
      label: 'Private school scholarships',
      detail: '',
    },
  ],
  note: 'Our students also exceeded expectations in NAPLAN and improved significantly in ICAS.',
};

export const PROGRAMMES = {
  heading: 'Programmes',
  intro: 'Small-group classes and coaching from Year 2 through to university entry.',
  newBadge: 'New',
  items: [
    {
      title: 'Selective entry exam preparation',
      years: 'Years 6–10',
      text: 'Reading comprehension, creative and persuasive writing, mathematics, and verbal and quantitative reasoning, with timed practice under exam conditions.',
      isNew: false,
    },
    {
      title: 'Selective school and scholarship interviews',
      years: 'Years 8–10',
      text: 'One-on-one and group mock interviews, coaching on common questions, help with applications and written feedback. For Melbourne High, Mac.Robertson, Nossal, Suzanne Cory, John Monash Science School and private school scholarships.',
      isNew: false,
    },
    {
      title: 'SEAL and scholarship preparation',
      years: '',
      text: 'Preparation for SEAL program entry and private school scholarship exams.',
      isNew: false,
    },
    {
      title: 'NAPLAN',
      years: 'Years 2–9',
      text: 'Preparation starts in Year 2, ahead of the first NAPLAN in Year 3.',
      isNew: false,
    },
    {
      title: 'ICAS',
      years: 'Years 5–10',
      text: 'Preparation for the ICAS academic competitions.',
      isNew: false,
    },
    {
      title: 'Maths, Science and English tutoring',
      years: 'Years 5–10',
      text: 'Regular term-by-term tutoring to build strong foundations and keep students ahead at school.',
      isNew: false,
    },
    {
      title: 'VCE subject-selection counselling',
      years: '',
      text: 'Sessions with students and parents together, with complete guidance on choosing VCE subjects.',
      isNew: false,
    },
    {
      title: 'UCAT and GAMSAT preparation',
      years: '',
      text: 'Preparation for medical and health-science entry tests. Enrolments are open now, and classes start in January 2027.',
      isNew: true,
    },
  ],
};

export const APPROACH = {
  heading: 'Our Approach',
  paragraphs: [
    'At AJ Classes, we believe every student can rise with the right guidance at the right time. We teach in small groups, so each student gets real attention while learning alongside motivated peers.',
    "Selective entry isn't only about the exam. We build strong foundations in Maths, Science and English, sharpen exam technique under timed conditions, and prepare students to speak with confidence at interview.",
    "Parents are part of the journey too. We keep you informed about your child's progress and next steps.",
  ],
  steps: [
    {
      name: 'Assess',
      text: 'An initial assessment shows where your child is today: their strengths, gaps and goals.',
    },
    {
      name: 'Plan',
      text: 'We place them in the right small group and set clear targets for the term.',
    },
    {
      name: 'Practise',
      text: 'Twice-weekly classes build skills, then timed practice builds exam confidence.',
    },
    {
      name: 'Review',
      text: 'Regular feedback and progress updates, then interview preparation when it counts.',
    },
  ],
};

export const ABOUT = {
  heading: 'About Us',
  story:
    "AJ Classes started with a simple belief: every child can learn and rise, whatever their background. From our home-based classroom in Truganina, and online for families across Australia, we prepare students for Victoria's selective entry high schools, from the exam through to the interview, and support them from their first NAPLAN to choosing VCE subjects and beyond. We keep our groups small and our standards high, and we offer fee support so that more motivated students can learn with us.",
  teamHeading: 'Our team',
  team: 'Our qualified teachers bring more than 20 years of combined teaching experience in Maths, Science and English, and in preparing students for selective entry exams and interviews.',
  badge: 'Working With Children Check held',
};

export const FAQ = {
  heading: 'Frequently Asked Questions',
  items: [
    {
      question: 'What is the Victorian selective entry exam?',
      answer:
        "Victoria's selective entry high schools offer places for Year 9 through a statewide entrance exam that students sit in Year 8. The exam tests skills such as reading, writing, mathematics and reasoning. We cover every section: reading comprehension, creative and persuasive writing, mathematics, and verbal and quantitative reasoning. Places are highly competitive, so early, structured preparation makes a real difference.",
    },
    {
      question: 'Which year levels does AJ Classes teach?',
      answer:
        'NAPLAN preparation starts in Year 2, and Maths, Science and English tutoring runs from Year 5 to Year 10. Selective entry exam preparation runs from Year 6, and interview coaching from Year 8. We also offer SEAL and scholarship preparation, VCE subject-selection counselling, and UCAT and GAMSAT preparation (classes start January 2027).',
    },
    {
      question: 'Do you help with choosing VCE subjects?',
      answer:
        "Yes. We run counselling sessions with students and their parents together, giving complete guidance on choosing VCE subjects that suit the student's strengths, interests and future goals.",
    },
    {
      question: 'Are classes online or in person?',
      answer:
        'Both. We run small in-person classes from our home-based centre in Truganina, and live online classes for students anywhere in Australia.',
    },
    {
      question: 'How big are the groups?',
      answer:
        'In-person groups have up to 10 students, so everyone gets attention; online group sizes vary. Classes are live and teacher-led, and run for 1 hour, twice a week.',
    },
    {
      question: 'How do I enrol?',
      answer:
        "Register your interest using the form on this page. We'll contact you by phone or email (your choice) within 3 business days to book an initial assessment, explain fees, and share term dates and the timetable. Our 2027 batch starts on 12 October 2026. Joining mid-term is considered case by case.",
    },
    {
      question: 'How much are the fees?',
      answer:
        "We'll explain fees on our first call. We believe every child should learn, so please ask us about fee support.",
    },
    {
      question: 'Are your teachers checked and qualified?',
      answer:
        'Yes. All our teachers are qualified, with more than 20 years of combined teaching experience, and each holds a current Working With Children Check.',
    },
  ],
};

export const ENQUIRY_TYPE_LABELS: Record<EnquiryType, string> = {
  registerInterest: 'Register interest for enrolment',
  generalQuestion: 'General question',
  other: 'Other',
};

export const ENQUIRER_ROLE_LABELS: Record<EnquirerRole, string> = {
  parent: 'Parent',
  student: 'Student',
  other: 'Other',
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: 'Phone call',
  email: 'Email',
};

export const CONTACT_FORM = {
  heading: 'Register your interest',
  intro:
    "Tell us a little about your child and how you'd like us to contact you. There's no obligation.",
  responsePromise: "We'll call or email you (your choice) within 3 business days.",
  labels: {
    name: 'Your name',
    email: 'Email',
    phone: 'Phone',
    contactMethod: 'How should we contact you?',
    role: 'I am a…',
    enquiryType: 'Enquiry type',
    yearLevel: "Student's year level",
    message: 'Message',
    updatesConsent: 'Email me about AJ Classes updates and enrolment openings.',
  },
  yearLevelPlaceholder: 'Select a year level (optional)',
  yearLevelPrefix: 'Year',
  yearLevelOther: 'University / graduate (UCAT, GAMSAT)',
  optional: '(optional)',
  privacyNoticeBefore: 'By submitting, you agree to our',
  privacyLinkText: 'Privacy Policy',
  privacyNoticeAfter: '.',
  space: ' ',
  submit: 'Register interest',
  submitting: 'Sending…',
  emailSubjectPrefix: '[AJ Classes]',
  yes: 'Yes',
  no: 'No',
  success: (contactMethod: ContactMethod) =>
    `Thank you! We've received your details and will contact you by ${contactMethod === 'phone' ? 'phone' : 'email'} within 3 business days.`,
};

export const SUBSCRIBE = {
  heading: 'Stay in the loop',
  blurb: 'News, events and enrolment updates from AJ Classes. No spam, unsubscribe any time.',
  emailLabel: 'Email address',
  consent: 'Send me AJ Classes news, events and enrolment updates. Unsubscribe any time.',
  submit: 'Subscribe',
  submitting: 'Subscribing…',
  success: "You're subscribed. Thanks for staying in touch!",
  emailSubject: '[AJ Classes] New subscriber',
};

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
};

export const FOOTER = {
  followHeading: 'Follow AJ Classes',
  contactHeading: 'Contact',
  location: 'Truganina VIC · Online across Australia',
  privacyLink: 'Privacy Policy',
  copyright: (year: number) => `© ${year} AJ Classes. All rights reserved.`,
};

export const PRIVACY = {
  heading: 'Privacy Policy',
  lastUpdated: 'Last updated: October 2026',
  intro:
    'AJ Classes ("we", "us") respects your privacy. This notice explains what personal information we collect through ajclasses.com.au and how we use it.',
  sections: [
    {
      heading: 'What we collect',
      text: "When you register interest, contact us or subscribe, we collect the details you give us: your name, email address, phone number (if provided), your preferred contact method, whether you are a parent or student, your child's year level and your message. We don't ask for sensitive information.",
    },
    {
      heading: 'Why we collect it',
      text: 'To respond to your enquiry, contact you in the way you prefer, and, if you ticked the box or subscribed, send you news and enrolment updates. You can unsubscribe at any time.',
    },
    {
      heading: 'Who handles it',
      text: "Form submissions are delivered to us by email through a form-processing service (Web3Forms), which may process data outside Australia. To block spam, our forms use hCaptcha, which checks that you are a person and may process your IP address and browser information. Our website is hosted by Vercel, and we use Vercel Web Analytics, which is cookieless and does not identify you personally. We don't sell or share your information with anyone for marketing.",
    },
    {
      heading: 'How long we keep it',
      text: 'Only as long as we need it to respond to you and provide our services, then we delete it.',
    },
    {
      heading: 'Children',
      text: 'Our students are school-aged. We ask parents or guardians to make enquiries on behalf of children where possible.',
    },
    {
      heading: 'Access and correction',
      text: 'You can ask to see, correct or delete the information we hold about you by emailing hello@ajclasses.com.au.',
    },
    {
      heading: 'Complaints',
      text: "If you have a privacy concern, email us first. If you're not satisfied with our response, you can contact the Office of the Australian Information Commissioner (oaic.gov.au).",
    },
  ],
  backHome: '← Back to home',
};
