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
  // Zoho Invoice customer portal, where parents see and pay invoices (leads-and-crm.md §4.5).
  // Zoho Invoice → Settings → Customer Portal → the portal URL. null hides the parent's card.
  invoicePortalUrl: 'https://invoice.zohosecure.com.au/portal/ajclasses' as string | null,
  classHours: null as string | null, // TBC, e.g. 'Mon–Fri 4–8pm, Sat 9am–1pm'

  // Where in-person classes run (updated Oct 2026; was Truganina only).
  suburbs: ['Williams Landing', 'Truganina', 'Craigieburn'],
  suburbsText: 'Williams Landing, Truganina and Craigieburn',
  // The Google Business Profile address. Public since 30 Oct 2026 (Saurabh), so the site's
  // structured data can match the profile exactly and Google ties the two together.
  streetAddress: '4 Patchouli St',
  locality: 'Truganina',
  postcode: '3029',
  // The Business Profile on Google Maps, by its place id (CID).
  googleMapsUrl: 'https://maps.google.com/?cid=4403928284462268400',
  state: 'VIC',
  country: 'AU',
  city: 'Melbourne',
  countryName: 'Australia',
} as const;

// One line, as shown on the page and in the Business Profile.
export const BUSINESS_ADDRESS = `${BUSINESS.streetAddress}, ${BUSINESS.locality} ${BUSINESS.state} ${BUSINESS.postcode}`;

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

// A platform with no URL is not shown. Facebook added 22 Oct 2026; Instagram and YouTube 30 Oct.
export const SOCIAL_LINKS: SocialLink[] = [
  { platform: 'instagram', url: 'https://www.instagram.com/aj_classes_au/' },
  { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=61595519166933' },
  { platform: 'youtube', url: 'https://www.youtube.com/@ajclassesau' },
  { platform: 'whatsapp', url: whatsappChatUrl() },
];
