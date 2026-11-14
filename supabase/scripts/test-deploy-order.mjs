// Tests of supabase/scripts/deploy.sh (ADR-0011; docs/delivery/2026-11-13-open-sign-up 03 §5).
// No network and no local stack: fake `supabase`, `curl` and `jq` go on a PATH that holds only the
// fakes plus /usr/bin:/bin, so the real Supabase CLI can't be reached. Every secret is a fake value
// and DEPLOY_ENV_FILE=/dev/null, so supabase/.env.deploy is never read.
//   1. --dry-run: the step order, config push last, nothing run, the token never printed.
//   2. The real script against the fakes: the fail-closed paths (review-3 finding 2).
//   3. Static config checks (AC-15, AC-39, linking and Apple off).
// Run: node supabase/scripts/test-deploy-order.mjs   (part of root `pnpm test`)

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const HERE = import.meta.dirname;
const DEPLOY = path.join(HERE, 'deploy.sh');
const CONFIG = path.join(HERE, '..', 'config.toml');
const TOKEN = 'fake-access-token-not-a-secret-7f3a';

let failures = 0;
function check(description, condition, detail = '') {
  console.log(`${condition ? 'ok    ' : 'NOT OK'} ${description}${condition ? '' : `  ${detail}`}`);
  if (!condition) failures += 1;
}

// The fakes log every argument list to $FAKE_LOG, one call per line. Their answers come from
// FAKE_* variables, so each case scripts its own hosted project.
const FAKE_SUPABASE = `#!/bin/bash
echo "supabase $*" >> "$FAKE_LOG"
[[ -n "$FAKE_SUPABASE_FAILS" ]] && exit 1
if [[ "$1 $2" == "secrets list" ]]; then
  digest() { printf %s "$1" | shasum -a 256 | cut -d' ' -f1; }
  printf '[{"name":"NOTIFY_WORKER_SECRET","value":"%s"},{"name":"EMAIL_TRANSPORT","value":"%s"},{"name":"SITE_URL","value":"%s"}]\\n' \\
    "$(digest "$NOTIFY_WORKER_SECRET")" "$(digest resend)" "$(digest https://ajclasses.com.au)"
fi
exit 0
`;

const FAKE_CURL = `#!/bin/bash
echo "curl $*" >> "$FAKE_LOG"
url=""
method=GET
for ((i = 1; i <= $#; i++)); do
  [[ "\${!i}" == http* ]] && url="\${!i}"
  [[ "\${!i}" == "-X" ]] && { j=$((i + 1)); method="\${!j}"; }
done
case "$method $url" in
  "GET "*/auth/v1/settings)
    [[ "$FAKE_SIGNUPS_OFF" == "true" ]] && echo '{"disable_signup":true}' || echo '{"disable_signup":false}' ;;
  "POST "*/rpc/sign_up_guard_ready)
    n=$(($(cat "$FAKE_DIR/guard-calls" 2>/dev/null || echo 0) + 1)); echo "$n" > "$FAKE_DIR/guard-calls"
    answer=$(echo "$FAKE_GUARD" | cut -d, -f"$n"); [[ -z "$answer" ]] && answer=$(echo "$FAKE_GUARD" | awk -F, '{print $NF}')
    [[ "$answer" == "true" ]] && echo true || exit 22 ;;
  "GET "*/config/auth)
    [[ "$FAKE_HOOK_ON" == "true" ]] && echo '{"hook_before_user_created_enabled":true,"hook_before_user_created_uri":"pg-functions://postgres/public/hook_before_user_created"}' \\
      || echo '{"hook_before_user_created_enabled":false}' ;;
  "PATCH "*/config/auth)
    [[ "$FAKE_PATCH_FAILS" == "true" ]] && exit 22 || echo '{}' ;;
  *) exit 7 ;;
esac
`;

