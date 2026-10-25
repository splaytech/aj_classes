import { chromium, newLeg, settle, signIn, record, P } from './lib.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const only = process.argv[2];
async function leg(name, opts, fn) { const { page, L, ctx } = await newLeg(browser, { name, portal: true, ...opts }); try { await fn(page, L, ctx); } catch (e) { L.error = String(e).slice(0, 300); } await L.close();
  L.cf = L.responses.filter(r => r.includes('challenges.cloudflare.com')).length; L.token = L.responses.filter(r => r.includes('/auth/v1/token')); delete L.responses; record('portal.jsonl', L); return L; }
const land = async (page) => { await page.waitForURL(u => !u.pathname.startsWith('/portal/login'), { timeout: 20000 }); await settle(page, true); await page.waitForTimeout(1000); };
if (!only || only === 'main') {
for (const w of [1280, 360]) await leg(`E-40-admin-${w}`, { width: w }, async (page, L) => {
  await signIn(page, 'admin@local.test', { twoStep: true }); L.sawVerify = true; await land(page);
  L.url = new URL(page.url()).pathname; L.h1 = await page.locator('h1').allInnerTexts();
  await page.reload(); await settle(page, true); await page.waitForTimeout(1000); L.urlAfter = new URL(page.url()).pathname; L.h1After = await page.locator('h1').allInnerTexts(); });
for (const who of ['student', 'parent']) for (const scheme of ['light', 'dark']) for (const w of [360, 1280]) await leg(`E-41-${who}-${w}-${scheme}`, { width: w, scheme }, async (page, L) => {
  await signIn(page, `${who}@local.test`); await land(page);
  L.url = new URL(page.url()).pathname; L.h1 = await page.locator('h1').allInnerTexts();
  L.theme = await page.evaluate(() => document.documentElement.dataset.portalTheme); L.images = await page.evaluate(() => [...document.images].map(i => i.complete && i.naturalWidth > 0));
  await page.reload(); await settle(page, true); await page.waitForTimeout(1000); L.urlAfter = new URL(page.url()).pathname; L.h1After = await page.locator('h1').allInnerTexts(); });
await leg('E-42-tutor', {}, async (page, L) => { await signIn(page, 'tutor@local.test'); await land(page); L.url = new URL(page.url()).pathname; L.h1 = await page.locator('h1').allInnerTexts(); });
await leg('E-42-newadmin', {}, async (page, L) => { await signIn(page, 'newadmin@local.test'); await land(page); await page.locator('img').nth(1).waitFor({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1000); L.url = new URL(page.url()).pathname;
  L.imgs = await page.evaluate(() => [...document.images].map(i => ({ scheme: i.src.split(':')[0], ok: i.complete && i.naturalWidth > 0, alt: i.alt }))); });
await leg('E-43-inactive', {}, async (page, L) => { await signIn(page, 'inactive@local.test'); await page.waitForTimeout(3000); L.url = new URL(page.url()).pathname;
  L.alert = await page.locator('[role="alert"]').allInnerTexts(); L.tokenKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => /auth-token/.test(k)).length); });
}
if (only === 'avatar') {
  const tut = process.argv[3];
  await leg('E-44-admin-staff', {}, async (page, L) => { await signIn(page, 'admin@local.test', { twoStep: true }); await land(page); await page.goto(P + '/portal/admin/staff/' + tut); await settle(page, true); await page.waitForTimeout(1500);
    L.av = await page.evaluate(() => [...document.images].filter(i => i.src.includes('/storage/v1/object/public/avatars/')).map(i => ({ src: i.src.slice(0, 70), ok: i.complete && i.naturalWidth > 0 }))); });
  await leg('E-44-tutor-profile', {}, async (page, L) => { await signIn(page, 'tutor@local.test'); await land(page); await page.goto(P + '/portal/profile'); await settle(page, true); await page.waitForTimeout(1500);
    L.av = await page.evaluate(() => [...document.images].filter(i => i.src.includes('/storage/v1/object/public/avatars/')).map(i => ({ src: i.src.slice(0, 70), ok: i.complete && i.naturalWidth > 0 }))); });
}
if (only === 'qr') {
  await leg('E-42-newadmin-qr', {}, async (page, L) => { await signIn(page, 'newadmin@local.test'); await land(page); L.url = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.locator('img[alt]').nth(1).waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1000);
    L.imgs = await page.evaluate(() => [...document.images].map(i => ({ scheme: i.src.split(':')[0], ok: i.complete && i.naturalWidth > 0, alt: i.alt }))); });
}
if (only === 'k1') {
  await leg('E-45-k1', {}, async (page, L) => { await signIn(page, 'tutor@local.test'); await land(page); await page.goto(P + '/portal/profile'); await settle(page, true);
    await page.locator('input[type="file"]').setInputFiles(process.env.SCR + '/red.png'); await page.waitForTimeout(1500);
    L.preview = await page.evaluate(() => [...document.images].filter(i => i.alt.startsWith('Preview')).map(i => ({ scheme: i.src.split(':')[0], ok: i.complete && i.naturalWidth > 0, alt: i.alt }))); });
}
await browser.close();
