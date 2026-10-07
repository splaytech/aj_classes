// What students and parents see of a piece of work (R3b stories FS3, FP2): the progress
// summary, the score and tutor comment once returned, and the questions with answers. Marks,
// correct options, explanations and feedback only arrive from the database after return (F12).

import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PROGRESS_TEXT, RESULTS_TEXT, SCORE_TEXT, SOLVE_PAGE } from '@/constants';
import type { FamilyProgress } from '@/lib/family-progress';
import { percentOf } from '@/lib/family-progress';
import { formatMarks, optionLetter } from '@/lib/questions';
import type { FamilyAssignment, FamilyAssignmentView, FamilyQuestion } from '@/services';

import { SectionCard } from './Panels';

/** "6.5 / 8 (81%)", or just "Returned"-style text when there's no mark. */
export function scoreText(work: Pick<FamilyAssignment, 'mark' | 'totalMarks'>): string {
  if (work.mark === null || work.totalMarks === null) return SCORE_TEXT.noMark;
  return SCORE_TEXT.scoreWithPercent(
    formatMarks(work.mark),
    work.totalMarks,
    percentOf(work.mark, work.totalMarks),
  );
}

/** Done, average mark and on time, as three small cards. */
export function ProgressSummary({ progress }: { progress: FamilyProgress }) {
  const stats = [
    {
      label: PROGRESS_TEXT.done,
      value: PROGRESS_TEXT.doneValue(progress.completed, progress.assigned),
    },
    {
      label: PROGRESS_TEXT.average,
      value:
        progress.averagePercent === null
          ? PROGRESS_TEXT.noMarks
          : PROGRESS_TEXT.averageValue(progress.averagePercent),
    },
    {
      label: PROGRESS_TEXT.onTime,
      value:
        progress.handedIn === 0
          ? PROGRESS_TEXT.nothingHandedIn
          : PROGRESS_TEXT.onTimeValue(progress.onTime, progress.handedIn),
    },
  ];

  return (
    <Box
      component="section"
      aria-label={PROGRESS_TEXT.heading}
      sx={{ display: 'grid', gap: { xs: 2, sm: 3 }, gridTemplateColumns: 'repeat(3, 1fr)' }}
    >
      {stats.map((stat) => (
        <Card key={stat.label} variant="outlined">
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography
              component="p"
              sx={{ fontWeight: 700, fontSize: { xs: '1.125rem', sm: '1.5rem' }, lineHeight: 1.2 }}
            >
              {stat.value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stat.label}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

/** The score and the tutor's overall comment, once the work is returned. */
export function ResultsCard({ view, heading }: { view: FamilyAssignmentView; heading: string }) {
  return (
    <SectionCard title={heading}>
      <Stack spacing={2}>
        <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
          {scoreText(view)}
        </Typography>
        {view.comment && (
          <Box>
            <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700 }}>
              {RESULTS_TEXT.commentHeading}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-line' }}>{view.comment}</Typography>
          </Box>
        )}
      </Stack>
    </SectionCard>
  );
}

type AnswersListProps = {
  questions: FamilyQuestion[];
  /** "Your answer" for the student, "Their answer" for a parent. */
  answerLabel: string;
};

/** Every question with the answer given; marks, correct options and feedback once returned. */
export function AnswersList({ questions, answerLabel }: AnswersListProps) {
  return (
    <Stack spacing={3}>
      {questions.map((question, index) => (
        <AnswerCard
          key={question.id}
          number={index + 1}
          question={question}
          answerLabel={answerLabel}
        />
      ))}
    </Stack>
  );
}

/** Before return there's no right or wrong yet; after it, green or red. */
function answerColour(question: FamilyQuestion, index: number): 'primary' | 'success' | 'error' {
  if (question.correctOption === null) return 'primary';
  return index === question.correctOption ? 'success' : 'error';
}

function AnswerCard({
  number,
  question,
  answerLabel,
}: {
  number: number;
  question: FamilyQuestion;
  answerLabel: string;
}) {
  const isMarked = question.awardedMarks !== null;
  const fullMarks = question.awardedMarks === question.marks;

  return (
    <Paper variant="outlined" component="section" sx={{ p: { xs: 3, sm: 4 } }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography component="h3" sx={{ fontWeight: 700 }}>
            {SOLVE_PAGE.questionNumber(number)}
          </Typography>
          {isMarked ? (
            <Chip
              size="small"
              color={fullMarks ? 'success' : 'default'}
              label={RESULTS_TEXT.awarded(formatMarks(question.awardedMarks ?? 0), question.marks)}
            />
          ) : (
            <Chip size="small" variant="outlined" label={SOLVE_PAGE.marks(question.marks)} />
          )}
        </Stack>
        {/* Plain text only (R3b F16): React escapes it; line breaks are kept. */}
        <Typography sx={{ whiteSpace: 'pre-line' }}>{question.prompt}</Typography>

        {question.kind === 'multiple_choice' ? (
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
                {index === question.selectedOption && (
                  <Chip size="small" color={answerColour(question, index)} label={answerLabel} />
                )}
                {index === question.correctOption && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="success"
                    icon={<CheckCircleOutlined />}
                    label={RESULTS_TEXT.correctAnswer}
                  />
                )}
              </Stack>
            ))}
            {question.selectedOption === null && (
              <Typography color="text.secondary">{RESULTS_TEXT.noAnswer}</Typography>
            )}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 3, bgcolor: 'action.hover' }}>
            <Typography sx={{ whiteSpace: 'pre-line' }}>
              {question.response.trim() ? question.response : RESULTS_TEXT.noAnswer}
            </Typography>
          </Paper>
        )}

        {question.feedback && (
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {RESULTS_TEXT.feedback(question.feedback)}
          </Typography>
        )}
        {question.explanation && (
          <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {RESULTS_TEXT.explanation(question.explanation)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
