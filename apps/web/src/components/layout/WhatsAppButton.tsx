// Floating "Chat on WhatsApp" button at the lower right of every public page (Release 2,
// docs/requirements/release-2/whatsapp-button.md). Hidden when no WhatsApp number is set.

import { ANALYTICS_EVENTS, WHATSAPP_BUTTON, whatsappChatUrl } from '@/constants';
import { trackEvent } from '@/lib/analytics';

import styles from './WhatsAppButton.module.css';

// WhatsApp's own logo (brand rules: unaltered, only to link to WhatsApp; G4).
const WHATSAPP_LOGO_PATH =
  'M16.04 3C8.86 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A13 13 0 0 0 16.04 29C23.2 29 29 23.17 29 16S23.2 3 16.04 3Zm0 23.8c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-3.96 1.04 1.06-3.86-.26-.4A10.76 10.76 0 0 1 5.3 16c0-5.93 4.82-10.75 10.75-10.75 5.92 0 10.74 4.82 10.74 10.75 0 5.92-4.82 10.8-10.75 10.8Zm5.9-8.05c-.32-.16-1.91-.94-2.2-1.05-.3-.11-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.6-.96-.85-1.6-1.9-1.79-2.22-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.58 1.16 3.12 1.32 3.33.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.91-.78 2.18-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z';

function trackClick() {
  trackEvent(ANALYTICS_EVENTS.whatsappClick);
}

export function WhatsAppButton() {
  const href = whatsappChatUrl();
  if (!href) return null;

  return (
    <a
      className={styles.button}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={WHATSAPP_BUTTON.ariaLabel}
      onClick={trackClick}
    >
      <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path fill="currentColor" d={WHATSAPP_LOGO_PATH} />
      </svg>
      <span className={styles.label} aria-hidden="true">
        {WHATSAPP_BUTTON.label}
      </span>
    </a>
  );
}
