import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LOAD_ERROR, PORTAL_ERRORS } from '@/constants';

import AdminMockTestPage from './admin-mock-test';
import AdminMockTestsPage from './admin-mock-tests';
import MockTestPage from './mock-test';
import MockTestsPage from './mock-tests';

// AC 39: a failed load on each of the four mock test pages shows plain text and a Try again.
const PAGES: [string, string, ComponentType][] = [
  ['admin list', '/portal/admin/mock-tests', AdminMockTestsPage],
  ['admin edit', '/portal/admin/mock-tests/t1', AdminMockTestPage],
  ['taker list', '/portal/student/mock-tests', MockTestsPage],
  ['taker test', '/portal/student/mock-tests/t1', MockTestPage],
];

describe('mock test pages when the load fails (AC 39)', () => {
  it.each(PAGES)('the %s page shows the plain message and Try again', async (_name, path, Page) => {
    const Stub = createRoutesStub([
      { path, Component: Page, loader: () => ({ ok: false, error: 'serverProblem' }) },
    ]);
    render(<Stub initialEntries={[path]} />);

    expect(await screen.findByText(PORTAL_ERRORS.serverProblem)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: LOAD_ERROR.tryAgain })).toBeInTheDocument();
  });
});
