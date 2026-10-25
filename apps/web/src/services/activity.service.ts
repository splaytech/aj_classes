// The activity (audit) list for admins: who changed staff access, and when (R2a story US19).

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getAdminClient } from './staff-client';
import type { ActivityAction, ActivityEntry, Result } from './types';

type ActivityRow = {
  id: number;
  created_at: string;
  action: ActivityAction;
  actor_name: string;
  target_name: string;
  details: Record<string, unknown> | null;
};

export async function listActivity(maxRows = 100): Promise<Result<ActivityEntry[]>> {
  return attempt(async () => {
    const supabase = await getAdminClient();
    if (!supabase) return fail('notAllowed'); // not an admin with two-step: the layout shows the right page
    const { data, error } = await supabase.rpc('admin_list_activity', { max_rows: maxRows });
    if (error) return fail(toErrorKey(error));

    return succeed(
      (data as ActivityRow[]).map((row) => ({
        id: row.id,
        at: row.created_at,
        action: row.action,
        actorName: row.actor_name,
        targetName: row.target_name,
        details: row.details ?? {},
      })),
    );
  });
}
