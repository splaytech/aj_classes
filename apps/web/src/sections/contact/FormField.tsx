// Wraps one form input with its label and error message, wired up for screen readers.

import type { ReactNode } from 'react';

import { CONTACT_FORM } from '@/constants';

import styles from './ContactForm.module.css';

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
};

export function errorIdFor(fieldId: string): string {
  return `${fieldId}-error`;
}

export function FormField({ id, label, error, optional = false, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> {CONTACT_FORM.optional}</span>}
      </label>
      {children}
      {error && (
        <p id={errorIdFor(id)} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
