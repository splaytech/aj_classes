import { createRequire } from 'node:module';
const require = createRequire('/Users/sjain/dev/work/aj_classes-e2e/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let ex = 0; await ctx.route('https://example.com/**', r => { ex++; return r.fulfill({ status: 200, body: 'x' }); });
const page = await ctx.newPage(); const lines = []; const pe = [];
await page.addInitScript(() => { window.__v = []; document.addEventListener('securitypolicyviolation', e => window.__v.push(`${e.effectiveDirective}|${e.blockedURI}|${e.disposition}`)); });
page.on('console', m => lines.push({ type: m.type(), text: m.text(), url: m.location()?.url }));
page.on('pageerror', e => pe.push(String(e)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const base = lines.length;
const probes = {
  fetch: () => fetch('https://example.com/data').then(() => 'fetched', e => `rejected ${e.name}: ${e.message}`),
  img: () => { const i = new Image(); i.src = 'https://example.com/b.gif'; document.body.append(i); return 'ok'; },
  beacon: () => String(navigator.sendBeacon('https://example.com/beacon', 'x')),
  ws: () => { try { const w = new WebSocket('wss://example.com/ws'); w.onerror = () => {}; return 'constructed'; } catch (e) { return `threw ${e.name}`; } },
  font: () => new FontFace('X', 'url(https://example.com/f.woff2)').load().then(() => 'loaded', e => `rejected ${e.name}`),
  link: () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://example.com/s.css'; document.head.append(l); return 'ok'; },
  iframe: () => { const f = document.createElement('iframe'); f.src = 'https://example.com/f'; document.body.append(f); return 'ok'; },
  iframeSelf: () => { const f = document.createElement('iframe'); f.src = '/privacy'; document.body.append(f); return 'ok'; },
  object: () => { const o = document.createElement('object'); o.data = 'https://example.com/o.swf'; document.body.append(o); return 'ok'; },
  base: () => { const b = document.createElement('base'); b.href = 'https://example.com/'; document.head.append(b); return document.baseURI; },
  form: () => { const f = document.createElement('form'); f.action = 'https://example.com/post'; f.method = 'post'; document.body.append(f); f.submit(); return 'submitted'; },
};
const out = [];
for (const [name, fn] of Object.entries(probes)) {
  const v0 = await page.evaluate(() => window.__v.length); const l0 = lines.length;
  const r = await page.evaluate(fn).catch(e => 'EVALERR ' + e.message);
  await page.waitForTimeout(1200);
  out.push({ name, r, v: await page.evaluate(n => window.__v.slice(n), v0), lines: lines.slice(l0).map(l => `${l.type}: ${l.text}`) });
}
console.log(JSON.stringify({ out, preLines: lines.slice(0, base), pe, ex, url: page.url(), baseURI: await page.evaluate(() => document.baseURI) }, null, 1));
await browser.close();
