import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { hasPublishedPosts } from '@/services';

import { useHasNews } from './use-has-news';

vi.mock('@/services', () => ({ hasPublishedPosts: vi.fn() }));

/** A check whose answer the test gives later. */
function deferredCheck() {
  let answer: (value: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    answer = resolve;
  });
  return { promise, answer };
}

describe('useHasNews', () => {
  it('is false until the check says there is news, then true (AC-1.8)', async () => {
    const check = deferredCheck();
    vi.mocked(hasPublishedPosts).mockReturnValue(check.promise);
    const { result } = renderHook(() => useHasNews());
    expect(result.current).toBe(false);

    await act(async () => check.answer(true));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when the check says there is no news (AC-1.6, AC-1.7)', async () => {
    vi.mocked(hasPublishedPosts).mockResolvedValue(false);
    const { result } = renderHook(() => useHasNews());
    await act(async () => {});
    expect(result.current).toBe(false);
    expect(hasPublishedPosts).toHaveBeenCalled();
  });

  it('ignores an answer that arrives after the component has gone', async () => {
    const check = deferredCheck();
    vi.mocked(hasPublishedPosts).mockReturnValue(check.promise);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useHasNews());
    unmount();

    await act(async () => check.answer(true));
    expect(result.current).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
