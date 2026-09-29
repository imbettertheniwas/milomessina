import {STEPS} from './quiz.mjs?v=2';
import {MISSIONS,FRAT_REWARD,potentialReward,missionPayload,introText,missionFor} from './missions.mjs?v=5';
import {viewsAt,earningsFor,formatViews} from './earnings.mjs?v=5';
import {ENDPOINT} from './config.js';
const app=document.querySelector('#app');
const KEY='fomo-girls-missions-v2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({view:'board',answers:{},missions:[],id:crypto.randomUUID(),submitted:false});
let estimatePosition=575;
let state=fresh(),sending=false,toast='',lastAdded=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
try{
 const saved=JSON.parse(sessionStorage.getItem(KEY));
 if(saved&&saved.answers&&Array.isArray(saved.missions)&&saved.missions.every(id=>id==='circle'||MISSIONS.some(m=>m.id===id))&&typeof saved.id==='string')state={...saved,missions:saved.missions.filter(id=>id!=='circle'),view:saved.submitted?'saved':'board'};
 else{const old=JSON.parse(sessionStorage.getItem('fomo-girls-v1'));if(old?.answers)state.answers=old.answers;}
}catch{}
function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function focusTitle(){const h=app.querySelector('h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}window.scrollTo({top:0,behavior:'instant'});}
function reset(){if(sending)return;state=fresh();toast='';try{sessionStorage.removeItem('fomo-girls-v1');}catch{}persist();render();focusTitle();}
function navigate(view){if(sending)return;state.view=state.submitted?'saved':view;render();focusTitle();}
function input(key,label,placeholder='',required=false,type='text'){
 return `<label class="field">${label}<input name="${key}" type="${type}" value="${esc(state.answers[key])}" placeholder="${esc(placeholder)}" maxlength="${key==='email'?160:100}" ${required?'required':''} ${key==='email'?'autocomplete="email"':key==='name'?'autocomplete="name"':key==='city'?'autocomplete="address-level2"':''}></label>`;
}
function select(key,label,options,required=false){
 return `<label class="field">${label}<select name="${key}" ${required?'required':''}><option value="">${required?'Choose one':'Optional'}</option>${options.map(([v,l])=>`<option value="${v}" ${state.answers[key]===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
}
const shortChoices={
 college:['In college','Graduated','Not in college'],
 connections:['Chapter leaders','Well-connected friends','A few frat friends','No one yet'],
 creator:['I post regularly','I want to start','Just for fun','Not a creator'],
 sorority:['Member','Alumna','Friends in a chapter','No ties'],
 dinners:['I’m in','With a friend','Tell me more','Not now']
};
function qualifier(key,label){return `<fieldset class="tap-options"><legend>${label}</legend><div>${STEPS.find(q=>q.key===key).choices.map(([v],i)=>`<label><input type="radio" name="${key}" value="${v}" aria-label="${shortChoices[key][i]}" required ${state.answers[key]===v?'checked':''}><span>${shortChoices[key][i]}</span></label>`).join('')}</div></fieldset>`;}
function capture(form){for(const el of form.elements){if(!el.name||el.name==='website'||(el.type==='radio'&&!el.checked))continue;state.answers[el.name]=el.type==='checkbox'?el.checked:el.value.trim();}persist();}
function missionButton(m,label){return `<button class="primary" data-mission="${m.id}">${label||'Explore mission'} <span>↗</span></button>`;}
function board(){const frat=MISSIONS[0],pinned=state.missions.includes('frat');return `<section class="mission-board"><div class="board-intro"><h1>What are you<br><em>up for?</em></h1><button class="surprise-button" id="surprise" aria-label="Pick one for me"><span aria-hidden="true">⚄</span> Pick one for me</button></div><div class="board-layout"><div class="mission-deck"><article class="bounty-card ${pinned?'is-pinned':''}" data-tilt><div class="bounty-top"><span class="mission-label">BRING A FRAT</span>${pinned?'<span class="status-tag">✓ Added</span>':'<span class="card-spark" aria-hidden="true">✳</span>'}</div><div class="bounty-body"><div><h2>Know someone<br>in a frat?</h2><p>Paid after the chapter onboards.</p></div><div class="bounty-amount"><strong>$${FRAT_REWARD}</strong></div></div><div class="bounty-bottom">${missionButton(frat,pinned?'Edit details':'I know someone')}<span>FOMO verifies each referral.</span></div></article><div class="side-missions">${MISSIONS.slice(1).map(missionCard).join('')}</div></div></div>${state.missions.length?`<div class="selection-next"><span>${state.missions.length} selected</span><button class="primary" id="continue-selection">Continue <span>↗</span></button></div>`:''}<div class="board-toast" role="status">${esc(toast)}</div></section>`;}
function missionCard(m){
 const selected=state.missions.includes(m.id),top=`<span class="mission-card-top"><span class="mission-icon" aria-hidden="true">${m.icon}</span><span class="card-add" aria-hidden="true">${selected?'✓':'＋'}</span></span>`;
 const heading=`<h3>${m.title}</h3>`;
 if(m.id==='creator')return `<article class="mission-card creator-card ${selected?'is-pinned':''}" data-card="creator"><button class="creator-open" data-mission="creator" aria-label="${selected?'Edit':'Explore'} Make videos">${top}${heading}</button><div class="earnings-estimate"><div class="estimate-labels"><label for="view-estimate"><output id="view-count">100K</output> qualifying views</label><span>Estimated earnings</span></div><output class="estimate-pay" id="view-pay">$200</output><input id="view-estimate" class="views-slider" type="range" min="0" max="1000" value="${estimatePosition}" aria-label="Estimated qualifying views" aria-describedby="estimate-note"><div class="range-ends" aria-hidden="true"><span>1K views</span><span>3M views</span></div><p id="estimate-note">$2 / 1K views · $5K cap per approved video.<br>$25 approval bonus is separate.</p></div></article>`;
 const art=m.id==='dinner'?`<span class="receipt-art" aria-hidden="true"><span class="receipt-brand">fomo</span><span class="receipt-label">INFLUENCER DINNER</span><span class="receipt-line"><span>Good food</span><span>✓</span></span><span class="receipt-line"><span>Your content</span><span>✓</span></span><span class="receipt-total"><span>Your meal</span><b>COMPED</b></span><span class="receipt-barcode"></span></span>`:m.id==='internship'?`<span class="pass-art" aria-hidden="true"><span class="pass-clip"></span><span class="pass-brand">fomo <small>TEAM</small></span><span class="pass-name">MAKE IT<br>HAPPEN.</span><span class="pass-footer">CAMPUS INTERN <span>↗</span></span></span>`:m.id==='stories'?`<span class="story-art" aria-hidden="true"><span class="story-progress"><i></i><i></i><i></i></span><span class="story-avatar">f</span><strong>$20</strong><span>PER STORY</span><span class="story-reply">Your story <b>↗</b></span></span>`:'';
 return `<button class="mission-card ${m.id}-card ${selected?'is-pinned':''}" data-mission="${m.id}" data-tilt>${top}<span class="card-content"><span class="card-copy">${heading}<span class="card-description">${m.description}</span></span>${art}</span></button>`;
}
function bindEstimate(){
 const slider=app.querySelector('#view-estimate');if(!slider)return;
 function paint(){estimatePosition=Number(slider.value);const views=viewsAt(estimatePosition),pay=earningsFor(views).toLocaleString('en-US');slider.style.setProperty('--progress',estimatePosition/10+'%');app.querySelector('#view-count').textContent=formatViews(views);app.querySelector('#view-pay').textContent='$'+pay;slider.setAttribute('aria-valuetext',views.toLocaleString('en-US')+' qualifying views; estimated earnings $'+pay);}
 slider.addEventListener('input',paint);paint();
}
function missionFields(id){switch(id){
 case 'frat':return qualifier('connections','Who do you know?')+input('connection_chapter','Fraternity','e.g. Sigma Chi',true)+input('referral_school','University','e.g. University of Miami',true);
 case 'stories':
 case 'creator':return qualifier('creator','Do you make content?')+'<details class=optional-fields><summary>Platform & audience (optional)</summary>'+select('platform','Your main platform',[['Instagram','Instagram'],['TikTok','TikTok'],['YouTube','YouTube'],['Other','Other']])+select('audience','Your audience',['Just starting','Under 1k','1k–5k','5k–10k','10k–50k','50k+'].map(v=>[v,v]))+'</details>';
  case 'internship':return select('internship_role','Where you want to lead',[['president','Campus president — lead the team'],['growth','Growth — bring people in'],['partnerships','Partnerships — build relationships'],['content','Content — shape the story'],['culture','Culture — make the plans']],true);
 case 'dinner':return qualifier('dinners','Coming to dinner?')+select('dinner_role','What sounds good?',[['content','Attend + make content for a comped dinner'],['attend','Just attend — no content comp'],['bring','Bring my girls — no content comp'],['host','Help organize or host']],true)+select('dinner_style','Dinner vibe (optional)',['A small, cozy group','Creators & collaborators','Girls’ night','Surprise me'].map(v=>[v,v]));
}}
function openMission(id){
 if(sending||state.submitted)return;
 const m=MISSIONS.find(x=>x.id===id),dialog=document.querySelector('#mission-dialog');
 dialog.innerHTML=`<button class="close" type="button" aria-label="Close">×</button><p class="eyebrow">${m.tag}</p><h2 id="mission-title">${m.title}</h2><p class="mission-note">${m.benefit}</p><details class="how-it-works"><summary>How it works</summary><ol class="mission-steps">${m.steps.map(s=>`<li>${s}</li>`).join('')}</ol></details><form id="mission-form"><div class="fields">${missionFields(id)}</div><button class="primary" type="submit">${state.missions.includes(id)?'Save changes':'I’m interested'} <span>＋</span></button>${state.missions.includes(id)?'<button class="start-over" type="button" id="remove-selection">Remove selection</button>':''}</form>`;
 dialog.querySelector('.close').onclick=()=>dialog.close();
 dialog.querySelector('#remove-selection')?.addEventListener('click',()=>{state.missions=state.missions.filter(x=>x!==id);state.answers=missionPayload(state.answers,state.missions);lastAdded=null;toast='Removed.';persist();dialog.close();render();});
 const form=dialog.querySelector('form');
 form.onsubmit=e=>{
  e.preventDefault();capture(form);
  const dinner=form.querySelector('[name=dinners]');
  if(id==='dinner'&&state.answers.dinner_role==='content'&&!['yes','friend','maybe'].includes(state.answers.dinners)){dinner.setCustomValidity('Choose a dinner option to join the content offer.');form.reportValidity();return;}
  const isNew=!state.missions.includes(id);if(isNew)state.missions.push(id);
  const origin=form.querySelector('.primary').getBoundingClientRect();
  toast=isNew?`${m.short} added.`:'Updated.';lastAdded=isNew?id:null;
  persist();dialog.close();render();
  const target=app.querySelector('#continue-selection');
  if(isNew)celebrate(m,origin,target);
  app.querySelector(`.mission-deck [data-mission="${id}"]`)?.focus({preventScroll:true});
 };
 form.addEventListener('change',()=>form.querySelector('[name=dinners]')?.setCustomValidity(''));
 dialog.showModal();
}
function checkout(){return `<section class="playbook-checkout"><button class="back" id="back-board">← Explore</button><div class="checkout-layout"><div><h1>Where can we<br><em>reach you?</em></h1><div class="checkout-missions">${state.missions.map(id=>{const m=missionFor(id,state.answers);return `<div><span>${m.icon} ${m.short}</span><b>${m.reward}</b></div>`;}).join('')}</div></div><form id="profile-form">${qualifier('college','Are you in college?')}<div class="fields" id="school-fields">${schoolFields()}</div><div class="fields"><div class="field-row">${input('name','Name','First and last',true)}${input('city','City','Miami, FL',true)}</div>${input('email','Email','you@example.com',true,'email')}${input('instagram','Instagram (optional)','@yourname')}<label class="consent"><input type="checkbox" name="consent" required ${state.answers.consent?'checked':''}><span>FOMO can save these details and contact me about my selections.</span></label><label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label></div><p class="error" id="error" role="alert"></p><button class="primary" type="submit" id="submit">Send to FOMO <span>↗</span></button></form></div></section>`;}
function schoolFields(){return ['student','graduate'].includes(state.answers.college)?input('school',state.answers.college==='student'?'Your university':'Your university (optional)','e.g. University of Miami',state.answers.college==='student'):'';}
function saved(){const a=missionPayload(state.answers,state.missions);return `<section class="saved-playbook"><p class="eyebrow">SENT ✓</p><h1>Thanks,<br><em>${esc(a.name.split(' ')[0])}.</em></h1><p>We’ll email you at ${esc(a.email)} about next steps.</p><div class="saved-missions">${state.missions.map(id=>{const m=missionFor(id,a);return `<article class="saved-mission"><span class="mission-icon">${m.icon}</span><h2>${m.title}</h2>${id==='frat'?`<p>${esc(a.connection_chapter)} · ${esc(a.referral_school)}</p><div class="next-move"><p>Send this to your contact:</p><p class="intro-copy">${esc(introText(a))}</p><button class="primary" id="copy-intro">Copy intro <span>↗</span></button><span class="copy-status" role="status"></span></div>`:''}<details class="how-it-works"><summary>${m.reward} — details</summary><p>${m.benefit}</p></details></article>`;}).join('')}</div><div class="result-actions"><button class="primary" id="share">Send to a friend <span>↗</span></button><button class="text-button" id="download">Download my list ↓</button></div><p id="share-status" class="micro" role="status"></p><button class="start-over" id="reset">Clear this device</button></section>`;}
function celebrate(m,from,target){
 if(reducedMotion.matches||!target)return;
 let to=target.getBoundingClientRect();
 if(to.top>innerHeight||to.bottom<0)to=app.querySelector('.selection-next')?.getBoundingClientRect()||from;
 const token=document.createElement('span');token.className='flying-token';token.textContent=m.icon;token.setAttribute('aria-hidden','true');document.body.append(token);
 const flight=token.animate([{transform:`translate(${from.x+from.width/2-18}px,${from.y-18}px) scale(.6)`,opacity:0},{offset:.2,opacity:1},{transform:`translate(${to.x+to.width/2-18}px,${to.y+to.height/2-18}px) scale(1)`,opacity:0}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});flight.onfinish=()=>token.remove();
}
function bindMotion(){
 if(lastAdded){const card=app.querySelector(lastAdded==='frat'?'.bounty-card':`.mission-card[data-mission="${lastAdded}"],.mission-card[data-card="${lastAdded}"]`);if(card&&!reducedMotion.matches)card.animate([{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:650});lastAdded=null;}
 if(reducedMotion.matches||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
 app.querySelectorAll('[data-tilt]').forEach(card=>{
  card.onpointermove=e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;card.style.setProperty('--rx',`${(y-.5)*-5}deg`);card.style.setProperty('--ry',`${(x-.5)*5}deg`);card.style.setProperty('--px',`${x*100}%`);card.style.setProperty('--py',`${y*100}%`);};
  card.onpointerleave=()=>{card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');};
 });
}
function render(){
 app.innerHTML=state.submitted?saved():state.view==='checkout'?checkout():board();
 document.querySelector('#nav-start').hidden=!state.submitted&&!state.missions.length;
 document.querySelector('#nav-start').textContent=state.submitted?'Your selections ✓':'Continue ↗';
 bindMotion();bindEstimate();
 app.querySelector('#surprise')?.addEventListener('click',()=>{const options=MISSIONS.filter(m=>!state.missions.includes(m.id));const pick=(options.length?options:MISSIONS)[Math.floor(Math.random()*(options.length||MISSIONS.length))];openMission(pick.id);});
 app.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>openMission(b.dataset.mission));
 app.querySelector('#reset')?.addEventListener('click',reset);
 app.querySelector('#continue-selection')?.addEventListener('click',()=>navigate('checkout'));
 app.querySelector('#back-board')?.addEventListener('click',()=>navigate('board'));
 const form=app.querySelector('#profile-form');
 if(form){form.addEventListener('input',()=>capture(form));form.addEventListener('change',e=>{if(e.target.name==='college'){capture(form);form.querySelector('#school-fields').innerHTML=schoolFields();}});form.onsubmit=e=>{e.preventDefault();capture(form);submit();};}
 app.querySelector('#copy-intro')?.addEventListener('click',()=>copy(introText(state.answers),'Copied.'));
 app.querySelector('#share')?.addEventListener('click',()=>copy(new URL('/girls',location.origin).href,'Link copied.'));
 app.querySelector('#download')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({missions:state.missions,answers:missionPayload(state.answers,state.missions),conditionalReward:potentialReward(state.missions),earned:0},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='my-fomo-playbook.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}
async function copy(text,confirmation){const status=app.querySelector('.copy-status')&&text!==new URL('/girls',location.origin).href?app.querySelector('.copy-status'):app.querySelector('#share-status');try{await navigator.clipboard.writeText(text);status.textContent=confirmation;}catch{status.textContent='Couldn’t copy automatically. Select and copy the text above, or share this page’s address.';}}
async function submit(){
 if(sending)return;sending=true;const form=app.querySelector('#profile-form'),error=app.querySelector('#error'),button=app.querySelector('#submit');const controls=[...app.querySelectorAll('button,input,select')];controls.forEach(el=>el.disabled=true);error.textContent='';button.textContent='Sending…';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({_api:'girls',action:'join',flow:'missions-v2',id:state.id,missions:state.missions,answers:missionPayload(state.answers,state.missions),_hp:form.querySelector('[name=website]').value}),signal:controller.signal});
  if(!response.ok)throw new Error('Couldn’t send. Your details are still here — try again.');
  const data=await response.json();
  if(!data.ok||data.id!==state.id||data.flow!=='missions-v2')throw new Error(data.error&&data.error!=='unknown form'?data.error:'Signup isn’t connected yet. Your list is saved in this tab. Try again later.');
  state.submitted=true;state.view='saved';persist();render();focusTitle();
 }catch(err){error.textContent=err.name==='AbortError'?'That took too long. Your list is safe — try again.':err.message;}
 finally{clearTimeout(timeout);sending=false;controls.forEach(el=>el.disabled=false);if(button.isConnected)button.innerHTML='Send to FOMO <span>↗</span>';}
}
const missionDialog=document.createElement('dialog');missionDialog.id='mission-dialog';missionDialog.setAttribute('aria-labelledby','mission-title');document.body.append(missionDialog);

document.querySelector('#nav-start').onclick=()=>navigate(state.missions.length?'checkout':'board');
document.querySelector('#privacy-button').onclick=()=>document.querySelector('#privacy').showModal();
document.querySelector('#privacy .close').onclick=()=>document.querySelector('#privacy').close();
render();
