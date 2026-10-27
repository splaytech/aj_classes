// Form building blocks for the staff portal: a labelled field, password and code inputs,
// and the error / success messages. Inputs are wired to their errors for screen readers.

import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { AUTH_LIMITS, PORTAL_COMMON } from '@/constants';

import styles from './PortalForm.module.css';

export function errorIdFor(fieldId: string): string {
  return `${fieldId}-error`;
}

function hintIdFor(fieldId: string): string {
  return `${fieldId}-hint`;
}

/** Props that link an input to its hint and error message. */
function describedBy(id: string, error?: string, hint?: string) {
  const ids = [hint ? hintIdFor(id) : '', error ? errorIdFor(id) : ''].filter(Boolean);
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby': ids.length > 0 ? ids.join(' ') : undefined,
  };
}

type PortalFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function PortalField({ id, label, error, hint, children }: PortalFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={hintIdFor(id)} className={styles.hint}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorIdFor(id)} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel';
  /** Which on-screen keyboard phones show, e.g. the phone keypad. */
  inputMode?: 'tel';
  autoComplete?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
};

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  error,
  hint,
  maxLength,
}: TextInputProps) {
  return (
    <PortalField id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        className={styles.input}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        {...describedBy(id, error, hint)}
      />
    </PortalField>
  );
}

type TextAreaInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  error?: string;
  hint?: string;
  /** Shown under the box, e.g. "120 / 1000 characters". */
  counter?: string;
};

export function TextAreaInput({
  id,
  label,
  value,
  onChange,
  maxLength,
  rows = 6,
  error,
  hint,
  counter,
}: TextAreaInputProps) {
  return (
    <PortalField id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        className={styles.input}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...describedBy(id, error, hint)}
      />
      {counter && (
        <p className={styles.hint} aria-live="polite">
          {counter}
        </p>
      )}
    </PortalField>
  );
}

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "current-password" on sign-in, "new-password" when choosing one. */
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  hint?: string;
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <PortalField id={id} label={label} error={error} hint={hint}>
      <div className={styles.inputRow}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...describedBy(id, error, hint)}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-controls={id}
          aria-label={visible ? PORTAL_COMMON.hidePasswordLabel : PORTAL_COMMON.showPasswordLabel}
          onClick={() => setVisible(!visible)}
        >
          {visible ? PORTAL_COMMON.hide : PORTAL_COMMON.show}
        </button>
      </div>
    </PortalField>
  );
}

type CodeInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

/** A 6-digit code from an authenticator app or an email. Phones offer the number keypad. */
export function CodeInput({ id, label, value, onChange, error }: CodeInputProps) {
  return (
    <PortalField id={id} label={label} error={error}>
      <input
        id={id}
        className={`${styles.input} ${styles.code}`}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={AUTH_LIMITS.codeLength}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        {...describedBy(id, error)}
      />
    </PortalField>
  );
}

/** A problem with the whole form, e.g. "Email or password is incorrect." */
export function FormAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className={styles.alert} role="alert">
      {message}
    </p>
  );
}

/** Good news, e.g. "Password changed." */
export function FormStatus({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className={styles.status} role="status">
      {message}
    </p>
  );
}
