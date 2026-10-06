// Who may see which portal page (R2a design §11.3). Pure functions, so every rule is unit tested.
// The database enforces the same rules (RLS); this only decides what the browser shows.

import { PORTAL_QUERY, PORTAL_ROUTES, SIGN_IN_REASONS } from '@/constants';
import type { StaffRole } from '@/constants';
import type { AccessState } from '@/services';

/** The kinds of portal page, each with its own entry rule. */
export type PortalArea =
  | 'signedOutOnly' // sign-in page
  | 'twoStepVerify' // code step after the password
  | 'setPassword' // after an invite or reset link
  | 'twoStepSetup' // linking an authenticator (admins)
  | 'staff' // any signed-in tutor or admin
  | 'admin'; // admins only

export type AccessDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }
  | { kind: 'signOut'; to: string }
  | { kind: 'forbidden' };

const ALLOW: AccessDecision = { kind: 'allow' };

export function homeForRole(role: StaffRole): string {
  return role === 'admin' ? PORTAL_ROUTES.admin : PORTAL_ROUTES.tutor;
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
  // 1. Signed out
  if (!state.signedIn) {
    if (area === 'signedOutOnly') return ALLOW;
    if (area === 'staff' || area === 'admin') {
      return { kind: 'redirect', to: withNext(PORTAL_ROUTES.login, currentPath) };
    }
    return { kind: 'redirect', to: PORTAL_ROUTES.login };
  }

  // 2. Signed in, but no readable profile: deactivated (or never set up)
  if (!state.profile) {
    const to = `${PORTAL_ROUTES.login}?${new URLSearchParams({ [PORTAL_QUERY.reason]: SIGN_IN_REASONS.inactive })}`;
    return { kind: 'signOut', to };
  }

  const { role } = state.profile;
  const home = homeForRole(role);
  const needsCode = state.hasVerifiedFactor && state.aal === 'aal1';

  // 3. After an invite or reset link. The page itself asks for a code first when needed.
  if (area === 'setPassword') return ALLOW;

  // 4. Password done, authenticator code still needed
  if (needsCode) {
    return area === 'twoStepVerify'
      ? ALLOW
      : { kind: 'redirect', to: withNext(PORTAL_ROUTES.loginVerify, currentPath) };
  }
  if (area === 'twoStepVerify') return { kind: 'redirect', to: home };

  // 5. Admins must link an authenticator before anything else
  if (role === 'admin' && !state.hasVerifiedFactor) {
    return area === 'twoStepSetup'
      ? ALLOW
      : { kind: 'redirect', to: withNext(PORTAL_ROUTES.twoStepSetup, currentPath) };
  }
  if (area === 'twoStepSetup') {
    return role === 'admin' ? ALLOW : { kind: 'redirect', to: home };
  }

  // 6. Already signed in: skip the sign-in page
  if (area === 'signedOutOnly') return { kind: 'redirect', to: home };

  // 7. Admin pages
  if (area === 'admin' && role !== 'admin') return { kind: 'forbidden' };

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
