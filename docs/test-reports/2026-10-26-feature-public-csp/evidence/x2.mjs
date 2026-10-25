import { chromium, PASSWORD } from './lib.mjs';
const mode = process.argv[2]; const D = 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage(); page.on('dialog', d => d.accept());
await page.goto(D + '/portal/login'); await page.waitForLoadState('load');
await page.locator('#login-email').fill('tutor@local.test'); await page.locator('#login-password').fill(PASSWORD);
await page.waitForFunction(() => document.querySelector('input[name="cf-turnstile-response"]')?.value, null, { timeout: 30000 });
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL(u => !u.pathname.startsWith('/portal/login'), { timeout: 30000 });
await page.goto(D + '/portal/profile'); await page.waitForLoadState('load'); await page.waitForTimeout(1500);
if (mode === 'add') { await page.locator('input[type="file"]').setInputFiles(process.env.SCR + '/red.png'); await page.getByRole('button', { name: 'Use this photo' }).click(); }
else { await page.getByRole('button', { name: 'Remove photo' }).click(); }
await page.waitForTimeout(3000);
console.log(mode, (await page.locator('main').innerText()).match(/Photo (saved|removed)[^\n]*/)?.[0]);
await browser.close();
