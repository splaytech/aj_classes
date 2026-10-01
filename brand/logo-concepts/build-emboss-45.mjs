import fs from 'fs';
const B='#2563EB',Y='#F9C62B',N='#172554',W='#FFFFFF';
// Two all-yellow palettes: a light tile with brighter, deeper arrows embossed on it.
const palettes={
  lemon:{tile:["#FFFBE0","#FFF2B0","#FFE47A"],edge:"#F3D35C",face:["#FFE54D","#FFC800","#F2A900"],fold:["#F5B600","#D98F00"],shadow:"#A86A00"},
  golden:{tile:["#FFF0A8","#FFE070","#FFCF3A"],edge:"#EDBA2A",face:["#FFF27A","#FFC61A","#EB9A00"],fold:["#F0A400","#C47600"],shadow:"#8A5200"}
};
const defs=(p,c)=>`<defs>
<linearGradient id="${p}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.tile[0]}"/><stop offset=".55" stop-color="${c.tile[1]}"/><stop offset="1" stop-color="${c.tile[2]}"/></linearGradient>
<radialGradient id="${p}g" cx=".28" cy=".18" r=".75"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.face[0]}"/><stop offset=".5" stop-color="${c.face[1]}"/><stop offset="1" stop-color="${c.face[2]}"/></linearGradient>
<linearGradient id="${p}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.fold[0]}"/><stop offset="1" stop-color="${c.fold[1]}"/></linearGradient>
<filter id="${p}ts" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${c.shadow}" flood-opacity=".25"/></filter>
<filter id="${p}e" x="-25%" y="-25%" width="150%" height="150%">
 <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
 <feOffset in="blur" dx="3" dy="5" result="down"/><feFlood flood-color="${c.shadow}" flood-opacity=".5"/><feComposite in2="down" operator="in" result="shade"/>
 <feOffset in="blur" dx="-2.5" dy="-2.5" result="up"/><feFlood flood-color="#FFFFFF" flood-opacity=".9"/><feComposite in2="up" operator="in" result="light"/>
 <feMerge><feMergeNode in="shade"/><feMergeNode in="light"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>`;
const tile=(p,c)=>`<rect x="8" y="6" width="184" height="184" rx="42" fill="url(#${p}t)" stroke="${c.edge}" stroke-width="1.5" filter="url(#${p}ts)"/><rect x="8" y="6" width="184" height="184" rx="42" fill="url(#${p}g)"/>`;
// Shaft with a centre fold: bright face on the left, shaded face on the right.
const bar=(p,i,x,y,w,h)=>`<clipPath id="${p}c${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}"/></clipPath><g clip-path="url(#${p}c${i})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}y)"/><rect x="${x+w/2}" y="${y}" width="${w/2}" height="${h}" fill="url(#${p}d)"/></g>`;
// Arrowhead split into a light and a dark facet.
const head=(p,x,top,base,hw)=>`<path d="M${x-hw} ${base} L${x} ${top} L${x} ${base} Z" fill="url(#${p}y)"/><path d="M${x} ${top} L${x+hw} ${base} L${x} ${base} Z" fill="url(#${p}d)"/>`;
const arrowsMark=(p,c)=>defs(p,c)+tile(p,c)+`<g filter="url(#${p}e)"><g transform="rotate(45 100 100) translate(100 100) scale(.92) translate(-100 -100)">`+[52,100,148].map((x,i)=>bar(p,i,x-8,58,16,102)+head(p,x,32,70,21)).join("")+`</g></g>`;
const marks={
"yellow-emboss-lemon-45":["Embossed arrows · 45° · lemon","A pale lemon tile with bright yellow arrows rising at 45°, raised off it: a warm shadow below-right and a white highlight above-left make them look pressed out of the tile.",arrowsMark("m",palettes.lemon)],
"yellow-emboss-golden-45":["Embossed arrows · 45° · golden","A warmer golden tile with deeper, more saturated arrows rising at 45°. Stronger contrast and a richer, honey-gold feel, with the same embossed light and shadow.",arrowsMark("n",palettes.golden)]};
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
fs.writeFileSync('overview-emboss-45.html',`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EDF0F5;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;color:#172033}
.wrap{padding:56px}h1{margin:0 0 8px;font-size:40px;color:${N}}.sub{margin:0 0 36px;color:#585E6C;font-size:17px;max-width:1100px;line-height:1.5}
.grid{display:flex;gap:32px}.card{width:420px;background:#fff;border-radius:22px;overflow:hidden}
.hero{display:flex;justify-content:center;padding:44px 0;background:#F5F9FF}.info{padding:24px 30px 24px}h2{margin:0 0 6px;font-size:22px;color:${N}}
.info p{margin:0;color:#585E6C;font-size:15px;line-height:1.55;min-height:124px}
.lock,.lock2{display:flex;align-items:center;gap:14px;font-size:30px;color:${N}}.lock{padding:22px 30px;border-top:1px solid #D9E2F1}
.lock b,.lock2 b{font-weight:800}.lock span,.lock2 span{font-weight:500}
.dark{background:${N};padding:22px 30px;display:flex;justify-content:space-between;align-items:center}.lock2{color:#fff}
.favs{display:flex;gap:10px;align-items:center}.fav{background:#fff;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="wrap"><h1>AJ Classes — logo concepts: All-yellow embossed · 45°</h1>
<p class="sub">Inspired by the three lines and the third eye on Shiva's forehead: three lines for knowledge, practice and guidance, as three arrows rising at 45° in bright yellow, embossed on a lighter yellow tile, with everything in yellow gradients. Yellow gradients only, from pale lemon #FFFBE0 to deep amber #C47600. Each card shows the logo on white, on navy, and at favicon sizes (48 / 32 / 16 px).</p>
<div class="grid">${cards}</div></div></body></html>`);
