import {WEEKDAYS,dailyJoins,calendar,rhythm,race,dotColumns,mosaic,progressStep} from './lenses.mjs';
import {localJoinDate,hourLabel} from './join-times.mjs';
import {geographyCode,geographyName} from './geography.mjs';
const $=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US'),pct=v=>Math.round(v*100)+'%';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const dateLabel=(date,year=false)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:year?undefined:'short',month:'short',day:'numeric',year:year?'numeric':undefined,timeZone:'UTC'});
const plural=(n,word)=>`${fmt(n)} ${word}${n===1?'':'s'}`;
const fit=(text,width,size=10)=>{const max=Math.floor(width/(size*.58));return text.length<=max?text:max>3?text.slice(0,max-1)+'…':'';};
const scale=(labels,note='')=>`<span>Fewer</span>${[0,1,2,3,4].map(s=>`<i class="lens-swatch s${s}"></i>`).join('')}<span>More</span>${note?`<small>${note}</small>`:''}`;
const table=(head,rows)=>`<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

function calendarLens(chapters,history,at){
 const days=dailyJoins(history);if(!days.length)return null;
 const end=localJoinDate(at),c=calendar(days,end),pitch=16,left=30,top=20,today=c.cells.at(-1);
 const cells=c.cells.map(d=>`<rect class="lens-cell s${d.step}${d===today?' today':''}" x="${left+d.col*pitch}" y="${top+d.row*pitch}" width="13" height="13" rx="3" data-tip="${esc(`${dateLabel(d.date,true)} · ${plural(d.count,'join')}${d===today?' · today so far':''}`)}"/>`).join('');
 const months=c.months.map(m=>`<text class="lens-axis" x="${left+m.col*pitch}" y="12">${m.label}</text>`).join('');
 const days3=[1,3,5].map(r=>`<text class="lens-axis" x="0" y="${top+r*pitch+10}">${WEEKDAYS[r]}</text>`).join('');
 const change=c.change===null?'No joins the week before':`${c.change>=0?'+':''}${pct(c.change)} vs the 7 days before`;
 return {
  caption:'Every square is one Eastern-time day of member joins over the last year. Darker squares are busier days; the outlined square is today, still in progress.',
  stats:[['Current streak',plural(c.streak,'day'),`Longest run of joining days: ${plural(c.longest,'day')}`],['Best day',c.best.date?fmt(c.best.count):'—',c.best.date?dateLabel(c.best.date,true):'No joins yet'],['Last 7 days',fmt(c.last7),change]],
  plot:`<svg class="lens-svg" viewBox="0 0 ${left+c.weeks*pitch} ${top+7*pitch}" style="min-width:${(left+c.weeks*pitch)*.82}px" role="img" aria-label="Calendar of member joins per day, ${fmt(c.total)} joins over ${plural(c.activeDays,'active day')}">${months}${days3}${cells}</svg>`,
  legend:scale()+`<small>Steps split the year's non-zero days into quarters</small>`,
  table:table(['Day','Joins'],c.cells.filter(d=>d.count).reverse().map(d=>[dateLabel(d.date,true),fmt(d.count)]))
 };
}

