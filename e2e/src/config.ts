import { isAbsolute, resolve } from 'node:path';
import dotenv from 'dotenv';

const E2E_DIR = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(E2E_DIR, '..');

// Load e2e/.env whatever the working directory. Values already in the environment (CI job env)
// win over the file.
dotenv.config({ path: resolve(E2E_DIR, '.env'), quiet: true });

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export interface E2EConfig {
  web: { baseUrl: string };
  pg: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectionString: string;
  };
  supabase: {
    restUrl: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  mailpit: { baseUrl: string };
  auth: {
    adminEmail: string;
    adminPassword: string;
    totpSeed: string;
    expectedLandingPath: string;
  };
  budgets: {
    pollTimeoutMs: number;
    pollIntervalMs: number;
    setupTimeoutMs: number;
  };
  stack: {
    ajClassesDir: string;
  };
}

/**
 * Refuses any host but this machine's loopback, so a mistyped or copied setting can never point
 * the suite at the hosted Supabase project (AC-6.14).
 */
export function assertLocalUrl(name: string, url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Config error: ${name}="${url}" is not a valid URL`);
  }
  assertLocalHost(name, host);
}

function assertLocalHost(name: string, host: string): void {
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Config error: ${name} must be localhost or 127.0.0.1, not "${host}"`);
  }
}

function resolveStackDir(): string {
  const raw = process.env.AJ_CLASSES_DIR?.trim();
  if (!raw) return REPO_ROOT;
  return isAbsolute(raw) ? raw : resolve(E2E_DIR, raw);
}

// Pre-validated by loadConfig()'s upfront missing-key check below.
function required(key: string): string {
  return process.env[key] as string;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Config error: ${key}="${raw}" is not a valid integer`);
  }
  return parsed;
}

function loadConfig(): E2EConfig {
  const requiredKeys = [
    'WEB_BASE_URL',
    'PG_HOST',
    'PG_PORT',
    'PG_DATABASE',
    'PG_USER',
    'PG_PASSWORD',
    'SUPABASE_REST_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MAILPIT_URL',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'ADMIN_TOTP_SEED',
  ];

  const missing: string[] = [];
  for (const key of requiredKeys) {
    const value = process.env[key];
    if (value === undefined || value.trim() === '') missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'Run `node e2e/scripts/local-env.mjs > e2e/.env` with the local stack up (docs/testing/ci-gates.md).',
    );
  }

  const pgPortRaw = required('PG_PORT');
  const pgPort = Number.parseInt(pgPortRaw, 10);
  if (Number.isNaN(pgPort)) {
    throw new Error(`Config error: PG_PORT="${pgPortRaw}" is not a valid integer`);
  }

  const pgHost = required('PG_HOST');
  assertLocalHost('PG_HOST', pgHost);
  assertLocalUrl('WEB_BASE_URL', required('WEB_BASE_URL'));
  assertLocalUrl('SUPABASE_REST_URL', required('SUPABASE_REST_URL'));
  assertLocalUrl('MAILPIT_URL', required('MAILPIT_URL'));
  const pgDatabase = required('PG_DATABASE');
  const pgUser = required('PG_USER');
  const pgPassword = required('PG_PASSWORD');

  return {
    web: { baseUrl: required('WEB_BASE_URL').replace(/\/$/, '') },
    pg: {
      host: pgHost,
      port: pgPort,
      database: pgDatabase,
      user: pgUser,
      password: pgPassword,
      connectionString: `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`,
    },
    supabase: {
      restUrl: required('SUPABASE_REST_URL').replace(/\/$/, ''),
      anonKey: required('SUPABASE_ANON_KEY'),
      serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
    mailpit: { baseUrl: required('MAILPIT_URL').replace(/\/$/, '') },
    auth: {
      adminEmail: required('ADMIN_EMAIL'),
      adminPassword: required('ADMIN_PASSWORD'),
      totpSeed: required('ADMIN_TOTP_SEED'),
      expectedLandingPath: process.env.ADMIN_LANDING_PATH?.trim() || '/portal/admin',
    },
    budgets: {
      pollTimeoutMs: optionalInt('POLL_TIMEOUT_MS', 8000),
      pollIntervalMs: optionalInt('POLL_INTERVAL_MS', 400),
      setupTimeoutMs: optionalInt('SETUP_TIMEOUT_MS', 60000),
    },
    stack: {
      ajClassesDir: resolveStackDir(),
    },
  };
}

export const config: E2EConfig = loadConfig();
