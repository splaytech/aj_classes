// Cloudflare Turnstile "I am human" check, required by Supabase on staff sign-in and
// password reset (R2a design §8).
//
// Same contract as CaptchaField: the parent keeps the token, gets '' when it expires, and
// calls `turnstileRef.current?.reset()` after a failed send (tokens work only once).

import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import type { RefObject } from 'react';

import { A11Y, APP_CONFIG } from '@/constants';

import styles from './CaptchaField.module.css';

type TurnstileFieldProps = {
  turnstileRef: RefObject<TurnstileInstance | null>;
  onTokenChange: (token: string) => void;
  error?: string;
};

export function TurnstileField({ turnstileRef, onTokenChange, error }: TurnstileFieldProps) {
  return (
    <div className={styles.field} role="group" aria-label={A11Y.captcha}>
      <Turnstile
        ref={turnstileRef}
        siteKey={APP_CONFIG.turnstile.siteKey}
        options={{ language: APP_CONFIG.form.captchaLanguage, theme: 'light' }}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange('')}
        onError={() => onTokenChange('')}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type { TurnstileInstance };
