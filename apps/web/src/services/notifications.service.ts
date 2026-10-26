// Email notifications (ADR-0004, ADR-0008): a student's or parent's own switches in Account →
// Notifications, and the admin list of portal emails that failed or are still waiting. The
// database checks it's an active student or parent changing their own row, and an admin with
// two-step.

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { EmailProblem, NotificationSettings, Result } from './types';

// No row means every email is on.
const DEFAULT_SETTINGS: NotificationSettings = {
  workReturned: true,
  newAssignment: true,
  dueTomorrow: true,
};

type EmailProblemRow = {
  id: string;
  created_at: string;
  kind: EmailProblem['kind'];
  recipient_role: EmailProblem['recipientRole'];
  assignment_title: string;
  state: EmailProblem['state'];
  reason: EmailProblem['reason'];
};

async function myProfileId(): Promise<string | undefined> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export async function getMyNotificationSettings(): Promise<Result<NotificationSettings>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const myId = await myProfileId();
    if (!myId) return fail('notAllowed');

    const { data, error } = await supabase
      .from('notification_settings')
      .select('work_returned, new_assignment, due_tomorrow')
      .eq('profile_id', myId)
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    if (!data) return succeed(DEFAULT_SETTINGS);
    return succeed({
      workReturned: data.work_returned,
      newAssignment: data.new_assignment,
      dueTomorrow: data.due_tomorrow,
    });
  });
}

/**
 * Update, then insert the first time, as saveResult does. Not an upsert: PostgREST's
 * ON CONFLICT DO UPDATE sets every column it was sent, and profile_id has no update grant
 * (review-3 finding 2).
 */
export async function saveMyNotificationSettings(settings: NotificationSettings): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const myId = await myProfileId();
    if (!myId) return fail('notAllowed');
    const columns = {
      work_returned: settings.workReturned,
      new_assignment: settings.newAssignment,
      due_tomorrow: settings.dueTomorrow,
    };

    const updated = await supabase
      .from('notification_settings')
      .update(columns)
      .eq('profile_id', myId)
      .select('profile_id')
      .maybeSingle();
    if (updated.error) return fail(toErrorKey(updated.error));
    if (updated.data) return succeed();

    const inserted = await supabase
      .from('notification_settings')
      .insert({ profile_id: myId, ...columns })
      .select('profile_id')
      .maybeSingle();
    if (inserted.error) return fail(toErrorKey(inserted.error));
    return inserted.data ? succeed() : fail('notSaved');
  });
}

export async function listEmailProblems(maxRows = 100): Promise<Result<EmailProblem[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('admin_email_problems', { max_rows: maxRows });
    if (error) return fail(toErrorKey(error));
    return succeed(
      ((data ?? []) as EmailProblemRow[]).map((row) => ({
        id: row.id,
        at: row.created_at,
        kind: row.kind,
        recipientRole: row.recipient_role,
        assignmentTitle: row.assignment_title,
        state: row.state,
        reason: row.reason,
      })),
    );
  });
}
