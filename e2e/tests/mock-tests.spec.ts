import { test, expect } from '../src/fixtures/test-fixtures.js';
import { loginAsSeededMember } from '../src/auth/login.js';
import { pollForRow } from '../src/db/poll.js';
import {
  adminMockTestSelectors,
  forbiddenSelectors,
  takeMockTestSelectors,
} from './mock-tests.selectors.js';

// Mock tests (docs/delivery/2026-11-17-mock-tests, 03 §8 ACs 1, 18, 25, 26, 32, 36), and Close now
// (docs/delivery/2026-11-18-mock-test-closing AC 3 and 5.1). Every row carries an e2e-<run>- marker
// in its title and is removed after the test.

const STUDENT_EMAIL = 'student@local.test';
const TUTOR_EMAIL = 'tutor@local.test';

interface AttemptRow {
  profile_id: string;
  score: number | null;
  total: number | null;
  submitted_at: string | null;
}

test.describe('Mock tests', () => {
  test('admin writes and releases; a student takes it and never receives the answer key before submit (AC 36)', async ({
    authedAdminPage,
    browser,
    db,
    marker,
    cleanup,
  }) => {
    test.setTimeout(90_000);
    const title = marker('mock').value;

    cleanup.register(async () => {
      // A released test refuses delete, and an attempt blocks deleting its test. Remove the
      // attempts, take the test back to draft by hand (a trigger allows the status move), then
      // delete it; its questions go with it.
      await db.query(
        'DELETE FROM public.mock_test_attempts WHERE test_id IN (SELECT id FROM public.mock_tests WHERE title = $1)',
        [title],
      );
      await db.query(
        `UPDATE public.mock_tests SET status = 'draft', released_at = NULL, released_by = NULL, closes_at = NULL WHERE title = $1`,
        [title],
      );
      await db.query('DELETE FROM public.mock_tests WHERE title = $1', [title]);
    });

    // --- The admin creates a draft and adds two questions. ---
    const admin = authedAdminPage;
    await admin.goto('/portal/admin/mock-tests');
    await adminMockTestSelectors.newButton(admin).click();
    await adminMockTestSelectors.titleField(admin).fill(title);
    await adminMockTestSelectors.createButton(admin).click();
    await expect(admin).toHaveURL(/\/portal\/admin\/mock-tests\/[0-9a-f-]{36}$/);
    await expect(admin.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const questions = [
      { prompt: 'What is 2 + 2?', options: ['4', '5'], correct: 'A', explanation: 'Add them.' },
      { prompt: 'What is 3 + 3?', options: ['7', '6'], correct: 'B', explanation: '' },
    ];
    for (const question of questions) {
      await adminMockTestSelectors.addQuestionButton(admin).click();
      await adminMockTestSelectors.promptField(admin).fill(question.prompt);
      await adminMockTestSelectors.optionField(admin, 'A').fill(question.options[0] as string);
      await adminMockTestSelectors.optionField(admin, 'B').fill(question.options[1] as string);
      await adminMockTestSelectors.correctRadio(admin, question.correct).check();
      await adminMockTestSelectors.explanationField(admin).fill(question.explanation);
      await adminMockTestSelectors.saveQuestionButton(admin).click();
      await expect(admin.getByRole('dialog')).toBeHidden();
    }
    await expect(adminMockTestSelectors.questionHeading(admin, 2)).toBeVisible();

    const [draft] = await db.query<{ id: string; status: string }>(
      'SELECT id, status FROM public.mock_tests WHERE title = $1',
      [title],
    );
    expect(draft?.status).toBe('draft');

    // --- The admin releases it. ---
    await adminMockTestSelectors.releaseButton(admin).click();
    await adminMockTestSelectors.confirmReleaseButton(admin).click();
    await expect(adminMockTestSelectors.releasedNotice(admin)).toBeVisible();
    await pollForRow(
      () =>
        db.query<{ status: string }>('SELECT status FROM public.mock_tests WHERE title = $1', [
          title,
        ]),
      (rows) => rows[0]?.status === 'released',
      { description: `mock test ${title} released` },
    );

    // --- A student, in their own browser, opens the list, starts, answers and submits. ---
    const studentContext = await browser.newContext();
    cleanup.register(() => studentContext.close());
    const student = await studentContext.newPage();
    await loginAsSeededMember(student, STUDENT_EMAIL, '/portal/student');

    // Every mock_test_open reply before the submit, as text: none may carry the key or the
    // explanation (AC 36).
    const beforeSubmit: string[] = [];
    student.on('response', async (response) => {
      if (!response.url().includes('/rpc/mock_test_open')) return;
      const body = await response.text().catch(() => '');
      if (JSON.parse(body).status !== 'submitted') beforeSubmit.push(body);
    });

    await student.goto('/portal/student/mock-tests');
    await expect(takeMockTestSelectors.listHeading(student)).toBeVisible();
    await takeMockTestSelectors.startLink(student, title).click();

    const inProgressReply = student.waitForResponse(async (response) => {
      if (!response.url().includes('/rpc/mock_test_open')) return false;
      const body = await response.json().catch(() => null);
      return body?.status === 'in_progress';
    });
    await takeMockTestSelectors.startButton(student).click();
    const inProgress = await (await inProgressReply).json();

    expect(inProgress.questions).toHaveLength(2);
    expect(Object.keys(inProgress.questions[0]).sort()).toEqual([
      'id',
      'options',
      'position',
      'prompt',
      'selected_option',
    ]);
    expect(JSON.stringify(inProgress)).not.toContain('correct_option');
    expect(JSON.stringify(inProgress)).not.toContain('explanation');

    await expect(takeMockTestSelectors.questionHeading(student, 1, 2)).toBeVisible();
    await takeMockTestSelectors.option(student, /4/).check(); // right
    await expect(student.getByText('Saved')).toBeVisible();
    await takeMockTestSelectors.nextButton(student).click();
    await expect(takeMockTestSelectors.questionHeading(student, 2, 2)).toBeVisible();
    await takeMockTestSelectors.option(student, /7/).check(); // wrong
    await expect(student.getByText('Saved')).toBeVisible();

    await takeMockTestSelectors.submitButton(student).click();
    await takeMockTestSelectors.confirmSubmitButton(student).click();
    await expect(takeMockTestSelectors.score(student, 1, 2)).toBeVisible();

    expect(beforeSubmit.length).toBeGreaterThan(0);
    for (const body of beforeSubmit) {
      expect(body).not.toContain('correct_option');
      expect(body).not.toContain('explanation');
    }

    // The result page shows the explanation once submitted (D-2).
    await expect(student.getByText('Explanation: Add them.')).toBeVisible();

    const [attempt] = await pollForRow(
      () =>
        db.query<AttemptRow>(
          `SELECT a.profile_id, a.score, a.total, a.submitted_at
             FROM public.mock_test_attempts a
             JOIN public.mock_tests t ON t.id = a.test_id
            WHERE t.title = $1`,
          [title],
        ),
      (rows) => rows.length > 0 && rows[0]?.submitted_at !== null,
      { description: `attempt on ${title}` },
    );
    expect(attempt.score).toBe(1);
    expect(attempt.total).toBe(2);

    // Back on the list the card reads as submitted, with the score.
    await student.goto('/portal/student/mock-tests');
    await expect(takeMockTestSelectors.cardByTitle(student, title)).toContainText('1 of 2 correct');

    // --- The admin closes it now; the student submitted, so they still see it, marked Closed. ---
    await admin.reload();
    await adminMockTestSelectors.closeNowButton(admin).click();
    await adminMockTestSelectors.confirmCloseNowButton(admin).click();
    await expect(adminMockTestSelectors.closedNotice(admin)).toBeVisible();
    await expect(adminMockTestSelectors.closeNowButton(admin)).toHaveCount(0);
    await pollForRow(
      () =>
        db.query<{ closed: boolean }>(
          'SELECT closes_at <= now() AS closed FROM public.mock_tests WHERE title = $1',
          [title],
        ),
      (rows) => rows[0]?.closed === true,
      { description: `mock test ${title} closed` },
    );

    await student.goto('/portal/student/mock-tests');
    const card = takeMockTestSelectors.cardByTitle(student, title);
    await expect(card).toContainText('Closed');
    await expect(card).toContainText('1 of 2 correct');
  });

  test('a tutor is refused on the admin mock tests page (AC 1)', async ({ browser, cleanup }) => {
    const tutorContext = await browser.newContext();
    cleanup.register(() => tutorContext.close());
    const tutor = await tutorContext.newPage();
    await loginAsSeededMember(tutor, TUTOR_EMAIL, '/portal/tutor');

    await tutor.goto('/portal/admin/mock-tests');

    await expect(forbiddenSelectors.heading(tutor)).toBeVisible();
    await expect(tutor.getByRole('button', { name: 'New mock test' })).toHaveCount(0);
  });
});
