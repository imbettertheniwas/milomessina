import {readableAccent} from './profile.js';

// Called after a successful password signup or sign-in.
export function showCampusWelcome(profile){
 const reveal=document.querySelector('#campus-welcome');
 if(!reveal||reveal.open)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const accent=readableAccent(profile.school.primary);
 reveal.style.setProperty('--arrival-accent',accent);
 reveal.querySelector('[data-arrival-name]').textContent=`You’re in, ${profile.name.split(' ')[0]}.`;
 reveal.querySelector('[data-arrival-school]').textContent=profile.school.name;
 const logo=reveal.querySelector('[data-arrival-logo]');
 const hasLogo=typeof profile.school.logo==='string'&&/^\/[^/]/.test(profile.school.logo);
 logo.hidden=!hasLogo;
 if(hasLogo){logo.src=profile.school.logo;logo.alt='';logo.parentElement.style.background=profile.school.logoBackground==='primary'?accent:'#fff';}
 logo.parentElement.hidden=!hasLogo;
 reveal.classList.remove('is-leaving');
 reveal.classList.toggle('is-reduced',reduced);
 let leaving=false,advanceTimer,closeTimer;
 const events=new AbortController();
 const close=()=>{reveal.close();};
 const finish=()=>{
  if(leaving)return;
  leaving=true;
  clearTimeout(advanceTimer);
  if(reduced){close();return;}
  reveal.classList.add('is-leaving');
  closeTimer=setTimeout(close,550);
 };
 reveal.querySelector('[data-arrival-enter]').addEventListener('click',finish,{signal:events.signal});
 reveal.addEventListener('cancel',event=>{event.preventDefault();finish();},{signal:events.signal});
 reveal.addEventListener('close',()=>{
  clearTimeout(advanceTimer);clearTimeout(closeTimer);events.abort();
  document.body.classList.remove('campus-arriving');
  const heading=document.querySelector('#campus-title');
  heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
 },{once:true});
 document.body.classList.add('campus-arriving');
 reveal.showModal();
 if(!reduced)advanceTimer=setTimeout(finish,6200);
}
