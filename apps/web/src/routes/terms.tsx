// Terms & Conditions (open sign-up AC-50). Wording lives in content.constants.ts → TERMS, a draft
// for Saurabh's approval before release.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { BUSINESS, ROUTES, SEO, TERMS } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

export function meta() {
  return buildPageMeta(SEO.terms, ROUTES.terms);
}

export default function TermsPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{TERMS.heading}</h1>
        <p>
          <em>{TERMS.lastUpdated}</em>
        </p>
        <p>{TERMS.intro}</p>

        {TERMS.sections.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
            {section.privacyLink ? (
              <p>
                {section.privacyLink.before}
                <a href={ROUTES.privacy}>{section.privacyLink.label}</a>
                {section.privacyLink.after}
              </p>
            ) : (
              <p>{section.text}</p>
            )}
          </div>
        ))}

        <p>
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </p>
        <p>
          <a href={ROUTES.home}>{TERMS.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}

// Anything unexpected while showing the page: keep the site's header and footer, never a blank page.
export function ErrorBoundary() {
  return (
    <SiteLayout>
      <Section>
        <h1>{TERMS.errorBoundary.heading}</h1>
        <p>{TERMS.errorBoundary.text}</p>
        <ButtonLink href={ROUTES.home}>{TERMS.errorBoundary.backHome}</ButtonLink>
      </Section>
    </SiteLayout>
  );
}
