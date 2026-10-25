// Every word on the portal pages (R2a staff; R3b shared parts). Student and parent pages are in
// family.constants.ts, online assignments in online-assignments.constants.ts. Error messages live
// in error.constants.ts.

import { AUTH_LIMITS, PHOTO_LIMITS, POST_LIMITS, PROFILE_LIMITS } from './app.constants';
import type { AppRole, ThemeMode } from './app.constants';
import { BUSINESS } from './business.constants';

export const PORTAL_SEO = {
  titleSuffix: ' | AJ Classes Portal',
  login: 'Sign in',
  loginVerify: 'Enter your code',
  forgotPassword: 'Forgot password',
  authConfirm: 'Continue',
  setPassword: 'Set your password',
  join: 'Set up your account',
  account: 'Your account',
  profile: 'My profile',
  timetable: 'Timetable',
  classes: 'Classes',
  classDetail: 'Class',
  assignments: 'Assignments',
  assignmentDetail: 'Assignment',
  adminStaff: 'Staff',
  adminStaffMember: 'Staff member',
  adminStudents: 'Students',
  adminActivity: 'Activity',
  adminEnquiries: 'Enquiries',
  adminPosts: 'Posts',
  twoStepSetup: 'Set up two-step sign-in',
  tutor: 'Dashboard',
  admin: 'Admin',
  notFound: 'Page not found',
  submission: 'Submission',
  adminStudent: 'Student',
  student: 'My work',
  studentAssignment: 'Assignment',
  studentTimetable: 'My timetable',
  parent: 'My children',
  parentChild: 'Child',
  parentChildAssignment: 'Assignment',
} as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  tutor: 'Tutor',
  admin: 'Admin',
  student: 'Student',
  parent: 'Parent',
};

export const PORTAL_COMMON = {
  loading: 'Loading…',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  edit: 'Edit',
  remove: 'Remove',
  delete: 'Delete',
  back: 'Back',
  search: 'Search',
  none: '—',
  never: 'Never',
  yes: 'Yes',
  no: 'No',
  errorHeading: 'Something went wrong',
  // Shown when a page breaks for a reason other than the connection (lib/connection-errors.ts).
  errorIntro:
    "This page couldn't be shown. Please try again, and contact AJ Classes if it keeps happening.",
  tryAgain: 'Try again',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  backToSite: '← Back to the AJ Classes website',
  areaBadge: {
    tutor: 'Staff',
    admin: 'Staff',
    student: 'Student',
    parent: 'Parent',
  } satisfies Record<AppRole, string>,
  navLabel: 'Portal',
  nav: {
    tutor: 'Dashboard',
    timetable: 'Timetable',
    classes: 'Classes',
    assignments: 'Assignments',
    profile: 'My profile',
    admin: 'Admin',
    account: 'Account',
    studentHome: 'My work',
    studentTimetable: 'Timetable',
    parentHome: 'My children',
  },
  themeToggle: {
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode',
  },
  show: 'Show',
  hide: 'Hide',
  showPasswordLabel: 'Show password',
  hidePasswordLabel: 'Hide password',
  space: ' ',
} as const;

export const PORTAL_UNAVAILABLE = {
  heading: "Sign-in isn't available right now",
  text: `Please try again later, or email ${BUSINESS.email}.`,
} as const;

export const PORTAL_FORBIDDEN = {
  heading: "You don't have access to this page",
  text: "This page isn't part of your account.",
  backHome: 'Go to your home page',
} as const;

export const PORTAL_NOT_FOUND = {
  heading: 'Page not found',
  text: "This portal page doesn't exist.",
  backHome: 'Go to your home page',
} as const;

// "Sign in", not "Staff sign in": students and parents use the same page (R3b F21).
export const LOGIN_PAGE = {
  heading: 'Sign in',
  intro: 'For AJ Classes staff, students and parents.',
  labels: {
    email: 'Email',
    password: 'Password',
  },
  submit: 'Sign in',
  submitting: 'Signing in…',
  forgotPassword: 'Forgot your password?',
  passwordChanged: 'Your password has been changed. Please sign in.',
} as const;

