import { describe, expect, it } from 'vitest';

import {
  NO_CONSENTS,
  asksForConsents,
  consentsFromColumns,
  describeConsentChoices,
} from './consents';

describe('consents', () => {
  it('are offered to parents only', () => {
    expect(asksForConsents('parent')).toBe(true);
    expect(asksForConsents('student')).toBe(false);
    expect(asksForConsents('tutor')).toBe(false);
    expect(asksForConsents('admin')).toBe(false);
  });

  it('start with nothing agreed', () => {
    expect(Object.values(NO_CONSENTS).every((agreed) => !agreed)).toBe(true);
  });

  it('read an "agreed at" time as yes and an empty one as no', () => {
    expect(
      consentsFromColumns({
        marketing_consent_at: '2026-10-23T01:00:00Z',
        results_publicity_consent_at: null,
        video_publicity_consent_at: '2026-10-23T01:00:00Z',
      }),
    ).toEqual({ marketing: true, resultsPublicity: false, videoPublicity: true });
  });

  it('describes the choices an activity entry records', () => {
    expect(
      describeConsentChoices({
        role: 'parent',
        marketing: true,
        results_publicity: false,
        video_publicity: true,
      }),
    ).toBe('News by email/SMS: yes · Name and results: no · Testimonial video: yes');
    expect(describeConsentChoices({ marketing: false, video_publicity: true })).toBe(
      'News by email/SMS: no · Testimonial video: yes',
    );
    expect(describeConsentChoices({})).toBe('');
  });
});
