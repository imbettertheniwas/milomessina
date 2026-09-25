import {loadBetaGithub} from './beta-github.js';

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null, selected='', busy=false, loadedFor='', githubRun=0, generation=0, deleteTarget=null;
let scheduleRun=0, scheduleUrl='', scheduleLoading=false;
const active=()=>document.body.dataset.consoleView==='beta' && bridge().operator?.();
const batchOf=m=>(data?.batches || []).find(b=>b.id===m?.batchId) || data?.group;
const periodOf=m=>({startDate:m?.startDate,endDate:m?.endDate});
const attendanceOf=id=>(data?.attendance || []).filter(a=>a.memberId===id);
const recapOf=id=>(data?.recaps || []).find(r=>r.memberId===id);
const scheduleOf=id=>(data?.schedules || []).find(schedule=>schedule.memberId===id);
const SCHEDULE_FILE_TYPES={'application/pdf':'PDF','image/png':'PNG image','image/jpeg':'JPEG image','text/calendar':'Calendar file'};
const scheduleFileType=type=>Object.prototype.hasOwnProperty.call(SCHEDULE_FILE_TYPES,type)?SCHEDULE_FILE_TYPES[type]:'';
const message=(text,bad=false)=>{$('bt-message').textContent=text;$('bt-message').classList.toggle('bad',bad);};
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
function portfolioUrl(value) {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol) && url.hostname && !url.username && !url.password?url.href:'';}
  catch{return '';}
}
async function api(action,payload={}) {
  const b=bridge(),requestToken=b.session?.(),revision=generation;
  const res=await fetch(b.endpoint,{method:'POST',body:JSON.stringify({_api:'beta',_key:b.key,_session:requestToken,action,...payload}),signal:AbortSignal.timeout(20000)});
  const out=await res.json();
  if(revision!==generation || requestToken!==bridge().session?.() || !active())throw Object.assign(new Error('Your session changed. Open Beta again.'),{code:'STALE'});
  if(!out.ok) {
    const unavailable=/unknown (form|action)/i.test(out.error || '');
    throw Object.assign(new Error(unavailable?'Beta signup is not enabled on the shared internal service yet. Deploy the updated Apps Script before sharing an invite.':out.error || 'Could not save this change.'),{code:out.code});
  }
  const next=out.data || out;
  // An authenticated file response is not a replacement for the manager list.
  if(action==='schedulefile')return next;
  if(next.manager!==true)throw Object.assign(new Error('Only Arya and Milo can manage the beta group.'),{code:'FORBIDDEN'});
  data=next;return next;
}
function render() {
  if(!data)return;
  const group=data.members || [],q=$('bt-search').value.toLowerCase(),ids=new Set(group.map(m=>m.id));
  const shown=group.filter(m=>`${m.name} ${m.email} ${m.phone || ''} ${m.github}`.toLowerCase().includes(q));
  $('bt-invite-link').value=location.origin+'/internal/beta';
  $('bt-summary').innerHTML=[['Beta interns',group.length],['Active',group.filter(m=>m.status==='active' && batchOf(m)?.active!==false).length],['Days attended',(data.attendance || []).filter(a=>ids.has(a.memberId)).length],['Recaps submitted',(data.recaps || []).filter(r=>ids.has(r.memberId) && r.submittedAt).length]].map(([label,n])=>`<div><span>${label}</span><strong>${n}</strong></div>`).join('');
  if(!shown.some(m=>m.id===selected))selected=shown[0]?.id || '';
  if(deleteTarget?.id!==selected)deleteTarget=null;
  $('bt-roster').innerHTML=shown.length?shown.map(m=>`<button type="button" class="bt-person ${selected===m.id?'on':''}" data-member="${esc(m.id)}" aria-pressed="${selected===m.id}"><span class="bt-avatar">${esc(m.name.slice(0,1).toUpperCase())}</span><span><strong>${esc(m.name)}</strong><small>${attendanceOf(m.id).length} days in · Recap due ${esc(dateLabel(periodOf(m).endDate))}</small><small>${recapOf(m.id)?.submittedAt?'Recap submitted':'Recap pending'}</small></span><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></button>`).join(''):`<div class="bt-empty"><b>${group.length?'No matches':'Ready for the first arrival'}</b><p>${group.length?'Try another name, email, phone, or GitHub.':'Share the permanent invite above. Interns appear here when they join.'}</p></div>`;
  renderMember(group.find(m=>m.id===selected));
  if(data.configured===false)message(data.setupMessage || 'Beta access needs to be configured.',true);
  setBusy(busy);
}
function deleteControls(m) {
  if(data.betaDelete===false)return '';
  if(deleteTarget?.id===m.id)return `<div class="bt-delete-confirm" role="group" aria-labelledby="bt-delete-title"><h4 id="bt-delete-title">Delete ${esc(deleteTarget.name)}?</h4><p>Their profile, attendance, recap and private notes will be permanently removed. Their private schedule and its uploaded file will also be removed. Their personal return link and Beta access will be closed. This cannot be undone.</p><div class="bt-actions"><button class="btn btn-g" type="button" data-cancel-delete>Cancel</button><button class="btn btn-g" type="button" data-confirm-delete="${esc(deleteTarget.id)}">Delete ${esc(deleteTarget.name)}</button></div></div>`;
  return `<div class="bt-delete-row"><button class="btn btn-g bt-delete" type="button" data-delete-member="${esc(m.id)}">Delete intern</button></div>`;
}
function renderDeleteControls() {
  const member=(data?.members || []).find(m=>m.id===selected);
  if(member)$('bt-delete-controls').innerHTML=deleteControls(member);
}
function renderMember(m) {
  githubRun++;clearScheduleFile();
  if(!m){$('bt-detail').innerHTML='<div class="bt-card bt-empty"><b>One view of the whole two weeks</b><p>Choose an intern to see attendance, GitHub activity, their recap, and your private evaluation notes.</p></div>';return;}
  const batch=periodOf(m),days=attendanceOf(m.id).map(a=>a.day).sort(),recap=recapOf(m.id),website=portfolioUrl(m.website);
  $('bt-detail').innerHTML=`<form id="bt-member-form" class="bt-card"><div class="bt-card-head"><div><h3>${esc(m.name)}</h3><p>Your first two weeks · ${esc(dateLabel(batch?.startDate))} – ${esc(dateLabel(batch?.endDate))}</p>${website?`<a class="bt-portfolio" href="${esc(website)}" target="_blank" rel="noopener noreferrer">${esc(new URL(website).hostname)} ↗</a>`:""}</div><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></div><div class="bt-fields"><label>Name<input name="name" value="${esc(m.name)}" required maxlength="80"></label><label>Email<input name="email" value="${esc(m.email)}" type="email" maxlength="254"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(m.phone)}" placeholder="Not provided"></label><label>GitHub username<input name="github" value="${esc(m.github)}" maxlength="39" placeholder="username"></label><label>Portfolio website <span>(optional)</span><input name="website" type="text" inputmode="url" autocomplete="url" maxlength="300" value="${esc(m.website)}" placeholder="yourname.com"></label><label>Access status<select name="status">${['active','paused','graduated'].map(s=>`<option ${s===m.status?'selected':''}>${s}</option>`).join('')}</select></label></div><p class="bt-foot bt-contact-note">Contact details are visible to Arya and Milo only.${m.createdAt?` Joined ${esc(new Date(m.createdAt).toLocaleString())}.`:""}</p><label>Private evaluation notes<textarea name="notes" rows="4" maxlength="5000" placeholder="Progress, feedback, and follow-ups…">${esc(m.notes)}</textarea><span>Visible to Arya and Milo only.</span></label><div class="bt-actions"><button class="btn btn-p" type="submit">Save intern</button><button class="btn btn-g" data-code type="button">Replace personal return link</button></div><p class="bt-foot">Pausing or graduating closes their beta access and keeps their record. It does not add them to the main team.</p><div id="bt-delete-controls">${deleteControls(m)}</div></form>${scheduleSection(m)}<section class="bt-card"><div class="bt-card-head"><h3>Attendance</h3><span>${days.length} days in</span></div><div class="bt-days">${days.length?days.map(day=>`<span>${esc(dateLabel(day))}</span>`).join(''):'<p class="bt-muted">No attendance marked yet.</p>'}</div></section><section class="bt-card"><div class="bt-card-head"><h3>GitHub activity</h3>${m.github?`<a href="https://github.com/${encodeURIComponent(m.github)}" target="_blank" rel="noopener noreferrer">@${esc(m.github)} ↗</a>`:''}</div><div id="bt-github"><p class="bt-muted">Loading public activity…</p></div></section><section class="bt-card"><div class="bt-card-head"><h3>Two-week recap</h3><span>${recap?.submittedAt?'Submitted':recap?'Draft':'Not started'}</span></div><p class="bt-muted">Due ${esc(dateLabel(batch?.endDate))}</p>${recap?`<h4>What they learned</h4><p class="bt-long">${esc(recap.learned || 'Not added yet.')}</p><h4>What they accomplished</h4><p class="bt-long">${esc(recap.accomplished || 'Not added yet.')}</p>${recap.links?.length?`<h4>Work & links</h4><p class="bt-long">${recap.links.map(link=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a>`).join('<br>')}</p>`:''}`:'<p class="bt-muted">Their recap will appear here as they write it.</p>'}</section>`;
  paintGithub(m,batch,githubRun);
}
function scheduleSection(member) {
  const schedule=scheduleOf(member.id);
  const heading='<div class="bt-card-head"><h3>Private schedule</h3><span>Only this intern, Arya and Milo</span></div>';
  let content='<p class="bt-muted">No schedule provided yet.</p>';
  if(schedule) {
    const timezone=`<p class="bt-foot">Time zone: ${esc(schedule.timezone || 'Not provided')}</p>`;
    if(schedule.ready===false)content='<p class="bt-muted">This schedule has not finished saving. The intern can reopen their profile to finish it.</p>'+timezone;
    else if(schedule.mode==='manual') {
      const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const clock=value=>{const [hours,minutes]=String(value).split(':');return `${Number(hours)%12 || 12}:${minutes} ${Number(hours)<12?'AM':'PM'}`;};
      const blocks=(Array.isArray(schedule.blocks)?schedule.blocks:[]).filter(block=>Number.isInteger(block.day) && block.day>=0 && block.day<=6 && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(block.start) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(block.end)).slice().sort((a,b)=>a.day-b.day || a.start.localeCompare(b.start));
      content=(schedule.noCommitments===true?'<p class="bt-muted">No recurring commitments.</p>':blocks.length?`<div class="bt-schedule-blocks">${blocks.map(block=>`<div><strong>${days[block.day]}</strong><span>${esc(clock(block.start))} – ${esc(clock(block.end))}</span><p>${esc(block.label || 'Commitment')}</p></div>`).join('')}</div>`:'<p class="bt-muted">No weekly commitments listed.</p>')+timezone;
    } else if(schedule.mode==='file') {
      const file=schedule.file,type=scheduleFileType(file?.type);
      content=file?`<p class="bt-schedule-name">${esc(file.name)}</p><p class="bt-muted">${esc(type || 'Schedule file')} · ${Number.isFinite(file.size)?Math.max(1,Math.ceil(file.size/1024))+' KB':'Size unavailable'}</p>${schedule.ready===true && type?`<button id="bt-schedule-file" class="btn btn-g" type="button" data-schedule-file="${esc(member.id)}">${file.type==='text/calendar'?'Get calendar file':'View schedule file'}</button><div id="bt-schedule-preview" aria-live="polite"></div>`:'<p class="bt-muted">The schedule file is not available yet.</p>'}`:'<p class="bt-muted">No schedule file provided yet.</p>';
      content+=timezone;
    }
  }
  return `<section class="bt-card bt-schedule">${heading}${content}</section>`;
}
function clearScheduleFile() {
  scheduleRun++;scheduleLoading=false;
  if(scheduleUrl)URL.revokeObjectURL(scheduleUrl);
  scheduleUrl='';
  if($('bt-schedule-preview'))$('bt-schedule-preview').replaceChildren();
  if($('bt-schedule-file'))$('bt-schedule-file').disabled=busy;
}
function scheduleBlob(file) {
  const max=2*1024*1024;
  if(!file || !scheduleFileType(file.type) || typeof file.name!=='string' || !file.name || file.name.length>255 || /[\x00-\x1f\x7f]/.test(file.name) || typeof file.data!=='string' || !file.data.length || file.data.length>4*Math.ceil(max/3) || file.data.length%4!==0 || !/^[a-z0-9+/]+={0,2}$/i.test(file.data))throw new Error('This schedule file could not be opened. Ask the intern to upload it again.');
  const binary=atob(file.data);
  if(!binary.length || binary.length>max || !Number.isInteger(file.size) || file.size!==binary.length)throw new Error('This schedule file is incomplete or too large. Ask the intern to upload it again.');
  return new Blob([Uint8Array.from(binary,char=>char.charCodeAt(0))],{type:file.type});
}
async function openScheduleFile(memberId) {
  if(!active() || busy || scheduleLoading || selected!==memberId || scheduleOf(memberId)?.ready!==true || scheduleOf(memberId)?.mode!=='file')return;
  clearScheduleFile();const run=scheduleRun,revision=generation;
  scheduleLoading=true;$('bt-schedule-file').disabled=true;
  $('bt-schedule-preview').innerHTML='<p class="bt-muted">Opening private schedule…</p>';
  try {
    const out=await api('schedulefile',{id:memberId});
    if(run!==scheduleRun || revision!==generation || selected!==memberId || !active())return;
    const file=out.file,blob=scheduleBlob(file);
    scheduleUrl=URL.createObjectURL(blob);
    const calendar=file.type==='text/calendar',image=file.type.startsWith('image/');
    $('bt-schedule-preview').innerHTML=`<div class="bt-schedule-file-links">${!calendar?`<a href="${esc(scheduleUrl)}" target="_blank" rel="noopener noreferrer">Open ${file.type==='application/pdf'?'PDF':'image'} ↗</a>`:''}<a href="${esc(scheduleUrl)}" download="${esc(file.name)}">Download ${calendar?'calendar file':'file'}</a></div>${image?`<img class="bt-schedule-image" src="${esc(scheduleUrl)}" alt="${esc((data.members || []).find(member=>member.id===memberId)?.name || 'Intern')}’s uploaded schedule">`:''}`;
  }catch(error){
    if(run!==scheduleRun || revision!==generation)return;
    if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.code))requestError(error);
    else if(error.code!=='STALE')$('bt-schedule-preview').innerHTML=`<p class="bt-muted">${esc(error.message || 'The schedule could not be opened. Try again.')}</p>`;
  }finally{if(run===scheduleRun && revision===generation){scheduleLoading=false;$('bt-schedule-file').disabled=false;}}
}
async function paintGithub(member,batch,run) {
  paintGithub.controller?.abort();
  const controller=new AbortController();paintGithub.controller=controller;
  const timeout=setTimeout(()=>controller.abort(),20000);
  const paint=results=>{
    if(run!==githubRun || !$('bt-github'))return;
    const result=results?.find(row=>row.memberId===member.id) || results?.[0];
    if(!result){$('bt-github').innerHTML='<p class="bt-muted">Public GitHub activity is unavailable right now.</p>';return;}
    const hasCount=['ready','partial'].includes(result.status) && Number.isSafeInteger(result.total) && result.total>=0;
    const window=`${dateLabel(result.startDate)} – ${dateLabel(result.throughDate || result.endDate)} · UTC`;
    const stamp=Number.isFinite(Date.parse(result.updatedAt))?new Date(result.updatedAt).toLocaleString():'';
    const commits=(result.commits || []).filter(commit=>{
      try {const url=new URL(commit.url);return url.protocol==='https:' && url.hostname==='github.com' && !url.username && !url.password;}
      catch{return false;}
    });
    $('bt-github').innerHTML=`${hasCount?`<p><strong>${result.partial?'At least ':''}${result.total} public ${result.total===1?'commit':'commits'}</strong></p>`:''}<p class="bt-muted">${esc(window)}${result.ongoing?' · Period in progress':''}</p><p class="bt-muted">${esc(result.message || 'Public GitHub activity is unavailable right now.')}</p>${stamp?`<p class="bt-foot">Checked ${esc(stamp)}</p>`:''}${commits.length?`<details><summary>${result.detailsLimited?'Recent commit details':'Commit details'} · ${commits.length}</summary>${commits.map(commit=>`<article class="bt-checkin"><a href="${esc(commit.url)}" target="_blank" rel="noopener noreferrer">${esc(commit.message || 'View commit')}</a><p class="bt-foot">${esc(commit.repo)} · ${esc(dateLabel(String(commit.date).slice(0,10)))} UTC</p></article>`).join('')}${result.detailsLimited?'<p class="bt-foot">Only a selection of commit details is shown; the count above includes all commits found.</p>':''}</details>`:''}<p class="bt-foot">${esc(result.scope || 'Public authored commits in owned, non-fork repositories. Private work and work in other owners’ repositories are not included.')}</p>`;
  };
  try {
    if(!batch?.startDate || !batch?.endDate)throw new Error('This intern’s two-week dates are unavailable. Refresh to try again.');
    paint(await loadBetaGithub([member],{startDate:batch.startDate,endDate:batch.endDate,onProgress:paint,signal:controller.signal}));
  }catch(error){if(run===githubRun && $('bt-github'))$('bt-github').innerHTML=`<p class="bt-muted">${esc(error.name==='AbortError'?'GitHub took too long to answer. Refresh to try again.':error.message || 'Public GitHub activity is unavailable right now.')}</p>`;}
  finally{clearTimeout(timeout);if(paintGithub.controller===controller)paintGithub.controller=null;}
}
function setBusy(value) {
  busy=value;$('bt-root').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);
  $('bt-refresh').disabled=value;
  if(data?.configured===false)$('bt-detail').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
}
function revealPersonalLink(out) {
  if(!out.code)return;
  const text=`${location.origin}/internal/beta#access=${encodeURIComponent(out.code)}`;
  $('bt-code').hidden=false;
  $('bt-code').innerHTML=`<div class="bt-card-head"><b>Personal return link replaced</b><button class="mini ghost" type="button" data-dismiss-code>Dismiss</button></div><p>Share this personal link directly with this intern. It opens their profile without a password. Their previous personal link and sessions are closed.</p><div class="bt-code-row"><code>${esc(text)}</code><button class="btn btn-g" data-copy-code type="button">Copy personal link</button></div>`;
  $('bt-code').dataset.invite=text;$('bt-code').scrollIntoView({block:'nearest'});
}
function clearPersonalLink() {
  $('bt-code').hidden=true;$('bt-code').innerHTML='';delete $('bt-code').dataset.invite;
}
function clearPrivate() {
  generation++;data=null;loadedFor='';selected='';githubRun++;deleteTarget=null;
  clearScheduleFile();
  paintGithub.controller?.abort();
  ['bt-summary','bt-roster','bt-detail','bt-code'].forEach(id=>$(id).innerHTML='');
  clearPersonalLink();
  setBusy(false);
}
function requestError(error) {
  if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.code))clearPrivate();
  message(error.message,true);
}
async function change(action,payload,success) {
  if(busy)return;
  const revision=generation;
  setBusy(true);message('Saving…');
  try{
    const out=await api(action,payload);
    if(revision!==generation)return;
    if(action==='memberdelete'){deleteTarget=null;clearPersonalLink();}
    render();revealPersonalLink(out);message(success);
  }catch(error){if(revision===generation)requestError(error);}
  finally{if(revision===generation)setBusy(false);}
}
async function load(force=false) {
  if(!active() || busy)return;
  const token=bridge().session?.();if(!force && loadedFor===token && data)return;
  const revision=generation;
  setBusy(true);message('Loading Beta…');
  try{await api('list');if(revision!==generation)return;loadedFor=token;render();if(data.configured!==false)message('');}
  catch(error){if(revision===generation)requestError(error);}
  finally{if(revision===generation)setBusy(false);}
}
$('bt-refresh').addEventListener('click',()=>load(true));
$('bt-search').addEventListener('input',()=>render());
$('bt-copy-invite').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('bt-invite-link').value);message('Permanent invite link copied.');}
  catch{$('bt-invite-link').focus();$('bt-invite-link').select();message('Select and copy the link above.');}
});
$('bt-root').addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,payload=Object.fromEntries(new FormData(form));
  if(form.id==='bt-member-form')change('memberupdate',{...payload,id:selected},'Intern saved.');
});
$('bt-root').addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b || busy)return;
  if(b.dataset.member){selected=b.dataset.member;deleteTarget=null;render();}
  if(b.hasAttribute('data-schedule-file'))await openScheduleFile(b.dataset.scheduleFile);
  if(b.hasAttribute('data-delete-member')){
    const member=(data?.members || []).find(m=>m.id===b.dataset.deleteMember);
    if(!member || selected!==member.id)return;
    deleteTarget={id:member.id,name:member.name};renderDeleteControls();
  }
  if(b.hasAttribute('data-cancel-delete')){deleteTarget=null;renderDeleteControls();}
  if(b.hasAttribute('data-confirm-delete')){
    const target=deleteTarget;
    if(!target || target.id!==b.dataset.confirmDelete || selected!==target.id || !(data?.members || []).some(m=>m.id===target.id))return;
    await change('memberdelete',{id:target.id},target.name+' was deleted. Their Beta access is closed.');
  }
  if(b.hasAttribute('data-cancel'))render();
  if(b.hasAttribute('data-code'))b.outerHTML='<div class="bt-rotate-confirm"><p>Replace this intern’s personal link and sign them out?</p><button class="mini" type="button" data-confirm-code>Replace</button><button class="mini ghost" type="button" data-cancel>Cancel</button></div>';
  if(b.hasAttribute('data-confirm-code'))await change('rotatecode',{id:selected},'Personal return link replaced.');
  if(b.hasAttribute('data-dismiss-code'))clearPersonalLink();
  if(b.hasAttribute('data-copy-code')){try{await navigator.clipboard.writeText($('bt-code').dataset.invite);message('Copied.');}catch{message('Copy the personal link shown above.',true);}}
});
window.addEventListener('fomo:view-change',()=>{if(!active())clearScheduleFile();load();});
window.addEventListener('fomo:identity',()=>{clearPrivate();message('');load();});
load();
