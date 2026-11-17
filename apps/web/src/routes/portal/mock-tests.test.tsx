import { render, screen, within } from '@testing-library/react';
import { createRoutesStub, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  MOCK_CLOSING,
  MOCK_TAGS,
  MOCK_TEST_FILTERS,
  MOCK_TAKE_STATUS_LABELS,
  MOCK_TESTS_LIST,
  mockTestPath,
  mockTestsPath,
} from '@/constants';
import type { MockTakerArea } from '@/constants';
import { listMyMockTests } from '@/services';
import type { MockTestListItem } from '@/services';
import { setupUser } from '@/test/user';

import MockTestsPage, * as mockTestsRoute from './mock-tests';

vi.mock('@/services', () => ({ listMyMockTests: vi.fn() }));

const ITEMS: MockTestListItem[] = [
  {
    id: 't1',
    title: 'Year 7 Maths',
    questionCount: 10,
    status: 'not_started',
    score: null,
    total: null,
    submittedAt: null,
    closesAt: null,
    tags: { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true },
  },
  {
    id: 't2',
    title: 'Reading',
    questionCount: 1,
    status: 'in_progress',
    score: null,
    total: null,
    submittedAt: null,
    closesAt: null,
    tags: { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true },
  },
  {
    id: 't3',
    title: 'Science',
    questionCount: 5,
    status: 'submitted',
    score: 4,
    total: 5,
    submittedAt: '2026-11-18T01:00:00Z',
    closesAt: null,
    tags: { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true },
  },
];

// Shows the query string, so a test can check the filters write none (AC 24).
function Page() {
  const { search } = useLocation();
  return (
    <>
      <MockTestsPage />
      <output aria-label="search">{search}</output>
    </>
  );
}

function renderList(area: MockTakerArea, items: MockTestListItem[]) {
  const path = mockTestsPath(area);
  const Stub = createRoutesStub([
    { path, Component: Page, loader: () => ({ ok: true, data: items }) },
  ]);
  return render(<Stub initialEntries={[path]} />);
}

const TAGGED: MockTestListItem[] = [
  {
    ...(ITEMS[0] as MockTestListItem),
    id: 'a',
    title: 'NAPLAN Maths',
    tags: { subject: 'maths', stream: 'naplan', yearLevels: [5], anyYear: false },
  },
  {
    ...(ITEMS[0] as MockTestListItem),
    id: 'b',
    title: 'VCE English',
    tags: { subject: 'english', stream: 'vce', yearLevels: [11, 12], anyYear: false },
  },
  {
    ...(ITEMS[0] as MockTestListItem),
    id: 'c',
    title: 'Old untagged',
    tags: { subject: null, stream: null, yearLevels: [], anyYear: false },
  },
];

const titles = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

