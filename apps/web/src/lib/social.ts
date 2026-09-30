// Social links that are ready to show (a link with no URL yet stays hidden).

import { SOCIAL_LINKS } from '@/constants';
import type { SocialPlatform } from '@/constants';

export type VisibleSocialLink = {
  platform: SocialPlatform;
  url: string;
};

export function getVisibleSocialLinks(): VisibleSocialLink[] {
  const visible: VisibleSocialLink[] = [];
  for (const link of SOCIAL_LINKS) {
    if (link.url) {
      visible.push({ platform: link.platform, url: link.url });
    }
  }
  return visible;
}
