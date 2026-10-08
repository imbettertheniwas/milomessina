export const PROFILE_KEY='fomo-campus-task-profiles-v2';
export const LEGACY_KEY='fomo-campus-tasks-v1';
export function normalizeName(value){return String(value||'').trim().replace(/\s+/g,' ').slice(0,100);}
export function profileMatch(profiles,name,schoolId){return profiles.find(p=>p.school.id===schoolId&&p.name.toLocaleLowerCase()===normalizeName(name).toLocaleLowerCase());}
export function loadProfiles(storage){try{const data=JSON.parse(storage.getItem(PROFILE_KEY)||'null');if(data?.version===2&&Array.isArray(data.profiles))return{...data,profiles:data.profiles.filter(p=>typeof p?.id==='string'&&typeof p.name==='string'&&typeof p.school?.id==='string'&&typeof p.school?.name==='string')};}catch{}return{version:2,activeId:null,profiles:[]};}
export function legacyProgress(storage){try{const data=JSON.parse(storage.getItem(LEGACY_KEY)||'null');if(data&&typeof data==='object'&&!Array.isArray(data))return data;}catch{}return{};}
export function readableAccent(hex){if(!/^#[0-9a-f]{6}$/i.test(hex))return'#4A36FF';const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);while(luminance(c)>.14)for(let i=0;i<3;i++)c[i]=Math.round(c[i]*.9);return'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');}

export function savedChecks(taskId,checks){const values=Array.isArray(checks)?checks:[];return taskId==='dinner'&&values.length===6?[...values.slice(0,4),values[4]===true||values[5]===true]:values;}
