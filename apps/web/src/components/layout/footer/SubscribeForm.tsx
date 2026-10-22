// Footer "Stay in the loop" newsletter sign-up (PRP F3.6).
//
// Just an email and a button. Kit then emails a confirmation link (double opt-in), which
// stops bots and typos, so there is no captcha or tick box here. The consent wording
// sits beside the button instead.

import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui';
import { ANALYTICS_EVENTS, ELEMENT_IDS, FORM_ERRORS, SUBSCRIBE, VALIDATION } from '@/constants';
import { trackEvent } from '@/lib/analytics';
import { isValidEmail } from '@/lib/validation';
import { subscribe } from '@/services';

import styles from './SubscribeForm.module.css';

type Status = 'idle' | 'submitting' | 'success';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setError(VALIDATION.emailInvalid);
      return;
    }

    setError('');
    setStatus('submitting');
    const result = await subscribe(email);

    if (result === 'success') {
      setStatus('success');
      trackEvent(ANALYTICS_EVENTS.subscribeSuccess);
      return;
    }

    setStatus('idle');
    setError(result === 'not-configured' ? FORM_ERRORS.notConfigured : FORM_ERRORS.network);
  }

  if (status === 'success') {
    return (
      <p className={styles.success} role="status">
        {SUBSCRIBE.success(email.trim())}
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={ELEMENT_IDS.subscribeEmail}>
        {SUBSCRIBE.emailLabel}
      </label>
      <input
        id={ELEMENT_IDS.subscribeEmail}
        className={styles.input}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <p className={styles.consent}>{SUBSCRIBE.consentNotice}</p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? SUBSCRIBE.submitting : SUBSCRIBE.submit}
        </Button>
      </div>
    </form>
  );
}
