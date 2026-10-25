// CLI: the local production mirror (ADR-0005 decision 4, 03b §5.4).
//   node scripts/serve-mirror.ts [--port 4173] [--origin http://127.0.0.1:55321]
//                                [--stub-analytics] [--write-only <file>]
// Serves build/client with serve.railway.json's headers, the local Supabase origin in place of
// the hosted one. Refuses to serve a build that contains the hosted project ref (AC-5.11).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { findHostedRefs } from './hosted-ref.ts';
import { LOCAL_SUPABASE_ORIGIN, MIRROR_PORT } from './hosting-constants.ts';
import { buildMirrorConfig } from './mirror-config.ts';
import type { ServeConfig } from './mirror-config.ts';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const BUILD_DIR = join(WEB_DIR, 'build', 'client');
// Only real Vercel serves this path. An empty stub keeps the page free of a 404 locally; build/
// is gitignored and Vercel builds from source, so the stub never reaches a deploy (02b §5.4).
const ANALYTICS_SCRIPT = join(BUILD_DIR, '_vercel', 'insights', 'script.js');

function fail(message: string): never {
  console.error(`serve-mirror: ${message}`);
  process.exit(1);
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: String(MIRROR_PORT) },
      origin: {
        type: 'string',
        default: process.env.MIRROR_SUPABASE_ORIGIN || LOCAL_SUPABASE_ORIGIN,
      },
      'stub-analytics': { type: 'boolean', default: false },
      'write-only': { type: 'string' },
    },
  });
  return values;
}

function checkBuild(): void {
  if (!existsSync(BUILD_DIR)) {
    fail(`no build at ${BUILD_DIR}; run the gate build first (03b §0.3)`);
  }
  const hits = findHostedRefs(BUILD_DIR);
  if (hits.length > 0) {
    fail(`the build contains the hosted project ref in ${hits.length} files, e.g. ${hits[0]}`);
  }
}

function stubAnalytics(): void {
  if (!existsSync(ANALYTICS_SCRIPT)) {
    mkdirSync(dirname(ANALYTICS_SCRIPT), { recursive: true });
    writeFileSync(ANALYTICS_SCRIPT, '');
  }
}

function writeConfig(file: string, origin: string): void {
  const railway = JSON.parse(
    readFileSync(join(WEB_DIR, 'serve.railway.json'), 'utf8'),
  ) as ServeConfig;
  const config = buildMirrorConfig(railway, { localOrigin: origin, publicDir: BUILD_DIR });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function serve(configFile: string, port: string): void {
  const child = spawn(
    join(WEB_DIR, 'node_modules', '.bin', 'serve'),
    ['--config', configFile, '-l', port, '--no-clipboard'],
    { cwd: WEB_DIR, stdio: 'inherit' },
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code) => process.exit(code ?? 0));
}

const options = readOptions();

if (options['write-only']) {
  writeConfig(options['write-only'], options.origin);
  process.stdout.write(`serve-mirror: wrote ${options['write-only']}\n`);
  process.exit(0);
}

checkBuild();
if (options['stub-analytics']) {
  stubAnalytics();
}
const configFile = join(tmpdir(), `aj-classes-mirror-${options.port}.json`);
writeConfig(configFile, options.origin);
process.stdout.write(
  `serve-mirror: http://localhost:${options.port} (Supabase ${options.origin})\n`,
);
serve(configFile, options.port);
