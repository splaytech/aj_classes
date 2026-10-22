import { describe, expect, it } from 'vitest';

import { ENQUIRIES_PAGE } from '@/constants';

import { canRetry, retryMessage } from './enquiry-actions';

describe('enquiry actions', () => {
  it('offers Retry only while Bigin has not got the enquiry', () => {
    expect(canRetry('failed')).toBe(true);
    expect(canRetry('pending')).toBe(true);
    expect(canRetry('synced')).toBe(false);
    expect(canRetry('off')).toBe(false);
  });

  it('reports a successful retry as a notice', () => {
    expect(retryMessage({ crmStatus: 'synced', crmError: null })).toEqual({
      notice: ENQUIRIES_PAGE.retried,
    });
  });

  it("shows Zoho's reason when it still fails", () => {
    expect(retryMessage({ crmStatus: 'failed', crmError: 'INVALID_DATA' })).toEqual({
      error: ENQUIRIES_PAGE.retryFailed('INVALID_DATA'),
    });
  });

  it('explains when Bigin is not set up', () => {
    expect(retryMessage({ crmStatus: 'off', crmError: null })).toEqual({
      error: ENQUIRIES_PAGE.stillOff,
    });
  });
});
