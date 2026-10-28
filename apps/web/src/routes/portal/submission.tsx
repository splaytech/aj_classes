// Marking one student's online work (R3b story FT3): their answers, marks and feedback for the
// written answers, feedback for multiple choice (it marks itself; item 7 AC-7.4), an overall
// comment, then Return to student.
// The database refuses marks above a question's marks and returning with unmarked answers.

import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  ConfirmDialog,
  LoadError,
  NotFoundPanel,
  PageHeader,
  SectionCard,
} from '@/components/portal';
import {
  ASSIGNMENT_LIMITS,
  ONLINE_STATUS_LABELS,
  PORTAL_SEO,
  QUESTION_LIMITS,
  SUBMISSION_PAGE,
  assignmentPath,
} from '@/constants';
import { isLate } from '@/lib/assignments';
import { formatDateTime } from '@/lib/format';
import { formatMarks, optionLetter, parseAnswerMark } from '@/lib/questions';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { getSubmission, saveSubmission } from '@/services';
import type { AnswerMark, Question, Submission, SubmissionAnswer } from '@/services';

type MarkDraft = { markText: string; feedback: string };

const HANDED_IN = new Set(['submitted', 'marked', 'returned']);
const FORM_ERROR = 'form';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.submission);
}

// Access is checked by the staff layout; the database only returns work this person may mark.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getSubmission(params.assignmentId ?? '', params.studentId ?? '');
}

export default function SubmissionPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;
  }
  return <SubmissionForm submission={loaded.data} onSaved={() => revalidator.revalidate()} />;
}

