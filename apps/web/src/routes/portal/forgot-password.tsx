// Forgot password (story US5). Always gives the same answer, so it can't reveal who has an account.

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { AuthCard, FormAlert, FormStatus, TextInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button, TurnstileField } from '@/components/ui';
import type { TurnstileInstance } from '@/components/ui';
import {
  PORTAL_ERRORS,
  FORGOT_PASSWORD_PAGE,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
} from '@/constants';
import { checkEmail } from '@/lib/portal-validation';
import { useAppearance } from '@/lib/appearance-context';
import { buildPortalMeta } from '@/lib/seo';
import { requestPasswordReset } from '@/services';

const EMAIL_FIELD_ID = 'forgot-email';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.forgotPassword);
}

export default function ForgotPasswordPage() {
  const appearance = useAppearance();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const turnstileRef = useRef<TurnstileInstance>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = checkEmail(email);
    setEmailError(error);
    if (error) return;

    if (!captchaToken) {
      setCaptchaError(PORTAL_VALIDATION.captchaRequired);
      return;
    }

    setFormError('');
    setStatus('sending');
    const result = await requestPasswordReset(email, captchaToken);

    if (result.ok) {
      setStatus('sent');
      return;
    }
    setStatus('idle');
    setFormError(PORTAL_ERRORS[result.error]);
    setCaptchaToken('');
    turnstileRef.current?.reset();
  }

  return (
    <AuthCard heading={FORGOT_PASSWORD_PAGE.heading} intro={FORGOT_PASSWORD_PAGE.intro}>
      {status === 'sent' ? (
        <FormStatus message={FORGOT_PASSWORD_PAGE.sent} />
      ) : (
        <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
          <TextInput
            id={EMAIL_FIELD_ID}
            label={FORGOT_PASSWORD_PAGE.emailLabel}
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            error={emailError}
          />
          <TurnstileField
            theme={appearance.shown}
            turnstileRef={turnstileRef}
            onTokenChange={(token) => {
              setCaptchaToken(token);
              if (token) setCaptchaError('');
            }}
            error={captchaError}
          />
          <FormAlert message={formError} />
          <Button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? FORGOT_PASSWORD_PAGE.submitting : FORGOT_PASSWORD_PAGE.submit}
          </Button>
        </form>
      )}
      <Link to={PORTAL_ROUTES.login}>{FORGOT_PASSWORD_PAGE.backToLogin}</Link>
    </AuthCard>
  );
}
