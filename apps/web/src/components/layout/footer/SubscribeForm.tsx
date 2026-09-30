// Footer "Stay in the loop" sign-up: email, consent tick box and the hCaptcha check (PRP F3.6).

import type HCaptcha from '@hcaptcha/react-hcaptcha';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button, CaptchaField } from '@/components/ui';
import { ANALYTICS_EVENTS, ELEMENT_IDS, FORM_ERRORS, SUBSCRIBE, VALIDATION } from '@/constants';
import { trackEvent } from '@/lib/analytics';
import { isValidEmail } from '@/lib/validation';
import { subscribe } from '@/services';

import styles from './SubscribeForm.module.css';

type Status = 'idle' | 'submitting' | 'success';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const captchaRef = useRef<HCaptcha>(null);

  function findError(): string {
    if (!isValidEmail(email)) return VALIDATION.emailInvalid;
    if (!consent) return VALIDATION.consentRequired;
    if (!captchaToken) return VALIDATION.captchaRequired;
    return '';
  }

  /** A captcha token works only once, so ask for a fresh check after a failed send. */
  function resetCaptcha() {
    setCaptchaToken('');
    captchaRef.current?.resetCaptcha();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = findError();
    setError(validationError);
    if (validationError) return;

    setStatus('submitting');
    const result = await subscribe(email, captchaToken);

    if (result === 'success') {
      setStatus('success');
      trackEvent(ANALYTICS_EVENTS.subscribeSuccess);
      return;
    }

    setStatus('idle');
    setError(result === 'not-configured' ? FORM_ERRORS.notConfigured : FORM_ERRORS.network);
    resetCaptcha();
  }

  if (status === 'success') {
    return (
      <p className={styles.success} role="status">
        {SUBSCRIBE.success}
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

      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        {SUBSCRIBE.consent}
      </label>

      <CaptchaField captchaRef={captchaRef} onTokenChange={setCaptchaToken} theme="dark" />

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
