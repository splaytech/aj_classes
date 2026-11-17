import { render, screen, waitFor, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_RESULT,
  MOCK_TAGS,
  MOCK_TAKE_PAGE,
  NOT_FOUND_PANEL,
  PORTAL_ERRORS,
  mockTestPath,
  mockTestsPath,
} from '@/constants';
import type { MockTakerArea } from '@/constants';
import { startMockTest, submitMockTest } from '@/services';
import type { MockTestView, Result } from '@/services';
import { setupUser } from '@/test/user';

import MockTestPage, * as mockTestRoute from './mock-test';

vi.mock('@/services', () => ({
  startMockTest: vi.fn(),
  saveMockAnswer: vi.fn(),
  submitMockTest: vi.fn(),
}));

const BASE: MockTestView = {
  id: 't1',
  title: 'Year 7 Maths',
  instructions: 'Read each question.',
  status: 'not_started',
  questionCount: 2,
  totalMarks: 2,
  passMark: null,
  score: null,
  total: null,
  percentage: null,
  passed: null,
  tags: { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true },
  questions: [],
};

const IN_PROGRESS: MockTestView = {
  ...BASE,
  status: 'in_progress',
  questions: [
    {
      id: 'q1',
      position: 1,
      prompt: 'First?',
      options: ['Yes', 'No'],
      marks: 1,
      selectedOption: null,
    },
    {
      id: 'q2',
      position: 2,
      prompt: 'Second?',
      options: ['Red', 'Blue'],
      marks: 1,
      selectedOption: null,
    },
  ],
};

const SUBMITTED: MockTestView = {
  ...IN_PROGRESS,
  status: 'submitted',
  score: 1,
  total: 2,
  questions: [
    {
      id: 'q1',
      position: 1,
      prompt: 'First?',
      options: ['Yes', 'No'],
      marks: 1,
      selectedOption: 0,
      correctOption: 0,
      explanation: 'Because.',
    },
    {
      id: 'q2',
      position: 2,
      prompt: 'Second?',
      options: ['Red', 'Blue'],
      marks: 1,
      selectedOption: null,
      correctOption: 1,
      explanation: '',
    },
  ],
};

/** The loader gives each reply in turn, then repeats the last (a reload after Start). */
function renderTest(replies: Result<MockTestView>[], area: MockTakerArea = 'student') {
  const loader = vi.fn(() => replies[Math.min(loader.mock.calls.length - 1, replies.length - 1)]);
  const Stub = createRoutesStub([
    { path: mockTestPath(area, ':testId'), Component: MockTestPage, loader },
  ]);
  render(<Stub initialEntries={[mockTestPath(area, 't1')]} />);
  return loader;
}

beforeEach(() => {
  vi.mocked(startMockTest).mockReset();
  vi.mocked(submitMockTest).mockReset();
});

