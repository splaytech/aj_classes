import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each access token belongs to a different person, so a caller given someone else's answer shows.
const PEOPLE = {
  'token-1': { id: 'u1', role: 'parent' },
  'token-2': { id: 'u2', role: 'student' },
} as const;
type Token = keyof typeof PEOPLE;

const fake = vi.hoisted(() => ({
  token: 'token-1' as 'token-1' | 'token-2',
  reads: [] as string[], // the user id of every profile read
  holdReads: false, // when true, each read waits until released
  releases: [] as (() => void)[],
  failNextRead: false,
}));

vi.mock('./supabase.client', () => ({
  isPortalConfigured: () => true,
  getSupabase: async () => ({
    auth: {
      getSession: async () => {
        const person = PEOPLE[fake.token as Token];
        return {
          data: { session: { access_token: fake.token, user: { id: person.id, email: '' } } },
        };
      },
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' } }) },
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, userId: string) => ({
          maybeSingle: async () => {
            fake.reads.push(userId);
            if (fake.failNextRead) {
              fake.failNextRead = false;
              throw new TypeError('Failed to fetch');
            }
            if (fake.holdReads) await new Promise<void>((release) => fake.releases.push(release));
            const person = Object.values(PEOPLE).find((candidate) => candidate.id === userId);
            return {
              data: { full_name: `Person ${userId}`, role: person?.role, is_active: true },
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
  fake.token = 'token-1';
  fake.reads = [];
  fake.holdReads = false;
  fake.releases = [];
  fake.failNextRead = false;
});

const who = (access: { userId: string; profile: { role: string } | null }) =>
  `${access.userId}:${access.profile?.role}`;

describe('getAccessState is shared by one page load (BUG-9: no extra request)', () => {
  it('reads the profile once for the layouts and the page loader asking together', async () => {
    const { getAccessState } = await import('./auth.service');
    const answers = await Promise.all([getAccessState(), getAccessState(), getAccessState()]);
    expect(fake.reads).toEqual(['u1']);
    expect(answers.map(who)).toEqual(['u1:parent', 'u1:parent', 'u1:parent']);
  });

  it('never shares a read across sessions, even while one is still in progress', async () => {
    const { getAccessState } = await import('./auth.service');
    fake.holdReads = true;

    const first = getAccessState(); // token-1's read starts and stays open
    await vi.waitFor(() => expect(fake.reads).toEqual(['u1']));

    fake.token = 'token-2'; // signed in as someone else, or two-step finished
    const second = getAccessState();
    await vi.waitFor(() => expect(fake.reads).toEqual(['u1', 'u2']));

    // token-1 finishes while token-2's read is open: it mustn't clear token-2's shared read
    fake.releases[0]?.();
    expect(who(await first)).toBe('u1:parent');
    const third = getAccessState(); // another loader on token-2, asking at the same time
    // One macrotask: by now the third call has either shared token-2's read or started its own.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fake.releases.forEach((release) => release());

    expect([who(await second), who(await third)]).toEqual(['u2:student', 'u2:student']);
    expect(fake.reads).toEqual(['u1', 'u2']);
  });

  it('reads afresh once a read has finished (the next page, or straight after finishing setup)', async () => {
    const { getAccessState } = await import('./auth.service');
    await getAccessState();
    await getAccessState();
    expect(fake.reads).toEqual(['u1', 'u1']);
  });

  it("doesn't keep a failed read: the next call reads again and succeeds", async () => {
    const { getAccessState } = await import('./auth.service');
    fake.failNextRead = true;
    await expect(getAccessState()).rejects.toThrow('Failed to fetch');
    expect(who(await getAccessState())).toBe('u1:parent');
    expect(fake.reads).toEqual(['u1', 'u1']);
  });
});
