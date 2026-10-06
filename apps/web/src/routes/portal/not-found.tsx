// Any /portal/... address that doesn't exist.

import { PortalNotFound } from '@/components/portal';
import { PORTAL_SEO } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.notFound);
}

export default function PortalNotFoundPage() {
  return <PortalNotFound />;
}
