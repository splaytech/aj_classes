// "Register your interest" form (PRP F3). Validates, sends to the form service,
// and shows one of four states: idle, submitting, success or error.

import type HCaptcha from '@hcaptcha/react-hcaptcha';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Button, CaptchaField } from '@/components/ui';
import {
  ANALYTICS_EVENTS,
  CONTACT_FORM,
  CONTACT_METHOD_LABELS,
  CONTACT_METHODS,
  ELEMENT_IDS,
  ENQUIRER_ROLE_LABELS,
  ENQUIRER_ROLES,
  ENQUIRY_TYPE_LABELS,
  ENQUIRY_TYPES,
  FORM_ERRORS,
  FORM_LIMITS,
  ROUTES,
  SECTION_IDS,
  VALIDATION,
  YEAR_LEVELS,
} from '@/constants';
import type { ContactMethod } from '@/constants';
import { trackEvent } from '@/lib/analytics';
import { hasErrors, validateContactForm } from '@/lib/validation';
import { submitEnquiry } from '@/services';
import type { ContactFormErrors, ContactFormValues } from '@/lib/validation';

import { errorIdFor, FormField } from './FormField';
import styles from './ContactForm.module.css';

type Status = 'idle' | 'submitting' | 'success';

const INITIAL_VALUES: ContactFormValues = {
  name: '',
  email: '',
  phone: '',
  contactMethod: '',
  role: 'parent',
  enquiryType: 'registerInterest',
  yearLevel: '',
  message: '',
  updatesConsent: false,
};

/** Gives each field a unique id, e.g. "contact-email". */
function fieldId(field: keyof ContactFormValues): string {
  return `${ELEMENT_IDS.contactFieldPrefix}${field}`;
}

