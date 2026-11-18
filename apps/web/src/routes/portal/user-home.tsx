// A signed-up user's home (open sign-up AC-21): the same latest news as the public /posts page,
// with the way into mock tests above it (mock tests AC 8).

import Box from '@mui/material/Box';

import { MockTestsLinkCard } from '@/components/portal';
import { PublicPostsList } from '@/components/posts/PublicPostsList';
import { PORTAL_SEO, POSTS_PUBLIC_PAGE } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.user);
}

export default function UserHome() {
  return (
    <>
      <h1>{POSTS_PUBLIC_PAGE.heading}</h1>
      <p>{POSTS_PUBLIC_PAGE.intro}</p>
      <Box sx={{ mb: 4 }}>
        <MockTestsLinkCard area="user" />
      </Box>
      <PublicPostsList />
    </>
  );
}
