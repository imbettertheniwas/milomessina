import './mobile-viewport.js?v=20261017-audit';
import {newPasswordSalt,passwordProof} from './password.js';
import {createStepEditors} from './steps.js?v=20261017-audit';
import {createSharedTasks,taskRequest} from './shared.js?v=20261017-audit';
import {createSchoolPicker} from './school-search.js';
import {createCalendar} from './calendar.js?v=20261017-audit';
import {PROFILE_KEY,normalizeName,loadProfiles,legacyProgress,readableAccent} from './profile.js';
const cards=[...document.querySelectorAll('[data-task]')],saveStatus=document.querySelector('#save-status');
const dialog=document.querySelector('#welcome'),form=document.querySelector('#welcome-form'),nameInput=document.querySelector('#member-name'),schoolInput=document.querySelector('#member-school'),error=document.querySelector('#welcome-error'),continueButton=document.querySelector('#welcome-continue'),cancelButton=document.querySelector('#welcome-cancel'),retryButton=document.querySelector('#retry-schools');
const schoolPicker=createSchoolPicker(schoolInput,document.querySelector('#school-options'),document.querySelector('#school-search-status'));
let authenticated=false,workspaceReady=false,authMode='signup',authBusy=false;
const emailInput=document.querySelector('#member-email'),passwordInput=document.querySelector('#member-password'),passwordConfirm=document.querySelector('#member-password-confirm');
let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');},removeItem:()=>{}};}
let profiles=loadProfiles(storage),active=profiles.profiles.find(p=>p.id===profiles.activeId)||null,schools=[],loaded=false,loading=false;
const safeColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
function write(){try{storage.setItem(PROFILE_KEY,JSON.stringify(profiles));saveStatus.textContent='Your name and progress are saved in this browser.';return true;}catch{saveStatus.textContent='Browser saving is unavailable. Keep a copy of your update.';return false;}}
function persist(){if(!active||!authenticated)return;active.progress??={};const previous=active.progress.calendar||{};active.progress.calendar={...previous,checks:[cards[0].querySelector('[data-check]').checked],chapter:previous.chapter||active.school.name,notes:previous.notes||''};write();shared.schedule();paintShared();}
function render(){if(!active||!authenticated||!workspaceReady)return;document.querySelector('main').hidden=false;document.querySelector('.topbar').hidden=false;const school=active.school;document.body.classList.add('has-school');const primary=safeColor(school.primary,'#516AF6'),secondary=safeColor(school.secondary,'#221D4B'),ink=readableAccent(primary);for(const [k,v]of Object.entries({'--school-primary':primary,'--school-secondary':secondary,'--school-ink':ink,'--blue':ink}))document.body.style.setProperty(k,v);document.querySelector('#campus-title').textContent=`Let’s start here, ${active.name.split(' ')[0]}.`;document.title=`${school.name} · Campus Tasks`;document.querySelector('#pass-school').textContent=school.name;document.querySelector('.campus-identity').hidden=false;const logo=document.querySelector('#school-logo');logo.hidden=!school.logo;if(school.logo&&/^\/[^/]/.test(school.logo)){logo.src=school.logo;logo.alt=`${school.name} logo`;logo.parentElement.style.background=school.logoBackground==='primary'?primary:'#fff';}else logo.hidden=true;logo.parentElement.hidden=logo.hidden;document.querySelector('#change-profile').hidden=false;const url=new URL(location.href);url.searchParams.set('school',school.id);history.replaceState(null,'',url);void calendar.render();steps.restore();saveStatus.textContent='Your draft is saved in this browser.';paintShared();}
async function enterWorkspace(profile){workspaceReady=true;dialog.close();render();void shared.start(profile);const heading=document.querySelector('#campus-title');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
function setAuthMode(mode){authMode=mode;const signup=mode==='signup';document.querySelector('#signup-fields').hidden=!signup;document.querySelector('#password-confirm-field').hidden=!signup;nameInput.required=signup;schoolInput.required=signup;passwordConfirm.required=signup;passwordConfirm.disabled=!signup;passwordInput.minLength=signup?12:1;passwordInput.autocomplete=signup?'new-password':'current-password';document.querySelector('#password-label').textContent=signup?'Create a password':'Password';document.querySelector('#password-help').textContent=signup?'At least 12 characters. Use a password you don’t use elsewhere.':'Use the password you created for Campus Tasks. If you need help getting back in, contact your fomo point of contact.';document.querySelector('#auth-context').textContent=signup?(active?.token&&!active.account?'Secure your existing profile. Your progress stays with you.':'Upload your chapter’s social calendar. Get $25 once fomo approves it.'):'Sign in to pick up where you left off.';continueButton.textContent=signup?'Create account':'Sign in';continueButton.disabled=authBusy||(signup&&!loaded);document.querySelector('#auth-create').setAttribute('aria-pressed',String(signup));document.querySelector('#auth-signin').setAttribute('aria-pressed',String(!signup));error.textContent='';}
function openProfile(){workspaceReady=false;error.textContent='';nameInput.value=active?.name||'';cancelButton.hidden=true;document.querySelector('main').hidden=true;document.querySelector('.topbar').hidden=true;setAuthMode(active?.account?'signin':'signup');if(loaded)schoolPicker.select(active?.school.id||new URL(location.href).searchParams.get('school')||'');if(!dialog.open)dialog.showModal();}
async function loadSchools(){if(loading)return;loading=true;retryButton.hidden=true;continueButton.disabled=authMode==='signup';schoolInput.disabled=true;error.textContent='';try{const r=await fetch('/api/task-schools');if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.schools)||!data.schools.length)throw Error();schools=data.schools.filter(s=>typeof s.id==='string'&&typeof s.name==='string');schoolPicker.setSchools(schools);schoolInput.placeholder='School name or abbreviation, e.g. SDSU';loaded=true;schoolInput.disabled=false;continueButton.disabled=authBusy;schoolPicker.select(active?.school.id||new URL(location.href).searchParams.get('school')||'');if(active){const current=schools.find(s=>s.id===active.school.id);if(current){active.school=current;render();write();}else if(authenticated){if(!dialog.open)openProfile();schoolPicker.select('');error.textContent='Your saved school is no longer in the current list. Choose a listed school to continue.';}}}catch{error.textContent='We couldn’t load the school list. Please try again.';retryButton.hidden=false;schoolInput.placeholder='School list unavailable';}finally{loading=false;}}
document.querySelector('#auth-new-profile').addEventListener('click',()=>{if(active&&!active.account){delete active.token;delete active.cloud;active.dirty=true;write();}history.replaceState(null,'',location.pathname);document.querySelector('#auth-new-profile').hidden=true;error.textContent='Your browser drafts will be copied into your new account.';});
document.querySelector('#auth-create').addEventListener('click',()=>{setAuthMode('signup');if(!loaded)void loadSchools();});
document.querySelector('#auth-signin').addEventListener('click',()=>setAuthMode('signin'));
form.addEventListener('submit',async event=>{
 event.preventDefault();if(authBusy)return;
 const email=emailInput.value.trim().toLowerCase(),password=passwordInput.value,signup=authMode==='signup';
 const name=normalizeName(nameInput.value),school=schools.find(s=>s.id===schoolPicker.value);
 if(signup&&(!name||!school)){error.textContent='Enter your name and choose a listed school.';return;}
 if(signup&&(password.length<12||password!==passwordConfirm.value)){error.textContent=password.length<12?'Use at least 12 characters for your password.':'Your passwords don’t match.';return;}
 authBusy=true;continueButton.disabled=true;continueButton.textContent=signup?'Creating your account…':'Signing in…';error.textContent='';
 try{
  let out;
  if(signup){const salt=newPasswordSalt(),proof=await passwordProof(password,salt);const legacyToken=active?.token&&!active.account?active.token:new URLSearchParams(location.hash.slice(1)).get('profile')||'';out=await taskRequest(legacyToken,'signup',{email,name,schoolId:school.id,salt,proof});}
  else{const challenge=await taskRequest('','challenge',{email});const proof=await passwordProof(password,challenge.salt);out=await taskRequest('','login',{email,proof});}
  const previous=signup&&active&&!active.account?active:profiles.profiles.find(p=>p.cloud?.member?.id===out.member.id);
  const profile=previous||{id:crypto.randomUUID(),progress:signup&&profiles.profiles.length===0?legacyProgress(storage):{}};
  profile.token=out.token;profile.account=true;profile.email=email;profile.name=out.member.name;profile.school=schools.find(s=>s.id===out.member.schoolId)||{id:out.member.schoolId,name:out.member.schoolName};
  if(!previous){profile.cloud={member:out.member,tasks:out.tasks,steps:out.steps||[]};profile.dirty=signup&&Object.keys(profile.progress).length>0;profiles.profiles.push(profile);}
  active=profile;profiles.activeId=profile.id;authenticated=true;passwordInput.value='';passwordConfirm.value='';write();history.replaceState(null,'',location.pathname);await enterWorkspace(profile);
 }catch(e){if(!dialog.open)dialog.showModal();error.textContent=e.message||'Couldn’t sign in. Please try again.';document.querySelector('#auth-new-profile').hidden=e.code!=='LEGACY_NOT_FOUND';}
 finally{authBusy=false;continueButton.disabled=authMode==='signup'&&!loaded;continueButton.textContent=authMode==='signup'?'Create account':'Sign in';}
});
dialog.addEventListener('cancel',event=>event.preventDefault());retryButton.addEventListener('click',()=>void loadSchools());
document.querySelector('#change-profile').addEventListener('click',async()=>{
 if(authBusy||!active)return;authBusy=true;const button=document.querySelector('#change-profile'),main=document.querySelector('main'),profile=active;button.disabled=true;button.textContent='Saving…';main.inert=true;
 try{await steps.flush(profile);await shared.flush(profile);await taskRequest(profile.token,'logout');profiles.profiles=profiles.profiles.filter(p=>p.id!==active.id);profiles.activeId=null;authenticated=false;active=null;write();emailInput.value='';nameInput.value='';passwordInput.value='';passwordConfirm.value='';openProfile();setAuthMode('signin');}
 catch(e){sharedMessage('You’re still signed in. '+(e.message||'Couldn’t save your latest changes. Please try again.'),true);}finally{authBusy=false;main.inert=false;button.disabled=false;button.textContent='Sign out';continueButton.disabled=authMode==='signup'&&!loaded;}
});
function paintShared(){if(!active)return;
 const task=active.cloud?.tasks?.find(t=>t.taskId==='calendar'),step=active.cloud?.steps?.find(t=>t.taskId==='calendar'&&Number(t.step)===0);
 const status=task?.status==='approved'?'approved':step?.status||task?.status||'new';
 const locked=status==='approved';const card=cards[0];
 card.querySelector('[data-status]').textContent=({draft:'Draft saved',submitted:'In review',approved:'Approved',changes_requested:'Update needed'})[status]||'Ready to start';
 card.classList.toggle('is-approved',locked);
 const feedback=document.querySelector('#task-feedback');feedback.hidden=!task?.feedback||!!step?.feedback;feedback.textContent=task?.feedback?'fomo: '+task.feedback:'';
 card.querySelectorAll('#calendar-file,#remove-calendar,#add-event,.calendar-event input,.calendar-event button').forEach(el=>el.disabled=locked);
 document.querySelector('#reward-note').textContent=locked?'Your calendar is approved. You’ve earned $25.':status==='submitted'?'Calendar received. You’ll earn $25 once fomo approves it.':'Once fomo approves your calendar, you earn $25.';
 document.querySelector('#reload-progress').hidden=!active.cloud;steps.paint();
}
function sharedMessage(text,bad=false){document.querySelector('#shared-message').textContent=text;document.querySelector('#shared-message').classList.toggle('error',bad);saveStatus.textContent=bad?text+' Your draft is kept in this browser.':text;}
const calendar=createCalendar({getProfile:()=>authenticated?active:null,save:persist,onProgress:paintShared,downloadShared:id=>shared.download(id)});
const shared=createSharedTasks({taskIds:['calendar'],getProfile:()=>authenticated?active:null,write,onState:paintShared,onRestore:()=>{render();paintShared();},onMessage:sharedMessage});
const steps=createStepEditors({getProfile:()=>authenticated?active:null,write,shared,onChange:paintShared});
document.querySelector('#reload-progress').addEventListener('click',async()=>{if(!confirm('Load the version saved with fomo? Any unsaved changes in this browser will be replaced.'))return;try{await shared.reload();}catch(error){sharedMessage(error.message,true);}});
openProfile();
const savedProfile=active?.account&&active.token?active:null;

void loadSchools();
void (async()=>{
 if(savedProfile){authenticated=true;await enterWorkspace(savedProfile);}

})();
window.addEventListener('campus-auth-required',event=>{if(event.detail?.token!==active?.token)return;authenticated=false;openProfile();error.textContent='Sign in to continue.';});