function makeFakes() {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-order-'));
  const realJq = spawnSync('/bin/sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
  const fakes = {
    supabase: FAKE_SUPABASE,
    curl: FAKE_CURL,
    // jq is harmless (no network), so the fake only logs and hands over to the real one.
    jq: `#!/bin/bash\necho "jq $*" >> "$FAKE_LOG"\nexec "${realJq}" "$@"\n`,
  };
  for (const [name, body] of Object.entries(fakes)) {
    writeFileSync(path.join(dir, name), body);
    chmodSync(path.join(dir, name), 0o755);
  }
  return dir;
}

function configWithGoogle(dir, enabled) {
  const copy = path.join(dir, `config-google-${enabled}.toml`);
  const text = readFileSync(CONFIG, 'utf8').replace(
    /(\[remotes\.production\.auth\.external\.google\]\nenabled = )(true|false)/,
    `$1${enabled}`,
  );
  writeFileSync(copy, text);
  return copy;
}

function runDeploy({ dryRun = true, env = {}, config = CONFIG } = {}) {
  const dir = makeFakes();
  const log = path.join(dir, 'calls.log');
  writeFileSync(log, '');
  const result = spawnSync('/bin/bash', [DEPLOY, ...(dryRun ? ['--dry-run'] : [])], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:/usr/bin:/bin`,
      HOME: dir,
      TMPDIR: dir,
      FAKE_LOG: log,
      FAKE_DIR: dir,
      DEPLOY_ENV_FILE: '/dev/null',
      DEPLOY_CONFIG: config,
      DEPLOY_GUARD_RETRY_SECONDS: '0',
      SUPABASE_ACCESS_TOKEN: TOKEN,
      SUPABASE_DB_PASSWORD: 'dry-run-not-a-password',
      TURNSTILE_SECRET: 'dry-run-not-a-secret',
      RESEND_API_KEY: 'dry-run-not-a-key',
      NOTIFY_WORKER_SECRET: 'dry-run-not-a-secret',
      ...env,
    },
  });
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const leftovers = spawnSync('/bin/sh', ['-c', `ls "${dir}" | grep '^tmp' || true`], {
    encoding: 'utf8',
  }).stdout.trim();
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, out: `${result.stdout}${result.stderr}`, calls, leftovers };
}

const STEPS = [
  ['gate', /2\/7 Gate/],
  ['db push', /\(dry run\) supabase db push/],
  ['guard check', /4\/7 Checking the sign-up guard/],
  ['functions', /5\/7 Edge functions/],
  ['secrets', /\(dry run\) supabase secrets set/],
  ['config push', /\(dry run\) supabase config push/],
  ['hook post-check', /Checking the sign-up hook is on/],
];

function dryRunChecks() {
  console.log('\ndeploy.sh --dry-run');
  const { status, out, calls } = runDeploy();
  check('Exits 0', status === 0, out);
  const positions = STEPS.map(([, pattern]) => out.search(pattern));
  check(
    `Steps in order: ${STEPS.map(([name]) => name).join(' → ')}`,
    positions.every((at) => at >= 0) &&
      positions.every((at, i) => i === 0 || at > positions[i - 1]),
    JSON.stringify(Object.fromEntries(STEPS.map(([name], i) => [name, positions[i]]))),
  );
  const supabaseCommands = out.split('\n').filter((line) => line.includes('(dry run) supabase '));
  check(
    'config push is the last supabase command',
    supabaseCommands.at(-1)?.includes('supabase config push'),
    supabaseCommands.at(-1),
  );
  check(
    'Nothing ran: the fakes were never called (jq availability is checked with command -v)',
    calls.length === 0,
    calls.join(' | '),
  );
  check('The token is never printed', !out.includes(TOKEN));
  check(
    'Google is off in the shipped config: no GOOGLE_* asked for',
    !out.includes('GOOGLE_CLIENT_ID') && out.includes('Google off'),
  );
}

// The real script (no --dry-run) against the fakes only.
const realRun = (env, config) => runDeploy({ dryRun: false, env, config });
const guardCalls = (calls) => calls.filter((call) => call.includes('rpc/sign_up_guard_ready'));
const patches = (calls) =>
  calls.filter((call) => call.includes('-X PATCH') && call.includes('"disable_signup":true'));

function failClosedChecks() {
  console.log('\ndeploy.sh against fakes: fail closed');

  const happy = realRun({ FAKE_SIGNUPS_OFF: 'true', FAKE_GUARD: 'true', FAKE_HOOK_ON: 'true' });
  check('Happy path: exits 0', happy.status === 0, happy.out);
  check(
    'Happy path: config push is the last supabase call',
    happy.calls
      .filter((c) => c.startsWith('supabase '))
      .at(-1)
      ?.startsWith('supabase config push'),
  );
  check('Happy path: no PATCH', patches(happy.calls).length === 0);

  // (a) + (c): a re-deploy (sign-up on, guard ready at the gate), then the guard check fails.
  const stepFour = realRun({
    FAKE_SIGNUPS_OFF: 'false',
    FAKE_GUARD: 'true,false',
    FAKE_HOOK_ON: 'true',
  });
  check('Step-4 failure on a re-deploy: non-zero exit', stepFour.status !== 0);
  check(
    'Step 4 is retried 5 times (plus the gate call)',
    guardCalls(stepFour.calls).length === 6,
    guardCalls(stepFour.calls).length,
  );
  check('One PATCH {"disable_signup":true} closes sign-up', patches(stepFour.calls).length === 1);
  check(
    'config push never runs',
    !stepFour.calls.some((call) => call.startsWith('supabase config push')),
  );
  check(
    'It says sign-up is off',
    stepFour.out.includes("the sign-up guard isn't ready. Sign-up is off"),
  );

  const stepFourClosed = realRun({ FAKE_SIGNUPS_OFF: 'true', FAKE_GUARD: 'false' });
  check(
    'Step-4 failure on a first deploy (sign-up was off): no PATCH needed, non-zero exit',
    stepFourClosed.status !== 0 && patches(stepFourClosed.calls).length === 0,
  );

  const gateRefused = realRun({ FAKE_SIGNUPS_OFF: 'false', FAKE_GUARD: 'false' });
  check(
    'Gate: sign-up on without the guard stops before db push',
    gateRefused.status !== 0 && !gateRefused.calls.some((c) => c.startsWith('supabase db push')),
  );

  // Hook post-check fails: sign-up is closed again.
  const hookOff = realRun({ FAKE_SIGNUPS_OFF: 'true', FAKE_GUARD: 'true', FAKE_HOOK_ON: 'false' });
  check('Hook off after config push: non-zero exit', hookOff.status !== 0);
  check(
    'Hook off after config push: one PATCH closes sign-up',
    patches(hookOff.calls).length === 1,
  );
  check(
    'Hook off: it says sign-up was closed again',
    hookOff.out.includes("The sign-up hook isn't on, so sign-up was closed again"),
  );

  // (b): the PATCH itself fails.
  const patchFails = realRun({
    FAKE_SIGNUPS_OFF: 'true',
    FAKE_GUARD: 'true',
    FAKE_HOOK_ON: 'false',
    FAKE_PATCH_FAILS: 'true',
  });
  check('PATCH fails: non-zero exit', patchFails.status !== 0);
  check(
    'PATCH fails: the "turn it off in Dashboard now" message',
    patchFails.out.includes('Sign-up may be open without the hook: turn it off in Dashboard'),
    patchFails.out.slice(-400),
  );

  // (d): the token is only ever in a header file.
  const all = [happy, stepFour, hookOff, patchFails];
  const managementCalls = all.flatMap((run) =>
    run.calls.filter((call) => call.includes('api.supabase.com')),
  );
  check(
    'Management API calls use -H @<file>',
    managementCalls.length > 0 && managementCalls.every((call) => /-H @\S+/.test(call)),
    managementCalls.join(' | '),
  );
  check(
    'No fake ever saw the token in its arguments',
    all.every((run) => run.calls.every((call) => !call.includes(TOKEN))),
  );
  check(
    'The header file is gone after exit, on success and on failure',
    all.every((run) => run.leftovers === ''),
    all.map((run) => run.leftovers).join(','),
  );
}

function googleGateChecks() {
  console.log('\ndeploy.sh: Google credentials only when Google is on');
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-google-'));
  try {
    const off = runDeploy({ config: configWithGoogle(dir, false) });
    check('Google enabled = false: runs with no GOOGLE_*', off.status === 0, off.out.slice(-300));
    const on = realRun({ FAKE_SIGNUPS_OFF: 'true' }, configWithGoogle(dir, true));
    check(
      'Google enabled = true and no GOOGLE_*: stops at "Checking what\'s needed"',
      on.status !== 0 &&
        on.out.includes('GOOGLE_CLIENT_ID is not set') &&
        !on.out.includes('1/7') &&
        on.calls.length === 0,
      on.out.slice(-300),
    );
    const onWith = realRun(
      {
        FAKE_SIGNUPS_OFF: 'true',
        FAKE_GUARD: 'true',
        FAKE_HOOK_ON: 'true',
        GOOGLE_CLIENT_ID: 'dry-run-client',
        GOOGLE_CLIENT_SECRET: 'dry-run-not-a-secret',
      },
      configWithGoogle(dir, true),
    );
    check(
      'Google enabled = true with both values: runs',
      onWith.status === 0,
      onWith.out.slice(-300),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The value of `key` inside one [table] of config.toml (simple key = value lines only). */
function tomlValue(table, key) {
  const lines = readFileSync(CONFIG, 'utf8').split('\n');
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('[')) inTable = line.trim() === `[${table}]`;
    else if (inTable) {
      const match = line.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*(#.*)?$`));
      if (match) return match[1];
    }
  }
  return undefined;
}

