import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_CLOSING,
  MOCK_QUESTION_LIST,
  MOCK_TAGS,
  MOCK_TEST_EDIT_PAGE,
  MOCK_TEST_LIMITS,
  MOCK_VALIDATION,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
} from '@/constants';
import { formatDateTime } from '@/lib/format';
import {
  closeMockTestNow,
  deleteMockQuestion,
  releaseMockTest,
  setMockTestClosing,
  updateMockTestTags,
  withdrawMockTest,
} from '@/services';
import type { MockAdminQuestion, MockTestDraftView } from '@/services';
import { setupUser } from '@/test/user';

import AdminMockTestPage, * as adminMockTestRoute from './admin-mock-test';

vi.mock('@/services', () => ({
  closeMockTestNow: vi.fn(),
  deleteMockQuestion: vi.fn(),
  deleteMockTest: vi.fn(),
  moveMockQuestion: vi.fn(),
  releaseMockTest: vi.fn(),
  saveMockQuestion: vi.fn(),
  setMockTestClosing: vi.fn(),
  updateMockTest: vi.fn(),
  updateMockTestTags: vi.fn(),
  withdrawMockTest: vi.fn(),
}));

function question(id: string, position: number): MockAdminQuestion {
  return {
    id,
    position,
    prompt: `Prompt ${id}`,
    options: ['Yes', 'No'],
    marks: 1,
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
    closesAt: null,
    passMark: null,
    tags: { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true },
    questions: [question('q1', 1), question('q2', 3)],
    ...overrides,
  };
}

/** `afterChange` is what the page loads again once an action has worked (a reload). */
async function renderPage(view: MockTestDraftView, afterChange: MockTestDraftView = view) {
  let loads = 0;
  const Stub = createRoutesStub([
    {
      path: '/portal/admin/mock-tests/:testId',
      Component: AdminMockTestPage,
      loader: () => ({ ok: true, data: loads++ === 0 ? view : afterChange }),
    },
    { path: PORTAL_ROUTES.adminMockTests, Component: () => <p>list page</p> },
  ]);
  // The closing dialogs have a date-time picker, which needs the provider the portal wraps pages in.
  render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stub initialEntries={['/portal/admin/mock-tests/t1']} />
    </LocalizationProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: view.title });
}

