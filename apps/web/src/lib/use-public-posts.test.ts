import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { listPublicPosts } from '@/services';
import type { PublicPost } from '@/services';

import { usePublicPosts } from './use-public-posts';

vi.mock('@/services', () => ({ listPublicPosts: vi.fn() }));

const POST: PublicPost = {
  id: 'p1',
  publishedAt: '2026-10-20T01:00:00Z',
  title: 'Term 4 starts',
  body: 'Classes resume on Monday.',
};

describe('usePublicPosts', () => {
  it('starts as loading', () => {
    vi.mocked(listPublicPosts).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePublicPosts());
    expect(result.current).toEqual({ status: 'loading' });
  });

  it('is ready with the posts once they load', async () => {
    vi.mocked(listPublicPosts).mockResolvedValue({ ok: true, data: [POST] });
    const { result } = renderHook(() => usePublicPosts());
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', posts: [POST] }));
  });

  it('is ready with an empty list when there are no posts (AC-1.6)', async () => {
    vi.mocked(listPublicPosts).mockResolvedValue({ ok: true, data: [] });
    const { result } = renderHook(() => usePublicPosts());
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', posts: [] }));
  });

  it('turns a network failure into the error state, not the empty one (AC-1.7)', async () => {
    vi.mocked(listPublicPosts).mockResolvedValue({ ok: false, error: 'network' });
    const { result } = renderHook(() => usePublicPosts());
    await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
  });
});
