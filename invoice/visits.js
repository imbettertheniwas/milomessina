/* Visit requests are isolated from ledger storage and never cached in the browser. */
const $ = id => document.getElementById(id);
let editingVersion=null,requestEpoch=0;
const state={requests:[],selected:null,busy:false,saving:false,loaded:false,authenticated:false};
const statusLabels={pending:'Pending',confirmed:'Confirmed',completed:'Completed',declined:'Declined'};
const publicLink=new URL('/hqvisitform/',location.origin).href;
$('vr-open').href=publicLink;
$('vr-link').value=publicLink;
function message(text,error=false){$('vr-message').textContent=text;$('vr-message').classList.toggle('vr-error',error);}
async function api(action,body) {
  const response=await fetch('/api/visits?action='+action,{
    method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
    headers:body?{'Content-Type':'application/json'}:{},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({error:'Visit requests could not be loaded.'}));
  if(!response.ok){
    if(response.status===401)lock();
    const error=new Error(data.error||'Please try again.');error.status=response.status;throw error;
  }
  return data;
}
function lock(){
  requestEpoch++;
  state.authenticated=false;state.requests=[];state.selected=null;state.loaded=false;
  $('vr-login').hidden=false;$('vr-workspace').hidden=true;$('vr-lock').hidden=true;
  $('vr-details').hidden=true;$('vr-list').replaceChildren();$('vr-count').textContent='';
  $('vr-notes').value='';$('vr-detail-body').replaceChildren();
}
function unlock(){state.authenticated=true;$('vr-login').hidden=true;$('vr-workspace').hidden=false;$('vr-lock').hidden=false;}
function text(tag,value,className){
  const element=document.createElement(tag);element.textContent=value;
  if(className)element.className=className;return element;
}
function dateLabel(date){
  return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'});
}
function render(){
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
  $('vr-details').hidden=false;render();$('vr-detail-name').focus();
}
async function refresh(){
  if(state.busy || state.saving)return;
  const editing=state.requests.find(r=>r.id===state.selected);
  if(editing && ($('vr-notes').value!==editing.internal_notes || $('vr-status').value!==editing.status) &&
    !confirm('Refresh and discard the unsaved changes to this request?'))return;
  state.selected=null;$('vr-details').hidden=true;
  const epoch=requestEpoch;
  state.busy=true;$('vr-refresh').disabled=true;message('Loading visit requests…');
  try{
    const data=await api('list');if(epoch!==requestEpoch)return;state.requests=data.requests;state.loaded=true;unlock();render();
    message('Requests are up to date.');
  }catch(error){message(error.message,true);}
  finally{state.busy=false;$('vr-refresh').disabled=false;}
}

$('vr-filter').addEventListener('change',render);
$('vr-search').addEventListener('input',render);
$('vr-copy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(publicLink);message('Form link copied.');}
  catch{$('vr-link-wrap').hidden=false;$('vr-link').focus();$('vr-link').select();message('Copy the selected link.');}
});
$('vr-refresh').addEventListener('click',refresh);
$('vr-login').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('vr-unlock');button.disabled=true;
  try{await api('login',{password:$('vr-password').value});$('vr-password').value='';await refresh();}
  catch(error){message(error.message,true);}
  finally{button.disabled=false;}
});
$('vr-lock').addEventListener('click',async()=>{
  lock();
  try{await api('logout',{});message('Visit requests locked.');}
  catch(error){message(error.message,true);}
});
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
  if(location.hash==='#/visits' && !state.loaded && !state.busy)refresh();
}
window.addEventListener('hashchange',activated);
window.addEventListener('fomo:view-change',activated);
activated();
