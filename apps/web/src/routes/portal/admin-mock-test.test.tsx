import { render, screen, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_QUESTION_LIST,
  MOCK_TEST_EDIT_PAGE,
  MOCK_TEST_LIMITS,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
} from '@/constants';
import { releaseMockTest, withdrawMockTest } from '@/services';
import type { MockAdminQuestion, MockTestDraftView } from '@/services';
import { setupUser } from '@/test/user';

import AdminMockTestPage, * as adminMockTestRoute from './admin-mock-test';

vi.mock('@/services', () => ({
  deleteMockQuestion: vi.fn(),
  deleteMockTest: vi.fn(),
  moveMockQuestion: vi.fn(),
  releaseMockTest: vi.fn(),
  saveMockQuestion: vi.fn(),
  updateMockTest: vi.fn(),
  withdrawMockTest: vi.fn(),
}));

function question(id: string, position: number): MockAdminQuestion {
  return {
    id,
    position,
    prompt: `Prompt ${id}`,
    options: ['Yes', 'No'],
    correctOption: 1,
    explanation: id === 'q1' ? 'Because.' : '',
  };
}

function testView(overrides: Partial<MockTestDraftView> = {}): MockTestDraftView {
  return {
    id: 't1',
    title: 'Year 7 Maths',
    instructions: 'Read carefully.',
    status: 'draft',
    questions: [question('q1', 1), question('q2', 3)],
    ...overrides,
  };
}

async function renderPage(view: MockTestDraftView) {
  const Stub = createRoutesStub([
    {
      path: '/portal/admin/mock-tests/:testId',
      Component: AdminMockTestPage,
      loader: () => ({ ok: true, data: view }),
    },
    { path: PORTAL_ROUTES.adminMockTests, Component: () => <p>list page</p> },
  ]);
  render(<Stub initialEntries={['/portal/admin/mock-tests/t1']} />);
  await screen.findByRole('heading', { level: 1, name: view.title });
}

beforeEach(() => {
  vi.mocked(releaseMockTest).mockReset();
  vi.mocked(withdrawMockTest).mockReset();
});

describe('admin mock test, a draft', () => {
  it('numbers questions by order, not by the stored position', async () => {
    await renderPage(testView()); // stored positions are 1 and 3: question 2 was deleted

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      MOCK_QUESTION_LIST.number(1),
      MOCK_QUESTION_LIST.number(2),
    ]);
    expect(screen.queryByText(MOCK_QUESTION_LIST.number(3))).not.toBeInTheDocument();
  });

  it('shows the correct option and the explanation, and every edit control', async () => {
    await renderPage(testView());

    expect(screen.getAllByText(MOCK_QUESTION_LIST.correct)).toHaveLength(2);
    expect(screen.getByText(MOCK_QUESTION_LIST.explanation('Because.'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_QUESTION_LIST.add })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: MOCK_QUESTION_LIST.edit })).toHaveLength(2);
    expect(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.editDetails })).toBeVisible();
    expect(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.deleteDraft })).toBeVisible();
    expect(screen.getByRole('button', { name: MOCK_QUESTION_LIST.moveUp(1) })).toBeDisabled();
    expect(screen.getByRole('button', { name: MOCK_QUESTION_LIST.moveDown(1) })).toBeEnabled();
  });

  it('disables Release, with a hint, when there are no questions', async () => {
    await renderPage(testView({ questions: [] }));

    expect(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release })).toBeDisabled();
    expect(screen.getByText(MOCK_TEST_EDIT_PAGE.releaseNeedsQuestions)).toBeInTheDocument();
  });

  it('disables Add question at the 100 question cap', async () => {
    const questions = Array.from({ length: MOCK_TEST_LIMITS.questionsMax }, (_, index) =>
      question(`q${index}`, index + 1),
    );
    await renderPage(testView({ questions }));

    expect(screen.getByRole('button', { name: MOCK_QUESTION_LIST.add })).toBeDisabled();
    expect(screen.getByText(MOCK_QUESTION_LIST.limitReached)).toBeInTheDocument();
    expect(screen.getByText(MOCK_QUESTION_LIST.count(100))).toBeInTheDocument();
  });

  it('confirms before releasing, saying who can take it free of cost', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(testView());

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));
    const dialog = await screen.findByRole('dialog', {
      name: MOCK_TEST_EDIT_PAGE.confirmReleaseTitle,
    });
    expect(dialog).toHaveTextContent(MOCK_TEST_EDIT_PAGE.confirmReleaseText);
    expect(releaseMockTest).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));
    expect(releaseMockTest).toHaveBeenCalledWith('t1');
  });

  it('shows the plain reason when the release is refused', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: false, error: 'mockNoQuestions' });
    const user = setupUser();
    await renderPage(testView());

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(PORTAL_ERRORS.mockNoQuestions)).toBeInTheDocument();
  });
});

describe('admin mock test, released', () => {
  const released = () => testView({ status: 'released' });

  it('renders no edit controls (AC 19)', async () => {
    await renderPage(released());

    for (const name of [
      MOCK_QUESTION_LIST.add,
      MOCK_QUESTION_LIST.edit,
      MOCK_QUESTION_LIST.delete,
      MOCK_TEST_EDIT_PAGE.editDetails,
      MOCK_TEST_EDIT_PAGE.release,
      MOCK_TEST_EDIT_PAGE.deleteDraft,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: MOCK_QUESTION_LIST.moveUp(1) })).toBeNull();
    expect(screen.getByText(MOCK_QUESTION_LIST.lockedNote)).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_QUESTION_LIST.correct)).toHaveLength(2);
  });

  it('shows the refusal when someone has already started (AC 21)', async () => {
    vi.mocked(withdrawMockTest).mockResolvedValue({ ok: false, error: 'mockHasAttempts' });
    const user = setupUser();
    await renderPage(released());

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.takeBack }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TEST_EDIT_PAGE.takeBack }));

    expect(await screen.findByText(PORTAL_ERRORS.mockHasAttempts)).toBeInTheDocument();
    expect(withdrawMockTest).toHaveBeenCalledWith('t1');
  });
});

describe('admin mock test route', () => {
  it('exports its own ErrorBoundary (AC 39)', () => {
    expect(adminMockTestRoute.ErrorBoundary).toBeTypeOf('function');
  });
});
