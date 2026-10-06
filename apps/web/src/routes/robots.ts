// Generates /robots.txt at build time: allow the public site, keep /portal out, point to the sitemap (PRP F6.5.1).

import { ROBOTS, ROUTES } from '@/constants';
import { absoluteUrl } from '@/lib/seo';

export function loader() {
  const text = `${ROBOTS.rules}\nSitemap: ${absoluteUrl(ROUTES.sitemap)}\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
}
