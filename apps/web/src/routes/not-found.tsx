// 404 page for any URL that doesn't exist. Kept out of search results.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { NOT_FOUND, ROUTES, SEO } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

export function meta() {
  return buildPageMeta(SEO.notFound, ROUTES.notFound, { noIndex: true });
}

export default function NotFoundPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{NOT_FOUND.heading}</h1>
        <p>{NOT_FOUND.text}</p>
        <ButtonLink href={ROUTES.home}>{NOT_FOUND.backHome}</ButtonLink>
      </Section>
    </SiteLayout>
  );
}
