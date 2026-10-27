import { createRequire } from 'node:module';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
const require = createRequire('/Users/sjain/dev/work/aj_classes-e2e/package.json');
export const { chromium } = require('@playwright/test');
export const P = process.env.BASE ?? 'http://127.0.0.1:4173';
const EVD = process.env.EVD;
const seed = readFileSync('/Users/sjain/dev/work/aj_classes-items-4-9/supabase/seed.sql', 'utf8');
export const PASSWORD = seed.match(/^-- Local-only password: (\S+)$/m)[1];
const ADMIN_KEY = seed.match(/^--   ([A-Z2-7]{32})$/m)[1];
export function totp() {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...ADMIN_KEY].map(c => a.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(ctr).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const PUBLIC_HOSTS = ['127.0.0.1:4173', '127.0.0.1:55321', 'api.web3forms.com', 'app.convertkit.com', 'wa.me', 'example.com'];
export async function newLeg(browser, { name, width = 1280, scheme = 'light', portal = false, extraHosts = [] }) {
  mkdirSync(`${EVD}/har`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width, height: width === 360 ? 780 : 800 }, colorScheme: scheme, recordHar: { path: `${EVD}/har/${name}.har` } });
  const L = { name, width, scheme, consoleErrors: [], pageErrors: [], violations: [], hosted: 0, unexpected: [], mocks: { web3forms: [], kit: [], leads: [], wa: [], example: [] }, responses: [], docCsp: [] };
  await ctx.route('https://api.web3forms.com/**', r => { L.mocks.web3forms.push({ url: r.request().url(), body: r.request().postData() }); return r.fulfill({ status: 200, headers: CORS, body: '{"success":true,"message":"mocked"}' }); });
  await ctx.route('https://app.convertkit.com/**', r => { L.mocks.kit.push({ url: r.request().url(), method: r.request().method() }); return r.fulfill({ status: 200, headers: CORS, body: '{"status":"success"}' }); });
  await ctx.route('http://127.0.0.1:55321/functions/v1/leads**', r => { L.mocks.leads.push({ url: r.request().url(), method: r.request().method() }); return r.fulfill({ status: 200, headers: CORS, body: '{"ok":true}' }); });
  await ctx.route('https://wa.me/**', r => { L.mocks.wa.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa mock</title>' }); });
  await ctx.route('https://example.com/**', r => { L.mocks.example.push(r.request().url()); return r.fulfill({ status: 200, body: 'x' }); });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.effectiveDirective}|${e.blockedURI}|${e.disposition}`)); });
  const allowed = new Set([...PUBLIC_HOSTS, ...(portal ? ['challenges.cloudflare.com'] : []), ...extraHosts]);
  ctx.on('request', r => { let u; try { u = new URL(r.url()); } catch { return; } if (!/^https?:|^wss?:/.test(u.protocol)) return; if (u.hostname.endsWith('supabase.co')) L.hosted++; if (!allowed.has(u.host)) L.unexpected.push(u.origin); });
  ctx.on('response', r => { L.responses.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
  const watch = (page) => {
    page.on('console', m => { if (m.type() === 'error') L.consoleErrors.push({ text: m.text(), url: m.location()?.url ?? '' }); if (/Content.Security.Policy/i.test(m.text()) && m.type() !== 'error') L.consoleErrors.push({ text: m.text(), url: m.location()?.url ?? '', type: m.type() }); });
    page.on('pageerror', e => L.pageErrors.push(String(e)));
    page.on('response', async r => { if (r.request().resourceType() === 'document' && r.frame() === page.mainFrame()) { const h = await r.headersArray(); L.docCsp.push({ url: r.url(), status: r.status(), csp: h.filter(x => x.name.toLowerCase() === 'content-security-policy').map(x => x.value) }); } });
  };
  ctx.on('page', watch);
  const page = await ctx.newPage();
  L.collect = async () => { for (const pg of ctx.pages()) { const v = await pg.evaluate(() => window.__csp ?? []).catch(() => []); L.violations.push(...v); } };
  L.close = async () => { await L.collect(); await ctx.close(); };
  return { ctx, page, L };
}
export async function settle(page, portal = false) {
  await page.waitForLoadState('load');
  if (portal) { await page.waitForTimeout(1000); return; }
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}
export async function signIn(page, email, { twoStep = false } = {}) {
  await page.goto(P + '/portal/login'); await settle(page, true);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.waitForFunction(() => document.querySelector('input[name="cf-turnstile-response"]')?.value, null, { timeout: 20000 });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (twoStep) {
    await page.waitForURL(/\/portal\/login\/verify/, { timeout: 20000 });
    await page.locator('#two-step-code').waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    await page.locator('#two-step-code').fill(totp());
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
  }
}
export function record(file, obj) { const { collect, close, ...rest } = obj; appendFileSync(`${EVD}/${file}`, JSON.stringify(rest) + '\n'); }
