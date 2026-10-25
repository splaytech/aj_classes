// Turns serve.railway.json into a local serve config that behaves like Vercel, with the local
// Supabase origin in place of the hosted one (ADR-0005 decision 4, 02b §5.4). Pure: no file or
// network access, so it's unit-tested directly.

import { resolve } from 'node:path';

import { HOSTED_SUPABASE_ORIGIN } from './hosting-constants.ts';

export type HeaderRule = { source: string; headers: { key: string; value: string }[] };

export type ServeConfig = {
  public: string;
  cleanUrls: boolean;
  trailingSlash: boolean;
  headers: HeaderRule[];
  rewrites: { source: string; destination: string }[];
};

export class MirrorConfigError extends Error {}

const GLOBAL_SOURCE = '**/*';

// Railway was a staging host, so it sends noindex everywhere. Vercel doesn't, and Lighthouse SEO
// fails on it, so the mirror drops it from the global rule only. The portal keeps its noindex.
const RAILWAY_ONLY_GLOBAL_HEADER = 'X-Robots-Tag';

function mirrorRule(rule: HeaderRule, localOrigin: string): HeaderRule {
  const headers = rule.headers
    .filter((header) => rule.source !== GLOBAL_SOURCE || header.key !== RAILWAY_ONLY_GLOBAL_HEADER)
    .map((header) => ({
      key: header.key,
      // A function, so a `$` in the origin is never read as a replacement pattern (S7).
      value: header.value.replaceAll(HOSTED_SUPABASE_ORIGIN, () => localOrigin),
    }));
  return { source: rule.source, headers };
}

function namesHostedOrigin(rules: HeaderRule[]): boolean {
  return rules.some((rule) =>
    rule.headers.some((header) => header.value.includes(HOSTED_SUPABASE_ORIGIN)),
  );
}

/**
 * serve.railway.json → a serve config for the local mirror:
 *   1. drops X-Robots-Tag from the `**\/*` rule only;
 *   2. replaces every hosted Supabase origin in a header value with `localOrigin`;
 *   3. sets `public` to `publicDir`, made absolute, so serve needs no folder argument.
 * Throws MirrorConfigError if no header named the hosted origin, so a mirror can never silently
 * enforce something other than the committed file. The input isn't changed.
 */
export function buildMirrorConfig(
  railway: ServeConfig,
  options: { localOrigin: string; publicDir: string },
): ServeConfig {
  if (!namesHostedOrigin(railway.headers)) {
    throw new MirrorConfigError(
      `serve.railway.json has no header naming ${HOSTED_SUPABASE_ORIGIN}; the mirror would not match the committed policy`,
    );
  }
  return {
    public: resolve(options.publicDir),
    cleanUrls: railway.cleanUrls,
    trailingSlash: railway.trailingSlash,
    headers: railway.headers.map((rule) => mirrorRule(rule, options.localOrigin)),
    rewrites: railway.rewrites.map((rewrite) => ({ ...rewrite })),
  };
}
