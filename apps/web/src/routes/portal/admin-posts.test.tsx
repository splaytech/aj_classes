import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST_LIMITS, POSTS_PAGE } from '@/constants';
import { createPost, updatePost } from '@/services';
import type { Post } from '@/services';

import AdminPostsPage from './admin-posts';

vi.mock('@/services', () => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  listPosts: vi.fn(),
}));

const POST: Post = {
  id: 'p1',
  publishedAt: '2026-10-20T01:00:00Z',
  updatedAt: '2026-10-20T01:00:00Z',
  title: 'Term 4 starts',
  body: 'Classes resume on Monday.',
  authorId: null,
};

async function renderPage() {
  const Stub = createRoutesStub([
    { path: '/', Component: AdminPostsPage, loader: () => ({ ok: true, data: [POST] }) },
  ]);
  render(<Stub />);
  await screen.findByRole('heading', { name: POSTS_PAGE.heading });
}

function composeTitle() {
  return screen.getAllByLabelText(POSTS_PAGE.titleLabel)[0] as HTMLInputElement;
}

function composeBody() {
  return screen.getAllByLabelText(POSTS_PAGE.bodyLabel)[0] as HTMLTextAreaElement;
}

function publishButton() {
  return screen.getByRole('button', { name: POSTS_PAGE.publish });
}

beforeEach(() => {
  vi.mocked(createPost).mockReset();
  vi.mocked(updatePost).mockReset();
});

describe('admin posts: publish checks (AC-1.14)', () => {
  it('refuses an empty title and body inline and sends nothing', async () => {
    await renderPage();
    await userEvent.click(publishButton());
    expect(screen.getByText(POSTS_PAGE.titleLength)).toBeInTheDocument();
    expect(screen.getByText(POSTS_PAGE.bodyLength)).toBeInTheDocument();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('refuses a title and body of only spaces inline (N-49)', async () => {
    await renderPage();
    await userEvent.type(composeTitle(), '   ');
    await userEvent.type(composeBody(), '   ');
    await userEvent.click(publishButton());
    expect(screen.getByText(POSTS_PAGE.titleLength)).toBeInTheDocument();
    expect(screen.getByText(POSTS_PAGE.bodyLength)).toBeInTheDocument();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('marks the fields invalid and links them to their messages', async () => {
    await renderPage();
    await userEvent.click(publishButton());
    expect(composeTitle()).toHaveAttribute('aria-invalid', 'true');
    expect(composeTitle()).toHaveAccessibleDescription(POSTS_PAGE.titleLength);
  });

  it('keeps the length caps and shows the body counter', async () => {
    await renderPage();
    expect(composeTitle()).toHaveAttribute('maxlength', String(POST_LIMITS.titleMax));
    expect(composeBody()).toHaveAttribute('maxlength', String(POST_LIMITS.bodyMax));
    expect(screen.getByText(POSTS_PAGE.bodyCount(0))).toBeInTheDocument();
    await userEvent.type(composeBody(), 'Hello');
    expect(screen.getByText(POSTS_PAGE.bodyCount(5))).toBeInTheDocument();
  });

  it('saves the post without leading or trailing spaces', async () => {
    vi.mocked(createPost).mockResolvedValue({ ok: true, data: POST });
    await renderPage();
    await userEvent.type(composeTitle(), '  Term 4 starts  ');
    await userEvent.type(composeBody(), '  Classes resume.  ');
    await userEvent.click(publishButton());
    await waitFor(() =>
      expect(createPost).toHaveBeenCalledWith({ title: 'Term 4 starts', body: 'Classes resume.' }),
    );
    expect(screen.queryByText(POSTS_PAGE.titleLength)).not.toBeInTheDocument();
  });
});

describe('admin posts: edit checks (AC-1.14)', () => {
  it('refuses a title cleared to spaces when saving an edit, and sends nothing', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: POSTS_PAGE.edit }));
    const editTitle = screen.getAllByLabelText(POSTS_PAGE.titleLabel)[1] as HTMLInputElement;
    await userEvent.clear(editTitle);
    await userEvent.type(editTitle, '  ');
    await userEvent.click(screen.getByRole('button', { name: POSTS_PAGE.save }));
    expect(screen.getByText(POSTS_PAGE.titleLength)).toBeInTheDocument();
    expect(updatePost).not.toHaveBeenCalled();
  });

  it('saves a trimmed edit', async () => {
    vi.mocked(updatePost).mockResolvedValue({ ok: true, data: POST });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: POSTS_PAGE.edit }));
    const editBody = screen.getAllByLabelText(POSTS_PAGE.bodyLabel)[1] as HTMLTextAreaElement;
    await userEvent.type(editBody, '   ');
    await userEvent.click(screen.getByRole('button', { name: POSTS_PAGE.save }));
    await waitFor(() =>
      expect(updatePost).toHaveBeenCalledWith('p1', { title: POST.title, body: POST.body }),
    );
  });
});
