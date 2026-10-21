// Business facts. One source of truth, reused by the page content, footer,
// privacy page and the structured data Google reads (JSON-LD).
// Leave a value as `null` until it is confirmed; anything null is hidden on the site.

export const BUSINESS = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  phone: '+61 469 800 685' as string | null, // shown on the site (PRP Appendix B, O3)
  phoneDial: '+61469800685', // the same number for tel: links
  classHours: null as string | null, // TBC, e.g. 'Mon–Fri 4–8pm, Sat 9am–1pm'

  // Where in-person classes run (updated Oct 2026; was Truganina only).
  suburbs: ['Williams Landing', 'Truganina', 'Craigieburn'],
  suburbsText: 'Williams Landing, Truganina and Craigieburn',
  state: 'VIC',
  country: 'AU',
  city: 'Melbourne',
  countryName: 'Australia',
} as const;

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'whatsapp';

export type SocialLink = {
  platform: SocialPlatform;
  url: string | null;
};

// Links are TBC (PRP Appendix B, O4). A platform with no URL is not shown.
export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'instagram', url: null },
  { platform: 'facebook', url: null },
  { platform: 'youtube', url: null },
  { platform: 'whatsapp', url: null },
];
