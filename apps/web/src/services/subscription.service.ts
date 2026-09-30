// Newsletter sign-ups from the footer "Stay in the loop" form.
//
//   Release 1: emailed to us through Web3Forms; we keep the list by hand.
//   Release 2: saved to a `subscribers` table in Supabase, with one-click unsubscribe.

import { SUBSCRIBE } from '@/constants';

import type { SubmitResult } from './types';
import { sendToWeb3Forms } from './web3forms.client';

export async function subscribe(email: string, captchaToken: string): Promise<SubmitResult> {
  const cleanEmail = email.trim();
  return sendToWeb3Forms({
    subject: SUBSCRIBE.emailSubject,
    replyTo: cleanEmail,
    captchaToken,
    fields: { [SUBSCRIBE.emailLabel]: cleanEmail },
  });
}
