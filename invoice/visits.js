/* Visit requests are isolated from ledger storage and never cached in the browser. */
const $ = id => document.getElementById(id);
let editingVersion=null,requestEpoch=0;
const state={requests:[],selected:null,busy:false,saving:false,loaded:false,authenticated:false};
const statusLabels={pending:'Pending',confirmed:'Confirmed',completed:'Completed',declined:'Declined'};
const publicLink=new URL('/hqvisitform/',location.origin).href;
$('vr-open').href=publicLink;
$('vr-link').value=publicLink;
function message(text,error=false){$('vr-message').textContent=text;$('vr-message').classList.toggle('vr-error',error);}
/* Only Milo and Arya can move a request on or change the opening hours, and the
   server says so on every attempt. The fields have to say it too: an
   intern left with a live dropdown and a live notes box is being invited
   to make changes that have nowhere to go — the Save button beside them
   is hidden, so the edit cannot even be attempted, and typing in the
   notes then blocks Refresh behind a prompt about discarding work that
   was never theirs to do. */
const mayEdit=()=>{const b=window.FOMO_SHEET||{};return !!(b.admin && b.admin());};
async function api(action,body) {
  const bridge=window.FOMO_SHEET || {};
  const epoch=requestEpoch;
  if(['update','saveAvailability'].includes(action) && !mayEdit())throw new Error('Only Milo and Arya can change visit requests or opening hours.');
  const response=await fetch('/api/visits?action='+action,{
    method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
    signal:!body ? globalThis.AbortSignal?.timeout?.(25000) : undefined,
    headers:{...(body?{'Content-Type':'application/json'}:{}),...(bridge.session && bridge.session()?{'X-Fomo-Internal-Session':bridge.session()}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({error:'Visit requests could not be loaded.'}));
  if(epoch!==requestEpoch)throw new Error('Your Internal session changed.');
  if(!response.ok){
    if(response.status===401){lock();message(data.error || 'Sign in to Internal to view visit requests.');}
    const error=new Error(data.error||'Please try again.');error.status=response.status;throw error;
  }
  return data;
}
const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
let availability=null,hoursLoading=false;
/* Accepts "2:15 PM", "2:15pm" or "14:15" so nobody has to think about format.
   The server canonicalises too; this only keeps the field readable on save. */
function canonicalTime(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const clock=/^(\d{1,2}):([0-5][0-9])$/.exec(raw);
  if(clock){
    const h=Number(clock[1]);
    return h>23?'':(h%12||12)+':'+clock[2]+(h<12?' AM':' PM');
  }
  const m=/^(\d{1,2}):([0-5][0-9])\s*([AaPp])\.?[Mm]?\.?$/.exec(raw);
  if(!m)return '';
  const h=Number(m[1]);
  return h<1||h>12?'':h+':'+m[2]+' '+(m[3].toLowerCase()==='a'?'AM':'PM');
}
function hoursRender(){
  const rows=$('vr-hours-rows');rows.replaceChildren();
  const editable=mayEdit();
  (availability||[]).forEach((day,index)=>{
    const row=document.createElement('div');row.className='vr-day';
    const label=document.createElement('label');
    const box=document.createElement('input');box.type='checkbox';box.checked=day.open===true;
    box.disabled=!editable;
    box.id='vr-day-'+index;box.addEventListener('change',()=>{field.disabled=!box.checked;});
    label.append(box,text('span',weekdayNames[index]));
    const field=document.createElement('input');field.type='text';field.id='vr-times-'+index;
    field.value=(day.times||[]).join(', ');field.disabled=day.open!==true || !editable;
    field.setAttribute('aria-label',weekdayNames[index]+' times');
    field.placeholder='No times offered';
    row.append(label,field);rows.append(row);
  });
}
function hoursCollect(){
  const bad=[];
  const next=weekdayNames.map((name,index)=>{
    const open=$('vr-day-'+index).checked;
    const times=[];
    for(const piece of $('vr-times-'+index).value.split(',')){
      const raw=piece.trim();if(!raw)continue;
      const time=canonicalTime(raw);
      if(!time){bad.push(name+': "'+raw+'"');continue;}
      if(times.indexOf(time)===-1)times.push(time);
    }
    return {open,times};
  });
  return {next,bad};
}
function lock(){
  requestEpoch++;
  state.authenticated=false;state.requests=[];state.selected=null;state.loaded=false;state.busy=false;
  hoursLoading=false;$('vr-refresh').disabled=false;
  $('vr-workspace').hidden=true;
  window.FOMO_VISIT_STATS=null;window.dispatchEvent(new CustomEvent('fomo:visit-stats'));
  $('vr-details').hidden=true;$('vr-list').replaceChildren();$('vr-count').textContent='';
  $('vr-notes').value='';$('vr-detail-body').replaceChildren();
  availability=null;$('vr-hours-rows').replaceChildren();$('vr-hours-status').textContent='';$('vr-hours').open=false;
}
function unlock(){state.authenticated=true;$('vr-workspace').hidden=false;}
function text(tag,value,className){
  const element=document.createElement(tag);element.textContent=value;
  if(className)element.className=className;return element;
}
function dateLabel(date){
  return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'});
}
/* Publish counts only after the internal session has loaded the real list. */
function publish(){
  const all=state.requests||[];
  const n=id=>all.filter(r=>r.status===id).length;
  window.FOMO_VISIT_STATS={total:all.length,pending:n('pending'),
    confirmed:n('confirmed'),completed:n('completed'),declined:n('declined')};
  window.dispatchEvent(new CustomEvent('fomo:visit-stats'));
}
function render(){
  publish();
  const filter=$('vr-filter').value,query=$('vr-search').value.trim().toLowerCase();
  const rows=state.requests.filter(r=>(!filter||r.status===filter)&&(!query||[r.name,r.email,r.social,r.notes].join(' ').toLowerCase().includes(query)));
  $('vr-count').textContent=rows.length+' request'+(rows.length===1?'':'s');
  const list=$('vr-list');list.replaceChildren();
  if(!rows.length){list.append(text('p',state.requests.length?'No requests match these filters.':'No visit requests yet. Share the form link to invite someone.','vr-empty'));return;}
  for(const record of rows){
    const button=document.createElement('button');button.type='button';button.className='vr-row';
    button.setAttribute('aria-pressed',String(state.selected===record.id));
    const person=document.createElement('span');person.append(text('strong',record.name),text('small',record.social||record.email));
    const when=document.createElement('span');when.append(text('span',dateLabel(record.preferred_date)),text('small',record.preferred_time+' · New York'));
    button.append(person,when,text('span',statusLabels[record.status],'vr-status vr-'+record.status));
    button.addEventListener('click',()=>select(record.id));list.append(button);
  }
}
function select(id){
  if(state.saving)return;
  const record=state.requests.find(r=>r.id===id);if(!record)return;
  if(state.selected){
    const current=state.requests.find(r=>r.id===state.selected);
    if(current && ($('vr-notes').value!==current.internal_notes || $('vr-status').value!==current.status) &&
      !confirm('Discard the unsaved changes to this request?'))return;
  }
  state.selected=id;editingVersion=record.version;
  $('vr-detail-name').textContent=record.name;
  const body=$('vr-detail-body');body.replaceChildren();
  for(const [label,value] of [
    ['Email',record.email],['Social profile',record.social||'Not supplied'],
    ['Preferred visit',dateLabel(record.preferred_date)+' at '+record.preferred_time+' (New York time)'],
    ['Guest notes',record.notes||'No guest notes'],
    ['Submitted',new Date(record.created_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' (New York time)']
  ]){body.append(text('dt',label),text('dd',value));}
  const email=document.createElement('a');email.href='mailto:'+encodeURIComponent(record.email);email.textContent='Email guest';email.className='mini';
  body.append(email);
  $('vr-status').value=record.status;$('vr-notes').value=record.internal_notes;
  const editable=mayEdit();
  $('vr-status').disabled=!editable;$('vr-notes').readOnly=!editable;
  $('vr-details').hidden=false;render();$('vr-detail-name').focus();
}
async function refresh(){
  if(state.busy || state.saving)return;
  if(!window.FOMO_SHEET?.session?.()){lock();message('Sign in to Internal to view visit requests.');return;}
  const editing=state.requests.find(r=>r.id===state.selected);
  if(editing && ($('vr-notes').value!==editing.internal_notes || $('vr-status').value!==editing.status) &&
    !confirm('Refresh and discard the unsaved changes to this request?'))return;
  state.selected=null;$('vr-details').hidden=true;
  const epoch=requestEpoch;
  state.busy=true;$('vr-refresh').disabled=true;message('Loading visit requests…');
  try{
    const data=await api('list');if(epoch!==requestEpoch)return;state.requests=data.requests;state.loaded=true;unlock();render();
    // Opening hours have their own panel and should not delay the inbox.
    if($('vr-hours').open)loadHours(true);
    message('Requests are up to date.');
  }catch(error){if(epoch===requestEpoch)message(error.message,error.status!==401);}
  finally{if(epoch===requestEpoch){state.busy=false;$('vr-refresh').disabled=false;}}
}

$('vr-filter').addEventListener('change',render);
$('vr-search').addEventListener('input',render);
$('vr-copy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(publicLink);message('Form link copied.');}
  catch{$('vr-link-wrap').hidden=false;$('vr-link').focus();$('vr-link').select();message('Copy the selected link.');}
});
$('vr-refresh').addEventListener('click',refresh);
$('vr-close').addEventListener('click',()=>{
  if(state.saving)return;
  const current=state.requests.find(r=>r.id===state.selected);
  if(current && ($('vr-notes').value!==current.internal_notes || $('vr-status').value!==current.status) &&
     !confirm('Discard the unsaved changes to this request?'))return;
  state.selected=null;$('vr-details').hidden=true;$('vr-notes').value='';render();
});
$('vr-edit').addEventListener('submit',async event=>{
  event.preventDefault();if(state.saving)return;
  const epoch=requestEpoch,id=state.selected;
  const button=$('vr-save');button.disabled=true;state.saving=true;
  $('vr-status').disabled=true;$('vr-notes').disabled=true;
  try{
    const data=await api('update',{id:state.selected,status:$('vr-status').value,internalNotes:$('vr-notes').value,version:editingVersion});
    if(epoch!==requestEpoch)return;
    state.requests=state.requests.map(r=>r.id===data.request.id?data.request:r);
    if(state.selected===id){editingVersion=data.request.version;$('vr-notes').value=data.request.internal_notes;}
    render();message('Request updated. No email or calendar invite was sent.');
  }catch(error){message(error.status===409?'Someone updated this request. Copy any unsaved notes, close the details, then refresh and reopen it.':error.message,true);}
  finally{button.disabled=false;state.saving=false;$('vr-status').disabled=false;$('vr-notes').disabled=false;}
});
function activated(){
  if(location.hash==='#/visits' && window.FOMO_SHEET?.session?.() && !state.loaded && !state.busy)refresh();
}
window.addEventListener('fomo:identity',()=>{lock();activated();});
window.addEventListener('hashchange',activated);
window.addEventListener('fomo:view-change',activated);
activated();

function hoursStatus(message,error=false){
  $('vr-hours-status').textContent=message;
  $('vr-hours-status').classList.toggle('vr-error',error);
}
async function loadHours(force=false){
  if(!state.authenticated || hoursLoading || (availability && !force))return;
  const epoch=requestEpoch;
  hoursLoading=true;hoursStatus('Loading visit hours…');
  try{
    const hours=await api('availability');
    if(epoch!==requestEpoch)return;
    if(hours?.availability){availability=hours.availability;hoursRender();hoursStatus('');}
  }catch{
    if(epoch===requestEpoch)hoursStatus('Visit hours could not be loaded. The storage script may need updating.',true);
  }finally{if(epoch===requestEpoch)hoursLoading=false;}
}
$('vr-hours').addEventListener('toggle',()=>{if($('vr-hours').open)loadHours();});
$('vr-hours-copy').addEventListener('click',()=>{
  if(!availability)return;
  const monday=$('vr-times-1').value;
  for(let i=0;i<7;i++)if($('vr-day-'+i).checked)$('vr-times-'+i).value=monday;
  hoursStatus('Copied. Nothing is saved until you press Save hours.');
});
$('vr-hours-save').addEventListener('click',async event=>{
  event.preventDefault();
  if(!availability)return;
  const {next,bad}=hoursCollect();
  if(bad.length){hoursStatus('Could not read '+bad.join(', ')+'. Use a time like 2:15 PM.',true);return;}
  const button=$('vr-hours-save');button.disabled=true;hoursStatus('Saving hours…');
  try{
    const data=await api('saveAvailability',{availability:next});
    availability=data.availability;hoursRender();
    hoursStatus('Hours saved. The form picks them up within a minute.');
  }catch(error){hoursStatus(error.message,true);}
  finally{button.disabled=false;}
});
