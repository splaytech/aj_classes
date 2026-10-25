// Checks an admin post before it's sent (AC-1.14). Lengths are counted after trimming, so a
// title or body of only spaces is refused here, even though the database check would accept it.

import { POST_LIMITS, POSTS_PAGE } from '@/constants';
import type { PostInput } from '@/services';

export type PostErrors = Partial<Record<keyof PostInput, string>>;

/** The post as it will be stored: no leading or trailing spaces. */
export function trimPost(input: PostInput): PostInput {
  return { title: input.title.trim(), body: input.body.trim() };
}

function isWithin(text: string, min: number, max: number): boolean {
  return text.length >= min && text.length <= max;
}

/** Empty when the post can be saved. Expects a trimmed post (see trimPost). */
export function validatePost(post: PostInput): PostErrors {
  const errors: PostErrors = {};
  if (!isWithin(post.title, POST_LIMITS.titleMin, POST_LIMITS.titleMax)) {
    errors.title = POSTS_PAGE.titleLength;
  }
  if (!isWithin(post.body, POST_LIMITS.bodyMin, POST_LIMITS.bodyMax)) {
    errors.body = POSTS_PAGE.bodyLength;
  }
  return errors;
}

export function hasPostErrors(errors: PostErrors): boolean {
  return Object.keys(errors).length > 0;
}
