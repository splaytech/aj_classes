// Sends a saved enquiry to Zoho CRM as a lead and records the outcome on its row.

import { serviceClient } from '../_shared/clients.ts';
import { sendToCrm } from '../_shared/zoho-crm.ts';
import type { CrmEnquiry, CrmResult } from '../_shared/zoho-crm.ts';

export async function syncEnquiry(id: string, enquiry: CrmEnquiry): Promise<CrmResult> {
  const result = await sendToCrm(enquiry);
  const update =
    result.status === 'synced'
      ? {
          crm_status: 'synced',
          crm_lead_id: result.leadId,
          crm_error: null,
          crm_synced_at: new Date().toISOString(),
        }
      : { crm_status: result.status, crm_error: result.status === 'failed' ? result.error : null };

  const { error } = await serviceClient().from('enquiries').update(update).eq('id', id);
  if (error) throw error;
  return result;
}
