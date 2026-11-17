import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_TAKE_PAGE, PORTAL_ERRORS } from '@/constants';
import { saveMockAnswer, submitMockTest } from '@/services';
import type { MockTestView } from '@/services';
import { setupUser } from '@/test/user';

import { MockTestTakeForm } from './MockTestTakeForm';

vi.mock('@/services', () => ({ saveMockAnswer: vi.fn(), submitMockTest: vi.fn() }));

// Stored positions have a gap (2 was deleted): the screen still counts 1, 2, 3.
const TEST: MockTestView = {
  id: 't1',
  title: 'Year 7 Maths',
  instructions: '',
  status: 'in_progress',
  questionCount: 3,
  score: null,
  total: null,
  questions: [
    { id: 'q1', position: 1, prompt: 'First?', options: ['Yes', 'No'], selectedOption: null },
    { id: 'q2', position: 3, prompt: 'Second?', options: ['Red', 'Blue'], selectedOption: 1 },
    { id: 'q3', position: 4, prompt: 'Third?', options: ['Up', 'Down'], selectedOption: null },
  ],
};

function renderForm(test = TEST) {
  const onSubmitted = vi.fn();
  render(<MockTestTakeForm test={test} onSubmitted={onSubmitted} />);
  return onSubmitted;
}

function nextButton() {
  return screen.getByRole('button', { name: MOCK_TAKE_PAGE.next });
}

beforeEach(() => {
  vi.mocked(saveMockAnswer).mockReset();
  vi.mocked(submitMockTest).mockReset();
});

describe('MockTestTakeForm', () => {
  it('shows one question at a time, numbered by order, as a labelled radio group (AC 43)', async () => {
    const user = setupUser();
    renderForm();

    expect(screen.getByRole('heading', { name: MOCK_TAKE_PAGE.questionOf(1, 3) })).toBeVisible();
    const group = screen.getByRole('radiogroup', { name: 'First?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Second?')).not.toBeInTheDocument();

    await user.click(nextButton());
    // The second question has stored position 3, but it is the second on screen.
    expect(screen.getByRole('heading', { name: MOCK_TAKE_PAGE.questionOf(2, 3) })).toBeVisible();
  });

  it('lets people move Next and Previous without answering (AC 29)', async () => {
    const user = setupUser();
    renderForm();

    await user.click(nextButton());
    await user.click(nextButton());
    expect(screen.getByRole('radiogroup', { name: 'Third?' })).toBeVisible();
    expect(nextButton()).toBeDisabled(); // nothing after the last question
    await user.click(screen.getByRole('button', { name: MOCK_TAKE_PAGE.previous }));
    expect(screen.getByRole('radiogroup', { name: 'Second?' })).toBeVisible();
  });

  it('shows an option saved earlier as chosen, and counts it as answered (AC 27)', async () => {
    const user = setupUser();
    renderForm();

    expect(screen.getByText(MOCK_TAKE_PAGE.answered(1, 3))).toBeInTheDocument();
    await user.click(nextButton());
    expect(screen.getByRole('radio', { name: /Blue/ })).toBeChecked();
  });

  it('saves a chosen option straight away, with no save button (AC 28)', async () => {
    vi.mocked(saveMockAnswer).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /No/ }));

    expect(saveMockAnswer).toHaveBeenCalledWith('t1', 'q1', 1);
    expect(await screen.findByText(MOCK_TAKE_PAGE.saved)).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAKE_PAGE.answered(2, 3))).toBeInTheDocument();
  });

  it('keeps the chosen option on screen when the save fails, and says so plainly (AC 28)', async () => {
    vi.mocked(saveMockAnswer).mockResolvedValue({ ok: false, error: 'network' });
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /Yes/ }));

    expect(await screen.findByText(MOCK_TAKE_PAGE.saveFailed)).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAKE_PAGE.notSaved)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Yes/ })).toBeChecked();
  });

  it('counts a choice whose save failed as unanswered in the submit confirmation (L-8, F-6)', async () => {
    vi.mocked(saveMockAnswer).mockResolvedValue({ ok: false, error: 'network' });
    const user = setupUser();
    renderForm({
      ...TEST,
      questions: [
        { id: 'q1', position: 1, prompt: 'First?', options: ['Yes', 'No'], selectedOption: null },
        { id: 'q2', position: 2, prompt: 'Second?', options: ['Red', 'Blue'], selectedOption: 1 },
      ],
    });

    await user.click(screen.getByRole('radio', { name: /Yes/ }));
    expect(await screen.findByText(MOCK_TAKE_PAGE.saveFailed)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Yes/ })).toBeChecked();
    expect(screen.getByText(MOCK_TAKE_PAGE.answered(1, 2))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: MOCK_TAKE_PAGE.submit }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_TAKE_PAGE.confirmSubmitTitle });
    expect(dialog).toHaveTextContent(MOCK_TAKE_PAGE.confirmSubmitText(1));
  });

  it('shows the database reason when a save is refused', async () => {
    vi.mocked(saveMockAnswer).mockResolvedValue({ ok: false, error: 'alreadySubmitted' });
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /Yes/ }));

    expect(await screen.findByText(PORTAL_ERRORS.alreadySubmitted)).toBeInTheDocument();
  });

  it('counts the blank questions in the submit confirmation, and sends nothing yet (AC 30)', async () => {
    const user = setupUser();
    renderForm();

    await user.click(screen.getByRole('button', { name: MOCK_TAKE_PAGE.submit }));

    const dialog = await screen.findByRole('dialog', { name: MOCK_TAKE_PAGE.confirmSubmitTitle });
    expect(dialog).toHaveTextContent(MOCK_TAKE_PAGE.confirmSubmitText(2));
    expect(dialog).toHaveTextContent('2 questions aren’t answered yet and will count as incorrect');
    expect(submitMockTest).not.toHaveBeenCalled();
  });

  it('submits after the confirmation and tells the page', async () => {
    vi.mocked(submitMockTest).mockResolvedValue({ ok: true, data: { score: 1, total: 3 } });
    const user = setupUser();
    const onSubmitted = renderForm();

    await user.click(screen.getByRole('button', { name: MOCK_TAKE_PAGE.submit }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TAKE_PAGE.submit }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(submitMockTest).toHaveBeenCalledWith('t1');
  });

  it('stays on the question and shows the reason when the submit fails', async () => {
    vi.mocked(submitMockTest).mockResolvedValue({ ok: false, error: 'mockNotStarted' });
    const user = setupUser();
    const onSubmitted = renderForm();

    await user.click(screen.getByRole('button', { name: MOCK_TAKE_PAGE.submit }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TAKE_PAGE.submit }));

    expect(await screen.findByText(PORTAL_ERRORS.mockNotStarted)).toBeInTheDocument();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(await screen.findByRole('radiogroup', { name: 'First?' })).toBeVisible();
  });
});
