// The frame every public page shares: skip link, header, main content, footer and the
// WhatsApp chat button (not on /portal, which has its own layout).

import type { ReactNode } from 'react';

import { SECTION_IDS } from '@/constants';

import { Footer } from './footer/Footer';
import { Header } from './header/Header';
import { SkipLink } from './SkipLink';
import { WhatsAppButton } from './WhatsAppButton';

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id={SECTION_IDS.main}>{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
