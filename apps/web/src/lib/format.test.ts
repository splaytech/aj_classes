import { describe, expect, it } from 'vitest';

import { formatPhone } from './format';

describe('formatPhone', () => {
  it('shows a mobile the Australian way', () => {
    expect(formatPhone('+61412345678')).toBe('0412 345 678');
  });

  it('shows a landline with its area code', () => {
    expect(formatPhone('+61298765432')).toBe('(02) 9876 5432');
  });

  it('is empty when there is no number', () => {
    expect(formatPhone(null)).toBe('');
  });
});
