// The finish step of a website sign-up (open sign-up, 03 §7.4): the name, a password (e-mail
// accounts only; a Google account needs none) and the Terms tick. Saved from the e-mail-link or
// Google session that opened it; the server refuses any other session (AC-17).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import formStyles from './PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  FINISH_SIGN_UP,
  LEGAL_LINKS,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PROFILE_LIMITS,
} from '@/constants';
import { checkCode } from '@/lib/portal-validation';
import { validateFinishSignUp } from '@/lib/sign-up-validation';
import type { FinishSignUpErrors, FinishSignUpValues } from '@/lib/sign-up-validation';
import { completeSignUp, sendReauthCode, signOut } from '@/services';
import type { SignUpInfo } from '@/services';

import { LegalLink } from './LegalLink';
import {
  CodeInput,
  FormAlert,
  FormStatus,
  PasswordInput,
  TextInput,
  errorIdFor,
} from './PortalField';

const FIELD_IDS = {
  fullName: 'finish-full-name',
  password: 'finish-password',
  confirm: 'finish-confirm-password',
  terms: 'finish-terms',
  code: 'finish-code',
} as const;

type FinishSignUpFormProps = { signUp: SignUpInfo; onDone: () => void };

export function FinishSignUpForm({ signUp, onDone }: FinishSignUpFormProps) {
  const navigate = useNavigate();
  const asksForPassword = signUp.signedUpWith === 'email';
  const [values, setValues] = useState<FinishSignUpValues>({
    // An e-mail sign-up's name was typed by whoever signed up, who may not be the mailbox owner,
    // so the owner types their own (security 06 finding 9). Google's name comes from the owner's
    // own Google account.
    fullName: asksForPassword ? '' : signUp.fullName,
    password: '',
    confirmation: '',
    acceptsTerms: false,
  });
  const [errors, setErrors] = useState<FinishSignUpErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // A tab left open for over a day: Supabase wants an emailed code before saving the password.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  function update<K extends keyof FinishSignUpValues>(field: K, value: FinishSignUpValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateFinishSignUp(values, asksForPassword);
    setErrors(found);
    const badCode = needsCode ? checkCode(code) : '';
    setCodeError(badCode);
    if (Object.keys(found).length > 0 || badCode) return;

    setFormError('');
    setSaving(true);
    const result = await completeSignUp(
      {
        fullName: values.fullName,
        password: asksForPassword ? values.password : null,
        acceptsTerms: values.acceptsTerms,
      },
      needsCode ? code : undefined,
    );
    if (result.ok) return onDone();

    if (result.error === 'reauthNeeded' && !needsCode) {
      const sent = await sendReauthCode();
      setSaving(false);
      if (sent.ok) setNeedsCode(true);
      else setFormError(PORTAL_ERRORS[sent.error]);
      return;
    }
    setSaving(false);
    if (result.error === 'invalidName') {
      setErrors({ fullName: PORTAL_ERRORS.invalidName });
      return;
    }
    // samePassword: ask for a different password; weakPassword and the rest: their message.
    setFormError(PORTAL_ERRORS[result.error]);
  }

  async function handleSignOut() {
    await signOut();
    navigate(PORTAL_ROUTES.login, { replace: true });
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <TextInput
        id={FIELD_IDS.fullName}
        label={FINISH_SIGN_UP.labels.fullName}
        autoComplete="name"
        maxLength={PROFILE_LIMITS.nameMax}
        value={values.fullName}
        onChange={(value) => update('fullName', value)}
        error={errors.fullName}
      />
      {asksForPassword && (
        <>
          <PasswordInput
            id={FIELD_IDS.password}
            label={FINISH_SIGN_UP.labels.password}
            hint={FINISH_SIGN_UP.hints.password}
            autoComplete="new-password"
            value={values.password}
            onChange={(value) => update('password', value)}
            error={errors.password}
          />
          <PasswordInput
            id={FIELD_IDS.confirm}
            label={FINISH_SIGN_UP.labels.confirm}
            autoComplete="new-password"
            value={values.confirmation}
            onChange={(value) => update('confirmation', value)}
            error={errors.confirm}
          />
        </>
      )}

      <div className={formStyles.field}>
        <label className={formStyles.consent} htmlFor={FIELD_IDS.terms}>
          <input
            id={FIELD_IDS.terms}
            type="checkbox"
            checked={values.acceptsTerms}
            onChange={(event) => update('acceptsTerms', event.target.checked)}
            aria-invalid={Boolean(errors.terms)}
            aria-describedby={errors.terms ? errorIdFor(FIELD_IDS.terms) : undefined}
          />
          <span>
            {FINISH_SIGN_UP.terms.before}
            <LegalLink href={LEGAL_LINKS.terms}>{FINISH_SIGN_UP.terms.termsLink}</LegalLink>
            {FINISH_SIGN_UP.terms.between}
            <LegalLink href={LEGAL_LINKS.privacy}>{FINISH_SIGN_UP.terms.privacyLink}</LegalLink>
            {FINISH_SIGN_UP.terms.after}
          </span>
        </label>
        {errors.terms && (
          <p id={errorIdFor(FIELD_IDS.terms)} className={formStyles.fieldError}>
            {errors.terms}
          </p>
        )}
      </div>

      {needsCode && (
        <>
          <FormStatus message={FINISH_SIGN_UP.codeSent} />
          <CodeInput
            id={FIELD_IDS.code}
            label={FINISH_SIGN_UP.labels.code}
            value={code}
            onChange={setCode}
            error={codeError}
          />
        </>
      )}

      <FormAlert message={formError} />
      <Button type="submit" disabled={saving}>
        {saving ? FINISH_SIGN_UP.submitting : FINISH_SIGN_UP.submit}
      </Button>
      <button type="button" className={formStyles.textButton} onClick={handleSignOut}>
        {FINISH_SIGN_UP.signOut}
      </button>
    </form>
  );
}
