// Saves a student's answers as they work (R3b story FS2 AC1): a multiple-choice answer straight
// away, a written answer a moment after typing stops (or when the box loses focus). Saves for one
// question run one after another, so an older save can never land after a newer one (F17).

import { useEffect, useRef, useState } from 'react';

import type { AnswerChange, ErrorKey, Result } from '@/services';

export type SaveState = 'saving' | 'saved' | 'error';

export const WRITTEN_SAVE_DELAY_MS = 800;

type SaveAnswer = (questionId: string, change: AnswerChange) => Promise<Result>;

export function useAnswerAutosave(saveAnswer: SaveAnswer) {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [lastError, setLastError] = useState<ErrorKey | null>(null);
  const queues = useRef(new Map<string, Promise<void>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const waitingText = useRef(new Map<string, string>());

  function run(questionId: string, change: AnswerChange): Promise<void> {
    setStates((current) => ({ ...current, [questionId]: 'saving' }));
    const previous = queues.current.get(questionId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const result = await saveAnswer(questionId, change);
      setStates((current) => ({ ...current, [questionId]: result.ok ? 'saved' : 'error' }));
      setLastError(result.ok ? null : result.error);
    });
    queues.current.set(questionId, next);
    return next;
  }

  /** Sends a written answer that is still waiting for typing to stop. */
  function flushText(questionId: string): Promise<void> {
    clearTimeout(timers.current.get(questionId));
    timers.current.delete(questionId);
    const text = waitingText.current.get(questionId);
    if (text === undefined) return queues.current.get(questionId) ?? Promise.resolve();
    waitingText.current.delete(questionId);
    return run(questionId, { text });
  }

  function saveOption(questionId: string, option: number) {
    void run(questionId, { option });
  }

  function saveTextSoon(questionId: string, text: string) {
    waitingText.current.set(questionId, text);
    clearTimeout(timers.current.get(questionId));
    timers.current.set(
      questionId,
      setTimeout(() => void flushText(questionId), WRITTEN_SAVE_DELAY_MS),
    );
  }

  /** Before submitting: send everything still waiting, then wait for every save to finish. */
  async function flushAll(): Promise<void> {
    await Promise.all([...waitingText.current.keys()].map(flushText));
    await Promise.all(queues.current.values());
  }

  // Leaving the page part-way through a sentence still saves it.
  useEffect(() => {
    const pending = waitingText.current;
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach((timer) => clearTimeout(timer));
      pending.forEach((text, questionId) => void saveAnswer(questionId, { text }));
    };
  }, [saveAnswer]);

  return { states, lastError, saveOption, saveTextSoon, flushText, flushAll };
}
