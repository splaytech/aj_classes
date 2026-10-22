// Who may see which portal page (R2a design §11.3, R3b §6.1). Pure functions, so every rule is
// unit tested. The database enforces the same rules (RLS and the family functions); this only
// decides what the browser shows.

import { PORTAL_QUERY, PORTAL_ROUTES, SIGN_IN_REASONS } from '@/constants';
import type { AppRole } from '@/constants';
import type { AccessState } from '@/services';

/** The kinds of portal page, each with its own entry rule. */
export type PortalArea =
  | 'signedOutOnly' // sign-in page
  | 'twoStepVerify' // code step after the password
  | 'setPassword' // after a reset link
  | 'join' // the setup form after an invite link (invited accounts only)
  | 'twoStepSetup' // linking an authenticator (admins)
  | 'member' // anyone signed in with an active account (home, account)
  | 'staff' // tutors and admins
  | 'admin' // admins only
  | 'student' // students only
  | 'parent'; // parents only

export type AccessDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }
  | { kind: 'signOut'; to: string }
  | { kind: 'forbidden' };

const ALLOW: AccessDecision = { kind: 'allow' };

// Signed-in pages, and the roles allowed on each (any role for 'member').
const PAGE_AREAS: Partial<Record<PortalArea, readonly AppRole[]>> = {
  member: ['tutor', 'admin', 'student', 'parent'],
  staff: ['tutor', 'admin'],
  admin: ['admin'],
  student: ['student'],
  parent: ['parent'],
};

const HOME_BY_ROLE: Record<AppRole, string> = {
  tutor: PORTAL_ROUTES.tutor,
  admin: PORTAL_ROUTES.admin,
  student: PORTAL_ROUTES.student,
  parent: PORTAL_ROUTES.parent,
};

export function homeForRole(role: AppRole): string {
  return HOME_BY_ROLE[role];
}

/** Tutors and admins: they get the staff pages and navigation. */
export function isStaffRole(role: AppRole): boolean {
  return role === 'tutor' || role === 'admin';
}

/** A portal URL with ?next= set, so the person comes back after the extra step. */
export function withNext(path: string, next: string): string {
  return `${path}?${new URLSearchParams({ [PORTAL_QUERY.next]: next })}`;
}

export function decidePortalAccess(
  state: AccessState,
  area: PortalArea,
  currentPath: string,
): AccessDecision {
  const allowedRoles = PAGE_AREAS[area];

  // 1. Signed out
  if (!state.signedIn) {
    if (area === 'signedOutOnly') return ALLOW;
    if (allowedRoles) {
      return { kind: 'redirect', to: withNext(PORTAL_ROUTES.login, currentPath) };
    }
    return { kind: 'redirect', to: PORTAL_ROUTES.login };
  }

  // 2. Invited and not set up yet: the setup form is the only page they can use
  //    (invite-onboarding design). The database lets them see nothing else either.
  if (state.onboarding) {
    return area === 'join' ? ALLOW : { kind: 'redirect', to: PORTAL_ROUTES.join };
  }

  // 3. Signed in, but no readable profile: deactivated
  if (!state.profile) {
    const to = `${PORTAL_ROUTES.login}?${new URLSearchParams({ [PORTAL_QUERY.reason]: SIGN_IN_REASONS.inactive })}`;
    return { kind: 'signOut', to };
  }

  const { role } = state.profile;
  const home = homeForRole(role);
  const needsCode = state.hasVerifiedFactor && state.aal === 'aal1';

  // 4. Already set up: the setup form has nothing to do
  if (area === 'join') return { kind: 'redirect', to: home };

  // 5. After a reset link. The page itself asks for a code first when needed.
  if (area === 'setPassword') return ALLOW;

  // 6. Password done, authenticator code still needed
  if (needsCode) {
    return area === 'twoStepVerify'
      ? ALLOW
      : { kind: 'redirect', to: withNext(PORTAL_ROUTES.loginVerify, currentPath) };
  }
  if (area === 'twoStepVerify') return { kind: 'redirect', to: home };

  // 7. Admins must link an authenticator before anything else
  if (role === 'admin' && !state.hasVerifiedFactor) {
    return area === 'twoStepSetup'
      ? ALLOW
      : { kind: 'redirect', to: withNext(PORTAL_ROUTES.twoStepSetup, currentPath) };
  }
  if (area === 'twoStepSetup') {
    return role === 'admin' ? ALLOW : { kind: 'redirect', to: home };
  }

  // 8. Already signed in: skip the sign-in page
  if (area === 'signedOutOnly') return { kind: 'redirect', to: home };

  // 9. Pages for some roles only (e.g. admin pages for a tutor, staff pages for a student)
  if (allowedRoles && !allowedRoles.includes(role)) return { kind: 'forbidden' };

  return ALLOW;
}

/**
 * The ?next= value, if it is safe to go there: a path inside /portal on this site.
 * Anything else (another site, "//evil.com", "/portal/../x") is ignored (design §11.3, G7).
 */
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return null;
  }

  const base = 'https://portal.invalid';
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return null;
  }

  const insidePortal =
    url.pathname === PORTAL_ROUTES.root || url.pathname.startsWith(`${PORTAL_ROUTES.root}/`);
  if (url.origin !== base || !insidePortal) return null;

  return url.pathname + url.search;
}
