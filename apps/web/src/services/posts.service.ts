// Admin daily posts (posts.md): a short title + body, timestamped, newest-first. Reads work for
// any visitor (public RLS policy); writes work only for an admin with two-step (RLS enforces it,
// this module does not re-check).

import { toErrorKey } from './auth-errors';
import { POST_COLUMNS, POSTS_MAX_ROWS, toPost } from './post-rows';
import type { PostRow } from './post-rows';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Post, PostInput, Result } from './types';

/** Every post, newest-first. Used by the admin page; the public page uses `public-posts.client.ts`. */
export async function listPosts(): Promise<Result<Post[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('posts')
      .select(POST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(POSTS_MAX_ROWS);
    if (error) return fail(toErrorKey(error));

    return succeed((data as PostRow[]).map(toPost));
  });
}

export async function createPost(input: PostInput): Promise<Result<Post>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('posts')
      .insert({ title: input.title, body: input.body })
      .select(POST_COLUMNS)
      .single();
    if (error) return fail(toErrorKey(error));

    return succeed(toPost(data as PostRow));
  });
}

export async function updatePost(id: string, input: PostInput): Promise<Result<Post>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('posts')
      .update({ title: input.title, body: input.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(POST_COLUMNS)
      .single();
    if (error) return fail(toErrorKey(error));

    return succeed(toPost(data as PostRow));
  });
}

export async function deletePost(id: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.from('posts').delete().eq('id', id);
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