function staticConfigChecks() {
  console.log('\nconfig.toml (static)');
  check('AC-39: sign_in_sign_ups = 30', tomlValue('auth.rate_limit', 'sign_in_sign_ups') === '30');
  check(
    'AC-15: production e-mail sender name "AJ Classes"',
    tomlValue('remotes.production.auth.email.smtp', 'sender_name') === '"AJ Classes"',
  );
  check(
    'AC-15: production admin_email hello@ajclasses.com.au',
    tomlValue('remotes.production.auth.email.smtp', 'admin_email') === '"hello@ajclasses.com.au"',
  );
  check('Manual linking stays off', tomlValue('auth', 'enable_manual_linking') === 'false');
  check('Apple stays off', tomlValue('auth.external.apple', 'enabled') === 'false');
  check('Google is off locally', tomlValue('auth.external.google', 'enabled') === 'false');
  check(
    'Google is off in production (first release)',
    tomlValue('remotes.production.auth.external.google', 'enabled') === 'false',
  );
  check(
    'Production Google credentials come from env(), never the file',
    tomlValue('remotes.production.auth.external.google', 'client_id') ===
      '"env(GOOGLE_CLIENT_ID)"' &&
      tomlValue('remotes.production.auth.external.google', 'secret') ===
        '"env(GOOGLE_CLIENT_SECRET)"',
  );
}

dryRunChecks();
failClosedChecks();
googleGateChecks();
staticConfigChecks();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
