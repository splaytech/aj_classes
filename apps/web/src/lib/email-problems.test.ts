import { describe, expect, it } from 'vitest';

import type { EmailKind, EmailProblem, EmailProblemReason, EmailProblemState } from '@/services';

import { describeEmailProblem } from './email-problems';

// Every code admin_email_problems can return (migrations 20261025110000 step 8, 20261028100000
// step 10), and every email_outbox.kind.
const KINDS: EmailKind[] = ['work_returned', 'new_assignment', 'due_tomorrow'];
const STATES: EmailProblemState[] = ['failed', 'waiting'];
const REASONS: EmailProblemReason[] = [
  'rejected',
  'rate_limited',
  'server_error',
  'network',
  'no_address',
  'max_attempts',
  'config_missing',
  'too_late',
  'daily_limit',
  'retrying',
  'not_attempted',
];
const ROLES: EmailProblem['recipientRole'][] = ['student', 'parent'];

function problem(overrides: Partial<EmailProblem>): EmailProblem {
  return {
    id: 'p1',
    at: '2026-10-25T01:00:00Z',
    kind: 'work_returned',
    recipientRole: 'parent',
    assignmentTitle: 'Paper one',
    state: 'failed',
    reason: 'rejected',
    ...overrides,
  };
}

describe('describeEmailProblem', () => {
  it.each(KINDS)('labels the %s type', (kind) => {
    expect(describeEmailProblem(problem({ kind })).type).toMatch(/\S/);
  });

  it('names each type and the too-late reason as admins see them (AC-8.7, AC-8.13)', () => {
    expect(describeEmailProblem(problem({ kind: 'due_tomorrow', reason: 'too_late' }))).toEqual({
      type: 'Due tomorrow',
      state: 'Failed',
      reason: 'Too late to send',
      role: 'Parent',
    });
    expect(describeEmailProblem(problem({ kind: 'new_assignment' })).type).toBe('New assignment');
    expect(describeEmailProblem(problem({ kind: 'work_returned' })).type).toBe('Work returned');
  });

  it.each(STATES)('labels the %s state', (state) => {
    expect(describeEmailProblem(problem({ state })).state).toMatch(/\S/);
  });

  it.each(REASONS)('labels the %s reason', (reason) => {
    expect(describeEmailProblem(problem({ reason })).reason).toMatch(/\S/);
  });

  it.each(ROLES)('labels the %s recipient', (recipientRole) => {
    expect(describeEmailProblem(problem({ recipientRole })).role).toMatch(/\S/);
  });

  it('uses the admin wording for a set-up problem and the daily limit', () => {
    expect(describeEmailProblem(problem({ state: 'waiting', reason: 'config_missing' }))).toEqual({
      type: 'Work returned',
      state: 'Waiting',
      reason: 'Set-up error',
      role: 'Parent',
    });
    expect(describeEmailProblem(problem({ reason: 'daily_limit' })).reason).toBe('Daily limit');
  });
});
