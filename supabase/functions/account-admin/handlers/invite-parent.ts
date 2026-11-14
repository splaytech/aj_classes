// Invite a parent from their child's page, or link a parent who already has an account
// (R3b story FA2, F26). An e-mail used by staff or a student is refused. A finished website
// sign-up is linked only after the admin confirms (needsConfirmation, then confirmUserId), and
// becomes a parent with no e-mail sent (open sign-up, 03 §6.3).

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
  clearForInvite,
  createInvitedAccount,
  deleteAccount,
  findAccountByEmail,
  findStudent,
  sendAccountInvite,
  signUpFacts,
  syncAccountRole,
} from './accounts.ts';
import type { AccountRecord, StudentRecord } from './accounts.ts';

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
  const confirmUserId = isUuid(input.confirmUserId) ? input.confirmUserId : null;
  if (input.confirmUserId != null && confirmUserId === null) return fail('invalid_request');
  // A retry after role_sync_failed finds them already a parent: the parent path below heals it.
  const alreadyPromoted = existing?.id === confirmUserId && existing?.role === 'parent';
  if (confirmUserId && !alreadyPromoted) {
    if (!existing || existing.id !== confirmUserId || !isFinishedUser(existing)) {
      return fail('promotion_changed');
    }
    return promote(existing, student, caller);
  }
  if (existing && isFinishedUser(existing)) {
    const facts = await signUpFacts(existing.id);
    if (!facts) return fail('server_error');
    return succeed({
      needsConfirmation: true,
      userId: existing.id,
      fullName: existing.full_name,
      ...facts,
    });
  }

  if (existing && existing.role !== 'user') {
    if (existing.role !== 'parent') return fail('already_exists');
    // Heals a promotion whose app_metadata step failed earlier (role_sync_failed).
    if (!(await syncAccountRole(existing.id, 'parent'))) return fail('server_error');
    const code = await link(student.id, existing.id);
    if (code) return fail(code);
    await audit(caller.id, 'parent_linked', existing.id, details(student));
    return succeed({ userId: existing.id, linked: true });
  }

  const fullName = cleanName(input.fullName);
  if (!isValidName(fullName)) return fail('invalid_name');

  // An unfinished website sign-up with this e-mail is replaced by the invite (03 §6.2).
  const cleared = await clearForInvite(existing, 'already_exists');
  if ('code' in cleared) return fail(cleared.code);

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

function isFinishedUser(account: AccountRecord): boolean {
  return account.role === 'user' && account.status === 'active' && account.is_active;
}

/**
 * The admin confirmed: the database makes them a parent and links the child, under the admin's
 * own two-step session, then their app_metadata role follows. Nothing is e-mailed.
 */
async function promote(
  account: AccountRecord,
  student: StudentRecord,
  caller: Caller,
): Promise<ActionResult> {
  const { error } = await caller.client.rpc('admin_promote_user', {
    target: account.id,
    target_student: student.id,
  });
  if (error) {
    if (error.message === 'not_a_signed_up_user') return fail('promotion_changed');
    if (error.message === 'not_found') return fail('not_found');
    if (error.message === 'not_admin') return fail('not_admin');
    return fail('server_error');
  }
  if (!(await syncAccountRole(account.id, 'parent'))) return fail('role_sync_failed');
  return succeed({ userId: account.id, linked: true, promoted: true });
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
