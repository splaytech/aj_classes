import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MOCK_TAGS, MOCK_TEST_FILTERS, YEAR_LEVEL_TEXT, YEAR_LEVELS } from '@/constants';
import { NO_MOCK_FILTERS } from '@/lib/mock-tests';
import type { MockFilters } from '@/lib/mock-tests';
import { setupUser } from '@/test/user';

import { MockTestFilters } from './MockTestFilters';

function Harness() {
  const [filters, setFilters] = useState<MockFilters>(NO_MOCK_FILTERS);
  return (
    <>
      <MockTestFilters value={filters} onChange={setFilters} />
      <output>{JSON.stringify(filters)}</output>
    </>
  );
}

const state = () =>
  JSON.parse(screen.getByRole('status', { hidden: true }).textContent ?? '{}') as MockFilters;

async function options(user: ReturnType<typeof setupUser>, label: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const names = within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((option) => option.textContent);
  await user.keyboard('{Escape}');
  return names;
}

describe('MockTestFilters', () => {
  it('is a labelled group of Stream, Subject and Year level, each on All (AC 19, 26)', () => {
    render(<Harness />);
    const group = screen.getByRole('region', { name: MOCK_TEST_FILTERS.groupLabel });
    for (const label of [MOCK_TAGS.streamLabel, MOCK_TAGS.subjectLabel, MOCK_TAGS.yearLevelLabel]) {
      expect(within(group).getByRole('combobox', { name: label })).toHaveTextContent(
        MOCK_TEST_FILTERS.all,
      );
    }
  });

  it('offers All then the current lists only, and no Any year (AC 19, 27)', async () => {
    const user = setupUser();
    render(<Harness />);

    const streams = await options(user, MOCK_TAGS.streamLabel);
    expect(streams[0]).toBe(MOCK_TEST_FILTERS.all);
    expect(streams).toContain('VCE Tutoring');
    expect(streams).not.toContain('UCAT and GAMSAT');
    expect(streams).not.toContain('Interviews');

    const subjects = await options(user, MOCK_TAGS.subjectLabel);
    expect(subjects[0]).toBe(MOCK_TEST_FILTERS.all);
    expect(subjects).not.toContain('Interview preparation');

    const years = await options(user, MOCK_TAGS.yearLevelLabel);
    expect(years).toEqual([MOCK_TEST_FILTERS.all, ...YEAR_LEVELS.map(YEAR_LEVEL_TEXT.label)]);
    expect(years).not.toContain(YEAR_LEVEL_TEXT.any);
  });

  it('works from the keyboard', async () => {
    const user = setupUser();
    render(<Harness />);

    screen.getByRole('combobox', { name: MOCK_TAGS.yearLevelLabel }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // All → Year 2 → Year 3
    expect(state().year).toBe(3);

    screen.getByRole('combobox', { name: MOCK_TAGS.streamLabel }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(state().stream).toBe('vce');
  });
});
