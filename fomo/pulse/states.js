import {summarizeStates,geographyName} from './geography.mjs';
const $=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US');
export function createStates({onSelect}){
 let selected='all',latest=null;
 function choose(code){selected=code;render();onSelect(code);}
 function card(region,max){
  const button=document.createElement('button');button.className='state-card';button.classList.toggle('active',selected===region.code);button.setAttribute('aria-pressed',String(selected===region.code));button.setAttribute('aria-label',`${region.name}: ${fmt(region.members)} members, ${region.schools} ${region.schools===1?'school':'schools'}, ${region.chapters} chapter records. Filter chapters.`);
  const code=document.createElement('span'),title=document.createElement('strong'),members=document.createElement('b'),caption=document.createElement('small'),bar=document.createElement('i');
  code.className='state-code';code.textContent=region.code==='unknown'?'?':region.code;title.textContent=region.name;members.textContent=fmt(region.members);caption.textContent=`members · ${region.schools} ${region.schools===1?'school':'schools'} · ${region.chapters} ${region.chapters===1?'chapter':'chapters'}`;bar.style.width=(max?region.members/max*100:0)+'%';button.append(code,title,members,caption,bar);button.onclick=()=>{choose(selected===region.code?'all':region.code);document.querySelector('.market-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};return button;
 }
 function render(){
  if(!latest)return;
  const {states,other,regions}=latest,max=Math.max(0,...regions.map(g=>g.members));
  $('states-count').textContent=states.length;$('states-total').textContent=states.length;$('states-progress').style.width=states.length/50*100+'%';
  $('states-summary').textContent=`${fmt(states.reduce((sum,g)=>sum+g.members,0))} members across ${states.length} U.S. states`;
  $('state-cards').replaceChildren(...states.map(g=>card(g,max)));$('other-state-cards').replaceChildren(...other.map(g=>card(g,max)));$('other-geographies').hidden=!other.length;
  $('states-empty').hidden=states.length>0;$('states-empty').textContent='No confirmed U.S. states in this snapshot.';
  const unknown=other.find(g=>g.code==='unknown');$('states-note').textContent=unknown?`${unknown.chapters} ${unknown.chapters===1?'chapter record has':'chapter records have'} an unconfirmed location and are excluded from the state count. ${unknown.schoolNames.join(' · ')}`:'States are based on schools with registered chapters, including chapters still at zero members. Washington, D.C. and Canadian provinces are shown separately from the 50 states.';
  const select=$('state-filter'),option=(code,name)=>{const o=document.createElement('option');o.value=code;o.textContent=name;return o;};
  select.replaceChildren(option('all','All locations'),...regions.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(g=>option(g.code,g.name)));select.value=selected;
  $('states-reset').hidden=selected==='all';$('states-filter-label').textContent=selected==='all'?'Select a state to explore its chapters':`Filtering: ${geographyName(selected)}`;
 }
 $('states-open').onclick=()=>$('states-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 $('state-filter').onchange=e=>choose(e.target.value);$('states-reset').onclick=()=>choose('all');
 return {update(chapters){latest=summarizeStates(chapters);render();},reset(){selected='all';render();}};
}
