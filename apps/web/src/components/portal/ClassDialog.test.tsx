import { render, screen, waitFor, within } from '@testing-library/react';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { describe, expect, it, vi } from 'vitest';

import {
  CLASS_DIALOG,
  DELIVERIES,
  DELIVERY_LABELS,
  SUBJECTS,
  YEAR_LEVEL_TEXT,
  YEAR_LEVELS,
} from '@/constants';
import { classYearLabel } from '@/lib/labels';
import type { ClassInput, ClassSummary, Result } from '@/services';
import { setupUser } from '@/test/user';

import { ClassDialog } from './ClassDialog';

const HYBRID_CLASS: ClassSummary = {
  id: 'class-1',
  name: 'Selective Entry Maths & Reasoning',
  subject: 'maths',
  yearLevels: [7, 8, 9],
  delivery: 'hybrid',
  location: 'Truganina, Room 1 and Zoom',
  tutorId: null,
  tutorName: '',
  tutorIsActive: false,
  startsOn: null,
  endsOn: null,
  isActive: true,
  sessions: [],
  studentCount: 0,
};

const SINGLE_YEAR_CLASS: ClassSummary = {
  ...HYBRID_CLASS,
  id: 'class-2',
  name: 'Selective Interview Preparation',
  yearLevels: [8],
  delivery: 'online',
  location: 'Zoom',
};

// The dialog has date pickers, which need the same provider the portal wraps pages in.
function renderDialog(existing: ClassSummary | null = null) {
  const onSave = vi.fn((input: ClassInput): Promise<Result<string>> =>
    Promise.resolve({ ok: true, data: input.id ?? 'new-class' }),
  );
  const onSaved = vi.fn();
  render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ClassDialog
        open
        existing={existing}
        tutors={[]}
        onSave={onSave}
        onSaved={onSaved}
        onClose={vi.fn()}
      />
    </LocalizationProvider>,
  );
  return { onSave, onSaved };
}

// While the menu is open MUI hides the rest of the page from assistive tech, so `hidden` lets a
// test read the field behind it.
function yearField({ behindOpenMenu = false } = {}) {
  return screen.getByRole('combobox', {
    name: CLASS_DIALOG.labels.yearLevel,
    hidden: behindOpenMenu,
  });
}

function deliveryField() {
  return screen.getByRole('combobox', { name: CLASS_DIALOG.labels.delivery });
}

function optionNames(): string[] {
  return within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

async function fillRequiredFields(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByRole('textbox', { name: CLASS_DIALOG.labels.name }), 'Mixed Maths');
  await user.click(screen.getByRole('combobox', { name: CLASS_DIALOG.labels.subject }));
  await user.click(screen.getByRole('option', { name: SUBJECTS[0].label }));
}

describe('ClassDialog delivery', () => {
  it('lists In person, Online and Hybrid in that order (AC 1)', async () => {
    const user = setupUser();
    renderDialog();

    await user.click(deliveryField());

    expect(optionNames()).toEqual(DELIVERIES.map((delivery) => DELIVERY_LABELS[delivery]));
  });

  it('shows Hybrid when an existing hybrid class is opened (AC 2)', () => {
    renderDialog(HYBRID_CLASS);

    expect(deliveryField()).toHaveTextContent(DELIVERY_LABELS.hybrid);
  });

  it('saves a new class as hybrid (AC 3)', async () => {
    const user = setupUser();
    const { onSave } = renderDialog();

    await fillRequiredFields(user);
    await user.click(deliveryField());
    await user.click(screen.getByRole('option', { name: DELIVERY_LABELS.hybrid }));
    await user.click(screen.getByRole('button', { name: CLASS_DIALOG.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ delivery: 'hybrid' });
  });

  it('shows the location hint that covers hybrid (AC 6)', () => {
    renderDialog();

    expect(
      screen.getByRole('textbox', { name: CLASS_DIALOG.labels.location }),
    ).toHaveAccessibleDescription(CLASS_DIALOG.hints.location);
  });
});

describe('ClassDialog year levels', () => {
  it('lists Year 2 to Year 12 in ascending order (AC 9)', async () => {
    const user = setupUser();
    renderDialog();

    await user.click(yearField());

    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    expect(optionNames()).toEqual(YEAR_LEVELS.map((year) => YEAR_LEVEL_TEXT.label(year)));
  });

  it('shows Any year and saves no years when nothing is ticked (AC 10)', async () => {
    const user = setupUser();
    const { onSave } = renderDialog();

    expect(yearField()).toHaveTextContent(YEAR_LEVEL_TEXT.any);
    expect(yearField()).toHaveAccessibleDescription(CLASS_DIALOG.hints.yearLevel);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: CLASS_DIALOG.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ yearLevels: [] });
  });

  it('ticks and unticks years that are not next to each other (AC 9, 11)', async () => {
    const user = setupUser();
    const { onSave } = renderDialog();
    await fillRequiredFields(user);

    await user.click(yearField());
    for (const year of [11, 7, 9]) {
      await user.click(screen.getByRole('option', { name: YEAR_LEVEL_TEXT.label(year) }));
    }

    // The menu stays open while ticking, and each ticked year is marked selected.
    expect(screen.getByRole('option', { name: YEAR_LEVEL_TEXT.label(9) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(yearField({ behindOpenMenu: true })).toHaveTextContent(classYearLabel([7, 9, 11]));

    await user.click(screen.getByRole('option', { name: YEAR_LEVEL_TEXT.label(9) }));
    expect(screen.getByRole('option', { name: YEAR_LEVEL_TEXT.label(9) })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(yearField({ behindOpenMenu: true })).toHaveTextContent(classYearLabel([7, 11]));

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: CLASS_DIALOG.save }));

    // Order is as ticked; the service sorts before saving (sortedYears).
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ yearLevels: [11, 7] });
  });

  it('opens an existing class with exactly its years ticked (AC 11)', async () => {
    const user = setupUser();
    renderDialog(HYBRID_CLASS);

    expect(yearField()).toHaveTextContent(classYearLabel(HYBRID_CLASS.yearLevels));

    await user.click(yearField());
    const ticked = within(screen.getByRole('listbox'))
      .getAllByRole('option', { selected: true })
      .map((option) => option.textContent);
    expect(ticked).toEqual(HYBRID_CLASS.yearLevels.map((year) => YEAR_LEVEL_TEXT.label(year)));
  });

  it('saves an unchanged single-year class with its year and delivery as they were (AC 12)', async () => {
    const user = setupUser();
    const { onSave } = renderDialog(SINGLE_YEAR_CLASS);

    expect(yearField()).toHaveTextContent(YEAR_LEVEL_TEXT.label(8));

    await user.click(screen.getByRole('button', { name: CLASS_DIALOG.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      id: SINGLE_YEAR_CLASS.id,
      yearLevels: [8],
      delivery: 'online',
    });
  });
});
