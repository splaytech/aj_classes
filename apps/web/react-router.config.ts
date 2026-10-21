import type { Config } from '@react-router/dev/config';

import { ROUTES } from './src/constants/routes.constants';

// Static site: no server runtime. Every public page is pre-rendered to HTML at build time
// so crawlers and link previews get real content (PRP F6.1).
export default {
  appDirectory: 'src',
  ssr: false,
  prerender: [
    ROUTES.home,
    ROUTES.privacy,
    ROUTES.vce,
    ROUTES.subscribed,
    ROUTES.notFound,
    ROUTES.sitemap,
    ROUTES.robots,
  ],
} satisfies Config;
