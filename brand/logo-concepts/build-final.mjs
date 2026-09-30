import fs from 'fs';
const B='#2563EB',Y='#F9C62B',N='#172554',W='#FFFFFF';
const defs=(p)=>`<defs>
<linearGradient id="${p}y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFEE55"/><stop offset=".5" stop-color="#FFD21F"/><stop offset="1" stop-color="#F5B400"/></linearGradient>
<linearGradient id="${p}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2AE00"/><stop offset="1" stop-color="#D48600"/></linearGradient>
<linearGradient id="${p}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3D82F7"/><stop offset=".55" stop-color="#2563EB"/><stop offset="1" stop-color="#1B4AC4"/></linearGradient>
<radialGradient id="${p}g" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<filter id="${p}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="#0B1A4A" flood-opacity=".5"/></filter>
<filter id="${p}ts" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0B1A4A" flood-opacity=".22"/></filter>
</defs>`;
const tile=(p)=>`<rect x="8" y="6" width="184" height="184" rx="42" fill="url(#${p}t)" filter="url(#${p}ts)"/><rect x="8" y="6" width="184" height="184" rx="42" fill="url(#${p}g)"/>`;
// Bar with a diagonal fold: bright face on the left, shaded face on the right.
const bar=(p,i,x,y,w,h,fold=true)=>`<clipPath id="${p}c${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}"/></clipPath><g clip-path="url(#${p}c${i})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}y)"/><path d="M${x+w*(fold?0.62:0.5)} ${y} H${x+w} V${y+h} H${x+w*(fold?0.38:0.5)} Z" fill="url(#${p}d)"/></g>`;
// Arrowhead split into a light and a dark facet.
const head=(p,x,top,base,hw)=>`<path d="M${x-hw} ${base} L${x} ${top} L${x} ${base} Z" fill="url(#${p}y)"/><path d="M${x} ${top} L${x+hw} ${base} L${x} ${base} Z" fill="url(#${p}d)"/>`;
const linesMark=(p)=>defs(p)+tile(p)+`<g filter="url(#${p}s)"><g transform="rotate(15 100 98)">`+[50,90,130].map((x,i)=>bar(p,i,x,34,20,128)).join("")+`</g></g>`;
const arrowsMark=(p)=>defs(p)+tile(p)+`<g filter="url(#${p}s)">`+[52,100,148].map((x,i)=>bar(p,i,x-8,58,16,102,false)+head(p,x,32,70,21)).join("")+`</g>`;
const marks={
"final-lines-75":["Lines · 75° · shaded","Three golden ribbons leaning forward at 75° on a brand-blue tile. Each ribbon has a bright face and a folded, shaded face, with a soft drop shadow. The same folded-ribbon depth as the CommBank mark.",linesMark("l")],
"final-arrows-90":["Arrows · upward · shaded","Three golden arrows pointing straight up. The shafts are folded ribbons, the heads are split into a light and a dark facet, and a drop shadow lifts them off the tile.",arrowsMark("a")]};
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
fs.writeFileSync('overview-final.html',`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EDF0F5;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;color:#172033}
.wrap{padding:56px}h1{margin:0 0 8px;font-size:40px;color:${N}}.sub{margin:0 0 36px;color:#585E6C;font-size:17px;max-width:1100px;line-height:1.5}
.grid{display:flex;gap:32px}.card{width:420px;background:#fff;border-radius:22px;overflow:hidden}
.hero{display:flex;justify-content:center;padding:44px 0;background:#F5F9FF}.info{padding:24px 30px 24px}h2{margin:0 0 6px;font-size:22px;color:${N}}
.info p{margin:0;color:#585E6C;font-size:15px;line-height:1.55;min-height:124px}
.lock,.lock2{display:flex;align-items:center;gap:14px;font-size:30px;color:${N}}.lock{padding:22px 30px;border-top:1px solid #D9E2F1}
.lock b,.lock2 b{font-weight:800}.lock span,.lock2 span{font-weight:500}
.dark{background:${N};padding:22px 30px;display:flex;justify-content:space-between;align-items:center}.lock2{color:#fff}
.favs{display:flex;gap:10px;align-items:center}.fav{background:#fff;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="wrap"><h1>AJ Classes — logo concepts: Final directions (shaded)</h1>
<p class="sub">Inspired by the three lines and the third eye on Shiva's forehead: three lines for knowledge, practice and guidance, in several shades of bright yellow with folds and drop shadows, on a brand-blue tile. Brand palette: blue #2563EB · yellow #F9C62B · navy #172554. Each card shows the logo on white, on navy, and at favicon sizes (48 / 32 / 16 px).</p>
<div class="grid">${cards}</div></div></body></html>`);