describe('mock test page, not started', () => {
  it('shows the title, instructions, question count and Start', async () => {
    renderTest([{ ok: true, data: BASE }]);

    expect(await screen.findByRole('heading', { level: 1, name: BASE.title })).toBeVisible();
    expect(screen.getByText(BASE.instructions)).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAKE_PAGE.questions(2))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_TAKE_PAGE.start })).toBeEnabled();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('shows the tags under the title (categories design §5.1)', async () => {
    renderTest([{ ok: true, data: BASE }]);
    await screen.findByRole('heading', { level: 1, name: BASE.title });
    expect(screen.getByText(MOCK_TAGS.line(MOCK_TAGS.streamLabel, 'NAPLAN'))).toBeInTheDocument();
    expect(
      screen.getByText(MOCK_TAGS.line(MOCK_TAGS.yearLevelLabel, 'Any year')),
    ).toBeInTheDocument();
  });

  it('starts, then reloads into the first question', async () => {
    vi.mocked(startMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    const loader = renderTest([
      { ok: true, data: BASE },
      { ok: true, data: IN_PROGRESS },
    ]);

    await user.click(await screen.findByRole('button', { name: MOCK_TAKE_PAGE.start }));

    expect(await screen.findByRole('radiogroup', { name: 'First?' })).toBeVisible();
    expect(startMockTest).toHaveBeenCalledWith('t1');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the first question heading after Start, not the page body (BUG-4)', async () => {
    vi.mocked(startMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderTest([
      { ok: true, data: BASE },
      { ok: true, data: IN_PROGRESS },
    ]);

    await user.click(await screen.findByRole('button', { name: MOCK_TAKE_PAGE.start }));

    const heading = await screen.findByRole('heading', { name: MOCK_TAKE_PAGE.questionOf(1, 2) });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('does not move focus when the page first opens in progress (skip link first)', async () => {
    renderTest([{ ok: true, data: IN_PROGRESS }]);

    await screen.findByRole('radiogroup', { name: 'First?' });
    expect(document.body).toHaveFocus();
  });

  it('moves focus to the result heading after a confirmed Submit (BUG-4)', async () => {
    vi.mocked(submitMockTest).mockResolvedValue({
      ok: true,
      data: { score: 1, total: 2, percentage: 50, passed: null },
    });
    const user = setupUser();
    renderTest([
      { ok: true, data: IN_PROGRESS },
      { ok: true, data: SUBMITTED },
    ]);

    await user.click(await screen.findByRole('button', { name: MOCK_TAKE_PAGE.submit }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TAKE_PAGE.submit }));

    const heading = await screen.findByRole('heading', { name: MOCK_RESULT.heading });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('shows the reason when Start is refused', async () => {
    vi.mocked(startMockTest).mockResolvedValue({ ok: false, error: 'notFound' });
    const user = setupUser();
    renderTest([{ ok: true, data: BASE }]);

    await user.click(await screen.findByRole('button', { name: MOCK_TAKE_PAGE.start }));

    expect(await screen.findByText(PORTAL_ERRORS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_TAKE_PAGE.start })).toBeEnabled();
  });

  it.each<MockTakerArea>(['student', 'parent', 'user'])(
    'links back to the %s list',
    async (area) => {
      renderTest([{ ok: true, data: BASE }], area);
      const back = await screen.findByRole('link', { name: MOCK_TAKE_PAGE.back });
      expect(back).toHaveAttribute('href', mockTestsPath(area));
    },
  );
});

describe('mock test page, in progress and submitted', () => {
  it('shows the take form while in progress, with no answer key anywhere', async () => {
    renderTest([{ ok: true, data: IN_PROGRESS }]);

    expect(await screen.findByRole('radiogroup', { name: 'First?' })).toBeVisible();
    expect(screen.queryByText(MOCK_RESULT.correctAnswer)).not.toBeInTheDocument();
    expect(screen.queryByText(MOCK_RESULT.heading)).not.toBeInTheDocument();
  });

  it('shows the result once submitted, and a second look shows the same score', async () => {
    renderTest([{ ok: true, data: SUBMITTED }]);

    expect(await screen.findByText('1 of 2 marks')).toBeInTheDocument();
    expect(screen.getByText(MOCK_RESULT.line(MOCK_RESULT.explanation, 'Because.'))).toBeVisible();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: MOCK_TAKE_PAGE.start })).not.toBeInTheDocument();
  });
});

describe('mock test page, problems', () => {
  it('shows the not-found panel for a draft or unknown test', async () => {
    renderTest([{ ok: false, error: 'notFound' }]);
    expect(await screen.findByText(NOT_FOUND_PANEL.heading)).toBeInTheDocument();
  });

  it('shows the plain error for any other failure', async () => {
    renderTest([{ ok: false, error: 'notAllowed' }]);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(PORTAL_ERRORS.notAllowed),
    );
  });

  it('exports its own ErrorBoundary (AC 39)', () => {
    expect(mockTestRoute.ErrorBoundary).toBeTypeOf('function');
  });
});
