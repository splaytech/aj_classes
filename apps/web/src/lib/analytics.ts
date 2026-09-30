// Thin wrapper around Vercel Web Analytics, so events can be switched off in one place.
// Never pass personal details (names, emails, phone numbers) as properties.

import { track } from '@vercel/analytics';

import { APP_CONFIG } from '@/constants';

export function trackEvent(name: string, properties?: Record<string, string>): void {
  if (!APP_CONFIG.features.analytics) return;
  track(name, properties);
}
