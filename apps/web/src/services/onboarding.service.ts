// Finishing the setup form after an invite link (invite-onboarding design).
//
// Order matters:
//   1. The person's own session saves their password. Supabase Auth hashes it; it never passes
//      through our database functions or the secret key. The database notes that they chose one.
//   2. complete_onboarding() checks every field again on the server and only then makes the
//      account active. It refuses an account whose person hasn't chosen a password.
// If step 2 fails after step 1, the account stays invited and the form can simply be sent again:
// the same password counts as already saved.
//
// A setup tab left open for more than a day needs an emailed code before Supabase changes the
// password ('reauthNeeded'): the page sends the code (sendReauthCode) and calls this again with it.

import { changePassword } from './auth.service';
import { attempt, fail, succeed } from './result';
import { toErrorKey } from './auth-errors';
import { getSupabase } from './supabase.client';
import type { OnboardingInput, Result } from './types';

export async function completeOnboarding(
  input: OnboardingInput,
  emailedCode?: string,
): Promise<Result> {
  const saved = await changePassword(input.password, emailedCode);
  if (!saved.ok && saved.error !== 'samePassword') return saved;

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('complete_onboarding', {
      new_full_name: input.fullName,
      new_phone: input.phone ?? undefined,
      new_year_level: input.yearLevel ?? undefined,
      accepts_terms: input.acceptsTerms,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
