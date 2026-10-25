import { readFileSync } from 'node:fs';
const [file, mode] = process.argv.slice(2); // mode: none | post
const legs = readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
const SITEMAP0 = p => !['/subscribed', '/nope'].includes(p);
const LD = p => p === '/' || p.startsWith('/programmes/') || p === '/resources/victorian-selective-entry-exam';
const PUB = process.env.PUB_LOCAL;
const fails = []; const f = (l, m) => fails.push(`${l.name}: ${m}`);
const byKey = {};
for (const l of legs) {
  const is404 = l.path === '/nope';
  const ce = l.consoleErrors.filter(c => !(is404 && c.text === 'Failed to load resource: the server responded with a status of 404 (Not Found)' && c.url.endsWith('/nope')));
  if (is404 && l.consoleErrors.length - ce.length !== 1) f(l, 'C1 count ' + (l.consoleErrors.length - ce.length));
  if (ce.length) f(l, 'console ' + JSON.stringify(ce));
  if (l.pageErrors.length) f(l, 'pageerror ' + JSON.stringify(l.pageErrors));
  if (l.violations.length) f(l, 'violations ' + JSON.stringify(l.violations));
  if (l.hosted) f(l, 'hosted ' + l.hosted);
  if (l.unexpected.length) f(l, 'unexpected ' + [...new Set(l.unexpected)]);
  if (l.status !== (is404 ? 404 : 200)) f(l, 'status ' + l.status);
  if (l.hydrationTimeout) f(l, 'hydration');
  if (l.h1.length !== 1) f(l, 'h1 ' + l.h1.length);
  if (l.robots !== (SITEMAP0(l.path) ? 0 : 1)) f(l, 'robots ' + l.robots);
  if (l.overflow !== 0) f(l, 'overflow ' + l.overflow);
  if (!l.images.every(Boolean)) f(l, 'images ' + JSON.stringify(l.images));
  const doc = l.docCsp.filter(d => d.url.startsWith('http://127.0.0.1:4173'));
  if (doc.length !== 1 || doc[0].csp.length !== 1 || doc[0].csp[0] !== PUB) f(l, 'docCsp ' + JSON.stringify(doc.map(d => d.csp.length)));
  if (l.colors.body.bg !== 'rgb(255, 255, 255)') f(l, 'bg ' + l.colors.body.bg);
  if (l.marker || l.title.startsWith('[')) f(l, 'marker');
  if (l.width === 360 && !(l.menu?.opened.exp === 'true' && l.menu.opened.visible && l.menu.closedExp === 'false')) f(l, 'menu ' + JSON.stringify(l.menu));
  const wantNews = mode === 'post' ? 1 : 0;
  if (l.newsHeader !== wantNews || l.newsFooter !== wantNews) f(l, `news ${l.newsHeader}/${l.newsFooter}`);
  if (l.newsChecks.length !== 1 || l.newsChecks[0].status !== 200) f(l, 'newsCheck ' + JSON.stringify(l.newsChecks));
  else { const rows = JSON.parse(l.newsChecks[0].body).length; if (rows !== wantNews) f(l, 'newsCheck rows ' + rows); }
  if (l.ld.length !== (LD(l.path) ? 1 : 0) || !l.ld.every(x => x.ok)) f(l, 'ld ' + JSON.stringify(l.ld));
  if (l.path === '/posts') {
    if (mode === 'none' && !(l.postsText.includes('There are no news posts at the moment.') && !l.postsText.includes("couldn't load") && l.postItems === 0)) f(l, 'posts empty ' + l.postsText);
    if (mode === 'post' && !(l.postItems === 1 && l.postH2[0] === `e2e-item5 <img src=x onerror="document.title='xss'">` && l.title === 'Latest News | AJ Classes' && l.imgX === 0 && l.dialogs === 0)) f(l, 'posts list ' + JSON.stringify({ i: l.postItems, h2: l.postH2, t: l.title, x: l.imgX }));
  }
  const S = `Almost done! We've sent a confirmation link to csp-sweep@example.test. Please check your inbox, and your spam folder if it's not there.`;
  if (!(l.subscribe?.status?.[0] === S && l.subscribe.kit.length === 1 && l.subscribe.kit[0].url === 'https://app.convertkit.com/forms/0000000/subscriptions' && l.subscribe.kit[0].method === 'POST')) f(l, 'subscribe ' + JSON.stringify(l.subscribe));
  if (l.path === '/') {
    const e = l.enquiry; const ok = e && e.w3f.length === 1 && e.w3f[0].url === 'https://api.web3forms.com/submit' && e.w3f[0].key === 'local-placeholder' && e.leads.length === 1 && e.leads[0] === 'http://127.0.0.1:55321/functions/v1/leads' && e.status.join(' ').includes('Message sent') && e.status.join(' ').includes("Thank you! We've received your details and will be in touch within 3 business days.");
    if (!ok) f(l, 'enquiry ' + JSON.stringify(e));
  }
  if (l.insights.length !== 1 || !l.insights[0].startsWith('200 GET http://127.0.0.1:4173/_vercel/insights/script.js')) f(l, 'insights ' + JSON.stringify(l.insights));
  byKey[`${l.path}|${l.width}|${l.scheme}`] = l;
}
for (const l of legs.filter(x => x.scheme === 'dark')) { const li = byKey[`${l.path}|${l.width}|light`]; if (JSON.stringify(li?.colors) !== JSON.stringify(l.colors)) f(l, 'dark colors differ ' + JSON.stringify([li?.colors, l.colors])); }
console.log(`legs ${legs.length}; menu legs ${legs.filter(l => l.menu).length}; fails ${fails.length}`);
console.log(fails.slice(0, 40).join('\n'));
const sum = k => legs.reduce((a, l) => a + (typeof k === 'function' ? k(l) : l[k]), 0);
console.log(JSON.stringify({ console: sum(l => l.consoleErrors.length), violations: sum(l => l.violations.length), hosted: sum('hosted'), kit: sum(l => l.subscribe.kit?.length ?? 0), w3f: sum(l => l.enquiry?.w3f.length ?? 0), leads: sum(l => l.enquiry?.leads.length ?? 0), ldTypes: [...new Set(legs.flatMap(l => l.ld.map(x => JSON.stringify(x.type))))] }));
