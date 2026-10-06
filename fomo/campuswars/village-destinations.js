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
// Keep standings limited to registered chapters, but let every catalog campus
// be a destination. An empty campus uses the world's existing claimable lot.
export function schoolDestinations(chapters,catalog=[]){
 const schools=schoolStandings(chapters,catalog),ids=new Set(schools.map(s=>s.id));
 return [...schools,...catalog.filter(s=>!ids.has(`school-${s.id}`)).map(s=>({...s,id:`school-${s.id}`,chapters:[],members:0}))];
}
export function customSchool(name){
 const clean=String(name||'').trim().replace(/\s+/g,' ').slice(0,100),key=schoolKey(clean);
 return clean.length>=2&&key?{id:`custom-${key}`,name:clean,aliases:[],chapters:[],members:0,custom:true}:null;
}
export function routeFromHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));return {school:p.get('school')||'',chapter:p.get('chapter')||'',...(p.has('name')?{name:p.get('name')}: {})};}
export function destinationHash(school,chapter,name){const p=new URLSearchParams();if(school)p.set('school',school);if(chapter&&chapter!=='empty')p.set('chapter',chapter);if(name)p.set('name',name);return p.size?'#'+p:'';}
export function resolveDestination(route,schools){const custom=customSchool(route.name);return schools.find(s=>s.id===route.school)||schools.find(s=>route.school&&s.chapters.some(c=>schoolKey(c.school)===route.school))||(!route.school&&route.chapter?schools.find(s=>s.chapters.some(c=>c.id===route.chapter)):null)||(custom?.id===route.school?custom:null)||null;}
export function mapPoint(lon,lat){
  if(lon>0)lon-=360;
  if(lat>50)return {x:-80+(lon+152)*1.1,y:-50+(lat-64)*1.1};
  if(lon<-140)return {x:-48+(lon+157)*2,y:-49+(lat-20)*2};
  return {x:(lon+96)*3.15,y:(lat-38)*4};
}
let catalogPromise;
export function mergeSchoolCatalog(base,extra,{matchDomains=true}={}){
 const schools=base.map(s=>({...s,aliases:[...(s.aliases||[])]}));
 const domain=value=>{try{return new URL(/^https?:/.test(value)?value:`https://${value}`).hostname.replace(/^www\./,'');}catch{return '';}};
 const ids=new Map(schools.map(s=>[s.id,s]));
 const names=new Map(schools.flatMap(s=>[s.name,...s.aliases].map(name=>[schoolKey(name),s]))),domains=new Map(schools.filter(s=>s.website).map(s=>[domain(s.website),s]));
 for(const school of extra){
  const named=[school.name,...(school.aliases||[]).filter(name=>schoolKey(name).includes('-'))].map(name=>names.get(schoolKey(name))).find(candidate=>candidate&&(matchDomains||!(candidate.unitid||/^\d+$/.test(candidate.id))||(candidate.unitid||candidate.id)===school.id));
  const existing=ids.get(school.id)||named||(matchDomains&&school.website&&domains.get(domain(school.website)));
  if(existing){existing.aliases=[...new Set([...existing.aliases,school.name,...(school.aliases||[])])];existing.city||=school.city;existing.state||=school.state;if(!matchDomains){existing.unitid=school.id;ids.set(school.id,existing);}continue;}
  schools.push(school);ids.set(school.id,school);names.set(schoolKey(school.name),school);
 }
 return schools;
}
export function loadSchoolCatalog(){return catalogPromise??=Promise.all([
 fetch(new URL('./data/schools.json?v=146',import.meta.url)).then(r=>{if(!r.ok)throw Error('School directory unavailable');return r.json();}).then(d=>d.schools),
 fetch(new URL('./data/school-search-catalog.json?v=146',import.meta.url)).then(r=>{if(!r.ok)throw Error('Additional schools unavailable');return r.json();}).then(d=>d.schools).catch(()=>[]),
 fetch(new URL('./data/us-college-catalog.json?v=147',import.meta.url)).then(r=>{if(!r.ok)throw Error('U.S. college directory unavailable');return r.json();}).then(d=>d.schools).catch(()=>[])
]).then(([base,extra,us])=>mergeSchoolCatalog(mergeSchoolCatalog(base,extra),us,{matchDomains:false})).catch(error=>{catalogPromise=null;throw error;});}
