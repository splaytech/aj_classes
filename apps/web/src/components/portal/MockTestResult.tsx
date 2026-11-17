// The result of a submitted mock test (design §4.4): "N of M correct", then each question with
// the person's choice, the correct option and the explanation. Only a submitted test has these
// keys, so this component is only shown for `submitted`.

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';

import { MOCK_RESULT } from '@/constants';
import { mockScoreText } from '@/lib/mock-tests';
import { optionLetter } from '@/lib/questions';
import type { MockTakeQuestion, MockTestView } from '@/services';

import { SectionCard } from './Panels';

type MockTestResultProps = {
  test: MockTestView;
  /** Move focus to the result heading when it appears (right after Submit). */
  focusOnShow?: boolean;
};

export function MockTestResult({ test, focusOnShow = false }: MockTestResultProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnShow) headingRef.current?.focus();
  }, [focusOnShow]);

  return (
    <Stack spacing={4}>
      <SectionCard title={MOCK_RESULT.heading} headingRef={headingRef}>
        {test.score !== null && test.total !== null && (
          <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
            {mockScoreText(test.score, test.total)}
          </Typography>
        )}
      </SectionCard>

      <SectionCard title={MOCK_RESULT.answersHeading}>
        <Stack spacing={3}>
          {test.questions.map((question, index) => (
            <ResultQuestion key={question.id} number={index + 1} question={question} />
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

/** "B  Option text", or "No answer." when the question was left blank. */
function chosenText(question: MockTakeQuestion, option: number | null | undefined): string {
  const text = option == null ? undefined : question.options[option];
  return option == null || text === undefined
    ? MOCK_RESULT.noAnswer
    : MOCK_RESULT.choice(optionLetter(option), text);
}

function ResultQuestion({ number, question }: { number: number; question: MockTakeQuestion }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography component="h3" sx={{ fontWeight: 700 }}>
          {MOCK_RESULT.question(number)}
        </Typography>
        {/* Plain text only: React escapes it; line breaks are kept. */}
        <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {question.prompt}
        </Typography>
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          {MOCK_RESULT.line(MOCK_RESULT.yourAnswer, chosenText(question, question.selectedOption))}
        </Typography>
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          {MOCK_RESULT.line(
            MOCK_RESULT.correctAnswer,
            chosenText(question, question.correctOption),
          )}
        </Typography>
        {question.explanation && (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            {MOCK_RESULT.line(MOCK_RESULT.explanation, question.explanation)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
