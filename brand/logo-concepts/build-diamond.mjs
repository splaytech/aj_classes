import fs from 'fs';
const B='#2563EB',Y='#F9C62B',N='#172554',W='#FFFFFF';
const tile=`<rect x="22" y="22" width="156" height="156" rx="30" fill="${B}" transform="rotate(45 100 100)"/>`;
const plain=[60,100,140].map(x=>`<rect x="${x-9}" y="54" width="18" height="92" rx="9" fill="${Y}"/>`).join("");
const arrow=[56,100,144].map(x=>`<line x1="${x}" y1="80" x2="${x}" y2="140" stroke="${Y}" stroke-width="14" stroke-linecap="round"/><path d="M${x-16} 82 L${x} 56 L${x+16} 82 Z" fill="${Y}" stroke="${Y}" stroke-width="6" stroke-linejoin="round"/>`).join("");
const marks={
"diamond-lines":["Diamond · lines","A brand-blue tile turned 45° into a diamond, with three upright golden lines. Stable, distinctive and easy to spot.",tile+plain],
"diamond-arrows":["Diamond · arrows","The same blue diamond with three upright golden arrows: upward progress inside a strong, unique shape.",tile+arrow]};
const svg=(b,s)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${s?` width="${s}" height="${s}"`:''}>${b}</svg>`;
let cards='';
for(const [k,[n,d,b]] of Object.entries(marks)){
  fs.writeFileSync(`${k}.svg`,svg(b));
  fs.writeFileSync(`_${k}-1024.html`,`<html><body style="margin:0;background:transparent">${svg(b,1024)}</body></html>`);
  const fav=[48,32,16].map(s=>`${svg(b,s)}`).join('');
  cards+=`<div class="card"><div class="hero">${svg(b,220)}</div><div class="info"><h2>${n}</h2><p>${d}</p></div>
<div class="lock">${svg(b,52)}<span><b>AJ</b> Classes</span></div>
<div class="dark"><div class="lock2">${svg(b,52)}<span><b>AJ</b> Classes</span></div><div class="favs">${fav}</div></div></div>`;
}
fs.writeFileSync('overview-diamond.html',`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EDF0F5;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;color:#172033}
.wrap{padding:56px}h1{margin:0 0 8px;font-size:40px;color:${N}}.sub{margin:0 0 36px;color:#585E6C;font-size:17px;max-width:1100px;line-height:1.5}
.grid{display:flex;flex-wrap:wrap;gap:32px;max-width:1776px}.card{width:420px;background:#fff;border-radius:22px;overflow:hidden}
.hero{display:flex;justify-content:center;padding:44px 0;background:#F5F9FF}.info{padding:24px 30px 24px}h2{margin:0 0 6px;font-size:22px;color:${N}}
.info p{margin:0;color:#585E6C;font-size:15px;line-height:1.55;min-height:72px}
.lock,.lock2{display:flex;align-items:center;gap:14px;font-size:30px;color:${N}}.lock{padding:22px 30px;border-top:1px solid #D9E2F1}
.lock b,.lock2 b{font-weight:800}.lock span,.lock2 span{font-weight:500}
.dark{background:${N};padding:22px 30px;display:flex;justify-content:space-between;align-items:center}.lock2{color:#fff}
.favs{display:flex;gap:10px;align-items:center}.fav{background:#fff;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="wrap"><h1>AJ Classes — logo concepts: Blue diamond series</h1>
<p class="sub">Inspired by the three lines and the third eye on Shiva's forehead: three lines for knowledge, practice and guidance, set upright inside a brand-blue tile turned 45° into a diamond. Brand palette: blue #2563EB · yellow #F9C62B · navy #172554. Each card shows the logo on white, on navy, and at favicon sizes (48 / 32 / 16 px).</p>
<div class="grid">${cards}</div></div></body></html>`);
