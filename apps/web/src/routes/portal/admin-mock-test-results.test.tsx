import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  LOAD_ERROR,
  MOCK_RESULTS_PAGE,
  MOCK_SCORING,
  PORTAL_ERRORS,
  adminMockTestPath,
} from '@/constants';
import type { MockResultRow, MockTestResultsView } from '@/services';

import AdminMockTestResultsPage, * as resultsRoute from './admin-mock-test-results';

vi.mock('@/services', () => ({ getMockTestResults: vi.fn() }));

const PATH = '/portal/admin/mock-tests/t1/results';

function resultRow(attemptId: string): MockResultRow {
  return {
    attemptId,
    takerName: `Taker ${attemptId}`,
    submittedAt: '2026-11-18T01:00:00Z',
    score: 3,
    total: 5,
    percentage: 60,
    passed: true,
  };
}

function view(overrides: Partial<MockTestResultsView> = {}): MockTestResultsView {
  return {
    testId: 't1',
    title: 'Year 7 Maths',
    status: 'released',
    closesAt: null,
    passMark: null,
    rows: [resultRow('a1')],
    totalRows: 1,
    ...overrides,
  };
}

function renderPage(loaded: unknown) {
  const Stub = createRoutesStub([
    { path: PATH, Component: AdminMockTestResultsPage, loader: () => loaded },
  ]);
  render(<Stub initialEntries={[PATH]} />);
}

describe('admin Results page', () => {
  it('shows the title, intro, back link and the table', async () => {
    renderPage({ ok: true, data: view() });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: MOCK_RESULTS_PAGE.title('Year 7 Maths'),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(MOCK_RESULTS_PAGE.intro)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: MOCK_RESULTS_PAGE.back })).toHaveAttribute(
      'href',
      adminMockTestPath('t1'),
    );
    expect(screen.getByRole('table', { name: MOCK_RESULTS_PAGE.tableLabel })).toBeInTheDocument();
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });

  it('shows the pass mark line only when one is set, and Closed only when closed', async () => {
    renderPage({ ok: true, data: view({ passMark: 60, closesAt: '2020-01-01T00:00:00Z' }) });
    expect(await screen.findByText(MOCK_SCORING.passMarkLine(60))).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows neither the pass mark nor Closed for an open test with no pass mark', async () => {
    renderPage({ ok: true, data: view() });
    await screen.findByRole('table');
    expect(screen.queryByText(/Pass mark/)).toBeNull();
    expect(screen.queryByText('Closed')).toBeNull();
  });

  it('shows the plain empty text and no table when nobody has submitted', async () => {
    renderPage({ ok: true, data: view({ rows: [], totalRows: 0 }) });
    expect(await screen.findByText('No one has submitted this test yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says how many are shown when the 1000-row limit cut the list short', async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => resultRow(`a${index}`));
    renderPage({ ok: true, data: view({ rows, totalRows: 1500 }) });
    expect(
      await screen.findByText('Showing 1000 of 1500 submissions. The oldest are not listed.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1001);
  });

  it('shows no note when all rows are listed', async () => {
    renderPage({
      ok: true,
      data: view({ rows: [resultRow('a1'), resultRow('a2')], totalRows: 2 }),
    });
    await screen.findByRole('table');
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });

  it('shows the not-found panel for a missing test', async () => {
    renderPage({ ok: false, error: 'notFound' });
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: LOAD_ERROR.tryAgain })).toBeNull();
  });

  it('shows the plain message and Try again for another failure', async () => {
    renderPage({ ok: false, error: 'serverProblem' });
    expect(await screen.findByText(PORTAL_ERRORS.serverProblem)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: LOAD_ERROR.tryAgain })).toBeInTheDocument();
  });

  it('exports its own ErrorBoundary (AC 46)', () => {
    expect(resultsRoute.ErrorBoundary).toBeTypeOf('function');
  });

  it('is registered inside the admin layout', async () => {
    type RouteNode = { file: string; path?: string; children?: RouteNode[] };
    const routes = (await import('../../routes')).default as RouteNode[];
    const find = (nodes: RouteNode[], file: string): RouteNode | undefined =>
      nodes.find((node) => node.file === file) ??
      nodes.flatMap((node) => (node.children ? [find(node.children, file)] : [])).find(Boolean);
    const admin = find(routes, 'routes/portal/admin-layout.tsx');
    expect(
      admin?.children?.some((node) => node.file === 'routes/portal/admin-mock-test-results.tsx'),
    ).toBe(true);
  });
});
