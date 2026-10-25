import { config } from '../config.js';
import { pollForRow } from '../db/poll.js';

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
  Created: string;
}

export interface MailpitMessageDetail extends MailpitMessage {
  HTML: string;
  Text: string;
}

interface MailpitListResponse {
  messages: MailpitMessage[];
}

export interface FindMessageFilter {
  to: string;
  subjectContains?: string;
  since?: Date;
}

async function listMessages(): Promise<MailpitMessage[]> {
  const response = await fetch(`${config.mailpit.baseUrl}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Mailpit list messages failed: HTTP ${response.status}`);
  }
  const body = (await response.json()) as MailpitListResponse;
  return body.messages;
}

/**
 * Polls Mailpit until a message matching `filter` appears (invite delivery
 * is async). Returns the full message detail (HTML/Text included).
 */
export async function findMessage(filter: FindMessageFilter): Promise<MailpitMessageDetail> {
  const match = await pollForRow(
    listMessages,
    (messages) => messages.some((message) => matchesFilter(message, filter)),
    { description: `mailpit message to=${filter.to}` },
  );

  const found = match.find((message) => matchesFilter(message, filter));
  if (!found) {
    throw new Error(`Mailpit: no message matching filter ${JSON.stringify(filter)}`);
  }

  const response = await fetch(`${config.mailpit.baseUrl}/api/v1/message/${found.ID}`);
  if (!response.ok) {
    throw new Error(`Mailpit fetch message ${found.ID} failed: HTTP ${response.status}`);
  }
  return (await response.json()) as MailpitMessageDetail;
}

function matchesFilter(message: MailpitMessage, filter: FindMessageFilter): boolean {
  const toMatches = message.To.some((recipient) => recipient.Address === filter.to);
  if (!toMatches) return false;
  if (filter.subjectContains && !message.Subject.includes(filter.subjectContains)) return false;
  if (filter.since && new Date(message.Created) < filter.since) return false;
  return true;
}

export function extractLink(message: MailpitMessageDetail, pattern: RegExp): string {
  // Prefer the plain-text body: the HTML body's href attributes are entity-encoded
  // (`&amp;`), which a literal `&` in a link-matching pattern won't match.
  const source = message.Text || message.HTML;
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Mailpit: pattern ${pattern} not found in message ${message.ID}`);
  }
  return match[0];
}

/**
 * Best-effort delete — some local Mailpit versions don't support this
 * endpoint. Swallow failures rather than fail the test.
 */
export async function deleteMessage(id: string): Promise<void> {
  try {
    const response = await fetch(`${config.mailpit.baseUrl}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [id] }),
    });
    if (!response.ok) {
      console.warn(
        `Mailpit deleteMessage(${id}) returned HTTP ${response.status}; leaving message in place.`,
      );
    }
  } catch (error) {
    console.warn(`Mailpit deleteMessage(${id}) failed; leaving message in place.`, error);
  }
}
