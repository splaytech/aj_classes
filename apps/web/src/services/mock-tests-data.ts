// Turns the mock test functions' rows and JSON into app types (docs/delivery/2026-11-17-mock-tests,
// design §3). The taker JSON only has correct_option and explanation after the person submitted,
// so the mapper copies them only when they are there.

import type {
  MockAdminQuestion,
  MockTags,
  MockTakeQuestion,
  MockTakeStatus,
  MockTestListItem,
  MockTestStatus,
  MockTestSummary,
  MockTestView,
} from './types';

/** The four tag columns, as every mock test function and table read returns them. */
export type MockTagRow = {
  subject: string | null;
  stream: string | null;
  year_levels: number[];
  any_year: boolean;
};

export type MockSummaryRow = MockTagRow & {
  id: string;
  title: string;
  status: MockTestStatus;
  question_count: number;
  submitted_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  released_at: string | null;
  closes_at: string | null;
};

export type MockListRow = MockTagRow & {
  id: string;
  title: string;
  question_count: number;
  status: MockTakeStatus;
  score: number | null;
  total: number | null;
  submitted_at: string | null;
  closes_at: string | null;
};

export type MockQuestionRow = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correct_option: number;
  explanation: string;
};

/** JSON from mock_test_open. */
export type MockOpenJson = {
  id: string;
  title: string;
  instructions: string;
  status: MockTakeStatus;
  question_count: number;
  score: number | null;
  total: number | null;
  tags: MockTagRow;
  questions: {
    id: string;
    position: number;
    prompt: string;
    options: string[];
    selected_option: number | null;
    correct_option?: number;
    explanation?: string;
  }[];
};

export const MOCK_QUESTION_COLUMNS = 'id, position, prompt, options, correct_option, explanation';

export function toMockTags(row: MockTagRow): MockTags {
  return {
    subject: row.subject,
    stream: row.stream,
    yearLevels: row.year_levels,
    anyYear: row.any_year,
  };
}

/** The columns to write. Years go ascending: the database refuses any other order. */
export function toMockTagColumns(tags: MockTags): MockTagRow {
  return {
    subject: tags.subject,
    stream: tags.stream,
    year_levels: [...tags.yearLevels].sort((a, b) => a - b),
    any_year: tags.anyYear,
  };
}

export function toMockTestSummary(row: MockSummaryRow): MockTestSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    questionCount: row.question_count,
    submittedCount: row.submitted_count,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    releasedAt: row.released_at,
    closesAt: row.closes_at,
    tags: toMockTags(row),
  };
}

export function toMockTestListItem(row: MockListRow): MockTestListItem {
  return {
    id: row.id,
    title: row.title,
    questionCount: row.question_count,
    status: row.status,
    score: row.score,
    total: row.total,
    submittedAt: row.submitted_at,
    closesAt: row.closes_at,
    tags: toMockTags(row),
  };
}

export function toMockAdminQuestion(row: MockQuestionRow): MockAdminQuestion {
  return {
    id: row.id,
    position: row.position,
    prompt: row.prompt,
    options: row.options,
    correctOption: row.correct_option,
    explanation: row.explanation,
  };
}

function toMockTakeQuestion(json: MockOpenJson['questions'][number]): MockTakeQuestion {
  const question: MockTakeQuestion = {
    id: json.id,
    position: json.position,
    prompt: json.prompt,
    options: json.options,
    selectedOption: json.selected_option,
  };
  if (json.correct_option !== undefined) question.correctOption = json.correct_option;
  if (json.explanation !== undefined) question.explanation = json.explanation;
  return question;
}

export function toMockTestView(json: MockOpenJson): MockTestView {
  return {
    id: json.id,
    title: json.title,
    instructions: json.instructions,
    status: json.status,
    questionCount: json.question_count,
    score: json.score,
    total: json.total,
    tags: toMockTags(json.tags),
    questions: json.questions.map(toMockTakeQuestion),
  };
}
