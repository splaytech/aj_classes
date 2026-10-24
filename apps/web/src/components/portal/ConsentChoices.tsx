// The three optional permissions as separate, unticked-by-default checkboxes (invite-onboarding.md,
// "Consents"). Used on the setup form and in Account → Your choices, so the wording is identical.

import { CONSENT_CHOICES, CONSENT_KINDS } from '@/constants';
import type { ConsentKind } from '@/constants';
import type { Consents } from '@/services';

import formStyles from './PortalForm.module.css';

type ConsentChoicesProps = {
  idPrefix: string;
  values: Consents;
  onChange: (kind: ConsentKind, agreed: boolean) => void;
  disabled?: boolean;
};

export function ConsentChoices({ idPrefix, values, onChange, disabled }: ConsentChoicesProps) {
  return (
    <div className={formStyles.fieldset}>
      {CONSENT_KINDS.map((kind) => (
        <label key={kind} className={formStyles.consent} htmlFor={`${idPrefix}-${kind}`}>
          <input
            id={`${idPrefix}-${kind}`}
            type="checkbox"
            checked={values[kind]}
            disabled={disabled}
            onChange={(event) => onChange(kind, event.target.checked)}
          />
          <span>{CONSENT_CHOICES.labels[kind]}</span>
        </label>
      ))}
    </div>
  );
}
