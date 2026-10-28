import { describe, expect, it } from 'vitest';

import { DELIVERY_LABELS, YEAR_LEVEL_TEXT, YEAR_LEVELS } from '@/constants';

import { classYearLabel, deliveryLabel } from './labels';

describe('deliveryLabel', () => {
  it('labels every delivery, including hybrid', () => {
    expect(deliveryLabel('in_person')).toBe(DELIVERY_LABELS.in_person);
    expect(deliveryLabel('online')).toBe(DELIVERY_LABELS.online);
    expect(deliveryLabel('hybrid')).toBe(DELIVERY_LABELS.hybrid);
  });
});

// Exact strings pinned on purpose: these are what staff and families read (01 AC 13).
describe('classYearLabel', () => {
  it.each([
    { years: [], label: 'Any year' },
    { years: [8], label: 'Year 8' },
    { years: [7, 8, 9], label: 'Years 7–9' },
    { years: [7, 8], label: 'Years 7, 8' },
    { years: [7, 9, 11], label: 'Years 7, 9, 11' },
    { years: [11, 7, 8, 9], label: 'Years 7–9, 11' },
    { years: [7, 8, 10, 11], label: 'Years 7, 8, 10, 11' },
    { years: [...YEAR_LEVELS], label: 'Years 2–12' },
  ])('labels $years as "$label"', ({ years, label }) => {
    expect(classYearLabel(years)).toBe(label);
  });

  it('uses the shared year text', () => {
    expect(classYearLabel([])).toBe(YEAR_LEVEL_TEXT.any);
    expect(classYearLabel([8])).toBe(YEAR_LEVEL_TEXT.label(8));
  });

  it('ignores repeats and does not reorder the caller’s array', () => {
    const years = [9, 7, 8, 7];
    expect(classYearLabel(years)).toBe('Years 7–9');
    expect(years).toEqual([9, 7, 8, 7]);
  });
});
