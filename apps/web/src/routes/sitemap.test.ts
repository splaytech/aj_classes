import { describe, expect, it } from 'vitest';

import { AREA_PATHS, CENTRE_PATHS, GUIDE_PATHS, PORTAL_ROUTES, ROUTES } from '@/constants';

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

  it('lists /terms right after /privacy, with and without Supabase (open sign-up AC-50)', () => {
    for (const supabaseConfigured of [true, false]) {
      const paths = publicSitemapPaths(supabaseConfigured);
      expect(paths.indexOf(ROUTES.terms)).toBe(paths.indexOf(ROUTES.privacy) + 1);
    }
  });

  it('lists /careers with and without Supabase (AC-20)', () => {
    expect(publicSitemapPaths(true)).toContain(ROUTES.careers);
    expect(publicSitemapPaths(false)).toContain(ROUTES.careers);
  });

  it('lists every area page, centre page and parent guide, with and without Supabase', () => {
    for (const supabaseConfigured of [true, false]) {
      const paths = publicSitemapPaths(supabaseConfigured);
      for (const path of [...AREA_PATHS, ...CENTRE_PATHS, ...GUIDE_PATHS]) {
        expect(paths).toContain(path);
      }
    }
  });

  it('never lists the 404 page or the portal', () => {
    const paths = publicSitemapPaths(true);
    expect(paths).not.toContain(ROUTES.notFound);
    expect(paths.some((path) => path.startsWith('/portal'))).toBe(false);
    // Open sign-up (AC-11): the sign-up pages are portal pages, never in the sitemap.
    for (const path of [
      PORTAL_ROUTES.signUp,
      PORTAL_ROUTES.signUpResend,
      PORTAL_ROUTES.authCallback,
    ]) {
      expect(paths).not.toContain(path);
    }
  });
});
