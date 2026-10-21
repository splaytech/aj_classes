// A small verified credential, e.g. "Working With Children Check held": a soft green pill with
// a tick, for team cards and staff profiles (ui-polish.md §3, item 4).

import { BadgeCheck } from 'lucide-react';

import styles from './CredentialBadge.module.css';

export function CredentialBadge({ children }: { children: string }) {
  return (
    <span className={styles.badge}>
      <BadgeCheck className={styles.icon} aria-hidden="true" />
      {children}
    </span>
  );
}
