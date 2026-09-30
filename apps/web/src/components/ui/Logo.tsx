// The AJ Classes logo mark with the "AJ Classes" wordmark beside it.

import { ASSETS, LOGO } from '@/constants';

import styles from './Logo.module.css';

type LogoProps = {
  inverse?: boolean; // white wordmark, for use on the navy footer
};

export function Logo({ inverse = false }: LogoProps) {
  const wordmarkClass = inverse ? `${styles.wordmark} ${styles.inverse}` : styles.wordmark;

  return (
    <span className={styles.logo}>
      <img className={styles.mark} src={ASSETS.logo} alt={LOGO.alt} width={40} height={40} />
      <span className={wordmarkClass}>
        <strong>{LOGO.wordmarkBold}</strong> {LOGO.wordmarkRegular}
      </span>
    </span>
  );
}
