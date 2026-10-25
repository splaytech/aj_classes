import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  token: 'token-1',
  profileReads: 0,
}));

vi.mock('./supabase.client', () => ({
  isPortalConfigured: () => true,
  getSupabase: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: fake.token, user: { id: 'u1', email: 'a@local.test' } } },
      }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' } }) },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            fake.profileReads += 1;
            return {
              data: { full_name: 'Local Parent', role: 'parent', is_active: true },
              error: null,
            };
          },
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  fake.token = 'token-1';
  fake.profileReads = 0;
});

describe('getAccessState is shared by one page load (BUG-9: no extra request)', () => {
  it('reads the profile once for the layouts and the page loader asking together', async () => {
    const { getAccessState } = await import('./auth.service');
    const answers = await Promise.all([getAccessState(), getAccessState(), getAccessState()]);
    expect(fake.profileReads).toBe(1);
    expect(answers.map((access) => access.profile?.role)).toEqual(['parent', 'parent', 'parent']);
  });

  it('reads afresh for a new session (signed in again, or two-step finished)', async () => {
    const { getAccessState } = await import('./auth.service');
    await getAccessState();
    fake.token = 'token-2';
    await getAccessState();
    expect(fake.profileReads).toBe(2);
  });

  it('reads afresh on the next page (after the short sharing window)', async () => {
    vi.useFakeTimers();
    const { getAccessState } = await import('./auth.service');
    await getAccessState();
    vi.advanceTimersByTime(1500);
    await getAccessState();
    expect(fake.profileReads).toBe(2);
  });
});
