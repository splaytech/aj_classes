// Website enquiries for admins (leads-and-crm.md §5): list, delete, and retry sending to Zoho CRM.
// Reading and deleting go straight to the database (admins only, by RLS); retrying goes through
// the leads edge function, which holds the Zoho credentials.

import { CRM_STATUSES } from '@/constants';
import type { CrmStatus } from '@/constants';

import { callEdgeFunction } from './account-admin.client';
import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Enquiry, ResyncOutcome, Result } from './types';

const LEADS_FUNCTION = 'leads';
const RESYNC_ACTION = 'resync';
const MAX_ROWS = 200;

type EnquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  wants_updates: boolean;
  crm_status: string;
  crm_error: string | null;
};

function toCrmStatus(value: unknown): CrmStatus {
  return CRM_STATUSES.find((status) => status === value) ?? 'pending';
}

export async function listEnquiries(): Promise<Result<Enquiry[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('enquiries')
      .select('id, created_at, name, email, phone, message, wants_updates, crm_status, crm_error')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) return fail(toErrorKey(error));

    return succeed(
      (data as EnquiryRow[]).map((row) => ({
        id: row.id,
        receivedAt: row.created_at,
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        wantsUpdates: row.wants_updates,
        crmStatus: toCrmStatus(row.crm_status),
        crmError: row.crm_error,
      })),
    );
  });
}

export async function deleteEnquiry(id: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.from('enquiries').delete().eq('id', id);
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

export async function resyncEnquiry(id: string): Promise<Result<ResyncOutcome>> {
  const result = await callEdgeFunction(LEADS_FUNCTION, RESYNC_ACTION, { enquiryId: id });
  if (!result.ok) return result;
  const crmError = result.data.crmError;
  return succeed({
    crmStatus: toCrmStatus(result.data.crmStatus),
    crmError: typeof crmError === 'string' ? crmError : null,
  });
}
