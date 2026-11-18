import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LOAD_ERROR, PORTAL_ERRORS } from '@/constants';

import { LoadError } from './Panels';

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

describe('LoadError', () => {
  it('shows only the message by default, so other pages are unchanged', () => {
    render(<LoadError error="network" />);
    expect(screen.getByRole('alert')).toHaveTextContent(PORTAL_ERRORS.network);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('with retry, Try again reloads the route', () => {
    render(<LoadError error="network" retry />);
    fireEvent.click(screen.getByRole('button', { name: LOAD_ERROR.tryAgain }));
    expect(navigate).toHaveBeenCalledWith(0);
  });
});
