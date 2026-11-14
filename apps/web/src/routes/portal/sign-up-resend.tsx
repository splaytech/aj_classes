// Send the sign-up link again (open sign-up AC-19). Always answers "sent", so it can't reveal who
// has signed up; only the captcha, the IP limit and the network are reported. Not stopped by the
// daily cap (R2).

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, FinishSignUpHint, FormAlert, TextInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button, TurnstileField } from '@/components/ui';
import type { TurnstileInstance } from '@/components/ui';
import {
  FORGOT_PASSWORD_PAGE,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
  SIGN_UP_PAGE,
  SIGN_UP_RESEND_PAGE,
} from '@/constants';
import { useAppearance } from '@/lib/appearance-context';
import { guardPortalPage } from '@/lib/portal-guard';
import { checkEmail } from '@/lib/portal-validation';
import { buildPortalMeta } from '@/lib/seo';
import { resendSignUpLink } from '@/services';

const EMAIL_FIELD_ID = 'sign-up-resend-email';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.signUpResend);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  await guardPortalPage(request, 'signedOutOnly');
  return null;
}

export default function SignUpResendPage() {
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
    const result = await resendSignUpLink(email, captchaToken);
    if (result.ok) {
      setStatus('sent');
      return;
    }
    setStatus('idle');
    setFormError(PORTAL_ERRORS[result.error]);
    setCaptchaToken('');
    turnstileRef.current?.reset();
  }

  if (status === 'sent') {
    return (
      <AuthCard heading={SIGN_UP_PAGE.sent.heading} intro={SIGN_UP_PAGE.sent.text}>
        <FinishSignUpHint />
        <Link to={PORTAL_ROUTES.login}>{FORGOT_PASSWORD_PAGE.backToLogin}</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard heading={SIGN_UP_RESEND_PAGE.heading} intro={SIGN_UP_RESEND_PAGE.intro}>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          id={EMAIL_FIELD_ID}
          label={SIGN_UP_PAGE.labels.email}
          type="email"
          autoComplete="email"
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
          {status === 'sending' ? SIGN_UP_RESEND_PAGE.submitting : SIGN_UP_RESEND_PAGE.submit}
        </Button>
      </form>
      <Link to={PORTAL_ROUTES.login}>{FORGOT_PASSWORD_PAGE.backToLogin}</Link>
    </AuthCard>
  );
}
