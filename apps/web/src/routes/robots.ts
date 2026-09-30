// Generates /robots.txt at build time: allow everything and point to the sitemap (PRP F6.5.1).

import { ROBOTS, ROUTES } from '@/constants';
import { absoluteUrl } from '@/lib/seo';

export function loader() {
  const text = `${ROBOTS.allowAll}\nSitemap: ${absoluteUrl(ROUTES.sitemap)}\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
}
