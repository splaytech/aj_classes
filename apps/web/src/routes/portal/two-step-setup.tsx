// Link an authenticator app (stories US7, US9). Required for admins before any other page;
// also used to add a backup authenticator.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, CodeInput, FormAlert, TextInput } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  AUTH_ERRORS,
  AUTH_LIMITS,
  PORTAL_COMMON,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
  TWO_STEP_SETUP_PAGE,
} from '@/constants';
import { safeNextPath } from '@/lib/portal-access';
import { guardPortalPage } from '@/lib/portal-guard';
import { checkCode } from '@/lib/portal-validation';
import { buildPortalMeta } from '@/lib/seo';
import { signOut, startTwoStepSetup, verifyTwoStepCode } from '@/services';
import type { TwoStepEnrolment } from '@/services';

import styles from './two-step-setup.module.css';

const FIELD_IDS = { name: 'authenticator-name', code: 'authenticator-code' } as const;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.twoStepSetup);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const page = await guardPortalPage(request, 'twoStepSetup');
  return { isAddingBackup: Boolean(page?.access.hasVerifiedFactor) };
}

export default function TwoStepSetupPage() {
  const { isAddingBackup } = useLoaderData<typeof clientLoader>();
  const [enrolment, setEnrolment] = useState<TwoStepEnrolment | null>(null);

  return (
    <AuthCard heading={TWO_STEP_SETUP_PAGE.heading} intro={TWO_STEP_SETUP_PAGE.intro}>
      {enrolment ? <ConfirmStep enrolment={enrolment} /> : <NameStep onStarted={setEnrolment} />}
      <CancelSetup isAddingBackup={isAddingBackup} />
    </AuthCard>
  );
}

function NameStep({ onStarted }: { onStarted: (enrolment: TwoStepEnrolment) => void }) {
  const [name, setName] = useState<string>(TWO_STEP_SETUP_PAGE.defaultName);
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const [starting, setStarting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError(PORTAL_VALIDATION.nameRequired);
      return;
    }

    setNameError('');
    setFormError('');
    setStarting(true);
    const result = await startTwoStepSetup(name);
    setStarting(false);

    if (result.ok) onStarted(result.data);
    else setFormError(AUTH_ERRORS[result.error]);
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <TextInput
        id={FIELD_IDS.name}
        label={TWO_STEP_SETUP_PAGE.nameLabel}
        hint={TWO_STEP_SETUP_PAGE.nameHint}
        maxLength={AUTH_LIMITS.authenticatorNameMax}
        value={name}
        onChange={setName}
        error={nameError}
      />
      <FormAlert message={formError} />
      <Button type="submit" disabled={starting}>
        {starting ? TWO_STEP_SETUP_PAGE.starting : TWO_STEP_SETUP_PAGE.start}
      </Button>
    </form>
  );
}

function ConfirmStep({ enrolment }: { enrolment: TwoStepEnrolment }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = checkCode(code);
    setCodeError(error);
    if (error) return;

    setFormError('');
    setChecking(true);
    const result = await verifyTwoStepCode(enrolment.factorId, code);

    if (result.ok) {
      const next = safeNextPath(searchParams.get(PORTAL_QUERY.next));
      navigate(next ?? PORTAL_ROUTES.root, { replace: true });
      return;
    }
    setChecking(false);
    setCode('');
    setFormError(AUTH_ERRORS[result.error]);
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <p className={styles.step}>{TWO_STEP_SETUP_PAGE.scanStep}</p>
      <img
        className={styles.qr}
        src={enrolment.qrCodeSvg}
        alt={TWO_STEP_SETUP_PAGE.qrAlt}
        width={200}
        height={200}
      />
      <p className={formStyles.hint}>{TWO_STEP_SETUP_PAGE.secretStep}</p>
      <code className={styles.secret}>{enrolment.secret}</code>

      <p className={styles.step}>{TWO_STEP_SETUP_PAGE.codeStep}</p>
      <CodeInput
        id={FIELD_IDS.code}
        label={TWO_STEP_SETUP_PAGE.codeLabel}
        value={code}
        onChange={setCode}
        error={codeError}
      />
      <FormAlert message={formError} />
      <Button type="submit" disabled={checking}>
        {checking ? TWO_STEP_SETUP_PAGE.submitting : TWO_STEP_SETUP_PAGE.submit}
      </Button>
    </form>
  );
}

/** Adding a backup: back to the account page. First-time setup: two-step is required, so sign out. */
function CancelSetup({ isAddingBackup }: { isAddingBackup: boolean }) {
  const navigate = useNavigate();

  if (isAddingBackup) {
    return <Link to={PORTAL_ROUTES.account}>{TWO_STEP_SETUP_PAGE.cancel}</Link>;
  }

  async function handleSignOut() {
    await signOut();
    navigate(PORTAL_ROUTES.login, { replace: true });
  }

  return (
    <button type="button" className={formStyles.textButton} onClick={handleSignOut}>
      {PORTAL_COMMON.signOut}
    </button>
  );
}
