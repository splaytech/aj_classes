// Business facts. One source of truth, reused by the page content, footer,
// privacy page and the structured data Google reads (JSON-LD).
// Leave a value as `null` until it is confirmed; anything null is hidden on the site.

export const BUSINESS = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  phone: '+61 469 800 685' as string | null, // shown on the site (PRP Appendix B, O3)
  phoneDial: '+61469800685', // the same number for tel: links
  // WhatsApp Business chat (Release 2, whatsapp-button.md): digits only, international format.
  // Owner to confirm this is the WhatsApp Business number. null hides the button.
  whatsappNumber: '61469800685' as string | null,
  classHours: null as string | null, // TBC, e.g. 'Mon–Fri 4–8pm, Sat 9am–1pm'

  // Where in-person classes run (updated Oct 2026; was Truganina only).
  suburbs: ['Williams Landing', 'Truganina', 'Craigieburn'],
  suburbsText: 'Williams Landing, Truganina and Craigieburn',
  state: 'VIC',
  country: 'AU',
  city: 'Melbourne',
  countryName: 'Australia',
} as const;

// Typed into the chat for the parent, so they only need to press send.
export const WHATSAPP_GREETING = "Hi AJ Classes, I'd like to know more about your classes.";

/** A wa.me link that opens a chat with a short greeting already typed, or null without a number. */
export function whatsappChatUrl(): string | null {
  if (!BUSINESS.whatsappNumber) return null;
  return `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(WHATSAPP_GREETING)}`;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'whatsapp';

export type SocialLink = {
  platform: SocialPlatform;
  url: string | null;
};

// Links are TBC (PRP Appendix B, O4). A platform with no URL is not shown.
// Facebook added 22 Oct 2026.
export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'instagram', url: null },
  { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=61595519166933' },
  { platform: 'youtube', url: null },
  { platform: 'whatsapp', url: whatsappChatUrl() },
];
