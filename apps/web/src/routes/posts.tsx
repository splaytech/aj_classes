// Latest news (/posts, posts.md): admin posts, newest first, visible to every visitor.
// Pre-rendered as a shell (heading, intro, meta) so crawlers and a direct visit get a real page;
// the posts themselves load live in the browser, so a new post shows with no rebuild (ADR-0001).

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { POSTS_PUBLIC_PAGE, ROUTES, SECTION_IDS, sectionLink } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPageMeta } from '@/lib/seo';
import { usePublicPosts } from '@/lib/use-public-posts';
import type { PublicPost } from '@/services';

import styles from './posts.module.css';

export function meta() {
  return buildPageMeta(POSTS_PUBLIC_PAGE.seo, ROUTES.posts);
}

function PostList({ posts }: { posts: PublicPost[] }) {
  return (
    <ul className={styles.posts}>
      {posts.map((post) => (
        <li key={post.id} className={styles.post}>
          <p className={styles.date}>{formatDateTime(post.publishedAt)}</p>
          <h2>{post.title}</h2>
          <p className={styles.body}>{post.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** The empty and error states: one line, then a way to carry on (AC-1.6, AC-1.7). */
function NoPosts({ message }: { message: string }) {
  return (
    <div className={styles.status}>
      <p>{message}</p>
      <p className={styles.statusLinks}>
        <a href={ROUTES.home}>{POSTS_PUBLIC_PAGE.emptyLinks.home}</a>
        <a href={sectionLink(SECTION_IDS.contact)}>
          {POSTS_PUBLIC_PAGE.emptyLinks.registerInterest}
        </a>
      </p>
    </div>
  );
}

function PostsContent() {
  const state = usePublicPosts();

  if (state.status === 'loading') {
    return <p className={styles.status}>{POSTS_PUBLIC_PAGE.loading}</p>;
  }
  if (state.status === 'error') {
    return <NoPosts message={POSTS_PUBLIC_PAGE.error} />;
  }
  if (state.posts.length === 0) {
    return <NoPosts message={POSTS_PUBLIC_PAGE.empty} />;
  }
  return <PostList posts={state.posts} />;
}

export default function PostsPage() {
  return (
    <SiteLayout>
      <Section>
        <div className={styles.page}>
          <h1>{POSTS_PUBLIC_PAGE.heading}</h1>
          <p className={styles.intro}>{POSTS_PUBLIC_PAGE.intro}</p>
          <PostsContent />
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
