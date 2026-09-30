// Lets keyboard and screen-reader users jump straight past the header (PRP F2.9).

import { A11Y, SECTION_IDS } from '@/constants';

import styles from './SkipLink.module.css';

export function SkipLink() {
  return (
    <a className={styles.skipLink} href={`#${SECTION_IDS.main}`}>
      {A11Y.skipToContent}
    </a>
  );
}
