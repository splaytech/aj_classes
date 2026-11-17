// Create a mock test or change the title and instructions of a draft (design §4.4).

import TextField from '@mui/material/TextField';
import { useState } from 'react';

import { MOCK_TEST_DIALOG, MOCK_TEST_LIMITS } from '@/constants';
import { hasMockErrors, validateMockTest } from '@/lib/mock-tests';
import type { MockTestErrors } from '@/lib/mock-tests';
import { usePortalAction } from '@/lib/use-portal-action';
import { createMockTest, updateMockTest } from '@/services';

import { FormDialog } from './FormDialog';

type MockTestDialogProps = {
  open: boolean;
  /** The draft being changed; null creates a new mock test. */
  existing: { id: string; title: string; instructions: string } | null;
  /** The id of the mock test that was created or changed. */
  onSaved: (testId: string) => void;
  onClose: () => void;
};

export function MockTestDialog({ open, existing, onSaved, onClose }: MockTestDialogProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [errors, setErrors] = useState<MockTestErrors>({});
  const action = usePortalAction();

  async function handleSubmit() {
    const input = { title, instructions };
    const found = validateMockTest(input);
    setErrors(found);
    if (hasMockErrors(found)) return;

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
    </FormDialog>
  );
}
