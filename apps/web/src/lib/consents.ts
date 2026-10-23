// A parent's optional permissions (invite-onboarding.md, "Consents"). Stored as "agreed at"
// timestamps; null means no. Only parents are offered them (a minor can't agree to publicity).

import type { AppRole } from '@/constants';
import type { Consents } from '@/services';

/** Nothing agreed: the starting value, and what everyone but parents sends. */
export const NO_CONSENTS: Consents = {
  marketing: false,
  resultsPublicity: false,
  videoPublicity: false,
};

export function asksForConsents(role: AppRole): boolean {
  return role === 'parent';
}

export type ConsentColumns = {
  marketing_consent_at: string | null;
  results_publicity_consent_at: string | null;
  video_publicity_consent_at: string | null;
};

/** The profile columns that hold the choices, for queries. */
export const CONSENT_COLUMNS =
  'marketing_consent_at, results_publicity_consent_at, video_publicity_consent_at';

export function consentsFromColumns(row: ConsentColumns): Consents {
  return {
    marketing: row.marketing_consent_at !== null,
    resultsPublicity: row.results_publicity_consent_at !== null,
    videoPublicity: row.video_publicity_consent_at !== null,
  };
}
