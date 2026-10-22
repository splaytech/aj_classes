// Newsletter sign-ups from the footer "Stay in the loop" form.
//
// Sign-ups go to Kit, which emails a confirmation link (double opt-in), sends our weekly
// updates and handles unsubscribes. Components only call `subscribe(email)`.

import type { SubmitResult } from './types';
import { sendToKit } from './kit.client';

export async function subscribe(email: string): Promise<SubmitResult> {
  return sendToKit(email.trim());
}
