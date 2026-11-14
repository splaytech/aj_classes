// A stand-in for the Turnstile widget in page tests: a "Pass the check" button gives a token,
// and reset() is counted so tests can see the widget was reset after a failure.

import { useImperativeHandle } from 'react';
import type { RefObject } from 'react';

export const turnstileResets = { count: 0 };

type StubProps = {
  turnstileRef: RefObject<{ reset: () => void } | null>;
  onTokenChange: (token: string) => void;
  error?: string;
};

export function TurnstileStub({ turnstileRef, onTokenChange, error }: StubProps) {
  useImperativeHandle(turnstileRef, () => ({
    reset: () => {
      turnstileResets.count += 1;
    },
  }));
  return (
    <div>
      <button type="button" onClick={() => onTokenChange('test-token')}>
        Pass the check
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
