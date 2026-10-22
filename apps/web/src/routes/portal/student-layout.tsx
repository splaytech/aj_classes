// Student pages (R3b stories FS1–FS5). Everyone else sees "You don't have access"; the database
// functions refuse them too.

import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { guardPortalPage } from '@/lib/portal-guard';

import { AreaOutlet } from './member-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'student');
}

export default function StudentLayout() {
  const page = useLoaderData<typeof clientLoader>();
  return <AreaOutlet forbidden={page?.forbidden} />;
}
