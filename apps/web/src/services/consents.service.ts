// A parent's optional permissions (invite-onboarding.md, "Consents"): read their own, and change
// them in Account → Your choices. The database checks it's an active parent changing their own.

import { CONSENT_COLUMNS, consentsFromColumns } from '@/lib/consents';
import type { ConsentColumns } from '@/lib/consents';

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Consents, Result } from './types';

export async function getMyConsents(): Promise<Result<Consents>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data: session } = await supabase.auth.getSession();
    const myId = session.session?.user.id;
    if (!myId) return fail('notAllowed');

    const { data, error } = await supabase
      .from('profiles')
      .select(CONSENT_COLUMNS)
      .eq('id', myId)
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    if (!data) return fail('notFound');
    return succeed(consentsFromColumns(data as ConsentColumns));
  });
}

export async function setMyConsents(consents: Consents): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('set_my_consents', {
      wants_marketing: consents.marketing,
      allows_results_publicity: consents.resultsPublicity,
      allows_video_publicity: consents.videoPublicity,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
