import {betaGroupGithubInitial, loadBetaGroupGithub} from './beta-github.js';
import {buildBetaScheduleOverview, betaScheduleOverviewHTML} from './beta-schedule-overview.js';
import {buildBetaGroupOverview, betaGroupOverviewHTML} from './beta-group-overview.js';

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null, selected='', busy=false, loadedFor='', generation=0, deleteTarget=null, needsRender=false;
let groupGithubStates=[], groupGithubKey='', groupGithubRun=0, groupGithubController=null;
let groupOverviewMarkup='', groupAssignmentsOpen=false;
let scheduleRun=0, scheduleUrl='', scheduleLoading=false;
let overviewFilters={batch:'all',timezone:'all'};
const challengeReviewDrafts=new Map(),challengeReferenceDrafts=new Map(),challengeEditorDrafts=new Map();
let challengeEditorSelected='portfolio',challengeEditorOpen=false,challengeChecklistSequence=0;
const active=()=>document.body.dataset.consoleView==='beta' && bridge().operator?.();
const periodOf=m=>({startDate:m?.startDate,endDate:m?.endDate});
const attendanceOf=id=>(data?.attendance || []).filter(a=>a.memberId===id);
const recapOf=id=>(data?.recaps || []).find(r=>r.memberId===id);
const scheduleOf=id=>(data?.schedules || []).find(schedule=>schedule.memberId===id);
const roadmapEnabled=()=>data?.betaRoadmap===true && Array.isArray(data.challengeCatalog);
const challengeEditingEnabled=()=>roadmapEnabled() && data?.betaChallengeEditing===true && data.configured!==false;
const challengeProgressOf=(memberId,challengeId)=>(data?.challengeProgress || []).find(row=>row.memberId===memberId && row.challengeId===challengeId);
const reviewDraftKey=(memberId,challengeId)=>JSON.stringify([memberId,challengeId]);
const SCHEDULE_FILE_TYPES={'application/pdf':'PDF','image/png':'PNG image','image/jpeg':'JPEG image','text/calendar':'Calendar file'};
const scheduleFileType=type=>Object.prototype.hasOwnProperty.call(SCHEDULE_FILE_TYPES,type)?SCHEDULE_FILE_TYPES[type]:'';
const message=(text,bad=false)=>{$('bt-message').textContent=text;$('bt-message').classList.toggle('bad',bad);};
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
function portfolioUrl(value) {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol) && url.hostname && !url.username && !url.password?url.href:'';}
  catch{return '';}
}
async function api(action,payload={},options={}) {
  const b=bridge(),requestToken=b.session?.(),revision=generation;
  if(action!=='list' && action!=='schedulefile')b.invalidate?.('beta');
  let out;
  if(action==='list' && b.read)out=await b.read('beta',action,payload,options);
  else {
    try {
      const res=await fetch(b.endpoint,{method:'POST',body:JSON.stringify({_api:'beta',_key:b.key,_session:requestToken,action,...payload}),signal:AbortSignal.timeout(20000)});
      out=await res.json();
    }finally{if(action!=='list' && action!=='schedulefile')b.invalidate?.('beta');}
  }
  if(revision!==generation || requestToken!==bridge().session?.() || !bridge().operator?.() || (action!=='list' && !active()))throw Object.assign(new Error('Your session changed. Open Beta again.'),{code:'STALE'});
  if(!out.ok) {
    const unavailable=/unknown (form|action)/i.test(out.error || '');
    throw Object.assign(new Error(unavailable?(action.startsWith('challenge')?'The challenge roadmap is not enabled on the shared service yet. Deploy the updated Apps Script to save challenge changes.':'Beta signup is not enabled on the shared internal service yet. Deploy the updated Apps Script before sharing an invite.'):out.error || 'Could not save this change.'),{code:out.code});
  }
  const next=out.data || out;
  // An authenticated file response is not a replacement for the manager list.
  if(action==='schedulefile')return next;
  if(next.manager!==true)throw Object.assign(new Error('Only Arya and Milo can manage the beta group.'),{code:'FORBIDDEN'});
  data=next;needsRender=true;return next;
}
function render(preserveDetail=false,forceGithub=false) {
  if(!data)return;
  const refreshOverview=needsRender;
  needsRender=false;
  const previousSelected=selected;
  const group=data.members || [],q=$('bt-search').value.toLowerCase();
  const shown=group.filter(m=>`${m.name} ${m.email} ${m.phone || ''} ${m.github}`.toLowerCase().includes(q));
  $('bt-invite-link').value=location.origin+'/internal/beta';
  if(refreshOverview)renderScheduleOverview();
  if(!shown.some(m=>m.id===selected))selected=shown[0]?.id || '';
  if(deleteTarget?.id!==selected)deleteTarget=null;
  $('bt-roster').innerHTML=shown.length?shown.map(m=>`<button type="button" class="bt-person ${selected===m.id?'on':''}" data-member="${esc(m.id)}" aria-pressed="${selected===m.id}"><span class="bt-avatar">${esc(m.name.slice(0,1).toUpperCase())}</span><span><strong>${esc(m.name)}</strong><small>${attendanceOf(m.id).length} ${attendanceOf(m.id).length===1?'day':'days'} in · Recap due ${esc(dateLabel(periodOf(m).endDate))}</small><small>${recapOf(m.id)?.submittedAt?'Recap submitted':'Recap pending'}</small>${roadmapRoster(m.id)}</span><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></button>`).join(''):`<div class="bt-empty"><b>${group.length?'No matches':'Ready for the first arrival'}</b><p>${group.length?'Try another name, email, phone, or GitHub.':'Share the permanent invite above. Interns appear here when they join.'}</p></div>`;
  if(!preserveDetail || previousSelected!==selected)renderMember(group.find(m=>m.id===selected));
  if(data.configured===false)message(data.setupMessage || 'Beta access needs to be configured.',true);
  setBusy(busy);
  syncGroupGithub(forceGithub);
  renderGroupOverview();
}
function renderGroupOverview() {
  if(!active() || !data)return;
  const html=betaGroupOverviewHTML(buildBetaGroupOverview(data,groupGithubStates));
  if(groupOverviewMarkup!==html){
    groupOverviewMarkup=html;
    $('bt-group-overview').innerHTML=groupAssignmentsOpen?html.replace('<details class="bt-group-assignments"','<details open class="bt-group-assignments"'):html;
  }
  $('bt-group-overview').querySelectorAll('button').forEach(button=>button.disabled=busy);
}
function stopGroupGithub() {
  groupGithubRun++;
  if(groupGithubController){groupGithubController.abort();groupGithubKey='';}
  groupGithubController=null;
}
async function syncGroupGithub(force=false) {
  if(!active() || !data)return;
  const members=data.members || [];
  const key=JSON.stringify([new Date().toISOString().slice(0,10),members.map(member=>[member.id,member.github,member.startDate,member.endDate]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
  if(!force && key===groupGithubKey)return;
  stopGroupGithub();groupGithubKey=key;
  groupGithubStates=betaGroupGithubInitial(members);
  const paint=()=>{renderGroupOverview();const member=(data?.members || []).find(member=>member.id===selected);if(member)paintGithub(member);};
  paint();
  if(!groupGithubStates.some(state=>state.status==='loading'))return;
  const run=groupGithubRun,revision=generation,controller=new AbortController();
  groupGithubController=controller;
  const timeout=setTimeout(()=>controller.abort(),30000);
  const current=()=>run===groupGithubRun && revision===generation && active() && groupGithubKey===key;
  const update=states=>{if(current()){groupGithubStates=states;paint();}};
  try {
    update(await loadBetaGroupGithub(members,{signal:controller.signal,force,onProgress:update,maxReads:40}));
  }catch(error){
    if(current()){
      const message=error.name==='AbortError'?'GitHub took too long to answer. Refresh to try again.':error.message || 'Public GitHub activity is unavailable right now.';
      groupGithubStates=groupGithubStates.map(state=>state.status==='loading'?{...state,status:'error',total:null,message}:state);
      paint();
    }
  }finally{clearTimeout(timeout);if(groupGithubController===controller)groupGithubController=null;}
}
function renderScheduleOverview() {
  const view=buildBetaScheduleOverview(data,overviewFilters);
  if(view)overviewFilters={batch:view.batch,timezone:view.timezone};
  $('bt-schedule-overview').innerHTML=challengeEditorSection()+betaScheduleOverviewHTML(view)+challengeReferencesSection();
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
  clearScheduleFile();
  if(!m){$('bt-detail').innerHTML='<div class="bt-card bt-empty"><b>One view of the whole two weeks</b><p>Choose an intern to see attendance, GitHub activity, their recap, and your private evaluation notes.</p></div>';return;}
  const batch=periodOf(m),days=attendanceOf(m.id).map(a=>a.day).sort(),recap=recapOf(m.id),website=portfolioUrl(m.website);
  $('bt-detail').innerHTML=`${reviewEntry(m)}<form id="bt-member-form" class="bt-card" tabindex="-1"><div class="bt-card-head"><div><h3>${esc(m.name)}</h3><p>Your first two weeks · ${esc(dateLabel(batch?.startDate))} – ${esc(dateLabel(batch?.endDate))}</p>${website?`<a class="bt-portfolio" href="${esc(website)}" target="_blank" rel="noopener noreferrer">${esc(new URL(website).hostname)} ↗</a>`:""}</div><span class="bt-status ${esc(m.status)}">${esc(m.status)}</span></div><div class="bt-profile-grid"><div class="bt-profile-contact"><div class="bt-fields"><label>Name<input name="name" value="${esc(m.name)}" required maxlength="80"></label><label>Email<input name="email" value="${esc(m.email)}" type="email" maxlength="254"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(m.phone)}" placeholder="Not provided"></label><label>GitHub username<input name="github" value="${esc(m.github)}" maxlength="39" placeholder="username"></label><label>Portfolio website (optional)<input name="website" type="text" inputmode="url" autocomplete="url" maxlength="300" value="${esc(m.website)}" placeholder="yourname.com"></label><label>Access status<select name="status">${['active','paused','graduated'].map(s=>`<option ${s===m.status?'selected':''}>${s}</option>`).join('')}</select></label></div><p class="bt-foot bt-contact-note">Contact details are visible to Arya and Milo only.${m.createdAt?` Joined ${esc(new Date(m.createdAt).toLocaleString())}.`:""}</p></div><div class="bt-profile-notes"><label>Private evaluation notes<textarea name="notes" rows="4" maxlength="5000" placeholder="Progress, feedback, and follow-ups…">${esc(m.notes)}</textarea><span>Visible to Arya and Milo only.</span></label></div></div><div class="bt-profile-actions"><div class="bt-actions"><button class="btn btn-p" type="submit">Save intern</button><button class="btn btn-g" data-code type="button">Replace personal return link</button></div><div id="bt-delete-controls">${deleteControls(m)}</div></div><p class="bt-foot">Pausing or graduating closes their beta access and keeps their record. It does not add them to the main team.</p></form>${roadmapSection(m)}${scheduleSection(m)}<section id="bt-member-attendance" class="bt-card" tabindex="-1"><div class="bt-card-head"><h3>Attendance</h3><span>${days.length} ${days.length===1?'day':'days'} in</span></div><div class="bt-days">${days.length?days.map(day=>`<span>${esc(dateLabel(day))}</span>`).join(''):'<p class="bt-muted">No attendance marked yet.</p>'}</div></section><section id="bt-member-github" class="bt-card" tabindex="-1"><div class="bt-card-head"><h3>GitHub activity</h3>${m.github?`<a href="https://github.com/${encodeURIComponent(m.github)}" target="_blank" rel="noopener noreferrer">@${esc(m.github)} ↗</a>`:''}</div><div id="bt-github"><p class="bt-muted">Loading public activity…</p></div></section><section class="bt-card"><div class="bt-card-head"><h3>Two-week recap</h3><span>${recap?.submittedAt?'Submitted':recap?'Draft':'Not started'}</span></div><p class="bt-muted">Due ${esc(dateLabel(batch?.endDate))}</p>${recap?`<h4>What they learned</h4><p class="bt-long">${esc(recap.learned || 'Not added yet.')}</p><h4>What they accomplished</h4><p class="bt-long">${esc(recap.accomplished || 'Not added yet.')}</p>${recap.links?.length?`<h4>Work & links</h4><p class="bt-long">${recap.links.map(link=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a>`).join('<br>')}</p>`:''}`:'<p class="bt-muted">Their recap will appear here as they write it.</p>'}</section>`;
  paintGithub(m);
}
function roadmapSummary(memberId) {
  const roadmap=data?.roadmaps?.[memberId] || {},catalog=data?.challengeCatalog || [];
  const total=Number.isSafeInteger(roadmap.total) && roadmap.total>0?roadmap.total:catalog.length;
  const completed=Math.min(total,Math.max(0,Number.isSafeInteger(roadmap.completed)?roadmap.completed:0));
  return {...roadmap,total,completed};
}
function roadmapRoster(memberId) {
  if(!roadmapEnabled())return '';
  const summary=roadmapSummary(memberId),pending=(data.challengeProgress || []).some(row=>row.memberId===memberId && row.status==='submitted');
  return `<small class="bt-roadmap-roster">${summary.completed}/${summary.total} challenges complete${pending?' · Review ready':''}</small>${pending?'<small class="bt-review-badge">Awaiting review</small>':''}`;
}
function reviewEntry(member) {
  if(!roadmapEnabled())return '';
  const pending=(data.challengeProgress || []).filter(row=>row.memberId===member.id && row.status==='submitted').length;
  return pending?`<section class="bt-card bt-review-entry"><div><h3>${pending} ${pending===1?'challenge is':'challenges are'} ready for review</h3><p>Open ${esc(member.name)}’s submitted work to leave feedback, request changes, or approve it.</p></div><button class="btn btn-p" type="button" data-open-review="${esc(member.id)}">Review submitted work</button></section>`:'';
}
function challengeEvidenceLink(value,label) {
  const url=portfolioUrl(value);
  return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
}
function roadmapSection(member) {
  if(!roadmapEnabled())return '<section class="bt-card bt-roadmap"><h3>Challenge roadmap</h3><p class="bt-muted">Challenge progress will appear after the updated shared service is deployed.</p></section>';
  const summary=roadmapSummary(member.id),catalog=data.challengeCatalog,unlocks=summary.unlocks || {};
  const cards=catalog.map((challenge,index)=>{
    const progress=challengeProgressOf(member.id,challenge.id),status=progress?.status,definition=progress?.definition || challenge;
    const complete=status==='approved',pending=status==='submitted',changes=status==='changes_requested';
    const unlocked=complete || pending || changes || challenge.id===summary.currentChallengeId || index<=summary.completed;
    const label=complete?'Complete':pending?'Waiting for review':changes?'Changes requested':unlocked?'In progress':'Locked';
    const state=complete?'complete':pending?'pending':changes?'changes':unlocked?'current':'locked';
    const checks=progress?.checks || [];
    const checked=id=>Array.isArray(checks)?checks.includes(id):checks[id]===true;
    const checklist=(definition.checklist || []).map(item=>`<li class="${checked(item.id)?'done':''}"><span aria-hidden="true">${checked(item.id)?'✓':'○'}</span>${esc(item.label)}<span class="bt-check-state">${checked(item.id)?'Reported complete':'Not checked'}</span></li>`).join('');
    const links=[challengeEvidenceLink(progress?.liveUrl,'Open live site'),challengeEvidenceLink(progress?.repoUrl,'Open repository')].filter(Boolean).join('');
    const iterations=(Array.isArray(progress?.iterationLinks)?progress.iterationLinks:[]).map((link,i)=>challengeEvidenceLink(link,`Iteration ${i+1}`)).filter(Boolean).join('');
    const draft=challengeReviewDrafts.get(reviewDraftKey(member.id,challenge.id));
    const feedback=draft?.submittedAt===progress?.submittedAt?draft?.feedback || '':progress?.feedback || '';
    const submitted=progress?.submittedAt && Number.isFinite(Date.parse(progress.submittedAt))?new Date(progress.submittedAt).toLocaleString():'';
    const reviewed=progress?.reviewedAt && Number.isFinite(Date.parse(progress.reviewedAt))?new Date(progress.reviewedAt).toLocaleString():'';
    return `<article id="bt-challenge-${esc(challenge.id)}" class="bt-challenge ${state}" tabindex="-1"><div class="bt-challenge-head"><span class="bt-challenge-number" aria-hidden="true">${complete?'✓':index+1}</span><div><h4>${esc(definition.title)}</h4><span class="bt-challenge-state">${label}</span></div></div><p class="bt-muted bt-challenge-brief">${esc(definition.brief || '')}</p>${progress?.definition?'<p class="bt-foot">Showing the requirements saved with this submission.</p>':''}${unlocked?`<ul class="bt-challenge-checklist">${checklist}</ul>${definition.minIterations?`<p class="bt-foot">Required pushed iterations: ${esc(definition.minIterations)}</p>`:''}${links?`<div class="bt-challenge-links">${links}</div>`:''}${iterations?`<h5>Pushed iterations</h5><div class="bt-challenge-links">${iterations}</div>`:''}${progress?.notes?`<h5>Intern’s notes</h5><p class="bt-long">${esc(progress.notes)}</p>`:''}${submitted?`<p class="bt-foot">Submitted ${esc(submitted)}</p>`:''}${progress?.feedback?`<div class="bt-challenge-feedback"><h5>Reviewer feedback</h5><p class="bt-long">${esc(progress.feedback)}</p></div>`:''}${reviewed?`<p class="bt-foot">Reviewed ${esc(reviewed)}</p>`:''}${pending?`<form class="bt-challenge-review" data-challenge-review="${esc(challenge.id)}" data-member-id="${esc(member.id)}"><label>Review feedback<textarea name="feedback" rows="3" maxlength="5000" placeholder="Call out what works and the next change to make…">${esc(feedback)}</textarea><span>Visible to this intern. Save feedback to keep this review open, or request changes when another submission is needed.</span></label><div class="bt-actions">${challengeEditingEnabled()?'<button class="btn btn-g" type="submit" data-review-status="submitted">Save feedback</button>':''}<button class="btn btn-p" type="submit" data-review-status="approved">${index<catalog.length-1?'Approve &amp; unlock next':'Approve final challenge'}</button><button class="btn btn-g" type="submit" data-review-status="changes_requested">Request changes</button></div></form>`:complete?'<p class="bt-foot">Approved. This challenge is complete and cannot be reopened.</p>':changes?'<p class="bt-foot">The intern can revise their work and submit it again.</p>':'<p class="bt-foot">Review becomes available when the intern submits this challenge.</p>'}`:'<p class="bt-foot">Unlocks after the preceding challenge is approved.</p>'}</article>`;
  }).join('');
  return `<section id="bt-member-roadmap" class="bt-card bt-roadmap" tabindex="-1"><div class="bt-card-head"><div><h3>Challenge roadmap</h3><p>Build, publish, improve. Approvals unlock the next step.</p></div><span>${summary.completed} of ${summary.total} complete</span></div><progress class="bt-roadmap-progress" max="${Math.max(1,summary.total)}" value="${summary.completed}" aria-label="Challenges completed">${summary.completed}/${summary.total}</progress><div class="bt-roadmap-unlocks"><span class="${unlocks.peerWork?'unlocked':''}">${unlocks.peerWork?'✓':'○'} Peer work · ${unlocks.peerWork?'unlocked':'after challenge 1'}</span><span class="${unlocks.teamReferences?'unlocked':''}">${unlocks.teamReferences?'✓':'○'} Team examples · ${unlocks.teamReferences?'unlocked':'after challenge 2'}</span></div><div class="bt-challenges">${cards}</div></section>`;
}
function editableChallenge(challengeId) {
  return ['portfolio','spend-portal','iterate','feature'].includes(challengeId)?data?.challengeCatalog?.find(challenge=>challenge.id===challengeId):null;
}
function challengeEditorContents() {
  if(!challengeEditingEnabled())return '<h3>Edit challenges</h3><p class="bt-muted">Challenge editing will be available after the shared service is updated.</p>';
  const catalog=data.challengeCatalog.filter(challenge=>editableChallenge(challenge.id));
  if(!catalog.length)return '';
  if(!editableChallenge(challengeEditorSelected))challengeEditorSelected=catalog[0].id;
  const saved=editableChallenge(challengeEditorSelected),draft=challengeEditorDrafts.get(saved.id) || saved;
  return `<details data-challenge-editor-disclosure${challengeEditorOpen?' open':''}><summary>Edit challenges <span>Set the instructions for each roadmap step</span></summary><p class="bt-muted">Changes apply to work that has not been submitted. Submitted and approved work keeps its original requirements.</p><label class="bt-editor-select">Challenge<select data-challenge-editor-select>${catalog.map((challenge,index)=>`<option value="${esc(challenge.id)}"${challenge.id===saved.id?' selected':''}>${index+1}. ${esc(challenge.title)}</option>`).join('')}</select></label><form data-challenge-editor="${esc(saved.id)}"><div class="bt-fields"><label>Challenge title<input name="title" required maxlength="120" value="${esc(draft.title)}"></label><label>Short introduction<input name="teaser" required maxlength="240" value="${esc(draft.teaser)}"></label></div><label>Instructions<textarea name="brief" rows="5" required maxlength="6000">${esc(draft.brief)}</textarea></label><fieldset class="bt-editor-checklist"><legend>Completion checklist</legend>${(draft.checklist || []).map((item,index)=>`<div class="bt-editor-check-row"><label>Requirement ${index+1}<input name="checklist:${esc(item.id)}" required maxlength="300" value="${esc(item.label)}"></label><button class="btn btn-g" type="button" data-challenge-check-remove="${esc(item.id)}" aria-label="Remove requirement ${index+1}">Remove</button></div>`).join('')}<button class="btn btn-g" type="button" data-challenge-check-add>Add requirement</button><p>Keep 1–20 clear requirements. Interns review the updated checklist before submitting.</p></fieldset><div class="bt-editor-footer"><label>Minimum pushed iterations<input name="minIterations" type="number" min="0" max="20" step="1" required value="${esc(draft.minIterations ?? 0)}"><span>Use 0 when no iteration links are required.</span></label><p class="bt-foot">Unlock reward: ${esc(saved.reward || 'The next roadmap step')}<br>Challenge order and unlocks stay the same.</p></div><div class="bt-actions"><button class="btn btn-p" type="submit">Save challenge</button><span>${challengeEditorDrafts.has(saved.id)?'Unsaved changes':'Applies to new work and drafts'}</span></div></form></details>`;
}
function challengeEditorSection() {
  if(!roadmapEnabled())return '';
  return `<section id="bt-challenge-editor" class="bt-card bt-challenge-editor">${challengeEditorContents()}</section>`;
}
function renderChallengeEditor() {
  $('bt-challenge-editor').innerHTML=challengeEditorContents();
  setBusy(busy);
}
function captureChallengeEditor(form) {
  const fields=Object.fromEntries(new FormData(form));
  const draft={title:String(fields.title || ''),teaser:String(fields.teaser || ''),brief:String(fields.brief || ''),minIterations:fields.minIterations ?? '',checklist:Object.entries(fields).filter(([name])=>name.startsWith('checklist:')).map(([name,label])=>({id:name.slice(10),label:String(label)}))};
  challengeEditorDrafts.set(form.dataset.challengeEditor,draft);
  challengeEditorOpen=true;
  return draft;
}
function validateChallengeDraft(draft) {
  if(!draft.title.trim() || !draft.teaser.trim() || !draft.brief.trim())return 'Add a title, short introduction, and instructions.';
  if(draft.title.length>120 || draft.teaser.length>240 || draft.brief.length>6000)return 'Shorten the title, introduction, or instructions to fit the field limits.';
  if(!draft.checklist.length || draft.checklist.length>20)return 'Add between 1 and 20 checklist requirements.';
  const ids=new Set();
  for(const item of draft.checklist) {
    if(!/^[a-z][a-z0-9-]{0,39}$/.test(item.id) || ids.has(item.id))return 'A checklist requirement could not be saved. Remove it and add it again.';
    if(!item.label.trim() || item.label.length>300)return 'Give every checklist requirement a description of 300 characters or fewer.';
    ids.add(item.id);
  }
  if(String(draft.minIterations).trim()==='' || !Number.isInteger(Number(draft.minIterations)) || Number(draft.minIterations)<0 || Number(draft.minIterations)>20)return 'Minimum pushed iterations must be a whole number from 0 to 20.';
  return '';
}
function changeChecklist(form,removeId) {
  if(!form || !challengeEditingEnabled() || !editableChallenge(form.dataset.challengeEditor))return;
  const draft=captureChallengeEditor(form);
  if(removeId!==undefined)draft.checklist=draft.checklist.filter(item=>item.id!==removeId);
  else {
    if(draft.checklist.length>=20){message('A challenge can have at most 20 checklist requirements.',true);return;}
    const ids=new Set(draft.checklist.map(item=>item.id));
    let id;
    do{id=`item-${Date.now().toString(36)}-${(++challengeChecklistSequence).toString(36)}`;}while(ids.has(id));
    draft.checklist.push({id,label:''});
  }
  renderChallengeEditor();
}
function challengeReferencesSection() {
  if(!roadmapEnabled())return '';
  const challenges=data.challengeCatalog.filter(item=>['portfolio','spend-portal'].includes(item.id));
  return `<section class="bt-card bt-challenge-references"><details${challengeReferenceDrafts.size?' open':''}><summary>Team example sites <span>Unlock after challenge 2</span></summary><p class="bt-muted">Add shareable demo versions for interns to explore after their first two approvals. Use sanitized examples with sample data only. These links do not grant access to the production internal console.</p><div class="bt-reference-grid">${challenges.map(challenge=>{
    const saved=(data.challengeReferences || []).find(row=>row.challengeId===challenge.id) || {};
    const reference=challengeReferenceDrafts.get(challenge.id) || saved;
    return `<form data-challenge-reference="${esc(challenge.id)}"><h4>${esc(challenge.title)}</h4><label>Example title<input name="title" maxlength="120" value="${esc(reference.title || '')}" placeholder="Our ${challenge.id==='portfolio'?'portfolio':'practice spend portal'}"></label><label>Shareable demo URL<input name="url" type="url" inputmode="url" maxlength="300" value="${esc(reference.url || '')}" placeholder="https://demo.example.com"></label><label>What to learn from it<textarea name="notes" rows="3" maxlength="3000" placeholder="Point out a few choices to compare with their own version…">${esc(reference.notes || '')}</textarea></label><p class="bt-foot">${saved.url?'Clear the URL and save to remove this example.':'No example published yet.'}</p><div class="bt-actions"><button class="btn btn-g" type="submit">Save example</button>${challengeEvidenceLink(saved.url,'View saved example')}</div></form>`;
  }).join('')}</div></details></section>`;
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
  return `<section id="bt-member-schedule" class="bt-card bt-schedule" tabindex="-1">${heading}${content}</section>`;
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
function paintGithub(member) {
    if(!active() || !$('bt-github'))return;
    const result=groupGithubStates.find(row=>row.memberId===member.id);
    if(!result){$('bt-github').innerHTML='<p class="bt-muted">Public GitHub activity is unavailable right now.</p>';return;}
    const hasCount=['ready','partial'].includes(result.status) && Number.isSafeInteger(result.total) && result.total>=0;
    const window=`${dateLabel(result.startDate)} – ${dateLabel(result.throughDate || result.endDate)} · UTC`;
    const stamp=Number.isFinite(Date.parse(result.updatedAt))?new Date(result.updatedAt).toLocaleString():'';
    const commits=(result.commits || []).filter(commit=>{
      try {const url=new URL(commit.url);return url.protocol==='https:' && url.hostname==='github.com' && !url.username && !url.password;}
      catch{return false;}
    });
    const html=`${hasCount?`<p><strong>${result.partial?'At least ':''}${result.total} public ${result.total===1?'commit':'commits'}</strong></p>`:''}<p class="bt-muted">${esc(window)}${result.ongoing?' · Period in progress':''}</p><p class="bt-muted">${esc(result.message || 'Public GitHub activity is unavailable right now.')}</p>${stamp?`<p class="bt-foot">Checked ${esc(stamp)}</p>`:''}${commits.length?`<details><summary>${result.detailsLimited?'Recent commit details':'Commit details'} · ${commits.length}</summary>${commits.map(commit=>`<article class="bt-checkin"><a href="${esc(commit.url)}" target="_blank" rel="noopener noreferrer">${esc(commit.message || 'View commit')}</a><p class="bt-foot">${esc(commit.repo)} · ${esc(dateLabel(String(commit.date).slice(0,10)))} UTC</p></article>`).join('')}${result.detailsLimited?'<p class="bt-foot">Only a selection of commit details is shown; the count above includes all commits found.</p>':''}</details>`:''}<p class="bt-foot">${esc(result.scope || 'Public authored commits in owned, non-fork repositories. Private work and work in other owners’ repositories are not included.')}</p>`;
    if($('bt-github').innerHTML!==html)$('bt-github').innerHTML=html;
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
  generation++;data=null;loadedFor='';selected='';deleteTarget=null;needsRender=false;
  challengeReviewDrafts.clear();challengeReferenceDrafts.clear();challengeEditorDrafts.clear();
  challengeEditorSelected='portfolio';challengeEditorOpen=false;challengeChecklistSequence=0;
  overviewFilters={batch:'all',timezone:'all'};
  clearScheduleFile();
  stopGroupGithub();groupGithubStates=[];groupGithubKey='';groupOverviewMarkup='';groupAssignmentsOpen=false;
  ['bt-group-overview','bt-schedule-overview','bt-roster','bt-detail','bt-code'].forEach(id=>$(id).innerHTML='');
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
    if(action==='challengereview')challengeReviewDrafts.delete(reviewDraftKey(payload.memberId,payload.challengeId));
    if(action==='challengereference')challengeReferenceDrafts.delete(payload.challengeId);
    if(action==='challengeupdate')challengeEditorDrafts.delete(payload.challengeId);
    render();revealPersonalLink(out);message(success);
  }catch(error){if(revision===generation)requestError(error);}
  finally{if(revision===generation)setBusy(false);}
}
async function load(force=false) {
  if(!active() || busy)return;
  const token=bridge().session?.();
  if(!force && loadedFor===token && data){if(needsRender){render();if(data.configured!==false)message('');}else{syncGroupGithub();renderGroupOverview();}return;}
  const revision=generation;
  setBusy(true);message('Loading Beta…');
  try{await api('list',{}, {fresh:force});if(revision!==generation)return;loadedFor=token;if(active()){render(false,force);if(data.configured!==false)message('');}}
  catch(error){if(revision===generation)requestError(error);}
  finally{if(revision===generation)setBusy(false);}
}
$('bt-refresh').addEventListener('click',()=>load(true));
$('bt-search').addEventListener('input',()=>render(true));
$('bt-schedule-overview').addEventListener('change',event=>{
  const filter=event.target.dataset.overviewFilter;
  if(busy || !active() || !['batch','timezone'].includes(filter))return;
  overviewFilters={...overviewFilters,[filter]:event.target.value};
  if(filter==='batch')overviewFilters.timezone='all';
  renderScheduleOverview();
});
$('bt-copy-invite').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('bt-invite-link').value);message('Permanent invite link copied.');}
  catch{$('bt-invite-link').focus();$('bt-invite-link').select();message('Select and copy the link above.');}
});
$('bt-root').addEventListener('input',event=>{
  const form=event.target.closest('form');
  if(!form || busy || !active())return;
  const payload=Object.fromEntries(new FormData(form));
  if(form.dataset.challengeReview) {
    const memberId=form.dataset.memberId,challengeId=form.dataset.challengeReview;
    challengeReviewDrafts.set(reviewDraftKey(memberId,challengeId),{feedback:payload.feedback || '',submittedAt:challengeProgressOf(memberId,challengeId)?.submittedAt});
  }
  if(form.dataset.challengeReference)challengeReferenceDrafts.set(form.dataset.challengeReference,payload);
  if(form.dataset.challengeEditor && challengeEditingEnabled() && editableChallenge(form.dataset.challengeEditor))captureChallengeEditor(form);
});
$('bt-root').addEventListener('change',event=>{
  if(!event.target.hasAttribute?.('data-challenge-editor-select') || busy || !active() || !challengeEditingEnabled() || !editableChallenge(event.target.value))return;
  challengeEditorSelected=event.target.value;challengeEditorOpen=true;renderChallengeEditor();
});
$('bt-root').addEventListener('toggle',event=>{
  if(event.target.hasAttribute?.('data-challenge-editor-disclosure'))challengeEditorOpen=event.target.open;
  if(event.target.hasAttribute?.('data-group-assignments'))groupAssignmentsOpen=event.target.open;
},true);
$('bt-root').addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,payload=Object.fromEntries(new FormData(form));
  if(form.id==='bt-member-form')return change('memberupdate',{...payload,id:selected},'Intern saved.');
  if(busy || !active() || !roadmapEnabled())return;
  if(form.dataset?.challengeEditor) {
    const challengeId=form.dataset.challengeEditor;
    if(!challengeEditingEnabled() || !editableChallenge(challengeId))return;
    const draft=captureChallengeEditor(form),error=validateChallengeDraft(draft);
    if(error){message(error,true);return;}
    return change('challengeupdate',{challengeId,title:draft.title.trim(),teaser:draft.teaser.trim(),brief:draft.brief.trim(),checklist:draft.checklist.map(item=>({id:item.id,label:item.label.trim()})),minIterations:Number(draft.minIterations)},'Challenge saved. New work and drafts now use these instructions.');
  }
  if(form.dataset?.challengeReview) {
    const memberId=form.dataset.memberId,challengeId=form.dataset.challengeReview,status=event.submitter?.dataset.reviewStatus,feedback=String(payload.feedback || '').trim();
    if(memberId!==selected || challengeProgressOf(memberId,challengeId)?.status!=='submitted' || !['approved','changes_requested','submitted'].includes(status) || (status==='submitted' && !challengeEditingEnabled()))return;
    if(status!=='approved' && !feedback){message('Add feedback so the intern knows what to improve.',true);return;}
    challengeReviewDrafts.set(reviewDraftKey(memberId,challengeId),{feedback,submittedAt:challengeProgressOf(memberId,challengeId)?.submittedAt});
    return change('challengereview',{memberId,challengeId,status,feedback},status==='approved'?'Challenge approved. Their progress and unlocks are updated.':status==='submitted'?'Feedback saved. This challenge is still waiting for review.':'Changes requested. The intern can update and resubmit.');
  }
  if(form.dataset?.challengeReference) {
    const challengeId=form.dataset.challengeReference,url=String(payload.url || '').trim(),title=String(payload.title || '').trim(),notes=String(payload.notes || '').trim();
    if(!['portfolio','spend-portal'].includes(challengeId))return;
    if(url && !portfolioUrl(url)){message('Use a complete http or https demo URL.',true);return;}
    if(url && !title){message('Give this team example a title.',true);return;}
    return change('challengereference',{challengeId,title,url,notes},url?'Team example saved. Interns see it after challenge 2.':'Team example removed.');
  }
});
$('bt-root').addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b || busy)return;
  if(b.hasAttribute('data-group-member')) {
    if(!active() || !(data?.members || []).some(member=>member.id===b.dataset.groupMember))return;
    const sections={attendance:'bt-member-attendance',github:'bt-member-github',roadmap:'bt-member-roadmap',profile:'bt-member-form'};
    const id=sections[b.dataset.groupSection];if(!id)return;
    selected=b.dataset.groupMember;deleteTarget=null;$('bt-search').value='';render();
    $(id)?.scrollIntoView({behavior:'smooth',block:'start'});$(id)?.focus({preventScroll:true});return;
  }
  if(b.hasAttribute('data-challenge-check-add') || b.hasAttribute('data-challenge-check-remove')) {
    if(!active())return;
    changeChecklist(b.closest('form'),b.hasAttribute('data-challenge-check-remove')?b.dataset.challengeCheckRemove:undefined);return;
  }
  if(b.hasAttribute('data-open-review')) {
    if(!active() || b.dataset.openReview!==selected)return;
    const pending=(data?.challengeProgress || []).find(row=>row.memberId===selected && row.status==='submitted');
    const target=pending?$(`bt-challenge-${pending.challengeId}`):$('bt-member-roadmap');
    target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});return;
  }
  if(b.hasAttribute('data-overview-member')){
    if(!(data?.members || []).some(member=>member.id===b.dataset.overviewMember))return;
    selected=b.dataset.overviewMember;deleteTarget=null;$('bt-search').value='';render();
    $('bt-member-schedule')?.scrollIntoView({behavior:'smooth',block:'start'});
    $('bt-member-schedule')?.focus({preventScroll:true});
  }
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
window.addEventListener('fomo:view-change',()=>{if(!active()){clearScheduleFile();stopGroupGithub();}load();});
window.addEventListener('fomo:identity',()=>{clearPrivate();message('');load();});
load();
