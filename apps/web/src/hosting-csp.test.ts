// Guards ADR-0005: public pages send one enforcing CSP that is the same on Vercel and Railway,
// names the hosted Supabase origin and nothing local, and never overlaps the portal's CSP.
// The local mirror is built from serve.railway.json, so these checks also make the mirror
// enforce exactly what vercel.json does (02b §5.4).

import { describe, expect, it } from 'vitest';

import { APP_CONFIG } from '@/constants';

import { HOSTED_SUPABASE_ORIGIN, PUBLIC_CSP_SOURCE } from '../scripts/hosting-constants.ts';
import railway from '../serve.railway.json';
import vercel from '../vercel.json';

const CSP = 'Content-Security-Policy';

// The portal CSP: as it was before item 5 (vercel.json at fb738ea, AC-5.5) plus `blob:` in
// img-src (FU-K1), so the photo editor can preview a chosen photo from URL.createObjectURL.
const PORTAL_CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: ${HOSTED_SUPABASE_ORIGIN}; connect-src 'self' ${HOSTED_SUPABASE_ORIGIN}; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`;

// The whole public policy, pinned so any change to it is deliberate (ADR-0005 decision 1).
const PUBLIC_CSP = `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${HOSTED_SUPABASE_ORIGIN} https://api.web3forms.com https://app.convertkit.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;

// The global Vercel headers as they were before item 5. AC-5.6: unchanged.
const GLOBAL_HEADERS_BEFORE_ITEM_5 = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

type Rule = { source: string; headers: { key: string; value: string }[] };

function ruleFor(rules: Rule[], source: string): Rule {
  const rule = rules.find((candidate) => candidate.source === source);
  if (!rule) throw new Error(`no header rule with source ${source}`);
  return rule;
}

function cspOf(rule: Rule): string {
  const header = rule.headers.find((candidate) => candidate.key === CSP);
  if (!header) throw new Error(`rule ${rule.source} sends no ${CSP}`);
  return header.value;
}

/** "a b c; d e" → { a: ['b', 'c'], d: ['e'] } */
function directives(policy: string): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) parsed[name] = sources;
  }
  return parsed;
}

const publicVercel = cspOf(ruleFor(vercel.headers, PUBLIC_CSP_SOURCE));
const publicRailway = cspOf(ruleFor(railway.headers, '**/*'));
const portalVercel = cspOf(ruleFor(vercel.headers, '/portal/:path*'));
const fallbackVercel = cspOf(ruleFor(vercel.headers, '/__spa-fallback'));
const portalRailway = cspOf(ruleFor(railway.headers, '__spa-fallback.html'));

describe('public CSP (ADR-0005)', () => {
  it('is identical on Vercel and Railway, and so is the portal CSP (AC-5.7)', () => {
    expect(publicRailway).toBe(publicVercel);
    expect(portalRailway).toBe(portalVercel);
    expect(fallbackVercel).toBe(portalVercel);
  });

  it('is exactly the agreed policy (AC-5.2)', () => {
    expect(publicVercel).toBe(PUBLIC_CSP);
  });

  it('lets the site reach the Web3Forms and Kit addresses it actually uses', () => {
    const connectSources = directives(publicVercel)['connect-src'] ?? [];
    const usedOrigins = [APP_CONFIG.form.endpoint, APP_CONFIG.newsletter.kitFormUrl].map(
      (url) => new URL(url).origin,
    );

    for (const origin of usedOrigins) {
      expect(connectSources).toContain(origin);
    }
  });

  it('names the hosted Supabase origin and nothing local or wildcard (AC-5.1, AC-5.2)', () => {
    expect(publicVercel).toContain(HOSTED_SUPABASE_ORIGIN);
    for (const policy of [publicVercel, portalVercel]) {
      expect(policy).not.toMatch(/127\.0\.0\.1|localhost/);
      for (const sources of Object.values(directives(policy))) {
        for (const source of sources) {
          expect(source).not.toContain('*');
          expect(['https:', 'http:']).not.toContain(source);
        }
      }
    }
  });

  it('has every required directive (AC-5.2)', () => {
    const policy = directives(publicVercel);

    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'self'"]);
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['form-action']).toEqual(["'self'"]);
    expect(policy['connect-src']).toEqual([
      "'self'",
      HOSTED_SUPABASE_ORIGIN,
      'https://api.web3forms.com',
      'https://app.convertkit.com',
    ]);
  });

  it('sends the agreed portal CSP, and the same one on the fallback (AC-5.5, FU-K1)', () => {
    expect(portalVercel).toBe(PORTAL_CSP);
    expect(fallbackVercel).toBe(PORTAL_CSP);
  });

  it('allows blob: images on the portal only, for the photo preview (FU-K1)', () => {
    expect(directives(portalVercel)['img-src']).toContain('blob:');
    expect(directives(publicVercel)['img-src']).not.toContain('blob:');
  });

  it('puts the public CSP before the portal fallback on Railway, so the portal one wins', () => {
    const sources = railway.headers.map((rule) => rule.source);

    expect(sources.indexOf('**/*')).toBeLessThan(sources.indexOf('__spa-fallback.html'));
  });

  it('applies the public rule on Vercel to every path except the portal and its fallback', () => {
    const matches = (path: string) => new RegExp(`^${PUBLIC_CSP_SOURCE}$`).test(path);

    for (const path of [
      '/',
      '/privacy',
      '/careers',
      '/posts',
      '/programmes/vce',
      '/nope',
      '/portalx',
      '/__spa-fallbackx',
    ]) {
      expect(matches(path), path).toBe(true);
    }
    for (const path of ['/portal', '/portal/', '/portal/login', '/__spa-fallback']) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('leaves the global Vercel headers as they were (AC-5.6)', () => {
    expect(ruleFor(vercel.headers, '/(.*)').headers).toEqual(GLOBAL_HEADERS_BEFORE_ITEM_5);
  });
});
