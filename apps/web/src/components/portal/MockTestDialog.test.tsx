import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MOCK_SCORING,
  MOCK_TAGS,
  MOCK_TEST_DIALOG,
  MOCK_VALIDATION,
  YEAR_LEVEL_TEXT,
} from '@/constants';
import { EMPTY_MOCK_TAGS } from '@/lib/mock-tests';
import { createMockTest, updateMockTest } from '@/services';
import { setupUser } from '@/test/user';

import { MockTestDialog } from './MockTestDialog';

vi.mock('@/services', () => ({ createMockTest: vi.fn(), updateMockTest: vi.fn() }));

beforeEach(() => {
  vi.mocked(createMockTest)
    .mockReset()
    .mockResolvedValue({ ok: true, data: { id: 'new' } });
  vi.mocked(updateMockTest).mockReset().mockResolvedValue({ ok: true, data: undefined });
});

async function pick(user: ReturnType<typeof setupUser>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

describe('MockTestDialog tags', () => {
  it('creates a draft with no tags (AC 13)', async () => {
    const user = setupUser();
    render(<MockTestDialog open existing={null} onSaved={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel)), 'Fractions');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.create }));

    expect(createMockTest).toHaveBeenCalledWith({
      title: 'Fractions',
      instructions: '',
      tags: EMPTY_MOCK_TAGS,
      passMark: null,
    });
  });

  it('sends the tags that were set', async () => {
    const user = setupUser();
    render(<MockTestDialog open existing={null} onSaved={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel)), 'Fractions');
    await pick(user, MOCK_TAGS.subjectLabel, 'Maths');
    await pick(user, MOCK_TAGS.streamLabel, 'NAPLAN');
    await pick(user, MOCK_TAGS.yearLevelLabel, YEAR_LEVEL_TEXT.label(5));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.create }));

    expect(createMockTest).toHaveBeenCalledWith({
      title: 'Fractions',
      instructions: '',
      tags: { subject: 'maths', stream: 'naplan', yearLevels: [5], anyYear: false },
      passMark: null,
    });
  });

  it('shows the saved tags when editing a draft, and saves a change', async () => {
    const user = setupUser();
    const tags = { subject: 'english', stream: 'icas', yearLevels: [], anyYear: true };
    render(
      <MockTestDialog
        open
        existing={{ id: 't1', title: 'Reading', instructions: '', tags, passMark: null }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: MOCK_TAGS.subjectLabel })).toHaveTextContent(
      'English',
    );
    expect(screen.getByRole('combobox', { name: MOCK_TAGS.streamLabel })).toHaveTextContent('ICAS');
    expect(screen.getByRole('combobox', { name: MOCK_TAGS.yearLevelLabel })).toHaveTextContent(
      YEAR_LEVEL_TEXT.any,
    );
    await pick(user, MOCK_TAGS.subjectLabel, MOCK_TAGS.notSet);
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.save }));

    expect(updateMockTest).toHaveBeenCalledWith('t1', {
      title: 'Reading',
      instructions: '',
      tags: { ...tags, subject: null },
      passMark: null,
    });
  });
});

describe('MockTestDialog pass mark (AC 6, 7)', () => {
  async function submitWith(passMark: string) {
    const user = setupUser();
    render(<MockTestDialog open existing={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(new RegExp(MOCK_TEST_DIALOG.titleLabel)), 'Fractions');
    if (passMark) await user.type(screen.getByLabelText(MOCK_SCORING.passMarkLabel), passMark);
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.create }));
  }

  it('shows the hint under the pass mark field', () => {
    render(<MockTestDialog open existing={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(MOCK_SCORING.passMarkHint)).toBeInTheDocument();
  });

  it('sends the pass mark that was typed', async () => {
    await submitWith('60');
    expect(createMockTest).toHaveBeenCalledWith(expect.objectContaining({ passMark: 60 }));
  });

  it('sends null for a blank pass mark', async () => {
    await submitWith('');
    expect(createMockTest).toHaveBeenCalledWith(expect.objectContaining({ passMark: null }));
  });

  it.each(['0', '101', '60.5'])('refuses a pass mark of %s and saves nothing', async (text) => {
    await submitWith(text);
    expect(screen.getByText(MOCK_VALIDATION.passMark)).toBeInTheDocument();
    expect(createMockTest).not.toHaveBeenCalled();
  });

  it('shows the saved pass mark when editing and sends a change', async () => {
    const user = setupUser();
    render(
      <MockTestDialog
        open
        existing={{
          id: 't1',
          title: 'Reading',
          instructions: '',
          tags: EMPTY_MOCK_TAGS,
          passMark: 50,
        }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const field = screen.getByLabelText(MOCK_SCORING.passMarkLabel);
    expect(field).toHaveValue(50);
    await user.clear(field);
    await user.type(field, '75');
    await user.click(screen.getByRole('button', { name: MOCK_TEST_DIALOG.save }));
    expect(updateMockTest).toHaveBeenCalledWith('t1', expect.objectContaining({ passMark: 75 }));
  });
});
