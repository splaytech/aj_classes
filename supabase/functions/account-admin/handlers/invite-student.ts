// Invite a student to their own account (R3b story FA3). Consent must be recorded first (F4).
// Order: create the account → link it to the roster row → send the invite. Any failure undoes the
// account, so a half-finished invite never leaves an account behind.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { cleanEmail, isUuid, isValidEmail } from '../../_shared/validation.ts';

import {
  audit,
  createFamilyAccount,
  deleteAccount,
  findAccountByEmail,
  findStudent,
  sendInvite,
} from './accounts.ts';

export async function inviteStudent(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.studentId)) return fail('invalid_request');
  const email = cleanEmail(input.email);
  if (!isValidEmail(email)) return fail('invalid_email');

  const student = await findStudent(input.studentId);
  if (!student || !student.is_active) return fail('not_found');
  if (student.profile_id) return fail('already_has_account');
  if (!student.consent_recorded_at) return fail('consent_needed');
  if (await findAccountByEmail(email)) return fail('already_exists');

  const created = await createFamilyAccount(email, student.full_name, 'student');
  if ('code' in created) return fail(created.code);

  // Only links if nobody else linked an account a moment ago.
  const { data: linked, error } = await serviceClient()
    .from('students')
    .update({ profile_id: created.userId })
    .eq('id', student.id)
    .is('profile_id', null)
    .select('id');
  if (error || !linked?.length) {
    await deleteAccount(created.userId);
    return fail(error ? 'server_error' : 'already_has_account');
  }

  if (!(await sendInvite(email))) {
    await deleteAccount(created.userId);
    return fail('email_failed');
  }

  await audit(caller.id, 'student_invited', created.userId, {
    email,
    student_id: student.id,
    student_name: student.full_name,
  });
  return succeed({ userId: created.userId });
}
