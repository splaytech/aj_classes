// Add or edit one question of a draft mock test (design §4.4): a prompt, 2–6 options with one
// marked correct, and an optional explanation. Adapted from QuestionDialog without kind or marks.

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRef, useState } from 'react';

import { MOCK_QUESTION_DIALOG, QUESTION_LIMITS } from '@/constants';
import { hasMockErrors, validateMockQuestion } from '@/lib/mock-tests';
import type { MockQuestionErrors } from '@/lib/mock-tests';
import { optionLetter } from '@/lib/questions';
import { usePortalAction } from '@/lib/use-portal-action';
import { saveMockQuestion } from '@/services';
import type { MockAdminQuestion } from '@/services';

import { FormDialog } from './FormDialog';

const NEW_OPTIONS = ['', ''];

/** An option being edited. The key keeps each row's input stable when another is removed. */
type OptionField = { key: number; text: string };

type MockQuestionDialogProps = {
  open: boolean;
  testId: string;
  existing: MockAdminQuestion | null;
  onSaved: () => void;
  onClose: () => void;
};

export function MockQuestionDialog({
  open,
  testId,
  existing,
  onSaved,
  onClose,
}: MockQuestionDialogProps) {
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const initialOptions = existing?.options.length ? existing.options : NEW_OPTIONS;
  const [options, setOptions] = useState<OptionField[]>(() =>
    initialOptions.map((text, index) => ({ key: index, text })),
  );
  const nextKey = useRef(initialOptions.length);
  const [correctOption, setCorrectOption] = useState<number | null>(
    existing?.correctOption ?? null,
  );
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [errors, setErrors] = useState<MockQuestionErrors>({});
  const action = usePortalAction();

  function updateOption(index: number, text: string) {
    setOptions(
      options.map((option, position) => (position === index ? { ...option, text } : option)),
    );
  }

  function addOption() {
    setOptions([...options, { key: nextKey.current, text: '' }]);
    nextKey.current += 1;
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, position) => position !== index));
    if (correctOption === index) setCorrectOption(null);
    else if (correctOption !== null && correctOption > index) setCorrectOption(correctOption - 1);
  }

  async function handleSubmit() {
    const input = {
      id: existing?.id,
      testId,
      prompt,
      options: options.map((option) => option.text),
      correctOption,
      explanation,
    };
    const found = validateMockQuestion(input);
    setErrors(found);
    if (hasMockErrors(found)) return;

    if (await action.run(() => saveMockQuestion(input))) onSaved();
  }

  return (
    <FormDialog
      open={open}
      title={existing ? MOCK_QUESTION_DIALOG.editHeading : MOCK_QUESTION_DIALOG.newHeading}
      submitLabel={MOCK_QUESTION_DIALOG.save}
      busyLabel={MOCK_QUESTION_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label={MOCK_QUESTION_DIALOG.promptLabel}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        error={Boolean(errors.prompt)}
        helperText={errors.prompt || MOCK_QUESTION_DIALOG.promptHint}
        slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.promptMax } }}
        multiline
        minRows={3}
        required
      />

      <FormControl error={Boolean(errors.options || errors.correctOption)} component="fieldset">
        <FormLabel component="legend">{MOCK_QUESTION_DIALOG.optionsLegend}</FormLabel>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {options.map((option, index) => {
            const letter = optionLetter(index);
            return (
              <Stack key={option.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Radio
                  checked={correctOption === index}
                  onChange={() => setCorrectOption(index)}
                  slotProps={{ input: { 'aria-label': MOCK_QUESTION_DIALOG.correctLabel(letter) } }}
                />
                <TextField
                  size="small"
                  label={MOCK_QUESTION_DIALOG.optionLabel(letter)}
                  value={option.text}
                  onChange={(event) => updateOption(index, event.target.value)}
                  slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.optionMax } }}
                  fullWidth
                />
                <IconButton
                  aria-label={MOCK_QUESTION_DIALOG.removeOption(letter)}
                  onClick={() => removeOption(index)}
                  disabled={options.length <= QUESTION_LIMITS.optionsMin}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
        {(errors.options || errors.correctOption) && (
          <FormHelperText>{errors.options || errors.correctOption}</FormHelperText>
        )}
        {options.length < QUESTION_LIMITS.optionsMax && (
          <Button
            startIcon={<AddIcon />}
            onClick={addOption}
            sx={{ alignSelf: 'flex-start', mt: 2 }}
          >
            {MOCK_QUESTION_DIALOG.addOption}
          </Button>
        )}
      </FormControl>

      <TextField
        label={MOCK_QUESTION_DIALOG.explanationLabel}
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        error={Boolean(errors.explanation)}
        helperText={errors.explanation || MOCK_QUESTION_DIALOG.explanationHint}
        slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.explanationMax } }}
        multiline
        minRows={2}
      />
    </FormDialog>
  );
}
