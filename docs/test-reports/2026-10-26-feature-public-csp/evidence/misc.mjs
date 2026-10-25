import { chromium, newLeg, settle, record, P } from './lib.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = 'misc.jsonl';
async function leg(name, opts, fn) { const { page, L, ctx } = await newLeg(browser, { name, ...opts }); try { await fn(page, L, ctx); } catch (e) { L.error = String(e).slice(0, 300); } await L.close(); delete L.responses; record(out, L); return L; }
// E-20
for (const p of ['/', '/privacy']) await leg(`E-20-${p === '/' ? 'home' : 'privacy'}`, {}, async (page, L) => { const r = await page.goto(P + p); await settle(page); L.status = r.status(); L.h1 = await page.locator('h1').allInnerTexts(); });
await leg('E-20-portal-login', { portal: true }, async (page, L) => { const r = await page.goto(P + '/portal/login'); await settle(page, true); await page.waitForTimeout(2000); L.status = r.status(); L.h1 = await page.locator('h1').allInnerTexts(); });
// news link text (E-26 detail)
await leg('E-26-newslabel', {}, async (page, L) => { await page.goto(P + '/'); await settle(page); L.labels = await page.locator('a[href="/posts"]').allInnerTexts(); });
// E-27
await leg('E-27-500', {}, async (page, L, ctx) => { L.hits = 0; await ctx.route('http://127.0.0.1:55321/rest/v1/posts**', r => { L.hits++; return r.fulfill({ status: 500, body: '{}' }); });
  await page.goto(P + '/'); await settle(page); L.homeLinks = await page.locator('a[href="/posts"]').count();
  await page.goto(P + '/posts'); await settle(page); await page.waitForTimeout(500); L.postsLinks = await page.locator('a[href="/posts"]').count(); L.postsText = await page.locator('main').innerText(); });
await leg('E-27-slow', {}, async (page, L, ctx) => { L.hits = 0; await ctx.route('http://127.0.0.1:55321/rest/v1/posts**', async r => { L.hits++; await new Promise(res => setTimeout(res, 6000)); return r.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":"x"}]' }).catch(() => {}); });
  await page.goto(P + '/'); await page.waitForLoadState('load'); await page.waitForTimeout(8000); L.homeLinks = await page.locator('a[href="/posts"]').count(); });
// E-29
for (const p of ['/', '/programmes/vce', '/resources/victorian-selective-entry-exam']) await leg(`E-29-${p.split('/').pop() || 'home'}`, {}, async (page, L, ctx) => {
  L.fontReq = 0; L.ajReq = 0; ctx.on('request', r => { if (r.resourceType() === 'font') L.fontReq++; if (new URL(r.url()).hostname.endsWith('ajclasses.com.au')) L.ajReq++; });
  await page.goto(P + p); await settle(page);
  Object.assign(L, await page.evaluate(() => ({ images: [...document.images].map(i => i.complete && i.naturalWidth > 0), icons: [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(l => l.getAttribute('href')), manifest: document.querySelectorAll('link[rel="manifest"]').length, og: document.querySelector('meta[property="og:image"]')?.content })));
  L.iconFetch = []; for (const h of L.icons) { const r = await page.request.get(P + h); L.iconFetch.push(`${h} ${r.status()} ${r.headers()['content-type']}`); } });
// E-30
for (const p of ['/', '/programmes/vce', '/nope']) for (const w of [360, 1280]) await leg(`E-30-${p.split('/').pop() || 'home'}-${w}`, { width: w }, async (page, L, ctx) => {
  await page.goto(P + p); await settle(page); L.path = p;
  const a = page.locator('a[aria-label="Chat with AJ Classes on WhatsApp (opens WhatsApp)"]');
  L.wa = { href: await a.getAttribute('href'), target: await a.getAttribute('target'), rel: await a.getAttribute('rel') };
  const [pop] = await Promise.all([ctx.waitForEvent('page'), a.click()]); await pop.waitForLoadState('load'); L.popup = pop.url(); });
// E-33
for (const p of ['/portalx', '/__spa-fallbackx']) for (const w of [360, 1280]) await leg(`E-33-${p.slice(1)}-${w}`, { width: w }, async (page, L) => { const r = await page.goto(P + p); await settle(page); L.path = p; L.status = r.status(); L.h1 = await page.locator('h1').allInnerTexts(); L.robots = await page.locator('meta[name="robots"]').count(); });
await browser.close();
