const fmt=(n,d=0)=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ns='http://www.w3.org/2000/svg';
let outline=null;
fetch(new URL('data/us-outline.json',import.meta.url)).then(r=>r.ok?r.json():null).then(d=>{outline=d;document.dispatchEvent(new Event('mapready'));}).catch(()=>{});
function bind(root,open){root.querySelectorAll('[data-campus]').forEach(el=>{el.addEventListener('click',()=>open(el.dataset.campus));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(el.dataset.campus);}});});}
export function renderVisuals(ranked,rollout,labels,open){
 const mean=ranked.reduce((a,s)=>a+(s.overall_score??0),0)/ranked.length;
 document.querySelector('#mean-score').textContent=`Mean ${fmt(mean,1)}`;
 const y=v=>188-(v/100)*158,x=i=>32+i*(568/Math.max(1,ranked.length-1));
 const grid=[0,25,50,75,100].map(v=>`<line x1="27" y1="${y(v)}" x2="607" y2="${y(v)}" class="chart-grid"/><text x="18" y="${y(v)+3}" text-anchor="end" class="axis-label">${v}</text>`).join('');
 const dots=ranked.map((s,i)=>`<g class="chart-campus" role="button" tabindex="0" data-campus="${s.unitid}" aria-label="${esc(s.school)}, score ${fmt(s.overall_score,1)}, coverage ${fmt(s.weighted_completeness_pct)} percent"><title>${esc(s.school)} · Score ${fmt(s.overall_score,1)} · Evidence ${fmt(s.weighted_completeness_pct)}% · Range ${fmt(s.score_lower_bound,1)}–${fmt(s.score_upper_bound,1)}</title><rect x="${x(i)-5}" y="20" width="10" height="174" fill="transparent"/><line x1="${x(i)}" x2="${x(i)}" y1="${y(s.score_upper_bound)}" y2="${y(s.score_lower_bound)}" class="range-stem"/><circle cx="${x(i)}" cy="${y(s.overall_score)}" r="${i<3?4.5:3}" class="score-dot"/><circle cx="${x(i)}" cy="${y(s.score_lower_bound)}" r="1.8" class="floor-dot"/></g>`).join('');
 document.querySelector('#score-chart').innerHTML=`<svg viewBox="0 0 630 210" aria-label="Ranked campus scores and unresolved ranges">${grid}<line x1="27" x2="607" y1="${y(mean)}" y2="${y(mean)}" class="mean-line"/>${dots}</svg>`;
 bind(document.querySelector('#score-chart'),open);
 const chosen=new Set(rollout.campuses.map(s=>s.unitid));
 const px=lon=>22+(lon+125)*6.1,py=lat=>20+(50-lat)*7.2;
 const paths=outline?.rings.map(r=>`<path d="${r.map((p,i)=>`${i?'L':'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join('')}Z" class="land"/>`).join('')||'';
 const mapDots=[...ranked].sort((a,b)=>Number(chosen.has(a.unitid))-Number(chosen.has(b.unitid))).map(s=>`<g role="button" tabindex="0" data-campus="${s.unitid}" class="map-campus ${chosen.has(s.unitid)?'selected-campus':''}" aria-label="${esc(s.school)}, ${chosen.has(s.unitid)?'launch cohort':'other campus'}"><title>${esc(s.school)} · ${esc(s.city)}, ${s.state}${chosen.has(s.unitid)?' · Launch cohort':''}</title><circle cx="${px(s.longitude)}" cy="${py(s.latitude)}" r="7" class="map-halo"/><circle cx="${px(s.longitude)}" cy="${py(s.latitude)}" r="${chosen.has(s.unitid)?3.4:2.4}" class="map-dot"/></g>`).join('');
 document.querySelector('#campus-map').innerHTML=`<svg viewBox="0 0 402 228" aria-label="US campus locations; dark dots mark the launch cohort"><defs><pattern id="map-grid" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#d8d8d8"/></pattern></defs><rect width="402" height="228" fill="url(#map-grid)"/>${paths}${mapDots}<text x="22" y="216" class="map-label">PACIFIC</text><text x="334" y="216" class="map-label">ATLANTIC</text></svg>`;
 bind(document.querySelector('#campus-map'),open);
 document.querySelector('#region-count').textContent=new Set(rollout.campuses.map(s=>s.region)).size;
 document.querySelector('#signal-coverage').innerHTML=Object.entries(labels).map(([key,label])=>{const value=ranked.reduce((sum,s)=>sum+(s.category_scores[key]?.completeness_pct??0),0)/ranked.length;return `<div class="signal"><div><span>${esc(label)}</span><strong>${fmt(value)}<small>%</small></strong></div><div class="signal-track" role="meter" aria-label="${esc(label)} evidence coverage" aria-valuenow="${value.toFixed(1)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div><span class="signal-note">${value===0?'Awaiting data':value>=99.5?'Fully observed':'Partial evidence'}</span></div>`;}).join('');
 document.querySelector('#spark-campuses').innerHTML=ranked.map(s=>`<i style="height:${8+s.weighted_completeness_pct*.27}px"></i>`).join('');
 document.querySelector('#spark-coverage').innerHTML=`<span class="coverage-stripe" style="--fill:${ranked.reduce((a,s)=>a+s.weighted_completeness_pct,0)/ranked.length}%"></span>`;
 document.querySelector('#spark-launch').innerHTML=Array.from({length:20},(_,i)=>`<b class="${i<rollout.selected?'filled':''}"></b>`).join('');
}
