// Page paths and on-page section anchors.
// Nav links and section `id`s both read from here, so they can never drift apart.

export const ROUTES = {
  home: '/',
  privacy: '/privacy',
  programmes: '/programmes', // one page per programme under here (programme-pages.md)
  resources: '/resources', // parent guides (completion-todo §5.3)
  vce: '/programmes/vce', // VCE tutoring has its own page layout (vce-page.md)
  notFound: '/404',
  sitemap: '/sitemap.xml',
  robots: '/robots.txt',
  subscribed: '/subscribed', // Kit sends people here after they confirm their subscription
} as const;

// Portal (R2a staff, R3b students and parents). Everything private lives under /portal, so each
// host needs one rewrite rule and search engines one Disallow line (R2a design §11.1).
export const PORTAL_ROUTES = {
  root: '/portal',
  login: '/portal/login',
  loginVerify: '/portal/login/verify',
  forgotPassword: '/portal/forgot-password',
  authConfirm: '/portal/auth/confirm',
  setPassword: '/portal/set-password',
  account: '/portal/account',
  profile: '/portal/profile',
  twoStepSetup: '/portal/account/two-step/setup',
  tutor: '/portal/tutor',
  timetable: '/portal/timetable',
  classes: '/portal/classes',
  assignments: '/portal/assignments',
  admin: '/portal/admin',
  adminStaff: '/portal/admin/staff',
  adminStudents: '/portal/admin/students',
  adminActivity: '/portal/admin/activity',
  adminEnquiries: '/portal/admin/enquiries', // website enquiries and Zoho CRM status
  student: '/portal/student',
  studentTimetable: '/portal/student/timetable',
  parent: '/portal/parent',
} as const;

// Portal pages with an id in the address (React Router patterns).
export const PORTAL_ROUTE_PATTERNS = {
  staffMember: '/portal/admin/staff/:userId',
  classDetail: '/portal/classes/:classId',
  assignmentDetail: '/portal/assignments/:assignmentId',
  submission: '/portal/assignments/:assignmentId/students/:studentId',
  adminStudent: '/portal/admin/students/:studentId',
  studentAssignment: '/portal/student/assignments/:assignmentId',
  parentChild: '/portal/parent/children/:studentId',
  parentChildAssignment: '/portal/parent/children/:studentId/assignments/:assignmentId',
} as const;

export function staffMemberPath(userId: string): string {
  return `${PORTAL_ROUTES.adminStaff}/${userId}`;
}

export function classPath(classId: string): string {
  return `${PORTAL_ROUTES.classes}/${classId}`;
}

export function assignmentPath(assignmentId: string): string {
  return `${PORTAL_ROUTES.assignments}/${assignmentId}`;
}

export function submissionPath(assignmentId: string, studentId: string): string {
  return `${assignmentPath(assignmentId)}/students/${studentId}`;
}

export function adminStudentPath(studentId: string): string {
  return `${PORTAL_ROUTES.adminStudents}/${studentId}`;
}

export function studentAssignmentPath(assignmentId: string): string {
  return `${PORTAL_ROUTES.student}/assignments/${assignmentId}`;
}

export function parentChildPath(studentId: string): string {
  return `${PORTAL_ROUTES.parent}/children/${studentId}`;
}

export function parentChildAssignmentPath(studentId: string, assignmentId: string): string {
  return `${parentChildPath(studentId)}/assignments/${assignmentId}`;
}

// Query-string names used by portal pages and email links.
export const PORTAL_QUERY = {
  next: 'next', // where to go after signing in
  reason: 'reason', // why the person was sent to the sign-in page
  tokenHash: 'token_hash', // from invite and reset emails (supabase/templates)
  linkType: 'type',
} as const;

// Values of PORTAL_QUERY.reason.
export const SIGN_IN_REASONS = {
  inactive: 'inactive',
  passwordChanged: 'password-changed',
} as const;

export const SECTION_IDS = {
  main: 'main-content',
  results: 'results',
  programmes: 'programmes',
  approach: 'approach',
  about: 'about',
  ctaBanner: 'get-started',
  faq: 'faq',
  contact: 'contact',
  askQuestion: 'ask-a-question', // the enquiry form itself ("Ask a Question" scrolls to it)
} as const;

/** Path of a parent guide, such as "/resources/victorian-selective-entry-exam". */
export function resourcePath(slug: string): string {
  return `${ROUTES.resources}/${slug}`;
}

/** Path of a programme's page, such as "/programmes/naplan". */
export function programmePath(slug: string): string {
  return `${ROUTES.programmes}/${slug}`;
}

/** Builds an in-page link such as "/#contact". */
export function sectionLink(sectionId: string): string {
  return `${ROUTES.home}#${sectionId}`;
}

// Other element ids that need to be shared between components (e.g. aria-controls).
export const ELEMENT_IDS = {
  mainNavigation: 'main-navigation',
  hero: 'hero', // the mobile CTA bar appears once this has scrolled out of view
  subscribeEmail: 'subscribe-email',
  contactFieldPrefix: 'contact-',
  contactDetailsHeading: 'contact-details-heading',
} as const;
