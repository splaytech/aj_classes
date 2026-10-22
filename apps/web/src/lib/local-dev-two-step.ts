// LOCAL DEVELOPMENT ONLY (R2a design §16.1, CR1).
// Works out the local admin's authenticator code so developers aren't asked for it.
// In production builds the key is always '' (see APP_CONFIG.localDev), so this does nothing.

import { APP_CONFIG, AUTH_LIMITS } from '@/constants';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SECONDS = 30; // standard authenticator apps

export function hasLocalTwoStepKey(): boolean {
  return APP_CONFIG.localDev.isDevServer && APP_CONFIG.localDev.adminTwoStepKey !== '';
}

/** The local admin's current code, or null outside local development. */
export async function localTwoStepCode(): Promise<string | null> {
  if (!hasLocalTwoStepKey()) return null;
  return totpCode(APP_CONFIG.localDev.adminTwoStepKey, Date.now());
}

/** The 6-digit code an authenticator app would show for this key at this time (RFC 6238). */
export async function totpCode(base32Key: string, atMilliseconds: number): Promise<string> {
  const counter = Math.floor(atMilliseconds / 1000 / TIME_STEP_SECONDS);
  const message = new ArrayBuffer(8);
  new DataView(message).setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey(
    'raw',
    base32ToBytes(base32Key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));

  const offset = (hash[hash.length - 1] ?? 0) & 0x0f;
  const number = new DataView(hash.buffer).getUint32(offset) & 0x7fffffff;
  return String(number % 10 ** AUTH_LIMITS.codeLength).padStart(AUTH_LIMITS.codeLength, '0');
}

function base32ToBytes(base32: string): Uint8Array<ArrayBuffer> {
  let bits = '';
  for (const character of base32.replace(/=+$/, '').toUpperCase()) {
    bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  return bytes;
}
