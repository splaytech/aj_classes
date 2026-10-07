// Checkboxes for the subjects a tutor teaches. The list comes from SUBJECTS (constants).

import { SUBJECTS } from '@/constants';

import styles from './PortalForm.module.css';

type SubjectPickerProps = {
  legend: string;
  hint: string;
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function SubjectPicker({ legend, hint, selected, onChange }: SubjectPickerProps) {
  function toggle(key: string, isChecked: boolean) {
    onChange(isChecked ? [...selected, key] : selected.filter((item) => item !== key));
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend}</legend>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.checkboxGrid}>
        {SUBJECTS.map((subject) => (
          <label key={subject.key} className={styles.checkbox}>
            <input
              type="checkbox"
              checked={selected.includes(subject.key)}
              onChange={(event) => toggle(subject.key, event.target.checked)}
            />
            {subject.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
