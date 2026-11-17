import type { Page } from '@playwright/test';
import { test, expect } from '../src/fixtures/test-fixtures.js';
import { extractLink } from '../src/mail/mailpit.js';

// Open sign-up for parents and guardians (ADR-0011; docs/delivery/2026-11-13-open-sign-up 03 §10
// "E2E"). Every account carries an e2e-<run>- marker and is deleted after its test, with the
// day's cap rows the test added.

const CONFIRM_LINK =
  /http:\/\/localhost:5173\/portal\/auth\/confirm\?token_hash=[^\s)"&]+&type=email/;
const PASSWORD = 'e2e only, a long enough password';

/** The always-pass local Turnstile widget settles asynchronously; submit only once it has. */
async function waitForHumanCheck(page: Page): Promise<void> {
  await page
    .getByText('Success!', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
}

test.describe('Open sign-up', () => {
  test('a parent signs up by e-mail, confirms, finishes and lands on Latest news (AC-1, AC-16, AC-21)', async ({
    page,
    db,
    mail,
    marker,
    cleanup,
  }) => {
    test.setTimeout(60_000);
    const nameMarker = marker('sign-up');
    const email = `${nameMarker.value}@example.test`;
    const fullName = `E2E Parent ${nameMarker.value.slice(-6)}`;
    const startedAt = new Date();

    cleanup.register(async () => {
      const [profile] = await db.query<{ id: string }>(
        'SELECT id FROM public.profiles WHERE email = $1',
        [email],
      );
      if (profile) {
        await db.query('DELETE FROM public.audit_log WHERE actor_id = $1 OR target_id = $1', [
          profile.id,
        ]);
        await db.query('DELETE FROM auth.users WHERE id = $1', [profile.id]);
      }
      await db.query('DELETE FROM private.sign_up_emails WHERE created_at >= $1', [startedAt]);
    });

    // AC-1: from the Sign in page.
    await page.goto('/portal/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/portal\/sign-up$/);
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Email').fill(email);
    await waitForHumanCheck(page);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your e-mail' })).toBeVisible();

    // AC-16: the e-mailed link opens our own page and uses nothing until Continue.
    const message = await mail.findMessage({
      to: email,
      subjectContains: 'Confirm your e-mail',
      since: startedAt,
    });
    await page.goto(extractLink(message, CONFIRM_LINK));
    await expect(page.getByRole('heading', { name: 'Confirm your e-mail' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // The finish step: password and the tick.
    await expect(page.getByRole('heading', { name: 'Finish creating your account' })).toBeVisible();
    expect(new URL(page.url()).search).toBe(''); // the token is gone from the address bar
    await expect(page.getByLabel('Full name')).toHaveValue(''); // not pre-filled (security 06 finding 9)
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Create password').fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Finish' }).click();

    // AC-21: Latest news, with only the user's links.
    await expect(page).toHaveURL(/\/portal\/user$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Latest news' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Portal' });
    // Mock tests (docs/delivery/2026-11-17-mock-tests AC 8) added a link for users; this
    // supersedes the AC-21 "Latest news and Account only".
    await expect(nav.getByRole('link')).toHaveText(['Latest news', 'Mock tests', 'Account']);

    // And the database agrees.
    const [row] = await db.query<{
      role: string;
      status: string;
      terms: boolean;
      audited: boolean;
    }>(
      `SELECT p.role::text AS role, p.status::text AS status, p.terms_accepted_at IS NOT NULL AS terms,
              EXISTS (SELECT 1 FROM public.audit_log a WHERE a.target_id = p.id
                      AND a.action = 'account_activated' AND a.details ->> 'role' = 'user') AS audited
         FROM public.profiles p WHERE p.email = $1`,
      [email],
    );
    expect(row).toEqual({ role: 'user', status: 'active', terms: true, audited: true });
  });

  test('Google-only (the hosted release): with the e-mail form off, Sign in links to a page that offers only Google', async ({
    page,
  }) => {
    // Locally e-mail is on and Google off (seed.sql), so both answers are stubbed as hosted ships.
    await page.route('**/auth/v1/settings', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { external?: Record<string, boolean> };
      await route.fulfill({
        response,
        json: { ...body, external: { ...body.external, google: true } },
      });
    });
    await page.route('**/rest/v1/rpc/sign_up_email_open', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'false' }),
    );

    await page.goto('/portal/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
  });

  test('Google-only with Google off: no way in, so sign-up reads as closed and Sign in has no link', async ({
    page,
  }) => {
    await page.route('**/rest/v1/rpc/sign_up_email_open', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'false' }),
    );

    await page.goto('/portal/sign-up');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign-up is closed' })).toBeVisible();
    await page.goto('/portal/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
  });

  test('Continue with Google is offered when Supabase says Google is on, and a refusal shows message M (AC-51, AC-54)', async ({
    page,
  }) => {
    // Locally Google is off, so the settings answer is stubbed to say it is on.
    await page.route('**/auth/v1/settings', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { external?: Record<string, boolean> };
      await route.fulfill({
        response,
        json: { ...body, external: { ...body.external, google: true } },
      });
    });
    let authorizeUrl = '';
    await page.route('**/auth/v1/authorize**', async (route) => {
      authorizeUrl = route.request().url();
      await route.abort();
    });

    await page.goto('/portal/sign-up');
    const origin = new URL(page.url()).origin;
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect.poll(() => authorizeUrl).not.toBe('');
    const authorize = new URL(authorizeUrl);
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe(`${origin}/portal/auth/callback`);
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy(); // PKCE (S7)

    // The linking trigger's refusal, as Supabase sends it back (05-dev-notes, S3 shapes).
    await page.goto(
      '/portal/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity#error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity&sb=',
    );
    await expect(
      page.getByText('This e-mail already has an AJ Classes account.', { exact: false }),
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('Forgot password still works with the PKCE client (S7)', async ({
    page,
    db,
    mail,
    marker,
    cleanup,
  }) => {
    test.setTimeout(60_000);
    const nameMarker = marker('reset');
    const email = `${nameMarker.value}@example.test`;
    const newPassword = 'e2e only, the new password after reset';
    const startedAt = new Date();
    // A finished signed-up user, made directly in the local database.
    const [created] = await db.query<{ id: string }>(
      `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change, email_change_token_new)
       VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
         extensions.crypt('e2e only, the old password', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', $2, now(), now(), '', '', '', '')
       RETURNING id`,
      [email, JSON.stringify({ full_name: 'E2E Reset Parent' })],
    );
    cleanup.register(async () => {
      await db.query('DELETE FROM public.audit_log WHERE actor_id = $1 OR target_id = $1', [
        created!.id,
      ]);
      await db.query('DELETE FROM auth.users WHERE id = $1', [created!.id]);
    });
    await db.query(
      `INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, jsonb_build_object('sub', $2::text, 'email', $3::text), 'email', now(), now())`,
      [created!.id, created!.id, email],
    );
    await db.query(
      `UPDATE public.profiles SET status = 'active', joined_at = now(), terms_accepted_at = now() WHERE id = $1`,
      [created!.id],
    );

    await page.goto('/portal/forgot-password');
    await page.getByLabel('Email').fill(email);
    await waitForHumanCheck(page);
    await page.getByRole('button', { name: 'Send link' }).click();
    await expect(
      page.getByText("If that email has an account, we've sent a link.", { exact: false }),
    ).toBeVisible();

    const message = await mail.findMessage({
      to: email,
      subjectContains: 'Reset',
      since: startedAt,
    });
    await page.goto(
      extractLink(
        message,
        /http:\/\/localhost:5173\/portal\/auth\/confirm\?token_hash=[^\s)"&]+&type=recovery/,
      ),
    );
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();
    await page.getByLabel('New password').fill(newPassword);
    await page.getByLabel('Type it again').fill(newPassword);
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page).toHaveURL(/\/portal\/(user|login)/);

    const [row] = await db.query<{ changed: boolean }>(
      `SELECT encrypted_password = extensions.crypt($2, encrypted_password) AS changed FROM auth.users WHERE id = $1`,
      [created!.id, newPassword],
    );
    expect(row?.changed).toBe(true);
  });
});
