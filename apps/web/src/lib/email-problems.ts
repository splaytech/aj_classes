// Labels for one row of the admin Emails page (AC-3.8, AC-8.13). Every kind, state, reason and
// recipient role the database can return has a label in EMAILS_PAGE.

import { EMAILS_PAGE } from '@/constants';
import type { EmailProblem } from '@/services';

export type EmailProblemLabels = { type: string; state: string; reason: string; role: string };

export function describeEmailProblem(problem: EmailProblem): EmailProblemLabels {
  return {
    type: EMAILS_PAGE.kinds[problem.kind],
    state: EMAILS_PAGE.states[problem.state],
    reason: EMAILS_PAGE.reasons[problem.reason],
    role: EMAILS_PAGE.roles[problem.recipientRole],
  };
}
