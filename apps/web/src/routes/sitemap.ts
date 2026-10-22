// Generates /sitemap.xml at build time from the list of public pages (PRP F6.5.2).

import { GUIDE_PATHS, PROGRAMME_PATHS, ROUTES } from '@/constants';
import { absoluteUrl } from '@/lib/seo';

const PUBLIC_PAGES = [
  ROUTES.home,
  ...PROGRAMME_PATHS,
  ROUTES.resources,
  ...GUIDE_PATHS,
  ROUTES.privacy,
];

function urlEntry(path: string, lastModified: string): string {
  return `  <url><loc>${absoluteUrl(path)}</loc><lastmod>${lastModified}</lastmod></url>`;
}

export function loader() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = PUBLIC_PAGES.map((path) => urlEntry(path, today)).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
