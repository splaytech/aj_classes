// The two dialogs that take a mock test's closing date and time
// (docs/delivery/2026-11-18-mock-test-closing): Release, with an optional closing time, and Set
// closing date on a released test, which can also clear it. The picker shows the viewer's local
// time; the database gets an ISO timestamp and refuses one that isn't in the future.

import Button from '@mui/material/Button';
import DialogContentText from '@mui/material/DialogContentText';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { DEFAULT_DESKTOP_MODE_MEDIA_QUERY } from '@mui/x-date-pickers';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useRef, useState } from 'react';
import type { RefObject } from 'react';

import { MOCK_CLOSING, MOCK_TAGS, MOCK_TEST_EDIT_PAGE, MOCK_VALIDATION } from '@/constants';
import {
  MOCK_TAG_FIELDS,
  closesAtError,
  hasMockErrors,
  mockTagErrors,
  sameMockTags,
} from '@/lib/mock-tests';
import type { MockTagErrors } from '@/lib/mock-tests';
import { usePortalAction } from '@/lib/use-portal-action';
import { releaseMockTest, setMockTestClosing, updateMockTestTags } from '@/services';
import type { MockTags } from '@/services';

import { FormDialog } from './FormDialog';
import { MockTagFields } from './MockTagFields';

type ClosesFieldProps = {
  value: Dayjs | null;
  error: string | undefined;
  onChange: (value: Dayjs | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * The desktop picker's popper is about 490 px wide, so a narrow window with a mouse overflowed
 * (TSR BUG-1). The desktop picker now needs a fine pointer (MUI's default rule) and a window at
 * least the theme's `sm` width; anything narrower gets the mobile dialog picker.
 */
export function closesPickerDesktopQuery(theme: Theme): string {
  const wideEnough = theme.breakpoints.up('sm').replace(/^@media\s*/, '');
  return `${DEFAULT_DESKTOP_MODE_MEDIA_QUERY} and ${wideEnough}`;
}

function ClosesField({ value, error, onChange, inputRef }: ClosesFieldProps) {
  const theme = useTheme();
  return (
    <DateTimePicker
      desktopModeMediaQuery={closesPickerDesktopQuery(theme)}
      label={MOCK_CLOSING.fieldLabel}
      value={value}
      onChange={onChange}
      disablePast
      slotProps={{
        textField: {
          inputRef,
          fullWidth: true,
          error: Boolean(error),
          helperText: error ?? MOCK_CLOSING.fieldHint,
        },
      }}
    />
  );
}

/**
 * The ISO timestamp to send, or the reason it can't be sent. A half-typed field reports no value
 * at all (the picker only calls onChange once every part is filled), so the field's own text is
 * checked too: any digit in it without a value means it isn't finished, and must not release a
 * test that never closes.
 */
function readCloses(
  value: Dayjs | null,
  fieldText: string,
): { closesAt: string | null; error?: string } {
  if (!value && /\d/.test(fieldText))
    return { closesAt: null, error: MOCK_VALIDATION.closesInvalid };
  const asDate = value ? value.toDate() : null;
  const error = closesAtError(asDate, new Date());
  if (error) return { closesAt: null, error };
  return { closesAt: asDate ? asDate.toISOString() : null };
}

type MockReleaseDialogProps = {
  testId: string;
  /** The tags saved on the draft; any the admin sets here are saved before the release. */
  tags: MockTags;
  onReleased: () => void;
  onClose: () => void;
};

export function MockReleaseDialog({ testId, tags, onReleased, onClose }: MockReleaseDialogProps) {
  const [closes, setCloses] = useState<Dayjs | null>(null);
  const [newTags, setNewTags] = useState<MockTags>(tags);
  const [error, setError] = useState<string>();
  const [tagErrors, setTagErrors] = useState<MockTagErrors>({});
  const fieldRef = useRef<HTMLInputElement>(null);
  const action = usePortalAction();

  async function handleSubmit() {
    const foundTagErrors = mockTagErrors(newTags, MOCK_TAG_FIELDS);
    const read = readCloses(closes, fieldRef.current?.value ?? '');
    setTagErrors(foundTagErrors);
    setError(read.error);
    if (hasMockErrors(foundTagErrors) || read.error) return;

    // One action, so the busy state and any refusal cover both steps. If the release fails after
    // the tags saved, the tags stay saved and the alert says why.
    const released = await action.run(async () => {
      if (!sameMockTags(newTags, tags)) {
        const saved = await updateMockTestTags(testId, newTags);
        if (!saved.ok) return saved;
      }
      return releaseMockTest(testId, read.closesAt);
    });
    if (released) onReleased();
  }

  return (
    <FormDialog
      open
      title={MOCK_TEST_EDIT_PAGE.confirmReleaseTitle}
      submitLabel={MOCK_TEST_EDIT_PAGE.release}
      busyLabel={MOCK_TEST_EDIT_PAGE.releasing}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <DialogContentText sx={{ overflowWrap: 'anywhere' }}>
        {MOCK_TEST_EDIT_PAGE.confirmReleaseText}
      </DialogContentText>
      <DialogContentText>{MOCK_TAGS.releaseTagsText}</DialogContentText>
      <MockTagFields
        value={newTags}
        errors={tagErrors}
        canClear={false}
        disabled={action.busy}
        onChange={setNewTags}
      />
      <ClosesField value={closes} error={error} onChange={setCloses} inputRef={fieldRef} />
    </FormDialog>
  );
}

type MockClosingDialogProps = {
  testId: string;
  /** The closing time now set (ISO), or null. */
  closesAt: string | null;
  /** True when the closing time was cleared. */
  onSaved: (cleared: boolean) => void;
  onClose: () => void;
};

export function MockClosingDialog({ testId, closesAt, onSaved, onClose }: MockClosingDialogProps) {
  const [closes, setCloses] = useState<Dayjs | null>(closesAt ? dayjs(closesAt) : null);
  const [error, setError] = useState<string>();
  const fieldRef = useRef<HTMLInputElement>(null);
  const action = usePortalAction();

  async function handleSubmit() {
    const read = readCloses(closes, fieldRef.current?.value ?? '');
    setError(read.error);
    if (read.error) return;
    if (await action.run(() => setMockTestClosing(testId, read.closesAt))) {
      onSaved(read.closesAt === null);
    }
  }

  function clear() {
    setCloses(null);
    setError(undefined);
  }

  return (
    <FormDialog
      open
      title={MOCK_CLOSING.setClosingTitle}
      submitLabel={MOCK_CLOSING.save}
      busyLabel={MOCK_CLOSING.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <DialogContentText sx={{ overflowWrap: 'anywhere' }}>
        {MOCK_CLOSING.setClosingText}
      </DialogContentText>
      <ClosesField value={closes} error={error} onChange={setCloses} inputRef={fieldRef} />
      {/* Always shown, so focus never falls to the page when the date is cleared (BUG-4). */}
      <Button
        variant="text"
        onClick={clear}
        disabled={action.busy}
        sx={{ alignSelf: 'flex-start' }}
      >
        {MOCK_CLOSING.clear}
      </Button>
    </FormDialog>
  );
}
