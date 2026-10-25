// Renders the "work returned" email as HTML and plain text (design 03 §3.4.5). The HTML copies the
// look of supabase/templates/invite.html (same colours and header block). Pure: no Deno globals,
// so the Node test script can import it.

import { COPY, PATHS } from './copy.ts';
import type { RecipientRole, WorkReturnedWords } from './copy.ts';
import type { EmailMessage } from './transport.ts';

// One row from notify_claim_emails().
export type ClaimedRow = {
  id: string;
  recipient_role: RecipientRole;
  email: string;
  recipient_first_name: string;
  child_first_name: string;
  assignment_id: string;
  student_id: string;
  assignment_title: string;
  class_name: string;
};

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function withoutTrailingSlash(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

export function viewFeedbackUrl(row: ClaimedRow, siteUrl: string): string {
  const path =
    row.recipient_role === 'student'
      ? PATHS.studentAssignment(row.assignment_id)
      : PATHS.parentChildAssignment(row.student_id, row.assignment_id);
  return `${withoutTrailingSlash(siteUrl)}${path}`;
}

export function notificationsUrl(siteUrl: string): string {
  return `${withoutTrailingSlash(siteUrl)}${PATHS.accountNotifications}`;
}

function wordsFor(row: ClaimedRow): WorkReturnedWords {
  return {
    childFirstName: row.child_first_name,
    assignmentTitle: row.assignment_title,
    className: row.class_name,
  };
}

function renderText(row: ClaimedRow, feedbackUrl: string, accountUrl: string): string {
  const words = wordsFor(row);
  return [
    COPY.greeting(row.recipient_first_name),
    '',
    COPY.body[row.recipient_role](words),
    '',
    `${COPY.button}: ${feedbackUrl}`,
    '',
    COPY.footerReason,
    `${COPY.footerStop} ${accountUrl}`,
    '',
  ].join('\n');
}

function renderHtml(row: ClaimedRow, feedbackUrl: string, accountUrl: string): string {
  const words = wordsFor(row);
  const safe = {
    label: escapeHtml(COPY.brandLabel[row.recipient_role]),
    greeting: escapeHtml(COPY.greeting(row.recipient_first_name)),
    body: escapeHtml(COPY.body[row.recipient_role](words)),
    button: escapeHtml(COPY.button),
    feedbackUrl: escapeHtml(feedbackUrl),
    accountUrl: escapeHtml(accountUrl),
    footerReason: escapeHtml(COPY.footerReason),
    footerStop: escapeHtml(COPY.footerStop),
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
          <p style="margin: 0 0 16px">${safe.greeting}</p>
          <p style="margin: 0">${safe.body}</p>
          <p style="margin: 24px 0">
            <a href="${safe.feedbackUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; border-radius: 8px; font-weight: 700; text-decoration: none">${safe.button}</a>
          </p>
          <p style="margin: 24px 0 0; color: #4b5563; font-size: 14px">
            ${safe.footerReason} ${safe.footerStop} <a href="${safe.accountUrl}" style="color: #2563eb; word-break: break-all">${safe.accountUrl}</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function renderWorkReturned(row: ClaimedRow, siteUrl: string): EmailMessage {
  const feedbackUrl = viewFeedbackUrl(row, siteUrl);
  const accountUrl = notificationsUrl(siteUrl);
  return {
    to: row.email,
    subject: COPY.subject[row.recipient_role](wordsFor(row)),
    html: renderHtml(row, feedbackUrl, accountUrl),
    text: renderText(row, feedbackUrl, accountUrl),
  };
}
