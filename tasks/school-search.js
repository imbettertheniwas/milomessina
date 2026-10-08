const commonAliases={
 'San Diego State University':['SDSU','San Diego State'],
 'University of Southern California':['USC','Southern Cal'],
 'University of South Carolina':['USC','UofSC','South Carolina'],
 'University of Michigan - Ann Arbor':['UMich','U of M','Michigan'],
 'Pennsylvania State University':['PSU','Penn State'],
 'Ohio State University - Columbus':['OSU','Ohio State'],
 'Oregon State University':['OSU','Oregon State'],
 'Oklahoma State University':['OSU','OK State'],
 'Indiana University - Bloomington':['IU','Indiana'],
 'University of Colorado at Boulder':['CU Boulder','CU'],
 'The University of Alabama':['Bama','UA','Alabama'],
 'University of Mississippi':['Ole Miss'],
 'University of Missouri':['Mizzou'],
 'University of North Carolina at Chapel Hill':['UNC','UNC Chapel Hill'],
 'University of North Carolina at Charlotte':['UNCC','UNC Charlotte'],
 'University of Tennessee, Knoxville':['UTK','UT Knoxville'],
 'The University of Texas at Austin':['UT Austin','UT','Texas'],
 'Texas A&M University - College Station':['TAMU','Texas A&M','A&M'],
 'University of Pennsylvania':['UPenn','Penn'],
 'University of Illinois Urbana-Champaign':['UIUC','Illinois'],
 'University of Massachusetts at Amherst':['UMass','UMass Amherst'],
 'University of California, Berkeley':['UC Berkeley','Cal','UCB'],
 'University of California, San Diego':['UCSD','UC San Diego'],
 'University of California, Santa Barbara':['UCSB','UC Santa Barbara'],
 'University of California, Santa Cruz':['UCSC','UC Santa Cruz'],
 'University of California, Davis':['UCD','UC Davis'],
 'California State University, Northridge':['CSUN','Cal State Northridge'],
 'California State University, Fullerton':['CSUF','Cal State Fullerton'],
 'California State University, Chico':['CSUC','Chico State'],
 'University of Virginia, Charlottesville':['UVA'],
 'University of Wisconsin - Madison':['UW Madison','UW','Wisconsin'],
 'University of Wisconsin - Milwaukee':['UWM','UW Milwaukee'],
 'University of Washington':['UW','U Dub'],
 'University of Pittsburgh':['Pitt'],
 'University of Kansas':['KU'],
 'University of Oklahoma':['OU'],
 'University of Miami':['UMiami','The U'],
 'Miami University of Ohio':['Miami Ohio'],
 'Florida Agricultural and Mechanical University':['FAMU','Florida A&M'],
 'California Institute of Technology':['Caltech'],
 'State University of New York at Binghamton':['SUNY Binghamton','Bing'],
 'State University of New York at Buffalo':['SUNY Buffalo','UB'],
 'State University of New York at Albany':['SUNY Albany','UAlbany'],
 'State University of New York at Stony Brook':['SUNY Stony Brook','SBU'],
 'State University of New York at Farmingdale':['SUNY Farmingdale','Farmingdale State'],
 'State University of New York College at New Paltz':['SUNY New Paltz'],
 'CUNY City College of NY':['CCNY','City College'],
 'Saint Joseph\'s University':['SJU','St Joes'],
 'Washington & Lee University':['W&L','WLU'],
 'University of Chicago':['UChicago'],
};
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const compact=value=>normalize(value).replace(/ /g,'');
export function schoolAliases(school){const words=normalize(school.name).split(' ').filter(w=>!['of','the','at','and'].includes(w));const main=normalize(school.name.split(/ - |, /)[0]).split(' ').filter(w=>!['of','the','at','and'].includes(w));return [...(school.aliases||[]),...(commonAliases[school.name]||[]),words.map(w=>w[0]).join(''),main.map(w=>w[0]).join('')];}
export function searchSchools(schools,query){const q=normalize(query),c=compact(query);if(!q)return schools;return schools.map(s=>{const name=normalize(s.name),aliases=schoolAliases(s).map(normalize);let score=name===q?100:aliases.some(a=>compact(a)===c)?90:name.startsWith(q)?80:name.includes(q)?70:q.split(' ').every(w=>name.includes(w))?60:aliases.some(a=>a.startsWith(q)||compact(a).startsWith(c))?50:0;return{s,score};}).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.s.name.localeCompare(b.s.name)).map(x=>x.s);}
export function createSchoolPicker(input,list,status){
 let schools=[],selected='',matches=[],index=-1;
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');index=-1;}
 function highlight(next){index=next;[...list.children].forEach((option,i)=>{option.setAttribute('aria-selected',String(i===index));if(i===index){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}});}
 function select(id){const school=schools.find(s=>s.id===id);selected=school?.id||'';input.value=school?.name||'';input.setCustomValidity('');close();status.textContent=school?`${school.name} selected.`:'Type your school name or abbreviation.';}
 function show(){if(input.disabled)return;const found=searchSchools(schools,input.value);matches=found.slice(0,8);list.replaceChildren();index=-1;input.removeAttribute('aria-activedescendant');for(const [i,s] of matches.entries()){const row=document.createElement('li');row.id=`school-option-${i}`;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=s.name;row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('click',()=>select(s.id));list.append(row);}list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));status.textContent=found.length?`${found.length} ${found.length===1?'school matches':'schools match'}${found.length>8?'. Keep typing to narrow the list.':'. Use arrow keys to choose.'}`:'No matching onboarded schools. Try the full school name.';}
 input.addEventListener('input',()=>{selected='';input.setCustomValidity('');show();});
 input.addEventListener('focus',show);
 input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(list.hidden)show();if(matches.length)highlight(index<0?(event.key==='ArrowDown'?0:matches.length-1):(index+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length);}else if(event.key==='Enter'&&!list.hidden&&matches.length){event.preventDefault();select(matches[Math.max(0,index)].id);}else if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close();}});
 input.addEventListener('blur',()=>{const exact=schools.find(s=>normalize(s.name)===normalize(input.value));if(exact)selected=exact.id;close();});
 return{setSchools(value){schools=value;},select,get value(){return selected;},close};
}
