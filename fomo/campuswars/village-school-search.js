import {schoolKey,customSchool} from './village-destinations.js?v=147';

export const SCHOOL_PROMPT_DELAY=6000;
const searchIndex=new WeakMap();
const compact=value=>schoolKey(value).replace(/-/g,'');
function indexedSchool(school){
 if(searchIndex.has(school))return searchIndex.get(school);
 const names=[school.name,...(school.aliases||[])].map(schoolKey);
 const initials=new Set();
 for(const name of names){
  // Keep both literal and common initials: U of A / UA, UCLA, and TAMU.
  for(const variant of [name,name.replace(/-(main-campus|campus-immersion)$/,'')]){
   const words=variant.split('-').filter(Boolean);
   for(const parts of [words,words.filter(word=>!['of','the','and','at','for','in'].includes(word))]){
    const abbreviation=parts.map(word=>word[0]).join('');if(abbreviation.length>=2)initials.add(abbreviation);
   }
  }
 }
 const row={names,compactNames:names.map(compact),initials:[...initials],text:[...names,schoolKey(school.city),schoolKey(school.state)].join('-')};
 searchIndex.set(school,row);return row;
}
export function searchSchools(schools,query,limit=8){
 const normalized=schoolKey(query),abbreviation=compact(query),key=/^(?:[a-z]-)+[a-z]$/.test(normalized)?abbreviation:normalized,terms=key.split('-').filter(Boolean);
 const initialsQuery=/^[a-z.\s-]{2,12}$/i.test(query)&&abbreviation.length>=2&&abbreviation.length<=8;
 const score=school=>{
  const {names,compactNames,initials,text}=indexedSchool(school);
  if(names.includes(key)||compactNames.includes(abbreviation))return 0;
  if(initialsQuery&&initials.includes(abbreviation))return 1;
  if(names.some(name=>name.startsWith(key)))return 2;
  if(terms.every(term=>text.includes(term)))return 3;
  return initialsQuery&&initials.some(name=>name.startsWith(abbreviation))?4:5;
 };
 if(!key)return [];
 return schools.map(school=>({school,score:score(school)})).filter(row=>row.score<5).sort((a,b)=>a.score-b.score||(b.school.members||0)-(a.school.members||0)||a.school.name.localeCompare(b.school.name)).slice(0,limit).map(row=>row.school);
}
export function schoolChoices(schools,query){
 const matches=searchSchools(schools,query),custom=customSchool(query);
 // A typed school outside the catalog can still land at its own starter campus.
 if(!matches.length&&custom)matches.push(custom);
 return matches;
}
