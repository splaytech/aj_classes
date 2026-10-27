import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HOLD_RESULTS, PORTAL_ERRORS } from '@/constants';
import { setHoldResults } from '@/services';
import { setupUser } from '@/test/user';

import { HoldResultsSetting } from './HoldResultsSetting';

vi.mock('@/services', () => ({ setHoldResults: vi.fn() }));

function renderSetting(isPublished: boolean, holdResults = false) {
  const onChanged = vi.fn();
  const setting = (hold: boolean) => (
    <HoldResultsSetting
      assignmentId="assignment-1"
      holdResults={hold}
      isPublished={isPublished}
      onChanged={onChanged}
      revision={{ hold }} // a new object on every render, as the page's loader data is per reload
    />
  );
  const { rerender } = render(setting(holdResults));
  return {
    onChanged,
    checkbox: screen.getByRole('checkbox', { name: HOLD_RESULTS.label }),
    /** The page's data reloaded, with this saved value. */
    reloadWith: (hold: boolean) => rerender(setting(hold)),
  };
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

  it('shows the tick at once, while it saves and the page reloads', async () => {
    let finishSave: (result: { ok: true; data: undefined }) => void = () => {};
    vi.mocked(setHoldResults).mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    const user = setupUser();
    const { onChanged, checkbox, reloadWith } = renderSetting(false);

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    finishSave({ ok: true, data: undefined });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    // Saved, but the reloaded value hasn't arrived yet: no flicker back to unticked.
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    reloadWith(true);
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeEnabled();
  });

  it('ignores a reload that lands while the save is still running', async () => {
    let finishSave: (result: { ok: true; data: undefined }) => void = () => {};
    vi.mocked(setHoldResults).mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    const user = setupUser();
    const { onChanged, checkbox, reloadWith } = renderSetting(false);

    await user.click(checkbox);
    reloadWith(false); // an unrelated reload, from before the save landed
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    finishSave({ ok: true, data: undefined });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    reloadWith(true); // the save's own reload
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeEnabled();
  });

  it('shows the reloaded value, enabled, even when it comes back unchanged (P4)', async () => {
    vi.mocked(setHoldResults).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    const { onChanged, checkbox, reloadWith } = renderSetting(false);

    await user.click(checkbox);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(checkbox).toBeChecked(); // still the clicked value until the reload renders

    reloadWith(false); // another tab turned it back off before the reload
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
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
    expect(checkbox).not.toBeChecked(); // back to the saved value
    expect(checkbox).toBeEnabled();
  });

  it('explains a draft that was published elsewhere with its own message', async () => {
    vi.mocked(setHoldResults).mockResolvedValue({ ok: false, error: 'assignmentPublished' });
    const user = setupUser();
    const { checkbox } = renderSetting(false);

    await user.click(checkbox);

    expect(PORTAL_ERRORS.holdLocked).toBe('This can’t change once the assignment is published.');
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTAL_ERRORS.holdLocked);
  });
});
