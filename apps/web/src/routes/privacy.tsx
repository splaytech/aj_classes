// Privacy Policy page (PRP F4). Wording lives in content.constants.ts → PRIVACY.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { Section } from '@/components/ui';
import { BUSINESS, PRIVACY, ROUTES, SEO } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

export function meta() {
  return buildPageMeta(SEO.privacy, ROUTES.privacy);
}

export default function PrivacyPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{PRIVACY.heading}</h1>
        <p>
          <em>{PRIVACY.lastUpdated}</em>
        </p>
        <p>{PRIVACY.intro}</p>

        {PRIVACY.sections.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.text}</p>
          </div>
        ))}

        <p>
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </p>
        <p>
          <a href={ROUTES.home}>{PRIVACY.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
