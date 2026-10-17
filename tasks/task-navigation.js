export function createTaskNavigation(){
 const cards=[...document.querySelectorAll('[data-task]')],previous=document.querySelector('#previous-task'),next=document.querySelector('#next-task'),position=document.querySelector('#task-position'),announcement=document.querySelector('#task-announcement'),stage=document.querySelector('.task-stage');
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,animations=[],transition=0;
 const title=card=>card?.querySelector('h2').textContent.replace(/\.$/,'')||'';
 function settle(){
  animations.forEach(animation=>animation.cancel());animations=[];
  cards.forEach((card,i)=>{
   card.hidden=i!==index;card.inert=i!==index;
   card.classList.remove('task-leaving');card.removeAttribute('aria-hidden');
  });
  stage.style.height='';stage.removeAttribute('data-transitioning');
 }
 function show(value,announce=false){
  const target=Math.max(0,Math.min(cards.length-1,value)),oldIndex=index;
  const oldHeight=stage.getBoundingClientRect().height;
  ++transition;settle();index=target;
  const outgoing=cards[oldIndex],incoming=cards[index];
  cards.forEach((card,i)=>{card.hidden=i!==index;card.inert=i!==index;});
  position.textContent=`Task ${index+1} of ${cards.length}`;
  previous.disabled=index===0;next.disabled=index===cards.length-1;
  previous.setAttribute('aria-label',index>0?`Previous task: ${title(cards[index-1])}`:'Previous task');
  next.setAttribute('aria-label',index<cards.length-1?`Next task: ${title(cards[index+1])}`:'Next task');
  for(const button of [previous,next])button.setAttribute('aria-controls',cards[index].id);
  document.querySelector('.skip-link').href='#'+cards[index].id;
  document.querySelector('#task-intro').textContent=index===0?'One simple task. Your first $25.':'One task at a time. Work on what interests you.';
  if(announce)announcement.textContent=`Task ${index+1} of ${cards.length}: ${title(cards[index])}`;
  if(!announce||target===oldIndex||reducedMotion.matches)return;
  const currentTransition=transition,direction=index>oldIndex?1:-1,distance=Math.min(stage.clientWidth*.3,180);
  const newHeight=incoming.getBoundingClientRect().height;
  stage.style.height=`${newHeight}px`;stage.dataset.transitioning='true';
  outgoing.hidden=false;outgoing.inert=true;outgoing.setAttribute('aria-hidden','true');outgoing.classList.add('task-leaving');
  const timing={duration:460,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
  animations=[
   outgoing.animate([{transform:'translateX(0) scale(1)',opacity:1},{transform:`translateX(${-direction*distance}px) scale(.96)`,opacity:0}],{...timing,duration:320}),
   incoming.animate([{transform:`translateX(${direction*distance}px) scale(.97)`,opacity:0},{transform:'translateX(0) scale(1)',opacity:1}],timing),
   stage.animate([{height:`${oldHeight}px`},{height:`${newHeight}px`}],timing)
  ];
  Promise.all(animations.map(animation=>animation.finished)).then(()=>{if(transition===currentTransition)settle();}).catch(()=>{});
 }
 previous.addEventListener('click',()=>show(index-1,true));
 next.addEventListener('click',()=>show(index+1,true));
 reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){++transition;settle();}});
 show(0);
 return {reset:()=>show(0)};
}
