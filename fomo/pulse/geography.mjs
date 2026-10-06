import {schoolStates} from './school-states.mjs';
export const STATE_NAMES=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(v=>v.split(':')));
const key=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^the /,'').replace(/[^a-z0-9]/g,'');
const catalog=new Map();
for(const school of schoolStates)for(const alias of [school.name,...school.aliases])catalog.set(key(alias),school);
export function schoolLocation(name){return catalog.get(key(name))||null;}
export function geographyCode(chapter){return schoolLocation(chapter.school)?.state||'unknown';}
export function geographyName(code){return STATE_NAMES[code]||({ON:'Ontario, Canada',DC:'Washington, D.C.',unknown:'Location unconfirmed'})[code]||code;}
export function summarizeStates(chapters){
 const groups=new Map();
 for(const chapter of chapters){const school=schoolLocation(chapter.school),code=school?.state||'unknown';if(!groups.has(code))groups.set(code,{code,name:geographyName(code),members:0,chapters:0,schools:new Set(),schoolNames:new Set()});const group=groups.get(code);group.members+=chapter.joined;group.chapters++;group.schools.add(school?.id||key(chapter.school));group.schoolNames.add(school?.name||chapter.school);}
 const regions=[...groups.values()].map(g=>({...g,schools:g.schools.size,schoolNames:[...g.schoolNames].sort()})).sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name));
 return {states:regions.filter(g=>STATE_NAMES[g.code]),other:regions.filter(g=>!STATE_NAMES[g.code]),regions};
}
