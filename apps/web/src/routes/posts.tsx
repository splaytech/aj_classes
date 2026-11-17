// Latest news (/posts, posts.md): admin posts, newest first, visible to every visitor.
// Pre-rendered as a shell (heading, intro, meta) so crawlers and a direct visit get a real page;
// the posts themselves load live in the browser, so a new post shows with no rebuild (ADR-0001).

import { SiteLayout } from '@/components/layout/SiteLayout';
import { PublicPostsList } from '@/components/posts/PublicPostsList';
import { ButtonLink, Section } from '@/components/ui';
import { POSTS_PUBLIC_PAGE, ROUTES } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

import styles from './posts.module.css';

export function meta() {
  return buildPageMeta(POSTS_PUBLIC_PAGE.seo, ROUTES.posts);
}

export default function PostsPage() {
  return (
    <SiteLayout>
      <Section>
        <div className={styles.page}>
          <h1>{POSTS_PUBLIC_PAGE.heading}</h1>
          <p className={styles.intro}>{POSTS_PUBLIC_PAGE.intro}</p>
          <PublicPostsList />
        </div>
      </Section>
    </SiteLayout>
  );
}

// Anything unexpected while showing the page: keep the site's header and footer, never a blank page.
export function ErrorBoundary() {
  return (
    <SiteLayout>
      <Section>
        <h1>{POSTS_PUBLIC_PAGE.errorBoundary.heading}</h1>
        <p>{POSTS_PUBLIC_PAGE.errorBoundary.text}</p>
        <ButtonLink href={ROUTES.home}>{POSTS_PUBLIC_PAGE.errorBoundary.backHome}</ButtonLink>
      </Section>
    </SiteLayout>
  );
}
