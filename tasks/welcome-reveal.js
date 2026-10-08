import {readableAccent} from './profile.js';

let entry=null;
// Open immediately; authentication and workspace loading happen behind this shell.
export function beginCampusWelcome(){
 if(entry)return entry.finished;
 const reveal=document.querySelector('#campus-welcome');
 if(!reveal)return Promise.resolve(true);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const current={reveal,reduced,ready:false,leaving:false};
 entry=current;
 current.finished=new Promise(resolve=>{current.resolve=resolve;});
 reveal.style.setProperty('--arrival-accent','#666674');
 reveal.querySelector('[data-arrival-name]').textContent='Opening your campus';
 reveal.querySelector('#arrival-description').textContent='Getting your workspace ready.';
 reveal.classList.remove('is-leaving');
 reveal.classList.add('is-loading');
 reveal.classList.toggle('is-reduced',reduced);
 const events=new AbortController();
 current.finish=()=>{
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
 return current.finished;
}
export function cancelCampusWelcome(){
 if(!entry)return;
 entry.cancelled=true;
 entry.reveal.close();
}
// The workspace must await this promise before exposing any member content.
export function showCampusWelcome(profile){
 const finished=beginCampusWelcome();
 if(!entry||entry.ready)return finished;
 const {reveal,reduced}=entry;
 reveal.style.setProperty('--arrival-accent',readableAccent(profile.school.primary));
 reveal.querySelector('[data-arrival-name]').textContent=`You’re in, ${profile.name.split(' ')[0]}.`;
 reveal.querySelector('#arrival-description').textContent='Your campus. Your call.';
 reveal.querySelector('[data-arrival-school]').textContent=profile.school.name;
 const logo=reveal.querySelector('[data-arrival-logo]');
 const hasLogo=typeof profile.school.logo==='string'&&/^\/[^/]/.test(profile.school.logo);
 logo.hidden=!hasLogo;
 if(hasLogo){logo.src=profile.school.logo;logo.alt='';logo.parentElement.style.background=profile.school.logoBackground==='primary'?readableAccent(profile.school.primary):'#fff';}
 logo.parentElement.hidden=!hasLogo;
 entry.ready=true;
 reveal.classList.remove('is-loading');
 if(!reduced)entry.advanceTimer=setTimeout(entry.finish,1800);
 return finished;
}
