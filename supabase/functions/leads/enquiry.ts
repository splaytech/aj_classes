// Checks an enquiry from the website. Same limits as the form (apps/web/src/lib/validation.ts)
// and the enquiries table.

import { cleanEmail, cleanName, isValidEmail, isValidName } from '../_shared/validation.ts';

const PHONE_PATTERN = /^[\d\s()+-]{6,30}$/;
const MESSAGE_MAX = 2000;

export type Enquiry = {
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  wantsUpdates: boolean;
};

function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? null : text;
}

/** The cleaned enquiry, or null if anything is missing or out of range. */
export function readEnquiry(input: Record<string, unknown>): Enquiry | null {
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  const phone = optionalText(input.phone);
  const message = optionalText(input.message);

  if (!isValidName(name) || !isValidEmail(email)) return null;
  if (phone !== null && !PHONE_PATTERN.test(phone)) return null;
  if (message !== null && message.length > MESSAGE_MAX) return null;

  return { name, email, phone, message, wantsUpdates: input.wantsUpdates === true };
}
