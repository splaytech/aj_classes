// All user-facing copy on the site, grouped by section (PRP Appendix A).
// To change any wording, edit it here. Components never contain text of their own.
// A section with empty content is hidden automatically.

import { BUSINESS } from './business.constants';
import type { SocialPlatform } from './business.constants';
import { PROGRAMMES, PROGRAMME_SLUGS } from './programmes.constants';
import { SECTION_IDS, programmePath } from './routes.constants';

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
  captcha: 'Spam protection check', // the Turnstile check on portal sign-in
};

// Where classes run. Shown in the footer and the contact details card.
const LOCATION = `${BUSINESS.suburbsText} VIC · Online across Australia`;

// Header links. A link can have sub-links (shown as a small dropdown on desktop, indented in
// the phone menu). Programmes lists every programme page, with a "New" tag where it applies.
export const NAV = {
  links: [
    {
      label: 'Programmes',
      sectionId: SECTION_IDS.programmes,
      subLinks: PROGRAMMES.items.map((programme) => ({
        id: programme.slug,
        label: programme.menuLabel,
        href: programmePath(programme.slug),
        isNew: programme.isNew,
      })),
    },
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
  supporting: `Small-group coaching in Maths, Science and English for Years 5–10, plus NAPLAN preparation from Year 2. In person in ${BUSINESS.suburbsText}, or online anywhere in Australia.`,
  primaryCta: 'Register Interest',
  secondaryCta: 'Ask a Question',
  proofPoints: [
    '10 selective school offers in 2026',
    '20+ years of teaching experience',
    'Small groups, twice a week',
  ],
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
      title: 'Aligned to the Victorian Curriculum',
      text: 'Our Maths, Science and English lessons follow what is taught in Victorian schools, so classes support schoolwork as well as exams.',
    },
    {
      title: 'A plan for every student',
      text: 'An initial assessment shows where your child stands, then we set personalised targets for the term.',
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

export type ResultId = 'selective' | 'jmss' | 'scholarships';

type ResultItem = {
  id: ResultId;
  value: string;
  label: string;
  /** What the figure is made of, shown as a list (ui-polish.md §3, item 1). */
  breakdown: readonly { label: string; value: string }[];
  /** One line of context, for cards with little or no breakdown (general facts only). */
  about?: string;
  /** Short ticked points about how we prepared these students (our own services only). */
  highlights?: readonly string[];
  /** The programme that prepares for it, at the bottom of the card. */
  link: { href: string; label: string };
};

export const RESULTS = {
  heading: 'Our 2026 results',
  /** Visible text of every card's link; screen readers hear the full `link.label`. */
  linkText: 'How we prepare',
  items: [
    {
      id: 'selective',
      value: '10',
      label: 'Selective high school offers for Year 9',
      breakdown: [
        { label: 'Melbourne High School', value: '4' },
        { label: 'Suzanne Cory High School', value: '4' },
        { label: "The Mac.Robertson Girls' High School", value: '1' },
        { label: 'Nossal High School', value: '1' },
      ],
      link: {
        href: programmePath(PROGRAMME_SLUGS.selectiveEntry),
        label: 'How we prepare for the selective entry exam',
      },
    },
    {
      id: 'jmss',
      value: '5',
      label: 'John Monash Science School offers',
      breakdown: [
        { label: 'Year 10', value: '3' },
        { label: 'Year 11', value: '2' },
      ],
      about:
        "Victoria's specialist senior secondary school for science, maths and technology, with entry from Year 10.",
      link: {
        href: programmePath(PROGRAMME_SLUGS.selectiveEntry),
        label: 'How we prepare for entry exams',
      },
    },
    {
      id: 'scholarships',
      value: '3',
      label: 'Private school scholarships',
      breakdown: [],
      about:
        "Scholarships are usually awarded after the school's own scholarship exam, often followed by an interview.",
      highlights: [
        'Practice in the style and timing of each school’s scholarship exam',
        'Mock interviews with written feedback',
      ],
      link: {
        href: programmePath(PROGRAMME_SLUGS.sealAndScholarships),
        label: 'How we prepare for scholarships',
      },
    },
  ] satisfies readonly ResultItem[],
  note: 'Our students also exceeded expectations in NAPLAN and improved significantly in ICAS.',
};

export type ApproachStepId = 'assess' | 'plan' | 'practise' | 'review';

type ApproachStep = { id: ApproachStepId; name: string; text: string };

export const APPROACH = {
  heading: 'Our Approach',
  paragraphs: [
    'At AJ Classes, we believe every student can rise with the right guidance at the right time. We teach in small groups, so each student gets real attention while learning alongside motivated peers.',
    "Selective entry isn't only about the exam. We build strong foundations in Maths, Science and English, sharpen exam technique under timed conditions, and prepare students to speak with confidence at interview.",
    "Parents are part of the journey too. We keep you informed about your child's progress and next steps.",
  ],
  stepLabel: (step: number, total: number) => `Step ${step} of ${total}`,
  steps: [
    {
      id: 'assess',
      name: 'Assess',
      text: 'An initial assessment shows where your child is today: their strengths, gaps and goals.',
    },
    {
      id: 'plan',
      name: 'Plan',
      text: 'We place them in the right small group and set personalised targets for the term.',
    },
    {
      id: 'practise',
      name: 'Practise',
      text: 'Twice-weekly classes build skills, then timed practice builds exam confidence.',
    },
    {
      id: 'review',
      name: 'Review',
      text: 'Regular feedback and progress updates, then interview preparation when it counts.',
    },
  ] satisfies readonly ApproachStep[],
};

export const ABOUT = {
  heading: 'About Us',
  story: `AJ Classes started with a simple belief: every child can learn and rise, whatever their background. From our classrooms in ${BUSINESS.suburbsText}, and online for families across Australia, we prepare students for Victoria's selective entry high schools, from the exam through to the interview, and support them from their first NAPLAN to choosing VCE subjects and beyond. We keep our groups small and our standards high, and we offer fee support so that more motivated students can learn with us.`,
  teamHeading: 'Our team',
  team: 'Our qualified teachers bring more than 20 years of combined teaching experience in Maths, Science and English, and in preparing students for selective entry exams and interviews.',
  badge: 'Working With Children Check held',
  // The badge links to the Victorian Government's WWC Check page (checked 22 Oct 2026).
  badgeUrl: 'https://www.vic.gov.au/working-with-children-check',
  badgeLinkLabel:
    'Working With Children Check held: about the check on vic.gov.au (opens in a new tab)',
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
      answer: `Both. We run small in-person classes in ${BUSINESS.suburbsText}, and live online classes for students anywhere in Australia.`,
    },
    {
      question: 'How big are the groups?',
      answer:
        'In-person groups have up to 10 students, so everyone gets attention; online group sizes vary. Classes are live and teacher-led, and run for 1 hour, twice a week.',
    },
    {
      question: 'How do I enrol?',
      answer:
        "Register your interest using the form on this page. We'll get back to you within 3 business days to book an initial assessment, explain fees, and share term dates and the timetable. Our 2027 batch starts on 12 October 2026. Joining mid-term is considered case by case.",
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

export const CONTACT_FORM = {
  heading: 'Register your interest',
  intro:
    "Leave your name and email, and we'll be in touch within 3 business days. There's no obligation.",
  labels: {
    name: 'Your name',
    email: 'Email',
    phone: 'Phone',
    message: 'How can we help?',
    updatesConsent: 'Email me about AJ Classes updates and enrolment openings.',
  },
  optional: '(optional)',
  privacyNoticeBefore: 'By submitting, you agree to our',
  privacyLinkText: 'Privacy Policy',
  privacyNoticeAfter: '.',
  space: ' ',
  submit: 'Register interest',
  submitting: 'Sending…',
  emailSubjectPrefix: '[AJ Classes]',
  emailSubject: 'Website enquiry',
  yes: 'Yes',
  no: 'No',
  successHeading: 'Message sent',
  success: "Thank you! We've received your details and will be in touch within 3 business days.",
};

// The card beside the form. A row with no value (e.g. phone or hours still TBC) is hidden.
export const CONTACT_DETAILS = {
  heading: 'Contact details',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  locationLabel: 'Location',
  location: LOCATION,
  hoursLabel: 'Class hours',
  responseLabel: 'Response time',
  response: 'Within 3 business days',
};

// Navy band halfway down the page, with the same single CTA label as everywhere else (F2.2).
export const CTA_BANNER = {
  heading: 'Ready to see what your child can achieve?',
  text: "Register your interest and we'll contact you to book an initial assessment. No obligation, just a clear picture of where your child stands today.",
  cta: 'Register Interest',
};

// Sticky bar at the bottom of the screen on phones (F2.6).
export const MOBILE_CTA_BAR = {
  label: 'Register interest',
  cta: 'Register Interest',
};

export const SUBSCRIBE = {
  heading: 'Stay in the loop',
  blurb: 'A weekly update for parents and guardians: news, events, enrolments and study tips.',
  emailLabel: 'Parent or guardian email',
  // Clear consent wording beside the button (Spam Act 2003). Kit's confirmation email
  // (double opt-in) is the record that they asked to subscribe.
  consentNotice:
    "By subscribing, you agree to receive AJ Classes updates by email. We'll email you a link to confirm. Unsubscribe any time.",
  submit: 'Subscribe',
  submitting: 'Subscribing…',
  success: (email: string) =>
    `Almost done! We've sent a confirmation link to ${email}. Please check your inbox, and your spam folder if it's not there.`,
};

// The page Kit sends people to after they click the confirmation link.
// (Set this as the "redirect after confirming" URL in the Kit form settings.)
export const SUBSCRIBED_PAGE = {
  heading: "You're subscribed!",
  text: "Thanks for joining the AJ Classes weekly update. You'll get news, events, enrolment updates and study tips once a week.",
  tip: `So our emails reach your inbox, add ${BUSINESS.email} to your contacts.`,
  backHome: 'Back to the home page',
};

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
};

export const WHATSAPP_BUTTON = {
  label: 'Chat on WhatsApp',
  ariaLabel: 'Chat with AJ Classes on WhatsApp (opens WhatsApp)',
};

export const FOOTER = {
  followHeading: 'Follow AJ Classes',
  contactHeading: 'Contact',
  location: LOCATION,
  privacyLink: 'Privacy Policy',
  copyright: (year: number) => `© ${year} AJ Classes. All rights reserved.`,
  // Short form of the "Accuracy of information" section in PRIVACY.
  disclaimer:
    'Every effort has been made to verify the information on this website. However, AJ Classes is not liable for any action taken based on it, to the extent permitted by law.',
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
      text: 'To respond to your enquiry, contact you in the way you prefer, and, if you ticked the box or subscribed, send you news and enrolment updates. Every newsletter email has an unsubscribe link, and you can unsubscribe at any time.',
    },
    {
      heading: 'Who handles it',
      text: "Enquiry form submissions are delivered to us by email through a form-processing service (Web3Forms). Newsletter sign-ups are managed by Kit (kit.com), our email newsletter service, which stores your email address and sends our updates. Both may process data outside Australia (including the United States). To block spam, our enquiry form uses a hidden check that doesn't collect any extra information. Our website is hosted by Vercel, and we use Vercel Web Analytics, which is cookieless and does not identify you personally. We don't sell or share your information with anyone for marketing.",
    },
    {
      // Owner request (Oct 2026). Wording for the owner to review; consumer law limits what can be excluded.
      heading: 'Accuracy of information',
      text: 'Every effort has been made to verify the information on this website, including our results, programmes, class times and fees. However, details can change and mistakes can happen, and AJ Classes is not liable for any action taken based on this information, to the extent permitted by law. Please contact us to confirm details before making decisions, and let us know if you spot something that is wrong.',
    },
    {
      // R3b review F19: family accounts. Wording for the owner to review.
      heading: 'Student and parent portal accounts',
      text: "Portal accounts are created only by invitation from AJ Classes. For each account we keep your name, email address and sign-in times. For students we also keep their classes and timetable, their assignment answers, marks, and tutor feedback and comments. A student's account is only created after a parent or guardian agrees, in the portal or on our enrolment form. Parents linked to a student can see that student's assignments, answers once handed in, marks, progress and tutor comments; they never see other students. Portal data is stored with Supabase (database and sign-in), and our sign-in pages use Cloudflare Turnstile to check that you are a person; both may process data outside Australia. We never use portal information for marketing.",
    },
    {
      // Owner request (Oct 2026). Wording for the owner to review; consumer law limits what can be excluded.
      heading: 'Accuracy of information',
      text: 'Every effort has been made to verify the information on this website, including our results, programmes, class times and fees. However, details can change and mistakes can happen, and AJ Classes is not liable for any action taken based on this information, to the extent permitted by law. Please contact us to confirm details before making decisions, and let us know if you spot something that is wrong.',
    },
    {
      heading: 'How long we keep it',
      text: 'Only as long as we need it to respond to you and provide our services, then we delete it.',
    },
    {
      heading: 'Children',
      text: "Our students are school-aged. We ask parents or guardians to make enquiries on behalf of children where possible, and a child's portal account is only set up with a parent's or guardian's permission.",
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

// Flyer-style slides beside the hero headline. Each one links to the contact form.
// `art` picks the illustration; `tone` picks the colour scheme (see HeroSlideshow.module.css).
export const HERO_SLIDES = {
  label: 'AJ Classes highlights',
  previous: 'Previous slide',
  next: 'Next slide',
  pause: 'Pause slideshow',
  play: 'Play slideshow',
  previousIcon: '←',
  nextIcon: '→',
  pauseIcon: '❚❚',
  playIcon: '▶',
  goToSlide: (slideNumber: number) => `Go to slide ${slideNumber}`,
  slideOf: (slideNumber: number, total: number) => `Slide ${slideNumber} of ${total}`,
  slides: [
    {
      eyebrow: 'Our 2026 results',
      title: '10 selective high school offers',
      points: [
        '5 John Monash Science School offers',
        '3 private school scholarships',
        '20+ years of teaching experience',
      ],
      cta: 'Join the 2027 batch →',
      art: 'chart',
      tone: 'navy',
    },
    {
      eyebrow: 'Selective Entry 2027',
      title: "Ready for next year's selective entry exam?",
      points: [
        'Reading, writing, maths and reasoning',
        'Timed practice under exam conditions',
        'Mock interviews with written feedback',
      ],
      cta: 'Register interest →',
      art: 'books',
      tone: 'blue',
    },
    {
      eyebrow: 'Strong foundations',
      title: 'Start early, stay ahead',
      points: [
        'NAPLAN preparation from Year 2',
        'Maths, Science and English tutoring',
        'Small groups, twice a week',
      ],
      cta: 'Book an assessment →',
      art: 'openBook',
      tone: 'gold',
    },
    {
      eyebrow: 'New for 2027',
      title: 'UCAT and GAMSAT preparation',
      points: [
        'Enrolments are open now',
        'Classes start in January 2027',
        'Register now to secure a place',
      ],
      cta: 'Register interest →',
      art: 'target',
      tone: 'blue',
    },
  ],
} as const;

export type HeroSlide = (typeof HERO_SLIDES.slides)[number];
