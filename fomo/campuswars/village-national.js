import {schoolDestinations,loadSchoolCatalog} from './village-destinations.js?v=146';
import {schoolChoices,SCHOOL_PROMPT_DELAY} from './village-school-search.js?v=146';

export function createNationalNavigation(){
 const shell=document.getElementById('village'),source=document.getElementById('chapters-data');
 let snapshot=JSON.parse(source.textContent),catalog=[],schools=[],choices=[],selected=-1,required=true,travelling=false;
 const dialog=document.createElement('dialog');dialog.id='school-picker';dialog.setAttribute('aria-labelledby','school-picker-title');
 dialog.innerHTML=`<form class="school-picker-form"><span class="school-picker-brand">fomo / campus</span><h2 id="school-picker-title">What school do you go to?</h2><label class="school-picker-field"><span class="school-picker-label">Your school</span><input id="school-search" type="text" placeholder="Type your school" autocomplete="off" spellcheck="false" maxlength="100" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="school-results" autofocus><span aria-hidden="true">↗</span></label><ul id="school-results" role="listbox" aria-label="Schools" hidden></ul><p id="school-picker-status" role="status">Your private jet is waiting.</p></form>`;
 shell.append(dialog);
 const search=dialog.querySelector('input'),results=dialog.querySelector('ul'),status=dialog.querySelector('[role=status]');
 const button=document.createElement('button');button.id='village-school';button.className='village-reset';button.type='button';button.textContent='Your school ↗';button.setAttribute('aria-haspopup','dialog');document.querySelector('.village-top-actions').prepend(button);
 const home=document.createElement('button');home.id='village-national-home';home.className='village-reset';home.type='button';home.textContent='← National home';home.hidden=true;document.querySelector('.village-title').append(home);
 const destination=document.createElement('p');destination.className='village-destination';document.querySelector('.village-title').append(destination);
 const starter=document.createElement('aside');starter.className='campus-starter';starter.hidden=true;starter.setAttribute('aria-labelledby','campus-starter-title');
 starter.innerHTML=`<button type="button" aria-label="Close campus invitation">×</button><h3 id="campus-starter-title">Pioneer your campus.</h3><p>Start with your chapter and get paid.<br>Or refer another chapter and earn a referral reward.</p><div><a href="https://fomocampus.com/onboard/">Start your chapter ↗</a><a href="https://fomocampus.com/refer/">Refer a chapter ↗</a></div>`;
 shell.append(starter);let emptyCampus=false;
 starter.querySelector('button').addEventListener('click',()=>{starter.hidden=true;});
 const showStarter=()=>{starter.hidden=!emptyCampus||dialog.open||shell.classList.contains('intro-playing');};
 document.addEventListener('village:introend',showStarter);
 let timer=0,remaining=SCHOOL_PROMPT_DELAY,timerStarted=0,promptShown=false,visible=true;
 function stopTimer(){if(timer){clearTimeout(timer);timer=0;remaining=Math.max(0,remaining-(performance.now()-timerStarted));}}
 function checkTimer(){
  stopTimer();if(promptShown||!required||!shell.classList.contains('village-ready')||document.hidden||!visible)return;
  timerStarted=performance.now();timer=setTimeout(()=>{timer=0;remaining=0;open();},remaining);
 }
 function render(){
  choices=schoolChoices(schools,search.value);selected=-1;search.removeAttribute('aria-activedescendant');results.replaceChildren();
  choices.forEach((school,i)=>{const item=document.createElement('li');item.id=`school-choice-${i}`;item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.dataset.index=i;
   const name=document.createElement('span'),arrow=document.createElement('span');name.textContent=school.custom?`Fly to ${school.name}`:school.name;arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');item.append(name,arrow);results.append(item);
  });
  results.hidden=!choices.length;search.setAttribute('aria-expanded',String(Boolean(choices.length)));
  status.textContent=search.value.trim()&&!choices.length?'Keep typing your school’s name.':'Your private jet is waiting.';
 }
 function highlight(index){selected=index;[...results.children].forEach((item,i)=>item.setAttribute('aria-selected',String(i===index)));const item=results.children[index];if(item){search.setAttribute('aria-activedescendant',item.id);item.scrollIntoView({block:'nearest'});}}
 function open(message=''){
  if(travelling||dialog.open)return;promptShown=true;stopTimer();search.value='';render();if(message)status.textContent=message;
  document.dispatchEvent(new CustomEvent('school:visibility',{detail:{open:true}}));dialog.showModal();search.focus({preventScroll:true});
 }
 function travel(school){
  if(!school||travelling)return;travelling=true;search.disabled=true;dialog.close();
  document.dispatchEvent(new CustomEvent('destination:request',{detail:{school:school.id,...(school.custom?{name:school.name}:{}),flight:true}}));
 }
 dialog.addEventListener('cancel',event=>{if(required)event.preventDefault();});
 dialog.addEventListener('keydown',event=>{if(required&&event.key==='Escape'){event.preventDefault();event.stopPropagation();}});
 dialog.addEventListener('close',()=>{if(required&&!travelling){dialog.showModal();search.focus({preventScroll:true});return;}document.dispatchEvent(new CustomEvent('school:visibility',{detail:{open:false}}));if(!travelling)button.focus({preventScroll:true});});
 dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();travel(choices[selected>=0?selected:0]);});
 search.addEventListener('input',render);
 search.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(choices.length)highlight((selected+(event.key==='ArrowDown'?1:choices.length-1)+choices.length)%choices.length);}});
 results.addEventListener('pointerdown',event=>{if(event.target.closest('[role=option]'))event.preventDefault();});
 results.addEventListener('click',event=>{const item=event.target.closest('[role=option]');if(item)travel(choices[Number(item.dataset.index)]);});
 button.addEventListener('click',()=>open());home.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('destination:request',{detail:{school:''}})));
 document.addEventListener('school:request',()=>open());
 document.addEventListener('destination:arrived',()=>{if(travelling){required=false;travelling=false;search.disabled=false;}showStarter();});
 document.addEventListener('destination:error',()=>{travelling=false;search.disabled=false;open('Couldn’t open that campus. Choose your school to try again.');});
 function update(){schools=schoolDestinations(snapshot.chapters,catalog);if(dialog.open)render();}
 document.addEventListener('chapters:update',event=>{snapshot=event.detail;update();});
 document.addEventListener('destination:changed',event=>{
  const {school,chapters}=event.detail;emptyCampus=Boolean(school&&!chapters.length);starter.hidden=true;home.hidden=!school;document.querySelector('.village-title h1').textContent=school?school.name:'Greek village';document.querySelector('.village-kicker').textContent=school?'GREEK WARS · YOUR CAMPUS':'GREEK WARS · NATIONAL HOME';
  destination.textContent=school?(chapters.length?`${chapters.length} chapters · ${chapters.reduce((n,c)=>n+c.joined,0).toLocaleString()} members`:'Your campus. Start the first chapter.') :'';shell.dataset.destination=school?.id||'national';
 });
 const observer=new MutationObserver(checkTimer);observer.observe(shell,{attributes:true,attributeFilter:['class']});
 const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;checkTimer();});intersection.observe(shell);
 document.addEventListener('visibilitychange',checkTimer);
 loadSchoolCatalog().then(data=>{catalog=data;update();}).catch(()=>update());update();checkTimer();
 addEventListener('pagehide',event=>{if(!event.persisted){stopTimer();observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',checkTimer);}});
 return {open};
}
