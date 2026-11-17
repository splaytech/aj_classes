// The questions of a mock test, for admins (design §4.4): numbered by order (not by the stored
// position, which keeps gaps after a delete), the correct option marked. A draft can be edited,
// reordered and added to up to the limit; a released test is read-only (AC 19).

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
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { MOCK_QUESTION_LIST, MOCK_TEST_LIMITS } from '@/constants';
import { optionLetter } from '@/lib/questions';
import { usePortalAction } from '@/lib/use-portal-action';
import { deleteMockQuestion, moveMockQuestion } from '@/services';
import type { MockAdminQuestion } from '@/services';

import { ConfirmDialog } from './ConfirmDialog';
import { MockQuestionDialog } from './MockQuestionDialog';
import { SectionCard } from './Panels';

type MockQuestionListProps = {
  testId: string;
  questions: MockAdminQuestion[];
  editable: boolean;
  onChanged: () => void;
};

export function MockQuestionList({
  testId,
  questions,
  editable,
  onChanged,
}: MockQuestionListProps) {
  const [editing, setEditing] = useState<MockAdminQuestion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MockAdminQuestion | null>(null);
  const action = usePortalAction();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingOnChange = useRef(false);

  // The Delete button of the removed question is gone, so focus would fall to the page body: move
  // it to the heading when the shorter list arrives.
  useEffect(() => {
    if (!focusHeadingOnChange.current) return;
    focusHeadingOnChange.current = false;
    headingRef.current?.focus();
  }, [questions]);
  const atLimit = questions.length >= MOCK_TEST_LIMITS.questionsMax;

  async function move(question: MockAdminQuestion, step: -1 | 1) {
    if (await action.run(() => moveMockQuestion(question.id, step))) onChanged();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const deleted = await action.run(() => deleteMockQuestion(deleting.id));
    setDeleting(null);
    if (!deleted) return;
    focusHeadingOnChange.current = true;
    onChanged();
  }

  return (
    <SectionCard
      title={MOCK_QUESTION_LIST.heading}
      headingRef={headingRef}
      action={
        <Typography color="textSecondary">{MOCK_QUESTION_LIST.count(questions.length)}</Typography>
      }
    >
      <Stack spacing={3}>
        {!editable && questions.length > 0 && (
          <Alert severity="info">{MOCK_QUESTION_LIST.lockedNote}</Alert>
        )}
        {action.error && <Alert severity="error">{action.error}</Alert>}
        {questions.length === 0 && (
          <Typography color="textSecondary">{MOCK_QUESTION_LIST.empty}</Typography>
        )}

        {questions.map((question, index) => (
          <MockQuestionCard
            key={question.id}
            question={question}
            number={index + 1}
            actions={
              editable && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <IconButton
                    aria-label={MOCK_QUESTION_LIST.moveUp(index + 1)}
                    disabled={index === 0 || action.busy}
                    onClick={() => move(question, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={MOCK_QUESTION_LIST.moveDown(index + 1)}
                    disabled={index === questions.length - 1 || action.busy}
                    onClick={() => move(question, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <Button size="small" onClick={() => setEditing(question)}>
                    {MOCK_QUESTION_LIST.edit}
                  </Button>
                  <Button size="small" color="error" onClick={() => setDeleting(question)}>
                    {MOCK_QUESTION_LIST.delete}
                  </Button>
                </Stack>
              )
            }
          />
        ))}

        {editable && (
          <Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setEditing('new')}
              disabled={atLimit}
            >
              {MOCK_QUESTION_LIST.add}
            </Button>
            {atLimit && (
              <Typography color="textSecondary" sx={{ mt: 1 }}>
                {MOCK_QUESTION_LIST.limitReached}
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      {editing && (
        <MockQuestionDialog
          open
          testId={testId}
          existing={editing === 'new' ? null : editing}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={MOCK_QUESTION_LIST.confirmDeleteTitle}
        text={deleting ? MOCK_QUESTION_LIST.confirmDeleteText(questions.indexOf(deleting) + 1) : ''}
        confirmLabel={MOCK_QUESTION_LIST.delete}
        destructive
        busy={action.busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </SectionCard>
  );
}

type MockQuestionCardProps = {
  question: MockAdminQuestion;
  number: number;
  actions?: ReactNode;
};

/** One question as admins see it, with the correct option ticked. */
function MockQuestionCard({ question, number, actions }: MockQuestionCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Typography component="h3" sx={{ fontWeight: 700 }}>
            {MOCK_QUESTION_LIST.number(number)}
          </Typography>
          {actions}
        </Stack>

        {/* Plain text only: React escapes it; line breaks are kept. */}
        <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {question.prompt}
        </Typography>

        <Stack component="ol" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {question.options.map((option, index) => {
            const isCorrect = index === question.correctOption;
            return (
              <Stack
                component="li"
                key={optionLetter(index)}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', fontWeight: isCorrect ? 700 : 400, minWidth: 0 }}
              >
                <Typography component="span" sx={{ minWidth: 24, fontWeight: 'inherit' }}>
                  {optionLetter(index)}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontWeight: 'inherit', minWidth: 0, overflowWrap: 'anywhere' }}
                >
                  {option}
                </Typography>
                {isCorrect && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    icon={<CheckCircleOutlined />}
                    label={MOCK_QUESTION_LIST.correct}
                  />
                )}
              </Stack>
            );
          })}
        </Stack>

        {question.explanation && (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            {MOCK_QUESTION_LIST.explanation(question.explanation)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
