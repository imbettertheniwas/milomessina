import {readableAccent} from './profile.js';

let welcomeFinished=null;
// The workspace must await this promise before rendering any member content.
export function showCampusWelcome(profile){
 if(welcomeFinished)return welcomeFinished;
 const reveal=document.querySelector('#campus-welcome');
 if(!reveal)return Promise.resolve();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 reveal.style.setProperty('--arrival-accent',readableAccent(profile.school.primary));
 reveal.querySelector('[data-arrival-name]').textContent=`You’re in, ${profile.name.split(' ')[0]}.`;
 reveal.querySelector('[data-arrival-school]').textContent=profile.school.name;
 const logo=reveal.querySelector('[data-arrival-logo]');
 const hasLogo=typeof profile.school.logo==='string'&&/^\/[^/]/.test(profile.school.logo);
 logo.hidden=!hasLogo;
 if(hasLogo){logo.src=profile.school.logo;logo.alt='';logo.parentElement.style.background=profile.school.logoBackground==='primary'?readableAccent(profile.school.primary):'#fff';}
 logo.parentElement.hidden=!hasLogo;
 reveal.classList.remove('is-leaving');
 reveal.classList.toggle('is-reduced',reduced);
 welcomeFinished=new Promise(resolve=>{
  let leaving=false,advanceTimer,closeTimer;
  const events=new AbortController();
  const finish=()=>{
   if(leaving)return;
   leaving=true;clearTimeout(advanceTimer);
   if(reduced){reveal.close();return;}
   reveal.classList.add('is-leaving');
   closeTimer=setTimeout(()=>reveal.close(),550);
  };
  reveal.querySelector('[data-arrival-enter]').addEventListener('click',finish,{signal:events.signal});
  reveal.addEventListener('cancel',event=>{event.preventDefault();finish();},{signal:events.signal});
  reveal.addEventListener('close',()=>{
   clearTimeout(advanceTimer);clearTimeout(closeTimer);events.abort();
   document.body.classList.remove('campus-arriving');
   welcomeFinished=null;resolve();
  },{once:true});
  document.body.classList.add('campus-arriving');
  reveal.showModal();
  if(!reduced)advanceTimer=setTimeout(finish,6200);
 });
 return welcomeFinished;
}
