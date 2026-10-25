import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/constants';

import { publicSitemapPaths } from './sitemap';

describe('sitemap pages', () => {
  it('lists /posts last when Supabase is configured', () => {
    const paths = publicSitemapPaths(true);
    expect(paths.at(-1)).toBe(ROUTES.posts);
    expect(paths).toContain(ROUTES.home);
  });

  it('leaves /posts out when Supabase is not configured (AC-1.11)', () => {
    const paths = publicSitemapPaths(false);
    expect(paths).not.toContain(ROUTES.posts);
    expect(paths).toContain(ROUTES.privacy);
  });

  it('never lists the 404 page or the portal', () => {
    const paths = publicSitemapPaths(true);
    expect(paths).not.toContain(ROUTES.notFound);
    expect(paths.some((path) => path.startsWith('/portal'))).toBe(false);
  });
});
