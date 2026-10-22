// The setup form after an invite link (invite-onboarding design). Only an invited account gets
// here (portal-access 'join'); until it's submitted, the account can't see anything else.
// Fields depend on the role the server reports: staff give a phone number, students their year
// level, everyone a name, a password and agreement to the terms.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  AuthCard,
  FormAlert,
  PasswordInput,
  PortalField,
  PortalUnavailable,
  TextInput,
} from '@/components/portal';
import { errorIdFor } from '@/components/portal/PortalField';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  JOIN_PAGE,
  LEGAL_LINKS,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PROFILE_LIMITS,
  YEAR_LEVEL_TEXT,
  YEAR_LEVELS,
} from '@/constants';
import {
  asksForPhone,
  asksForYearLevel,
  initialYearLevel,
  OTHER_YEAR_LEVEL,
  toOnboardingInput,
  validateOnboarding,
} from '@/lib/onboarding-validation';
import type { OnboardingErrors, OnboardingValues } from '@/lib/onboarding-validation';
import { guardPortalPage } from '@/lib/portal-guard';
import { buildPortalMeta } from '@/lib/seo';
import { completeOnboarding } from '@/services';
import type { OnboardingInfo } from '@/services';

const FIELD_IDS = {
  fullName: 'join-full-name',
  phone: 'join-phone',
  yearLevel: 'join-year-level',
  password: 'join-password',
  confirm: 'join-confirm-password',
  terms: 'join-terms',
} as const;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.join);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const page = await guardPortalPage(request, 'join');
  return { onboarding: page?.access.onboarding ?? null };
}

export default function JoinPage() {
  const { onboarding } = useLoaderData<typeof clientLoader>();
  if (!onboarding) return <PortalUnavailable />;

  return (
    <AuthCard heading={JOIN_PAGE.heading} intro={JOIN_PAGE.intro(onboarding.email)}>
      <JoinForm onboarding={onboarding} />
    </AuthCard>
  );
}

function JoinForm({ onboarding }: { onboarding: OnboardingInfo }) {
  const navigate = useNavigate();
  const { role } = onboarding;
  const [values, setValues] = useState<OnboardingValues>({
    fullName: onboarding.fullName,
    phone: '',
    yearLevel: initialYearLevel(onboarding.yearLevel),
    password: '',
    confirmation: '',
    acceptsTerms: false,
  });
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function update<K extends keyof OnboardingValues>(field: K, value: OnboardingValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validateOnboarding(values, role);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setFormError('');
    setSaving(true);
    const result = await completeOnboarding(toOnboardingInput(values, role));

    if (result.ok) {
      navigate(PORTAL_ROUTES.root, { replace: true });
      return;
    }
    setSaving(false);
    setFormError(PORTAL_ERRORS[result.error]);
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <TextInput
        id={FIELD_IDS.fullName}
        label={JOIN_PAGE.labels.fullName}
        autoComplete="name"
        maxLength={PROFILE_LIMITS.nameMax}
        value={values.fullName}
        onChange={(value) => update('fullName', value)}
        error={errors.fullName}
      />

      {asksForPhone(role) && (
        <PortalField
          id={FIELD_IDS.phone}
          label={JOIN_PAGE.labels.phone}
          hint={JOIN_PAGE.hints.phone}
          error={errors.phone}
        >
          <input
            id={FIELD_IDS.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={formStyles.input}
            value={values.phone}
            onChange={(event) => update('phone', event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? errorIdFor(FIELD_IDS.phone) : undefined}
          />
        </PortalField>
      )}

      {asksForYearLevel(role) && (
        <PortalField
          id={FIELD_IDS.yearLevel}
          label={JOIN_PAGE.labels.yearLevel}
          error={errors.yearLevel}
        >
          <select
            id={FIELD_IDS.yearLevel}
            className={formStyles.input}
            value={values.yearLevel}
            onChange={(event) => update('yearLevel', event.target.value)}
            aria-invalid={Boolean(errors.yearLevel)}
            aria-describedby={errors.yearLevel ? errorIdFor(FIELD_IDS.yearLevel) : undefined}
          >
            <option value="" disabled>
              {JOIN_PAGE.yearLevelPlaceholder}
            </option>
            {YEAR_LEVELS.map((year) => (
              <option key={year} value={String(year)}>
                {YEAR_LEVEL_TEXT.label(year)}
              </option>
            ))}
            <option value={OTHER_YEAR_LEVEL}>{YEAR_LEVEL_TEXT.other}</option>
          </select>
        </PortalField>
      )}

      <PasswordInput
        id={FIELD_IDS.password}
        label={JOIN_PAGE.labels.password}
        hint={JOIN_PAGE.hints.password}
        autoComplete="new-password"
        value={values.password}
        onChange={(value) => update('password', value)}
        error={errors.password}
      />
      <PasswordInput
        id={FIELD_IDS.confirm}
        label={JOIN_PAGE.labels.confirm}
        autoComplete="new-password"
        value={values.confirmation}
        onChange={(value) => update('confirmation', value)}
        error={errors.confirm}
      />

      <div className={formStyles.field}>
        <label className={formStyles.checkbox} htmlFor={FIELD_IDS.terms}>
          <input
            id={FIELD_IDS.terms}
            type="checkbox"
            checked={values.acceptsTerms}
            onChange={(event) => update('acceptsTerms', event.target.checked)}
            aria-invalid={Boolean(errors.terms)}
            aria-describedby={errors.terms ? errorIdFor(FIELD_IDS.terms) : undefined}
          />
          <span>
            {JOIN_PAGE.terms.before}
            <LegalLink href={LEGAL_LINKS.terms}>{JOIN_PAGE.terms.termsLink}</LegalLink>
            {JOIN_PAGE.terms.between}
            <LegalLink href={LEGAL_LINKS.privacy}>{JOIN_PAGE.terms.privacyLink}</LegalLink>
          </span>
        </label>
        {errors.terms && (
          <p id={errorIdFor(FIELD_IDS.terms)} className={formStyles.fieldError}>
            {errors.terms}
          </p>
        )}
      </div>

      <FormAlert message={formError} />
      <Button type="submit" disabled={saving}>
        {saving ? JOIN_PAGE.submitting : JOIN_PAGE.submit}
      </Button>
    </form>
  );
}

/** Opens in a new tab so the half-filled form isn't lost. Plain text until the page exists. */
function LegalLink({ href, children }: { href: string | null; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