async function choose(user: ReturnType<typeof setupUser>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

describe('mock tests list for takers', () => {
  it('shows each mock test with its status, count, score and action', async () => {
    renderList('student', ITEMS);
    await screen.findByRole('heading', { level: 1, name: MOCK_TESTS_LIST.heading });

    const cards = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(cards).toEqual(['Year 7 Maths', 'Reading', 'Science']);
    expect(screen.getByText(MOCK_TESTS_LIST.questions(10))).toBeInTheDocument();
    expect(screen.getByText(MOCK_TESTS_LIST.questions(1))).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAKE_STATUS_LABELS.not_started)).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAKE_STATUS_LABELS.in_progress)).toBeInTheDocument();
    expect(screen.getByText('4 of 5 correct')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: MOCK_TESTS_LIST.actions.not_started })).toBeVisible();
    expect(screen.getByRole('link', { name: MOCK_TESTS_LIST.actions.in_progress })).toBeVisible();
    expect(screen.getByRole('link', { name: MOCK_TESTS_LIST.actions.submitted })).toBeVisible();
  });

  it.each<MockTakerArea>(['student', 'parent', 'user'])('links into the %s area', async (area) => {
    renderList(area, ITEMS);
    const link = await screen.findByRole('link', { name: MOCK_TESTS_LIST.actions.not_started });
    expect(link).toHaveAttribute('href', mockTestPath(area, 't1'));
  });

  it('shows a score only for the submitted mock test', async () => {
    renderList('parent', ITEMS);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/of \d+ correct/)).toHaveLength(1);
  });

  it('marks a closed test the person submitted as Closed, and still offers the result (ruling S-1)', async () => {
    const closed = { ...(ITEMS[2] as MockTestListItem), closesAt: '2020-01-01T00:00:00Z' };
    const closesLater = { ...(ITEMS[0] as MockTestListItem), closesAt: '2999-01-01T00:00:00Z' };
    renderList('user', [closesLater, closed]);
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getAllByText(MOCK_CLOSING.closedChip)).toHaveLength(1);
    expect(screen.getByRole('link', { name: MOCK_TESTS_LIST.actions.submitted })).toBeVisible();
    expect(screen.getByText('4 of 5 correct')).toBeInTheDocument();
  });

  it('shows the empty state, with no filters (AC 22a)', async () => {
    renderList('user', []);
    expect(await screen.findByText(MOCK_TESTS_LIST.empty)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: MOCK_TEST_FILTERS.groupLabel })).toBeNull();
    expect(screen.queryByText(MOCK_TEST_FILTERS.noMatch)).toBeNull();
  });

  it('shows every test, untagged too, with all filters on All, and each row’s tags (AC 21, 23)', async () => {
    renderList('student', TAGGED);
    await screen.findByRole('heading', { level: 1 });
    expect(titles()).toEqual(['NAPLAN Maths', 'VCE English', 'Old untagged']);
    expect(
      screen.getByText(MOCK_TAGS.line(MOCK_TAGS.yearLevelLabel, 'Years 11, 12')),
    ).toBeVisible();
    expect(screen.getAllByText(new RegExp(`: ${MOCK_TAGS.notSet}$`))).toHaveLength(3);
  });

  it('narrows by each filter, AND across them, leaving untagged tests out (AC 18, 20)', async () => {
    const user = setupUser();
    renderList('parent', TAGGED);
    await screen.findByRole('heading', { level: 1 });

    await choose(user, MOCK_TAGS.streamLabel, 'NAPLAN');
    expect(titles()).toEqual(['NAPLAN Maths']);
    await choose(user, MOCK_TAGS.streamLabel, MOCK_TEST_FILTERS.all);
    await choose(user, MOCK_TAGS.yearLevelLabel, 'Year 12');
    expect(titles()).toEqual(['VCE English']);
    await choose(user, MOCK_TAGS.subjectLabel, 'Maths');
    expect(titles()).toEqual([]);
  });

  it('says when filters match nothing, and Clear filters restores the list (AC 22b)', async () => {
    const user = setupUser();
    renderList('user', TAGGED);
    await screen.findByRole('heading', { level: 1 });

    await choose(user, MOCK_TAGS.subjectLabel, 'Science');
    expect(screen.getByText(MOCK_TEST_FILTERS.noMatch)).toBeVisible();
    expect(screen.queryByText(MOCK_TESTS_LIST.empty)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: MOCK_TEST_FILTERS.clear }));

    expect(titles()).toEqual(['NAPLAN Maths', 'VCE English', 'Old untagged']);
    expect(screen.queryByText(MOCK_TEST_FILTERS.noMatch)).toBeNull();
    // The Clear button is gone, so focus moves to the heading, not the page body (review-5 #3).
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: MOCK_TESTS_LIST.heading }),
    );
    expect(screen.getByRole('combobox', { name: MOCK_TAGS.subjectLabel })).toHaveTextContent(
      MOCK_TEST_FILTERS.all,
    );
  });

  it('keeps filters in the page only: no query string, no new request, reset on a remount (AC 24, 25)', async () => {
    const user = setupUser();
    const { unmount } = renderList('student', TAGGED);
    await screen.findByRole('heading', { level: 1 });

    await choose(user, MOCK_TAGS.streamLabel, 'VCE Tutoring');
    expect(titles()).toEqual(['VCE English']);
    expect(screen.getByLabelText('search')).toHaveTextContent('');
    expect(listMyMockTests).not.toHaveBeenCalled();

    unmount();
    renderList('student', TAGGED);
    await screen.findByRole('heading', { level: 1 });
    expect(titles()).toEqual(['NAPLAN Maths', 'VCE English', 'Old untagged']);
  });

  it('does not mention price or upgrades (AC 9)', async () => {
    renderList('student', ITEMS);
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/\$|price|upgrade|subscribe/i);
  });

  it('exports its own ErrorBoundary (AC 39)', () => {
    expect(mockTestsRoute.ErrorBoundary).toBeTypeOf('function');
  });
});
