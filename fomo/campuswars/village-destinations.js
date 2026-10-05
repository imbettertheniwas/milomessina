// A single source of truth for destinations, member standings and deep links.
export const HOME_LIMIT=19;
export const schoolName=value=>String(value||'').split(' · ')[0].trim();
export const schoolKey=value=>schoolName(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^the /,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function memberOrder(chapters){return [...chapters].sort((a,b)=>b.joined-a.joined||a.id.localeCompare(b.id));}
export function schoolStandings(chapters,catalog=[]){
  const aliases=new Map();for(const school of catalog)for(const name of [school.name,...school.aliases])aliases.set(schoolKey(name),school);
  const groups=new Map();
  for(const c of chapters){if(!schoolName(c.school))continue;const info=aliases.get(schoolKey(c.school)),id=info?`school-${info.id}`:schoolKey(c.school);let school=groups.get(id);if(!school){school={...info,id,name:info?.name||schoolName(c.school),chapters:[],members:0};groups.set(id,school);}school.chapters.push(c);school.members+=c.joined;}
  const schools=[...groups.values()].sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name));
  schools.forEach((s,i)=>{s.rank=i&&s.members===schools[i-1].members?schools[i-1].rank:i+1;s.chapters=memberOrder(s.chapters);});return schools;
}
export function destinationChapters(chapters,school=null){return school?memberOrder(school.chapters):memberOrder(chapters).slice(0,HOME_LIMIT);}
export function routeFromHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));return {school:p.get('school')||'',chapter:p.get('chapter')||''};}
export function destinationHash(school,chapter){const p=new URLSearchParams();if(school)p.set('school',school);if(chapter&&chapter!=='empty')p.set('chapter',chapter);return p.size?'#'+p:'';}
export function resolveDestination(route,schools){return schools.find(s=>s.id===route.school)||(!route.school&&route.chapter?schools.find(s=>s.chapters.some(c=>c.id===route.chapter)):null)||null;}
export function mapPoint(lon,lat){
  if(lon>0)lon-=360;
  if(lat>50)return {x:-80+(lon+152)*1.1,y:-50+(lat-64)*1.1};
  if(lon<-140)return {x:-48+(lon+157)*2,y:-49+(lat-20)*2};
  return {x:(lon+96)*3.15,y:(lat-38)*4};
}
let catalogPromise;
export function loadSchoolCatalog(){return catalogPromise??=fetch(new URL('./data/schools.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('School locations unavailable');return r.json();}).then(d=>d.schools).catch(error=>{catalogPromise=null;throw error;});}