function rhythmLens(chapters,history){
 const r=rhythm(history?.timeOfDay);if(!r.total)return null;
 const pitch=28,left=40,top=22,max=r.peak.count;
 const dots=r.grid.flatMap((hours,day)=>hours.map((count,hour)=>{const radius=count?2.5+10*Math.sqrt(count/max):1.5;return `<circle class="lens-dot s${r.steps[day][hour]}" cx="${left+hour*pitch+pitch/2}" cy="${top+day*pitch+pitch/2}" r="${radius.toFixed(1)}" data-tip="${esc(`${WEEKDAYS[day]} ${hourLabel(hour)} ET · ${plural(count,'join')} · ${r.total?(count/r.total*100).toFixed(1):0}% of all`)}"/>`;})).join('');
 const hours=Array.from({length:8},(_,i)=>`<text class="lens-axis" x="${left+i*3*pitch+pitch/2}" y="12" text-anchor="middle">${hourLabel(i*3).replace(' ','').toLowerCase()}</text>`).join('');
 const days=WEEKDAYS.map((d,i)=>`<text class="lens-axis" x="0" y="${top+i*pitch+pitch/2+3}">${d}</text>`).join('');
 const totals=r.byDay.map(d=>`<text class="lens-axis lens-total" x="${left+24*pitch+8}" y="${top+d.day*pitch+pitch/2+3}">${fmt(d.count)}</text>`).join('');
 return {
  caption:'Each dot is one weekday and Eastern-time hour, summed across every day of member history. Bigger, darker dots mean more people joined in that slot.',
  stats:[['Hottest slot',`${WEEKDAYS[r.peak.day]} ${hourLabel(r.peak.hour)}`,`${plural(r.peak.count,'join')} · ${(r.peak.count/r.total*100).toFixed(1)}% of all joins`],['Busiest weekday',WEEKDAYS[r.busiest.day],`${pct(r.busiest.count/r.total)} of joins across ${plural(r.busiest.dates,'day')}`],['Weekend share',pct(r.weekendShare),`Two of seven days would be ${pct(2/7)}`]],
  plot:`<svg class="lens-svg" viewBox="0 0 ${left+24*pitch+48} ${top+7*pitch}" style="min-width:640px" role="img" aria-label="Member joins by weekday and hour">${hours}${days}${totals}${dots}</svg>`,
  legend:scale()+'<small>Dot size and shade both show joins · right column is each weekday’s total</small>',
  table:table(['Weekday','Joins','Busiest hour (ET)'],r.byDay.map(d=>{const h=r.grid[d.day].indexOf(Math.max(...r.grid[d.day]));return [WEEKDAYS[d.day],fmt(d.count),d.count?hourLabel(h):'—'];}))
 };
}

function raceLens(chapters){
 if(!chapters.length)return null;
 const r=race(chapters),bins=50,width=1000,pad=34,pitch=16,col=(width-2*pad)/bins,{dots,overflow,starting,height:rows}=dotColumns(r.rows,{bins}),base=34+rows*pitch,height=base+30;
 const x=p=>pad+Math.min(p,1.25)/1.25*(width-2*pad),cx=bin=>pad+(bin+.5)*col;
 const ticks=[0,.25,.5,.75,1,1.25].map(p=>`<line class="lens-grid" x1="${x(p)}" x2="${x(p)}" y1="18" y2="${base}"/><text class="lens-axis" x="${x(p)}" y="${height-6}" text-anchor="middle">${p===1.25?'125%+':pct(p)}</text>`).join('');
 const state=d=>d.progress>=1?'ready':d.progress>=.625?'near':'building';
 const marks=dots.map(d=>`<circle class="lens-runner ${state(d)}" cx="${cx(d.bin).toFixed(1)}" cy="${base-pitch/2-d.stack*pitch}" r="6.5" data-id="${esc(d.id)}" data-tip="${esc(`${d.name} · ${d.school}\n${fmt(d.joined)} of ${fmt(d.goal)} goal (${pct(d.progress)})${d.remaining?` · ${fmt(d.remaining)} to go`:' · goal reached'}`)}"/>`).join('');
 const more=overflow.map(o=>`<text class="lens-axis lens-total" x="${cx(o.bin)}" y="${base-rows*pitch-6}" text-anchor="middle">+${o.count}</text>`).join('');
 return {
  caption:'Every dot is a chapter with at least one member, placed by members joined against its goal (80% of its active roster, rounded up). Columns are 2.5% wide. Click a chapter to inspect it above.',
  stats:[['Past the goal',`${fmt(r.crossed)} / ${fmt(r.rows.length)}`,`${pct(r.crossed/r.rows.length)} of chapters have reached 80%`],['Closest to the line',r.closest?r.closest.name:'—',r.closest?`${r.closest.school} · ${plural(r.closest.remaining,'member')} to go`:'Every chapter is past its goal'],['Starting line',fmt(starting),`${starting===1?'chapter has':'chapters have'} no members yet and ${starting===1?'is':'are'} not drawn`]],
  plot:`<svg class="lens-svg" viewBox="0 0 ${width} ${height}" style="min-width:680px" role="img" aria-label="Chapters by progress toward their member goal">${ticks}<line class="lens-goal" x1="${x(1)}" x2="${x(1)}" y1="14" y2="${base}"/><text class="lens-goal-label" x="${x(1)+6}" y="16">GOAL</text><line class="lens-grid" x1="${pad}" x2="${width-pad}" y1="${base}" y2="${base}"/>${marks}${more}</svg>`,
  legend:'<span class="lens-key"><i class="lens-runner-key building"></i>Under 62.5% of goal</span><span class="lens-key"><i class="lens-runner-key near"></i>62.5–99%</span><span class="lens-key"><i class="lens-runner-key ready"></i>Goal reached</span><small>+N marks a column taller than the chart · past 125% sits on the right edge</small>',
  table:table(['Chapter','School','Joined','Goal','Progress','To go'],r.rows.map(d=>[d.name,d.school,fmt(d.joined),fmt(d.goal),pct(d.progress),fmt(d.remaining)]))
 };
}

