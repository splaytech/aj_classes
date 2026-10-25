import { chromium } from './lib.mjs';
const b = await chromium.launch({ channel: 'chrome', headless: true }); const page = await b.newPage();
await page.goto('http://127.0.0.1:4177/'); await page.waitForTimeout(1500);
const c = page.frames().find(f => f !== page.mainFrame());
console.log(c.url(), JSON.stringify(await c.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.innerText.slice(0, 80)), title: document.title, hasSiteHeader: !!document.querySelector('header button[aria-controls]') }))));
await b.close();
