// Weekly timetable logic (R3a design §5.5). Plain functions, unit tested.
// Times are Melbourne wall-clock "HH:MM[:SS]" strings (design D5); days are ISO (1 = Monday).

import { CLOCK, DAY_NAMES, DAYS_OF_WEEK } from '@/constants';
import type { ClassSession, DayOfWeek, TimetableEntry } from '@/services';

const MINUTES_PER_HOUR = 60;
const NOON_HOUR = 12;

type Clock = { hours: number; minutes: number };

function readClock(time: string): Clock {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return { hours, minutes };
}

function meridiem(clock: Clock): string {
  return clock.hours < NOON_HOUR ? CLOCK.am : CLOCK.pm;
}

/** "4:00" for 16:00 (no am/pm). */
function shortClock(clock: Clock): string {
  const hours12 = clock.hours % NOON_HOUR === 0 ? NOON_HOUR : clock.hours % NOON_HOUR;
  return `${hours12}:${String(clock.minutes).padStart(2, '0')}`;
}

/** "4:00 pm" from "16:00:00". */
export function formatClock(time: string): string {
  const clock = readClock(time);
  return `${shortClock(clock)} ${meridiem(clock)}`;
}

/** "4:00–5:30 pm", or "11:30 am–12:30 pm" when the range crosses noon. */
export function formatTimeRange(start: string, end: string): string {
  const from = readClock(start);
  const to = readClock(end);
  const fromText = meridiem(from) === meridiem(to) ? shortClock(from) : formatClock(start);
  return `${fromText}${CLOCK.rangeSeparator}${formatClock(end)}`;
}

/** Minutes since midnight, for sorting and comparing. */
export function minutesOfDay(time: string): number {
  const clock = readClock(time);
  return clock.hours * MINUTES_PER_HOUR + clock.minutes;
}

export function byStartTime<T extends Pick<ClassSession, 'startTime'>>(a: T, b: T): number {
  return minutesOfDay(a.startTime) - minutesOfDay(b.startTime);
}

/** Sessions for each day, earliest first. Every day is present (possibly empty). */
export function sessionsByDay<T extends Pick<ClassSession, 'dayOfWeek' | 'startTime'>>(
  sessions: T[],
): Record<DayOfWeek, T[]> {
  const days = Object.fromEntries(DAYS_OF_WEEK.map((day) => [day, [] as T[]])) as Record<
    DayOfWeek,
    T[]
  >;
  for (const session of sessions) days[session.dayOfWeek].push(session);
  for (const day of DAYS_OF_WEEK) days[day].sort(byStartTime);
  return days;
}

/** "Tue 4:00–5:30 pm · Sat 10:00–11:30 am" (Monday first). */
export function scheduleSummary(sessions: ClassSession[]): string {
  return [...sessions]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || byStartTime(a, b))
    .map((s) => `${DAY_NAMES.short[s.dayOfWeek]} ${formatTimeRange(s.startTime, s.endTime)}`)
    .join(CLOCK.listSeparator);
}

/** ISO day of the week for a date (JavaScript counts Sunday as 0). */
export function isoDayOfWeek(date: Date): DayOfWeek {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as DayOfWeek;
}

/** "YYYY-MM-DD" for a local date. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function atTime(date: Date, time: string): Date {
  const clock = readClock(time);
  const moment = new Date(date);
  moment.setHours(clock.hours, clock.minutes, 0, 0);
  return moment;
}

export type UpcomingSession = { entry: TimetableEntry; startsAt: Date; endsAt: Date };

/**
 * The next sessions in the coming `days` days (today included), soonest first. A session
 * already under way still counts until it ends. Dates outside a class's term are skipped
 * (R3a review H13).
 */
export function upcomingSessions(
  entries: TimetableEntry[],
  now: Date,
  days = 7,
  limit = 5,
): UpcomingSession[] {
  const found: UpcomingSession[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const isoDate = toIsoDate(date);

    for (const entry of entries) {
      if (entry.dayOfWeek !== isoDayOfWeek(date)) continue;
      if (entry.startsOn && isoDate < entry.startsOn) continue;
      if (entry.endsOn && isoDate > entry.endsOn) continue;

      const endsAt = atTime(date, entry.endTime);
      if (endsAt > now) found.push({ entry, startsAt: atTime(date, entry.startTime), endsAt });
    }
  }

  return found.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, limit);
}

export type RelativeDay = 'today' | 'tomorrow' | 'later';

/** Whether a moment falls today, tomorrow or later, in local time. */
export function relativeDay(moment: Date, now: Date): RelativeDay {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMoment = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
  const daysAway = Math.round(
    (startOfMoment.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (daysAway === 0) return 'today';
  return daysAway === 1 ? 'tomorrow' : 'later';
}