function mosaicLens(chapters){
 const width=1000,height=540,m=mosaic(chapters,geographyCode,width,height);if(!m.regions.length)return null;
 const total=m.regions.reduce((s,r)=>s+r.value,0),tiles=m.regions.flatMap(r=>r.tiles),biggest=tiles.reduce((b,t)=>t.value>b.value?t:b,tiles[0]),top=m.regions.reduce((b,r)=>r.value>b.value?r:b,m.regions[0]);
 const tileSvg=tiles.map(t=>{const label=t.w>58&&t.h>24?fit(t.name,t.w-12):'',count=t.w>58&&t.h>40?fmt(t.value):'';
  return `<g data-id="${esc(t.id)}" data-tip="${esc(`${t.name} · ${t.school}\n${plural(t.value,'member')} · ${pct(t.progress)} of goal`)}"><rect class="lens-tile s${progressStep(t.progress)}" x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" width="${Math.max(0,t.w).toFixed(1)}" height="${Math.max(0,t.h).toFixed(1)}" rx="3"/>${label?`<text class="lens-tile-label" x="${(t.x+6).toFixed(1)}" y="${(t.y+15).toFixed(1)}">${esc(label)}</text>`:''}${count?`<text class="lens-tile-count" x="${(t.x+6).toFixed(1)}" y="${(t.y+29).toFixed(1)}">${count}</text>`:''}</g>`;}).join('');
 const regionSvg=m.regions.map(r=>{const name=r.code==='unknown'?'Unconfirmed':r.code,label=r.w>40&&r.h>35?fit(`${name} · ${fmt(r.value)}`,r.w-8,9):'';return `<rect class="lens-region" x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}"/>${label?`<text class="lens-region-label" x="${(r.x+5).toFixed(1)}" y="${(r.y+11).toFixed(1)}">${esc(label)}</text>`:''}`;}).join('');
 const states=m.regions.filter(r=>r.code!=='unknown'&&r.code!=='ON').length;
 return {
  caption:`Area is members joined: each block is a state, each tile a chapter inside it. Shade shows how close that chapter is to its goal.${m.empty?` ${plural(m.empty,'chapter')} with no members yet ${m.empty===1?'has':'have'} no area.`:''}`,
  stats:[['Biggest state',top.code==='unknown'?'Unconfirmed':geographyName(top.code),`${plural(top.value,'member')} · ${pct(top.value/total)} of all`],['Biggest chapter',biggest.name,`${biggest.school} · ${plural(biggest.value,'member')}`],['States with members',fmt(states),`${plural(tiles.length,'chapter')} with at least one member`]],
  plot:`<svg class="lens-svg" viewBox="0 0 ${width} ${height}" style="min-width:680px" role="img" aria-label="Members by state and chapter">${tileSvg}${regionSvg}</svg>`,
  legend:'<span>0%</span>'+[0,1,2,3,4].map(s=>`<i class="lens-swatch s${s}"></i>`).join('')+'<span>Goal reached</span><small>Shade steps: under 25%, 25%, 50%, 75%, goal reached</small>',
  table:table(['State','Members','Chapters','Largest chapter'],m.regions.map(r=>{const big=r.tiles.reduce((b,t)=>t.value>b.value?t:b,r.tiles[0]);return [r.code==='unknown'?'Location unconfirmed':geographyName(r.code),fmt(r.value),fmt(r.tiles.length),big?`${big.name} (${fmt(big.value)})`:'—'];}))
 };
}

