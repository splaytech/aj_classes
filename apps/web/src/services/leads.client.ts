// Sends a website enquiry to the `leads` edge function, which saves it and passes it to Zoho
// Bigin (leads-and-crm.md §1). Plain fetch on purpose: public pages never load supabase-js (G23).
// Fire and forget: the parent's result comes from the email path, so this never throws.

import { APP_CONFIG } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

const SUBMIT_ACTION = 'submit';
const BOTCHECK_TICKED = 'ticked';

export async function sendToLeads(values: ContactFormValues, botcheck: boolean): Promise<void> {
  const { url, publishableKey, leadsFunctionPath } = APP_CONFIG.supabase;
  try {
    await fetch(`${url}${leadsFunctionPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify({
        action: SUBMIT_ACTION,
        name: values.name,
        email: values.email,
        phone: values.phone,
        message: values.message,
        wantsUpdates: values.updatesConsent,
        botcheck: botcheck ? BOTCHECK_TICKED : '',
      }),
    });
  } catch {
    // The email already reached us; admins can see the gap in Bigin. Nothing to tell the parent.
  }
}
