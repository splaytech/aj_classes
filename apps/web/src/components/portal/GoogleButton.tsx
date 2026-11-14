// "Continue with Google" (open sign-up, 03 §7.4). Shown only when Supabase says Google is on
// (AC-51). The page passes the service that starts the sign-in, so the component never calls a
// backend itself.

import { useState } from 'react';

import { Button } from '@/components/ui';
import { PORTAL_ERRORS, SIGN_UP_PAGE } from '@/constants';
import type { Result } from '@/services';

import { FormAlert } from './PortalField';

type GoogleButtonProps = { onStart: () => Promise<Result> };

export function GoogleButton({ onStart }: GoogleButtonProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setError('');
    setStarting(true);
    const result = await onStart();
    // On success the browser is on its way to Google; only a failure comes back here.
    if (!result.ok) {
      setStarting(false);
      setError(PORTAL_ERRORS[result.error]);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={handleClick} disabled={starting}>
        {SIGN_UP_PAGE.google}
      </Button>
      <FormAlert message={error} />
    </>
  );
}
