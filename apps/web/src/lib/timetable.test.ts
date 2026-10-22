import { describe, expect, it } from 'vitest';

import type { TimetableEntry } from '@/services';

import {
  formatClock,
  formatTimeRange,
  isoDayOfWeek,
  relativeDay,
  scheduleSummary,
  sessionsByDay,
  upcomingSessions,
} from './timetable';

function entry(overrides: Partial<TimetableEntry>): TimetableEntry {
  return {
    id: 's1',
    classId: 'c1',
    dayOfWeek: 2,
    startTime: '16:00:00',
    endTime: '17:30:00',
    className: 'Maths',
    subject: 'maths',
    delivery: 'in_person',
    location: 'Room 1',
    tutorId: 't1',
    tutorName: 'Tutor',
    startsOn: null,
    endsOn: null,
    ...overrides,
  };
}

describe('clock formatting', () => {
  it('shows 12-hour times', () => {
    expect(formatClock('16:00:00')).toBe('4:00 pm');
    expect(formatClock('09:05')).toBe('9:05 am');
    expect(formatClock('12:00')).toBe('12:00 pm');
    expect(formatClock('00:30')).toBe('12:30 am');
  });

  it('shows am/pm once when both ends share it', () => {
    expect(formatTimeRange('16:00:00', '17:30:00')).toBe('4:00–5:30 pm');
    expect(formatTimeRange('11:30', '12:30')).toBe('11:30 am–12:30 pm');
  });
});

describe('grouping and summaries', () => {
  it('groups by day, earliest first, with every day present', () => {
    const days = sessionsByDay([
      entry({ id: 'late', dayOfWeek: 2, startTime: '18:00' }),
      entry({ id: 'early', dayOfWeek: 2, startTime: '09:00' }),
      entry({ id: 'sat', dayOfWeek: 6 }),
    ]);
    expect(days[2].map((s) => s.id)).toEqual(['early', 'late']);
    expect(days[6].map((s) => s.id)).toEqual(['sat']);
    expect(days[1]).toEqual([]);
  });

  it('summarises a schedule Monday first', () => {
    expect(
      scheduleSummary([
        entry({ dayOfWeek: 6, startTime: '10:00:00', endTime: '11:30:00' }),
        entry({ dayOfWeek: 2 }),
      ]),
    ).toBe('Tue 4:00–5:30 pm · Sat 10:00–11:30 am');
  });

  it('counts Sunday as day 7', () => {
    expect(isoDayOfWeek(new Date(2026, 9, 11))).toBe(7); // Sunday 11 Oct 2026
    expect(isoDayOfWeek(new Date(2026, 9, 12))).toBe(1); // Monday
  });
});

describe('upcomingSessions', () => {
  // Wednesday 7 Oct 2026, 5:00 pm
  const now = new Date(2026, 9, 7, 17, 0);

  it('lists the next 7 days, soonest first', () => {
    const upcoming = upcomingSessions(
      [
        entry({ id: 'tue', dayOfWeek: 2 }), // next Tuesday 13 Oct
        entry({ id: 'thu', dayOfWeek: 4, startTime: '18:30', endTime: '19:30' }), // tomorrow
      ],
      now,
    );
    expect(upcoming.map((u) => u.entry.id)).toEqual(['thu', 'tue']);
    expect(upcoming[0]?.startsAt).toEqual(new Date(2026, 9, 8, 18, 30));
  });

  it('keeps a session that is under way, and drops one that has ended', () => {
    const upcoming = upcomingSessions(
      [
        entry({ id: 'now', dayOfWeek: 3, startTime: '16:30', endTime: '17:30' }),
        entry({ id: 'over', dayOfWeek: 3, startTime: '15:00', endTime: '16:00' }),
      ],
      now,
    );
    expect(upcoming.map((u) => u.entry.id)).toEqual(['now']);
  });

  it('skips dates outside the class term', () => {
    const upcoming = upcomingSessions(
      [
        entry({ id: 'ended', dayOfWeek: 4, endsOn: '2026-10-07' }),
        entry({ id: 'not-started', dayOfWeek: 4, startsOn: '2026-10-09' }),
        entry({ id: 'in-term', dayOfWeek: 4, startsOn: '2026-10-01', endsOn: '2026-12-18' }),
      ],
      now,
    );
    expect(upcoming.map((u) => u.entry.id)).toEqual(['in-term']);
  });

  it('respects the limit', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map((day) => entry({ id: `d${day}`, dayOfWeek: day as 1 }));
    expect(upcomingSessions(many, now, 7, 3)).toHaveLength(3);
  });
});

describe('relativeDay', () => {
  const now = new Date(2026, 9, 7, 17, 0);
  it('says today, tomorrow or later', () => {
    expect(relativeDay(new Date(2026, 9, 7, 9, 0), now)).toBe('today');
    expect(relativeDay(new Date(2026, 9, 8, 18, 30), now)).toBe('tomorrow');
    expect(relativeDay(new Date(2026, 9, 13, 16, 0), now)).toBe('later');
  });
});
