// Invite a new staff member by e-mail (R2a story US1). They join as a tutor, with account_role
// 'tutor' in app_metadata (ADR-0011). Students and parents have their own actions. An unfinished
// website sign-up with that e-mail is replaced; any other account is refused (03 §6.2).
// Order (ADR-0010): create the account → email our 14-day link. If the email can't be sent, the
// account is removed again, so a failed invite never leaves an account behind (AC 21).

import type { Caller } from '../../_shared/auth.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { cleanEmail, cleanName, isValidEmail, isValidName } from '../../_shared/validation.ts';

import {
  audit,
  clearForInvite,
  createInvitedAccount,
  deleteAccount,
  findAccountByEmail,
  sendAccountInvite,
} from './accounts.ts';

export async function invite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  const email = cleanEmail(input.email);
  const fullName = cleanName(input.fullName);
  if (!isValidEmail(email)) return fail('invalid_email');
  if (!isValidName(fullName)) return fail('invalid_name');

  const cleared = await clearForInvite(await findAccountByEmail(email), 'already_exists');
  if ('code' in cleared) return fail(cleared.code);

  const created = await createInvitedAccount(email, fullName, 'tutor');
  if ('code' in created) return fail(created.code);

  if (!(await sendAccountInvite({ id: created.userId, email, role: 'tutor' }))) {
    await deleteAccount(created.userId);
    return fail('email_failed');
  }

  await audit(caller.id, 'invite_sent', created.userId, {
    email,
    ...(cleared.replaced ? { replaced_sign_up: true } : {}),
  });
  return succeed({ userId: created.userId });
}
