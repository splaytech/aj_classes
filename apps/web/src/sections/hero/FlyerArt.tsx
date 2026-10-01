// Simple decorative illustrations for the hero flyers: a book stack, a rising chart,
// an open book and a target. Colours come from theme.css through the CSS classes below.
// They are decoration only, so screen readers skip them (aria-hidden).

import type { HeroSlide } from '@/constants';

import styles from './FlyerArt.module.css';

function BookStack() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className={styles.art}>
      <rect x="40" y="112" width="120" height="22" rx="4" className={styles.navy} />
      <rect x="52" y="88" width="104" height="22" rx="4" className={styles.gold} />
      <rect x="44" y="64" width="112" height="22" rx="4" className={styles.white} />
      <rect x="60" y="68" width="60" height="4" rx="2" className={styles.lineDark} />
      <rect x="64" y="94" width="50" height="4" rx="2" className={styles.lineDark} />
      <path d="M150 20 l14 14 l-46 46 l-18 4 l4 -18 z" className={styles.gold} />
    </svg>
  );
}

function RisingChart() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className={styles.art}>
      <rect x="36" y="100" width="24" height="40" rx="4" className={styles.white} />
      <rect x="72" y="78" width="24" height="62" rx="4" className={styles.white} />
      <rect x="108" y="56" width="24" height="84" rx="4" className={styles.white} />
      <rect x="144" y="30" width="24" height="110" rx="4" className={styles.gold} />
      <path d="M40 86 L84 64 L120 44 L160 16" className={styles.goldStroke} />
      <path d="M150 14 L162 14 L162 26" className={styles.goldStroke} />
    </svg>
  );
}

function OpenBook() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className={styles.art}>
      <path d="M100 48 C80 36 52 36 32 42 V126 C52 120 80 120 100 132 Z" className={styles.white} />
      <path
        d="M100 48 C120 36 148 36 168 42 V126 C148 120 120 120 100 132 Z"
        className={styles.white}
      />
      <path d="M100 48 V132" className={styles.navyStroke} />
      <rect x="46" y="62" width="40" height="4" rx="2" className={styles.lineBlue} />
      <rect x="46" y="76" width="34" height="4" rx="2" className={styles.lineBlue} />
      <rect x="114" y="62" width="40" height="4" rx="2" className={styles.lineBlue} />
      <rect x="114" y="76" width="30" height="4" rx="2" className={styles.lineBlue} />
      <circle cx="160" cy="24" r="12" className={styles.gold} />
    </svg>
  );
}

function Target() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className={styles.art}>
      <circle cx="100" cy="84" r="56" className={styles.white} />
      <circle cx="100" cy="84" r="38" className={styles.gold} />
      <circle cx="100" cy="84" r="20" className={styles.white} />
      <circle cx="100" cy="84" r="7" className={styles.navy} />
      <path d="M100 84 L160 24" className={styles.navyStroke} />
      <path d="M150 20 L164 20 L164 34" className={styles.navyStroke} />
    </svg>
  );
}

export function FlyerArt({ art }: { art: HeroSlide['art'] }) {
  if (art === 'books') return <BookStack />;
  if (art === 'chart') return <RisingChart />;
  if (art === 'openBook') return <OpenBook />;
  return <Target />;
}
