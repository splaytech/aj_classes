// What admins can do with an enquiry, and what to tell them after a retry (leads-and-crm.md §5).

import { ENQUIRIES_PAGE } from '@/constants';
import type { CrmStatus } from '@/constants';
import type { ResyncOutcome } from '@/services';

/** Retry makes sense when Zoho CRM hasn't got it yet; "off" means it isn't set up at all. */
export function canRetry(status: CrmStatus): boolean {
  return status === 'failed' || status === 'pending';
}

/** The notice (or error) to show after a retry. */
export function retryMessage(outcome: ResyncOutcome): { notice: string } | { error: string } {
  if (outcome.crmStatus === 'synced') return { notice: ENQUIRIES_PAGE.retried };
  if (outcome.crmStatus === 'off') return { error: ENQUIRIES_PAGE.stillOff };
  return { error: ENQUIRIES_PAGE.retryFailed(outcome.crmError ?? '') };
}
