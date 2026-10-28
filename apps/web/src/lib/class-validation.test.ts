import { describe, expect, it } from 'vitest';

import { CLASS_VALIDATION } from '@/constants';
import type { ClassInput } from '@/services';

import { validateClass, validateSessionTimes, validateStudentName } from './class-validation';
import { studentYearLabel, subjectLabel } from './labels';

const valid: ClassInput = {
  name: 'Selective Maths',
  subject: 'maths',
  yearLevels: [8],
  delivery: 'in_person',
  location: 'Room 1',
  tutorId: null,
  startsOn: '2026-10-05',
  endsOn: '2026-12-18',
};

describe('validateClass', () => {
  it('accepts a complete class', () => {
    expect(validateClass(valid)).toEqual({});
  });

  it('needs a name, a subject, a short location and a term in order', () => {
    expect(
      validateClass({
        ...valid,
        name: ' x ',
        subject: '',
        location: 'x'.repeat(101),
        endsOn: '2026-01-01',
      }),
    ).toEqual({
      name: CLASS_VALIDATION.nameLength,
      subject: CLASS_VALIDATION.subjectRequired,
      location: CLASS_VALIDATION.locationLength,
      term: CLASS_VALIDATION.termOrder,
    });
  });

  it('keeps the 100-character location rule for hybrid classes', () => {
    expect(validateClass({ ...valid, delivery: 'hybrid', location: 'x'.repeat(100) })).toEqual({});
    expect(validateClass({ ...valid, delivery: 'hybrid', location: 'x'.repeat(101) })).toEqual({
      location: CLASS_VALIDATION.locationLength,
    });
  });

  it('allows no term dates, or only one', () => {
    expect(validateClass({ ...valid, startsOn: null, endsOn: null })).toEqual({});
    expect(validateClass({ ...valid, startsOn: null })).toEqual({});
  });
});

describe('validateSessionTimes', () => {
  it('needs both times, with the end after the start', () => {
    expect(validateSessionTimes('16:00', '17:30')).toBe('');
    expect(validateSessionTimes(null, '17:30')).toBe(CLASS_VALIDATION.timeRequired);
    expect(validateSessionTimes('17:30', '17:30')).toBe(CLASS_VALIDATION.timeOrder);
  });
});

describe('students and labels', () => {
  it('checks the student name length', () => {
    expect(validateStudentName('Aarav Demo')).toBe('');
    expect(validateStudentName('A')).toBe(CLASS_VALIDATION.studentNameLength);
  });

  it('labels years and subjects, keeping unknown keys readable', () => {
    expect(studentYearLabel(8)).toBe('Year 8');
    expect(studentYearLabel(null)).toBe('Other (e.g. UCAT, GAMSAT)');
    expect(subjectLabel('maths')).toBe('Maths');
    expect(subjectLabel('latin')).toBe('latin');
  });
});
