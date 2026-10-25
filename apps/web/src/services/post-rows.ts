// How a `posts` row looks on the wire and how it becomes a `Post`. Shared by the admin service
// (supabase-js) and the public client (plain fetch), so the public pages can map rows without
// importing the supabase-js service (ADR-0001).

import { POST_LIMITS } from '@/constants';

import type { Post } from './types';

/** Most rows either page shows. */
export const POSTS_MAX_ROWS = POST_LIMITS.listCap;

export const POST_COLUMNS = 'id, created_at, updated_at, title, body, author_id';

export type PostRow = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  author_id: string | null;
};

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    publishedAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
  };
}
