const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.'’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const initials=value=>normalize(value).split(' ').filter(w=>!['of','the','and','at','for','in'].includes(w)).map(w=>w[0]).join('');
const nicknames={ 'sigma alpha epsilon':['sae'], 'sigma alpha mu':['sam','sammy'], 'pi kappa alpha':['pike','pka'], 'phi gamma delta':['fiji','pgd'], 'sigma phi epsilon':['sigep','spe'], 'sigma chi':['sig chi','sc'], 'kappa sigma':['ksig','k sig','ks'], 'phi kappa psi':['phi psi','pkp'], 'pi kappa phi':['pi kapp','pikapp','pkp'], 'tau kappa epsilon':['tke','teke'], 'sigma nu':['snu','sig nu','sn'], 'lambda chi alpha':['lambda chi','lxa'], 'zeta beta tau':['zbt'] };
const schoolAliases={ 'virginia polytechnic institute and state university':['vt','virginia tech'], 'virginia tech':['vt'], 'san diego state university':['sdsu'], 'university of california los angeles':['ucla'], 'university of california santa barbara':['ucsb'], 'university of california san diego':['ucsd'], 'university of southern california':['usc'], 'university of south carolina':['usc','uofsc'], 'indiana university bloomington':['iu','indiana'], 'university of illinois urbana champaign':['uiuc'], 'pennsylvania state university':['psu','penn state'], 'ohio state university columbus':['osu','ohio state'], 'university of mississippi':['ole miss'], 'texas a m university college station':['tamu','texas a m'], 'university of colorado boulder':['cu','cu boulder'], 'university of colorado at boulder':['cu','cu boulder'], 'university of georgia':['uga'], 'university of alabama':['bama','ua'], 'university of north carolina at chapel hill':['unc'], 'university of texas at austin':['ut','ut austin'] };
export function searchChapters(chapters,query){
 const key=normalize(query);if(!key)return [...chapters];
 const terms=key.split(' ');
 return chapters.map(chapter=>{
  const name=normalize(chapter.name),school=normalize(chapter.school).split(' student organization')[0];
  const aliases=[chapter.name,chapter.letters,initials(chapter.name),chapter.school,chapter.shortSchool,initials(chapter.school),initials(chapter.shortSchool),...(nicknames[name]||[]),...(schoolAliases[school]||[])].map(normalize).filter(Boolean);
  const text=aliases.join(' '),exact=aliases.includes(key),match=exact||terms.every(term=>text.includes(term));
  return {chapter,score:exact?0:aliases.some(alias=>alias.startsWith(key))?1:2,match};
 }).filter(row=>row.match).sort((a,b)=>a.score-b.score||b.chapter.joined-a.chapter.joined||a.chapter.id.localeCompare(b.chapter.id)).map(row=>row.chapter);
}
export function installChapterSearch({input,clear,status,list,getChapters,getCards,onSelect}){
 let results=[],active=-1;
 const label=chapter=>`${chapter.name} · ${chapter.shortSchool||chapter.school}`;
 function highlight(index){active=index;const id=results[index]?.id;input.setAttribute('aria-activedescendant',id?'search-'+id:'');for(const card of getCards())card.classList.toggle('search-active',card.dataset.chapter===id);if(id)getCards().find(c=>c.dataset.chapter===id)?.scrollIntoView({block:'nearest'});}
 function refresh(){
  const query=input.value.trim();results=searchChapters(getChapters(),query);const ids=new Set(results.map(c=>c.id));
  const cards=getCards();for(const card of cards){card.id='search-'+card.dataset.chapter;card.hidden=card.dataset.chapter==='empty'?Boolean(query):!ids.has(card.dataset.chapter);card.setAttribute('role','option');card.setAttribute('aria-selected',String(card.getAttribute('aria-pressed')==='true'));}
  for(const chapter of results){const card=cards.find(c=>c.dataset.chapter===chapter.id);if(card)list.append(card);}
  const empty=cards.find(c=>c.dataset.chapter==='empty');if(empty)list.append(empty);
  input.setAttribute('aria-expanded',String(Boolean(query&&results.length)));clear.hidden=!query;status.hidden=!query||results.length>0;status.textContent='No matching chapters. Try a chapter name, nickname or school.';list.classList.toggle('searching',Boolean(query));highlight(-1);
 }
 input.addEventListener('input',refresh);
 input.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(results.length)highlight(active<0?(event.key==='ArrowDown'?0:results.length-1):(active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}
  else if(event.key==='Enter'&&results.length){event.preventDefault();const chapter=results[Math.max(active,0)];input.value=label(chapter);refresh();onSelect(chapter.id);}
  else if(event.key==='Tab'&&active>=0){input.value=label(results[active]);refresh();}
  else if(event.key==='Escape'&&input.value){event.stopPropagation();input.value='';refresh();}
 });
 clear.addEventListener('click',()=>{input.value='';refresh();input.focus();});
 refresh();return {refresh};
}
