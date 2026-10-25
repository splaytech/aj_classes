import { chromium, newLeg, settle, record, P } from './lib.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function leg(name, fn, opts = {}) { const { page, L } = await newLeg(browser, { name, ...opts }); try { await fn(page, L); } catch (e) { L.error = String(e).slice(0, 300); } await L.close(); delete L.responses; record('inject.jsonl', L); }
const probe = async (page, fn, arg) => { const v0 = await page.evaluate(() => window.__csp.length); const r = await page.evaluate(fn, arg).catch(e => 'EVALERR ' + e.message); await page.waitForTimeout(1200); return { r, v: await page.evaluate(n => window.__csp.slice(n), v0) }; };
await leg('E-50', async (page, L) => { await page.goto(P + '/'); await settle(page); L.p = await probe(page, () => { const s = document.createElement('script'); s.src = 'https://example.com/x.js'; document.head.append(s); return 'ok'; }); });
await leg('E-51', async (page, L) => { await page.goto(P + '/'); await settle(page); L.p = {};
  const P2 = {
    fetch: () => fetch('https://example.com/data').then(() => 'fetched', e => e.name + ': ' + e.message),
    img: () => { const i = new Image(); i.src = 'https://example.com/b.gif'; document.body.append(i); return 'ok'; },
    beacon: () => String(navigator.sendBeacon('https://example.com/beacon', 'x')),
    ws: () => { const w = new WebSocket('wss://example.com/ws'); w.onerror = () => {}; return 'constructed'; },
    font: () => new FontFace('X', 'url(https://example.com/f.woff2)').load().then(() => 'loaded', e => e.name),
    link: () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://example.com/s.css'; document.head.append(l); return 'ok'; },
    iframe: () => { const f = document.createElement('iframe'); f.src = 'https://example.com/f'; document.body.append(f); return 'ok'; },
    iframeSelf: () => { const f = document.createElement('iframe'); f.src = '/privacy'; document.body.append(f); return 'ok'; },
    object: () => { const o = document.createElement('object'); o.data = 'https://example.com/o.swf'; document.body.append(o); return 'ok'; },
    base: () => { const b = document.createElement('base'); b.href = 'https://example.com/'; document.head.append(b); return document.baseURI; },
    form: () => { const f = document.createElement('form'); f.action = 'https://example.com/post'; f.method = 'post'; document.body.append(f); f.submit(); return 'submitted'; },
  };
  for (const [k, fn] of Object.entries(P2)) L.p[k] = await probe(page, fn);
  L.urlAfter = page.url(); L.baseURI = await page.evaluate(() => document.baseURI); });
await leg('E-52', async (page, L) => { await page.goto(P + '/'); await settle(page);
  await page.evaluate(() => { const s = document.createElement('script'); s.textContent = "setTimeout(function () { try { window.__e = String(eval('1+1')) } catch (e) { window.__e = e.name } try { window.__f = String(new Function('return 2')()) } catch (e) { window.__f = e.name } }, 0)"; document.head.append(s); });
  await page.waitForTimeout(500); L.res = await page.evaluate(() => ({ e: window.__e, f: window.__f })); });
await leg('E-53', async (page, L) => { await page.goto(P + '/'); await settle(page);
  await page.evaluate(() => { const b = document.createElement('button'); b.id = 'csp-x'; b.textContent = 'x'; b.setAttribute('onclick', "document.title='ran'"); document.body.prepend(b); });
  await page.click('#csp-x'); L.title = await page.title();
  await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__inl = 1'; document.head.append(s); }); L.inl = await page.evaluate(() => window.__inl); });
await leg('E-54', async (page, L) => { await page.goto('http://127.0.0.1:4177/'); await page.waitForTimeout(1500);
  L.frames = page.frames().map(f => f.url()); const child = page.frames().find(f => f !== page.mainFrame());
  L.childH1 = child ? await child.evaluate(() => document.querySelectorAll('h1').length).catch(e => 'unreadable: ' + e.message.slice(0, 60)) : 'no child'; }, { extraHosts: ['127.0.0.1:4177'] });
await browser.close();