beforeEach(() => {
  vi.mocked(releaseMockTest).mockReset();
  vi.mocked(closeMockTestNow).mockReset();
  vi.mocked(setMockTestClosing).mockReset();
  vi.mocked(deleteMockQuestion).mockReset();
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
    // The closing field was left empty: it never closes.
    expect(releaseMockTest).toHaveBeenCalledWith('t1', null);
  });

  it('moves focus to the page heading after a confirmed release, not the page body (BUG-4)', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(testView(), testView({ status: 'released' }));

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Year 7 Maths' })).toHaveFocus(),
    );
  });

  it('moves focus to the questions heading after a confirmed question delete (BUG-4)', async () => {
    vi.mocked(deleteMockQuestion).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(testView(), testView({ questions: [question('q2', 3)] }));

    await user.click(screen.getAllByRole('button', { name: MOCK_QUESTION_LIST.delete })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_QUESTION_LIST.delete }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: MOCK_QUESTION_LIST.heading })).toHaveFocus(),
    );
    expect(deleteMockQuestion).toHaveBeenCalledWith('q1');
  });

  it('wraps long unbroken text so it cannot widen the page (BUG-5)', async () => {
    const long = 'w'.repeat(150);
    await renderPage(
      testView({
        title: long,
        instructions: long,
        questions: [
          { ...question('q1', 1), prompt: long, options: [long, 'No'], explanation: long },
        ],
      }),
    );

    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveStyle({
      overflowWrap: 'anywhere',
    });
    for (const element of screen.getAllByText(new RegExp(long))) {
      expect(element).toHaveStyle({ overflowWrap: 'anywhere' });
    }
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

  it('moves focus to the heading after a take-back, not the page body (review-5 #4)', async () => {
    vi.mocked(withdrawMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(released(), testView());

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.takeBack }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_TEST_EDIT_PAGE.takeBack }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Year 7 Maths' })).toHaveFocus(),
    );
    expect(document.activeElement).not.toBe(document.body);
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

describe('admin mock test, closing date and close now', () => {
  const FUTURE = '2999-01-01T09:00:00.000Z';
  const PAST = '2020-01-01T09:00:00.000Z';
  const released = (closesAt: string | null) => testView({ status: 'released', closesAt });

  it('shows nothing about closing, with Set closing date and Close now, when it never closes', async () => {
    await renderPage(released(null));

    expect(screen.queryByText(/^Closes |^Closed /)).not.toBeInTheDocument();
    expect(screen.queryByText(MOCK_CLOSING.closedChip)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_CLOSING.setClosing })).toBeVisible();
    expect(screen.getByRole('button', { name: MOCK_CLOSING.closeNow })).toBeVisible();
  });

  it('shows Closes <date time> for an open test with a date (AC 6, 9)', async () => {
    await renderPage(released(FUTURE));

    expect(screen.getByText(MOCK_CLOSING.closes(formatDateTime(FUTURE)))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_CLOSING.closeNow })).toBeVisible();
  });

  it('shows Closed <date time> and a Closed chip, and no Close now, once closed', async () => {
    await renderPage(released(PAST));

    expect(screen.getByText(MOCK_CLOSING.closed(formatDateTime(PAST)))).toBeInTheDocument();
    expect(screen.getByText(MOCK_CLOSING.closedChip)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: MOCK_CLOSING.closeNow })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_CLOSING.setClosing })).toBeVisible();
  });

  it('shows no closing state on a draft', async () => {
    await renderPage(testView());
    expect(screen.queryByRole('button', { name: MOCK_CLOSING.setClosing })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: MOCK_CLOSING.closeNow })).not.toBeInTheDocument();
  });

  it('confirms Close now, closes, and moves focus to the heading (BUG-4)', async () => {
    vi.mocked(closeMockTestNow).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(released(null), released(PAST));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.closeNow }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_CLOSING.confirmCloseNowTitle });
    expect(dialog).toHaveTextContent(MOCK_CLOSING.confirmCloseNowText);
    expect(closeMockTestNow).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.closeNow }));

    expect(closeMockTestNow).toHaveBeenCalledWith('t1');
    expect(await screen.findByText(MOCK_CLOSING.closedNow)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Year 7 Maths' })).toHaveFocus(),
    );
  });

  it('shows the plain reason when Close now is refused', async () => {
    vi.mocked(closeMockTestNow).mockResolvedValue({ ok: false, error: 'invalidStatus' });
    const user = setupUser();
    await renderPage(released(null));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.closeNow }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.closeNow }));

    expect(await screen.findByText(PORTAL_ERRORS.invalidStatus)).toBeInTheDocument();
  });

  it('keeps a future date on Save (AC 2)', async () => {
    vi.mocked(setMockTestClosing).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(released(FUTURE));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.setClosing }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_CLOSING.setClosingTitle });
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.save }));

    expect(setMockTestClosing).toHaveBeenCalledWith('t1', FUTURE);
    expect(await screen.findByText(MOCK_CLOSING.saved)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clears the date with Clear, which reopens a closed test (AC 4)', async () => {
    vi.mocked(setMockTestClosing).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    await renderPage(released(PAST), released(null));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.setClosing }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_CLOSING.setClosingTitle });
    const clear = within(dialog).getByRole('button', { name: MOCK_CLOSING.clear });
    await user.click(clear);
    expect(clear).toHaveFocus(); // still on the page after clearing (BUG-4)
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.save }));

    expect(setMockTestClosing).toHaveBeenCalledWith('t1', null);
    expect(await screen.findByText(MOCK_CLOSING.cleared)).toBeInTheDocument();
  });

  it('refuses a past date inline and sends nothing', async () => {
    const user = setupUser();
    await renderPage(released(PAST));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.setClosing }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_CLOSING.setClosingTitle });
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.save }));

    expect(await within(dialog).findByText(MOCK_VALIDATION.closesInPast)).toBeInTheDocument();
    expect(setMockTestClosing).not.toHaveBeenCalled();
  });

  it('shows the database refusal inside the dialog', async () => {
    vi.mocked(setMockTestClosing).mockResolvedValue({ ok: false, error: 'mockClosesInPast' });
    const user = setupUser();
    await renderPage(released(FUTURE));

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.setClosing }));
    const dialog = await screen.findByRole('dialog', { name: MOCK_CLOSING.setClosingTitle });
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.save }));

    expect(await within(dialog).findByText(PORTAL_ERRORS.mockClosesInPast)).toBeInTheDocument();
  });

  it('offers an optional Closes field when releasing', async () => {
    const user = setupUser();
    await renderPage(testView());

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));
    const dialog = await screen.findByRole('dialog', {
      name: MOCK_TEST_EDIT_PAGE.confirmReleaseTitle,
    });
    expect(within(dialog).getByText(MOCK_CLOSING.fieldHint)).toBeInTheDocument();
    expect(within(dialog).getAllByText(MOCK_CLOSING.fieldLabel).length).toBeGreaterThan(0);
  });
});

