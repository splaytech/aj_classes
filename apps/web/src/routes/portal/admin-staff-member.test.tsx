import { render, screen, waitFor } from '@testing-library/react';
import { Outlet, createRoutesStub } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PORTAL_ERRORS, STAFF_MEMBER_PAGE } from '@/constants';
import { getProfile, getStaffMember, resendInvite } from '@/services';
import type { StaffMember } from '@/services';
import { setupUser } from '@/test/user';

import AdminStaffMemberPage, { clientLoader } from './admin-staff-member';

vi.mock('@/services', () => ({
  cancelInvite: vi.fn(),
  getProfile: vi.fn(),
  getStaffMember: vi.fn(),
  removePhoto: vi.fn(),
  resendInvite: vi.fn(),
  resetStaffTwoStep: vi.fn(),
  setAccountActive: vi.fn(),
  setStaffRole: vi.fn(),
  updateProfile: vi.fn(),
  uploadPhoto: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;

function invitedMember(invitedAt: string): StaffMember {
  return {
    id: 'u1',
    email: 'new@example.com',
    fullName: 'New Person',
    role: 'tutor',
    isActive: true,
    invitedAt,
    joinedAt: null,
    lastSignInAt: null,
    hasTwoStep: false,
    phone: null,
    termsAcceptedAt: null,
  };
}

function renderPage() {
  const Stub = createRoutesStub([
    {
      path: '/portal/admin/staff',
      Component: () => <Outlet context={{ userId: 'admin-1' }} />,
      children: [
        {
          path: ':userId',
          Component: AdminStaffMemberPage,
          // The page's own loader, so a revalidation really reads the member again.
          loader: ({ params }) => clientLoader({ params } as ClientLoaderFunctionArgs),
        },
      ],
    },
  ]);
  render(<Stub initialEntries={['/portal/admin/staff/u1']} />);
}

beforeEach(() => {
  vi.mocked(getProfile).mockResolvedValue({ ok: false, error: 'notFound' });
  vi.mocked(resendInvite).mockResolvedValue({ ok: true, data: undefined });
});

describe('staff member page: re-sending an invite (AC 24)', () => {
  it('reloads after a re-send, so an expired invite shows as invited again', async () => {
    const expired = invitedMember(new Date(Date.now() - 15 * DAY).toISOString());
    const resent = invitedMember(new Date().toISOString());
    vi.mocked(getStaffMember)
      .mockResolvedValueOnce({ ok: true, data: expired })
      .mockResolvedValue({ ok: true, data: resent });
    const user = setupUser();
    renderPage();

    expect(await screen.findByText(STAFF_MEMBER_PAGE.invite.expired)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: STAFF_MEMBER_PAGE.invite.resend }));

    expect(await screen.findByText(STAFF_MEMBER_PAGE.invite.resent)).toBeInTheDocument();
    // The reload finishes after the notice appears.
    await waitFor(() =>
      expect(screen.queryByText(STAFF_MEMBER_PAGE.invite.expired)).not.toBeInTheDocument(),
    );
    expect(getStaffMember).toHaveBeenCalledTimes(2);
  });

  it('does not reload when the re-send failed', async () => {
    const expired = invitedMember(new Date(Date.now() - 15 * DAY).toISOString());
    vi.mocked(getStaffMember).mockReset().mockResolvedValue({ ok: true, data: expired });
    vi.mocked(resendInvite).mockResolvedValue({ ok: false, error: 'emailFailed' });
    const user = setupUser();
    renderPage();

    await user.click(await screen.findByRole('button', { name: STAFF_MEMBER_PAGE.invite.resend }));

    expect(await screen.findByText(PORTAL_ERRORS.emailFailed)).toBeInTheDocument();
    expect(getStaffMember).toHaveBeenCalledTimes(1);
  });
});
