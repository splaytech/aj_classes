import { describe, expect, it } from 'vitest';

import { PORTAL_VALIDATION, PROFILE_VALIDATION } from '@/constants';

import { checkPhotoFile, squareCrop } from './photo';
import {
  cleanQualifications,
  subjectsToSave,
  validateProfile,
  validateProfilePhone,
} from './profile-validation';

const SAVED_PHONE = '+61412345678';
const valid = {
  fullName: 'Priya Sharma',
  bio: '',
  qualifications: [],
  subjects: [],
  phone: '0412 345 678',
};

describe('validateProfile', () => {
  it('accepts a normal profile', () => {
    expect(validateProfile(valid, SAVED_PHONE)).toEqual({});
  });

  it('needs a full name of 2–100 characters', () => {
    expect(validateProfile({ ...valid, fullName: ' A ' }, SAVED_PHONE).fullName).toBe(
      PROFILE_VALIDATION.nameLength,
    );
    expect(validateProfile({ ...valid, fullName: 'x'.repeat(101) }, SAVED_PHONE).fullName).toBe(
      PROFILE_VALIDATION.nameLength,
    );
  });

  it('limits the bio to 1000 characters', () => {
    expect(validateProfile({ ...valid, bio: 'x'.repeat(1001) }, SAVED_PHONE).bio).toBe(
      PROFILE_VALIDATION.bioTooLong,
    );
  });

  it('limits qualifications to 10 lines of 150 characters', () => {
    expect(
      validateProfile({ ...valid, qualifications: Array(11).fill('B.Ed') }, SAVED_PHONE)
        .qualifications,
    ).toBe(PROFILE_VALIDATION.tooManyQualifications);
    expect(
      validateProfile({ ...valid, qualifications: ['x'.repeat(151)] }, SAVED_PHONE).qualifications,
    ).toBe(PROFILE_VALIDATION.qualificationTooLong);
  });
});

describe('validateProfilePhone', () => {
  it('accepts the setup form formats (AC-4.2)', () => {
    for (const phone of [
      '0412 345 678',
      '0412-345-678',
      '(03) 9876 5432',
      '(08) 8123 4567',
      '+61 2 9876 5432',
    ]) {
      expect(validateProfilePhone(phone, SAVED_PHONE)).toBeUndefined();
    }
  });

  it('refuses numbers that are not Australian or have the wrong length (AC-4.3)', () => {
    for (const phone of [
      '0512345678',
      '041234567',
      '04123456789',
      '0412abc678',
      '+1 202 555 0100',
    ]) {
      expect(validateProfilePhone(phone, SAVED_PHONE)).toBe(PORTAL_VALIDATION.phoneInvalid);
    }
  });

  it('refuses a blank field only when a number is already saved (AC-4.4)', () => {
    expect(validateProfilePhone('', SAVED_PHONE)).toBe(PROFILE_VALIDATION.phoneRequired);
    expect(validateProfilePhone('   ', SAVED_PHONE)).toBe(PROFILE_VALIDATION.phoneRequired);
    expect(validateProfilePhone('', null)).toBeUndefined();
  });

  it('is part of the whole-form check', () => {
    expect(validateProfile({ ...valid, phone: '12345' }, SAVED_PHONE).phone).toBe(
      PORTAL_VALIDATION.phoneInvalid,
    );
  });
});

describe('cleanQualifications', () => {
  it('trims lines and drops empty ones (the database refuses blanks)', () => {
    expect(cleanQualifications([' B.Ed ', '', '   ', 'PhD'])).toEqual(['B.Ed', 'PhD']);
  });
});

describe('subjectsToSave', () => {
  it('keeps saved subjects that are no longer offered', () => {
    expect(subjectsToSave(['maths'], ['english', 'latin'], ['maths', 'english'])).toEqual([
      'maths',
      'latin',
    ]);
  });
});

describe('checkPhotoFile', () => {
  it('accepts JPEG, PNG and WebP under the size limit', () => {
    expect(checkPhotoFile({ type: 'image/jpeg', size: 3_000_000 })).toBe('');
  });

  it('refuses other types, including SVG', () => {
    expect(checkPhotoFile({ type: 'image/svg+xml', size: 100 })).toBe(PROFILE_VALIDATION.photoType);
    expect(checkPhotoFile({ type: 'image/heic', size: 100 })).toBe(PROFILE_VALIDATION.photoType);
  });

  it('refuses files over 15 MB before trying to resize them', () => {
    expect(checkPhotoFile({ type: 'image/png', size: 16 * 1024 * 1024 })).toBe(
      PROFILE_VALIDATION.photoTooLarge,
    );
  });
});

describe('squareCrop', () => {
  it('cuts the centred square from a landscape photo and shrinks it to 512', () => {
    expect(squareCrop(4000, 3000, 512)).toEqual({
      sourceX: 500,
      sourceY: 0,
      sourceSide: 3000,
      outputSide: 512,
    });
  });

  it('never enlarges a small photo', () => {
    expect(squareCrop(300, 400, 512).outputSide).toBe(300);
  });
});
