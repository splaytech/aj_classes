// The latest news, newest first, loaded live in the browser (ADR-0001). Shared by the public
// /posts page and a signed-up user's portal home (open sign-up AC-21), so both always match.

import { POSTS_PUBLIC_PAGE, ROUTES, SECTION_IDS, sectionLink } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { usePublicPosts } from '@/lib/use-public-posts';
import type { PublicPost } from '@/services';

import styles from './PublicPostsList.module.css';

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

export function PublicPostsList() {
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
