import { isAbsolute } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOSTED_SUPABASE_ORIGIN, LOCAL_SUPABASE_ORIGIN } from './hosting-constants.ts';
import { MirrorConfigError, buildMirrorConfig } from './mirror-config.ts';
import type { ServeConfig } from './mirror-config.ts';

const OPTIONS = { localOrigin: LOCAL_SUPABASE_ORIGIN, publicDir: 'build/client' };

function railwayConfig(): ServeConfig {
  return {
    public: 'build/client',
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      {
        source: '**/*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: `connect-src 'self' ${HOSTED_SUPABASE_ORIGIN}` },
        ],
      },
      {
        source: '__spa-fallback.html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `img-src ${HOSTED_SUPABASE_ORIGIN}; connect-src ${HOSTED_SUPABASE_ORIGIN}`,
          },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ],
    rewrites: [{ source: '/portal/**', destination: '/__spa-fallback.html' }],
  };
}

function headerKeys(config: ServeConfig, source: string): string[] {
  return (config.headers.find((rule) => rule.source === source)?.headers ?? []).map((h) => h.key);
}

describe('buildMirrorConfig', () => {
  it('drops X-Robots-Tag from the global rule and keeps it on the portal fallback', () => {
    const config = buildMirrorConfig(railwayConfig(), OPTIONS);

    expect(headerKeys(config, '**/*')).toEqual(['X-Frame-Options', 'Content-Security-Policy']);
    expect(headerKeys(config, '__spa-fallback.html')).toContain('X-Robots-Tag');
  });

  it('replaces every hosted origin, in the public and the portal CSP', () => {
    const config = buildMirrorConfig(railwayConfig(), OPTIONS);
    const text = JSON.stringify(config.headers);

    expect(text).not.toContain(HOSTED_SUPABASE_ORIGIN);
    expect(text.split(LOCAL_SUPABASE_ORIGIN)).toHaveLength(4);
  });

  it('inserts the local origin literally, even if it holds a $ pattern', () => {
    const config = buildMirrorConfig(railwayConfig(), { ...OPTIONS, localOrigin: 'http://a$&b' });

    expect(JSON.stringify(config.headers)).toContain('http://a$&b');
    expect(JSON.stringify(config.headers)).not.toContain(HOSTED_SUPABASE_ORIGIN);
  });

  it('makes the public folder absolute and keeps the rewrites', () => {
    const config = buildMirrorConfig(railwayConfig(), OPTIONS);

    expect(isAbsolute(config.public)).toBe(true);
    expect(config.public.endsWith('build/client')).toBe(true);
    expect(config.rewrites).toEqual(railwayConfig().rewrites);
  });

  it('refuses a config that never names the hosted origin', () => {
    const railway = railwayConfig();
    railway.headers = railway.headers.map((rule) => ({
      source: rule.source,
      headers: rule.headers.filter((header) => header.key !== 'Content-Security-Policy'),
    }));

    expect(() => buildMirrorConfig(railway, OPTIONS)).toThrow(MirrorConfigError);
  });

  it('leaves the input unchanged', () => {
    const railway = railwayConfig();
    buildMirrorConfig(railway, OPTIONS);

    expect(railway).toEqual(railwayConfig());
  });
});
