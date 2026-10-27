import { test, expect } from '../src/fixtures/test-fixtures.js';
import { pollForRow } from '../src/db/poll.js';
import { extractLink } from '../src/mail/mailpit.js';

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  status: string;
}

// The invite email links to the app's own /portal/auth/confirm page (not Supabase Auth's verify
// endpoint directly) — nothing is consumed until the person clicks "Continue" there.
const INVITE_LINK_PATTERN =
  /https?:\/\/[^\s")]+\/portal\/auth\/confirm\?token_hash=[^&"\s]+&type=invite/;

test.describe('Invite onboarding', () => {
  test('admin invites a staff member; they complete onboarding into an active tutor account', async ({
    authedAdminPage,
    browser,
    db,
    mail,
    marker,
    cleanup,
  }) => {
    // Chains invite-email delivery, a cross-origin Auth redirect, and full onboarding — longer
    // than the 30s default.
    test.setTimeout(60_000);

    // A separate browser context for the invitee: `authedAdminPage` is the
    // admin's session, and onboarding must happen as a different, unauthenticated user.
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    cleanup.register(() => inviteeContext.close());

    const nameMarker = marker('invitee');
    const email = `${nameMarker.value}@example.test`;
    const fullName = `E2E Invitee ${nameMarker.value}`;

    cleanup.register(async () => {
      const [profile] = await db.query<{ id: string }>(
        'SELECT id FROM public.profiles WHERE email = $1',
        [email],
      );
      if (!profile) return;
      await db.query('DELETE FROM public.audit_log WHERE actor_id = $1 OR target_id = $1', [
        profile.id,
      ]);
      await db.query('DELETE FROM public.profiles WHERE id = $1', [profile.id]);
      await db.query('DELETE FROM auth.users WHERE id = $1', [profile.id]);
    });

    const sinceInviteSent = new Date();

    await authedAdminPage.goto('/portal/admin/staff');
    await authedAdminPage.getByRole('button', { name: /invite staff/i }).click();
    const dialog = authedAdminPage.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(fullName);
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByRole('button', { name: /send invite/i }).click();
    await expect(dialog).toBeHidden();

    const message = await mail.findMessage({ to: email, since: sinceInviteSent });
    const inviteLink = extractLink(message, INVITE_LINK_PATTERN);

    const [invitedProfile] = await pollForRow(
      () =>
        db.query<ProfileRow>(
          'SELECT id, email, role, status FROM public.profiles WHERE email = $1',
          [email],
        ),
      (rows) => rows.length > 0,
    );
    expect(invitedProfile.role).toBe('tutor');
    expect(invitedProfile.status).toBe('invited');

    // The confirm page does nothing until "Continue" is clicked (so an email scanner can't burn
    // the single-use token); that click verifies the token_hash and navigates to /portal/join.
    await inviteePage.goto(inviteLink);
    await inviteePage.getByRole('button', { name: /^continue$/i }).click();
    await inviteePage.waitForURL(/\/portal\/join/);
    await inviteePage.locator('#join-full-name').fill(fullName);
    await inviteePage.locator('#join-phone').fill('0412345678');
    await inviteePage.locator('#join-password').fill('e2e-onboarding-password-123');
    await inviteePage.locator('#join-confirm-password').fill('e2e-onboarding-password-123');
    await inviteePage.locator('#join-terms').check();
    await inviteePage.getByRole('button', { name: /finish setup/i }).click();

    await inviteePage.waitForURL((url) => !url.pathname.startsWith('/portal/join'));

    await pollForRow(
      () =>
        db.query<ProfileRow>(
          'SELECT id, email, role, status FROM public.profiles WHERE email = $1',
          [email],
        ),
      (rows) => rows[0]?.status === 'active',
      { description: `profile ${email} onboarding completed` },
    );

    const [activeProfile] = await db.query<ProfileRow>(
      'SELECT id, email, role, status FROM public.profiles WHERE email = $1',
      [email],
    );
    expect(activeProfile.role).toBe('tutor');
    expect(activeProfile.status).toBe('active');

    await mail.deleteMessage(message.ID);
  });
});
