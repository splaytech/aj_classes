import type { Page } from '@playwright/test';
import { test, expect } from '../src/fixtures/test-fixtures.js';
import { mockWeb3Forms } from '../src/mocks/web3forms.js';
import { pollForRow } from '../src/db/poll.js';

interface EnquiryRow {
  id: string;
  name: string;
  email: string;
  message: string | null;
}

/**
 * ContactForm.tsx's onChange handler spreads the *closed-over* `values` into each field's
 * setState call (`setValues({ ...values, [field]: value })`) instead of using a functional
 * updater. Firing `fill()` on each field back-to-back, faster than React can commit a render
 * between them, means a later field's handler can still be closing over a stale `values` that
 * predates an earlier field's update — and silently reverts it. Fill, then verify every field
 * together and redo the whole pass (with a yield between fields) if any got clobbered.
 */
async function fillContactForm(page: Page, values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const [id, value] of entries) {
      await page.locator(`#contact-${id}`).fill(value);
      await page.waitForTimeout(50);
    }
    const stuck = await Promise.all(
      entries.map(([id]) => page.locator(`#contact-${id}`).inputValue()),
    );
    if (entries.every(([, value], i) => stuck[i] === value)) return;
  }
  throw new Error('fillContactForm: values did not stick after retries');
}

test.describe('Register Interest form', () => {
  test('submits via the mocked Web3Forms path and persists to public.enquiries', async ({
    page,
    db,
    marker,
    cleanup,
  }) => {
    const nameMarker = marker('enquiry');
    const email = `${nameMarker.value}@example.test`;
    const message = 'Looking for tutoring support ahead of exams.';

    cleanup.register(() =>
      db.query('DELETE FROM public.enquiries WHERE email = $1', [email]).then(() => undefined),
    );

    const capture = await mockWeb3Forms(page);

    await page.goto('/#ask-a-question');
    await fillContactForm(page, { name: nameMarker.value, email, message });
    await page.getByRole('button', { name: /register interest/i }).click();

    await expect(page.getByRole('status')).toContainText(/thank you/i);
    expect(capture.requests.length).toBeGreaterThan(0);
    expect(capture.requests[0].body.replyto ?? capture.requests[0].body.replyTo).toBe(email);

    const rows = await pollForRow(
      () =>
        db.query<EnquiryRow>(
          'SELECT id, name, email, message FROM public.enquiries WHERE email = $1',
          [email],
        ),
      (found) => found.length > 0,
      {
        description:
          `enquiries row email=${email} — requires the harness-managed dev server to run with ` +
          'VITE_LEAD_CAPTURE=on; see README.md',
      },
    );

    expect(rows[0].name).toBe(nameMarker.value);
    expect(rows[0].message).toBe(message);
  });
});