export const LOGIN_VERIFY_PAGE = {
  heading: 'Enter your code',
  intro: 'Open your authenticator app and enter the 6-digit code for AJ Classes.',
  chooseAuthenticator: 'Which authenticator?',
  codeLabel: '6-digit code',
  submit: 'Verify',
  submitting: 'Checking…',
  cancel: 'Cancel and sign out',
  localDevAuto: 'Local development: entering your code automatically…',
} as const;

export const FORGOT_PASSWORD_PAGE = {
  heading: 'Forgot your password?',
  intro: "Enter your email and we'll send you a link to set a new password.",
  emailLabel: 'Email',
  submit: 'Send link',
  submitting: 'Sending…',
  sent: `If that email has an account, we've sent a link. It expires in ${AUTH_LIMITS.linkExpiryHours} hour.`,
  backToLogin: '← Back to sign in',
} as const;

export const AUTH_CONFIRM_PAGE = {
  heading: {
    invite: 'Welcome to AJ Classes',
    recovery: 'Reset your password',
  },
  intro: {
    invite: "You've been invited to the AJ Classes portal. Continue to set up your account.",
    recovery: 'Continue to choose a new password.',
  },
  continue: 'Continue',
  checking: 'Checking your link…',
  invalidLink: 'This link is incomplete. Please use the button in the email.',
  requestNewLink: 'Request a new link',
  // A used invite reads as expired, so someone who already set up can still get in.
  alreadySetUp: 'Already set up your account? Sign in',
} as const;

export const SET_PASSWORD_PAGE = {
  heading: 'Set your password',
  intro: `Use at least ${AUTH_LIMITS.passwordMin} characters. A short sentence is easy to remember and hard to guess.`,
  twoStepIntro:
    'Your account uses two-step sign-in. Enter a code from your authenticator app first.',
  labels: {
    password: 'New password',
    confirm: 'Type it again',
  },
  submit: 'Save password',
  submitting: 'Saving…',
} as const;

