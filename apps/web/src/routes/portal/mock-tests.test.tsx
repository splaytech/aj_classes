import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  MOCK_CLOSING,
  MOCK_TAKE_STATUS_LABELS,
  MOCK_TESTS_LIST,
  mockTestPath,
  mockTestsPath,
} from '@/constants';
import type { MockTakerArea } from '@/constants';
import type { MockTestListItem } from '@/services';

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

function renderList(area: MockTakerArea, items: MockTestListItem[]) {
  const path = mockTestsPath(area);
  const Stub = createRoutesStub([
    { path, Component: MockTestsPage, loader: () => ({ ok: true, data: items }) },
  ]);
  render(<Stub initialEntries={[path]} />);
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

  it('shows the empty state', async () => {
    renderList('user', []);
    expect(await screen.findByText(MOCK_TESTS_LIST.empty)).toBeInTheDocument();
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
