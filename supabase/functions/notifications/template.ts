// Renders the portal emails as HTML and plain text: "work returned" (design 03 §3.4.5), "new
// assignment" and "due tomorrow" (design 03b §8.4). All three share one shell, which copies the
// look of supabase/templates/invite.html (same colours and header block). Pure: no Deno globals,
// so the Node test script can import it.

import { COPY, PATHS } from './copy.ts';
import type { AssignmentWords, EmailKind, RecipientRole } from './copy.ts';
import type { EmailMessage } from './transport.ts';

// One row from notify_claim_emails(supported_kinds).
export type ClaimedRow = {
  id: string;
  kind: EmailKind;
  recipient_role: RecipientRole;
  email: string;
  recipient_first_name: string;
  child_first_name: string;
  assignment_id: string;
  student_id: string;
  assignment_title: string;
  class_name: string;
  due_on: string | null; // 'YYYY-MM-DD'
};

// What one email says, before it's escaped and laid out.
type EmailContent = {
  subject: string;
  label: string;
  greeting: string;
  body: string;
  button: string;
  buttonUrl: string;
  accountUrl: string;
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

export function assignmentUrl(row: ClaimedRow, siteUrl: string): string {
  const path =
    row.recipient_role === 'student'
      ? PATHS.studentAssignment(row.assignment_id)
      : PATHS.parentChildAssignment(row.student_id, row.assignment_id);
  return `${withoutTrailingSlash(siteUrl)}${path}`;
}

export function notificationsUrl(siteUrl: string): string {
  return `${withoutTrailingSlash(siteUrl)}${PATHS.accountNotifications}`;
}

// Control characters (CR, LF, tab and the rest of C0/C1) become a space, so a typed title can't
// break the subject line into extra headers (Security item 3, finding 1).
export function oneLine(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
}

const DUE_DATE_FORMAT = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * "Thursday 30 October" from "2026-10-30", or '' for no date. The date is read as a calendar
 * date at UTC midnight and formatted in UTC, so no time zone can shift it a day. The parts are
 * joined by hand because ICU versions differ on the separator ("Friday, 30 October").
 */
export function formatDueDate(isoDate: string | null): string {
  if (isoDate === null) return '';
  const parts = DUE_DATE_FORMAT.formatToParts(new Date(`${isoDate}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((found) => found.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

function wordsFor(row: ClaimedRow): AssignmentWords {
  return {
    childFirstName: oneLine(row.child_first_name),
    assignmentTitle: oneLine(row.assignment_title),
    className: oneLine(row.class_name),
    dueDate: formatDueDate(row.due_on),
  };
}

function renderText(content: EmailContent): string {
  return [
    content.greeting,
    '',
    content.body,
    '',
    `${content.button}: ${content.buttonUrl}`,
    '',
    COPY.footerReason,
    `${COPY.footerStop} ${content.accountUrl}`,
    '',
  ].join('\n');
}

function renderShell(content: EmailContent): string {
  const safe = {
    label: escapeHtml(content.label),
    greeting: escapeHtml(content.greeting),
    body: escapeHtml(content.body),
    button: escapeHtml(content.button),
    buttonUrl: escapeHtml(content.buttonUrl),
    accountUrl: escapeHtml(content.accountUrl),
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
            <a href="${safe.buttonUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; border-radius: 8px; font-weight: 700; text-decoration: none">${safe.button}</a>
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

function toMessage(row: ClaimedRow, content: EmailContent): EmailMessage {
  return {
    to: row.email,
    subject: content.subject,
    html: renderShell(content),
    text: renderText(content),
  };
}

// The parts every email shares: header label, greeting and the two links.
function commonContent(row: ClaimedRow, siteUrl: string) {
  return {
    label: COPY.brandLabel[row.recipient_role],
    greeting: COPY.greeting(oneLine(row.recipient_first_name)),
    buttonUrl: assignmentUrl(row, siteUrl),
    accountUrl: notificationsUrl(siteUrl),
  };
}

export function renderWorkReturned(row: ClaimedRow, siteUrl: string): EmailMessage {
  const words = wordsFor(row);
  return toMessage(row, {
    ...commonContent(row, siteUrl),
    subject: COPY.subject[row.recipient_role](words),
    body: COPY.body[row.recipient_role](words),
    button: COPY.button,
  });
}

export function renderNewAssignment(row: ClaimedRow, siteUrl: string): EmailMessage {
  const words = wordsFor(row);
  const copy = COPY.newAssignment;
  return toMessage(row, {
    ...commonContent(row, siteUrl),
    subject: copy.subject[row.recipient_role](words),
    body: copy.body[row.recipient_role](words),
    button: copy.button,
  });
}

export function renderDueTomorrow(row: ClaimedRow, siteUrl: string): EmailMessage {
  const words = wordsFor(row);
  const copy = COPY.dueTomorrow;
  return toMessage(row, {
    ...commonContent(row, siteUrl),
    subject: copy.subject[row.recipient_role](words),
    body: copy.body[row.recipient_role](words),
    button: copy.button,
  });
}

const RENDERERS: Record<EmailKind, (row: ClaimedRow, siteUrl: string) => EmailMessage> = {
  work_returned: renderWorkReturned,
  new_assignment: renderNewAssignment,
  due_tomorrow: renderDueTomorrow,
};

/** Picks the template by row.kind. The claim only returns kinds in EMAIL_KINDS. */
export function renderEmail(row: ClaimedRow, siteUrl: string): EmailMessage {
  return RENDERERS[row.kind](row, siteUrl);
}
