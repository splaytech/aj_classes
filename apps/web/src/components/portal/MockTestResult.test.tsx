import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_RESULT } from '@/constants';
import type { MockTestView } from '@/services';

import { MockTestResult } from './MockTestResult';

const TEST: MockTestView = {
  id: 't1',
  title: 'Year 7 Maths',
  instructions: '',
  status: 'submitted',
  questionCount: 2,
  score: 1,
  total: 2,
  questions: [
    {
      id: 'q1',
      position: 1,
      prompt: 'First?',
      options: ['Yes', 'No'],
      selectedOption: 0,
      correctOption: 0,
      explanation: 'Because.',
    },
    {
      id: 'q2',
      position: 5,
      prompt: 'Second?',
      options: ['Red', 'Blue'],
      selectedOption: null,
      correctOption: 1,
      explanation: '',
    },
  ],
};

describe('MockTestResult', () => {
  it('shows "N of M correct"', () => {
    render(<MockTestResult test={TEST} />);
    expect(screen.getByText('1 of 2 correct')).toBeInTheDocument();
  });

  it('shows each choice, the correct option and the explanation, numbered by order', () => {
    render(<MockTestResult test={TEST} />);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      MOCK_RESULT.question(1),
      MOCK_RESULT.question(2),
    ]);
    expect(
      screen.getByText(MOCK_RESULT.line(MOCK_RESULT.yourAnswer, MOCK_RESULT.choice('A', 'Yes'))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        MOCK_RESULT.line(MOCK_RESULT.correctAnswer, MOCK_RESULT.choice('B', 'Blue')),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(MOCK_RESULT.line(MOCK_RESULT.explanation, 'Because.')),
    ).toBeInTheDocument();
  });

  it('says "No answer." for a blank question and skips an empty explanation', () => {
    render(<MockTestResult test={TEST} />);

    expect(
      screen.getByText(MOCK_RESULT.line(MOCK_RESULT.yourAnswer, MOCK_RESULT.noAnswer)),
    ).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(`^${MOCK_RESULT.explanation}:`))).toHaveLength(1);
  });
});
