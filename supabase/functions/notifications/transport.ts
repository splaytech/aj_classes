// How the worker sends one email (design 03 §3.4.3): Resend's HTTP API when hosted, the local
// Mailpit's send API locally. Plain fetch, no SDK. No default: unless EMAIL_TRANSPORT is exactly
// 'resend' or 'mailpit' (with its setting), nothing is sent (§0.3), so a missing secret on the
// hosted project can never fall back to something that emails real families from a test.
// Pure apart from fetch, with no Deno globals, so the Node test script can import it.

import { COPY, SENDER } from './copy.ts';

export type EmailMessage = { to: string; subject: string; html: string; text: string };
export type ReasonCode = 'rejected' | 'rate_limited' | 'server_error' | 'network';
export type SendOutcome = { outcome: 'sent' } | { outcome: 'retry' | 'failed'; reason: ReasonCode };
export type Transport = { kind: 'resend'; apiKey: string } | { kind: 'mailpit'; baseUrl: string };
export type SendRequest = { url: string; init: RequestInit };

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/** null unless EMAIL_TRANSPORT is exactly 'resend' (with RESEND_API_KEY) or 'mailpit' (with MAILPIT_URL). */
export function pickTransport(env: (name: string) => string | undefined): Transport | null {
  const kind = env('EMAIL_TRANSPORT');
  if (kind === 'resend') {
    const apiKey = env('RESEND_API_KEY') ?? '';
    return apiKey === '' ? null : { kind: 'resend', apiKey };
  }
  if (kind === 'mailpit') {
    const baseUrl = env('MAILPIT_URL') ?? '';
    return baseUrl === '' ? null : { kind: 'mailpit', baseUrl };
  }
  return null;
}

/** POST https://api.resend.com/emails. The outbox id as Idempotency-Key means a row re-sent after
 * a worker crash is delivered once (Resend keeps keys for 24 hours). */
export function resendRequest(
  message: EmailMessage,
  outboxId: string,
  apiKey: string,
): SendRequest {
  return {
    url: RESEND_URL,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': outboxId,
      },
      body: JSON.stringify({
        from: COPY.from,
        to: [message.to],
        reply_to: SENDER.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    },
  };
}

/** POST {MAILPIT_URL}/api/v1/send. Mailpit never relays; the Idempotency-Key header is echoed into
 * the stored message so the end-to-end test can check the worker passes the outbox id through. */
export function mailpitRequest(
  message: EmailMessage,
  outboxId: string,
  baseUrl: string,
): SendRequest {
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/api/v1/send`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: SENDER.email, Name: SENDER.name },
        To: [{ Email: message.to }],
        ReplyTo: [{ Email: SENDER.replyTo }],
        Subject: message.subject,
        HTML: message.html,
        Text: message.text,
        Headers: { 'Idempotency-Key': outboxId },
      }),
    },
  };
}

/** 2xx → sent; 429 → retry rate_limited; 409 (idempotent request in flight) or 5xx → retry
 * server_error; any other 4xx → failed rejected. */
export function outcomeForStatus(status: number): SendOutcome {
  if (status >= 200 && status < 300) return { outcome: 'sent' };
  if (status === 429) return { outcome: 'retry', reason: 'rate_limited' };
  if (status === 409 || status >= 500) return { outcome: 'retry', reason: 'server_error' };
  return { outcome: 'failed', reason: 'rejected' };
}

/** True only for a rate_limited outcome: the worker then stops the batch (design 03 §3.4.2). */
export function shouldStopBatch(outcome: SendOutcome): boolean {
  return outcome.outcome === 'retry' && outcome.reason === 'rate_limited';
}

function requestFor(transport: Transport, message: EmailMessage, outboxId: string): SendRequest {
  return transport.kind === 'resend'
    ? resendRequest(message, outboxId, transport.apiKey)
    : mailpitRequest(message, outboxId, transport.baseUrl);
}

/** fetch with a 10 s timeout; a thrown fetch (network, timeout) → retry network. Logs the HTTP
 * status only: the provider's error text can echo the address. */
export async function sendEmail(
  transport: Transport,
  message: EmailMessage,
  outboxId: string,
): Promise<SendOutcome> {
  const { url, init } = requestFor(transport, message, outboxId);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
  } catch {
    return { outcome: 'retry', reason: 'network' };
  }
  await response.body?.cancel();
  if (!response.ok) console.warn('notifications send refused', response.status);
  return outcomeForStatus(response.status);
}