describe('admin mock test, tags (categories)', () => {
  const NO_TAGS = { subject: null, stream: null, yearLevels: [], anyYear: false };

  it('shows the tags in their own card (AC 28)', async () => {
    await renderPage(testView());
    expect(screen.getByRole('heading', { name: MOCK_TAGS.tagsHeading })).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAGS.line(MOCK_TAGS.subjectLabel, 'Maths'))).toBeInTheDocument();
  });

  it('on a draft names the missing tags and keeps Release enabled (AC 14, [ASSUMPTION] 7b.1)', async () => {
    await renderPage(testView({ tags: { ...NO_TAGS, stream: 'icas' } }));
    expect(
      screen.getByText(MOCK_TAGS.releaseNeedsTags('subject and year level')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release })).toBeEnabled();
    expect(screen.queryByRole('button', { name: MOCK_TAGS.editTags })).not.toBeInTheDocument();
  });

  it('says nothing about tags on a fully tagged draft', async () => {
    await renderPage(testView());
    expect(screen.queryByText(/^Set the /)).not.toBeInTheDocument();
  });

  it('edits the tags of a released test and says so; focus goes back to Edit tags', async () => {
    vi.mocked(updateMockTestTags).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    const released = testView({ status: 'released' });
    await renderPage(released, { ...released, tags: { ...released.tags, subject: 'english' } });

    const editTags = screen.getByRole('button', { name: MOCK_TAGS.editTags });
    await user.click(editTags);
    const dialog = await screen.findByRole('dialog', { name: MOCK_TAGS.editTagsTitle });
    await user.click(within(dialog).getByRole('combobox', { name: MOCK_TAGS.subjectLabel }));
    await user.click(screen.getByRole('option', { name: 'English' }));
    await user.click(within(dialog).getByRole('button', { name: MOCK_CLOSING.save }));

    expect(updateMockTestTags).toHaveBeenCalledWith('t1', {
      subject: 'english',
      stream: 'naplan',
      yearLevels: [],
      anyYear: true,
    });
    expect(await screen.findByText(MOCK_TAGS.tagsSaved)).toBeInTheDocument();
    expect(
      await screen.findByText(MOCK_TAGS.line(MOCK_TAGS.subjectLabel, 'English')),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: MOCK_TAGS.editTags })).toHaveFocus(),
    );
  });
});

describe('admin mock test, status note (TSR BUG-3)', () => {
  it.each([
    ['a draft', testView(), MOCK_TEST_EDIT_PAGE.draftNote],
    ['an open released test', testView({ status: 'released' }), MOCK_TEST_EDIT_PAGE.releasedNote],
    [
      'an open released test with a future date',
      testView({ status: 'released', closesAt: '2999-01-01T09:00:00.000Z' }),
      MOCK_TEST_EDIT_PAGE.releasedNote,
    ],
    [
      'a closed test',
      testView({ status: 'released', closesAt: '2020-01-01T09:00:00.000Z' }),
      MOCK_TEST_EDIT_PAGE.closedNote,
    ],
  ])('shows the right note for %s', async (_name, view, note) => {
    await renderPage(view);
    expect(screen.getByText(note)).toBeInTheDocument();
    for (const other of [
      MOCK_TEST_EDIT_PAGE.draftNote,
      MOCK_TEST_EDIT_PAGE.releasedNote,
      MOCK_TEST_EDIT_PAGE.closedNote,
    ].filter((text) => text !== note)) {
      expect(screen.queryByText(other)).not.toBeInTheDocument();
    }
  });
});

describe('admin mock test route', () => {
  it('exports its own ErrorBoundary (AC 39)', () => {
    expect(adminMockTestRoute.ErrorBoundary).toBeTypeOf('function');
  });
});
