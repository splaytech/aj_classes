import type { Config } from '@react-router/dev/config';

import { PROGRAMME_PATHS } from './src/constants/programmes.constants';
import { GUIDE_PATHS } from './src/constants/resources.constants';
import { ROUTES } from './src/constants/routes.constants';

// Static site: no server runtime. Every public page is pre-rendered to HTML at build time
// so crawlers and link previews get real content (PRP F6.1).
export default {
  appDirectory: 'src',
  ssr: false,
  prerender: [
    ROUTES.home,
    ROUTES.privacy,
    ...PROGRAMME_PATHS, // includes VCE
    ROUTES.resources,
    ROUTES.posts, // shell only; posts load live in the browser (ADR-0001)
    ...GUIDE_PATHS,
    ROUTES.subscribed,
    ROUTES.notFound,
    ROUTES.sitemap,
    ROUTES.robots,
  ],
} satisfies Config;
