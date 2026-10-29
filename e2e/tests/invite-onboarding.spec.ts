import { test, expect } from '../src/fixtures/test-fixtures.js';
import { backdateInvite, clearInviteRedeemAttempts } from '../src/db/invites.js';
import { pollForRow } from '../src/db/poll.js';
import { extractLink } from '../src/mail/mailpit.js';

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  status: string;
}

// The invite email links to the app's own /portal/invite page with our 14-day token (ADR-0010):
// nothing is used up until the person clicks "Continue" there.
const INVITE_LINK_PATTERN = /https?:\/\/[^\s")]+\/portal\/invite\?token=[A-Za-z0-9_-]{43}/;
const REFUSED_TEXT =
  'This invitation link has expired. Please contact your AJ Classes administrator to request a new invite.';

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

    // The page does nothing until "Continue" is clicked, so an email scanner opening it any number
    // of times can't use up the single-use link (AC 6). The click redeems it, signs in and opens
    // /portal/join, with the token gone from the address bar (AC 8).
    // A link sent 13 days ago still works (AC 1): links last 14 days from the send.
    await backdateInvite(email, '13 days');
    await clearInviteRedeemAttempts();
    for (let open = 0; open < 3; open += 1) await inviteePage.goto(inviteLink);
    await inviteePage.getByRole('button', { name: /^continue$/i }).click();
    await inviteePage.waitForURL(/\/portal\/join/);
    expect(await inviteePage.evaluate(() => window.location.search)).toBe('');
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

    // The used link, opened in a fresh browser, is refused (AC 7).
    const reuseContext = await browser.newContext();
    cleanup.register(() => reuseContext.close());
    const reusePage = await reuseContext.newPage();
    await reusePage.goto(inviteLink);
    await reusePage.getByRole('button', { name: /^continue$/i }).click();
    await expect(reusePage.getByText(REFUSED_TEXT)).toBeVisible();

    await mail.deleteMessage(message.ID);
  });

  test('an invite sent before 14-day links shows as expired, with no "Invited on" (AC 25)', async ({
    authedAdminPage,
    db,
    marker,
    cleanup,
  }) => {
    const nameMarker = marker('old-invite');
    const email = `${nameMarker.value}@example.test`;
    // An Auth user with no invited_at, as the migration leaves every pending invite (ADR-0010).
    const [user] = await db.query<{ id: string }>(
      `INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
       VALUES (gen_random_uuid(), 'authenticated', 'authenticated', $1, $2)
       RETURNING id`,
      [email, JSON.stringify({ full_name: `E2E Old Invite ${nameMarker.value}` })],
    );
    cleanup.register(async () => {
      await db.query('DELETE FROM auth.users WHERE id = $1', [user.id]);
    });

    await authedAdminPage.goto(`/portal/admin/staff/${user.id}`);

    await expect(authedAdminPage.getByText('Invite expired').first()).toBeVisible();
    await expect(authedAdminPage.getByText('The link has expired. Send a new one.')).toBeVisible();
    await expect(authedAdminPage.getByText(/Invited on/)).toHaveCount(0);
  });
});
