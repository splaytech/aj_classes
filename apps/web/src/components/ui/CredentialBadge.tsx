// A small verified credential, e.g. "Working With Children Check held": a soft green pill with
// a tick, for team cards and staff profiles (ui-polish.md §3, item 4). With `href` it links to
// the official page about the credential, opening in a new tab.

import { BadgeCheck, ExternalLink } from 'lucide-react';

import styles from './CredentialBadge.module.css';

type CredentialBadgeProps = {
  children: string;
  href?: string;
  /** Screen-reader name for the link; starts with the visible text. */
  linkLabel?: string;
};

export function CredentialBadge({ children, href, linkLabel }: CredentialBadgeProps) {
  const content = (
    <>
      <BadgeCheck className={styles.icon} aria-hidden="true" />
      {children}
    </>
  );

  if (!href) return <span className={styles.badge}>{content}</span>;

  return (
    <a
      className={`${styles.badge} ${styles.link}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={linkLabel}
    >
      {content}
      <ExternalLink className={styles.external} aria-hidden="true" />
    </a>
  );
}
