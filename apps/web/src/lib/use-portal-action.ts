// Runs one page action (save, invite, deactivate…) and keeps its busy flag, error and success
// message, so every staff page reports results the same way.

import { useState } from 'react';

import { PORTAL_ERRORS } from '@/constants';
import type { Result } from '@/services';

export function usePortalAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /** Returns true when the action worked. */
  async function run(action: () => Promise<Result<unknown>>, successNotice = ''): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');
    const result = await action();
    setBusy(false);

    if (result.ok) {
      setNotice(successNotice);
      return true;
    }
    setError(PORTAL_ERRORS[result.error]);
    return false;
  }

  function clear() {
    setError('');
    setNotice('');
  }

  /** Shows a success message for something that finished elsewhere (e.g. in a dialog). */
  function announce(message: string) {
    setError('');
    setNotice(message);
  }

  /** Shows a problem found after an action that itself worked (e.g. Zoho CRM still refusing). */
  function showError(message: string) {
    setNotice('');
    setError(message);
  }

  return { busy, error, notice, run, clear, announce, showError };
}
