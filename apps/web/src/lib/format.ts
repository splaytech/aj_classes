// Dates and times shown in the staff portal, in Australian English.

import { APP_CONFIG } from '@/constants';

const DATE = new Intl.DateTimeFormat(APP_CONFIG.language, { dateStyle: 'medium' });
const DATE_TIME = new Intl.DateTimeFormat(APP_CONFIG.language, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "8 Oct 2026" from an ISO date or timestamp. Empty for null. */
export function formatDate(value: string | null): string {
  if (!value) return '';
  // A plain date ("2026-10-08") is read as local midnight, not UTC, so it never shifts a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return DATE.format(date);
}

/** "8 Oct 2026, 4:05 pm" from an ISO timestamp. Empty for null. */
export function formatDateTime(value: string | null): string {
  return value ? DATE_TIME.format(new Date(value)) : '';
}
