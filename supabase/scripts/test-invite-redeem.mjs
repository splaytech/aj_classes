// Tests of the 14-day invite link (ADR-0010; docs/delivery/2026-10-29-invite-14-days 03 §8.3):
//   1. Unit checks of the pure modules (token, invite email, issueInvite order), imported straight
//      from the function folders: Node strips the types, and Deno isn't installed locally.
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-invite-redeem.mjs)

import { createHash } from 'node:crypto';

import { check, finish } from './local-test-helpers.mjs';
import {
  INVITE_TOKEN_PATTERN,
  hashInviteToken,
  isInviteToken,
  newInviteToken,
} from '../functions/_shared/invite-token.ts';
import { INVITE_COPY } from '../functions/account-admin/invite-copy.ts';
import {
  inviteAudience,
  inviteLink,
  renderInviteEmail,
} from '../functions/account-admin/invite-email.ts';
import { issueInvite } from '../functions/account-admin/issue-invite.ts';

const SITE = 'http://localhost:5173';
const EXPIRY_LINE =
  'This link expires in 14 days and works once. If it has expired, ask AJ Classes to send you a new one.';
const LINK_PATTERN = /http:\/\/localhost:5173\/portal\/invite\?token=([A-Za-z0-9_-]{43})/;

function tokenUnitChecks() {
  console.log('\nUnit: invite token');
  const token = newInviteToken();
  check(
    'A new token is 43 characters of base64url',
    INVITE_TOKEN_PATTERN.test(token),
    token.length,
  );
  const many = new Set(Array.from({ length: 100 }, () => newInviteToken()));
  check('100 new tokens are all different', many.size === 100);
  check('isInviteToken accepts a new token', isInviteToken(token));
  check('isInviteToken refuses 42 characters', !isInviteToken('a'.repeat(42)));
  check('isInviteToken refuses 44 characters', !isInviteToken('a'.repeat(44)));
  for (const bad of ['+', '/', '=']) {
    check(`isInviteToken refuses "${bad}"`, !isInviteToken(`${'a'.repeat(42)}${bad}`));
  }
  for (const value of [null, undefined, 43, {}, ['a'.repeat(43)]]) {
    check(`isInviteToken refuses ${JSON.stringify(value) ?? 'undefined'}`, !isInviteToken(value));
  }
}

async function hashUnitChecks() {
  const token = newInviteToken();
  const hash = await hashInviteToken(token);
  check('The hash is 64 lower-case hex characters', /^[0-9a-f]{64}$/.test(hash));
  check(
    'The hash equals node:crypto SHA-256 of the token',
    hash === createHash('sha256').update(token).digest('hex'),
  );
}

function renderUnitChecks() {
  console.log('\nUnit: invite email');
  check(
    'tutor and admin get the staff wording',
    inviteAudience('tutor') === 'staff' && inviteAudience('admin') === 'staff',
  );
  check(
    'inviteLink trims trailing slashes',
    inviteLink('https://ajclasses.com.au//', 'abc') ===
      'https://ajclasses.com.au/portal/invite?token=abc',
  );

  const link = inviteLink(SITE, newInviteToken());
  const cases = [
    { role: 'tutor', label: 'Staff', intro: INVITE_COPY.intro.staff },
    { role: 'admin', label: 'Staff', intro: INVITE_COPY.intro.staff },
    { role: 'student', label: 'Students', intro: INVITE_COPY.intro.student },
    { role: 'parent', label: 'Parents', intro: INVITE_COPY.intro.parent },
  ];
  for (const { role, label, intro } of cases) {
    const email = renderInviteEmail({ to: `${role}@local.test`, role, link });
    check(`${role}: sent to the given address`, email.to === `${role}@local.test`);
    check(
      `${role}: subject "You're invited to the AJ Classes portal" (AC 28)`,
      email.subject === "You're invited to the AJ Classes portal",
    );
    check(
      `${role}: heading, label "${label}" and role wording (AC 28)`,
      email.html.includes('>You&#39;re invited to AJ Classes</h1>') &&
        email.html.includes(`&nbsp;${label}</span>`) &&
        email.text.includes(`${intro} ${INVITE_COPY.nextStep}`),
    );
    check(
      `${role}: Accept invite button links to the invite page (AC 28, 31)`,
      email.html.includes(`<a href="${link}"`) && email.html.includes('>Accept invite</a>'),
    );
    check(
      `${role}: the expiry line says 14 days, in HTML and text (AC 29)`,
      email.html.includes(EXPIRY_LINE) && email.text.includes(EXPIRY_LINE),
    );
    check(
      `${role}: nothing says 1 hour (AC 29)`,
      !email.html.includes('1 hour') && !email.text.includes('1 hour'),
    );
    check(
      `${role}: the ignore line is kept (AC 28)`,
      email.text.includes("If you didn't expect this email, you can ignore it.") &&
        email.html.includes('If you didn&#39;t expect this email, you can ignore it.'),
    );
    check(
      `${role}: the text part has the full link (AC 30)`,
      email.text.includes(`Accept invite: ${link}`),
    );
    check(
      `${role}: the link is the site's own page, not Supabase (AC 31)`,
      LINK_PATTERN.test(email.text) && !link.includes('supabase') && !link.includes('auth/confirm'),
    );
  }
}

const sent = { outcome: 'sent' };
const failedSend = { outcome: 'failed', reason: 'rejected' };
const retrySend = { outcome: 'retry', reason: 'network' };

function fakeSteps(sendOutcome, storeResult) {
  const calls = { messages: [], stored: [] };
  return {
    calls,
    steps: {
      send: async (message) => {
        calls.messages.push(message);
        return sendOutcome;
      },
      store: async (hash) => {
        calls.stored.push(hash);
        return storeResult;
      },
    },
  };
}

async function issueUnitChecks() {
  console.log('\nUnit: issueInvite order (send, then store)');
  const account = { id: 'id-1', email: 'someone@local.test', role: 'tutor' };

  for (const [name, outcome] of [
    ['failed', failedSend],
    ['retry', retrySend],
  ]) {
    const { calls, steps } = fakeSteps(outcome, true);
    const result = await issueInvite(account, SITE, steps);
    check(
      `Send ${name} → false, and nothing is stored (AC 21, 39)`,
      result === false && calls.messages.length === 1 && calls.stored.length === 0,
    );
  }

  const joined = fakeSteps(sent, false);
  check(
    'Send ok but store refused (joined meanwhile) → false',
    (await issueInvite(account, SITE, joined.steps)) === false && joined.calls.stored.length === 1,
  );

  const ok = fakeSteps(sent, true);
  check('Send ok and store ok → true', (await issueInvite(account, SITE, ok.steps)) === true);
  const [message] = ok.calls.messages;
  const token = message.text.match(LINK_PATTERN)?.[1] ?? '';
  check('The email goes to the account', message.to === account.email);
  check(
    'The stored hash is the hash of the token in the emailed link, never the token',
    ok.calls.stored[0] === (await hashInviteToken(token)) && ok.calls.stored[0] !== token,
  );
}

async function main() {
  tokenUnitChecks();
  await hashUnitChecks();
  renderUnitChecks();
  await issueUnitChecks();
  finish();
}

await main();
