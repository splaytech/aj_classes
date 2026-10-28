import { describe, expect, it } from 'vitest';

import { sortedYears } from './classes.service';

describe('sortedYears', () => {
  it('sorts ascending, the only order the database accepts', () => {
    expect(sortedYears([11, 7, 9])).toEqual([7, 9, 11]);
  });

  it('drops repeats', () => {
    expect(sortedYears([8, 7, 8, 7])).toEqual([7, 8]);
  });

  it('keeps an empty set empty (Any year)', () => {
    expect(sortedYears([])).toEqual([]);
  });

  it('does not change the array it is given', () => {
    const years = [11, 7, 9];
    sortedYears(years);
    expect(years).toEqual([11, 7, 9]);
  });
});
