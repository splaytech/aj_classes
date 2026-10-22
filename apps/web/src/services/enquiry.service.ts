// Enquiries from the "Register your interest" form.
//
// Components call `submitEnquiry()` and get back a simple result. They don't know
// (or care) where the enquiry goes:
//   Emailed to us through Web3Forms (the parent's "Message sent" depends only on this), and,
//   when lead capture is on, also saved in Supabase and sent to Zoho CRM (leads-and-crm.md).

import { APP_CONFIG } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

import { buildEmailFields, buildEmailSubject } from './enquiry-email';
import { sendToLeads } from './leads.client';
import type { SubmitResult } from './types';
import { sendToWeb3Forms } from './web3forms.client';

export async function submitEnquiry(
  values: ContactFormValues,
  botcheck: boolean,
): Promise<SubmitResult> {
  // In the background, whatever happens to the email: a lead is never lost (PRP R2).
  if (APP_CONFIG.features.leadCapture) void sendToLeads(values, botcheck);

  return sendToWeb3Forms({
    subject: buildEmailSubject(values),
    replyTo: values.email.trim(),
    botcheck,
    fields: buildEmailFields(values),
  });
}
