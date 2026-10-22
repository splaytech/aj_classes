// Kit (formerly ConvertKit) client: the ONLY file that knows how to talk to Kit.
//
// Sends an email address to our Kit form, the same way Kit's own embed code does.
// Kit then emails the person a confirmation link (double opt-in); they're only on the
// list after they click it.

import { APP_CONFIG } from '@/constants';

import type { SubmitResult } from './types';

/** The form's address, e.g. https://app.convertkit.com/forms/1234567/subscriptions */
function kitFormUrl(): string {
  return APP_CONFIG.newsletter.kitFormUrl.replace('{formId}', APP_CONFIG.newsletter.kitFormId);
}

export async function sendToKit(email: string): Promise<SubmitResult> {
  if (APP_CONFIG.newsletter.kitFormId === '') {
    return 'not-configured';
  }

  const formData = new FormData();
  formData.append('email_address', email);

  try {
    const response = await fetch(kitFormUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });
    return response.ok ? 'success' : 'error';
  } catch {
    return 'error';
  }
}
