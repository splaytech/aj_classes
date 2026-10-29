// Renders the invite email (ADR-0010) as HTML and plain text. The markup is
// supabase/templates/invite.html with each style on one line, as notifications/template.ts does.
// The email holds no user-typed text, only fixed words and the link. Pure, so the Node test
// script can import it.

import { escapeHtml } from '../_shared/email/html.ts';
import type { EmailMessage } from '../_shared/email/transport.ts';

import { INVITE_COPY, INVITE_PATH, INVITE_TOKEN_PARAM } from './invite-copy.ts';
import type { InviteAudience } from './invite-copy.ts';

/** Students and parents get their own wording; every staff role (tutor, admin) gets the staff one,
 * the same rule as the template's `{{ with .Data.account_role }}`. */
export function inviteAudience(role: string): InviteAudience {
  if (role === 'student') return 'student';
  if (role === 'parent') return 'parent';
  return 'staff';
}

/** `…/portal/invite#token=…`. The token is base64url, so it needs no encoding. */
export function inviteLink(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${INVITE_PATH}#${INVITE_TOKEN_PARAM}=${token}`;
}

function introFor(audience: InviteAudience): string {
  return `${INVITE_COPY.intro[audience]} ${INVITE_COPY.nextStep}`;
}

function renderHtml(audience: InviteAudience, link: string): string {
  const safe = {
    label: escapeHtml(INVITE_COPY.brandLabel[audience]),
    heading: escapeHtml(INVITE_COPY.heading),
    intro: escapeHtml(introFor(audience)),
    link: escapeHtml(link),
    button: escapeHtml(INVITE_COPY.button),
    expiry: escapeHtml(INVITE_COPY.expiry),
    ignore: escapeHtml(INVITE_COPY.ignore),
  };
  return `<!doctype html>
<html lang="en">
  <body style="margin: 0; padding: 24px; background: #f5f9ff; font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #172033">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px">
      <tr>
        <td style="padding: 24px 32px; background: #172554; border-radius: 16px 16px 0 0; color: #ffffff; font-size: 20px">
          <strong>AJ</strong> Classes <span style="color: #f9c62b; font-size: 14px">&nbsp;${safe.label}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 32px; font-size: 16px; line-height: 1.6">
          <h1 style="margin: 0 0 16px; font-size: 22px; color: #172554">${safe.heading}</h1>
          <p style="margin: 0">${safe.intro}</p>
          <p style="margin: 24px 0">
            <a href="${safe.link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; border-radius: 8px; font-weight: 700; text-decoration: none">${safe.button}</a>
          </p>
          <p style="margin: 0; color: #4b5563; font-size: 14px">${safe.expiry}</p>
          <p style="margin: 24px 0 0; color: #4b5563; font-size: 14px">${safe.ignore}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** The plain-text part holds the full link, so mail clients without HTML (and the e2e Mailpit
 * helper) can use it (AC 30). */
function renderText(audience: InviteAudience, link: string): string {
  return [
    INVITE_COPY.heading,
    '',
    introFor(audience),
    '',
    `${INVITE_COPY.button}: ${link}`,
    '',
    INVITE_COPY.expiry,
    '',
    INVITE_COPY.ignore,
    '',
  ].join('\n');
}

export function renderInviteEmail(input: { to: string; role: string; link: string }): EmailMessage {
  const audience = inviteAudience(input.role);
  return {
    to: input.to,
    subject: INVITE_COPY.subject,
    html: renderHtml(audience, input.link),
    text: renderText(audience, input.link),
  };
}
