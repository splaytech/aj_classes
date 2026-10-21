// "Register your interest" form (PRP F3). Kept as short as possible so anyone can send a query:
// name and email, plus an optional phone number and message. Validates, sends to the form
// service, and shows one of three states: idle, submitting or success (errors show inline).

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Button } from '@/components/ui';
import {
  ANALYTICS_EVENTS,
  CONTACT_FORM,
  ELEMENT_IDS,
  FORM_ERRORS,
  FORM_LIMITS,
  ROUTES,
  SECTION_IDS,
} from '@/constants';
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
  // Spam trap (Web3Forms "botcheck"): hidden from people, so only bots tick it.
  const [botcheck, setBotcheck] = useState(false);

  function updateValue(field: keyof ContactFormValues, value: string | boolean) {
    setValues({ ...values, [field]: value });
  }

  function handleTextChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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

    setStatus('submitting');
    setSubmitError('');
    const result = await submitEnquiry(values, botcheck);

    if (result === 'success') {
      setStatus('success');
      trackEvent(ANALYTICS_EVENTS.formSubmitSuccess);
      return;
    }

    setStatus('idle');
    setSubmitError(result === 'not-configured' ? FORM_ERRORS.notConfigured : FORM_ERRORS.network);
    trackEvent(ANALYTICS_EVENTS.formSubmitError);
  }

  if (status === 'success') {
    return (
      <div className={styles.success} role="status">
        <p className={styles.successHeading}>{CONTACT_FORM.successHeading}</p>
        <p>{CONTACT_FORM.success}</p>
      </div>
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

      <div className={styles.twoColumns}>
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

        <FormField
          id={fieldId('phone')}
          label={CONTACT_FORM.labels.phone}
          error={errors.phone}
          optional
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
      </div>

      <FormField
        id={fieldId('message')}
        label={CONTACT_FORM.labels.message}
        error={errors.message}
        optional
      >
        <textarea
          id={fieldId('message')}
          name="message"
          className={styles.input}
          rows={4}
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

      <input
        type="checkbox"
        name="botcheck"
        className={styles.trap}
        checked={botcheck}
        onChange={(event) => setBotcheck(event.target.checked)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
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
