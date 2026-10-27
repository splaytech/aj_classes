import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { listAuthenticators, verifyTwoStepCode } from '@/services';

import { TwoStepCodeForm } from './TwoStepCodeForm';

vi.mock('@/services', () => ({ listAuthenticators: vi.fn(), verifyTwoStepCode: vi.fn() }));
vi.mock('@/lib/local-dev-two-step', () => ({
  hasLocalTwoStepKey: () => true,
  localTwoStepCode: async () => '123456',
}));

describe('TwoStepCodeForm local auto-entry (dev only)', () => {
  it('submits the code once under StrictMode, so two challenges never race (BUG-3)', async () => {
    vi.mocked(listAuthenticators).mockResolvedValue({
      ok: true,
      data: [{ id: 'factor-1', name: 'Phone', addedAt: '2026-10-01' }],
    });
    vi.mocked(verifyTwoStepCode).mockResolvedValue({ ok: true, data: undefined });
    const onVerified = vi.fn();

    render(
      <StrictMode>
        <TwoStepCodeForm onVerified={onVerified} />
      </StrictMode>,
    );

    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(listAuthenticators).toHaveBeenCalledTimes(1);
    expect(verifyTwoStepCode).toHaveBeenCalledTimes(1);
    expect(verifyTwoStepCode).toHaveBeenCalledWith('factor-1', '123456');
    expect(onVerified).toHaveBeenCalledTimes(1);
  });
});
