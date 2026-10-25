import { describe, expect, it } from 'vitest';

import { POST_LIMITS, POSTS_PAGE } from '@/constants';

import { hasPostErrors, trimPost, validatePost } from './post-validation';

const VALID = { title: 'Term 4 starts', body: 'Classes resume on Monday.' };

function check(title: string, body: string) {
  return validatePost(trimPost({ title, body }));
}

describe('validatePost: title message (AC-1.14)', () => {
  it('refuses an empty title', () => {
    expect(check('', VALID.body).title).toBe(POSTS_PAGE.titleLength);
  });

  it('refuses a title of only spaces (N-49)', () => {
    expect(check('   ', VALID.body).title).toBe(POSTS_PAGE.titleLength);
  });

  it('refuses a title over the limit', () => {
    expect(check('T'.repeat(POST_LIMITS.titleMax + 1), VALID.body).title).toBe(
      POSTS_PAGE.titleLength,
    );
  });

  it('accepts a title at the limit, counted without its outer spaces', () => {
    expect(check(`  ${'T'.repeat(POST_LIMITS.titleMax)}  `, VALID.body).title).toBeUndefined();
  });
});

describe('validatePost: body message (AC-1.14)', () => {
  it('refuses an empty body', () => {
    expect(check(VALID.title, '').body).toBe(POSTS_PAGE.bodyLength);
  });

  it('refuses a body of only spaces and line breaks (N-49)', () => {
    expect(check(VALID.title, ' \n \t ').body).toBe(POSTS_PAGE.bodyLength);
  });

  it('refuses a body over the limit', () => {
    expect(check(VALID.title, 'B'.repeat(POST_LIMITS.bodyMax + 1)).body).toBe(
      POSTS_PAGE.bodyLength,
    );
  });
});

describe('body counter message', () => {
  it('shows characters used out of the limit', () => {
    expect(POSTS_PAGE.bodyCount(12)).toBe(`12 / ${POST_LIMITS.bodyMax} characters`);
  });
});

describe('trimPost and a valid post', () => {
  it('removes leading and trailing spaces before saving, keeping inner line breaks', () => {
    expect(trimPost({ title: '  Hello ', body: '\n Line one\nLine two \n' })).toEqual({
      title: 'Hello',
      body: 'Line one\nLine two',
    });
  });

  it('has no errors for a normal post', () => {
    expect(hasPostErrors(check(VALID.title, VALID.body))).toBe(false);
  });
});
