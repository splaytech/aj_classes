// The questions of an assignment, for staff (R3b story FT1): add, edit, delete and reorder while
// it's a draft; read-only once published (F9). Staff see the correct options and explanations.

import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  QUESTION_BUILDER,
  QUESTION_KIND_LABELS,
  QUESTION_LIMITS,
  SUBMISSION_PAGE,
} from '@/constants';
import { optionLetter, totalMarks } from '@/lib/questions';
import { usePortalAction } from '@/lib/use-portal-action';
import { deleteQuestion, moveQuestion, saveQuestion } from '@/services';
import type { Question } from '@/services';

import { ConfirmDialog } from './ConfirmDialog';
import { SectionCard } from './Panels';
import { QuestionDialog } from './QuestionDialog';

type QuestionListProps = {
  assignmentId: string;
  questions: Question[];
  editable: boolean;
  onChanged: () => void;
};

export function QuestionList({ assignmentId, questions, editable, onChanged }: QuestionListProps) {
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const action = usePortalAction();

  async function move(question: Question, step: -1 | 1) {
    if (await action.run(() => moveQuestion(question.id, step))) onChanged();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const deleted = await action.run(() => deleteQuestion(deleting.id));
    setDeleting(null);
    if (deleted) onChanged();
  }

  return (
    <SectionCard
      title={QUESTION_BUILDER.heading}
      action={
        questions.length > 0 && (
          <Typography color="text.secondary">
            {QUESTION_BUILDER.total(totalMarks(questions))}
          </Typography>
        )
      }
    >
      <Stack spacing={3}>
        {!editable && questions.length > 0 && (
          <Alert severity="info">{QUESTION_BUILDER.lockedNote}</Alert>
        )}
        {action.error && <Alert severity="error">{action.error}</Alert>}
        {questions.length === 0 && (
          <Typography color="text.secondary">{QUESTION_BUILDER.empty}</Typography>
        )}

        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            number={index + 1}
            actions={
              editable && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <IconButton
                    aria-label={QUESTION_BUILDER.moveUp(index + 1)}
                    disabled={index === 0 || action.busy}
                    onClick={() => move(question, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={QUESTION_BUILDER.moveDown(index + 1)}
                    disabled={index === questions.length - 1 || action.busy}
                    onClick={() => move(question, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <Button size="small" onClick={() => setEditing(question)}>
                    {QUESTION_BUILDER.edit}
                  </Button>
                  <Button size="small" color="error" onClick={() => setDeleting(question)}>
                    {QUESTION_BUILDER.delete}
                  </Button>
                </Stack>
              )
            }
          />
        ))}

        {editable &&
          (questions.length < QUESTION_LIMITS.questionsMax ? (
            <Box>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
                {QUESTION_BUILDER.add}
              </Button>
            </Box>
          ) : (
            <Typography color="text.secondary">{QUESTION_BUILDER.limitReached}</Typography>
          ))}
      </Stack>

      {editing && (
        <QuestionDialog
          open
          assignmentId={assignmentId}
          existing={editing === 'new' ? null : editing}
          onSave={saveQuestion}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={QUESTION_BUILDER.confirmDeleteTitle}
        text={deleting ? QUESTION_BUILDER.confirmDeleteText(questions.indexOf(deleting) + 1) : ''}
        confirmLabel={QUESTION_BUILDER.delete}
        destructive
        busy={action.busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </SectionCard>
  );
}

type QuestionCardProps = {
  question: Question;
  number: number;
  actions?: ReactNode;
};

/** One question as staff see it, with the correct option ticked. */
function QuestionCard({ question, number, actions }: QuestionCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography component="h3" sx={{ fontWeight: 700 }}>
              {SUBMISSION_PAGE.questionNumber(number)}
            </Typography>
            <Chip size="small" variant="outlined" label={QUESTION_KIND_LABELS[question.kind]} />
            <Chip size="small" variant="outlined" label={QUESTION_BUILDER.marks(question.marks)} />
          </Stack>
          {actions}
        </Stack>

        {/* Plain text only (R3b F16): React escapes it; line breaks are kept. */}
        <Typography sx={{ whiteSpace: 'pre-line' }}>{question.prompt}</Typography>

        {question.kind === 'multiple_choice' && (
          <Stack component="ol" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {question.options.map((option, index) => {
              const isCorrect = index === question.correctOption;
              return (
                <Stack
                  component="li"
                  key={optionLetter(index)}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', fontWeight: isCorrect ? 700 : 400 }}
                >
                  <Typography component="span" sx={{ minWidth: 24, fontWeight: 'inherit' }}>
                    {optionLetter(index)}
                  </Typography>
                  <Typography component="span" sx={{ fontWeight: 'inherit' }}>
                    {option}
                  </Typography>
                  {isCorrect && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<CheckCircleOutlined />}
                      label={QUESTION_BUILDER.correct}
                    />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}

        {question.explanation && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {QUESTION_BUILDER.explanation(question.explanation)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
