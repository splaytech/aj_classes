// Thank-you page Kit sends people to after they confirm their newsletter subscription.
// Kept out of search results: it only makes sense after confirming.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { ROUTES, SEO, SUBSCRIBED_PAGE } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

export function meta() {
  return buildPageMeta(SEO.subscribed, ROUTES.subscribed, { noIndex: true });
}

export default function SubscribedPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{SUBSCRIBED_PAGE.heading}</h1>
        <p>{SUBSCRIBED_PAGE.text}</p>
        <p>
          <strong>{SUBSCRIBED_PAGE.tip}</strong>
        </p>
        <ButtonLink href={ROUTES.home}>{SUBSCRIBED_PAGE.backHome}</ButtonLink>
      </Section>
    </SiteLayout>
  );
}
