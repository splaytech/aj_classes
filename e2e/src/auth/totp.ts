import { createHmac } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SECONDS = 30;
const CODE_DIGITS = 6;

function decodeBase32(seed: string): Buffer {
  const cleaned = seed.trim().toUpperCase().replace(/=+$/, '');
  if (cleaned.length === 0 || /[^A-Z2-7]/.test(cleaned)) {
    throw new Error(`Invalid base32 TOTP seed: "${seed}"`);
  }

  let bits = '';
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 TOTP: SHA-1, 30s step, 6 digits. Pure function, no I/O.
 */
export function totp(seed: string, atMs: number = Date.now()): string {
  const key = decodeBase32(seed);
  const counter = Math.floor(atMs / 1000 / TIME_STEP_SECONDS);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binCode % 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, '0');
  return code;
}
