// Create an account (open sign-up, ADR-0011; 03 §7.6). Parents and guardians give their name and
// e-mail; the confirmation link proves the mailbox, and the password is chosen on the finish step.
// Whatever the e-mail, a sent sign-up always shows the same card (AC-10, AC-12). While the e-mail
// form is switched off (Google-only release), the page offers only "Continue with Google".

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, FormAlert, GoogleButton, TextInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button, TurnstileField } from '@/components/ui';
import type { TurnstileInstance } from '@/components/ui';
import {
  LEGAL_LINKS,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
  SIGN_UP_PAGE,
  PROFILE_VALIDATION,
} from '@/constants';
import { useAppearance } from '@/lib/appearance-context';
import { guardPortalPage } from '@/lib/portal-guard';
import { buildPortalMeta } from '@/lib/seo';
import { validateSignUp } from '@/lib/sign-up-validation';
import type { SignUpErrors } from '@/lib/sign-up-validation';
import { getSignUpOptions, signUpWithEmail, startGoogleSignIn } from '@/services';
import type { SignUpOptions } from '@/services';

const FIELD_IDS = { fullName: 'sign-up-name', email: 'sign-up-email' } as const;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.signUp);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs): Promise<SignUpOptions> {
  await guardPortalPage(request, 'signedOutOnly');
  return getSignUpOptions();
}

type View = 'form' | 'sent' | 'closed';

export default function SignUpPage() {
  const options = useLoaderData<typeof clientLoader>();
  const [view, setView] = useState<View>(options.status === 'closed' ? 'closed' : 'form');

  if (view === 'closed') return <ClosedCard />;
  if (view === 'sent') return <SentCard />;
  // Google-only (e-mail form switched off at release): Google sign-ups aren't capped, so busy
  // doesn't apply. getSignUpOptions reads "no way in" as closed, so Google is on here.
  if (!options.email) return <GoogleOnlyCard />;
  return (
    <SignUpForm
      busy={options.status === 'busy'}
      google={options.google}
      onSent={() => setView('sent')}
      onClosed={() => setView('closed')}
    />
  );
}

function SignUpForm({
  busy,
  google,
  onSent,
  onClosed,
}: {
  busy: boolean;
  google: boolean;
  onSent: () => void;
  onClosed: () => void;
}) {
  const appearance = useAppearance();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignUpErrors>({});
  const [formError, setFormError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  function resetCaptcha() {
    setCaptchaToken(''); // a token works only once
    turnstileRef.current?.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateSignUp(fullName, email);
    setFieldErrors(errors);
    if (errors.fullName || errors.email) return;

    if (!captchaToken) {
      setCaptchaError(PORTAL_VALIDATION.captchaRequired);
      return;
    }
    // At today's cap, say so for any e-mail without calling anything (AC-46).
    if (busy) {
      setFormError(SIGN_UP_PAGE.busy);
      return;
    }

    setFormError('');
    setSubmitting(true);
    // The cap may have filled, or sign-up closed, since the page loaded. Ask again, so everyone
    // gets the same busy or closed answer whatever their e-mail (AC-46, AC-12; review-5 finding 2).
    const latest = await getSignUpOptions();
    if (latest.status !== 'open') {
      setSubmitting(false);
      if (latest.status === 'closed') return onClosed();
      setFormError(SIGN_UP_PAGE.busy);
      return;
    }
    const result = await signUpWithEmail(fullName, email, captchaToken);
    setSubmitting(false);
    if (result.ok) return onSent();
    if (result.error === 'signUpClosed') return onClosed();

    resetCaptcha();
    if (result.error === 'invalidName') {
      // The self-service wording, as the browser check gives (Tester 6a bug 3).
      setFieldErrors({ fullName: PROFILE_VALIDATION.nameLength });
      return;
    }
    setFormError(PORTAL_ERRORS[result.error]);
  }

  return (
    <AuthCard heading={SIGN_UP_PAGE.heading} intro={SIGN_UP_PAGE.intro}>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          id={FIELD_IDS.fullName}
          label={SIGN_UP_PAGE.labels.fullName}
          autoComplete="name"
          value={fullName}
          onChange={setFullName}
          error={fieldErrors.fullName}
        />
        <TextInput
          id={FIELD_IDS.email}
          label={SIGN_UP_PAGE.labels.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
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
        <p className={formStyles.hint}>
          {SIGN_UP_PAGE.notice.before}
          <Link to={LEGAL_LINKS.privacy}>{SIGN_UP_PAGE.notice.link}</Link>
          {SIGN_UP_PAGE.notice.after}
        </p>
        <FormAlert message={formError} />
        <Button type="submit" disabled={submitting}>
          {submitting ? SIGN_UP_PAGE.submitting : SIGN_UP_PAGE.submit}
        </Button>
      </form>
      {google && (
        <>
          <p className={formStyles.hint}>{SIGN_UP_PAGE.or}</p>
          <GoogleButton onStart={startGoogleSignIn} />
        </>
      )}
      <p>
        {SIGN_UP_PAGE.haveAccount}
        <Link to={PORTAL_ROUTES.login}>{SIGN_UP_PAGE.signIn}</Link>
      </p>
    </AuthCard>
  );
}

function GoogleOnlyCard() {
  return (
    <AuthCard heading={SIGN_UP_PAGE.heading} intro={SIGN_UP_PAGE.intro}>
      <GoogleButton onStart={startGoogleSignIn} />
      <p className={formStyles.hint}>
        {SIGN_UP_PAGE.notice.before}
        <Link to={LEGAL_LINKS.privacy}>{SIGN_UP_PAGE.notice.link}</Link>
        {SIGN_UP_PAGE.notice.after}
      </p>
      <p>
        {SIGN_UP_PAGE.haveAccount}
        <Link to={PORTAL_ROUTES.login}>{SIGN_UP_PAGE.signIn}</Link>
      </p>
    </AuthCard>
  );
}

/** The same card for every sent sign-up, new e-mail or not (AC-10). */
function SentCard() {
  const { sent } = SIGN_UP_PAGE;
  return (
    <AuthCard heading={sent.heading} intro={sent.text}>
      <p>
        {sent.help.before}
        <Link to={PORTAL_ROUTES.login}>{sent.help.signIn}</Link>
        {sent.help.between}
        <Link to={PORTAL_ROUTES.forgotPassword}>{sent.help.reset}</Link>
        {sent.help.after}
      </p>
      <Link to={PORTAL_ROUTES.signUpResend}>{sent.sendAgain}</Link>
    </AuthCard>
  );
}

function ClosedCard() {
  return (
    <AuthCard heading={SIGN_UP_PAGE.closed.heading} intro={SIGN_UP_PAGE.closed.text}>
      <Link to={PORTAL_ROUTES.login}>{SIGN_UP_PAGE.signIn}</Link>
    </AuthCard>
  );
}
