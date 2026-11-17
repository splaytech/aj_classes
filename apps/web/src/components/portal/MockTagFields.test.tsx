import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MOCK_TAGS, YEAR_LEVEL_TEXT } from '@/constants';
import { EMPTY_MOCK_TAGS } from '@/lib/mock-tests';
import type { MockTags } from '@/services';
import { setupUser } from '@/test/user';

import { MockTagFields } from './MockTagFields';

// Holds the tags the way a dialog does, and shows them so a test can read the state.
function Harness({ initial, canClear }: { initial: MockTags; canClear: boolean }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <MockTagFields value={tags} errors={{}} canClear={canClear} onChange={setTags} />
      <output>{JSON.stringify(tags)}</output>
    </>
  );
}

// `hidden`: while a select's menu is open MUI hides the rest of the page from assistive tech.
function state(): MockTags {
  return JSON.parse(screen.getByRole('status', { hidden: true }).textContent ?? '{}') as MockTags;
}

async function openSelect(user: ReturnType<typeof setupUser>, label: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  return screen.getByRole('listbox');
}

describe('MockTagFields', () => {
  it('has visible Subject, Stream and Year level labels (AC 19, 26)', () => {
    render(<Harness initial={EMPTY_MOCK_TAGS} canClear />);
    for (const label of [MOCK_TAGS.subjectLabel, MOCK_TAGS.streamLabel, MOCK_TAGS.yearLevelLabel]) {
      expect(screen.getByRole('combobox', { name: label })).toBeVisible();
    }
  });

  it('Any year clears the years, a year clears Any year, and Any year off leaves nothing (AC 12)', async () => {
    const user = setupUser();
    render(<Harness initial={EMPTY_MOCK_TAGS} canClear />);

    let list = await openSelect(user, MOCK_TAGS.yearLevelLabel);
    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.label(5) }));
    expect(state()).toMatchObject({ yearLevels: [5], anyYear: false });

    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.any }));
    expect(state()).toMatchObject({ yearLevels: [], anyYear: true });

    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.label(7) }));
    expect(state()).toMatchObject({ yearLevels: [7], anyYear: false });

    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.any }));
    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.any }));
    expect(state()).toMatchObject({ yearLevels: [], anyYear: false });
    await user.keyboard('{Escape}');

    list = await openSelect(user, MOCK_TAGS.subjectLabel);
    await user.click(within(list).getByRole('option', { name: 'English' }));
    expect(state().subject).toBe('english');
  });

  it('offers Not set on a draft, so a tag can be cleared (AC 13)', async () => {
    const user = setupUser();
    render(<Harness initial={{ ...EMPTY_MOCK_TAGS, stream: 'icas' }} canClear />);

    const list = await openSelect(user, MOCK_TAGS.streamLabel);
    await user.click(within(list).getByRole('option', { name: MOCK_TAGS.notSet }));
    expect(state().stream).toBeNull();
  });

  it('on a released test shows a null tag as a disabled Not set, and offers no Not set for a set one', async () => {
    const user = setupUser();
    render(<Harness initial={{ ...EMPTY_MOCK_TAGS, subject: 'maths' }} canClear={false} />);

    expect(screen.getByRole('combobox', { name: MOCK_TAGS.streamLabel })).toHaveTextContent(
      MOCK_TAGS.notSet,
    );
    let list = await openSelect(user, MOCK_TAGS.streamLabel);
    expect(within(list).getByRole('option', { name: MOCK_TAGS.notSet })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');

    list = await openSelect(user, MOCK_TAGS.subjectLabel);
    expect(within(list).queryByRole('option', { name: MOCK_TAGS.notSet })).toBeNull();
  });

  it('on a released test never lets the years be emptied, but lets them change (review-5 #5)', async () => {
    const user = setupUser();
    render(<Harness initial={{ ...EMPTY_MOCK_TAGS, yearLevels: [5] }} canClear={false} />);

    const list = await openSelect(user, MOCK_TAGS.yearLevelLabel);
    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.label(5) }));
    expect(state()).toMatchObject({ yearLevels: [5], anyYear: false });

    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.any }));
    expect(state()).toMatchObject({ yearLevels: [], anyYear: true });
    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.any }));
    expect(state()).toMatchObject({ yearLevels: [], anyYear: true });

    await user.click(within(list).getByRole('option', { name: YEAR_LEVEL_TEXT.label(9) }));
    expect(state()).toMatchObject({ yearLevels: [9], anyYear: false });
  });

  it('shows a held value that is no longer offered by its saved label, disabled (AC 27)', async () => {
    const user = setupUser();
    render(
      <Harness
        initial={{ ...EMPTY_MOCK_TAGS, subject: 'interview-preparation', stream: 'old-stream' }}
        canClear
      />,
    );

    expect(screen.getByRole('combobox', { name: MOCK_TAGS.subjectLabel })).toHaveTextContent(
      MOCK_TAGS.noLongerOffered('Interview preparation'),
    );
    const list = await openSelect(user, MOCK_TAGS.streamLabel);
    expect(
      within(list).getByRole('option', { name: MOCK_TAGS.noLongerOffered('old-stream') }),
    ).toHaveAttribute('aria-disabled', 'true');
  });
});
