import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PORTAL_ERRORS, PORTAL_VALIDATION, PROFILE_PAGE, PROFILE_VALIDATION } from '@/constants';
import type { StaffProfile } from '@/services';
import { setupUser } from '@/test/user';

import { ProfileForm } from './ProfileForm';

const PROFILE: StaffProfile = {
  id: 'tutor-1',
  email: 'tutor@test.local',
  fullName: 'Priya Sharma',
  bio: 'I teach maths.',
  qualifications: [],
  subjects: ['maths'],
  photoPath: null,
  photoUrl: null,
  phone: '+61412345678',
};

function renderForm(profile: StaffProfile = PROFILE) {
  const onSave = vi.fn();
  const onSaved = vi.fn();
  render(<ProfileForm profile={profile} onSave={onSave} onSaved={onSaved} />);
  return { onSave, onSaved };
}

function phoneField() {
  return screen.getByLabelText(PROFILE_PAGE.labels.phone);
}

describe('ProfileForm phone field (item 4)', () => {
  it('shows the stored number in the display format, with its hint and the phone keypad (AC-4.1)', () => {
    renderForm();

    expect(PROFILE_PAGE.labels.phone).toBe('Phone number');
    expect(phoneField()).toHaveValue('0412 345 678');
    expect(phoneField()).toHaveAttribute('type', 'tel');
    expect(phoneField()).toHaveAttribute('inputmode', 'tel');
    expect(phoneField()).toHaveAccessibleDescription(PROFILE_PAGE.hints.phone);
  });

  it('keeps the phone hint to two lines on a 360 px phone, and its promise (27c, AC-4.1)', () => {
    // 79 characters measured as 2 lines at 360 px in Chromium; the old 119-character hint was 3.
    expect(PROFILE_PAGE.hints.phone.length).toBeLessThanOrEqual(85);
    expect(PROFILE_PAGE.hints.phone).toContain('Only admins see it');
    expect(PROFILE_PAGE.hints.phone).toContain('never on the website');
  });

  it('is empty for staff who have no number yet', () => {
    renderForm({ ...PROFILE, phone: null });

    expect(phoneField()).toHaveValue('');
  });

  it('refuses a bad number in the browser and sends nothing (AC-4.3)', async () => {
    const user = setupUser();
    const { onSave } = renderForm();

    await user.clear(phoneField());
    await user.type(phoneField(), '12345');
    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.save }));

    expect(onSave).not.toHaveBeenCalled();
    expect(phoneField()).toHaveAccessibleDescription(
      `${PROFILE_PAGE.hints.phone} ${PORTAL_VALIDATION.phoneInvalid}`,
    );
    expect(phoneField()).toHaveFocus();
  });

  it('shows a server refusal on the phone field, not as a form alert (AC-4.3)', async () => {
    const user = setupUser();
    const { onSave } = renderForm();
    onSave.mockResolvedValue({ ok: false, error: 'invalidPhone' });

    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.save }));

    await waitFor(() =>
      expect(phoneField()).toHaveAccessibleDescription(
        `${PROFILE_PAGE.hints.phone} ${PORTAL_ERRORS.invalidPhone}`,
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the other edits when the phone is refused, and says nothing was saved (AC-4.5)', async () => {
    const user = setupUser();
    const { onSave, onSaved } = renderForm();
    onSave.mockResolvedValue({ ok: false, error: 'phoneRequired' });
    const bio = screen.getByLabelText(PROFILE_PAGE.labels.bio);

    await user.clear(bio);
    await user.type(bio, 'New bio');
    await user.clear(phoneField());
    // A saved number left blank is caught in the browser, so type one the server then refuses.
    await user.type(phoneField(), '0499 999 999');
    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ bio: 'New bio', phone: '0499 999 999' }),
    );
    expect(bio).toHaveValue('New bio');
    expect(phoneField()).toHaveValue('0499 999 999');
    expect(phoneField()).toHaveAccessibleDescription(
      `${PROFILE_PAGE.hints.phone} ${PORTAL_ERRORS.phoneRequired}`,
    );
    expect(screen.queryByText(PROFILE_PAGE.saved)).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses clearing a saved number in the browser (AC-4.4)', async () => {
    const user = setupUser();
    const { onSave } = renderForm();

    await user.clear(phoneField());
    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.save }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(PROFILE_VALIDATION.phoneRequired)).toBeInTheDocument();
  });

  it('saves once, shows the saved number formatted and confirms once (AC-4.2, AC-4.5)', async () => {
    const user = setupUser();
    const { onSave, onSaved } = renderForm();
    onSave.mockResolvedValue({ ok: true, data: { ...PROFILE, phone: '+61398765432' } });

    await user.clear(phoneField());
    await user.type(phoneField(), '03-9876-5432');
    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.save }));

    expect(await screen.findAllByText(PROFILE_PAGE.saved)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: PROFILE_PAGE.save })).toHaveLength(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(phoneField()).toHaveValue('(03) 9876 5432');
  });
});
