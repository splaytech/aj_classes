import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HOLD_RESULTS, PORTAL_ERRORS } from '@/constants';
import { setHoldResults } from '@/services';
import { setupUser } from '@/test/user';

import { HoldResultsSetting } from './HoldResultsSetting';

vi.mock('@/services', () => ({ setHoldResults: vi.fn() }));

function renderSetting(isPublished: boolean, holdResults = false) {
  const onChanged = vi.fn();
  render(
    <HoldResultsSetting
      assignmentId="assignment-1"
      holdResults={holdResults}
      isPublished={isPublished}
      onChanged={onChanged}
    />,
  );
  return { onChanged, checkbox: screen.getByRole('checkbox', { name: HOLD_RESULTS.label }) };
}

describe('HoldResultsSetting (item 7)', () => {
  it('shows the label and hint from HOLD_RESULTS (AC-7.7)', () => {
    const { checkbox } = renderSetting(false);

    expect(HOLD_RESULTS.label).toBe('Hold results until I return them');
    expect(checkbox).toHaveAccessibleDescription(HOLD_RESULTS.hint);
  });

  it('saves on a draft, then lets the page reload (AC-7.1)', async () => {
    vi.mocked(setHoldResults).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    const { onChanged, checkbox } = renderSetting(false);

    expect(checkbox).toBeEnabled();
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    expect(setHoldResults).toHaveBeenCalledWith('assignment-1', true);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('is locked, showing its value and the locked note, once published (AC-7.1)', () => {
    const { checkbox } = renderSetting(true, true);

    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(HOLD_RESULTS.lockedNote);
    expect(screen.queryByText(HOLD_RESULTS.hint)).not.toBeInTheDocument();
  });

  it("shows the server's refusal and does not reload", async () => {
    vi.mocked(setHoldResults).mockResolvedValue({ ok: false, error: 'holdNeedsQuestions' });
    const user = setupUser();
    const { onChanged, checkbox } = renderSetting(false);

    await user.click(checkbox);

    expect(await screen.findByRole('alert')).toHaveTextContent(PORTAL_ERRORS.holdNeedsQuestions);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
