import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_PASS_LABELS, MOCK_RESULTS_PAGE } from '@/constants';
import { formatDateTime } from '@/lib/format';
import type { MockResultRow } from '@/services';

import { MockResultsTable } from './MockResultsTable';

function row(attemptId: string, overrides: Partial<MockResultRow> = {}): MockResultRow {
  return {
    attemptId,
    takerName: 'Sam Student',
    submittedAt: '2026-11-18T01:00:00Z',
    score: 3,
    total: 5,
    percentage: 60,
    passed: true,
    ...overrides,
  };
}

describe('MockResultsTable (AC 28 to 37)', () => {
  it('has the five headers in order, and a label for screen readers', () => {
    render(<MockResultsTable rows={[row('a1')]} />);
    const table = screen.getByRole('table', { name: MOCK_RESULTS_PAGE.tableLabel });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    const { name, submitted, score, percentage, result } = MOCK_RESULTS_PAGE.columns;
    expect(headers).toEqual([name, submitted, score, percentage, result]);
  });

  it('shows one row per submission with name, time, score, percentage and label', () => {
    render(
      <MockResultsTable
        rows={[row('a1'), row('a2', { takerName: 'Pat', score: 1, percentage: 20, passed: false })]}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(first).toEqual([
      'Sam Student',
      formatDateTime('2026-11-18T01:00:00Z'),
      MOCK_RESULTS_PAGE.score(3, 5),
      MOCK_RESULTS_PAGE.percent(60),
      MOCK_PASS_LABELS.pass,
    ]);
    expect(within(rows[1]!).getByText(MOCK_PASS_LABELS.notYet)).toBeInTheDocument();
  });

  it('shows "Name not set" for a null name and an empty Result cell with no pass mark', () => {
    render(<MockResultsTable rows={[row('a1', { takerName: null, passed: null })]} />);
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent(MOCK_RESULTS_PAGE.nameNotSet);
    expect(cells[4]).toBeEmptyDOMElement();
  });

  it('has no button, link, form control or e-mail (AC 35)', () => {
    render(<MockResultsTable rows={[row('a1')]} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it('renders every row it is given (1000 rows)', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => row(`a${index}`));
    render(<MockResultsTable rows={rows} />);
    expect(screen.getAllByRole('row')).toHaveLength(1001);
  });
});
