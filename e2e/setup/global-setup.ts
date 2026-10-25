import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { config } from '../src/config.js';
import { query, closePgPool } from '../src/db/pg-client.js';

interface Probe {
  name: string;
  hostPort: string;
  fixCommand: string;
  check: () => Promise<boolean>;
}

async function httpReachable(url: string): Promise<boolean> {
  try {
    // Any response (even 404/401) means the socket is up; only network
    // errors (connection refused, DNS failure) count as unreachable.
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function pgReachable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

function probes(): Probe[] {
  return [
    {
      name: 'web dev server',
      hostPort: config.web.baseUrl,
      fixCommand: `pnpm --filter web dev  (run from ${config.stack.ajClassesDir})`,
      check: () => httpReachable(config.web.baseUrl),
    },
    {
      name: 'Supabase REST',
      hostPort: config.supabase.restUrl,
      fixCommand: `pnpm db:start  (run from ${config.stack.ajClassesDir})`,
      check: () => httpReachable(config.supabase.restUrl),
    },
    {
      name: 'Postgres',
      hostPort: `${config.pg.host}:${config.pg.port}`,
      fixCommand: `pnpm db:start  (run from ${config.stack.ajClassesDir})`,
      check: pgReachable,
    },
    {
      name: 'Mailpit',
      hostPort: config.mailpit.baseUrl,
      fixCommand: `pnpm db:start  (run from ${config.stack.ajClassesDir})`,
      check: () => httpReachable(`${config.mailpit.baseUrl}/api/v1/info`),
    },
  ];
}

async function pollUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function tryStartWebDevServer(): Promise<void> {
  console.warn(
    `[global-setup] Web dev server unreachable at ${config.web.baseUrl}; attempting to start it ` +
      `from ${config.stack.ajClassesDir} (will be left running after the suite)...`,
  );
  const child = spawn('pnpm', ['--filter', 'web', 'dev'], {
    cwd: config.stack.ajClassesDir,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const started = await pollUntil(
    () => httpReachable(config.web.baseUrl),
    config.budgets.setupTimeoutMs,
  );
  if (!started) {
    throw new Error(
      `[global-setup] Started 'pnpm --filter web dev' but ${config.web.baseUrl} never became reachable ` +
        `within ${config.budgets.setupTimeoutMs}ms.`,
    );
  }
}

/**
 * Vite's dev server re-optimizes dependencies and force-reloads the page the first time it sees a
 * route that imports a not-yet-bundled module — if that happens mid-test, the reload wipes
 * whatever the spec just typed into a form. Hit the routes each spec visits once here, before any
 * spec runs, so that one-time cost is paid during setup instead of mid-interaction.
 */
async function warmUpWebServer(): Promise<void> {
  const routes = ['/', '/posts', '/portal/login'];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const route of routes) {
      await page
        .goto(`${config.web.baseUrl}${route}`, {
          waitUntil: 'networkidle',
          timeout: config.budgets.setupTimeoutMs,
        })
        .catch(() => undefined);
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<void> {
  const webProbe = probes()[0];
  if (!(await webProbe.check())) {
    await tryStartWebDevServer();
  }

  await warmUpWebServer();

  const failures: string[] = [];
  for (const probe of probes()) {
    // Never run `db:reset`; Supabase/Postgres/Mailpit are expected to already
    // be running via `pnpm db:start` in aj_classes — only the web dev server
    // is a candidate for start-if-needed.
    const ok = await probe.check();
    if (!ok) {
      failures.push(
        `  - ${probe.name} (${probe.hostPort}) is unreachable. Fix: ${probe.fixCommand}`,
      );
    }
  }

  await closePgPool();

  if (failures.length > 0) {
    throw new Error(
      `[global-setup] aj_classes local stack is not fully reachable:\n${failures.join('\n')}\n` +
        'See README.md for preconditions.',
    );
  }

  console.warn(
    '[global-setup] Stack reachable. Note: the Register Interest spec requires the web dev server ' +
      "to be running with VITE_LEAD_CAPTURE=on (set in aj_classes' apps/web/.env.development.local, " +
      'gitignored, never committed). If that spec times out polling public.enquiries, this is the cause.',
  );
}
