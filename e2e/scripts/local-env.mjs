// Prints the E2E suite's settings as KEY=value lines (03b §6.3):
//   node e2e/scripts/local-env.mjs > e2e/.env          local runs (e2e/.env is gitignored)
//   node e2e/scripts/local-env.mjs >> "$GITHUB_ENV"    CI
// The keys come from the running local stack (`supabase status`), so no key is ever committed.
// Everything else comes from e2e/.env.example. Refuses unless the stack is the local one.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOCAL_API_URL = 'http://127.0.0.1:55321'; // supabase/config.toml [api] port
const EXAMPLE_FILE = fileURLToPath(new URL('../.env.example', import.meta.url));

/** Our variable name → the `supabase status -o json` field it comes from. */
const KEYS_FROM_STATUS = {
  SUPABASE_ANON_KEY: 'ANON_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SERVICE_ROLE_KEY',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'PUBLISHABLE_KEY',
};

function fail(message) {
  console.error(`local-env: ${message}`);
  process.exit(1);
}

function readStackStatus() {
  try {
    // stderr is dropped: the CLI prints update notices there.
    const output = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(output);
  } catch {
    fail('`supabase status -o json` failed; start the local stack first (pnpm db:start)');
  }
}

/** The example file's settings, minus the `<placeholder>` lines this script fills in. */
function readExampleSettings() {
  return readFileSync(EXAMPLE_FILE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .filter((line) => !/=<[^>]*>$/.test(line));
}

const status = readStackStatus();
if (status.API_URL !== LOCAL_API_URL) {
  fail(`the stack's API_URL is "${status.API_URL}", not ${LOCAL_API_URL}; refusing`);
}

const keyLines = [];
for (const [name, field] of Object.entries(KEYS_FROM_STATUS)) {
  const value = status[field];
  if (typeof value !== 'string' || value === '') {
    fail(`\`supabase status\` has no ${field}`);
  }
  // Workflow commands are read from stderr as well as stdout. stdout goes into $GITHUB_ENV, so
  // the mask goes on stderr, before the value is ever printed.
  if (process.env.GITHUB_ACTIONS === 'true') {
    process.stderr.write(`::add-mask::${value}\n`);
  }
  keyLines.push(`${name}=${value}`);
}

process.stdout.write(`${[...readExampleSettings(), ...keyLines].join('\n')}\n`);
