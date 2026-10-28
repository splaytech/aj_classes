// Edit name, phone, subjects, bio and qualifications (R2a story US12; item 4 for the phone).
// Takes the save function as a prop, so admins can reuse it for other staff (story US18).

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui';
import { PORTAL_ERRORS, PROFILE_LIMITS, PROFILE_PAGE, SUBJECTS } from '@/constants';
import { formatPhone } from '@/lib/format';
import { cleanQualifications, subjectsToSave, validateProfile } from '@/lib/profile-validation';
import type { ProfileErrors } from '@/lib/profile-validation';
import { revealField } from '@/lib/reveal-field';
import type { ErrorKey, ProfileChanges, Result, StaffProfile } from '@/services';

import { FormAlert, FormStatus, TextAreaInput, TextInput } from './PortalField';
import { QualificationsEditor } from './QualificationsEditor';
import { SubjectPicker } from './SubjectPicker';
import styles from './PortalForm.module.css';

const FIELD_IDS = {
  fullName: 'profile-full-name',
  phone: 'profile-phone',
  bio: 'profile-bio',
  qualifications: 'profile-qualifications',
} as const;

type ProfileField = keyof ProfileErrors;

const OFFERED_SUBJECTS = SUBJECTS.map((subject) => subject.key);

// The server refused a phone the browser let through: show it on the field, not the form (AC-4.3).
const PHONE_ERROR_KEYS: readonly ErrorKey[] = ['invalidPhone', 'phoneRequired'];

type ProfileFormProps = {
  profile: StaffProfile;
  onSave: (changes: ProfileChanges) => Promise<Result<StaffProfile>>;
  onSaved: () => void;
};

export function ProfileForm({ profile, onSave, onSaved }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(formatPhone(profile.phone));
  const [subjects, setSubjects] = useState(
    profile.subjects.filter((key) => OFFERED_SUBJECTS.includes(key as never)),
  );
  const [bio, setBio] = useState(profile.bio);
  const [qualifications, setQualifications] = useState(profile.qualifications);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  // The fields an error can point at, so Save can bring the first bad one into view (27d).
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const qualificationsRef = useRef<HTMLFieldSetElement>(null);

  function fieldElement(field: ProfileField): HTMLElement | null {
    const elements = {
      fullName: fullNameRef.current,
      phone: phoneRef.current,
      bio: bioRef.current,
      qualifications: qualificationsRef.current,
    };
    return elements[field];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');

    const changes: ProfileChanges = {
      fullName,
      phone,
      bio,
      qualifications: cleanQualifications(qualifications),
      subjects: subjectsToSave(subjects, profile.subjects, OFFERED_SUBJECTS),
    };
    const found = validateProfile(changes, profile.phone);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      revealField(fieldElement(Object.keys(found)[0] as ProfileField));
      return;
    }

    setFormError('');
    setSaving(true);
    const result = await onSave(changes);
    setSaving(false);

    // Every field keeps what was typed on a failure, so nothing has to be entered again (AC-4.5).
    if (!result.ok) {
      if (PHONE_ERROR_KEYS.includes(result.error)) {
        setErrors({ phone: PORTAL_ERRORS[result.error] });
        revealField(phoneRef.current);
      } else {
        setFormError(PORTAL_ERRORS[result.error]);
      }
      return;
    }
    setQualifications(result.data.qualifications);
    setPhone(formatPhone(result.data.phone));
    setStatus(PROFILE_PAGE.saved);
    onSaved();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextInput
        id={FIELD_IDS.fullName}
        label={PROFILE_PAGE.labels.fullName}
        autoComplete="name"
        maxLength={PROFILE_LIMITS.nameMax}
        value={fullName}
        onChange={setFullName}
        error={errors.fullName}
        ref={fullNameRef}
      />
      <TextInput
        id={FIELD_IDS.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        label={PROFILE_PAGE.labels.phone}
        hint={PROFILE_PAGE.hints.phone}
        value={phone}
        onChange={setPhone}
        error={errors.phone}
        ref={phoneRef}
      />
      <SubjectPicker
        legend={PROFILE_PAGE.labels.subjects}
        hint={PROFILE_PAGE.hints.subjects}
        selected={subjects}
        onChange={setSubjects}
      />
      <TextAreaInput
        id={FIELD_IDS.bio}
        label={PROFILE_PAGE.labels.bio}
        hint={PROFILE_PAGE.hints.bio}
        maxLength={PROFILE_LIMITS.bioMax}
        value={bio}
        onChange={setBio}
        error={errors.bio}
        counter={PROFILE_PAGE.bioCount(bio.length)}
        ref={bioRef}
      />
      <QualificationsEditor
        idPrefix={FIELD_IDS.qualifications}
        lines={qualifications}
        onChange={setQualifications}
        error={errors.qualifications}
        ref={qualificationsRef}
      />
      <FormAlert message={formError} />
      <FormStatus message={status} />
      <Button type="submit" disabled={saving}>
        {saving ? PROFILE_PAGE.saving : PROFILE_PAGE.save}
      </Button>
    </form>
  );
}