function SubmissionForm({ submission, onSaved }: { submission: Submission; onSaved: () => void }) {
  const { assignment, student, result, answers } = submission;
  const handedIn = result !== null && HANDED_IN.has(result.status);
  const isReturned = result?.status === 'returned';
  const answerFor = (questionId: string) =>
    answers.find((answer) => answer.questionId === questionId) ?? null;

  const [drafts, setDrafts] = useState<Record<string, MarkDraft>>(() =>
    Object.fromEntries(
      assignment.questions.map((question) => {
        const answer = answerFor(question.id);
        const marks = answer?.awardedMarks ?? null;
        const draft = {
          markText: marks === null ? '' : String(marks),
          feedback: answer?.feedback ?? '',
        };
        return [question.id, draft];
      }),
    ),
  );
  const [comment, setComment] = useState(result?.feedback ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const action = usePortalAction();

  function updateDraft(questionId: string, change: Partial<MarkDraft>) {
    setDrafts({ ...drafts, [questionId]: { ...drafts[questionId], ...change } as MarkDraft });
  }

  /** Every answer's mark (written) and feedback, or the problems to fix first. */
  function collectMarks(): { marks: AnswerMark[]; problems: Record<string, string> } {
    const problems: Record<string, string> = {};
    const marks = assignment.questions.map((question): AnswerMark => {
      const draft = drafts[question.id] ?? { markText: '', feedback: '' };
      const tooLong = draft.feedback.length > QUESTION_LIMITS.answerFeedbackMax;
      if (question.kind === 'multiple_choice') {
        if (tooLong) problems[question.id] = SUBMISSION_PAGE.feedbackLength;
        return { questionId: question.id, feedback: draft.feedback }; // the automatic mark stays
      }
      const parsed = parseAnswerMark(draft.markText, question.marks);
      if (parsed.error) problems[question.id] = parsed.error;
      else if (tooLong) problems[question.id] = SUBMISSION_PAGE.feedbackLength;
      return { questionId: question.id, awardedMarks: parsed.value, feedback: draft.feedback };
    });
    return { marks, problems };
  }

  async function save(returnWork: boolean) {
    setConfirmingReturn(false); // the outcome shows by the buttons
    const { marks, problems } = collectMarks();
    if (returnWork && marks.some((mark) => mark.awardedMarks === null)) {
      problems[FORM_ERROR] = SUBMISSION_PAGE.needsAllMarks;
    }
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const saved = await action.run(
      () => saveSubmission(assignment.id, student.id, marks, comment, returnWork),
      returnWork ? SUBMISSION_PAGE.returned : SUBMISSION_PAGE.saved,
    );
    if (saved) onSaved();
  }

  const score = currentScore(assignment.questions, answers, drafts);
  const late = isLate(result?.submittedAt ?? null, assignment.dueOn);

  return (
    <>
      <PageHeader
        title={SUBMISSION_PAGE.heading(student.fullName)}
        intro={assignment.title}
        back={{ to: assignmentPath(assignment.id), label: SUBMISSION_PAGE.back(assignment.title) }}
        meta={
          <>
            <Chip
              size="small"
              variant="outlined"
              color={isReturned ? 'success' : 'default'}
              label={ONLINE_STATUS_LABELS[result?.status ?? 'not_submitted']}
            />
            {result?.submittedAt && (
              <Typography variant="body2" color="textSecondary">
                {SUBMISSION_PAGE.submittedOn(formatDateTime(result.submittedAt))}
              </Typography>
            )}
            {late && <Chip size="small" color="warning" label={SUBMISSION_PAGE.late} />}
            {result?.returnedAt && (
              <Typography variant="body2" color="textSecondary">
                {SUBMISSION_PAGE.returnedOn(formatDateTime(result.returnedAt))}
              </Typography>
            )}
            {handedIn && assignment.totalMarks !== null && (
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {SUBMISSION_PAGE.score(formatMarks(score), assignment.totalMarks)}
              </Typography>
            )}
          </>
        }
      />

      <Stack spacing={4}>
        {!handedIn && <Alert severity="info">{SUBMISSION_PAGE.notSubmitted}</Alert>}
        {isReturned && <Alert severity="info">{SUBMISSION_PAGE.returnedNote}</Alert>}

        {assignment.questions.map((question, index) => (
          <AnswerCard
            key={question.id}
            number={index + 1}
            question={question}
            answer={answerFor(question.id)}
            draft={handedIn ? drafts[question.id] : undefined}
            error={errors[question.id] ?? ''}
            onChange={(change) => updateDraft(question.id, change)}
          />
        ))}

        {handedIn && (
          <SectionCard title={SUBMISSION_PAGE.commentHeading}>
            <Stack spacing={3}>
              <TextField
                label={SUBMISSION_PAGE.commentLabel}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                helperText={SUBMISSION_PAGE.commentHint}
                slotProps={{ htmlInput: { maxLength: ASSIGNMENT_LIMITS.feedbackMax } }}
                multiline
                minRows={3}
              />
              {errors[FORM_ERROR] && <Alert severity="error">{errors[FORM_ERROR]}</Alert>}
              {action.error && <Alert severity="error">{action.error}</Alert>}
              {action.notice && <Alert severity="success">{action.notice}</Alert>}
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button
                  variant={isReturned ? 'contained' : 'outlined'}
                  disabled={action.busy}
                  onClick={() => save(false)}
                >
                  {action.busy ? SUBMISSION_PAGE.saving : SUBMISSION_PAGE.save}
                </Button>
                {!isReturned && (
                  <Button
                    variant="contained"
                    disabled={action.busy}
                    onClick={() => setConfirmingReturn(true)}
                  >
                    {SUBMISSION_PAGE.returnWork}
                  </Button>
                )}
              </Stack>
            </Stack>
          </SectionCard>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmingReturn}
        title={SUBMISSION_PAGE.confirmReturnTitle}
        text={SUBMISSION_PAGE.confirmReturnText(student.fullName)}
        confirmLabel={SUBMISSION_PAGE.returnWork}
        busy={action.busy}
        onConfirm={() => save(true)}
        onClose={() => setConfirmingReturn(false)}
      />
    </>
  );
}

/** Marks so far: automatic marks for multiple choice, plus the tutor's marks typed in. */
function currentScore(
  questions: Question[],
  answers: SubmissionAnswer[],
  drafts: Record<string, MarkDraft>,
): number {
  return questions.reduce((sum, question) => {
    if (question.kind === 'written') {
      const parsed = parseAnswerMark(drafts[question.id]?.markText ?? '', question.marks);
      return sum + (parsed.value ?? 0);
    }
    const answer = answers.find((item) => item.questionId === question.id);
    return sum + (answer?.awardedMarks ?? 0);
  }, 0);
}

type AnswerCardProps = {
  number: number;
  question: Question;
  answer: SubmissionAnswer | null;
  draft: MarkDraft | undefined; // undefined: not handed in yet, so nothing to mark
  error: string;
  onChange: (change: Partial<MarkDraft>) => void;
};

function AnswerCard({ number, question, answer, draft, error, onChange }: AnswerCardProps) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: 4 }}>
      <Stack spacing={3}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
          {SUBMISSION_PAGE.questionNumber(number)}
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-line' }}>{question.prompt}</Typography>

        {question.kind === 'multiple_choice' ? (
          <MultipleChoiceAnswer question={question} answer={answer} />
        ) : (
          <Paper variant="outlined" sx={{ p: 3, bgcolor: 'action.hover' }}>
            <Typography sx={{ whiteSpace: 'pre-line' }}>
              {answer?.response.trim() ? answer.response : SUBMISSION_PAGE.noAnswer}
            </Typography>
          </Paper>
        )}

        {question.kind === 'multiple_choice' && draft && (
          <TextField
            size="small"
            label={SUBMISSION_PAGE.feedbackLabel}
            value={draft.feedback}
            onChange={(event) => onChange({ feedback: event.target.value })}
            error={Boolean(error)}
            helperText={error}
            slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.answerFeedbackMax } }}
            multiline
            minRows={2}
            fullWidth
          />
        )}

        {question.kind === 'written' && draft && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <TextField
              size="small"
              type="number"
              label={SUBMISSION_PAGE.marksLabel(question.marks)}
              value={draft.markText}
              onChange={(event) => onChange({ markText: event.target.value })}
              error={Boolean(error)}
              helperText={error}
              slotProps={{ htmlInput: { min: 0, max: question.marks, step: 0.5 } }}
              sx={{ minWidth: 180 }}
            />
            <TextField
              size="small"
              label={SUBMISSION_PAGE.feedbackLabel}
              value={draft.feedback}
              onChange={(event) => onChange({ feedback: event.target.value })}
              slotProps={{ htmlInput: { maxLength: QUESTION_LIMITS.answerFeedbackMax } }}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function MultipleChoiceAnswer({
  question,
  answer,
}: {
  question: Question;
  answer: SubmissionAnswer | null;
}) {
  const chosen = answer?.selectedOption ?? null;

  return (
    <Stack spacing={2}>
      <Stack component="ol" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {question.options.map((option, index) => (
          <Stack
            component="li"
            key={optionLetter(index)}
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography component="span" sx={{ minWidth: 24, fontWeight: 700 }}>
              {optionLetter(index)}
            </Typography>
            <Typography component="span">{option}</Typography>
            {index === chosen && (
              <Chip
                size="small"
                color={chosen === question.correctOption ? 'success' : 'error'}
                label={SUBMISSION_PAGE.chosen}
              />
            )}
            {index === question.correctOption && (
              <Chip
                size="small"
                variant="outlined"
                color="success"
                icon={<CheckCircleOutlined />}
                label={SUBMISSION_PAGE.correct}
              />
            )}
          </Stack>
        ))}
      </Stack>
      {chosen === null && <Typography color="textSecondary">{SUBMISSION_PAGE.noAnswer}</Typography>}
      {answer?.awardedMarks !== null && answer?.awardedMarks !== undefined && (
        <Typography variant="body2" color="textSecondary">
          {SUBMISSION_PAGE.autoMarked(formatMarks(answer.awardedMarks), question.marks)}
        </Typography>
      )}
    </Stack>
  );
}
