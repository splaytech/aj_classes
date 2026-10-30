// Invite a new staff member by e-mail (R2a story US1). They join as a tutor: no account_role in
// app_metadata (R3b D2). Students and parents have their own actions.
// Order (ADR-0010): create the account → email our 14-day link. If the email can't be sent, the
// account is removed again, so a failed invite never leaves an account behind (AC 21).

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { cleanEmail, cleanName, isValidEmail, isValidName } from '../../_shared/validation.ts';

import { audit, createInvitedAccount, deleteAccount, sendAccountInvite } from './accounts.ts';

export async function invite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  const email = cleanEmail(input.email);
  const fullName = cleanName(input.fullName);
  if (!isValidEmail(email)) return fail('invalid_email');
  if (!isValidName(fullName)) return fail('invalid_name');

  const service = serviceClient();
  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) return fail('already_exists');

  const created = await createInvitedAccount(email, fullName, 'tutor');
  if ('code' in created) return fail(created.code);

  if (!(await sendAccountInvite({ id: created.userId, email, role: 'tutor' }))) {
    await deleteAccount(created.userId);
    return fail('email_failed');
  }

  await audit(caller.id, 'invite_sent', created.userId, { email });
  return succeed({ userId: created.userId });
}
