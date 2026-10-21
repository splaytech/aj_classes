// Formats an enquiry as a readable email for the owner's inbox (PRP F3.4).
// Used by the Release 1 Web3Forms path only; Release 2 sends structured data to Supabase instead.

import { CONTACT_FORM } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

export function buildEmailSubject(values: ContactFormValues): string {
  return `${CONTACT_FORM.emailSubjectPrefix} ${CONTACT_FORM.emailSubject} — ${values.name.trim()}`;
}

export function buildEmailFields(values: ContactFormValues): Record<string, string> {
  const labels = CONTACT_FORM.labels;

  return {
    [labels.name]: values.name.trim(),
    [labels.email]: values.email.trim(),
    [labels.phone]: values.phone.trim(),
    [labels.message]: values.message.trim(),
    [labels.updatesConsent]: values.updatesConsent ? CONTACT_FORM.yes : CONTACT_FORM.no,
  };
}
