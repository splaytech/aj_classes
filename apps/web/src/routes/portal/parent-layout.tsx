// Parent pages (R3b stories FP1–FP3). Everyone else sees "You don't have access"; the database
// functions refuse them too.

import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { guardPortalPage } from '@/lib/portal-guard';

import { AreaOutlet } from './member-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'parent');
}

export default function ParentLayout() {
  const page = useLoaderData<typeof clientLoader>();
  return <AreaOutlet forbidden={page?.forbidden} />;
}
