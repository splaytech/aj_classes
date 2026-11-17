// Signed-up user pages (open sign-up, ADR-0011). Everyone else sees "You don't have access"; the
// database gives a user nothing but their own profile and the posts anyway (AC-26).

import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { guardPortalPage } from '@/lib/portal-guard';

import { AreaOutlet } from './member-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'user');
}

export default function UserLayout() {
  const page = useLoaderData<typeof clientLoader>();
  return <AreaOutlet forbidden={page?.forbidden} />;
}
