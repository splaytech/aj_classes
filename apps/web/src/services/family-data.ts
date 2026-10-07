// Turns the family functions' rows into app types. Students and parents get the same shapes, so
// they share these (R3b design §4).

import type { FamilyStatus } from '@/constants';

import type {
  DayOfWeek,
  Delivery,
  FamilyAssignment,
  FamilyAssignmentView,
  FamilyQuestion,
  TimetableEntry,
} from './types';

export type FamilyAssignmentRow = {
  assignment_id: string;
  title: string;
  class_name: string;
  subject: string;
  due_on: string | null;
  published_at: string | null;
  question_count: number;
  answered_count: number | null;
  total_marks: number | null;
  status: FamilyStatus;
  submitted_at: string | null;
  returned_at: string | null;
  is_late: boolean;
  mark: number | null;
  comment: string;
};

export type FamilyTimetableRow = {
  session_id: string;
  class_id: string;
  class_name: string;
  subject: string;
  delivery: Delivery;
  location: string;
  tutor_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  starts_on: string | null;
  ends_on: string | null;
};

/** JSON from student_assignment / parent_child_assignment (keys already camelCase). */
export type FamilyAssignmentJson = Omit<FamilyAssignmentView, 'questions' | 'mark'> & {
  mark: number | string | null;
  questions: (Omit<FamilyQuestion, 'awardedMarks'> & { awardedMarks: number | string | null })[];
};

function toNumberOrNull(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

export function toFamilyAssignment(row: FamilyAssignmentRow): FamilyAssignment {
  return {
    id: row.assignment_id,
    title: row.title,
    className: row.class_name,
    subject: row.subject,
    dueOn: row.due_on,
    publishedAt: row.published_at,
    questionCount: row.question_count,
    answeredCount: row.answered_count,
    totalMarks: row.total_marks,
    status: row.status,
    submittedAt: row.submitted_at,
    returnedAt: row.returned_at,
    isLate: row.is_late,
    mark: toNumberOrNull(row.mark),
    comment: row.comment,
  };
}

export function toFamilyAssignmentView(json: FamilyAssignmentJson): FamilyAssignmentView {
  return {
    ...json,
    mark: toNumberOrNull(json.mark),
    questions: json.questions.map((question) => ({
      ...question,
      awardedMarks: toNumberOrNull(question.awardedMarks),
    })),
  };
}

export function toTimetableEntry(row: FamilyTimetableRow): TimetableEntry {
  return {
    id: row.session_id,
    classId: row.class_id,
    dayOfWeek: row.day_of_week as DayOfWeek,
    startTime: row.start_time,
    endTime: row.end_time,
    className: row.class_name,
    subject: row.subject,
    delivery: row.delivery,
    location: row.location,
    tutorId: null,
    tutorName: row.tutor_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}
