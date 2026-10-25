// Your account (stories US6, US9; R3b FS4): change password, appearance, your choices (parents'
// optional permissions), email notifications (students and parents; ADR-0004) and two-step
// sign-in for staff.

import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLoaderData, useLocation, useRevalidator } from 'react-router';

import {
  CodeInput,
  ConsentChoices,
  FormAlert,
  FormStatus,
  PasswordInput,
} from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  ACCOUNT_PAGE,
  APP_CONFIG,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  ROLE_LABELS,
  THEME_MODES,
} from '@/constants';
import type { ThemeMode } from '@/constants';
import { NO_CONSENTS, asksForConsents } from '@/lib/consents';
import { isStaffRole } from '@/lib/portal-access';
import { checkCode, checkNewPassword, checkPasswordsMatch } from '@/lib/portal-validation';
import { useAppearance } from '@/lib/appearance-context';
import { buildPortalMeta } from '@/lib/seo';
import {
  canAddAuthenticator,
  changePassword,
  getMyConsents,
  getMyNotificationSettings,
  listAuthenticators,
  removeAuthenticator,
  saveMyNotificationSettings,
  sendReauthCode,
  setMyConsents,
} from '@/services';
import type { Authenticator, Consents, NotificationSettings } from '@/services';

import { usePortalAccess } from './member-layout';
import styles from './account.module.css';

const FIELD_IDS = {
  code: 'reauth-code',
  password: 'change-password',
  confirm: 'change-confirm',
  appearance: 'appearance-heading',
  consents: 'account-consent',
  notificationsHeading: 'notifications-heading',
  workReturned: 'notify-work-returned',
};

export function meta() {
  return buildPortalMeta(PORTAL_SEO.account);
}

// Access is checked by the member layout. Loads the authenticator list (staff), the optional
// permissions (parents; invite-onboarding.md, "Consents") and the email switches (students and
// parents; a staff member just gets the default, never shown).
export async function clientLoader() {
  const [authenticators, consents, notifications] = await Promise.all([
    listAuthenticators(),
    getMyConsents(),
    getMyNotificationSettings(),
  ]);
  return { authenticators, consents, notifications };
}

export default function AccountPage() {
  const access = usePortalAccess();
  const role = access.profile?.role ?? 'tutor';

  return (
    <div className={styles.page}>
      <h1>{ACCOUNT_PAGE.heading}</h1>
      <dl className={styles.facts}>
        <dt>{ACCOUNT_PAGE.signedInAs}</dt>
        <dd>{access.email}</dd>
        <dt>{ACCOUNT_PAGE.role}</dt>
        <dd>{ROLE_LABELS[role]}</dd>
      </dl>
      <ChangePasswordSection />
      <AppearanceSection />
      {asksForConsents(role) && <ChoicesSection />}
      {!isStaffRole(role) && <NotificationsSection />}
      {isStaffRole(role) && <TwoStepSection isAdmin={role === 'admin'} />}
    </div>
  );
}

/** System / Light / Dark, remembered on this device (R3b story FS4). */
function AppearanceSection() {
  const { mode, setMode } = useAppearance();

  return (
    <section className={styles.section} aria-labelledby={FIELD_IDS.appearance}>
      <h2 id={FIELD_IDS.appearance}>{ACCOUNT_PAGE.appearance.heading}</h2>
      <p className={formStyles.hint}>{ACCOUNT_PAGE.appearance.intro}</p>
      <RadioGroup
        aria-labelledby={FIELD_IDS.appearance}
        value={mode}
        onChange={(event) => setMode(event.target.value as ThemeMode)}
      >
        {THEME_MODES.map((option) => (
          <FormControlLabel
            key={option}
            value={option}
            control={<Radio />}
            label={ACCOUNT_PAGE.appearance.options[option]}
          />
        ))}
      </RadioGroup>
    </section>
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

/** A parent's optional permissions: change them at any time (invite-onboarding.md, "Consents"). */
function ChoicesSection() {
  const loaded = useLoaderData<typeof clientLoader>().consents;
  const [values, setValues] = useState<Consents>(loaded.ok ? loaded.data : NO_CONSENTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  if (!loaded.ok) return <FormAlert message={PORTAL_ERRORS[loaded.error]} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const result = await setMyConsents(values);
    setSaving(false);
    if (result.ok) setSaved(true);
    else setError(PORTAL_ERRORS[result.error]);
  }

  return (
    <section className={styles.section}>
      <h2>{ACCOUNT_PAGE.choices.heading}</h2>
      <p>{ACCOUNT_PAGE.choices.intro}</p>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <ConsentChoices
          idPrefix={FIELD_IDS.consents}
          values={values}
          disabled={saving}
          onChange={(kind, agreed) => {
            setSaved(false);
            setValues((current) => ({ ...current, [kind]: agreed }));
          }}
        />
        <FormAlert message={error} />
        {saved && <FormStatus message={ACCOUNT_PAGE.choices.saved} />}
        <Button type="submit" disabled={saving}>
          {saving ? ACCOUNT_PAGE.choices.saving : ACCOUNT_PAGE.choices.save}
        </Button>
      </form>
    </section>
  );
}

/** The "work returned" email switch (AC-3.6). On by default; every email links here. */
function NotificationsSection() {
  const loaded = useLoaderData<typeof clientLoader>().notifications;
  const [values, setValues] = useState<NotificationSettings>(
    loaded.ok ? loaded.data : { workReturned: true },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const words = ACCOUNT_PAGE.notifications;
  const { hash } = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  // Every email links to #notifications. The section only exists once the loader has run, after
  // the browser's own jump to the anchor, so scroll to it here.
  useEffect(() => {
    if (hash === `#${words.id}`) sectionRef.current?.scrollIntoView();
  }, [hash, words.id]);

  if (!loaded.ok) return <FormAlert message={PORTAL_ERRORS[loaded.error]} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const result = await saveMyNotificationSettings(values);
    setSaving(false);
    if (result.ok) setSaved(true);
    else setError(PORTAL_ERRORS[result.error]);
  }

  return (
    <section
      ref={sectionRef}
      id={words.id}
      className={styles.section}
      aria-labelledby={FIELD_IDS.notificationsHeading}
    >
      <h2 id={FIELD_IDS.notificationsHeading}>{words.heading}</h2>
      <p className={formStyles.hint}>{words.intro}</p>
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <FormControlLabel
          control={
            <Switch
              id={FIELD_IDS.workReturned}
              checked={values.workReturned}
              disabled={saving}
              onChange={(event) => {
                setSaved(false);
                setValues({ workReturned: event.target.checked });
              }}
            />
          }
          label={words.workReturned}
        />
        <FormAlert message={error} />
        {saved && <FormStatus message={words.saved} />}
        <Button type="submit" disabled={saving}>
          {saving ? words.saving : words.save}
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
  const loaded = useLoaderData<typeof clientLoader>().authenticators;
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
