// Create a mock test, or change the title, instructions and tags of a draft (design §4.4;
// categories design §5.2). A draft may be saved with no tags (AC 13).

import TextField from '@mui/material/TextField';
import { useState } from 'react';

import { MOCK_SCORING, MOCK_TEST_DIALOG, MOCK_TEST_LIMITS } from '@/constants';
import {
  EMPTY_MOCK_TAGS,
  hasMockErrors,
  passMarkFromText,
  validateMockTest,
} from '@/lib/mock-tests';
import type { MockTestErrors } from '@/lib/mock-tests';
import { usePortalAction } from '@/lib/use-portal-action';
import { createMockTest, updateMockTest } from '@/services';
import type { MockTags } from '@/services';

import { FormDialog } from './FormDialog';
import { MockTagFields } from './MockTagFields';

type MockTestDialogProps = {
  open: boolean;
  /** The draft being changed; null creates a new mock test. */
  existing: {
    id: string;
    title: string;
    instructions: string;
    tags: MockTags;
    passMark: number | null;
  } | null;
  /** The id of the mock test that was created or changed. */
  onSaved: (testId: string) => void;
  onClose: () => void;
};

export function MockTestDialog({ open, existing, onSaved, onClose }: MockTestDialogProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [passMarkText, setPassMarkText] = useState(existing?.passMark?.toString() ?? '');
  const [tags, setTags] = useState<MockTags>(existing?.tags ?? EMPTY_MOCK_TAGS);
  const [errors, setErrors] = useState<MockTestErrors>({});
  const action = usePortalAction();

  async function handleSubmit() {
    const found = validateMockTest({ title, instructions, passMarkText });
    setErrors(found);
    if (hasMockErrors(found)) return;
    const input = { title, instructions, tags, passMark: passMarkFromText(passMarkText) };

    if (existing) {
      if (await action.run(() => updateMockTest(existing.id, input))) onSaved(existing.id);
      return;
    }
    let createdId = '';
    const created = await action.run(async () => {
      const result = await createMockTest(input);
      if (result.ok) createdId = result.data.id;
      return result;
    });
    if (created) onSaved(createdId);
  }

  return (
    <FormDialog
      open={open}
      title={existing ? MOCK_TEST_DIALOG.editHeading : MOCK_TEST_DIALOG.newHeading}
      submitLabel={existing ? MOCK_TEST_DIALOG.save : MOCK_TEST_DIALOG.create}
      busyLabel={existing ? MOCK_TEST_DIALOG.saving : MOCK_TEST_DIALOG.creating}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label={MOCK_TEST_DIALOG.titleLabel}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={Boolean(errors.title)}
        helperText={errors.title}
        slotProps={{ htmlInput: { maxLength: MOCK_TEST_LIMITS.titleMax } }}
        required
      />
      <TextField
        label={MOCK_TEST_DIALOG.instructionsLabel}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        error={Boolean(errors.instructions)}
        helperText={errors.instructions || MOCK_TEST_DIALOG.instructionsHint}
        slotProps={{ htmlInput: { maxLength: MOCK_TEST_LIMITS.instructionsMax } }}
        multiline
        minRows={3}
      />
      <TextField
        label={MOCK_SCORING.passMarkLabel}
        type="number"
        value={passMarkText}
        onChange={(event) => setPassMarkText(event.target.value)}
        error={Boolean(errors.passMark)}
        helperText={errors.passMark || MOCK_SCORING.passMarkHint}
        slotProps={{
          htmlInput: {
            min: MOCK_TEST_LIMITS.passMarkMin,
            max: MOCK_TEST_LIMITS.passMarkMax,
            step: 1,
          },
        }}
        sx={{ maxWidth: 240 }}
      />
      <MockTagFields value={tags} errors={{}} canClear disabled={action.busy} onChange={setTags} />
    </FormDialog>
  );
}
