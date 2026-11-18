import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MOCK_TESTS_ERROR_BOUNDARY, PORTAL_ERRORS } from '@/constants';

import { MockTestsErrorBoundary } from './MockTestsErrorBoundary';

function renderFailingRoute(error: Error) {
  const Stub = createRoutesStub([
    {
      path: '/',
      loader: () => {
        throw error;
      },
      Component: () => null,
      ErrorBoundary: MockTestsErrorBoundary,
    },
  ]);
  render(<Stub />);
}

describe('MockTestsErrorBoundary (AC 39)', () => {
  it('shows plain words and Try again, never the raw error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderFailingRoute(new Error('relation mock_tests does not exist'));

    expect(
      await screen.findByRole('heading', { level: 1, name: MOCK_TESTS_ERROR_BOUNDARY.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(MOCK_TESTS_ERROR_BOUNDARY.text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_TESTS_ERROR_BOUNDARY.tryAgain })).toBeVisible();
    expect(screen.queryByText(/mock_tests does not exist/)).not.toBeInTheDocument();
  });

  it('blames the connection only when that is the cause', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderFailingRoute(new TypeError('Failed to fetch'));

    expect(await screen.findByText(PORTAL_ERRORS.network)).toBeInTheDocument();
  });
});
