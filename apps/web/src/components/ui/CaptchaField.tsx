// The hCaptcha "I am human" check that Web3Forms requires before it accepts a form.
//
// The parent form keeps the token in state:
//   - `onTokenChange(token)` is called when the check is passed,
//   - `onTokenChange('')` when it expires or fails, so the form knows to ask again.
// A token can only be used once, so the parent calls `captchaRef.current?.resetCaptcha()`
// after a failed send.

import HCaptcha from '@hcaptcha/react-hcaptcha';
import type { RefObject } from 'react';

import { A11Y, APP_CONFIG } from '@/constants';

import styles from './CaptchaField.module.css';

type CaptchaFieldProps = {
  captchaRef: RefObject<HCaptcha | null>;
  onTokenChange: (token: string) => void;
  error?: string;
  theme?: 'light' | 'dark'; // "dark" for the navy footer
};

export function CaptchaField({
  captchaRef,
  onTokenChange,
  error,
  theme = 'light',
}: CaptchaFieldProps) {
  // Red text is hard to read on navy, so the footer uses gold instead.
  const errorClassName = theme === 'dark' ? `${styles.error} ${styles.onDark}` : styles.error;

  return (
    <div className={styles.field} role="group" aria-label={A11Y.captcha}>
      <HCaptcha
        ref={captchaRef}
        sitekey={APP_CONFIG.form.captchaSiteKey}
        languageOverride={APP_CONFIG.form.captchaLanguage}
        reCaptchaCompat={false}
        theme={theme}
        onVerify={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange('')}
        onError={() => onTokenChange('')}
      />
      {error && (
        <p className={errorClassName} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
