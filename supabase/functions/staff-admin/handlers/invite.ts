// Invite a new staff member by e-mail (R2a story US1). They join as a tutor.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { cleanEmail, cleanName, isValidEmail, isValidName } from '../../_shared/validation.ts';

import { audit } from './staff.ts';

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

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }, // the profile trigger reads only full_name (R2a G2)
  });
  if (error || !data.user) return fail('email_failed');

  await audit(caller.id, 'invite_sent', data.user.id, { email });
  return succeed({ userId: data.user.id });
}
