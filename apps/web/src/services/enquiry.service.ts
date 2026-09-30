// Enquiries from the "Register your interest" form.
//
// Components call `submitEnquiry()` and get back a simple result. They don't know
// (or care) where the enquiry goes:
//   Release 1: emailed to us through Web3Forms.
//   Release 2: saved in Supabase by an Edge Function, which then emails us (PRP R2).

import type { ContactFormValues } from '@/lib/validation';

import { buildEmailFields, buildEmailSubject } from './enquiry-email';
import type { SubmitResult } from './types';
import { sendToWeb3Forms } from './web3forms.client';

export async function submitEnquiry(
  values: ContactFormValues,
  captchaToken: string,
): Promise<SubmitResult> {
  return sendToWeb3Forms({
    subject: buildEmailSubject(values),
    replyTo: values.email.trim(),
    captchaToken,
    fields: buildEmailFields(values),
  });
}
