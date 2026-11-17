import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_CLOSING,
  MOCK_TAGS,
  MOCK_TEST_EDIT_PAGE,
  MOCK_VALIDATION,
  PORTAL_ERRORS,
} from '@/constants';
import { releaseMockTest, setMockTestClosing, updateMockTestTags } from '@/services';
import { setupUser } from '@/test/user';

import { MockClosingDialog, MockReleaseDialog } from './MockClosingDialogs';

vi.mock('@/services', () => ({
  releaseMockTest: vi.fn(),
  setMockTestClosing: vi.fn(),
  updateMockTestTags: vi.fn(),
}));

const TAGGED = { subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true };

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
  vi.mocked(updateMockTestTags).mockReset();
});

describe('MockReleaseDialog', () => {
  it('releases with no closing time when the field is left empty (AC 1)', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const onReleased = vi.fn();
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={onReleased} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(releaseMockTest).toHaveBeenCalledWith('t1', null);
    expect(onReleased).toHaveBeenCalled();
  });

  it('sends a typed future time as ISO, read in the viewer’s local time (AC 1, 9)', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={vi.fn()} onClose={vi.fn()} />,
    );

    await typeCloses(user, '010129990930P');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(releaseMockTest).toHaveBeenCalledWith('t1', new Date(2999, 0, 1, 21, 30).toISOString());
  });

  it('refuses a past time inline and sends nothing', async () => {
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={vi.fn()} onClose={vi.fn()} />,
    );

    await typeCloses(user, '010120200930A');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(MOCK_VALIDATION.closesInPast)).toBeInTheDocument();
    expect(releaseMockTest).not.toHaveBeenCalled();
  });

  it('refuses a half-typed time inline and sends nothing', async () => {
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={vi.fn()} onClose={vi.fn()} />,
    );

    await typeCloses(user, '0101');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(MOCK_VALIDATION.closesInvalid)).toBeInTheDocument();
    expect(releaseMockTest).not.toHaveBeenCalled();
  });

  it('shows the database refusal in the dialog and stays open', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: false, error: 'mockNoQuestions' });
    const onReleased = vi.fn();
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={onReleased} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(PORTAL_ERRORS.mockNoQuestions)).toBeInTheDocument();
    expect(onReleased).not.toHaveBeenCalled();
  });
});

describe('MockReleaseDialog tags (categories AC 14)', () => {
  const pickOption = async (user: ReturnType<typeof setupUser>, label: string, name: string) => {
    await user.click(screen.getByRole('combobox', { name: label }));
    await user.click(screen.getByRole('option', { name }));
  };

  it('names each missing tag and sends nothing', async () => {
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog
        testId="t1"
        tags={{ subject: null, stream: null, yearLevels: [], anyYear: false }}
        onReleased={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(MOCK_TAGS.releaseTagsText)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(screen.getByText(MOCK_VALIDATION.tagSubject)).toBeInTheDocument();
    expect(screen.getByText(MOCK_VALIDATION.tagStream)).toBeInTheDocument();
    expect(screen.getByText(MOCK_VALIDATION.tagYears)).toBeInTheDocument();
    expect(updateMockTestTags).not.toHaveBeenCalled();
    expect(releaseMockTest).not.toHaveBeenCalled();
  });

  it('saves tags set in the dialog first, then releases', async () => {
    const order: string[] = [];
    vi.mocked(updateMockTestTags).mockImplementation(async () => {
      order.push('tags');
      return { ok: true, data: undefined };
    });
    vi.mocked(releaseMockTest).mockImplementation(async () => {
      order.push('release');
      return { ok: true, data: undefined };
    });
    const onReleased = vi.fn();
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog
        testId="t1"
        tags={{ subject: 'maths', stream: null, yearLevels: [], anyYear: true }}
        onReleased={onReleased}
        onClose={vi.fn()}
      />,
    );

    await pickOption(user, MOCK_TAGS.streamLabel, 'ICAS');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(updateMockTestTags).toHaveBeenCalledWith('t1', {
      subject: 'maths',
      stream: 'icas',
      yearLevels: [],
      anyYear: true,
    });
    expect(order).toEqual(['tags', 'release']);
    expect(onReleased).toHaveBeenCalled();
  });

  it('does not write tags that did not change', async () => {
    vi.mocked(releaseMockTest).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog testId="t1" tags={TAGGED} onReleased={vi.fn()} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(updateMockTestTags).not.toHaveBeenCalled();
    expect(releaseMockTest).toHaveBeenCalledWith('t1', null);
  });

  it('stops, with the reason, when the tag save is refused', async () => {
    vi.mocked(updateMockTestTags).mockResolvedValue({ ok: false, error: 'mockTagStream' });
    const user = setupUser();
    renderDialog(
      <MockReleaseDialog
        testId="t1"
        tags={{ subject: 'maths', stream: null, yearLevels: [], anyYear: true }}
        onReleased={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await pickOption(user, MOCK_TAGS.streamLabel, 'ICAS');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_EDIT_PAGE.release }));

    expect(await screen.findByText(PORTAL_ERRORS.mockTagStream)).toBeInTheDocument();
    expect(releaseMockTest).not.toHaveBeenCalled();
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
