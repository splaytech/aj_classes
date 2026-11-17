import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_CLOSING, MOCK_TAGS, MOCK_VALIDATION, YEAR_LEVEL_TEXT } from '@/constants';
import { updateMockTestTags } from '@/services';
import { setupUser } from '@/test/user';

import { MockTagsDialog } from './MockTagsDialog';

vi.mock('@/services', () => ({ updateMockTestTags: vi.fn() }));

beforeEach(() => {
  vi.mocked(updateMockTestTags).mockReset().mockResolvedValue({ ok: true, data: undefined });
});

async function openSelect(user: ReturnType<typeof setupUser>, label: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  return screen.getByRole('listbox');
}

describe('MockTagsDialog (released or closed test, AC 15)', () => {
  it('changes a set tag to another value and saves only the tags', async () => {
    const onSaved = vi.fn();
    const user = setupUser();
    render(
      <MockTagsDialog
        testId="t1"
        tags={{ subject: 'maths', stream: 'naplan', yearLevels: [5], anyYear: false }}
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    );

    const list = await openSelect(user, MOCK_TAGS.subjectLabel);
    expect(within(list).queryByRole('option', { name: MOCK_TAGS.notSet })).toBeNull();
    await user.click(within(list).getByRole('option', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.save }));

    expect(updateMockTestTags).toHaveBeenCalledWith('t1', {
      subject: 'english',
      stream: 'naplan',
      yearLevels: [5],
      anyYear: false,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('can’t empty the years that were set: the last year stays picked (review-5 #5)', async () => {
    const user = setupUser();
    render(
      <MockTagsDialog
        testId="t1"
        tags={{ subject: 'maths', stream: 'naplan', yearLevels: [5], anyYear: false }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const list = await openSelect(user, MOCK_TAGS.yearLevelLabel);
    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.label(5) }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.save }));

    expect(screen.queryByText(MOCK_VALIDATION.tagKeep)).not.toBeInTheDocument();
    expect(updateMockTestTags).toHaveBeenCalledWith('t1', {
      subject: 'maths',
      stream: 'naplan',
      yearLevels: [5],
      anyYear: false,
    });
  });

  it('on an older untagged test shows a disabled Not set, and lets one tag be set alone', async () => {
    const user = setupUser();
    render(
      <MockTagsDialog
        testId="t1"
        tags={{ subject: null, stream: null, yearLevels: [], anyYear: false }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const list = await openSelect(user, MOCK_TAGS.streamLabel);
    expect(within(list).getByRole('option', { name: MOCK_TAGS.notSet })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(within(list).getByRole('option', { name: 'VCE Tutoring' }));
    await user.click(screen.getByRole('button', { name: MOCK_CLOSING.save }));

    expect(updateMockTestTags).toHaveBeenCalledWith('t1', {
      subject: null,
      stream: 'vce',
      yearLevels: [],
      anyYear: false,
    });
  });
});
