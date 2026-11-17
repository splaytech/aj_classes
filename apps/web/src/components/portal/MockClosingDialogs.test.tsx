import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_CLOSING, MOCK_TEST_EDIT_PAGE, MOCK_VALIDATION, PORTAL_ERRORS } from '@/constants';
import { releaseMockTest, setMockTestClosing } from '@/services';
import { setupUser } from '@/test/user';

import { MockClosingDialog, MockReleaseDialog } from './MockClosingDialogs';

vi.mock('@/services', () => ({ releaseMockTest: vi.fn(), setMockTestClosing: vi.fn() }));

// The default (US) field order: month, day, year, hours, minutes, am/pm.
function renderDialog(ui: ReactElement) {
  render(<LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>);
}

async function typeCloses(user: ReturnType<typeof setupUser>, keys: string) {
  await user.click(screen.getAllByRole('spinbutton')[0] as HTMLElement);
  await user.keyboard(keys);
}

beforeEach(() => {
  vi.mocked(releaseMockTest).mockReset();
  vi.mocked(setMockTestClosing).mockReset();
});

describe('MockReleaseDialog', () => {
  it('releases with no closing time when the field is left empty (AC 1)', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const onReleased = vi.fn();
    const user = setupUser();
    renderDialog(<MockReleaseDialog testId="t1" onReleased={onReleased} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(releaseMockTest).toHaveBeenCalledWith('t1', null);
    expect(onReleased).toHaveBeenCalled();
  });

  it('sends a typed future time as ISO, read in the viewer’s local time (AC 1, 9)', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderDialog(<MockReleaseDialog testId="t1" onReleased={vi.fn()} onClose={vi.fn()} />);

    await typeCloses(user, '010129990930P');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(releaseMockTest).toHaveBeenCalledWith('t1', new Date(2999, 0, 1, 21, 30).toISOString());
  });

  it('refuses a past time inline and sends nothing', async () => {
    const user = setupUser();
    renderDialog(<MockReleaseDialog testId="t1" onReleased={vi.fn()} onClose={vi.fn()} />);

    await typeCloses(user, '010120200930A');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(MOCK_VALIDATION.closesInPast)).toBeInTheDocument();
    expect(releaseMockTest).not.toHaveBeenCalled();
  });

  it('refuses a half-typed time inline and sends nothing', async () => {
    const user = setupUser();
    renderDialog(<MockReleaseDialog testId="t1" onReleased={vi.fn()} onClose={vi.fn()} />);

    await typeCloses(user, '0101');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(MOCK_VALIDATION.closesInvalid)).toBeInTheDocument();
    expect(releaseMockTest).not.toHaveBeenCalled();
  });

  it('shows the database refusal in the dialog and stays open', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: false, error: 'mockNoQuestions' });
    const onReleased = vi.fn();
    const user = setupUser();
    renderDialog(<MockReleaseDialog testId="t1" onReleased={onReleased} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(PORTAL_ERRORS.mockNoQuestions)).toBeInTheDocument();
    expect(onReleased).not.toHaveBeenCalled();
  });
});

describe('MockClosingDialog', () => {
  it('changes the closing time to a new future one (AC 2)', async () => {
    vi.mocked(setMockTestClosing).mockResolvedValue({ ok: true, data: undefined });
    const onSaved = vi.fn();
    const user = setupUser();
    renderDialog(
      <MockClosingDialog
        testId="t1"
        closesAt="2999-01-01T09:00:00.000Z"
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.clear }));
    await typeCloses(user, '063029981015A');
    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.save }));

    expect(setMockTestClosing).toHaveBeenCalledWith(
      't1',
      new Date(2998, 5, 30, 10, 15).toISOString(),
    );
    expect(onSaved).toHaveBeenCalledWith(false);
  });

  it('clears the closing time, and says so (AC 2, 4)', async () => {
    vi.mocked(setMockTestClosing).mockResolvedValue({ ok: true, data: undefined });
    const onSaved = vi.fn();
    const user = setupUser();
    renderDialog(
      <MockClosingDialog
        testId="t1"
        closesAt="2020-01-01T09:00:00.000Z"
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.clear }));
    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.save }));

    expect(setMockTestClosing).toHaveBeenCalledWith('t1', null);
    expect(onSaved).toHaveBeenCalledWith(true);
  });
});
