import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetDeactivatedSession, getAccessState, signOut } from '@/services';
import type { AccessState } from '@/services';

import { guardPortalPage } from './portal-guard';

vi.mock('@/services', () => ({
  getAccessState: vi.fn(),
  forgetDeactivatedSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    APP_CONFIG: { ...actual.APP_CONFIG, features: { ...actual.APP_CONFIG.features, portal: true } },
  };
});

// Signed in, but the profile can't be read: deactivated while signed in.
const DEACTIVATED: AccessState = {
  signedIn: true,
  userId: 'u1',
  email: 'student@test.local',
  profile: null,
  onboarding: null,
  aal: 'aal1',
  hasVerifiedFactor: false,
};

/** What a loader threw: React Router's redirect is a Response. */
async function redirectFrom(load: Promise<unknown>): Promise<string | null> {
  try {
    await load;
    return null;
  } catch (thrown) {
    return thrown instanceof Response ? thrown.headers.get('Location') : null;
  }
}

beforeEach(() => {
  vi.mocked(getAccessState).mockReset();
  vi.mocked(forgetDeactivatedSession).mockReset();
  vi.mocked(signOut).mockReset();
});

describe('guardPortalPage for an account deactivated while signed in (BUG-15)', () => {
  it('clears the session on this device, sends no sign-out request, and goes to sign-in', async () => {
    vi.mocked(getAccessState).mockResolvedValue(DEACTIVATED);
    const request = new Request('http://localhost/portal/student');

    // The member layout and the student layout guard the same navigation in parallel.
    const targets = await Promise.all([
      redirectFrom(guardPortalPage(request, 'student')),
      redirectFrom(guardPortalPage(request, 'student')),
    ]);

    expect(targets).toEqual(['/portal/login?reason=inactive', '/portal/login?reason=inactive']);
    expect(signOut).not.toHaveBeenCalled(); // the server would refuse it (403 user_banned)
    expect(forgetDeactivatedSession).toHaveBeenCalledTimes(2); // local only, no request each
  });
});
