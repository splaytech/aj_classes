// The frame every page shares: skip link, header, main content, footer.

import type { ReactNode } from 'react';

import { SECTION_IDS } from '@/constants';

import { Footer } from './footer/Footer';
import { Header } from './header/Header';
import { SkipLink } from './SkipLink';

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id={SECTION_IDS.main}>{children}</main>
      <Footer />
    </>
  );
}
