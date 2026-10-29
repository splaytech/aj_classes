import { render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_STUDENT_PAGE, CONSENT_KINDS, PORTAL_ERRORS } from '@/constants';
import { getStudentFamily, resendInvite } from '@/services';
import type { FamilyAccount, StudentFamily } from '@/services';
import { setupUser } from '@/test/user';

import AdminStudentPage, { clientLoader } from './admin-student';

vi.mock('@/services', () => ({
  cancelInvite: vi.fn(),
  getStudentFamily: vi.fn(),
  inviteParent: vi.fn(),
  inviteStudentAccount: vi.fn(),
  recordConsent: vi.fn(),
  resendInvite: vi.fn(),
  setAccountActive: vi.fn(),
  unlinkParent: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
const NO_CONSENTS = Object.fromEntries(
  CONSENT_KINDS.map((kind) => [kind, false]),
) as FamilyAccount['consents'];

function pending(id: string, email: string, daysAgo: number): FamilyAccount {
  return {
    id,
    email,
    fullName: '',
    isActive: true,
    invitedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    joinedAt: null,
    lastSignInAt: null,
    termsAcceptedAt: null,
    consents: NO_CONSENTS,
  };
}

/** A student whose account and one parent are both pending, each sent `…DaysAgo` days ago. */
function family(accountDaysAgo: number, parentDaysAgo = accountDaysAgo): StudentFamily {
  return {
    id: 's1',
    fullName: 'Aarav Demo',
    yearLevel: 8,
    isActive: true,
    consentRecordedAt: '2026-10-01T00:00:00Z',
    consentSource: null,
    account: pending('kid', 'kid@example.com', accountDaysAgo),
    parents: [pending('parent', 'parent@example.com', parentDaysAgo)],
    classes: [],
  };
}

function renderPage() {
  const Stub = createRoutesStub([
    {
      path: '/portal/admin/students/:studentId',
      Component: AdminStudentPage,
      // The page's own loader, so a revalidation really reads the student again.
      loader: ({ params }) => clientLoader({ params } as ClientLoaderFunctionArgs),
    },
  ]);
  render(<Stub initialEntries={['/portal/admin/students/s1']} />);
}

/** The page's Resend invite buttons: [0] the student account, [1] the parent row. */
async function resendButton(index: number): Promise<HTMLElement> {
  const buttons = await screen.findAllByRole('button', { name: ADMIN_STUDENT_PAGE.account.resend });
  const button = buttons[index];
  if (!button) throw new Error(`No Resend invite button ${index}`);
  return button;
}

beforeEach(() => {
  vi.mocked(getStudentFamily).mockReset();
  vi.mocked(resendInvite).mockReset();
  vi.mocked(resendInvite).mockResolvedValue({ ok: true, data: undefined });
});

describe('student page: re-sending an invite (AC 24)', () => {
  it.each([
    // After the reload, only the row that was re-sent has a fresh date.
    ['the student account', 0, 'kid', family(0, 15)],
    ['a parent row', 1, 'parent', family(15, 0)],
  ])('reloads after a re-send on %s', async (_where, index, id, afterResend) => {
    vi.mocked(getStudentFamily)
      .mockResolvedValueOnce({ ok: true, data: family(15) })
      .mockResolvedValue({ ok: true, data: afterResend });
    const user = setupUser();
    renderPage();

    expect(await screen.findAllByText('Invite expired')).toHaveLength(2);
    await user.click(await resendButton(index));

    expect(await screen.findByText(ADMIN_STUDENT_PAGE.account.resent)).toBeInTheDocument();
    expect(resendInvite).toHaveBeenCalledWith(id);
    // The reload finishes after the notice appears.
    await waitFor(() => expect(screen.queryAllByText('Invite expired')).toHaveLength(1));
    expect(getStudentFamily).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['the student account', 0],
    ['a parent row', 1],
  ])('does not reload when the re-send on %s failed', async (_where, index) => {
    vi.mocked(getStudentFamily).mockResolvedValue({ ok: true, data: family(15) });
    vi.mocked(resendInvite).mockResolvedValue({ ok: false, error: 'emailFailed' });
    const user = setupUser();
    renderPage();

    await user.click(await resendButton(index));

    expect(await screen.findByText(PORTAL_ERRORS.emailFailed)).toBeInTheDocument();
    expect(getStudentFamily).toHaveBeenCalledTimes(1);
  });
});
