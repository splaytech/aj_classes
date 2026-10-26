// The loopback checks that keep every E2E setting on this machine (AC-6.14). Pure, with no
// imports, so config.ts, global setup and the unit test all share it, and the unit test runs
// under plain `node --test` without the stack env.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Refuses any host but this machine's loopback. */
export function assertLocalHost(name: string, host: string): void {
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Config error: ${name} must be localhost or 127.0.0.1, not "${host}"`);
  }
}

/**
 * Refuses a URL whose host isn't this machine's loopback, so a mistyped or copied setting can
 * never point the suite at the hosted Supabase project.
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

/**
 * The Supabase URLs the dev server that global setup starts will inherit (03b §6.2). Vite lets
 * the process env win over apps/web/.env* files, so VITE_SUPABASE_URL must be set here and
 * local: unset, the dev server would fall back to whatever those files hold. Any other
 * VITE_SUPABASE_*_URL that's set must be local too.
 */
export function assertLocalDevServerEnv(env: Record<string, string | undefined>): void {
  if (!env.VITE_SUPABASE_URL?.trim()) {
    throw new Error(
      'Config error: VITE_SUPABASE_URL is not set, so the dev server would take its Supabase URL ' +
        'from apps/web/.env* files. Set it to the local stack (e2e/.env or the CI job env).',
    );
  }
  for (const [name, value] of Object.entries(env)) {
    if (/^VITE_SUPABASE_\w*URL$/.test(name) && value?.trim()) {
      assertLocalUrl(name, value);
    }
  }
}
