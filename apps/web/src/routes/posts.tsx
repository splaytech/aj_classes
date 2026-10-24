// Latest news (/posts, posts.md): admin posts, newest first, visible to every visitor. Reads
// live via the anon session on the client, so a post appears immediately with no rebuild (R4).

import { useLoaderData } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { Section } from '@/components/ui';
import { POSTS_PUBLIC_PAGE, ROUTES } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPageMeta } from '@/lib/seo';
import { listPosts } from '@/services';

import styles from './posts.module.css';

export function meta() {
  return buildPageMeta(POSTS_PUBLIC_PAGE.seo, ROUTES.posts);
}

export async function clientLoader() {
  return listPosts();
}

export default function PostsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const posts = loaded.ok ? loaded.data : [];

  return (
    <SiteLayout>
      <Section>
        <h1>{POSTS_PUBLIC_PAGE.heading}</h1>
        <p className={styles.intro}>{POSTS_PUBLIC_PAGE.intro}</p>
        {posts.length === 0 ? (
          <p>{POSTS_PUBLIC_PAGE.empty}</p>
        ) : (
          <ul className={styles.posts}>
            {posts.map((post) => (
              <li key={post.id} className={styles.post}>
                <p className={styles.date}>{formatDateTime(post.publishedAt)}</p>
                <h2>{post.title}</h2>
                <p className={styles.body}>{post.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </SiteLayout>
  );
}
