import {mashCalls,CALL_ROWS,CHAPTER_COLS} from './calls-model.mjs';
const $=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US'),pct=n=>`${Math.round(n*1000)/10}%`;
const day=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const OUTCOME={attended:'showed up',waited:'showed up (Arya not in the room)',unknown:'outcome unknown','no-show':'no-show',cancelled:'cancelled'};
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}

export function createCalls({onSelect}){
 let data=null,chapters=null,failed=false;
 fetch('/fomo/pulse/calls.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('calls');return r.json();})
  .then(value=>{data=value;render();}).catch(()=>{failed=true;render();});

 function describe(d){
  const call=`${OUTCOME[d.outcome]||d.outcome} · first call ${day(d.first)}${d.booked>1?` · ${d.booked} bookings`:''}`;
  if(!d.chapter)return `${d.school?d.school+' · ':''}${call} · no matching chapter registered`;
  const c=d.chapter;
  return `${c.name}, ${c.shortSchool} · ${call} · signed ${day(c.registered)}${d.before?' (before the call)':''} · ${fmt(c.joined)}/${fmt(c.active)} members`;
 }
 function dot(d){
  const node=el(d.chapter?'button':'span',`d ${d.col}${d.before?' before':''}`);
  const label=describe(d);node.title=label;node.setAttribute('aria-label',label);
  const show=()=>{$('calls-detail').textContent=label;};
  node.onmouseenter=show;node.onfocus=show;
  if(d.chapter){node.type='button';node.onclick=()=>onSelect(d.chapter.id);}
  return node;
 }
 function render(){
  if(failed){$('calls-summary').textContent='Booking data is unavailable right now.';return;}
  if(!data||!chapters)return;
  const {dots,funnel,matched,comparison}=mashCalls(data,chapters);
  const rate=funnel.booked?funnel.onboardedAfter/funnel.booked:0;
  $('calls-rate').textContent=pct(rate);
  $('calls-rate-note').textContent=`${funnel.onboardedAfter} of ${fmt(funnel.booked)} people who booked`+(funnel.onboarded>funnel.onboardedAfter?` · ${funnel.onboarded-funnel.onboardedAfter} more at 80%+ had signed before their call`:'');
  $('calls-summary').textContent=`${fmt(data.bookings)} Cal.com bookings from ${fmt(funnel.booked)} people, ${day(data.from)} – ${day(data.to)}, matched to ${matched.length} live chapters by school and chapter name. Member counts are live.`;

  const steps=[['Booked a call',funnel.booked],['Showed up',funnel.showed],['Chapter signed',funnel.signed],['Members joining',funnel.joining],['80%+ onboarded',funnel.onboarded]];
  $('calls-funnel').replaceChildren(...steps.map(([label,n],i)=>{
   const tile=el('div','calls-step');const bar=el('i');bar.style.width=pct(funnel.booked?n/funnel.booked:0);
   tile.append(el('span',null,`0${i+1} ${label}`),el('strong',null,fmt(n)),el('small',null,!i?'unique people':`${pct(funnel.booked?n/funnel.booked:0)} of booked`+(i===4?` · ${funnel.onboardedAfter} signed after a call`:'')),bar);return tile;
  }));

  // Rows: what happened on the call. Columns: where their chapter is now.
  const matrix=$('calls-matrix'),cells=[el('span','corner','CALL ↓ / CHAPTER →')];
  for(const [,label] of CHAPTER_COLS)cells.push(el('span','col-label',label));
  for(const [row,rowLabel] of CALL_ROWS){
   const inRow=dots.filter(d=>d.row===row);
   const head=el('span','row-label');head.append(el('b',null,rowLabel),el('small',null,fmt(inRow.length)));cells.push(head);
   for(const [col] of CHAPTER_COLS){
    const list=inRow.filter(d=>d.col===col);const cell=el('div',`cell c-${col}`);
    cell.append(el('em',null,list.length?fmt(list.length):''),...list.map(dot));cells.push(cell);
   }
  }
  matrix.replaceChildren(...cells);

  const {called,uncalled,since}=comparison;
  const metrics=[['Roster participation','participation'],['Chapters with any members','withMembers'],['Chapters at 80%+','onboarded']];
  const block=el('div','calls-compare-grid');
  block.append(el('span','eyebrow',`CHAPTERS SIGNED SINCE ${day(since).toUpperCase()}`),el('span','k',`With an Arya call · ${called.chapters}`),el('span','k muted',`No call · ${uncalled.chapters}`));
  for(const [label,key] of metrics){
   const max=Math.max(called[key],uncalled[key],.0001);
   const bar=(v,cls)=>{const w=el('div',`cmp ${cls}`);const i=el('i');i.style.width=pct(v/max);w.append(i,el('b',null,pct(v)));return w;};
   block.append(el('span','m',label),bar(called[key],'called'),bar(uncalled[key],'uncalled'));
  }
  block.append(el('span','m','Avg members per chapter'),el('b','plain',called.avgJoined.toFixed(1)),el('b','plain muted',uncalled.avgJoined.toFixed(1)));
  $('calls-compare').replaceChildren(block);

  $('calls-rows').replaceChildren(...matched.map(r=>{
   const c=r.chapter,tr=el('tr'),target=Math.ceil(c.active*.8),share=Math.min(1,c.joined/target);
   const name=el('td');const b=el('button','chapter-link',c.name);b.type='button';b.onclick=()=>onSelect(c.id);name.append(b,el('small',null,c.shortSchool));
   const signed=el('td',null,day(c.registered));if(r.before)signed.append(el('small','before-tag','before call'));
   else signed.append(el('small',null,r.days?`+${r.days}d after call`:'same day'));
   const progress=el('td','progress');const track=el('span','track');const fill=el('i');fill.style.width=pct(share);track.append(fill);
   progress.append(track,el('small',null,c.joined>=target?'onboarded':`${fmt(target-c.joined)} to go`));
   tr.append(name,el('td',null,day(r.first)),el('td',null,`${r.booked} · ${r.showed?'showed':'no-show'}`),signed,el('td',null,`${fmt(c.joined)} / ${fmt(c.active)}`),progress);
   if(r.stage==='onboarded')tr.className='onboarded';
   return tr;
  }));
  $('calls-note').textContent=`Matched from the School and Fraternity/Sorority answers on the booking form, so a misspelled or missing answer will not match. One person can point at more than one chapter. “Showed up” includes ${dots.filter(d=>d.outcome==='waited').length} people who joined while Arya’s account never did. Full onboard = 80% of the active roster, the same target used above. No names, emails or call notes are published.`;
 }
 return {update(next){chapters=next;render();}};
}
