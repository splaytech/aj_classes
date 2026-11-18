import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_TESTS_LINK_CARD, PORTAL_ROUTES, POSTS_PUBLIC_PAGE } from '@/constants';
import { usePublicPosts } from '@/lib/use-public-posts';
import { renderAt } from '@/test/render';

import UserHome from './user-home';

vi.mock('@/lib/use-public-posts', () => ({ usePublicPosts: vi.fn() }));

beforeEach(() => vi.mocked(usePublicPosts).mockReset());

describe('/portal/user, a signed-up user’s home (AC-21)', () => {
  it('is headed Latest news, with the intro, and lists the posts', () => {
    vi.mocked(usePublicPosts).mockReturnValue({
      status: 'ready',
      posts: [{ id: 'p1', publishedAt: '2026-11-01T01:00:00Z', title: 'Term 4', body: 'Hello.' }],
    });
    renderAt(<UserHome />, PORTAL_ROUTES.user);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(POSTS_PUBLIC_PAGE.heading);
    expect(screen.getByText(POSTS_PUBLIC_PAGE.intro)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Term 4' })).toBeInTheDocument();
  });

  it('links to the user mock tests (mock tests AC 8)', () => {
    vi.mocked(usePublicPosts).mockReturnValue({ status: 'ready', posts: [] });
    renderAt(<UserHome />, PORTAL_ROUTES.user);

    expect(screen.getByRole('link', { name: MOCK_TESTS_LINK_CARD.link })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.userMockTests,
    );
  });

  it('shows the same empty and error lines as /posts', () => {
    vi.mocked(usePublicPosts).mockReturnValue({ status: 'ready', posts: [] });
    const { unmount } = renderAt(<UserHome />, PORTAL_ROUTES.user);
    expect(screen.getByText(POSTS_PUBLIC_PAGE.empty)).toBeInTheDocument();
    unmount();

    vi.mocked(usePublicPosts).mockReturnValue({ status: 'error' });
    renderAt(<UserHome />, PORTAL_ROUTES.user);
    expect(screen.getByText(POSTS_PUBLIC_PAGE.error)).toBeInTheDocument();
  });
});
