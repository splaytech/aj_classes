// Home page: all Release 1 sections, top to bottom (PRP F2).

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ROUTES, SEO } from '@/constants';
import { About, Approach, ContactSection, Faq, Hero, WhyUs } from '@/sections';
import { buildHomeJsonLd, buildPageMeta } from '@/lib/seo';

export function meta() {
  return [...buildPageMeta(SEO.home, ROUTES.home), buildHomeJsonLd()];
}

export default function HomePage() {
  return (
    <SiteLayout>
      <Hero />
      <WhyUs />
      <Approach />
      <About />
      <Faq />
      <ContactSection />
    </SiteLayout>
  );
}
