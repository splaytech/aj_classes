import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnswerChange, Result } from '@/services';

import { WRITTEN_SAVE_DELAY_MS, useAnswerAutosave } from './use-answer-autosave';

type Call = { questionId: string; change: AnswerChange };

/** A fake save that resolves only when the test says so, to control the order of replies. */
function controllableSave() {
  const calls: Call[] = [];
  const finishers: (() => void)[] = [];
  const save = vi.fn((questionId: string, change: AnswerChange) => {
    calls.push({ questionId, change });
    return new Promise<Result>((resolve) =>
      finishers.push(() => resolve({ ok: true, data: undefined })),
    );
  });
  return { save, calls, finishNext: () => finishers.shift()?.() };
}

describe('useAnswerAutosave (R3b FS2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a multiple-choice answer straight away, and the next only after the first finishes', async () => {
    const fake = controllableSave();
    const { result } = renderHook(() => useAnswerAutosave(fake.save));

    act(() => {
      result.current.saveOption('q1', 0);
      result.current.saveOption('q1', 2);
    });
    await act(async () => {});
    expect(fake.calls).toEqual([{ questionId: 'q1', change: { option: 0 } }]);
    expect(result.current.states.q1).toBe('saving');

    await act(async () => fake.finishNext());
    expect(fake.calls.map((call) => call.change)).toEqual([{ option: 0 }, { option: 2 }]);

    await act(async () => fake.finishNext());
    expect(result.current.states.q1).toBe('saved');
  });

  it('waits for typing to stop before saving a written answer', async () => {
    const fake = controllableSave();
    const { result } = renderHook(() => useAnswerAutosave(fake.save));

    act(() => {
      result.current.saveTextSoon('q2', 'Be');
      result.current.saveTextSoon('q2', 'Because');
    });
    expect(fake.calls).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(WRITTEN_SAVE_DELAY_MS);
    });
    expect(fake.calls).toEqual([{ questionId: 'q2', change: { text: 'Because' } }]);
  });

  it('sends waiting answers before submitting', async () => {
    const fake = controllableSave();
    const { result } = renderHook(() => useAnswerAutosave(fake.save));

    act(() => result.current.saveTextSoon('q3', 'Almost done'));
    let flushed = false;
    await act(async () => {
      void result.current.flushAll().then(() => {
        flushed = true;
      });
    });
    expect(fake.calls).toEqual([{ questionId: 'q3', change: { text: 'Almost done' } }]);
    expect(flushed).toBe(false);

    await act(async () => fake.finishNext());
    expect(flushed).toBe(true);
  });

  it('reports a failed save', async () => {
    const save = vi.fn(async (): Promise<Result> => ({ ok: false, error: 'alreadySubmitted' }));
    const { result } = renderHook(() => useAnswerAutosave(save));

    await act(async () => result.current.saveOption('q1', 1));
    expect(result.current.states.q1).toBe('error');
    expect(result.current.lastError).toBe('alreadySubmitted');
  });
});
