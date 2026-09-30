// Centres content and keeps it to a comfortable maximum width.

import type { ReactNode } from 'react';

import styles from './Container.module.css';

export function Container({ children }: { children: ReactNode }) {
  return <div className={styles.container}>{children}</div>;
}
