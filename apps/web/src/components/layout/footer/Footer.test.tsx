import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FOOTER, ROUTES } from '@/constants';
import { useHasNews } from '@/lib/use-has-news';
import { renderAt } from '@/test/render';

import { Footer } from './Footer';

vi.mock('@/lib/use-has-news', () => ({ useHasNews: vi.fn(() => false) }));

beforeEach(() => {
  vi.mocked(useHasNews).mockReturnValue(false);
});

describe('footer News link (ADR-0001)', () => {
  it('links to /posts when there is news (AC-1.9)', () => {
    vi.mocked(useHasNews).mockReturnValue(true);
    renderAt(<Footer />);
    expect(screen.getByRole('link', { name: FOOTER.newsLink })).toHaveAttribute(
      'href',
      ROUTES.posts,
    );
  });

  it('is not shown when there is no news, or the check failed (AC-1.6, AC-1.9)', () => {
    renderAt(<Footer />);
    expect(screen.queryByRole('link', { name: FOOTER.newsLink })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: FOOTER.privacyLink })).toBeInTheDocument();
  });
});
