import {schoolKey,customSchool} from './village-destinations.js?v=146';

export const SCHOOL_PROMPT_DELAY=5000;
export function searchSchools(schools,query,limit=8){
 const key=schoolKey(query),terms=key.split('-').filter(Boolean);
 const score=school=>{
  const names=[school.name,...(school.aliases||[])].map(schoolKey);
  if(names.includes(key))return 0;
  if(names.some(name=>name.startsWith(key)))return 1;
  const text=[...names,schoolKey(school.city),schoolKey(school.state)].join('-');
  return terms.every(term=>text.includes(term))?2:3;
 };
 if(!key)return [];
 return schools.map(school=>({school,score:score(school)})).filter(row=>row.score<3).sort((a,b)=>a.score-b.score||a.school.name.localeCompare(b.school.name)).slice(0,limit).map(row=>row.school);
}
export function schoolChoices(schools,query){
 const matches=searchSchools(schools,query),custom=customSchool(query);
 // A typed school outside the catalog can still land at its own starter campus.
 if(!matches.length&&custom)matches.push(custom);
 return matches;
}