const LENSES={calendar:calendarLens,rhythm:rhythmLens,race:raceLens,mosaic:mosaicLens};
export function createLenses({onSelect}){
 let chapters=[],history=null,at=null,key=null,lens='calendar';
 try{const saved=localStorage.getItem('fomo:pulse:lens');if(LENSES[saved])lens=saved;}catch{}
 const plot=$('lens-plot'),tip=$('lens-tip');
 function render(){
  if(!at)return;
  document.querySelectorAll('[data-lens]').forEach(b=>{b.classList.toggle('active',b.dataset.lens===lens);b.setAttribute('aria-selected',String(b.dataset.lens===lens));});
  const view=LENSES[lens](chapters,history,at);tip.hidden=true;
  $('lens-content').hidden=!view;$('lens-empty').hidden=!!view;
  if(!view){$('lens-empty').textContent=lens==='calendar'||lens==='rhythm'?'Member join history is temporarily unavailable. The other lenses still use live chapter totals.':'Waiting for chapter totals.';return;}
  $('lens-caption').textContent=view.caption;
  $('lens-stats').replaceChildren(...view.stats.map(([label,value,note])=>{const card=document.createElement('div'),l=document.createElement('span'),v=document.createElement('strong'),n=document.createElement('small');card.className='lens-stat';l.textContent=label;v.textContent=value;n.textContent=note;card.append(l,v,n);return card;}));
  plot.innerHTML=view.plot;$('lens-legend').innerHTML=view.legend;$('lens-table').innerHTML=view.table;
  // On narrow screens the calendar scrolls; open it on the most recent weeks.
  plot.scrollLeft=lens==='calendar'?plot.scrollWidth:0;
  $('lens-detail').textContent=lens==='race'||lens==='mosaic'?'Hover for exact counts · click a chapter to open it in the inspector.':'Hover any mark for its exact count.';
 }
 const mark=e=>e.target.closest?.('[data-tip]');
 plot.addEventListener('pointermove',e=>{const m=mark(e);if(!m){tip.hidden=true;return;}tip.textContent=m.dataset.tip;tip.hidden=false;const box=$('lens-stage').getBoundingClientRect(),w=tip.offsetWidth;tip.style.left=Math.min(box.width-w-4,Math.max(4,e.clientX-box.left-w/2))+'px';tip.style.top=Math.max(4,e.clientY-box.top-tip.offsetHeight-14)+'px';});
 plot.addEventListener('pointerleave',()=>tip.hidden=true);
 plot.addEventListener('click',e=>{const m=mark(e);if(!m)return;$('lens-detail').textContent=m.dataset.tip.replace('\n',' · ');const id=m.closest('[data-id]')?.dataset.id;if(id)onSelect(id);});
 document.querySelectorAll('[data-lens]').forEach(b=>b.onclick=()=>{lens=b.dataset.lens;try{localStorage.setItem('fomo:pulse:lens',lens);}catch{}render();});
 $('lens-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const tabs=[...document.querySelectorAll('[data-lens]')],i=tabs.findIndex(t=>t.dataset.lens===lens),next=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.focus();next.click();});
 return {update(snapshot){
  // Re-render only when counts change, so an open tooltip survives quiet polls.
  const next=JSON.stringify([snapshot.chapters,snapshot.memberHistory]);if(next===key&&at?.slice(0,10)===snapshot.updatedAt.slice(0,10))return;
  key=next;chapters=snapshot.chapters;history=snapshot.memberHistory||null;at=snapshot.updatedAt;render();
 }};
}
