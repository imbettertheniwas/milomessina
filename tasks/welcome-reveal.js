import {readableAccent} from './profile.js';

let entry=null;
function personalize(reveal,profile){
 const school=profile?.school;
 reveal.style.setProperty('--arrival-accent',school?.primary?readableAccent(school.primary):'#666674');
 reveal.querySelector('[data-arrival-name]').textContent=profile?.name?`You’re in, ${profile.name.split(' ')[0]}.`:'You’re in.';
 reveal.querySelector('#arrival-description').textContent='Your campus. Your call.';
 reveal.querySelector('.arrival-campus').hidden=!school?.name;
 reveal.querySelector('[data-arrival-school]').textContent=school?.name||'';
 const logo=reveal.querySelector('[data-arrival-logo]');
 const hasLogo=typeof school?.logo==='string'&&/^\/[^/]/.test(school.logo);
 logo.hidden=!hasLogo;
 if(hasLogo){logo.src=school.logo;logo.alt='';logo.parentElement.style.background=school.logoBackground==='primary'?readableAccent(school.primary):'#fff';}
 logo.parentElement.hidden=!hasLogo;
}
// Play the welcome immediately; authentication gates entry, not the animation.
export function beginCampusWelcome(profile){
 if(entry)return entry.finished;
 const reveal=document.querySelector('#campus-welcome');
 if(!reveal)return Promise.resolve(true);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const current={reveal,reduced,ready:false,leaving:false,entryRequested:false};
 entry=current;
 current.finished=new Promise(resolve=>{current.resolve=resolve;});
 personalize(reveal,profile);
 reveal.classList.remove('is-leaving');
 reveal.classList.toggle('is-reduced',reduced);
 const events=new AbortController();
 current.finish=()=>{
  current.entryRequested=true;
  if(!current.ready||current.leaving)return;
  current.leaving=true;clearTimeout(current.advanceTimer);
  if(reduced){reveal.close();return;}
  reveal.classList.add('is-leaving');
  current.closeTimer=setTimeout(()=>reveal.close(),220);
 };
 reveal.querySelector('[data-arrival-enter]').addEventListener('click',current.finish,{signal:events.signal});
 reveal.addEventListener('cancel',event=>{event.preventDefault();current.finish();},{signal:events.signal});
 reveal.addEventListener('close',()=>{
  clearTimeout(current.advanceTimer);clearTimeout(current.closeTimer);events.abort();
  document.body.classList.remove('campus-arriving');
  if(entry===current)entry=null;
  current.resolve(current.ready&&!current.cancelled);
 },{once:true});
 document.body.classList.add('campus-arriving');
 reveal.showModal();
 if(!reduced)current.advanceTimer=setTimeout(current.finish,1800);
 return current.finished;
}
export function cancelCampusWelcome(){
 if(!entry)return;
 entry.cancelled=true;
 entry.reveal.close();
}
// Authentication completes without restarting the intro or adding another wait.
export function showCampusWelcome(profile){
 const finished=beginCampusWelcome(profile);
 if(!entry||entry.ready)return finished;
 personalize(entry.reveal,profile);
 entry.ready=true;
 if(entry.entryRequested)entry.finish();
 return finished;
}
