// The invite link's token (ADR-0010 decision 2): 32 random bytes as base64url with no padding, so
// 43 characters and 256 bits. Only its SHA-256 is stored (private.invite_tokens). Pure, so the
// Node test scripts import it.

import { sha256Hex } from './sha256.ts';

const TOKEN_BYTES = 32;

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function newInviteToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && INVITE_TOKEN_PATTERN.test(value);
}

export function hashInviteToken(token: string): Promise<string> {
  return sha256Hex(token);
}
