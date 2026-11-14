import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PARENT_INVITE_DIALOG, PORTAL_ERRORS } from '@/constants';
import { formatDate } from '@/lib/format';
import type { ParentInviteOutcome, Result } from '@/services';
import { setupUser } from '@/test/user';

import { ParentInviteDialog } from './ParentInviteDialog';

const SIGNED_UP_AT = '2026-11-10T01:00:00Z';
const onInvite =
  vi.fn<
    (email: string, name: string, confirmUserId?: string) => Promise<Result<ParentInviteOutcome>>
  >();
const onDone = vi.fn();

function needsConfirmation(signedUpWith: 'email' | 'google'): Result<ParentInviteOutcome> {
  return {
    ok: true,
    data: {
      kind: 'needsConfirmation',
      userId: 'u1',
      fullName: 'Priya Shah',
      signedUpAt: SIGNED_UP_AT,
      signedUpWith,
    },
  };
}

async function submit(email = 'priya@example.com') {
  render(
    <ParentInviteDialog
      open
      studentName="Aarav"
      onInvite={onInvite}
      onDone={onDone}
      onClose={() => undefined}
    />,
  );
  const user = setupUser();
  await user.type(screen.getByLabelText(PARENT_INVITE_DIALOG.emailLabel, { exact: false }), email);
  await user.click(screen.getByRole('button', { name: PARENT_INVITE_DIALOG.send }));
  return user;
}

beforeEach(() => {
  onInvite.mockReset();
  onDone.mockReset();
});

describe('ParentInviteDialog with a signed-up user (AC-33, R3)', () => {
  it('asks before linking, with how and when they signed up', async () => {
    onInvite.mockResolvedValueOnce(needsConfirmation('email'));
    await submit();
    const words = PARENT_INVITE_DIALOG.promote;
    expect(await screen.findByRole('dialog', { name: words.heading })).toBeInTheDocument();
    expect(screen.getByText(words.text('Aarav'))).toBeInTheDocument();
    expect(
      screen.getByText(words.signedUp('e-mail', formatDate(SIGNED_UP_AT))),
    ).toBeInTheDocument();
    expect(screen.queryByText(words.googleMobile)).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('says "Signed up with Google" and adds the mobile line only for Google', async () => {
    onInvite.mockResolvedValueOnce(needsConfirmation('google'));
    await submit();
    const words = PARENT_INVITE_DIALOG.promote;
    expect(
      await screen.findByText(words.signedUp('Google', formatDate(SIGNED_UP_AT))),
    ).toBeInTheDocument();
    expect(screen.getByText(words.googleMobile)).toBeInTheDocument();
  });

  it('links them on "Link as parent", sending their id', async () => {
    onInvite.mockResolvedValueOnce(needsConfirmation('email'));
    const user = await submit();
    onInvite.mockResolvedValueOnce({ ok: true, data: { kind: 'promoted', userId: 'u1' } });
    await user.click(
      await screen.findByRole('button', { name: PARENT_INVITE_DIALOG.promote.confirm }),
    );
    expect(onInvite).toHaveBeenLastCalledWith('priya@example.com', '', 'u1');
    expect(onDone).toHaveBeenCalledWith('priya@example.com', { kind: 'promoted', userId: 'u1' });
  });

  it('goes back to the form with the message when the account changed meanwhile', async () => {
    onInvite.mockResolvedValueOnce(needsConfirmation('email'));
    const user = await submit();
    onInvite.mockResolvedValueOnce({ ok: false, error: 'promotionChanged' });
    await user.click(
      await screen.findByRole('button', { name: PARENT_INVITE_DIALOG.promote.confirm }),
    );
    expect(await screen.findByText(PORTAL_ERRORS.promotionChanged)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PARENT_INVITE_DIALOG.send })).toBeInTheDocument();
  });

  it('still links an existing parent straight away', async () => {
    onInvite.mockResolvedValueOnce({ ok: true, data: { kind: 'linked', userId: 'p1' } });
    await submit();
    expect(onDone).toHaveBeenCalledWith('priya@example.com', { kind: 'linked', userId: 'p1' });
  });
});
