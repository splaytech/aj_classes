// Answering an online assignment (R3b story FS2): one card per question, multiple-choice answers
// as large tap targets, written answers with a character count, autosave with "Saving…/Saved",
// a progress bar, and Hand in with a confirmation that counts unanswered questions.

import CheckIcon from '@mui/icons-material/Check';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useId, useState } from 'react';

import { PORTAL_ERRORS, QUESTION_LIMITS, SOLVE_PAGE } from '@/constants';
import type { FamilyStatus } from '@/constants';
import { answeredCount } from '@/lib/family-progress';
import { optionLetter } from '@/lib/questions';
import { useAnswerAutosave } from '@/lib/use-answer-autosave';
import type { SaveState } from '@/lib/use-answer-autosave';
import { usePortalAction } from '@/lib/use-portal-action';
import { saveMyAnswer, submitMyAssignment } from '@/services';
import type { AnswerChange, FamilyAssignmentView, FamilyQuestion } from '@/services';

import { ConfirmDialog } from './ConfirmDialog';

type Answer = Pick<FamilyQuestion, 'selectedOption' | 'response'>;

type SolveFormProps = {
  view: FamilyAssignmentView;
  onHandedIn: (status: FamilyStatus) => void;
};

export function SolveForm({ view, onHandedIn }: SolveFormProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      view.questions.map((question) => [
        question.id,
        { selectedOption: question.selectedOption, response: question.response },
      ]),
    ),
  );
  const save = useCallback(
    (questionId: string, change: AnswerChange) => saveMyAnswer(view.id, questionId, change),
    [view.id],
  );
  const autosave = useAnswerAutosave(save);
  const submitAction = usePortalAction();
  const [confirming, setConfirming] = useState(false);

  const total = view.questions.length;
  const answered = answeredCount(Object.values(answers));

  function update(questionId: string, change: Partial<Answer>) {
    setAnswers((current) => ({
      ...current,
      [questionId]: { ...(current[questionId] as Answer), ...change },
    }));
  }

  function chooseOption(questionId: string, option: number) {
    update(questionId, { selectedOption: option });
    autosave.saveOption(questionId, option);
  }

  function writeAnswer(questionId: string, text: string) {
    update(questionId, { response: text });
    autosave.saveTextSoon(questionId, text);
  }

  async function handIn() {
    setConfirming(false);
    let status: FamilyStatus | null = null;
    const done = await submitAction.run(async () => {
      await autosave.flushAll();
      const result = await submitMyAssignment(view.id);
      if (result.ok) status = result.data;
      return result;
    });
    if (done && status) onHandedIn(status);
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          py: 2,
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
          {SOLVE_PAGE.progress(answered, total)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={total === 0 ? 0 : (answered / total) * 100}
          aria-label={SOLVE_PAGE.progress(answered, total)}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {autosave.lastError && (
        <Alert severity="error">
          {autosave.lastError === 'network'
            ? SOLVE_PAGE.saveFailed
            : PORTAL_ERRORS[autosave.lastError]}
        </Alert>
      )}

      {view.questions.map((question, index) => (
        <SolveQuestion
          key={question.id}
          number={index + 1}
          question={question}
          answer={answers[question.id] as Answer}
          saveState={autosave.states[question.id]}
          onOption={(option) => chooseOption(question.id, option)}
          onText={(text) => writeAnswer(question.id, text)}
          onDoneTyping={() => void autosave.flushText(question.id)}
        />
      ))}

      {submitAction.error && <Alert severity="error">{submitAction.error}</Alert>}
      <Box>
        <Button
          variant="contained"
          size="large"
          disabled={submitAction.busy}
          onClick={() => setConfirming(true)}
        >
          {submitAction.busy ? SOLVE_PAGE.submitting : SOLVE_PAGE.submit}
        </Button>
      </Box>

      <ConfirmDialog
        open={confirming}
        title={SOLVE_PAGE.confirmSubmitTitle}
        text={SOLVE_PAGE.confirmSubmitText(total - answered)}
        confirmLabel={SOLVE_PAGE.submit}
        busy={submitAction.busy}
        onConfirm={handIn}
        onClose={() => setConfirming(false)}
      />
    </Stack>
  );
}

type SolveQuestionProps = {
  number: number;
  question: FamilyQuestion;
  answer: Answer;
  saveState: SaveState | undefined;
  onOption: (option: number) => void;
  onText: (text: string) => void;
  onDoneTyping: () => void;
};

function SolveQuestion({
  number,
  question,
  answer,
  saveState,
  onOption,
  onText,
  onDoneTyping,
}: SolveQuestionProps) {
  const headingId = useId();

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
            {SOLVE_PAGE.questionNumber(number)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <SaveStatus state={saveState} />
            <Chip size="small" variant="outlined" label={SOLVE_PAGE.marks(question.marks)} />
          </Stack>
        </Stack>

        {/* Plain text only (R3b F16): React escapes it; line breaks are kept. */}
        <Typography sx={{ whiteSpace: 'pre-line', fontSize: '1.125rem' }}>
          {question.prompt}
        </Typography>

        {question.kind === 'multiple_choice' ? (
          <RadioGroup
            aria-label={SOLVE_PAGE.optionsLabel(number)}
            value={answer.selectedOption === null ? '' : String(answer.selectedOption)}
            onChange={(event) => onOption(Number(event.target.value))}
          >
            <Stack spacing={1.5}>
              {question.options.map((option, index) => {
                const chosen = answer.selectedOption === index;
                return (
                  <FormControlLabel
                    key={optionLetter(index)}
                    value={String(index)}
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1}>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {optionLetter(index)}
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
        ) : (
          <TextField
            label={SOLVE_PAGE.writtenLabel}
            value={answer.response}
            onChange={(event) => onText(event.target.value)}
            onBlur={onDoneTyping}
            helperText={SOLVE_PAGE.characters(answer.response.length, QUESTION_LIMITS.answerMax)}
            slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.answerMax } }}
            multiline
            minRows={4}
            fullWidth
          />
        )}
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
        {SOLVE_PAGE.notSaved}
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
      {state === 'saving' ? SOLVE_PAGE.saving : SOLVE_PAGE.saved}
    </Typography>
  );
}
