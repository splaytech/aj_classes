// Add or edit one question of a draft assignment (R3b story FT1): multiple choice (2–6 options,
// one correct) or a written answer, with marks and an optional explanation.

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRef, useState } from 'react';

import {
  QUESTION_DIALOG,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  QUESTION_LIMITS,
} from '@/constants';
import type { QuestionKind } from '@/constants';
import { optionLetter, validateQuestion } from '@/lib/questions';
import type { QuestionErrors } from '@/lib/questions';
import { usePortalAction } from '@/lib/use-portal-action';
import type { Question, QuestionInput, Result } from '@/services';

import { FormDialog } from './FormDialog';

const NEW_OPTIONS = ['', ''];

/** An option being edited. The key keeps each row's input stable when another is removed. */
type OptionField = { key: number; text: string };

type QuestionDialogProps = {
  open: boolean;
  assignmentId: string;
  existing: Question | null;
  onSave: (input: QuestionInput) => Promise<Result>;
  onSaved: () => void;
  onClose: () => void;
};

export function QuestionDialog({
  open,
  assignmentId,
  existing,
  onSave,
  onSaved,
  onClose,
}: QuestionDialogProps) {
  const [kind, setKind] = useState<QuestionKind>(existing?.kind ?? 'multiple_choice');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const initialOptions = existing?.options.length ? existing.options : NEW_OPTIONS;
  const [options, setOptions] = useState<OptionField[]>(() =>
    initialOptions.map((text, index) => ({ key: index, text })),
  );
  const nextKey = useRef(initialOptions.length);
  const [correctOption, setCorrectOption] = useState<number | null>(
    existing?.correctOption ?? null,
  );
  const [marksText, setMarksText] = useState(String(existing?.marks ?? 1));
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [errors, setErrors] = useState<QuestionErrors>({});
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
    const input: QuestionInput = {
      id: existing?.id,
      assignmentId,
      kind,
      prompt,
      options: kind === 'multiple_choice' ? options.map((option) => option.text) : [],
      correctOption: kind === 'multiple_choice' ? correctOption : null,
      marks: Number(marksText),
      explanation,
    };
    const found = validateQuestion(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (await action.run(() => onSave(input))) onSaved();
  }

  return (
    <FormDialog
      open={open}
      title={existing ? QUESTION_DIALOG.editHeading : QUESTION_DIALOG.newHeading}
      submitLabel={QUESTION_DIALOG.save}
      busyLabel={QUESTION_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        select
        label={QUESTION_DIALOG.kindLabel}
        value={kind}
        onChange={(event) => setKind(event.target.value as QuestionKind)}
      >
        {QUESTION_KINDS.map((option) => (
          <MenuItem key={option} value={option}>
            {QUESTION_KIND_LABELS[option]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={QUESTION_DIALOG.promptLabel}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        error={Boolean(errors.prompt)}
        helperText={errors.prompt || QUESTION_DIALOG.promptHint}
        slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.promptMax } }}
        multiline
        minRows={3}
        required
      />

      {kind === 'multiple_choice' && (
        <FormControl error={Boolean(errors.options || errors.correctOption)} component="fieldset">
          <FormLabel component="legend">{QUESTION_DIALOG.optionsLegend}</FormLabel>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {options.map((option, index) => {
              const letter = optionLetter(index);
              return (
                <Stack key={option.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Radio
                    checked={correctOption === index}
                    onChange={() => setCorrectOption(index)}
                    slotProps={{ input: { 'aria-label': QUESTION_DIALOG.correctLabel(letter) } }}
                  />
                  <TextField
                    size="small"
                    label={QUESTION_DIALOG.optionLabel(letter)}
                    value={option.text}
                    onChange={(event) => updateOption(index, event.target.value)}
                    slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.optionMax } }}
                    fullWidth
                  />
                  <IconButton
                    aria-label={QUESTION_DIALOG.removeOption(letter)}
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
              {QUESTION_DIALOG.addOption}
            </Button>
          )}
        </FormControl>
      )}

      <TextField
        label={QUESTION_DIALOG.marksLabel}
        type="number"
        value={marksText}
        onChange={(event) => setMarksText(event.target.value)}
        error={Boolean(errors.marks)}
        helperText={errors.marks}
        slotProps={{
          htmlInput: { min: QUESTION_LIMITS.marksMin, max: QUESTION_LIMITS.marksMax, step: 1 },
        }}
        sx={{ maxWidth: 160 }}
      />
      <TextField
        label={QUESTION_DIALOG.explanationLabel}
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        error={Boolean(errors.explanation)}
        helperText={errors.explanation || QUESTION_DIALOG.explanationHint}
        slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.explanationMax } }}
        multiline
        minRows={2}
      />
    </FormDialog>
  );
}
