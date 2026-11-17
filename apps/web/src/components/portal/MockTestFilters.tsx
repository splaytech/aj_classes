// The three filters on the taker's mock test list: Stream, Subject and Year level, each with All
// first (docs/delivery/2026-11-18-mock-test-closing ACs 19, 26, 27). Only current choices are
// offered, and Year level has no Any year: a year matches Any year tests anyway.

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import {
  MOCK_TAGS,
  MOCK_TEST_FILTERS,
  MOCK_TEST_STREAMS,
  MOCK_TEST_SUBJECTS,
  YEAR_LEVEL_TEXT,
  YEAR_LEVELS,
} from '@/constants';
import type { MockFilters } from '@/lib/mock-tests';

// The select's value for All. A year is held as a number; the select reports text.
const ALL = '';
// displayEmpty + shrink, so All shows in the box (an empty value otherwise shows nothing).
const SHOW_ALL = { select: { displayEmpty: true }, inputLabel: { shrink: true } };

type MockTestFiltersProps = {
  value: MockFilters;
  onChange: (filters: MockFilters) => void;
};

export function MockTestFilters({ value, onChange }: MockTestFiltersProps) {
  return (
    <Stack
      component="section"
      aria-label={MOCK_TEST_FILTERS.groupLabel}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
    >
      <TextField
        select
        fullWidth
        slotProps={SHOW_ALL}
        label={MOCK_TAGS.streamLabel}
        value={value.stream}
        onChange={(event) => onChange({ ...value, stream: event.target.value })}
      >
        <MenuItem value={ALL}>{MOCK_TEST_FILTERS.all}</MenuItem>
        {MOCK_TEST_STREAMS.map((stream) => (
          <MenuItem key={stream.key} value={stream.key}>
            {stream.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        slotProps={SHOW_ALL}
        label={MOCK_TAGS.subjectLabel}
        value={value.subject}
        onChange={(event) => onChange({ ...value, subject: event.target.value })}
      >
        <MenuItem value={ALL}>{MOCK_TEST_FILTERS.all}</MenuItem>
        {MOCK_TEST_SUBJECTS.map((subject) => (
          <MenuItem key={subject.key} value={subject.key}>
            {subject.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        slotProps={SHOW_ALL}
        label={MOCK_TAGS.yearLevelLabel}
        value={value.year === null ? ALL : String(value.year)}
        onChange={(event) =>
          onChange({
            ...value,
            year: event.target.value === ALL ? null : Number(event.target.value),
          })
        }
      >
        <MenuItem value={ALL}>{MOCK_TEST_FILTERS.all}</MenuItem>
        {YEAR_LEVELS.map((year) => (
          <MenuItem key={year} value={String(year)}>
            {YEAR_LEVEL_TEXT.label(year)}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
