import { describe, expect, it } from 'vitest';

import type { EmailProblem, EmailProblemReason, EmailProblemState } from '@/services';

import { describeEmailProblem } from './email-problems';

// Every code admin_email_problems can return (migration 20261025110000, step 8).
const STATES: EmailProblemState[] = ['failed', 'waiting'];
const REASONS: EmailProblemReason[] = [
  'rejected',
  'rate_limited',
  'server_error',
  'network',
  'no_address',
  'max_attempts',
  'config_missing',
  'daily_limit',
  'retrying',
  'not_attempted',
];
const ROLES: EmailProblem['recipientRole'][] = ['student', 'parent'];

function problem(overrides: Partial<EmailProblem>): EmailProblem {
  return {
    id: 'p1',
    at: '2026-10-25T01:00:00Z',
    recipientRole: 'parent',
    assignmentTitle: 'Paper one',
    state: 'failed',
    reason: 'rejected',
    ...overrides,
  };
}

describe('describeEmailProblem', () => {
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
      state: 'Waiting',
      reason: 'Set-up error',
      role: 'Parent',
    });
    expect(describeEmailProblem(problem({ reason: 'daily_limit' })).reason).toBe('Daily limit');
  });
});