// Optional permissions, offered to parents only, separate from the Terms so they're voluntary
// (Privacy Act APP 6, Spam Act). Same wording on the setup form and Account → Your choices
// (invite-onboarding.md, "Consents").
export const CONSENT_KINDS = ['marketing', 'resultsPublicity', 'videoPublicity'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_CHOICES = {
  heading: 'Optional permissions',
  intro: 'Each one is up to you. You can change them at any time in Account → Your choices.',
  labels: {
    marketing: 'Send me news, offers and enrolment updates by email and SMS.',
    resultsPublicity:
      'AJ Classes may share my child’s name and their selective school or scholarship result on its website and social media.',
    videoPublicity:
      'If we provide a testimonial video, AJ Classes may publish it on its website and social media.',
  } satisfies Record<ConsentKind, string>,
  /** Short names for the admin's view of a parent's choices. */
  short: {
    marketing: 'News by email/SMS',
    resultsPublicity: 'Name and results',
    videoPublicity: 'Testimonial video',
  } satisfies Record<ConsentKind, string>,
  yes: 'yes',
  no: 'no',
} as const;

export const JOIN_PAGE = {
  heading: 'Set up your account',
  intro: (email: string) =>
    `You're joining the AJ Classes portal as ${email}. Fill in your details to finish.`,
  labels: {
    fullName: 'Full name',
    phone: 'Phone number',
    yearLevel: 'Year level',
    password: 'Create password',
    confirm: 'Confirm password',
    code: 'Code from the email',
  },
  hints: {
    phone: 'So AJ Classes can reach you about your classes.',
    password: `At least ${AUTH_LIMITS.passwordMin} characters. A short sentence is easy to remember and hard to guess.`,
  },
  yearLevelPlaceholder: 'Choose your year level',
  terms: {
    before: 'I agree to the ',
    termsLink: 'Terms & Conditions',
    between: ' and ',
    privacyLink: 'Privacy Policy',
    // Service messages need no separate consent (Spam Act); marketing is asked separately below.
    after: ', including emails, SMS and calls about classes, my account and invoices.',
  },
  submit: 'Finish setup',
  submitting: 'Setting up…',
  codeSent:
    "For your security, we've emailed you a code. Enter it below, then press Finish setup again.",
  signOut: 'Not you? Sign out',
} as const;

export const ACCOUNT_PAGE = {
  heading: 'Your account',
  choices: {
    heading: 'Your choices',
    intro: 'Optional permissions. Changes apply as soon as you save them.',
    save: 'Save choices',
    saving: 'Saving…',
    saved: 'Your choices are saved.',
  },
  signedInAs: 'Signed in as',
  role: 'Role',
  password: {
    heading: 'Change password',
    intro: `Use at least ${AUTH_LIMITS.passwordMin} characters. Other devices will be signed out.`,
    codeSent:
      'You signed in more than a day ago, so we emailed you a 6-digit code to confirm it’s you.',
    resendCode: 'Email me a new code',
    codeResent: 'We sent a new code.',
    labels: {
      code: 'Code from the email',
      password: 'New password',
      confirm: 'Type it again',
    },
    submit: 'Change password',
    submitting: 'Saving…',
    done: 'Password changed. Other devices have been signed out.',
  },
  appearance: {
    heading: 'Appearance',
    intro: 'Dark mode is easier on the eyes at night. Saved on this device only.',
    options: { system: 'Same as this device', light: 'Light', dark: 'Dark' } satisfies Record<
      ThemeMode,
      string
    >,
  },
  twoStep: {
    heading: 'Two-step sign-in',
    on: 'On. You sign in with your password and a code from your authenticator app.',
    off: 'Not set up.',
    adminRequired: 'Admins must use two-step sign-in.',
    added: (date: string) => `Added ${date}`,
    addBackup: 'Add a backup authenticator',
    setUp: 'Set up two-step sign-in',
    backupHint: 'A backup (for example a password manager) means a lost phone won’t lock you out.',
    remove: 'Remove',
    removing: 'Removing…',
    confirmRemove: (name: string) =>
      `Remove "${name}"? You won't be able to sign in with it any more.`,
    lastOne: 'You need at least one authenticator. Add another before removing this one.',
    maxReached: `You have the maximum of ${AUTH_LIMITS.maxAuthenticators} authenticators.`,
  },
} as const;

export const TWO_STEP_SETUP_PAGE = {
  heading: 'Set up two-step sign-in',
  intro:
    'Admins sign in with a password and a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password).',
  nameLabel: 'Name this authenticator',
  nameHint: 'For example "Phone" or "1Password".',
  defaultName: 'Phone',
  start: 'Continue',
  starting: 'Preparing…',
  scanStep: '1. Scan this QR code with your authenticator app.',
  qrAlt: 'QR code for your authenticator app',
  secretStep: "Can't scan it? Enter this key instead:",
  codeStep: '2. Enter the 6-digit code your app shows.',
  codeLabel: '6-digit code',
  submit: 'Turn on two-step sign-in',
  submitting: 'Checking…',
  cancel: 'Cancel',
  done: 'Two-step sign-in is on.',
} as const;

export const TUTOR_DASHBOARD = {
  welcome: (firstName: string) => `Welcome, ${firstName}`,
  intro: 'Your week at AJ Classes.',
  completeProfile: 'Your profile is missing a bio or subjects. Families will see it later.',
  completeProfileLink: 'Complete your profile',
  nextSessions: {
    heading: 'Next classes',
    empty: 'No classes in the next 7 days.',
    today: 'Today',
    tomorrow: 'Tomorrow',
    dayAndDate: (day: string, date: string) => `${day} ${date}`,
    when: (day: string, time: string) => `${day} · ${time}`,
    link: 'Timetable',
  },
  classes: {
    heading: 'My classes',
    count: (count: number) => (count === 1 ? '1 class' : `${count} classes`),
    empty: 'You have no classes yet.',
    link: 'All classes',
  },
  assignments: {
    heading: 'Assignments',
    toMark: (count: number) => (count === 1 ? '1 to mark' : `${count} to mark`),
    dueSoon: (count: number) =>
      count === 1 ? '1 due in the next 3 days' : `${count} due in the next 3 days`,
    overdue: (count: number) => `${count} overdue`,
    allClear: 'Nothing waiting.',
    link: 'All assignments',
  },
  profileCard: {
    title: 'My profile',
    text: 'Your name, subjects, bio, qualifications and photo.',
    link: 'Edit profile',
  },
} as const;

export const ADMIN_DASHBOARD = {
  heading: 'Admin',
  intro: 'Manage AJ Classes staff, classes and students.',
  stats: {
    staff: 'Active staff',
    invites: 'Pending invites',
    classes: 'Active classes',
    students: 'Active students',
  },
  statsLabel: 'Overview',
  shortcuts: {
    heading: 'Shortcuts',
    staff: 'Staff',
    classes: 'Classes',
    students: 'Students',
    timetable: 'Timetable',
    enquiries: 'Enquiries',
    posts: 'Posts',
    activity: 'Activity',
  },
  recent: {
    heading: 'Recent activity',
    line: (actor: string, action: string, target: string) => `${actor} · ${action} ${target}`,
    empty: 'Nothing yet.',
    link: 'All activity',
  },
} as const;

// Admin → Enquiries (leads-and-crm.md §5). The status is whether the lead reached Zoho CRM.
export const CRM_STATUSES = ['pending', 'synced', 'failed', 'off'] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  pending: 'Sending',
  synced: 'In Zoho CRM',
  failed: 'Not sent',
  off: 'Zoho CRM not set up',
};

