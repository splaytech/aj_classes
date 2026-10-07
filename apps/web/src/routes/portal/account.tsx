// Your account (stories US6, US9): change password, and two-step sign-in.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';

import { CodeInput, FormAlert, FormStatus, PasswordInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  ACCOUNT_PAGE,
  APP_CONFIG,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  STAFF_ROLE_LABELS,
} from '@/constants';
import { checkCode, checkNewPassword, checkPasswordsMatch } from '@/lib/portal-validation';
import { buildPortalMeta } from '@/lib/seo';
import {
  canAddAuthenticator,
  changePassword,
  listAuthenticators,
  removeAuthenticator,
  sendReauthCode,
} from '@/services';
import type { Authenticator } from '@/services';

import { useStaffAccess } from './staff-layout';
import styles from './account.module.css';

const FIELD_IDS = { code: 'reauth-code', password: 'change-password', confirm: 'change-confirm' };

export function meta() {
  return buildPortalMeta(PORTAL_SEO.account);
}

// Access is checked by the staff layout; this only loads the authenticator list.
export async function clientLoader() {
  return listAuthenticators();
}

export default function AccountPage() {
  const access = useStaffAccess();
  const role = access.profile?.role ?? 'tutor';

  return (
    <div className={styles.page}>
      <h1>{ACCOUNT_PAGE.heading}</h1>
      <dl className={styles.facts}>
        <dt>{ACCOUNT_PAGE.signedInAs}</dt>
        <dd>{access.email}</dd>
        <dt>{ACCOUNT_PAGE.role}</dt>
        <dd>{STAFF_ROLE_LABELS[role]}</dd>
      </dl>
      <ChangePasswordSection />
      <TwoStepSection isAdmin={role === 'admin'} />
    </div>
  );
}

/**
 * New password twice. If Supabase wants proof it's really the owner (session over a day old),
 * a code is emailed and asked for before trying again (R2a review V21).
 */
function ChangePasswordSection() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ code: '', password: '', confirm: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [codeMessage, setCodeMessage] = useState<string>(ACCOUNT_PAGE.password.codeSent);

  async function handleResendCode() {
    setFormError('');
    const sent = await sendReauthCode();
    if (sent.ok) setCodeMessage(ACCOUNT_PAGE.password.codeResent);
    else setFormError(PORTAL_ERRORS[sent.error]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = {
      code: needsCode ? checkCode(code) : '',
      password: checkNewPassword(password),
      confirm: checkPasswordsMatch(password, confirmation),
    };
    setFieldErrors(errors);
    if (errors.code || errors.password || errors.confirm) return;

    setFormError('');
    setSaving(true);
    const result = await changePassword(password, needsCode ? code : undefined);

    if (result.ok) {
      setDone(true);
    } else if (result.error === 'reauthNeeded') {
      const sent = await sendReauthCode();
      if (sent.ok) setNeedsCode(true);
      else setFormError(PORTAL_ERRORS[sent.error]);
    } else {
      setFormError(PORTAL_ERRORS[result.error]);
    }
    setSaving(false);
  }

  if (done) {
    return (
      <section className={styles.section}>
        <h2>{ACCOUNT_PAGE.password.heading}</h2>
        <FormStatus message={ACCOUNT_PAGE.password.done} />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2>{ACCOUNT_PAGE.password.heading}</h2>
      <p className={formStyles.hint}>{ACCOUNT_PAGE.password.intro}</p>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <PasswordInput
          id={FIELD_IDS.password}
          label={ACCOUNT_PAGE.password.labels.password}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        <PasswordInput
          id={FIELD_IDS.confirm}
          label={ACCOUNT_PAGE.password.labels.confirm}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={fieldErrors.confirm}
        />
        {needsCode && (
          <>
            <FormStatus message={codeMessage} />
            <CodeInput
              id={FIELD_IDS.code}
              label={ACCOUNT_PAGE.password.labels.code}
              value={code}
              onChange={setCode}
              error={fieldErrors.code}
            />
            <button type="button" className={formStyles.textButton} onClick={handleResendCode}>
              {ACCOUNT_PAGE.password.resendCode}
            </button>
          </>
        )}
        <FormAlert message={formError} />
        <Button type="submit" disabled={saving}>
          {saving ? ACCOUNT_PAGE.password.submitting : ACCOUNT_PAGE.password.submit}
        </Button>
      </form>
    </section>
  );
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(APP_CONFIG.language, { dateStyle: 'medium' }).format(
    new Date(isoDate),
  );
}

function TwoStepSection({ isAdmin }: { isAdmin: boolean }) {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  if (!loaded.ok) return <FormAlert message={PORTAL_ERRORS[loaded.error]} />;
  const authenticators = loaded.data;

  async function handleRemove(authenticator: Authenticator) {
    if (!window.confirm(ACCOUNT_PAGE.twoStep.confirmRemove(authenticator.name))) return;

    setError('');
    setRemovingId(authenticator.id);
    const result = await removeAuthenticator(authenticator.id, isAdmin);
    setRemovingId('');
    if (result.ok) await revalidator.revalidate();
    else setError(PORTAL_ERRORS[result.error]);
  }

  const isOn = authenticators.length > 0;
  const isLastAdminAuthenticator = isAdmin && authenticators.length === 1;

  return (
    <section className={styles.section}>
      <h2>{ACCOUNT_PAGE.twoStep.heading}</h2>
      <p>{isOn ? ACCOUNT_PAGE.twoStep.on : ACCOUNT_PAGE.twoStep.off}</p>
      {isAdmin && <p className={formStyles.hint}>{ACCOUNT_PAGE.twoStep.adminRequired}</p>}

      {isOn && (
        <ul className={styles.list}>
          {authenticators.map((authenticator) => (
            <li key={authenticator.id} className={styles.item}>
              <span>
                <strong>{authenticator.name}</strong>
                <span className={styles.muted}>
                  {ACCOUNT_PAGE.twoStep.added(formatDate(authenticator.addedAt))}
                </span>
              </span>
              <Button
                variant="secondary"
                onClick={() => handleRemove(authenticator)}
                disabled={isLastAdminAuthenticator || removingId === authenticator.id}
              >
                {removingId === authenticator.id
                  ? ACCOUNT_PAGE.twoStep.removing
                  : ACCOUNT_PAGE.twoStep.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {isLastAdminAuthenticator && (
        <p className={formStyles.hint}>{ACCOUNT_PAGE.twoStep.lastOne}</p>
      )}

      <FormAlert message={error} />

      {isAdmin &&
        (canAddAuthenticator(authenticators) ? (
          <>
            <p className={formStyles.hint}>{ACCOUNT_PAGE.twoStep.backupHint}</p>
            <Link to={PORTAL_ROUTES.twoStepSetup}>
              {isOn ? ACCOUNT_PAGE.twoStep.addBackup : ACCOUNT_PAGE.twoStep.setUp}
            </Link>
          </>
        ) : (
          <p className={formStyles.hint}>{ACCOUNT_PAGE.twoStep.maxReached}</p>
        ))}
    </section>
  );
}
