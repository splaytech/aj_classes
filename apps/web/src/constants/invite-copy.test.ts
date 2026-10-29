import { describe, expect, it } from 'vitest';

import { AUTH_LIMITS, FORGOT_PASSWORD_PAGE, INVITE_DIALOG, INVITE_LIMITS } from '@/constants';

// The invite lifetime and the password-reset lifetime are separate constants (ADR-0010).
describe('invite and reset link copy', () => {
  it('derives the days from the 336-hour invite lifetime', () => {
    expect(INVITE_LIMITS.linkLifetimeHours).toBe(336);
    expect(INVITE_LIMITS.linkLifetimeDays).toBe(INVITE_LIMITS.linkLifetimeHours / 24);
  });

  it('tells the admin the invite link works for 14 days (AC 26)', () => {
    expect(INVITE_DIALOG.intro).toBe(
      "They'll get an e-mail to set their password. The link works for 14 days; you can resend it.",
    );
  });

  it('keeps the password-reset link at 1 hour (AC 32)', () => {
    expect(AUTH_LIMITS.linkExpiryHours).toBe(1);
    expect(FORGOT_PASSWORD_PAGE.sent).toBe(
      "If that email has an account, we've sent a link. It expires in 1 hour.",
    );
  });
});
