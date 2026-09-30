// Business facts. One source of truth, reused by the page content, footer,
// privacy page and the structured data Google reads (JSON-LD).
// Leave a value as `null` until it is confirmed; anything null is hidden on the site.

export const BUSINESS = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  phone: null as string | null, // TBC (PRP Appendix B, O3)

  suburb: 'Truganina',
  postcode: '3029',
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
