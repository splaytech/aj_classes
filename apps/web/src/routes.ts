// Every URL on the site and the file that renders it.

import { index, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

import { ROUTES } from './constants/routes.constants';

export default [
  index('routes/home.tsx'),
  route(ROUTES.privacy, 'routes/privacy.tsx'),
  route(ROUTES.sitemap, 'routes/sitemap.ts'),
  route(ROUTES.robots, 'routes/robots.ts'),
  route('*', 'routes/not-found.tsx'), // anything else → 404 page
] satisfies RouteConfig;
