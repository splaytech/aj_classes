// Edit the tags of a released or closed mock test (docs/delivery/2026-11-18-mock-test-closing
// AC 15, design §5.4). Only the four tag columns are saved; title, instructions and questions stay
// frozen. A tag that is set can change but not be cleared; an unset one on an older test can be
// left alone or set.

import { useState } from 'react';

import { MOCK_CLOSING, MOCK_TAGS } from '@/constants';
import { hasMockErrors, mockTagErrors, setMockTagFields } from '@/lib/mock-tests';
import type { MockTagErrors } from '@/lib/mock-tests';
import { usePortalAction } from '@/lib/use-portal-action';
import { updateMockTestTags } from '@/services';
import type { MockTags } from '@/services';

import { FormDialog } from './FormDialog';
import { MockTagFields } from './MockTagFields';

type MockTagsDialogProps = {
  testId: string;
  /** The tags saved now. */
  tags: MockTags;
  onSaved: () => void;
  onClose: () => void;
};

export function MockTagsDialog({ testId, tags, onSaved, onClose }: MockTagsDialogProps) {
  const [value, setValue] = useState<MockTags>(tags);
  const [errors, setErrors] = useState<MockTagErrors>({});
  const action = usePortalAction();

  async function handleSubmit() {
    // A field that was set must still be set: the only way to unset it here is the year list.
    const found = mockTagErrors(value, setMockTagFields(tags), true);
    setErrors(found);
    if (hasMockErrors(found)) return;
    if (await action.run(() => updateMockTestTags(testId, value))) onSaved();
  }

  return (
    <FormDialog
      open
      title={MOCK_TAGS.editTagsTitle}
      submitLabel={MOCK_CLOSING.save}
      busyLabel={MOCK_CLOSING.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <MockTagFields
        value={value}
        errors={errors}
        canClear={false}
        disabled={action.busy}
        onChange={setValue}
      />
    </FormDialog>
  );
}
