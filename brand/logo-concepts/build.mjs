import fs from 'fs';
const B='#2563EB',Y='#F9C62B',N='#172554',W='#FFFFFF';
const marks={
'trinetra':['Trinetra','The three lines of the tilak, turned upright into three golden pillars (knowledge, practice, guidance). An open eye across them stands for insight and focus.',
`<circle cx="100" cy="100" r="92" fill="${N}"/>
<rect x="58" y="40" width="14" height="120" rx="7" fill="${Y}"/>
<rect x="93" y="40" width="14" height="120" rx="7" fill="${Y}"/>
<rect x="128" y="40" width="14" height="120" rx="7" fill="${Y}"/>
<path d="M34 100 Q100 52 166 100 Q100 148 34 100 Z" fill="${N}" stroke="${Y}" stroke-width="9" stroke-linejoin="round"/>
<circle cx="100" cy="100" r="19" fill="${B}"/><circle cx="100" cy="100" r="7" fill="${W}"/>`],
'third-eye':['Third Eye','Three upright blue lines. The middle one opens into a golden third eye, so the student is at the centre with insight between two supports. Works without a background.',
`<rect x="40" y="26" width="20" height="148" rx="10" fill="${B}"/>
<rect x="140" y="26" width="20" height="148" rx="10" fill="${B}"/>
<rect x="90" y="26" width="20" height="30" rx="10" fill="${B}"/>
<rect x="90" y="144" width="20" height="30" rx="10" fill="${B}"/>
<path d="M100 58 Q134 100 100 142 Q66 100 100 58 Z" fill="${Y}"/>
<circle cx="100" cy="100" r="11" fill="${N}"/>`],
'tilak':['Tilak','The original, unrotated form: three horizontal lines with an upright third eye in the centre, on a sun-yellow disc. The most traditional reading.',
`<circle cx="100" cy="100" r="92" fill="${Y}"/>
<rect x="36" y="66" width="128" height="14" rx="7" fill="${N}"/>
<rect x="30" y="93" width="140" height="14" rx="7" fill="${N}"/>
<rect x="36" y="120" width="128" height="14" rx="7" fill="${N}"/>
<path d="M100 48 Q128 100 100 152 Q72 100 100 48 Z" fill="${B}" stroke="${Y}" stroke-width="9" stroke-linejoin="round"/>
<circle cx="100" cy="100" r="9" fill="${Y}"/>`]};
const svg=(b,s)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${s?` width="${s}" height="${s}"`:''}>${b}</svg>`;
let cards='';
for(const [k,[n,d,b]] of Object.entries(marks)){
  fs.writeFileSync(`${k}.svg`,svg(b));
  fs.writeFileSync(`_${k}-1024.html`,`<html><body style="margin:0;background:transparent">${svg(b,1024)}</body></html>`);
  const fav=[48,32,16].map(s=>`<div class="fav" style="width:${s}px;height:${s}px;border-radius:${s/5}px">${svg(b,Math.round(s*.86))}</div>`).join('');
  cards+=`<div class="card"><div class="hero">${svg(b,220)}</div><div class="info"><h2>${n}</h2><p>${d}</p></div>
<div class="lock">${svg(b,52)}<span><b>AJ</b> Classes</span></div>
<div class="dark"><div class="lock2">${svg(b,52)}<span><b>AJ</b> Classes</span></div><div class="favs">${fav}</div></div></div>`;
}
fs.writeFileSync('overview.html',`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EDF0F5;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;color:#172033}
.wrap{padding:56px}h1{margin:0 0 8px;font-size:40px;color:${N}}.sub{margin:0 0 36px;color:#585E6C;font-size:17px;max-width:1100px;line-height:1.5}
.grid{display:flex;gap:32px}.card{width:420px;background:#fff;border-radius:22px;overflow:hidden}
.hero{display:flex;justify-content:center;padding:44px 0}.info{padding:0 30px 24px}h2{margin:0 0 6px;font-size:22px;color:${N}}
.info p{margin:0;color:#585E6C;font-size:15px;line-height:1.55;min-height:100px}
.lock,.lock2{display:flex;align-items:center;gap:14px;font-size:30px;color:${N}}.lock{padding:22px 30px;border-top:1px solid #D9E2F1}
.lock b,.lock2 b{font-weight:800}.lock span,.lock2 span{font-weight:500}
.dark{background:${N};padding:22px 30px;display:flex;justify-content:space-between;align-items:center}.lock2{color:#fff}
.favs{display:flex;gap:10px;align-items:center}.fav{background:#fff;display:flex;align-items:center;justify-content:center}
</style></head><body><div class="wrap"><h1>AJ Classes — logo concepts: Trinetra series</h1>
<p class="sub">Inspired by the three lines and the third eye on Shiva's forehead: three lines for knowledge, practice and guidance, and the third eye for insight and focus. Brand palette: blue #2563EB · yellow #F9C62B · navy #172554. Each card shows the logo on white, on navy, and at favicon sizes (48 / 32 / 16 px).</p>
<div class="grid">${cards}</div></div></body></html>`);
