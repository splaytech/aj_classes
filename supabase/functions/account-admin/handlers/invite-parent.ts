// Invite a parent from their child's page, or link a parent who already has an account
// (R3b story FA2, F26). An e-mail used by staff or a student is refused.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import {
  cleanEmail,
  cleanName,
  isUuid,
  isValidEmail,
  isValidName,
} from '../../_shared/validation.ts';

import {
  audit,
  createInvitedAccount,
  deleteAccount,
  findAccountByEmail,
  findStudent,
  sendAccountInvite,
} from './accounts.ts';
import type { StudentRecord } from './accounts.ts';

const DUPLICATE_KEY = '23505';

export async function inviteParent(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.studentId)) return fail('invalid_request');
  const email = cleanEmail(input.email);
  if (!isValidEmail(email)) return fail('invalid_email');

  const student = await findStudent(input.studentId);
  if (!student || !student.is_active) return fail('not_found');

  const existing = await findAccountByEmail(email);
  if (existing) {
    if (existing.role !== 'parent') return fail('already_exists');
    const code = await link(student.id, existing.id);
    if (code) return fail(code);
    await audit(caller.id, 'parent_linked', existing.id, details(student));
    return succeed({ userId: existing.id, linked: true });
  }

  const fullName = cleanName(input.fullName);
  if (!isValidName(fullName)) return fail('invalid_name');

  const created = await createInvitedAccount(email, fullName, 'parent');
  if ('code' in created) return fail(created.code);

  const code = await link(student.id, created.userId);
  if (code) {
    await deleteAccount(created.userId);
    return fail(code);
  }
  if (!(await sendAccountInvite({ id: created.userId, email, role: 'parent' }))) {
    await deleteAccount(created.userId);
    return fail('email_failed');
  }

  await audit(caller.id, 'parent_invited', created.userId, { email, ...details(student) });
  return succeed({ userId: created.userId, linked: false });
}

/** Links the parent to the student. Returns an error code, or null when linked. */
async function link(studentId: string, parentId: string): Promise<string | null> {
  const { error } = await serviceClient()
    .from('student_guardians')
    .insert({ student_id: studentId, parent_id: parentId });
  if (!error) return null;
  return error.code === DUPLICATE_KEY ? 'already_linked' : 'server_error';
}

function details(student: StudentRecord): Record<string, unknown> {
  return { student_id: student.id, student_name: student.full_name };
}
