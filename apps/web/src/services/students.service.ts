// Student roster for admins (R3a stories AS3–AS4). Name and year level only (review H10).

import { toErrorKey } from './auth-errors';
import { toStudentSummary } from './classes.service';
import type { StudentRow } from './classes.service';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Result, RosterStudent, StudentInput } from './types';

type RosterRow = StudentRow & {
  enrolments: { class: { id: string; name: string } | null }[];
};

export async function listStudents(includeArchived: boolean): Promise<Result<RosterStudent[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    let query = supabase
      .from('students')
      .select('id, full_name, year_level, is_active, enrolments(class:classes(id, name))')
      .order('full_name');
    if (!includeArchived) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return fail(toErrorKey(error));

    return succeed(
      (data as unknown as RosterRow[]).map((row) => ({
        ...toStudentSummary(row),
        classes: row.enrolments
          .map((enrolment) => enrolment.class)
          .filter((item): item is { id: string; name: string } => item !== null),
      })),
    );
  });
}

/** Adds or updates a student. Returns their id. */
export async function saveStudent(input: StudentInput): Promise<Result<string>> {
  const columns = { full_name: input.fullName.trim(), year_level: input.yearLevel };

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = input.id
      ? await supabase
          .from('students')
          .update(columns)
          .eq('id', input.id)
          .select('id')
          .maybeSingle()
      : await supabase.from('students').insert(columns).select('id').maybeSingle();

    if (error) return fail(toErrorKey(error));
    return data ? succeed(data.id) : fail('notAllowed');
  });
}

/** Archive (false) or restore (true) a student. */
export async function setStudentActive(studentId: string, active: boolean): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('students')
      .update({ is_active: active })
      .eq('id', studentId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}
