import { readFileSync } from 'node:fs';
import { chromium, newLeg, settle, record, P } from './lib.mjs';
const PHASE = process.argv[2]; // 'E-21' (no posts) | 'E-26' (with post)
const pages = readFileSync(process.env.SCR + '/p16.txt', 'utf8').trim().split(/\s+/);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const EVD = process.env.EVD;
const slug = p => p === '/' ? 'home' : p.slice(1).replaceAll('/', '_');
for (const scheme of ['light', 'dark']) for (const width of [360, 1280]) for (const path of pages) {
  const name = `${PHASE}-${slug(path)}-${width}-${scheme}`;
  const { page, L, ctx } = await newLeg(browser, { name, width, scheme });
  const newsChecks = [];
  ctx.on('response', async r => { if (r.url().includes('/rest/v1/posts?select=id&limit=1')) newsChecks.push({ status: r.status(), body: await r.text().catch(() => '?') }); });
  const resp = await page.goto(P + path); await settle(page);
  await page.waitForFunction(() => window.__reactRouterContext && document.querySelector('header button[aria-controls]'), null, { timeout: 10000 }).catch(() => { L.hydrationTimeout = true; });
  L.path = path; L.status = resp.status();
  Object.assign(L, await page.evaluate(() => {
    const cs = el => el ? { c: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor } : null;
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { const j = JSON.parse(s.textContent); const t = j['@type'] ?? (j['@graph'] ?? []).map(g => g['@type']); return { ok: true, type: t }; } catch { return { ok: false }; } });
    const marker = [...document.querySelectorAll('div[aria-hidden="true"]')].some(d => /^(STAGING|DEV)/.test(d.innerText.trim()));
    return {
      h1: [...document.querySelectorAll('h1')].map(h => h.innerText),
      robots: document.querySelectorAll('meta[name="robots"]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      images: [...document.images].map(i => i.complete && i.naturalWidth > 0),
      colors: { body: cs(document.body), h1: cs(document.querySelector('h1')), link: cs(document.querySelector('header nav a')) },
      title: document.title, marker,
      newsHeader: document.querySelectorAll('header a[href="/posts"]').length,
      newsFooter: document.querySelectorAll('footer a[href="/posts"]').length,
      ld,
      postsText: location.pathname === '/posts' ? document.querySelector('main')?.innerText.slice(0, 600) : undefined,
      postItems: location.pathname === '/posts' ? document.querySelectorAll('main li').length : undefined,
      postH2: location.pathname === '/posts' ? [...document.querySelectorAll('main h2')].map(h => h.textContent) : undefined,
      imgX: document.querySelectorAll('img[src="x"]').length,
    };
  }));
  L.dialogs = 0; page.on('dialog', d => { L.dialogs++; d.dismiss(); });
  await page.screenshot({ path: `${EVD}/${name}.png` });
  if (width === 360) {
    await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(300);
    const nav = await page.evaluate(() => { const b = document.querySelector('header button[aria-controls]'); const n = document.getElementById(b.getAttribute('aria-controls')); const r = n.getBoundingClientRect(); return { exp: b.getAttribute('aria-expanded'), visible: getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && r.height > 0 }; });
    await page.getByRole('button', { name: 'Close menu' }).click(); await page.waitForTimeout(300);
    L.menu = { opened: nav, closedExp: await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded') };
  }
  if (path === '/') {
    await page.locator('#contact-name').fill('CSP Sweep');
    await page.locator('#contact-email').fill('csp-sweep@example.test');
    await page.locator('#contact-message').fill('Item 5 sweep, mocked.');
    await page.locator('#ask-a-question').getByRole('button', { name: 'Register interest' }).click();
    await page.locator('main [role="status"]').first().waitFor({ timeout: 10000 }).catch(() => {});
    L.enquiry = { status: await page.locator('main [role="status"]').allInnerTexts(), w3f: L.mocks.web3forms.map(m => ({ url: m.url, key: JSON.parse(m.body || '{}').access_key })), leads: L.mocks.leads.map(m => m.url) };
  }
  const sub = page.locator('footer input[type="email"]');
  if (await sub.count()) {
    await sub.fill('csp-sweep@example.test');
    await page.locator('footer').getByRole('button', { name: 'Subscribe' }).click();
    await page.locator('footer [role="status"]').waitFor({ timeout: 10000 }).catch(() => {});
    L.subscribe = { status: await page.locator('footer [role="status"]').allInnerTexts(), kit: L.mocks.kit };
  } else L.subscribe = 'missing';
  await page.waitForTimeout(300);
  L.newsChecks = newsChecks;
  L.insights = L.responses.filter(r => r.includes('/_vercel/insights/'));
  await L.close(); delete L.responses;
  record(`${PHASE}.jsonl`, L);
}
await browser.close();
