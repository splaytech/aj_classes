import { chromium, newLeg, settle, record, P } from './lib.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const p of ['/', '/programmes/vce', '/posts', '/nope']) for (const w of [360, 1280]) {
  const { page, L } = await newLeg(browser, { name: `E-60-${p.split('/').pop() || 'home'}-${w}`, width: w });
  await page.goto(P + p); await settle(page);
  Object.assign(L, await page.evaluate(() => ({ title: document.title, marker: [...document.querySelectorAll('div[aria-hidden="true"]')].map(d => d.innerText.trim()).filter(t => /^STAGING/.test(t)), icon: document.querySelector('link[rel="icon"]')?.getAttribute('href'), robots: document.querySelectorAll('meta[name="robots"]').length })));
  L.iconStatus = (await page.request.get(P + L.icon)).status();
  L.insights = L.responses.filter(r => r.includes('/_vercel/insights')).length; L.path = p;
  await L.close(); delete L.responses; record('staging.jsonl', L);
}
await browser.close();
