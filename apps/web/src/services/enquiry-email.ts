// Formats an enquiry as a readable email for the owner's inbox (PRP F3.4).
// Used by the Release 1 Web3Forms path only; Release 2 sends structured data to Supabase instead.

import {
  CONTACT_FORM,
  CONTACT_METHOD_LABELS,
  ENQUIRER_ROLE_LABELS,
  ENQUIRY_TYPE_LABELS,
} from '@/constants';
import type { ContactMethod, EnquirerRole, EnquiryType } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

export function buildEmailSubject(values: ContactFormValues): string {
  const enquiryLabel = ENQUIRY_TYPE_LABELS[values.enquiryType as EnquiryType];
  return `${CONTACT_FORM.emailSubjectPrefix} ${enquiryLabel} — ${values.name.trim()}`;
}

export function buildEmailFields(values: ContactFormValues): Record<string, string> {
  const labels = CONTACT_FORM.labels;

  return {
    [labels.name]: values.name.trim(),
    [labels.email]: values.email.trim(),
    [labels.phone]: values.phone.trim(),
    [labels.contactMethod]: CONTACT_METHOD_LABELS[values.contactMethod as ContactMethod],
    [labels.role]: ENQUIRER_ROLE_LABELS[values.role as EnquirerRole],
    [labels.enquiryType]: ENQUIRY_TYPE_LABELS[values.enquiryType as EnquiryType],
    [labels.yearLevel]: values.yearLevel,
    [labels.message]: values.message.trim(),
    [labels.updatesConsent]: values.updatesConsent ? CONTACT_FORM.yes : CONTACT_FORM.no,
  };
}
