import { render, screen, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PORTAL_ROUTES, USERS_PAGE } from '@/constants';
import { getSignUpStatus, listUsers, setAccountActive, setSignUpOpen } from '@/services';
import type { SignedUpUser } from '@/services';
import { setupUser } from '@/test/user';

import AdminUsersPage, { clientLoader } from './admin-users';

vi.mock('@/services', () => ({
  getSignUpStatus: vi.fn(),
  listUsers: vi.fn(),
  setAccountActive: vi.fn(),
  setSignUpOpen: vi.fn(),
}));

const FINISHED: SignedUpUser = {
  id: 'u1',
  email: 'priya@example.com',
  fullName: 'Priya Shah',
  signedUpAt: '2026-11-10T01:00:00Z',
  signedUpWith: 'email',
  finished: true,
  isActive: true,
};
const GOOGLE_UNFINISHED: SignedUpUser = {
  ...FINISHED,
  id: 'u2',
  email: 'g@example.com',
  fullName: 'Gita Rao',
  signedUpWith: 'google',
  finished: false,
  isActive: false,
};

function renderPage(users: SignedUpUser[], status: 'open' | 'busy' | 'closed' = 'open') {
  vi.mocked(listUsers).mockResolvedValue({ ok: true, data: users });
  vi.mocked(getSignUpStatus).mockResolvedValue({ ok: true, data: status });
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.adminUsers, Component: AdminUsersPage, loader: () => clientLoader() },
  ]);
  render(<Stub initialEntries={[PORTAL_ROUTES.adminUsers]} />);
}

beforeEach(() => {
  vi.mocked(setAccountActive).mockReset().mockResolvedValue({ ok: true, data: undefined });
  vi.mocked(setSignUpOpen).mockReset().mockResolvedValue({ ok: true, data: undefined });
});

describe('Admin → Users (AC-31, AC-32, AC-48)', () => {
  it('lists users with the right columns and labels', async () => {
    renderPage([FINISHED, GOOGLE_UNFINISHED]);
    const table = await screen.findByRole('table', { name: USERS_PAGE.heading });
    for (const column of Object.values(USERS_PAGE.columns)) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('Priya Shah');
    expect(first).toHaveTextContent(USERS_PAGE.how.email);
    expect(first).toHaveTextContent(USERS_PAGE.finished.yes);
    expect(first).toHaveTextContent('Active');
    expect(first).toHaveTextContent(/^.*Signed up \d/);
    expect(second).toHaveTextContent(USERS_PAGE.how.google);
    expect(second).toHaveTextContent(USERS_PAGE.finished.no);
    expect(second).toHaveTextContent('Deactivated');
    expect(
      within(second!).getByRole('button', { name: USERS_PAGE.reactivate }),
    ).toBeInTheDocument();
    expect(screen.getByText(USERS_PAGE.intro)).toBeInTheDocument();
    expect(screen.getByText(USERS_PAGE.hint)).toBeInTheDocument();
  });

  it('says when no one has signed up yet', async () => {
    renderPage([]);
    expect(await screen.findByText(USERS_PAGE.empty)).toBeInTheDocument();
  });

  it('closes sign-up after the confirm dialog (busy counts as open)', async () => {
    renderPage([], 'busy');
    const user = setupUser();
    expect(await screen.findByText(USERS_PAGE.switch.open)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: USERS_PAGE.switch.close }));
    const dialog = screen.getByRole('dialog', { name: USERS_PAGE.switch.closeDialog.title });
    expect(dialog).toHaveTextContent(USERS_PAGE.switch.closeDialog.text);
    await user.click(within(dialog).getByRole('button', { name: USERS_PAGE.switch.close }));
    expect(setSignUpOpen).toHaveBeenCalledWith(false);
    expect(await screen.findByText(USERS_PAGE.switch.closedNotice)).toBeInTheDocument();
  });

  it('opens sign-up again after the confirm dialog', async () => {
    renderPage([], 'closed');
    const user = setupUser();
    expect(await screen.findByText(USERS_PAGE.switch.closed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: USERS_PAGE.switch.reopen }));
    const dialog = screen.getByRole('dialog', { name: USERS_PAGE.switch.openDialog.title });
    expect(dialog).toHaveTextContent(USERS_PAGE.switch.openDialog.text);
    await user.click(within(dialog).getByRole('button', { name: USERS_PAGE.switch.reopen }));
    expect(setSignUpOpen).toHaveBeenCalledWith(true);
  });

  it('deactivates and reactivates through their dialogs', async () => {
    renderPage([FINISHED, GOOGLE_UNFINISHED]);
    const user = setupUser();
    await user.click(await screen.findByRole('button', { name: USERS_PAGE.deactivate }));
    let dialog = screen.getByRole('dialog', {
      name: USERS_PAGE.deactivateDialog.title('Priya Shah'),
    });
    expect(dialog).toHaveTextContent(USERS_PAGE.deactivateDialog.text);
    await user.click(within(dialog).getByRole('button', { name: USERS_PAGE.deactivate }));
    expect(setAccountActive).toHaveBeenCalledWith('u1', false);

    // The first dialog's closing transition hides the page from assistive tech for a moment.
    await user.click(await screen.findByRole('button', { name: USERS_PAGE.reactivate }));
    dialog = screen.getByRole('dialog', { name: USERS_PAGE.reactivateDialog.title('Gita Rao') });
    expect(dialog).toHaveTextContent(USERS_PAGE.reactivateDialog.text);
    await user.click(within(dialog).getByRole('button', { name: USERS_PAGE.reactivate }));
    expect(setAccountActive).toHaveBeenCalledWith('u2', true);
  });

  it("says the status couldn't be loaded, with a retry, rather than claim closed (Tester 6a bug 2)", async () => {
    vi.mocked(listUsers).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getSignUpStatus).mockResolvedValue({ ok: false, error: 'network' });
    const Stub = createRoutesStub([
      { path: PORTAL_ROUTES.adminUsers, Component: AdminUsersPage, loader: () => clientLoader() },
    ]);
    render(<Stub initialEntries={[PORTAL_ROUTES.adminUsers]} />);
    expect(await screen.findByText(USERS_PAGE.switch.unknown)).toBeInTheDocument();
    expect(screen.queryByText(USERS_PAGE.switch.closed)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: USERS_PAGE.switch.reopen }),
    ).not.toBeInTheDocument();
    vi.mocked(getSignUpStatus).mockResolvedValue({ ok: true, data: 'open' });
    await setupUser().click(screen.getByRole('button', { name: USERS_PAGE.switch.retry }));
    expect(await screen.findByText(USERS_PAGE.switch.open)).toBeInTheDocument();
  });

  it('sends no sign-up status read when the list is refused (not an admin with two-step)', async () => {
    vi.mocked(listUsers).mockResolvedValue({ ok: false, error: 'notAllowed' });
    vi.mocked(getSignUpStatus).mockReset();
    await clientLoader();
    expect(getSignUpStatus).not.toHaveBeenCalled();
  });
});
