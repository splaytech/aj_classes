import { render, screen, waitFor, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_TEST_DIALOG,
  MOCK_TEST_STATUS_LABELS,
  MOCK_TESTS_ADMIN_PAGE,
  PORTAL_ROUTES,
  adminMockTestPath,
} from '@/constants';
import { createMockTest } from '@/services';
import type { MockTestSummary } from '@/services';
import { setupUser } from '@/test/user';

import AdminMockTestsPage, * as adminMockTestsRoute from './admin-mock-tests';

vi.mock('@/services', () => ({ createMockTest: vi.fn(), updateMockTest: vi.fn() }));

const DRAFT: MockTestSummary = {
  id: 't1',
  title: 'Year 7 Maths',
  status: 'draft',
  questionCount: 2,
  submittedCount: 0,
  createdByName: 'Ana Admin',
  createdAt: '2026-11-17T01:00:00Z',
  updatedAt: '2026-11-18T01:00:00Z',
  releasedAt: null,
};
const RELEASED: MockTestSummary = {
  ...DRAFT,
  id: 't2',
  title: 'Reading',
  status: 'released',
  questionCount: 10,
  submittedCount: 4,
  createdByName: null,
  releasedAt: '2026-11-18T02:00:00Z',
};

function renderPage(tests: MockTestSummary[]) {
  const Stub = createRoutesStub([
    {
      path: PORTAL_ROUTES.adminMockTests,
      Component: AdminMockTestsPage,
      loader: () => ({ ok: true, data: tests }),
    },
    { path: `${PORTAL_ROUTES.adminMockTests}/:testId`, Component: () => <p>edit page</p> },
  ]);
  render(<Stub initialEntries={[PORTAL_ROUTES.adminMockTests]} />);
}

beforeEach(() => vi.mocked(createMockTest).mockReset());

describe('admin mock tests list', () => {
  it('shows every test with status, counts, creator and a link to edit', async () => {
    renderPage([DRAFT, RELEASED]);
    await screen.findByRole('heading', { level: 1, name: MOCK_TESTS_ADMIN_PAGE.heading });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const draftRow = within(rows[0] as HTMLElement);
    expect(draftRow.getByRole('link', { name: DRAFT.title })).toHaveAttribute(
      'href',
      adminMockTestPath('t1'),
    );
    expect(draftRow.getByText(MOCK_TEST_STATUS_LABELS.draft)).toBeInTheDocument();
    expect(draftRow.getByText('Ana Admin')).toBeInTheDocument();
    const releasedRow = within(rows[1] as HTMLElement);
    expect(releasedRow.getByText(MOCK_TEST_STATUS_LABELS.released)).toBeInTheDocument();
    expect(releasedRow.getByText('4')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    renderPage([]);
    expect(await screen.findByText(MOCK_TESTS_ADMIN_PAGE.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('creates a draft and goes to its edit page', async () => {
    vi.mocked(createMockTest).mockResolvedValue({ ok: true, data: { id: 'new1' } });
    const user = setupUser();
    renderPage([]);

    await user.click(await screen.findByRole('button', { name: MOCK_TESTS_ADMIN_PAGE.newButton }));
    await user.type(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel)), 'Fractions');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.create }));

    expect(await screen.findByText('edit page')).toBeInTheDocument();
    expect(createMockTest).toHaveBeenCalledWith({ title: 'Fractions', instructions: '' });
  });

  it('refuses a one-character title inline and sends nothing', async () => {
    const user = setupUser();
    renderPage([]);

    await user.click(await screen.findByRole('button', { name: MOCK_TESTS_ADMIN_PAGE.newButton }));
    await user.type(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel)), 'a');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.create }));

    await waitFor(() => expect(createMockTest).not.toHaveBeenCalled());
    expect(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel))).toBeInvalid();
  });

  it('exports its own ErrorBoundary (AC 39)', () => {
    expect(adminMockTestsRoute.ErrorBoundary).toBeTypeOf('function');
  });
});
