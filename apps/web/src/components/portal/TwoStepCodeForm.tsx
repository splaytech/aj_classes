// Asks for a 6-digit authenticator code and upgrades the session to two-step (aal2).
// Used after the password at sign-in, and before saving a new password (R2a review V19).

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui';
import {
  AUTH_ERRORS,
  AUTH_LIMITS,
  LOGIN_VERIFY_PAGE,
  PORTAL_COMMON,
  PORTAL_VALIDATION,
} from '@/constants';
import { listAuthenticators, verifyTwoStepCode } from '@/services';
import type { Authenticator } from '@/services';

import { CodeInput, FormAlert, PortalField } from './PortalField';
import styles from './PortalForm.module.css';

const FIELD_IDS = {
  authenticator: 'two-step-authenticator',
  code: 'two-step-code',
} as const;

export function TwoStepCodeForm({ onVerified }: { onVerified: () => void }) {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    listAuthenticators().then((result) => {
      if (!result.ok) {
        setFormError(AUTH_ERRORS[result.error]);
        return;
      }
      setAuthenticators(result.data);
      setFactorId(result.data[0]?.id ?? '');
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== AUTH_LIMITS.codeLength) {
      setCodeError(PORTAL_VALIDATION.codeInvalid);
      return;
    }

    setCodeError('');
    setFormError('');
    setChecking(true);
    const result = await verifyTwoStepCode(factorId, code);
    setChecking(false);

    if (result.ok) {
      onVerified();
      return;
    }
    setCode('');
    setFormError(AUTH_ERRORS[result.error]);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {authenticators.length > 1 && (
        <PortalField id={FIELD_IDS.authenticator} label={LOGIN_VERIFY_PAGE.chooseAuthenticator}>
          <select
            id={FIELD_IDS.authenticator}
            className={styles.input}
            value={factorId}
            onChange={(event) => setFactorId(event.target.value)}
          >
            {authenticators.map((authenticator) => (
              <option key={authenticator.id} value={authenticator.id}>
                {authenticator.name}
              </option>
            ))}
          </select>
        </PortalField>
      )}

      <CodeInput
        id={FIELD_IDS.code}
        label={LOGIN_VERIFY_PAGE.codeLabel}
        value={code}
        onChange={setCode}
        error={codeError}
      />

      <FormAlert message={formError} />

      <Button type="submit" disabled={checking || !factorId}>
        {checking ? LOGIN_VERIFY_PAGE.submitting : LOGIN_VERIFY_PAGE.submit}
      </Button>
      {!factorId && !formError && <p className={styles.hint}>{PORTAL_COMMON.loading}</p>}
    </form>
  );
}
