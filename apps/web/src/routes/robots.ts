// Generates /robots.txt at build time: allow the public site, keep /portal out, point to the sitemap (PRP F6.5.1).
// Staging and dev block all crawlers instead (environments.md G6).

import { APP_CONFIG, ROBOTS, ROUTES } from '@/constants';
import { absoluteUrl } from '@/lib/seo';

export function loader() {
  const text = APP_CONFIG.isProduction
    ? `${ROBOTS.rules}\nSitemap: ${absoluteUrl(ROUTES.sitemap)}\n`
    : `${ROBOTS.disallowAll}\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
}
