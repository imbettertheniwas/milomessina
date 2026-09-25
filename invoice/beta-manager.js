import {loadBetaGithub} from './beta-github.js';

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null, selected='', adding=false, busy=false, loadedFor='', githubRun=0;
const active=()=>document.body.dataset.consoleView==='beta' && bridge().operator?.();
const batchOf=m=>(data?.batches || []).find(b=>b.id===m?.batchId);
const attendanceOf=id=>(data?.attendance || []).filter(a=>a.memberId===id);
const recapOf=id=>(data?.recaps || []).find(r=>r.memberId===id);
const message=(text,bad=false)=>{$('bt-message').textContent=text;$('bt-message').classList.toggle('bad',bad);};
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
async function api(action,payload={}) {
  const b=bridge();
  const res=await fetch(b.endpoint,{method:'POST',body:JSON.stringify({_api:'beta',_key:b.key,_session:b.session?.(),action,...payload}),signal:AbortSignal.timeout(20000)});
  const out=await res.json();
  if(!out.ok) {
    const unavailable=/unknown (form|action)/i.test(out.error || '');
    throw Object.assign(new Error(unavailable?'Beta signup is not enabled on the shared internal service yet. Deploy the updated Apps Script before sharing an invite.':out.error || 'Could not save this change.'),{code:out.code});
  }
  const next=out.data || out;
  if(next.manager!==true)throw new Error('Only Arya and Milo can manage the beta batch.');
  data=next;return next;
}
function batchForm(batch) {
  const now=new Date(),start=batch?.startDate || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return `<form id="bt-batch-form" class="bt-card"><div class="bt-card-head"><h3>${batch?'Batch settings':'Start a beta batch'}</h3><button class="mini ghost" type="button" data-cancel>Cancel</button></div><label>Batch name<input name="name" value="${esc(batch?.name || '')}" placeholder="e.g. Fall beta · Batch 01" maxlength="80" required></label><label>First day<input name="startDate" type="date" value="${esc(start)}" required></label><p class="bt-muted">The recap is due at the end of the 14th day. Anyone with the batch’s invite link can join.</p>${batch?`<label class="bt-check"><input type="checkbox" name="active" ${batch.active?'checked':''}>Batch access is open</label><p class="bt-foot">Closing a batch pauses sign-in for all its interns. Its records stay here.</p>`:''}<div class="bt-actions"><button class="btn btn-p" type="submit">${batch?'Save batch':'Create batch & invite'}</button></div></form>`;
}
function render() {
  if(!data)return;
  const batches=data.batches || [],members=data.members || [],was=$('bt-batch').value;
  $('bt-batch').innerHTML='<option value="">All batches</option>'+batches.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  $('bt-batch').value=batches.some(b=>b.id===was)?was:'';
  const batch=$('bt-batch').value,q=$('bt-search').value.toLowerCase();
  const group=members.filter(m=>!batch || m.batchId===batch),ids=new Set(group.map(m=>m.id));
  const shown=group.filter(m=>`${m.name} ${m.email} ${m.phone || ''} ${m.github}`.toLowerCase().includes(q));
  $('bt-summary').innerHTML=[['Beta interns',group.length],['Active',group.filter(m=>m.status==='active' && batchOf(m)?.active).length],['Days attended',(data.attendance || []).filter(a=>ids.has(a.memberId)).length],['Recaps submitted',(data.recaps || []).filter(r=>ids.has(r.memberId) && r.submittedAt).length]].map(([label,n])=>`<div><span>${label}</span><strong>${n}</strong></div>`).join('');
  $('bt-batch-actions').innerHTML=batch?`<span>${esc(dateLabel(batches.find(b=>b.id===batch).startDate))} – ${esc(dateLabel(batches.find(b=>b.id===batch).endDate))}</span><button class="mini ghost" data-batch-settings type="button">Batch settings</button><button class="mini ghost" data-invite type="button">New invite link</button>`:'<span>Select a batch to manage its dates and invite link.</span>';
  if(!adding && !shown.some(m=>m.id===selected))selected=shown[0]?.id || '';
  $('bt-roster').innerHTML=shown.length?shown.map(m=>`<button type="button" class="bt-person ${selected===m.id && !adding?'on':''}" data-member="${esc(m.id)}" aria-pressed="${selected===m.id && !adding}"><span class="bt-avatar">${esc(m.name.slice(0,1).toUpperCase())}</span><span><strong>${esc(m.name)}</strong><small>${esc(batchOf(m)?.name || m.batch)} · ${attendanceOf(m.id).length} days in</small><small>${recapOf(m.id)?.submittedAt?'Recap submitted':'Recap pending'}</small></span><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></button>`).join(''):`<div class="bt-empty"><b>${group.length?'No matches':batches.length?'Ready for the first arrival':'Your next batch starts here'}</b><p>${group.length?'Try another name or batch.':batches.length?'Share the batch invite. Interns will appear here when they join.':'Create a batch, set its first day, and share one invite link.'}</p></div>`;
  if(adding)$('bt-detail').innerHTML=batchForm(adding==='edit'?batches.find(b=>b.id===batch):null);
  else renderMember(members.find(m=>m.id===selected));
  if(data.configured===false)message(data.setupMessage || 'Beta access needs to be configured.',true);
  setBusy(busy);
}
function renderMember(m) {
  githubRun++;
  if(!m){$('bt-detail').innerHTML='<div class="bt-card bt-empty"><b>One view of the whole two weeks</b><p>Choose an intern to see attendance, GitHub activity, their recap, and your private evaluation notes.</p></div>';return;}
  const batch=batchOf(m),days=attendanceOf(m.id).map(a=>a.day).sort(),recap=recapOf(m.id);
  $('bt-detail').innerHTML=`<form id="bt-member-form" class="bt-card"><div class="bt-card-head"><div><h3>${esc(m.name)}</h3><p>${esc(batch?.name || m.batch)} · ${esc(dateLabel(batch?.startDate))} – ${esc(dateLabel(batch?.endDate))}</p></div><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></div><div class="bt-fields"><label>Name<input name="name" value="${esc(m.name)}" required maxlength="80"></label><label>Email<input name="email" value="${esc(m.email)}" type="email" maxlength="254"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(m.phone)}" placeholder="Not provided"></label><label>GitHub username<input name="github" value="${esc(m.github)}" maxlength="39" placeholder="username"></label><label>Access status<select name="status">${['active','paused','graduated'].map(s=>`<option ${s===m.status?'selected':''}>${s}</option>`).join('')}</select></label></div><p class="bt-foot bt-contact-note">Contact details are visible to Arya and Milo only.${m.createdAt?` Joined ${esc(new Date(m.createdAt).toLocaleString())}.`:""}</p><label>Private evaluation notes<textarea name="notes" rows="4" maxlength="5000" placeholder="Progress, feedback, and follow-ups…">${esc(m.notes)}</textarea><span>Visible to Arya and Milo only.</span></label><div class="bt-actions"><button class="btn btn-p" type="submit">Save intern</button><button class="btn btn-g" data-code type="button">Reset personal access code</button></div><p class="bt-foot">Pausing or graduating closes their beta access and keeps their record. It does not add them to the main team.</p></form><section class="bt-card"><div class="bt-card-head"><h3>Attendance</h3><span>${days.length} days in</span></div><div class="bt-days">${days.length?days.map(day=>`<span>${esc(dateLabel(day))}</span>`).join(''):'<p class="bt-muted">No attendance marked yet.</p>'}</div></section><section class="bt-card"><div class="bt-card-head"><h3>GitHub activity</h3>${m.github?`<a href="https://github.com/${encodeURIComponent(m.github)}" target="_blank" rel="noopener noreferrer">@${esc(m.github)} ↗</a>`:''}</div><div id="bt-github"><p class="bt-muted">Loading public activity…</p></div></section><section class="bt-card"><div class="bt-card-head"><h3>Two-week recap</h3><span>${recap?.submittedAt?'Submitted':recap?'Draft':'Not started'}</span></div><p class="bt-muted">Due ${esc(dateLabel(batch?.endDate))}</p>${recap?`<h4>What they learned</h4><p class="bt-long">${esc(recap.learned || 'Not added yet.')}</p><h4>What they accomplished</h4><p class="bt-long">${esc(recap.accomplished || 'Not added yet.')}</p>${recap.links?.length?`<h4>Work & links</h4><p class="bt-long">${recap.links.map(link=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a>`).join('<br>')}</p>`:''}`:'<p class="bt-muted">Their recap will appear here as they write it.</p>'}</section>`;
  paintGithub(m,batch,githubRun);
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
    if(!batch?.startDate || !batch?.endDate)throw new Error('Set the batch dates to view GitHub activity for its two weeks.');
    paint(await loadBetaGithub([member],{startDate:batch.startDate,endDate:batch.endDate,onProgress:paint,signal:controller.signal}));
  }catch(error){if(run===githubRun && $('bt-github'))$('bt-github').innerHTML=`<p class="bt-muted">${esc(error.name==='AbortError'?'GitHub took too long to answer. Refresh to try again.':error.message || 'Public GitHub activity is unavailable right now.')}</p>`;}
  finally{clearTimeout(timeout);if(paintGithub.controller===controller)paintGithub.controller=null;}
}
function setBusy(value) {
  busy=value;$('bt-root').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);
  $('bt-refresh').disabled=value;$('bt-new').disabled=value || !data || data.configured===false;
  if(data?.configured===false)$('bt-detail').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
}
function revealInvite(out) {
  if(!out.invite && !out.code)return;
  const invite=out.invite?`${location.origin}/internal/beta#invite=${encodeURIComponent(out.invite)}`:null;
  const text=invite || `Your beta workspace: ${location.origin}/internal/beta\nYour personal access code: ${out.code}`;
  $('bt-code').hidden=false;
  $('bt-code').innerHTML=`<div class="bt-card-head"><b>${invite?'Your batch invite is ready':'Personal access code reset'}</b><button class="mini ghost" type="button" data-dismiss-code>Dismiss</button></div><p>${invite?'Anyone with this link can join this beta batch. Save it now; it is only shown once.':'Save this code and share it directly with this intern. Their previous code and sessions are closed.'}</p><div class="bt-code-row"><code>${esc(invite || out.code)}</code><button class="btn btn-g" data-copy-code type="button">Copy ${invite?'invite link':'access details'}</button></div>`;
  $('bt-code').dataset.invite=text;$('bt-code').scrollIntoView({block:'nearest'});
}
async function change(action,payload,success) {
  if(busy)return;
  setBusy(true);message('Saving…');
  try{
    const out=await api(action,payload);adding=false;
    if(out.createdBatchId){$('bt-batch').appendChild(new Option('',out.createdBatchId));$('bt-batch').value=out.createdBatchId;}
    render();revealInvite(out);message(success);
  }catch(error){message(error.message,true);}finally{setBusy(false);}
}
async function load(force=false) {
  if(!active() || busy)return;
  const token=bridge().session?.();if(!force && loadedFor===token && data)return;
  setBusy(true);message('Loading beta batch…');
  try{await api('list');loadedFor=token;render();if(data.configured!==false)message('');}
  catch(error){message(error.message,true);}finally{setBusy(false);}
}
$('bt-new').addEventListener('click',()=>{adding='new';render();$('bt-batch-form')?.querySelector('input')?.focus();});
$('bt-refresh').addEventListener('click',()=>load(true));
$('bt-batch').addEventListener('change',()=>{adding=false;render();});
$('bt-search').addEventListener('input',()=>{adding=false;render();});
$('bt-root').addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,payload=Object.fromEntries(new FormData(form));
  if(form.id==='bt-member-form')change('memberupdate',{...payload,id:selected},'Intern saved.');
  if(form.id==='bt-batch-form'){
    const edit=adding==='edit';if(edit){payload.id=$('bt-batch').value;payload.active=form.elements.active.checked;}
    change(edit?'batchupdate':'batchadd',payload,edit?'Batch updated.':'Batch created. Share its invite link to bring interns in.');
  }
});
$('bt-root').addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b || busy)return;
  if(b.dataset.member){selected=b.dataset.member;adding=false;render();}
  if(b.hasAttribute('data-cancel')){adding=false;render();}
  if(b.hasAttribute('data-batch-settings')){adding='edit';render();}
  if(b.hasAttribute('data-invite') || b.hasAttribute('data-code')){
    const invite=b.hasAttribute('data-invite');
    b.outerHTML=`<div class="bt-rotate-confirm"><p>${invite?'Replace the shared invite? The previous link will stop accepting new people. Existing members keep access.':'Replace this intern’s code and sign them out?'}</p><button class="mini" type="button" ${invite?'data-confirm-invite':'data-confirm-code'}>Replace</button><button class="mini ghost" type="button" data-cancel>Cancel</button></div>`;
  }
  if(b.hasAttribute('data-confirm-invite'))await change('rotateinvite',{id:$('bt-batch').value},'New invite created. The previous link is closed.');
  if(b.hasAttribute('data-confirm-code'))await change('rotatecode',{id:selected},'Personal access code reset.');
  if(b.hasAttribute('data-dismiss-code')){$('bt-code').hidden=true;$('bt-code').innerHTML='';delete $('bt-code').dataset.invite;}
  if(b.hasAttribute('data-copy-code')){try{await navigator.clipboard.writeText($('bt-code').dataset.invite);message('Copied.');}catch{message('Copy the details shown above.',true);}}
});
window.addEventListener('fomo:view-change',()=>load());
window.addEventListener('fomo:identity',()=>{data=null;loadedFor='';selected='';adding=false;githubRun++;$('bt-roster').innerHTML='';$('bt-detail').innerHTML='';$('bt-code').hidden=true;$('bt-code').innerHTML='';delete $('bt-code').dataset.invite;load();});
load();
