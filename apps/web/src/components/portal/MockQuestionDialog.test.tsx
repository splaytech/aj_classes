import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_QUESTION_DIALOG, MOCK_SCORING, MOCK_VALIDATION, PORTAL_ERRORS } from '@/constants';
import { saveMockQuestion } from '@/services';
import { setupUser } from '@/test/user';

import { MockQuestionDialog } from './MockQuestionDialog';

vi.mock('@/services', () => ({ saveMockQuestion: vi.fn() }));

function renderDialog(existing = null as Parameters<typeof MockQuestionDialog>[0]['existing']) {
  const onSaved = vi.fn();
  render(
    <MockQuestionDialog open testId="t1" existing={existing} onSaved={onSaved} onClose={vi.fn()} />,
  );
  return onSaved;
}

function saveButton() {
  return screen.getByRole('button', { name: MOCK_QUESTION_DIALOG.save });
}

beforeEach(() => vi.mocked(saveMockQuestion).mockReset());

describe('MockQuestionDialog', () => {
  it('refuses a prompt of only spaces and line breaks, and sends nothing', async () => {
    const user = setupUser();
    renderDialog();

    await user.type(
      screen.getByLabelText(new RegExp(MOCK_QUESTION_DIALOG.promptLabel)),
      '  {Enter}  ',
    );
    await user.click(saveButton());

    expect(screen.getByText(MOCK_VALIDATION.prompt)).toBeInTheDocument();
    expect(saveMockQuestion).not.toHaveBeenCalled();
  });

  it('needs every option filled in and a correct option chosen', async () => {
    const user = setupUser();
    renderDialog();

    await user.type(screen.getByLabelText(new RegExp(MOCK_QUESTION_DIALOG.promptLabel)), 'What?');
    await user.click(saveButton());

    expect(screen.getByText(MOCK_VALIDATION.optionLength)).toBeInTheDocument();
    expect(saveMockQuestion).not.toHaveBeenCalled();
  });

  it('saves a new question with the chosen correct option', async () => {
    vi.mocked(saveMockQuestion).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    const onSaved = renderDialog();

    await user.type(screen.getByLabelText(new RegExp(MOCK_QUESTION_DIALOG.promptLabel)), 'What?');
    await user.type(screen.getByLabelText(MOCK_QUESTION_DIALOG.optionLabel('A')), 'Yes');
    await user.type(screen.getByLabelText(MOCK_QUESTION_DIALOG.optionLabel('B')), 'No');
    await user.click(screen.getByRole('radio', { name: MOCK_QUESTION_DIALOG.correctLabel('B') }));
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(saveMockQuestion).toHaveBeenCalledWith({
      id: undefined,
      testId: 't1',
      prompt: 'What?',
      options: ['Yes', 'No'],
      correctOption: 1,
      explanation: '',
      marks: 1,
    });
  });

  it('shows the database refusal in the dialog and stays open', async () => {
    vi.mocked(saveMockQuestion).mockResolvedValue({ ok: false, error: 'mockTooManyQuestions' });
    const user = setupUser();
    const onSaved = renderDialog({
      id: 'q1',
      position: 1,
      prompt: 'What?',
      options: ['Yes', 'No'],
      marks: 1,
      correctOption: 0,
      explanation: '',
    });

    await user.click(saveButton());

    expect(await screen.findByText(PORTAL_ERRORS.mockTooManyQuestions)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('MockQuestionDialog marks (AC 1, 2)', () => {
  async function fillValid(user: ReturnType<typeof setupUser>) {
    await user.type(screen.getByLabelText(new RegExp(MOCK_QUESTION_DIALOG.promptLabel)), 'What?');
    await user.type(screen.getByLabelText(MOCK_QUESTION_DIALOG.optionLabel('A')), 'Yes');
    await user.type(screen.getByLabelText(MOCK_QUESTION_DIALOG.optionLabel('B')), 'No');
    await user.click(screen.getByRole('radio', { name: MOCK_QUESTION_DIALOG.correctLabel('B') }));
  }

  it('starts at 1 mark', () => {
    renderDialog();
    expect(screen.getByLabelText(MOCK_SCORING.marksLabel)).toHaveValue(1);
  });

  it.each(['', '0', '-1', '2.5', '101', '1e2'])(
    'refuses %j marks and saves nothing',
    async (text) => {
      const user = setupUser();
      renderDialog();
      await fillValid(user);

      const field = screen.getByLabelText(MOCK_SCORING.marksLabel);
      await user.clear(field);
      if (text) await user.type(field, text);
      await user.click(saveButton());

      expect(screen.getByText(MOCK_VALIDATION.marks)).toBeInTheDocument();
      expect(saveMockQuestion).not.toHaveBeenCalled();
    },
  );

  it.each([1, 100])('saves %i marks', async (marks) => {
    vi.mocked(saveMockQuestion).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderDialog();
    await fillValid(user);

    const field = screen.getByLabelText(MOCK_SCORING.marksLabel);
    await user.clear(field);
    await user.type(field, String(marks));
    await user.click(saveButton());

    await waitFor(() => expect(saveMockQuestion).toHaveBeenCalledTimes(1));
    expect(saveMockQuestion).toHaveBeenCalledWith(expect.objectContaining({ marks }));
  });

  it('shows the saved marks when editing', () => {
    renderDialog({
      id: 'q1',
      position: 1,
      prompt: 'What?',
      options: ['Yes', 'No'],
      marks: 7,
      correctOption: 0,
      explanation: '',
    });
    expect(screen.getByLabelText(MOCK_SCORING.marksLabel)).toHaveValue(7);
  });
});
