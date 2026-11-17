// Taking a mock test (design §4.4): one question per screen, the options as a labelled radio
// group, Previous and Next that never wait for an answer, autosave as each option is chosen, and
// Submit with a confirmation that counts the questions left blank. Nothing here ever holds an
// answer key: the data has none until the person has submitted.

import CheckIcon from '@mui/icons-material/Check';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useId, useState } from 'react';

import { MOCK_TAKE_PAGE, PORTAL_ERRORS } from '@/constants';
import { unansweredCount } from '@/lib/mock-tests';
import { optionLetter } from '@/lib/questions';
import { useAnswerAutosave } from '@/lib/use-answer-autosave';
import type { SaveState } from '@/lib/use-answer-autosave';
import { usePortalAction } from '@/lib/use-portal-action';
import { saveMockAnswer, submitMockTest } from '@/services';
import type { AnswerChange, MockTakeQuestion, MockTestView, Result } from '@/services';

import { ConfirmDialog } from './ConfirmDialog';

// Only a chosen option is ever saved; a written answer does not exist in a mock test.
const NOT_AN_OPTION: Result = { ok: false, error: 'invalidInput' };

type MockTestTakeFormProps = {
  test: MockTestView;
  /** Called once the submit worked, so the page can load the result. */
  onSubmitted: () => void;
};

export function MockTestTakeForm({ test, onSubmitted }: MockTestTakeFormProps) {
  const [answers, setAnswers] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(test.questions.map((question) => [question.id, question.selectedOption])),
  );
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const submitAction = usePortalAction();

  const save = useCallback(
    (questionId: string, change: AnswerChange): Promise<Result> =>
      'option' in change && change.option !== null
        ? saveMockAnswer(test.id, questionId, change.option)
        : Promise.resolve(NOT_AN_OPTION),
    [test.id],
  );
  const autosave = useAnswerAutosave(save);

  const total = test.questions.length;
  const unanswered = unansweredCount(test.questions, answers);
  const question = test.questions[index] as MockTakeQuestion;

  function chooseOption(option: number) {
    setAnswers((current) => ({ ...current, [question.id]: option }));
    autosave.saveOption(question.id, option);
  }

  async function submit() {
    setConfirming(false);
    const done = await submitAction.run(async () => {
      await autosave.flushAll();
      return submitMockTest(test.id);
    });
    if (done) onSubmitted();
  }

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ fontWeight: 700 }} role="status">
        {MOCK_TAKE_PAGE.answered(total - unanswered, total)}
      </Typography>

      {autosave.lastError && (
        <Alert severity="error">
          {autosave.lastError === 'network'
            ? MOCK_TAKE_PAGE.saveFailed
            : PORTAL_ERRORS[autosave.lastError]}
        </Alert>
      )}

      <TakeQuestion
        key={question.id}
        number={index + 1}
        total={total}
        question={question}
        selected={answers[question.id] ?? null}
        saveState={autosave.states[question.id]}
        onOption={chooseOption}
      />

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {MOCK_TAKE_PAGE.previous}
        </Button>
        <Button
          variant="outlined"
          disabled={index === total - 1}
          onClick={() => setIndex(index + 1)}
        >
          {MOCK_TAKE_PAGE.next}
        </Button>
      </Stack>

      {submitAction.error && <Alert severity="error">{submitAction.error}</Alert>}
      <Box>
        <Button
          variant="contained"
          size="large"
          disabled={submitAction.busy}
          onClick={() => setConfirming(true)}
        >
          {submitAction.busy ? MOCK_TAKE_PAGE.submitting : MOCK_TAKE_PAGE.submit}
        </Button>
      </Box>

      <ConfirmDialog
        open={confirming}
        title={MOCK_TAKE_PAGE.confirmSubmitTitle}
        text={MOCK_TAKE_PAGE.confirmSubmitText(unanswered)}
        confirmLabel={MOCK_TAKE_PAGE.submit}
        busy={submitAction.busy}
        onConfirm={submit}
        onClose={() => setConfirming(false)}
      />
    </Stack>
  );
}

type TakeQuestionProps = {
  number: number;
  total: number;
  question: MockTakeQuestion;
  selected: number | null;
  saveState: SaveState | undefined;
  onOption: (option: number) => void;
};

function TakeQuestion({
  number,
  total,
  question,
  selected,
  saveState,
  onOption,
}: TakeQuestionProps) {
  const headingId = useId();
  const legendId = useId();

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby={headingId}
      sx={{ p: { xs: 3, sm: 4 } }}
    >
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography id={headingId} component="h2" sx={{ fontWeight: 700 }}>
            {MOCK_TAKE_PAGE.questionOf(number, total)}
          </Typography>
          <SaveStatus state={saveState} />
        </Stack>

        <FormControl component="fieldset">
          {/* Plain text only: React escapes it; line breaks are kept. */}
          <FormLabel
            component="legend"
            id={legendId}
            sx={{ whiteSpace: 'pre-line', fontSize: '1.125rem', color: 'text.primary', mb: 2 }}
          >
            {question.prompt}
          </FormLabel>
          <RadioGroup
            aria-labelledby={legendId}
            value={selected === null ? '' : String(selected)}
            onChange={(event) => onOption(Number(event.target.value))}
          >
            <Stack spacing={1.5}>
              {question.options.map((option, optionIndex) => {
                const chosen = selected === optionIndex;
                return (
                  <FormControlLabel
                    key={optionLetter(optionIndex)}
                    value={String(optionIndex)}
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1}>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {optionLetter(optionIndex)}
                        </Typography>
                        <Typography component="span">{option}</Typography>
                      </Stack>
                    }
                    sx={{
                      m: 0,
                      px: 2,
                      py: 1,
                      minHeight: 48,
                      border: 1,
                      borderRadius: 2,
                      borderColor: chosen ? 'primary.main' : 'divider',
                      bgcolor: chosen ? 'action.selected' : 'transparent',
                    }}
                  />
                );
              })}
            </Stack>
          </RadioGroup>
        </FormControl>
      </Stack>
    </Paper>
  );
}

/** "Saving…" while a save is on its way, then "Saved" (announced politely to screen readers). */
function SaveStatus({ state }: { state: SaveState | undefined }) {
  if (!state) return null;
  if (state === 'error') {
    return (
      <Typography variant="caption" color="error" role="status">
        {MOCK_TAKE_PAGE.notSaved}
      </Typography>
    );
  }
  return (
    <Typography
      variant="caption"
      color="textSecondary"
      role="status"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      {state === 'saved' && <CheckIcon fontSize="inherit" />}
      {state === 'saving' ? MOCK_TAKE_PAGE.saving : MOCK_TAKE_PAGE.saved}
    </Typography>
  );
}
