// Making typed text safe for an email: HTML escaping for the body, and one line for the subject.
// Shared by notifications and account-admin (invites). Pure, so the Node test scripts import it.

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Control characters (CR, LF, tab and the rest of C0/C1) become a space, so a typed title can't
// break the subject line into extra headers (Security item 3, finding 1).
export function oneLine(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
}