/** Props that connect an input to its error message for screen readers. */
function errorProps(field: keyof ContactFormValues, errors: ContactFormErrors) {
  const hasError = Boolean(errors[field]);
  return {
    'aria-invalid': hasError,
    'aria-describedby': hasError ? errorIdFor(fieldId(field)) : undefined,
  };
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const captchaRef = useRef<HCaptcha>(null);

  usePreselectFromLink(setValues);

  function handleCaptchaChange(token: string) {
    setCaptchaToken(token);
    if (token) setCaptchaError('');
  }

  /** A captcha token works only once, so ask for a fresh check after a failed send. */
  function resetCaptcha() {
    setCaptchaToken('');
    captchaRef.current?.resetCaptcha();
  }

  function updateValue(field: keyof ContactFormValues, value: string | boolean) {
    setValues({ ...values, [field]: value });
  }

  function handleTextChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    updateValue(event.target.name as keyof ContactFormValues, event.target.value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const foundErrors = validateContactForm(values);
    setErrors(foundErrors);
    if (hasErrors(foundErrors)) {
      focusFirstError(foundErrors);
      return;
    }

    if (!captchaToken) {
      setCaptchaError(VALIDATION.captchaRequired);
      return;
    }

    setStatus('submitting');
    setSubmitError('');
    const result = await submitEnquiry(values, captchaToken);

    if (result === 'success') {
      setStatus('success');
      trackEvent(ANALYTICS_EVENTS.formSubmitSuccess, { enquiry_type: values.enquiryType });
      return;
    }

    setStatus('idle');
    setSubmitError(result === 'not-configured' ? FORM_ERRORS.notConfigured : FORM_ERRORS.network);
    resetCaptcha();
    trackEvent(ANALYTICS_EVENTS.formSubmitError);
  }

  if (status === 'success') {
    return (
      <p className={styles.success} role="status">
        {CONTACT_FORM.success(values.contactMethod as ContactMethod)}
      </p>
    );
  }

  return (
    <form id={SECTION_IDS.askQuestion} className={styles.form} onSubmit={handleSubmit} noValidate>
      <FormField id={fieldId('name')} label={CONTACT_FORM.labels.name} error={errors.name}>
        <input
          id={fieldId('name')}
          name="name"
          className={styles.input}
          autoComplete="name"
          value={values.name}
          onChange={handleTextChange}
          {...errorProps('name', errors)}
        />
      </FormField>

      <FormField id={fieldId('email')} label={CONTACT_FORM.labels.email} error={errors.email}>
        <input
          id={fieldId('email')}
          name="email"
          type="email"
          className={styles.input}
          autoComplete="email"
          value={values.email}
          onChange={handleTextChange}
          {...errorProps('email', errors)}
        />
      </FormField>

      <fieldset className={styles.fieldset} {...errorProps('contactMethod', errors)}>
        <legend className={styles.label}>{CONTACT_FORM.labels.contactMethod}</legend>
        <div className={styles.radioRow}>
          {CONTACT_METHODS.map((method, index) => (
            <label key={method} className={styles.radio}>
              <input
                id={index === 0 ? fieldId('contactMethod') : undefined}
                type="radio"
                name="contactMethod"
                value={method}
                checked={values.contactMethod === method}
                onChange={handleTextChange}
              />
              {CONTACT_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
        {errors.contactMethod && (
          <p id={errorIdFor(fieldId('contactMethod'))} className={styles.error}>
            {errors.contactMethod}
          </p>
        )}
      </fieldset>

      <FormField
        id={fieldId('phone')}
        label={CONTACT_FORM.labels.phone}
        error={errors.phone}
        optional={values.contactMethod !== 'phone'}
      >
        <input
          id={fieldId('phone')}
          name="phone"
          type="tel"
          className={styles.input}
          autoComplete="tel"
          value={values.phone}
          onChange={handleTextChange}
          {...errorProps('phone', errors)}
        />
      </FormField>

      <div className={styles.twoColumns}>
        <FormField id={fieldId('role')} label={CONTACT_FORM.labels.role}>
          <select
            id={fieldId('role')}
            name="role"
            className={styles.input}
            value={values.role}
            onChange={handleTextChange}
          >
            {ENQUIRER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ENQUIRER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id={fieldId('enquiryType')} label={CONTACT_FORM.labels.enquiryType}>
          <select
            id={fieldId('enquiryType')}
            name="enquiryType"
            className={styles.input}
            value={values.enquiryType}
            onChange={handleTextChange}
          >
            {ENQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENQUIRY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id={fieldId('yearLevel')} label={CONTACT_FORM.labels.yearLevel} optional>
        <select
          id={fieldId('yearLevel')}
          name="yearLevel"
          className={styles.input}
          value={values.yearLevel}
          onChange={handleTextChange}
        >
          <option value="">{CONTACT_FORM.yearLevelPlaceholder}</option>
          {YEAR_LEVELS.map((year) => (
            <option key={year} value={`${CONTACT_FORM.yearLevelPrefix} ${year}`}>
              {CONTACT_FORM.yearLevelPrefix} {year}
            </option>
          ))}
          <option value={CONTACT_FORM.yearLevelOther}>{CONTACT_FORM.yearLevelOther}</option>
        </select>
      </FormField>

      <FormField
        id={fieldId('message')}
        label={CONTACT_FORM.labels.message}
        error={errors.message}
        optional={values.enquiryType === 'registerInterest'}
      >
        <textarea
          id={fieldId('message')}
          name="message"
          className={styles.input}
          rows={5}
          maxLength={FORM_LIMITS.messageMax}
          value={values.message}
          onChange={handleTextChange}
          {...errorProps('message', errors)}
        />
      </FormField>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={values.updatesConsent}
          onChange={(event) => updateValue('updatesConsent', event.target.checked)}
        />
        {CONTACT_FORM.labels.updatesConsent}
      </label>

      <p className={styles.privacy}>
        {CONTACT_FORM.privacyNoticeBefore}
        {CONTACT_FORM.space}
        <a href={ROUTES.privacy}>{CONTACT_FORM.privacyLinkText}</a>
        {CONTACT_FORM.privacyNoticeAfter}
      </p>

      <CaptchaField
        captchaRef={captchaRef}
        onTokenChange={handleCaptchaChange}
        error={captchaError}
      />

      {submitError && (
        <p className={styles.error} role="alert">
          {submitError}
        </p>
      )}

      <Button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? CONTACT_FORM.submitting : CONTACT_FORM.submit}
      </Button>
    </form>
  );
}

/** Moves keyboard focus to the first field with an error (PRP F3.2). */
function focusFirstError(errors: ContactFormErrors) {
  const firstField = Object.keys(errors)[0] as keyof ContactFormValues | undefined;
  if (!firstField) return;
  document.getElementById(fieldId(firstField))?.focus();
}

/**
 * "Ask a Question" links point at #ask-a-question. When the page arrives with that
 * hash, preselect "General question" so the family doesn't have to (PRP F2.2).
 */
function usePreselectFromLink(
  setValues: (update: (current: ContactFormValues) => ContactFormValues) => void,
) {
  useEffect(() => {
    function applyHash() {
      if (window.location.hash === `#${SECTION_IDS.askQuestion}`) {
        setValues((current) => ({ ...current, enquiryType: 'generalQuestion' }));
      }
    }

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [setValues]);
}