export const ENQUIRIES_PAGE = {
  heading: 'Enquiries',
  intro:
    'Every enquiry from the website form, newest first, and whether it reached Zoho CRM as a lead. Reply from your inbox or from Zoho CRM.',
  columns: {
    received: 'Received',
    from: 'From',
    message: 'Message',
    crm: 'Zoho CRM',
    actions: '',
  },
  noMessage: 'No message',
  wantsUpdates: 'Wants updates',
  empty: 'No enquiries yet. They appear here once lead capture is switched on (go-live checklist).',
  retry: 'Retry',
  retrying: 'Sending…',
  retried: 'Sent to Zoho CRM.',
  retryFailed: (reason: string) => `Still not sent to Zoho CRM: ${reason}`,
  stillOff: 'Zoho CRM is not set up yet, so there is nothing to retry. See the go-live checklist.',
  delete: 'Delete',
  confirmDeleteTitle: 'Delete this enquiry?',
  confirmDeleteText: (name: string) =>
    `The enquiry from ${name} will be removed from the portal. It stays in your inbox and in Zoho CRM.`,
  deleted: 'Enquiry deleted.',
  emailLink: (email: string) => `mailto:${email}`,
  phoneLink: (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`,
} as const;

// Admin → Posts (posts.md): compose, edit and delete the posts shown publicly on the website.
export const POSTS_PAGE = {
  heading: 'Posts',
  intro: 'Publish a short update for the website. Newest first, visible to every visitor.',
  titleLabel: 'Title',
  bodyLabel: 'Body',
  publish: 'Publish',
  publishing: 'Publishing…',
  published: 'Post published.',
  edit: 'Edit',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Post updated.',
  cancel: 'Cancel',
  delete: 'Delete',
  confirmDeleteTitle: 'Delete this post?',
  confirmDeleteText: (title: string) => `"${title}" will be removed from the website immediately.`,
  deleted: 'Post deleted.',
  empty: 'No posts yet. Publish the first one above.',
  // Inline field messages (AC-1.14). Spaces alone don't count as text.
  titleLength: `Please enter a title (${POST_LIMITS.titleMin}–${POST_LIMITS.titleMax} characters).`,
  bodyLength: `Please write the post (${POST_LIMITS.bodyMin}–${POST_LIMITS.bodyMax} characters).`,
  bodyCount: (used: number) => `${used} / ${POST_LIMITS.bodyMax} characters`,
} as const;

export const FOOTER_PORTAL = {
  signIn: 'Sign in',
} as const;

export const PROFILE_PAGE = {
  heading: 'My profile',
  intro: 'This is how you appear to AJ Classes, and later on the website.',
  email: 'Email',
  emailHint: 'To change your email, contact an admin.',
  labels: {
    fullName: 'Full name',
    subjects: 'Subjects I teach',
    bio: 'Bio',
    qualifications: 'Qualifications',
  },
  hints: {
    subjects: 'Tick all that apply.',
    bio: 'A few sentences about your teaching. Plain text only.',
    qualifications: 'One per line, for example "B.Ed (Secondary Maths), Monash University".',
  },
  bioCount: (used: number) => `${used} / ${PROFILE_LIMITS.bioMax} characters`,
  qualificationLabel: (position: number) => `Qualification ${position}`,
  addQualification: 'Add a qualification',
  removeQualification: (position: number) => `Remove qualification ${position}`,
  remove: 'Remove',
  maxQualifications: `You can list up to ${PROFILE_LIMITS.qualificationsMax} qualifications.`,
  save: 'Save profile',
  saving: 'Saving…',
  saved: 'Profile saved.',
  photo: {
    heading: 'Photo',
    note: 'Your photo may be shown on the AJ Classes website.',
    alt: (fullName: string) => `Photo of ${fullName}`,
    noPhoto: 'No photo yet',
    choose: 'Choose a photo',
    change: 'Change photo',
    accept: PHOTO_LIMITS.acceptedTypes.join(','),
    hint: 'JPEG, PNG or WebP. It will be cropped to a square.',
    previewAlt: 'Preview of your new photo',
    use: 'Use this photo',
    uploading: 'Uploading…',
    cancel: 'Cancel',
    remove: 'Remove photo',
    removing: 'Removing…',
    confirmRemove: 'Remove your photo?',
    saved: 'Photo updated.',
    removed: 'Photo removed.',
  },
} as const;

export const NOT_FOUND_PANEL = {
  heading: 'Not found',
  text: "This page doesn't exist, or you don't have access to it.",
} as const;

export const ACCOUNT_STATUS_LABELS = {
  none: 'No account',
  invited: 'Invited',
  inviteExpired: 'Invite expired',
  active: 'Active',
  deactivated: 'Deactivated',
} as const;

export const STAFF_PAGE = {
  heading: 'Staff',
  intro: 'Everyone who can sign in to the staff portal.',
  invite: 'Invite staff',
  searchLabel: 'Search by name or e-mail',
  statusFilterLabel: 'Status',
  statusFilters: { all: 'All', active: 'Active', invited: 'Invited', deactivated: 'Deactivated' },
  columns: {
    name: 'Name',
    email: 'E-mail',
    phone: 'Phone',
    role: 'Role',
    status: 'Status',
    twoStep: 'Two-step',
    lastSignIn: 'Last sign-in',
  },
  twoStepOn: 'On',
  twoStepOff: 'Not set up',
  empty: 'No staff match.',
  invited: (email: string) => `Invite sent to ${email}.`,
} as const;

export const INVITE_DIALOG = {
  heading: 'Invite staff',
  intro: `They'll get an e-mail to set their password. The link works for ${AUTH_LIMITS.linkExpiryHours} hour; you can resend it.`,
  nameLabel: 'Full name',
  emailLabel: 'E-mail',
  emailRequired: 'Please enter their e-mail address.',
  roleNote: 'New staff join as tutors. You can make them an admin after they join.',
  send: 'Send invite',
  sending: 'Sending…',
} as const;

export const STAFF_MEMBER_PAGE = {
  back: '← Staff',
  you: '(you)',
  invite: {
    heading: 'Invite',
    sentOn: (date: string) => `Invited on ${date}. They haven't set a password yet.`,
    expired: 'The link has expired. Send a new one.',
    resend: 'Resend invite',
    resending: 'Sending…',
    resent: 'A new invite link has been sent.',
    cancel: 'Cancel invite',
    confirmCancelTitle: 'Cancel this invite?',
    confirmCancelText: (email: string) =>
      `The pending account for ${email} will be removed. You can invite them again later.`,
  },
  access: {
    heading: 'Access',
    roleLabel: 'Role',
    saveRole: 'Change role',
    confirmRoleTitle: 'Change role?',
    toAdmin: (name: string) =>
      `${name} will be able to manage staff, classes and students. They must set up two-step sign-in next time they sign in.`,
    toTutor: (name: string) => `${name} will lose access to the admin pages.`,
    roleChanged: 'Role changed.',
    active: 'Can sign in.',
    inactive: 'Deactivated: cannot sign in.',
    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    confirmDeactivateTitle: 'Deactivate this account?',
    confirmDeactivateText: (name: string) =>
      `${name} will be signed out and lose access straight away. Their classes and history are kept.`,
    confirmReactivateTitle: 'Reactivate this account?',
    confirmReactivateText: (name: string) =>
      `${name} will be able to sign in again with their password.`,
    deactivated: 'Deactivated.',
    reactivated: 'Reactivated.',
    selfNote: "You can't deactivate your own account.",
  },
  twoStep: {
    heading: 'Two-step sign-in',
    on: 'On: they sign in with a password and an authenticator code.',
    off: 'Not set up.',
    reset: 'Reset two-step sign-in',
    resetting: 'Resetting…',
    confirmTitle: 'Reset two-step sign-in?',
    confirmText: (name: string) =>
      `All of ${name}'s authenticators will be removed. If they are an admin they will set up a new one at their next sign-in. They'll get an e-mail about it.`,
    done: 'Two-step sign-in was reset.',
    selfNote: 'To change your own authenticators, go to Account.',
  },
  profile: {
    heading: 'Profile',
  },
  joined: (date: string) => `Joined ${date}`,
  lastSignIn: (date: string) => `Last sign-in ${date}`,
  // Given at setup (invite-onboarding.md, "Admin view").
  phone: 'Phone:',
  phoneLink: (phone: string) => `tel:${phone}`,
  termsAccepted: (date: string) => `Accepted the Terms ${date}`,
} as const;

export const ACTIVITY_LABELS = {
  invite_sent: 'Invited',
  invite_resent: 'Resent invite to',
  invite_cancelled: 'Cancelled invite for',
  role_changed: 'Changed role of',
  deactivated: 'Deactivated',
  reactivated: 'Reactivated',
  two_step_reset: 'Reset two-step for',
  profile_edited_by_admin: 'Edited profile of',
  student_invited: 'Invited student',
  parent_invited: 'Invited parent',
  parent_linked: 'Linked parent',
  parent_unlinked: 'Removed parent',
  consent_recorded: 'Recorded consent for',
  consent_changed: 'Changed their permissions',
  account_activated: 'Finished account setup',
} as const;

export const ACTIVITY_PAGE = {
  heading: 'Activity',
  intro: 'Who changed access to the portal, and when. Newest first.',
  columns: { when: 'When', who: 'Who', what: 'What', target: 'Account', details: 'Details' },
  empty: 'Nothing yet.',
  roleChange: (from: string, to: string) => `${from} → ${to}`,
  fields: (fields: string) => `Fields: ${fields}`,
  student: (name: string) => `Student: ${name}`,
  someone: 'Someone',
  listSeparator: ' · ',
} as const;

export const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7] as const; // ISO: 1 = Monday

