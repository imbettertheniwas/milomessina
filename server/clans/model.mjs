import {schoolAliases,chapterAliases,verified} from './catalog.mjs';
export const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const aliases=(map,name)=>[name,...(map[name]||'').split(';').map(s=>s.trim()).filter(Boolean)];
const contains=(text,part)=>(' '+normalize(text)+' ').includes(' '+normalize(part)+' ');
export function scopeOf(chapters){
 const totals=new Map(),groups=new Map();
 for(const c of chapters){totals.set(c.school,(totals.get(c.school)||0)+c.joined);if(c.joined>10){const key=c.school+'|'+c.name;const g=groups.get(key)||{school:c.school,chapter:c.name,onboarded:[]};g.onboarded.push(c.joined);groups.set(key,g);}}
 return {schools:[...totals].filter(([,n])=>n>10).map(([school,onboarded])=>({school,onboarded})),chapters:[...groups.values()]};
}
export function makePlan(chapters,previous){
 const scope=scopeOf(chapters),queries=new Set();
 for(const {school} of scope.schools)for(const q of aliases(schoolAliases,school))queries.add(q);
 for(const {school,chapter} of scope.chapters){for(const q of aliases(chapterAliases,chapter))queries.add(q);queries.add(chapter+' '+(schoolAliases[school]?.split(';')[0].trim()||school));}
 if(queries.size>1500)throw Error('SCOPE_TOO_LARGE');
 const ids=[...new Set([...verified.filter(x=>scope.schools.some(s=>s.school===x[3])).map(x=>x[2]),...(previous?.records||[]).map(r=>r.id||r.url?.split('/').pop()).filter(Boolean)])];
 return {scope,queries:[...queries],ids,discoveryAt:previous?.discoveryAt||null};
}
export function cleanClan(raw){
 if(!raw||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(raw.id)||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>250||!Number.isSafeInteger(raw.memberCount)||raw.memberCount<0||raw.memberCount>100000000)throw Error('INVALID_CLAN');
 return {id:raw.id,name:raw.name.trim(),members:raw.memberCount,url:'https://fomo.family/clans/'+raw.id};
}
export function matchClan(clan,scope){
 const known=verified.find(v=>v[2]===clan.id);
 let school='',chapter='',status='Needs review',note='School or chapter could not be confirmed.';
 if(known){[,,,school,chapter,status,note]=known;if(known[0]!==clan.name){status='Needs review';note='Clan renamed since the verified audit.';}}
 else {
  // Broad search aliases such as Ohio, Florida and Arizona are deliberately not
  // accepted as school evidence. Only full names or unambiguous aliases qualify.
  const unsafe=new Set(['ohio','florida','arizona','texas','colorado','washington','western','pennsylvania','rowan']);
  const schools=scope.schools.filter(s=>aliases(schoolAliases,s.school).some(a=>!unsafe.has(normalize(a))&&contains(clan.name,a)));
  if(schools.length===1){school=schools[0].school;
   const candidates=scope.chapters.filter(c=>c.school===school&&aliases(chapterAliases,c.chapter).some(a=>normalize(a)!=='dsp'&&contains(clan.name,a)));
   if(candidates.length===1){chapter=candidates[0].chapter;status='Name match';note='Matched from school and chapter names.';}
   else if(aliases(schoolAliases,school).some(a=>normalize(a)===normalize(clan.name))){status='Name match';note='School clan';}
   else {status='School match only';note='School identified; chapter remains unconfirmed.';}
  }
 }
 const s=scope.schools.find(s=>s.school===school),c=scope.chapters.find(c=>c.school===school&&c.chapter===chapter);
 if(!s)return null;
 if(chapter&&!c){status='School match only';note='School qualifies; this chapter has no current admin record above 10.';}
 return {...clan,school,chapter,status,note,onboarded:chapter?(c?.onboarded||null):[s.onboarded]};
}
export function buildSnapshot({clans,searches,mode,startedAt},chapters,previous,now=Date.now()){
 if(!['discovery','counts'].includes(mode)||!Array.isArray(clans)||clans.length>10000||!Array.isArray(searches)||searches.length>1500||!Number.isFinite(Date.parse(startedAt))||Date.parse(startedAt)>now+60000||now-Date.parse(startedAt)>3600000)throw Error('INVALID_UPLOAD');
 if(previous?.startedAt&&Date.parse(startedAt)<Date.parse(previous.startedAt))throw Error('OLD_UPLOAD');
 const plan=makePlan(chapters,previous),scope=plan.scope,clean=new Map(clans.map(c=>{const v=cleanClan(c);return[v.id,v];}));
 const expected=new Set(plan.queries),seen=new Set();
 for(const s of searches){if(!expected.has(s.query)||seen.has(s.query)||!Number.isSafeInteger(s.count)||s.count<0||s.count>1000)throw Error('INVALID_SEARCH');seen.add(s.query);}
 // A failed/partial run must never overwrite the last successfully saved run.
 if(mode==='discovery'&&plan.queries.some(q=>!seen.has(q)))throw Error('INCOMPLETE_DISCOVERY');
 if(mode==='counts'&&plan.ids.some(id=>!clean.has(id)))throw Error('INCOMPLETE_COUNTS');
 const records=[...clean.values()].map(c=>matchClan(c,scope)).filter(Boolean).sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name));
 return {version:1,source:'browser-sync',startedAt,updatedAt:new Date(now).toISOString(),discoveryAt:mode==='discovery'?new Date(now).toISOString():previous?.discoveryAt||null,records,coverage:{schools:scope.schools.length,chapters:scope.chapters.length,chapterRows:scope.chapters.reduce((n,c)=>n+c.onboarded.length,0),queries:mode==='discovery'?searches.length:previous?.coverage?.queries||0,cappedQueries:mode==='discovery'?searches.filter(s=>s.count>=10).map(s=>s.query):previous?.coverage?.cappedQueries||[]},audit:scope.chapters.map(c=>({...c,clans:records.filter(r=>r.school===c.school&&r.chapter===c.chapter).map(r=>r.id)}))};
}
