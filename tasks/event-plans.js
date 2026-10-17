// Keep event requests in the existing private step notes so the current review
// service and admin console receive them without a separate submission workflow.
// Indented values cannot be confused with section headings when restoring fields.
const START='[Event sponsorship and campus highlights]',END='[/Event sponsorship and campus highlights]';
const indent=(text,spaces)=>String(text||'').split('\n').map(line=>' '.repeat(spaces)+line).join('\n');
const unindent=(text,spaces)=>text.split('\n').map(line=>line.slice(spaces)).join('\n');
export function readEventPlans(text=''){
 const blank={notes:text,biggestEvents:'',requests:[]};
 if(!text.startsWith(START+'\n')||!text.endsWith('\n'+END))return blank;
 try{
  const body=text.slice(START.length+1,-END.length-1),sections=body.split('\nSponsorship request:\n');
  const first=sections.shift(),match=/^Additional notes:\n([\s\S]*?)\nBiggest school events:\n([\s\S]*)$/.exec(first);if(!match)return blank;
  const requests=sections.map(section=>{const m=/^  Event: (.*)\n  Date: (.*)\n  Amount requested \(USD\): (.*)\n  What it covers and why it matters:\n([\s\S]*)$/.exec(section);if(!m)throw Error();return{event:m[1],date:m[2],amount:m[3],comments:unindent(m[4],4)};});
  return{notes:unindent(match[1],2),biggestEvents:unindent(match[2],2),requests};
 }catch{return blank;}
}
export function writeEventPlans({notes='',biggestEvents='',requests=[]}){
 if(!biggestEvents&&!requests.length)return notes;
 return `${START}\nAdditional notes:\n${indent(notes,2)}\nBiggest school events:\n${indent(biggestEvents,2)}`+requests.map(r=>`\nSponsorship request:\n  Event: ${r.event||''}\n  Date: ${r.date||''}\n  Amount requested (USD): ${r.amount||''}\n  What it covers and why it matters:\n${indent(r.comments,4)}`).join('')+`\n${END}`;
}
export function eventPlansError(plans,submit=false){
 if(writeEventPlans(plans).length>6000)return 'Please shorten your notes or event comments before saving. They’re kept in this browser for now.';
 if(!submit)return '';
 for(const [i,r] of plans.requests.entries()){
  if(!r.event.trim())return `Add an event name for sponsorship request ${i+1}, or remove that request.`;
  if(!/^\d+(\.\d{1,2})?$/.test(r.amount)||!Number.isFinite(Number(r.amount))||Number(r.amount)<=0)return `Enter a dollar amount greater than $0 for ${r.event}.`;
  if(r.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T12:00:00Z'))||new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date))return `Choose a valid date for ${r.event}, or leave the date blank.`;
  if(!r.comments.trim())return `Tell us what the sponsorship would cover for ${r.event}.`;
 }
 return '';
}
export function createEventPlans(el,{getNotes,onChange}){
 const panel=el.querySelector('[data-event-plans]');if(!panel)return null;
 const list=panel.querySelector('[data-sponsorship-list]'),biggest=panel.querySelector('[data-biggest-events]'),notes=el.querySelector('[data-step-notes]'),add=panel.querySelector('[data-add-sponsorship]');
 let plans=readEventPlans(getNotes()),disabled=false;
 function save(){onChange(writeEventPlans(plans));}
 function draw(){
  list.replaceChildren();
  plans.requests.forEach((r,i)=>{
   const card=document.createElement('fieldset');card.className='sponsorship-request';card.disabled=disabled;
   const legend=document.createElement('legend');legend.textContent=`Event ${i+1}`;card.append(legend);
   for(const [field,label,type] of [['event','Event name','text'],['date','Date (if known)','date'],['amount','Amount requested ($)','number'],['comments','What would it cover? Why this event?','textarea']]){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');input.dataset.requestField=field;
    input.setAttribute('aria-label',`${field==='event'?'Sponsorship event name':label} ${i+1}`);input.value=r[field]||'';
    if(type==='textarea'){input.rows=3;input.maxLength=800;input.placeholder='e.g. DJ and production for our biggest homecoming party.';}else{input.type=type;if(field==='event'){input.maxLength=160;input.placeholder='e.g. Homecoming party';}if(field==='amount'){input.min='0.01';input.step='0.01';input.inputMode='decimal';input.placeholder='500';}}
    input.addEventListener('input',()=>{r[field]=input.value;save();});wrap.append(input);card.append(wrap);
   }
   const remove=document.createElement('button');remove.type='button';remove.className='quiet-button';remove.textContent='Remove request';remove.setAttribute('aria-label',`Remove sponsorship request ${i+1}`);remove.addEventListener('click',()=>{plans.requests.splice(i,1);draw();save();});card.append(remove);list.append(card);
  });
  add.disabled=disabled||plans.requests.length>=5;
 }
 biggest.addEventListener('input',()=>{plans.biggestEvents=biggest.value;save();});
 notes.addEventListener('input',()=>{plans.notes=notes.value;save();});
 add.addEventListener('click',()=>{if(disabled||plans.requests.length>=5)return;plans.requests.push({event:'',date:'',amount:'',comments:''});draw();save();list.lastElementChild.querySelector('input').focus();});
 return{
  restore(){plans=readEventPlans(getNotes());notes.value=plans.notes;biggest.value=plans.biggestEvents;draw();if(plans.requests.length||plans.biggestEvents)panel.open=true;const note=el.querySelector('.calendar-note');if(note&&plans.notes)note.open=true;},
  lock(value){disabled=value;panel.querySelectorAll('input,textarea,button,fieldset').forEach(input=>input.disabled=value);add.disabled=value||plans.requests.length>=5;},
  error(submit){return eventPlansError(readEventPlans(getNotes()),submit);}
 };
}
