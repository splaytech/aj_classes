// Web3Forms client: the ONLY file that knows how to talk to the hosted form service.
// Web3Forms emails each submission to our inbox (Release 1). Replaced by Supabase in Release 2.

import { APP_CONFIG } from '@/constants';

import type { SubmitResult } from './types';

type Web3FormsMessage = {
  subject: string;
  replyTo: string; // the family's email, so pressing "Reply" in our inbox answers them
  captchaToken: string; // proof the hCaptcha "I am human" check was passed
  fields: Record<string, string>;
};

export async function sendToWeb3Forms(message: Web3FormsMessage): Promise<SubmitResult> {
  if (APP_CONFIG.form.accessKey === '') {
    return 'not-configured';
  }

  // Web3Forms reserved field names: https://docs.web3forms.com/getting-started/customizations
  const body = {
    access_key: APP_CONFIG.form.accessKey,
    subject: message.subject,
    from_name: APP_CONFIG.form.senderName,
    replyto: message.replyTo,
    'h-captcha-response': message.captchaToken,
    ...message.fields,
  };

  try {
    const response = await fetch(APP_CONFIG.form.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok ? 'success' : 'error';
  } catch {
    return 'error';
  }
}
