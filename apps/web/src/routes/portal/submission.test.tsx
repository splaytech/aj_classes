import { render, screen, waitFor, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SUBMISSION_PAGE } from '@/constants';
import { saveSubmission } from '@/services';
import type { Question, Submission } from '@/services';
import { setupUser } from '@/test/user';

import SubmissionPage from './submission';

vi.mock('@/services', () => ({ getSubmission: vi.fn(), saveSubmission: vi.fn() }));

function question(id: string, kind: Question['kind'], position: number): Question {
  return {
    id,
    assignmentId: 'a1',
    position,
    kind,
    prompt: `Prompt ${id}`,
    options: kind === 'multiple_choice' ? ['42', '36'] : [],
    correctOption: kind === 'multiple_choice' ? 0 : null,
    marks: 2,
    explanation: '',
  };
}

function submission(questions: Question[]): Submission {
  return {
    assignment: {
      id: 'a1',
      title: 'Held warm-up',
      dueOn: null,
      classId: 'c1',
      className: 'Maths',
      totalMarks: 4,
      questions,
    },
    student: { id: 's1', fullName: 'Aarav Demo', yearLevel: 8, isActive: true },
    result: {
      studentId: 's1',
      status: 'submitted',
      mark: null,
      feedback: '',
      markedAt: null,
      markedByName: '',
      submittedAt: '2026-10-26T01:00:00Z',
      returnedAt: null,
    },
    answers: questions.map((item) => ({
      questionId: item.id,
      selectedOption: item.kind === 'multiple_choice' ? 1 : null,
      response: item.kind === 'written' ? 'Because' : '',
      awardedMarks: item.kind === 'multiple_choice' ? 0 : null,
      feedback: '',
    })),
  };
}

async function renderPage(data: Submission) {
  const Stub = createRoutesStub([
    { path: '/', Component: SubmissionPage, loader: () => ({ ok: true, data }) },
  ]);
  render(<Stub />);
  await screen.findByText(SUBMISSION_PAGE.heading('Aarav Demo'));
}

function card(number: number) {
  const heading = screen.getByRole('heading', { name: SUBMISSION_PAGE.questionNumber(number) });
  return within(heading.closest('section') as HTMLElement);
}

beforeEach(() => {
  vi.mocked(saveSubmission).mockReset();
  vi.mocked(saveSubmission).mockResolvedValue({ ok: true, data: undefined });
});

describe('marking page: feedback on multiple-choice answers (item 7 AC-7.4)', () => {
  it('offers feedback, but no mark field, on a multiple-choice answer', async () => {
    await renderPage(submission([question('q1', 'multiple_choice', 1)]));

    expect(card(1).getByLabelText(SUBMISSION_PAGE.feedbackLabel)).toBeInTheDocument();
    expect(card(1).queryByLabelText(SUBMISSION_PAGE.marksLabel(2))).not.toBeInTheDocument();
    expect(card(1).getByText(SUBMISSION_PAGE.autoMarked('0', 2))).toBeInTheDocument();
  });

  it('saves the feedback and leaves the automatic mark alone', async () => {
    const user = setupUser();
    await renderPage(submission([question('q1', 'multiple_choice', 1)]));

    await user.type(card(1).getByLabelText(SUBMISSION_PAGE.feedbackLabel), 'Check six sevens.');
    await user.click(screen.getByRole('button', { name: SUBMISSION_PAGE.save }));

    await waitFor(() =>
      expect(saveSubmission).toHaveBeenCalledWith(
        'a1',
        's1',
        [{ questionId: 'q1', feedback: 'Check six sevens.' }],
        '',
        false,
      ),
    );
  });

  it('keeps the mark and feedback fields for written answers', async () => {
    const user = setupUser();
    await renderPage(
      submission([question('q1', 'multiple_choice', 1), question('q2', 'written', 2)]),
    );

    await user.type(card(2).getByLabelText(SUBMISSION_PAGE.marksLabel(2)), '1.5');
    await user.type(card(2).getByLabelText(SUBMISSION_PAGE.feedbackLabel), 'Good.');
    await user.click(screen.getByRole('button', { name: SUBMISSION_PAGE.save }));

    await waitFor(() =>
      expect(saveSubmission).toHaveBeenCalledWith(
        'a1',
        's1',
        [
          { questionId: 'q1', feedback: '' },
          { questionId: 'q2', awardedMarks: 1.5, feedback: 'Good.' },
        ],
        '',
        false,
      ),
    );
  });
});
