import {joinTimeSummary,hourLabel,hourRange} from './join-times.mjs';
const $=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US');
const dateLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export function createJoinTimes(){
 let history=null,at=null,period='all';
 function render(){
  if(!at)return;
  const data=joinTimeSummary(history,at,period),hasData=!!data?.total;
  $('join-times-content').hidden=!hasData;$('join-times-empty').hidden=hasData;
  $('join-times-summary').textContent=data?`${fmt(data.total)} member joins · ${dateLabel(data.start)}–${dateLabel(data.end)} · Eastern Time`:'Waiting for member join history';
  if(!hasData){$('join-times-empty').textContent=data?'No member joins in this period. Choose a longer range.':'Member join times are temporarily unavailable. Retrying with the live feed.';return;}
  const share=n=>(n/data.total*100).toFixed(1)+'%';
  $('join-peak-hour').textContent=hourRange(data.peakHours[0]);
  $('join-peak-note').textContent=`${fmt(data.peak)} joins · ${share(data.peak)} of this period${data.peakHours.length>1?` · tied with ${data.peakHours.slice(1).map(hourRange).join(', ')}`:''}`;
  const maxPart=Math.max(...data.dayparts.map(d=>d.count)),parts=data.dayparts.filter(d=>d.count===maxPart);
  $('join-peak-part').textContent=parts.map(d=>d.label).join(' / ');
  $('join-part-note').textContent=`${hourLabel(parts[0].start)}–${hourLabel((parts[0].start+6)%24)} · ${fmt(maxPart)} joins · ${share(maxPart)}${parts.length>1?' (tied)':''}`;
  const reset=()=>{$('join-hour-detail').textContent='Select an hour to see its count and share.';};reset();
  const bars=$('join-hour-bars');bars.replaceChildren();
  data.hours.forEach((count,h)=>{
   const button=document.createElement('button'),track=document.createElement('span'),fill=document.createElement('i'),label=document.createElement('span'),number=document.createElement('span');
   button.className='join-hour';button.classList.toggle('peak',count===data.peak);button.setAttribute('aria-label',`${hourRange(h)} Eastern Time: ${fmt(count)} joins, ${share(count)}`);
   track.className='join-hour-track';fill.style.height=(count/data.peak*100)+'%';track.append(fill);label.className='join-hour-label';label.textContent=hourLabel(h).replace(' ','');number.className='join-hour-count';number.textContent=fmt(count);button.append(number,track,label);
   const inspect=()=>{$('join-hour-detail').textContent=`${hourRange(h)} ET · ${fmt(count)} joins · ${share(count)} of this period`;};button.onmouseenter=inspect;button.onfocus=inspect;button.onclick=inspect;bars.append(button);
  });
  $('join-dayparts').replaceChildren();
  data.dayparts.forEach(part=>{const card=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong'),note=document.createElement('small');card.className='join-daypart';label.textContent=part.label;value.textContent=share(part.count);note.textContent=`${hourLabel(part.start)}–${hourLabel((part.start+6)%24)} · ${fmt(part.count)} joins`;card.append(label,value,note);$('join-dayparts').append(card);});
 }
 document.querySelectorAll('[data-join-period]').forEach(button=>button.onclick=()=>{period=button.dataset.joinPeriod;document.querySelectorAll('[data-join-period]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();});
 return {update(snapshot){const next=snapshot.memberHistory?.timeOfDay||null;if(at===snapshot.updatedAt&&history===next)return;history=next;at=snapshot.updatedAt;render();}};
}
