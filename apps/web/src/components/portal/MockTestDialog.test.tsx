import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_TAGS, MOCK_TEST_DIALOG, YEAR_LEVEL_TEXT } from '@/constants';
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
    });
  });

  it('shows the saved tags when editing a draft, and saves a change', async () => {
    const user = setupUser();
    const tags = { subject: 'english', stream: 'icas', yearLevels: [], anyYear: true };
    render(
      <MockTestDialog
        open
        existing={{ id: 't1', title: 'Reading', instructions: '', tags }}
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
    });
  });
});
