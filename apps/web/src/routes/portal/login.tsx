// Staff sign in (story US3): email, password and the "I am human" check.

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, FormAlert, FormStatus, PasswordInput, TextInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button, TurnstileField } from '@/components/ui';
import type { TurnstileInstance } from '@/components/ui';
import {
  PORTAL_ERRORS,
  LOGIN_PAGE,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
  SIGN_IN_REASONS,
} from '@/constants';
import { safeNextPath } from '@/lib/portal-access';
import { guardPortalPage } from '@/lib/portal-guard';
import { checkEmail, checkPasswordEntered } from '@/lib/portal-validation';
import { buildPortalMeta } from '@/lib/seo';
import { signIn } from '@/services';

const FIELD_IDS = { email: 'login-email', password: 'login-password' } as const;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.login);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  await guardPortalPage(request, 'signedOutOnly');
  return null;
}

/** A note at the top of the page, e.g. after being signed out because of deactivation. */
function noticeFor(reason: string | null): { error: string; status: string } {
  if (reason === SIGN_IN_REASONS.inactive) return { error: PORTAL_ERRORS.notActive, status: '' };
  if (reason === SIGN_IN_REASONS.passwordChanged) {
    return { error: '', status: LOGIN_PAGE.passwordChanged };
  }
  return { error: '', status: '' };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notice = noticeFor(searchParams.get(PORTAL_QUERY.reason));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState(notice.error);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = { email: checkEmail(email), password: checkPasswordEntered(password) };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    if (!captchaToken) {
      setCaptchaError(PORTAL_VALIDATION.captchaRequired);
      return;
    }

    setCaptchaError('');
    setFormError('');
    setSubmitting(true);
    const result = await signIn(email, password, captchaToken);

    if (result.ok) {
      // /portal sends each person on: two-step code, two-step setup, or their home page.
      const next = safeNextPath(searchParams.get(PORTAL_QUERY.next));
      navigate(next ?? PORTAL_ROUTES.root, { replace: true });
      return;
    }

    setSubmitting(false);
    setFormError(PORTAL_ERRORS[result.error]);
    setCaptchaToken(''); // a token works only once
    turnstileRef.current?.reset();
  }

  return (
    <AuthCard heading={LOGIN_PAGE.heading} intro={LOGIN_PAGE.intro}>
      <FormStatus message={notice.status} />
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          id={FIELD_IDS.email}
          label={LOGIN_PAGE.labels.email}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <PasswordInput
          id={FIELD_IDS.password}
          label={LOGIN_PAGE.labels.password}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        <TurnstileField
          turnstileRef={turnstileRef}
          onTokenChange={(token) => {
            setCaptchaToken(token);
            if (token) setCaptchaError('');
          }}
          error={captchaError}
        />
        <FormAlert message={formError} />
        <div className={formStyles.actions}>
          <Button type="submit" disabled={submitting}>
            {submitting ? LOGIN_PAGE.submitting : LOGIN_PAGE.submit}
          </Button>
          <Link to={PORTAL_ROUTES.forgotPassword}>{LOGIN_PAGE.forgotPassword}</Link>
        </div>
      </form>
    </AuthCard>
  );
}
