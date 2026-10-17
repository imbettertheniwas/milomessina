export function createTaskNavigation(){
 const cards=[...document.querySelectorAll('[data-task]')],previous=document.querySelector('#previous-task'),next=document.querySelector('#next-task'),position=document.querySelector('#task-position'),announcement=document.querySelector('#task-announcement');
 let index=0;
 const title=card=>card?.querySelector('h2').textContent.replace(/\.$/,'')||'';
 function show(value,announce=false){
  index=Math.max(0,Math.min(cards.length-1,value));
  cards.forEach((card,i)=>{card.hidden=i!==index;});
  position.textContent=`Task ${index+1} of ${cards.length}`;
  previous.disabled=index===0;next.disabled=index===cards.length-1;
  previous.setAttribute('aria-label',index>0?`Previous task: ${title(cards[index-1])}`:'Previous task');
  next.setAttribute('aria-label',index<cards.length-1?`Next task: ${title(cards[index+1])}`:'Next task');
  for(const button of [previous,next])button.setAttribute('aria-controls',cards[index].id);
  document.querySelector('.skip-link').href='#'+cards[index].id;
  document.querySelector('#task-intro').textContent=index===0?'One simple task. Your first $25.':'One task at a time. Work on what interests you.';
  if(announce)announcement.textContent=`Task ${index+1} of ${cards.length}: ${title(cards[index])}`;
 }
 previous.addEventListener('click',()=>show(index-1,true));
 next.addEventListener('click',()=>show(index+1,true));
 show(0);
 return {reset:()=>show(0)};
}
