// Input checks shared by staff-admin actions. Same rules as the web app (lib/validation.ts).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MIN = 2;
const NAME_MAX = 100;

export function cleanEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.length <= 254;
}

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidName(name: string): boolean {
  return name.length >= NAME_MIN && name.length <= NAME_MAX;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
