// Classes, weekly timetable slots and enrolments (R3a stories TS1–TS2, AS1–AS5).
// The database decides who sees and changes what: tutors see their own active classes;
// admins see and manage everything (R3a design §4).

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type {
  ClassDetail,
  ClassInput,
  ClassSession,
  ClassSummary,
  DayOfWeek,
  Delivery,
  Result,
  SessionInput,
  StudentSummary,
  TimetableEntry,
} from './types';

const CLASS_COLUMNS = `
  id, name, subject, year_levels, delivery, location, tutor_id, starts_on, ends_on, is_active,
  tutor:profiles(full_name, is_active),
  class_sessions(id, class_id, day_of_week, start_time, end_time),
  enrolments(count)
`;

type SessionRow = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ClassRow = {
  id: string;
  name: string;
  subject: string;
  year_levels: number[];
  delivery: string;
  location: string;
  tutor_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  tutor: { full_name: string; is_active: boolean } | null;
  class_sessions: SessionRow[];
  enrolments: { count: number }[];
};

function toSession(row: SessionRow): ClassSession {
  return {
    id: row.id,
    classId: row.class_id,
    dayOfWeek: row.day_of_week as DayOfWeek,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

function toClassSummary(row: ClassRow): ClassSummary {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    yearLevels: row.year_levels,
    delivery: row.delivery as Delivery,
    location: row.location,
    tutorId: row.tutor_id,
    tutorName: row.tutor?.full_name ?? '',
    tutorIsActive: row.tutor?.is_active ?? false,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isActive: row.is_active,
    sessions: row.class_sessions.map(toSession),
    studentCount: row.enrolments[0]?.count ?? 0,
  };
}

export async function listClasses(includeArchived: boolean): Promise<Result<ClassSummary[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    let query = supabase.from('classes').select(CLASS_COLUMNS).order('name');
    if (!includeArchived) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as ClassRow[]).map(toClassSummary));
  });
}

export async function getClass(classId: string): Promise<Result<ClassDetail>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const [classResult, studentsResult] = await Promise.all([
      supabase.from('classes').select(CLASS_COLUMNS).eq('id', classId).maybeSingle(),
      supabase
        .from('enrolments')
        .select('student:students(id, full_name, year_level, is_active)')
        .eq('class_id', classId),
    ]);

    if (classResult.error) return fail(toErrorKey(classResult.error));
    if (!classResult.data) return fail('notFound');
    if (studentsResult.error) return fail(toErrorKey(studentsResult.error));

    const students = (studentsResult.data as unknown as { student: StudentRow | null }[])
      .map((row) => row.student)
      .filter((student): student is StudentRow => student !== null)
      .map(toStudentSummary)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return succeed({ ...toClassSummary(classResult.data as unknown as ClassRow), students });
  });
}

/** Ascending with no repeats: the only form the database accepts (DEC-HM-1). */
export function sortedYears(years: readonly number[]): number[] {
  return [...new Set(years)].sort((a, b) => a - b);
}

/** Creates or updates a class (admins). Returns its id. */
export async function saveClass(input: ClassInput): Promise<Result<string>> {
  const columns = {
    name: input.name.trim(),
    subject: input.subject,
    year_levels: sortedYears(input.yearLevels),
    delivery: input.delivery,
    location: input.location.trim(),
    tutor_id: input.tutorId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  };

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = input.id
      ? await supabase.from('classes').update(columns).eq('id', input.id).select('id').maybeSingle()
      : await supabase.from('classes').insert(columns).select('id').maybeSingle();

    if (error) return fail(toErrorKey(error));
    return data ? succeed(data.id) : fail('notAllowed');
  });
}

/** Archive (false) or restore (true) a class (admins). */
export async function setClassActive(classId: string, active: boolean): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('classes')
      .update({ is_active: active })
      .eq('id', classId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

export async function addSession(input: SessionInput): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.from('class_sessions').insert({
      class_id: input.classId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

export async function removeSession(sessionId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.from('class_sessions').delete().eq('id', sessionId);
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

export async function enrolStudent(classId: string, studentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('enrolments')
      .insert({ class_id: classId, student_id: studentId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Removes a student from a class. Their past marks are kept (R3a review H15). */
export async function removeEnrolment(classId: string, studentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('enrolments')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

type TimetableRow = SessionRow & {
  class: {
    name: string;
    subject: string;
    delivery: string;
    location: string;
    tutor_id: string | null;
    starts_on: string | null;
    ends_on: string | null;
    tutor: { full_name: string } | null;
  };
};

/** Every slot the person may see, for active classes only. */
export async function listTimetable(): Promise<Result<TimetableEntry[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('class_sessions')
      .select(
        `id, class_id, day_of_week, start_time, end_time,
         class:classes!inner(name, subject, delivery, location, tutor_id, starts_on, ends_on,
           tutor:profiles(full_name))`,
      )
      .eq('class.is_active', true);
    if (error) return fail(toErrorKey(error));

    return succeed(
      (data as unknown as TimetableRow[]).map((row) => ({
        ...toSession(row),
        className: row.class.name,
        subject: row.class.subject,
        delivery: row.class.delivery as Delivery,
        location: row.class.location,
        tutorId: row.class.tutor_id,
        tutorName: row.class.tutor?.full_name ?? '',
        startsOn: row.class.starts_on,
        endsOn: row.class.ends_on,
      })),
    );
  });
}

// --- Students (shared with students.service) ---------------------------------------

export type StudentRow = {
  id: string;
  full_name: string;
  year_level: number | null;
  is_active: boolean;
};

export function toStudentSummary(row: StudentRow): StudentSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    yearLevel: row.year_level,
    isActive: row.is_active,
  };
}
