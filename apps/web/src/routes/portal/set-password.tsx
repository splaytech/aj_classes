// Choose a password after an invite or reset link (stories US2, US5).
// Accounts with two-step sign-in enter an authenticator code first: Supabase won't change
// their password from a link-only session (R2a review V19).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, FormAlert, PasswordInput, TwoStepCodeForm } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import { PORTAL_ERRORS, PORTAL_ROUTES, PORTAL_SEO, SET_PASSWORD_PAGE } from '@/constants';
import { guardPortalPage } from '@/lib/portal-guard';
import { checkNewPassword, checkPasswordsMatch } from '@/lib/portal-validation';
import { buildPortalMeta } from '@/lib/seo';
import { setNewPassword } from '@/services';

const FIELD_IDS = { password: 'new-password', confirm: 'confirm-password' } as const;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.setPassword);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const page = await guardPortalPage(request, 'setPassword');
  const access = page?.access;
  return { needsCode: Boolean(access?.hasVerifiedFactor && access.aal === 'aal1') };
}

export default function SetPasswordPage() {
  const { needsCode } = useLoaderData<typeof clientLoader>();
  const [codeDone, setCodeDone] = useState(false);

  if (needsCode && !codeDone) {
    return (
      <AuthCard heading={SET_PASSWORD_PAGE.heading} intro={SET_PASSWORD_PAGE.twoStepIntro}>
        <TwoStepCodeForm onVerified={() => setCodeDone(true)} />
      </AuthCard>
    );
  }

  return (
    <AuthCard heading={SET_PASSWORD_PAGE.heading} intro={SET_PASSWORD_PAGE.intro}>
      <NewPasswordForm />
    </AuthCard>
  );
}

function NewPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ password: '', confirm: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = {
      password: checkNewPassword(password),
      confirm: checkPasswordsMatch(password, confirmation),
    };
    setFieldErrors(errors);
    if (errors.password || errors.confirm) return;

    setFormError('');
    setSaving(true);
    const result = await setNewPassword(password);

    if (result.ok) {
      navigate(PORTAL_ROUTES.root, { replace: true });
      return;
    }
    setSaving(false);
    setFormError(PORTAL_ERRORS[result.error]);
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <PasswordInput
        id={FIELD_IDS.password}
        label={SET_PASSWORD_PAGE.labels.password}
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
      />
      <PasswordInput
        id={FIELD_IDS.confirm}
        label={SET_PASSWORD_PAGE.labels.confirm}
        autoComplete="new-password"
        value={confirmation}
        onChange={setConfirmation}
        error={fieldErrors.confirm}
      />
      <FormAlert message={formError} />
      <Button type="submit" disabled={saving}>
        {saving ? SET_PASSWORD_PAGE.submitting : SET_PASSWORD_PAGE.submit}
      </Button>
    </form>
  );
}
