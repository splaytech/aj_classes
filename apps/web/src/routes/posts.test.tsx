import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSTS_PUBLIC_PAGE, ROUTES, SECTION_IDS, sectionLink } from '@/constants';
import { usePublicPosts } from '@/lib/use-public-posts';
import type { PublicPostsState } from '@/lib/use-public-posts';
import type { Post } from '@/services';
import { renderAt } from '@/test/render';

import PostsPage, { ErrorBoundary } from './posts';

vi.mock('@/lib/use-public-posts', () => ({ usePublicPosts: vi.fn() }));
vi.mock('@/lib/use-has-news', () => ({ useHasNews: () => false }));

const POST: Post = {
  id: 'p1',
  publishedAt: '2026-10-20T01:00:00Z',
  updatedAt: '2026-10-20T01:00:00Z',
  title: 'Term 4 starts',
  body: 'Classes resume on Monday.',
  authorId: null,
};

function renderInState(state: PublicPostsState) {
  vi.mocked(usePublicPosts).mockReturnValue(state);
  return renderAt(<PostsPage />, ROUTES.posts);
}

const ALL_STATES: [string, PublicPostsState][] = [
  ['loading', { status: 'loading' }],
  ['with posts', { status: 'ready', posts: [POST] }],
  ['empty', { status: 'ready', posts: [] }],
  ['error', { status: 'error' }],
];

function expectWayOn() {
  expect(screen.getByRole('link', { name: POSTS_PUBLIC_PAGE.emptyLinks.home })).toHaveAttribute(
    'href',
    ROUTES.home,
  );
  expect(
    screen.getByRole('link', { name: POSTS_PUBLIC_PAGE.emptyLinks.registerInterest }),
  ).toHaveAttribute('href', sectionLink(SECTION_IDS.contact));
}

beforeEach(() => {
  vi.mocked(usePublicPosts).mockReset();
});

describe('/posts page', () => {
  it.each(ALL_STATES)('has exactly one h1 when %s (AC-1.3)', (_name, state) => {
    renderInState(state);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(POSTS_PUBLIC_PAGE.heading);
  });

  it('shows a loading line until the posts arrive', () => {
    renderInState({ status: 'loading' });
    expect(screen.getByText(POSTS_PUBLIC_PAGE.loading)).toBeInTheDocument();
  });

  it('lists the posts, newest first as given', () => {
    renderInState({
      status: 'ready',
      posts: [POST, { ...POST, id: 'p2', title: 'Older news', body: 'Last week.' }],
    });
    const titles = screen.getAllByRole('heading', { level: 2 }).map((item) => item.textContent);
    expect(titles.slice(0, 2)).toEqual(['Term 4 starts', 'Older news']);
    expect(screen.getByText(POST.body)).toBeInTheDocument();
  });

  it('with no posts shows the empty line and two ways on, not the error (AC-1.6)', () => {
    renderInState({ status: 'ready', posts: [] });
    expect(screen.getByText(POSTS_PUBLIC_PAGE.empty)).toBeInTheDocument();
    expect(screen.queryByText(POSTS_PUBLIC_PAGE.error)).not.toBeInTheDocument();
    expectWayOn();
  });

  it('on a failed load shows the error line, not the empty line (AC-1.7)', () => {
    renderInState({ status: 'error' });
    expect(screen.getByText(POSTS_PUBLIC_PAGE.error)).toBeInTheDocument();
    expect(screen.queryByText(POSTS_PUBLIC_PAGE.empty)).not.toBeInTheDocument();
    expectWayOn();
  });

  it('shows a post containing a script tag as plain text (AC-1.14)', () => {
    const attack = '<script>alert(1)</script>';
    const { container } = renderInState({
      status: 'ready',
      posts: [{ ...POST, title: attack, body: attack }],
    });
    expect(screen.getByRole('heading', { level: 2, name: attack })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('never says "coming soon" or "check back" (AC-1.6, R1 F2.1)', () => {
    const wording = JSON.stringify(POSTS_PUBLIC_PAGE);
    expect(wording).not.toMatch(/coming soon|check back/i);
  });
});

describe('/posts error boundary', () => {
  it('keeps the site frame and offers a way home', () => {
    renderAt(<ErrorBoundary />, ROUTES.posts);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      POSTS_PUBLIC_PAGE.errorBoundary.heading,
    );
    expect(
      screen.getByRole('link', { name: POSTS_PUBLIC_PAGE.errorBoundary.backHome }),
    ).toHaveAttribute('href', ROUTES.home);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // the footer
  });
});
