// Guards ADR-0001: /posts is served as its own pre-rendered page on both hosts, never through
// the portal fallback (which has no title or h1 and sends the portal CSP, noindex and no-store).
// Since item 5, public pages send their own CSP too (ADR-0005), so the CSP check below tells the
// portal one apart by its value.

import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/constants';

import routerConfig from '../react-router.config';
import railway from '../serve.railway.json';
import vercel from '../vercel.json';

const PORTAL_ONLY_HEADERS = ['X-Robots-Tag', 'Cache-Control'];

const PORTAL_SOURCE = '/portal/:path*';

function cspOf(rule: { headers: { key: string; value: string }[] }): string | undefined {
  return rule.headers.find((header) => header.key === 'Content-Security-Policy')?.value;
}

/** Vercel sources use path-to-regexp: `:name*` is any rest of the path, `(.*)` is a regex. */
function vercelSourceMatches(source: string, path: string): boolean {
  const pattern = source.replace(/\/:[a-z]+\*/gi, '(?:/.*)?');
  return new RegExp(`^${pattern}$`).test(path);
}

/** serve sources are globs: `**` is any depth, `*` is one segment. */
function serveSourceMatches(source: string, path: string): boolean {
  const pattern = source
    .replace(/^\//, '')
    .split('**')
    .map((part) => part.replace(/\./g, '\\.').replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^/?${pattern}$`).test(path);
}

function setsPortalOnlyHeader(rule: { headers: { key: string }[] }): boolean {
  return rule.headers.some((header) => PORTAL_ONLY_HEADERS.includes(header.key));
}

describe('hosting config for /posts (ADR-0001)', () => {
  it('pre-renders /posts (AC-1.1)', () => {
    expect(routerConfig.prerender).toContain(ROUTES.posts);
  });

  it('has no rewrite that catches /posts on Vercel or Railway (AC-1.2)', () => {
    for (const rewrite of vercel.rewrites) {
      expect(vercelSourceMatches(rewrite.source, ROUTES.posts)).toBe(false);
    }
    for (const rewrite of railway.rewrites) {
      expect(serveSourceMatches(rewrite.source, ROUTES.posts)).toBe(false);
    }
  });

  it('sends noindex and no-store on Vercel only under /portal (AC-1.4)', () => {
    const portalRules = vercel.headers.filter(setsPortalOnlyHeader);
    expect(portalRules.map((rule) => rule.source)).toEqual([PORTAL_SOURCE]);
    expect(vercelSourceMatches(PORTAL_SOURCE, ROUTES.posts)).toBe(false);
  });

  it('sends the portal CSP on Vercel only under /portal, so /posts gets the public one', () => {
    const portalRule = vercel.headers.find((rule) => rule.source === PORTAL_SOURCE);
    const portalCsp = portalRule && cspOf(portalRule);
    expect(portalCsp).toBeDefined();

    const rulesWithPortalCsp = vercel.headers.filter((rule) => cspOf(rule) === portalCsp);
    expect(rulesWithPortalCsp.map((rule) => rule.source)).toEqual([PORTAL_SOURCE]);
  });

  it('sends noindex and no-store on Railway only with the portal fallback page', () => {
    const portalRules = railway.headers.filter(
      (rule) => rule.source !== '**/*' && setsPortalOnlyHeader(rule),
    );
    expect(portalRules.map((rule) => rule.source)).toEqual(['__spa-fallback.html']);
  });

  it('matchers recognise the paths they should, so the checks above mean something', () => {
    expect(vercelSourceMatches('/portal/:path*', '/portal/admin')).toBe(true);
    expect(serveSourceMatches('/portal/**', '/portal/admin/posts')).toBe(true);
    expect(serveSourceMatches('/portal', ROUTES.posts)).toBe(false);
  });
});
