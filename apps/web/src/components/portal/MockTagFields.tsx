// The three tag fields of a mock test: subject, stream and year level
// (docs/delivery/2026-11-18-mock-test-closing ACs 10 to 12, 15, 27; design §5.1).

import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import {
  MOCK_TAG_ANY,
  MOCK_TAGS,
  MOCK_TEST_STREAMS,
  MOCK_TEST_SUBJECTS,
  YEAR_LEVEL_TEXT,
  YEAR_LEVELS,
} from '@/constants';
import {
  applyYearPick,
  mockStreamText,
  mockSubjectText,
  mockYearText,
  mockYearsSet,
} from '@/lib/mock-tests';
import type { MockTagErrors } from '@/lib/mock-tests';
import type { MockTags } from '@/services';

// The select's value for "Not set": an empty string, which the select shows as the Not set item.
const NOT_SET = '';

type Choice = { key: string; label: string };

type MockTagFieldsProps = {
  value: MockTags;
  errors: MockTagErrors;
  /** False on a released test: a set tag can't be cleared, so there is no Not set choice. */
  canClear: boolean;
  disabled?: boolean;
  onChange: (tags: MockTags) => void;
};

type ChoiceSelectProps = {
  label: string;
  value: string | null;
  choices: readonly Choice[];
  textOf: (key: string) => string;
  error: string | undefined;
  canClear: boolean;
  disabled: boolean;
  onChange: (value: string | null) => void;
};

/**
 * One choice from a list. Not set comes first when it may be chosen; on a released test with no
 * value yet it is still shown, disabled, so the box doesn't look blank. A held value that is no
 * longer offered gets its own disabled item, so the select can still show it (AC 27).
 */
function ChoiceSelect({
  label,
  value,
  choices,
  textOf,
  error,
  canClear,
  disabled,
  onChange,
}: ChoiceSelectProps) {
  const heldButRemoved = value !== null && !choices.some((choice) => choice.key === value);
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value ?? NOT_SET}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error}
      onChange={(event) => onChange(event.target.value === NOT_SET ? null : event.target.value)}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
    >
      {(canClear || value === null) && (
        <MenuItem value={NOT_SET} disabled={!canClear}>
          {MOCK_TAGS.notSet}
        </MenuItem>
      )}
      {heldButRemoved && (
        <MenuItem value={value} disabled>
          {MOCK_TAGS.noLongerOffered(textOf(value))}
        </MenuItem>
      )}
      {choices.map((choice) => (
        <MenuItem key={choice.key} value={choice.key}>
          {choice.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

// A multiple select reports its value as an array; anything else means nothing is chosen.
function toPicked(value: unknown): (number | typeof MOCK_TAG_ANY)[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item === MOCK_TAG_ANY ? MOCK_TAG_ANY : Number(item)));
}

export function MockTagFields({
  value,
  errors,
  canClear,
  disabled = false,
  onChange,
}: MockTagFieldsProps) {
  // Without Not set (a released test), a pick that would leave no year at all is ignored, so the
  // years can change but never be emptied (design §5.1, review-5 #5).
  function pickYears(picked: (number | typeof MOCK_TAG_ANY)[]) {
    const next = applyYearPick(value, picked);
    if (!canClear && !mockYearsSet(next)) return;
    onChange(next);
  }

  const yearValue: (number | typeof MOCK_TAG_ANY)[] = value.anyYear
    ? [MOCK_TAG_ANY]
    : value.yearLevels;

  return (
    <Stack spacing={3}>
      <ChoiceSelect
        label={MOCK_TAGS.subjectLabel}
        value={value.subject}
        choices={MOCK_TEST_SUBJECTS}
        textOf={mockSubjectText}
        error={errors.subject}
        canClear={canClear}
        disabled={disabled}
        onChange={(subject) => onChange({ ...value, subject })}
      />
      <ChoiceSelect
        label={MOCK_TAGS.streamLabel}
        value={value.stream}
        choices={MOCK_TEST_STREAMS}
        textOf={mockStreamText}
        error={errors.stream}
        canClear={canClear}
        disabled={disabled}
        onChange={(stream) => onChange({ ...value, stream })}
      />
      <TextField
        select
        fullWidth
        label={MOCK_TAGS.yearLevelLabel}
        value={yearValue}
        disabled={disabled}
        error={Boolean(errors.yearLevels)}
        helperText={errors.yearLevels ?? MOCK_TAGS.yearHint}
        onChange={(event) => pickYears(toPicked(event.target.value))}
        slotProps={{
          select: {
            multiple: true,
            // displayEmpty + shrink so "Not set" shows in the box with the label above it. The
            // select hands renderValue the raw array, which would print "any" or bare numbers.
            displayEmpty: true,
            renderValue: () => mockYearText(value),
          },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value={MOCK_TAG_ANY}>
          <Checkbox checked={value.anyYear} tabIndex={-1} disableRipple />
          <ListItemText primary={YEAR_LEVEL_TEXT.any} />
        </MenuItem>
        {YEAR_LEVELS.map((year) => (
          <MenuItem key={year} value={year}>
            <Checkbox checked={value.yearLevels.includes(year)} tabIndex={-1} disableRipple />
            <ListItemText primary={YEAR_LEVEL_TEXT.label(year)} />
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
