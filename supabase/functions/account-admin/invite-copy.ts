// Every word of the invite email (ADR-0010), copied from supabase/templates/invite.html, which
// Auth no longer sends (D6). The edge runtime can't import apps/web/src/constants, so the wording
// and the link's shape live here.

// Must match interval '336 hours' in migration 20261030100000_invite_tokens.sql and
// INVITE_LIMITS.linkLifetimeHours in apps/web/src/constants/app.constants.ts.
export const INVITE_LIFETIME_HOURS = 336;
const INVITE_LIFETIME_DAYS = INVITE_LIFETIME_HOURS / 24;

// Must match PORTAL_ROUTES.invite and PORTAL_QUERY.inviteToken in
// apps/web/src/constants/routes.constants.ts.
export const INVITE_PATH = '/portal/invite';
export const INVITE_TOKEN_PARAM = 'token';

export type InviteAudience = 'staff' | 'student' | 'parent';

export const INVITE_COPY = {
  subject: "You're invited to the AJ Classes portal",
  heading: "You're invited to AJ Classes",
  brandLabel: { staff: 'Staff', student: 'Students', parent: 'Parents' },
  intro: {
    staff: "You've been invited to the AJ Classes staff portal.",
    student:
      "You've been invited to the AJ Classes student portal, where you can see your classes and do your assignments online.",
    parent:
      "You've been invited to the AJ Classes parent portal, where you can follow your child's assignments, marks and tutor comments.",
  },
  nextStep: 'Click the button, then fill in a few details and choose your password.',
  button: 'Accept invite',
  expiry: `This link expires in ${INVITE_LIFETIME_DAYS} days and works once. If it has expired, ask AJ Classes to send you a new one.`,
  ignore: "If you didn't expect this email, you can ignore it.",
} as const;
