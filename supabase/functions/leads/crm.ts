// Sends a saved enquiry to Bigin and records the outcome on its row.

import { serviceClient } from '../_shared/clients.ts';
import { sendToBigin } from '../_shared/zoho-bigin.ts';
import type { BiginEnquiry, BiginResult } from '../_shared/zoho-bigin.ts';

export async function syncEnquiry(id: string, enquiry: BiginEnquiry): Promise<BiginResult> {
  const result = await sendToBigin(enquiry);
  const update =
    result.status === 'synced'
      ? {
          crm_status: 'synced',
          crm_contact_id: result.contactId,
          crm_deal_id: result.dealId,
          crm_error: null,
          crm_synced_at: new Date().toISOString(),
        }
      : { crm_status: result.status, crm_error: result.status === 'failed' ? result.error : null };

  const { error } = await serviceClient().from('enquiries').update(update).eq('id', id);
  if (error) throw error;
  return result;
}