export const DAY_NAMES = {
  long: {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
  },
  short: { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' },
} as const;

export const CLOCK = {
  am: 'am',
  pm: 'pm',
  rangeSeparator: '–',
  listSeparator: ' · ',
} as const;

export const YEAR_LEVEL_TEXT = {
  label: (year: number) => `Year ${year}`,
  other: 'Other (e.g. UCAT, GAMSAT)',
  any: 'Any year',
} as const;

export const DELIVERY_LABELS = {
  in_person: 'In person',
  online: 'Online',
} as const;

export const DELIVERY_WITH_LOCATION = (delivery: string, location: string) =>
  `${delivery} · ${location}`;

export const CLASSES_PAGE = {
  heading: 'Classes',
  introTutor: 'The classes you teach.',
  introAdmin: 'Every class. Archived classes are hidden from tutors and the timetable.',
  newClass: 'New class',
  showArchived: 'Show archived',
  columns: {
    name: 'Class',
    subject: 'Subject',
    year: 'Year',
    tutor: 'Tutor',
    schedule: 'Schedule',
    students: 'Students',
  },
  noTutor: 'No tutor',
  tutorInactive: 'Tutor inactive',
  archived: 'Archived',
  noSchedule: 'No times yet',
  empty: 'No classes yet.',
  saved: 'Class saved.',
} as const;

export const CLASS_DIALOG = {
  newHeading: 'New class',
  editHeading: 'Edit class',
  labels: {
    name: 'Class name',
    subject: 'Subject',
    yearLevel: 'Year level',
    delivery: 'Delivery',
    location: 'Location',
    tutor: 'Tutor',
    startsOn: 'Term starts',
    endsOn: 'Term ends',
  },
  hints: {
    location: 'Room, or the online meeting place (e.g. Zoom).',
    term: 'Optional. Next sessions only appear between these dates.',
  },
  noTutor: 'No tutor yet',
  save: 'Save class',
  saving: 'Saving…',
} as const;

export const CLASS_VALIDATION = {
  nameLength: 'Please enter a class name (2–100 characters).',
  subjectRequired: 'Please choose a subject.',
  locationLength: 'Please keep the location under 100 characters.',
  termOrder: "The term can't end before it starts.",
  timeOrder: 'The end time must be after the start time.',
  timeRequired: 'Please choose a start and end time.',
  studentNameLength: 'Please enter the student’s full name (2–100 characters).',
  studentRequired: 'Please choose a student.',
} as const;

export const CLASS_PAGE = {
  back: '← Classes',
  tabs: { schedule: 'Schedule', students: 'Students', assignments: 'Assignments' },
  tabsLabel: 'Class sections',
  facts: {
    tutor: 'Tutor',
    term: 'Term',
    delivery: 'Delivery',
    noTerm: 'No term dates',
    termRange: (from: string, to: string) => `${from} – ${to}`,
    termFrom: (from: string) => `From ${from}`,
    termUntil: (to: string) => `Until ${to}`,
  },
  edit: 'Edit class',
  archive: 'Archive',
  restore: 'Restore',
  confirmArchiveTitle: 'Archive this class?',
  confirmArchiveText:
    'It disappears from the tutor’s pages and the timetable. You can restore it later.',
  archived: 'This class is archived.',
  schedule: {
    empty: 'No weekly times yet.',
    addTime: 'Add time',
    remove: 'Remove time',
    removeLabel: (slot: string) => `Remove time: ${slot}`,
    confirmRemoveTitle: 'Remove this time?',
    confirmRemoveText: (slot: string) => `${slot} will be removed from the timetable.`,
  },
  students: {
    empty: 'No students in this class yet.',
    add: 'Add student',
    remove: 'Remove from class',
    confirmRemoveTitle: 'Remove from class?',
    confirmRemoveText: (name: string) =>
      `${name} will be removed from this class. Their past marks are kept.`,
    columns: { name: 'Name', year: 'Year' },
  },
} as const;

export const SESSION_DIALOG = {
  heading: 'Add a weekly time',
  dayLabel: 'Day',
  startLabel: 'Starts',
  endLabel: 'Ends',
  save: 'Add time',
  saving: 'Adding…',
} as const;

export const ENROL_DIALOG = {
  heading: 'Add a student',
  studentLabel: 'Student',
  noOptions: 'No matching students. Add them on the Students page first.',
  optionLabel: (name: string, year: string) => `${name} · ${year}`,
  save: 'Add to class',
  saving: 'Adding…',
} as const;

export const TIMETABLE_PAGE = {
  heading: 'Timetable',
  introTutor: 'Your weekly classes. Times are Melbourne time.',
  introAdmin: 'Every active class. Times are Melbourne time.',
  tutorFilter: 'Tutor',
  allTutors: 'All tutors',
  noClasses: 'No classes',
  empty: 'Nothing on the timetable yet.',
  daysLabel: 'Days of the week',
  todayHeading: (day: string) => `${day} · Today`,
} as const;

export const STUDENTS_PAGE = {
  heading: 'Students',
  intro: 'The student roster. Open a student to manage their portal account and parents.',
  add: 'Add student',
  searchLabel: 'Search by name',
  showArchived: 'Show archived',
  columns: {
    name: 'Name',
    year: 'Year',
    classes: 'Classes',
    account: 'Account',
    parents: 'Parents',
    status: 'Status',
  },
  edit: 'Edit',
  archive: 'Archive',
  restore: 'Restore',
  archived: 'Archived',
  active: 'Active',
  noClasses: 'Not in a class',
  empty: 'No students match.',
  confirmArchiveTitle: 'Archive this student?',
  confirmArchiveText: (name: string) =>
    `${name} will be hidden from the roster. Their classes and marks are kept.`,
  saved: 'Student saved.',
} as const;

export const STUDENT_DIALOG = {
  newHeading: 'Add student',
  editHeading: 'Edit student',
  nameLabel: 'Full name',
  yearLabel: 'Year level',
  privacyNote: 'Only the name and year level are kept. No contact details.',
  save: 'Save student',
  saving: 'Saving…',
} as const;

export const ASSIGNMENT_LIMITS = {
  titleMin: 2,
  titleMax: 150,
  instructionsMax: 4000,
  maxMarkMin: 1,
  maxMarkMax: 1000,
  feedbackMax: 2000,
  dueSoonDays: 3,
} as const;

export const RESULT_STATUS_LABELS = {
  not_submitted: 'Not submitted',
  in_progress: 'In progress',
  submitted: 'Submitted',
  marked: 'Marked',
  returned: 'Returned',
} as const;

export const DUE_LABELS = {
  none: 'No due date',
  overdue: 'Overdue',
  today: 'Due today',
  soon: 'Due soon',
  later: 'Upcoming',
  dueOn: (date: string) => `Due ${date}`,
  dueOnWithState: (date: string, state: string) => `Due ${date} · ${state}`,
} as const;

export const ASSIGNMENTS_PAGE = {
  heading: 'Assignments',
  intro: 'Homework set for your classes, soonest due first.',
  columns: {
    title: 'Assignment',
    class: 'Class',
    due: 'Due',
    progress: 'Marked',
    toMark: 'To mark',
  },
  progress: (marked: number, total: number) => `${marked} of ${total}`,
  empty: 'No assignments yet. Set one from a class page.',
} as const;

export const ASSIGNMENT_DIALOG = {
  newHeading: 'New assignment',
  editHeading: 'Edit assignment',
  labels: {
    title: 'Title',
    instructions: 'Instructions',
    dueOn: 'Due date',
    maxMark: 'Out of (marks)',
  },
  hints: {
    instructions: 'Plain text. Students and parents see this once it’s published.',
    maxMark: 'For paper homework. Leave empty for feedback only.',
    onlineMarks: 'Marks come from the questions.',
  },
  newIsDraft: 'New assignments start as drafts: add questions if you like, then publish.',
  save: 'Save assignment',
  saving: 'Saving…',
} as const;

export const ASSIGNMENT_VALIDATION = {
  titleLength: `Please enter a title (${ASSIGNMENT_LIMITS.titleMin}–${ASSIGNMENT_LIMITS.titleMax} characters).`,
  instructionsLength: `Please keep instructions under ${ASSIGNMENT_LIMITS.instructionsMax} characters.`,
  maxMarkRange: `Marks must be a whole number from ${ASSIGNMENT_LIMITS.maxMarkMin} to ${ASSIGNMENT_LIMITS.maxMarkMax}.`,
  markRange: (max: number) => `Enter a mark from 0 to ${max}.`,
  markNotAllowed: 'This assignment is feedback only.',
  feedbackLength: `Please keep feedback under ${ASSIGNMENT_LIMITS.feedbackMax} characters.`,
} as const;

export const CLASS_ASSIGNMENTS = {
  newAssignment: 'New assignment',
  empty: 'No assignments for this class yet.',
  open: 'Open',
} as const;

export const MARKING_PAGE = {
  back: '← Assignments',
  edit: 'Edit',
  delete: 'Delete',
  confirmDeleteTitle: 'Delete this assignment?',
  confirmDeleteText: 'It will be removed with all its marks and feedback. This cannot be undone.',
  outOf: (max: number) => `Out of ${max}`,
  feedbackOnly: 'Feedback only',
  instructionsHeading: 'Instructions',
  noInstructions: 'No instructions.',
  progress: (marked: number, total: number) => `Marked ${marked} of ${total}`,
  columns: { student: 'Student', status: 'Status', mark: 'Mark', feedback: 'Feedback', save: '' },
  statusLabel: (name: string) => `Status for ${name}`,
  markLabel: (name: string) => `Mark for ${name}`,
  feedbackLabel: (name: string) => `Feedback for ${name}`,
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  markedBy: (name: string, date: string) =>
    name ? `Marked by ${name}, ${date}` : `Marked ${date}`,
  returnedNote: 'Returned work and its mark show to the student and their parents.',
  noStudents: 'No students are in this class yet.',
  className: 'Class',
} as const;
