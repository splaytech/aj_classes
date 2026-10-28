// A short list of qualifications: one text box per line, with Add and Remove.
// Adding a line moves focus into the new box, so people can type straight away.

import { useEffect, useState } from 'react';
import type { Ref } from 'react';

import { PROFILE_LIMITS, PROFILE_PAGE } from '@/constants';

import styles from './PortalForm.module.css';

type QualificationsEditorProps = {
  idPrefix: string;
  lines: string[];
  onChange: (lines: string[]) => void;
  error?: string;
  /** The whole list, so a form can bring it into view when it has an error. */
  ref?: Ref<HTMLFieldSetElement>;
};

export function QualificationsEditor({
  idPrefix,
  lines,
  onChange,
  error,
  ref,
}: QualificationsEditorProps) {
  const errorId = `${idPrefix}-error`;
  const canAdd = lines.length < PROFILE_LIMITS.qualificationsMax;
  const [lineToFocus, setLineToFocus] = useState<number | null>(null);

  useEffect(() => {
    if (lineToFocus !== null) document.getElementById(lineId(idPrefix, lineToFocus))?.focus();
  }, [idPrefix, lineToFocus]);

  function add() {
    onChange([...lines, '']);
    setLineToFocus(lines.length);
  }

  function update(index: number, value: string) {
    onChange(lines.map((line, position) => (position === index ? value : line)));
  }

  function remove(index: number) {
    onChange(lines.filter((_, position) => position !== index));
  }

  return (
    <fieldset ref={ref} className={styles.fieldset} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.label}>{PROFILE_PAGE.labels.qualifications}</legend>
      <p className={styles.hint}>{PROFILE_PAGE.hints.qualifications}</p>

      {lines.map((line, index) => (
        <div key={index} className={styles.listRow}>
          <input
            id={lineId(idPrefix, index)}
            className={styles.input}
            aria-label={PROFILE_PAGE.qualificationLabel(index + 1)}
            maxLength={PROFILE_LIMITS.qualificationMax}
            value={line}
            onChange={(event) => update(index, event.target.value)}
          />
          <button
            type="button"
            className={styles.toggle}
            aria-label={PROFILE_PAGE.removeQualification(index + 1)}
            onClick={() => remove(index)}
          >
            {PROFILE_PAGE.remove}
          </button>
        </div>
      ))}

      {canAdd ? (
        <button type="button" className={styles.textButton} onClick={add}>
          {PROFILE_PAGE.addQualification}
        </button>
      ) : (
        <p className={styles.hint}>{PROFILE_PAGE.maxQualifications}</p>
      )}

      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

function lineId(idPrefix: string, index: number): string {
  return `${idPrefix}-${index}`;
}
