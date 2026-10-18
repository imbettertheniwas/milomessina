export const schoolKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const LEVEL_NAMES={1:'Four-year',2:'Two-year',3:'Shorter programs'};
export function createCoverageIndex(data){
 const byId=new Map(data.schools.map(s=>[s[0],s])),names=new Map(),explicit=new Map(Object.entries(data.aliases).map(([name,id])=>[schoolKey(name),id]));
 for(const [name,id] of [...data.schools.map(s=>[s[1],s[0]]),...data.directoryAliases]){const key=schoolKey(name);if(!key)continue;if(!names.has(key))names.set(key,new Set());names.get(key).add(id);}
 return {byId,resolve(name){const key=schoolKey(name);if(explicit.has(key))return explicit.get(key);const ids=names.get(key);return ids?.size===1?[...ids][0]:null;}};
}
export function compareCoverage(data,index,chapters){
 if(!Array.isArray(chapters))throw Error('Chapter data unavailable');
 const represented=new Set(),unknown=new Set(),outside=new Set();
 for(const c of chapters){const id=index.resolve(c.school);if(id&&index.byId.has(id))represented.add(id);else if(id?.startsWith('ca-'))outside.add(c.school);else unknown.add(c.school);}
 return {missing:data.schools.filter(s=>!represented.has(s[0])),represented:represented.size,unknown:[...unknown].sort(),outside:[...outside].sort()};
}
export function filterCoverage(rows,{query='',state='all',level='all'}={}){const q=query.trim().toLowerCase();return rows.filter(s=>(state==='all'||s[3]===state)&&(level==='all'||String(s[4])===level)&&(!q||`${s[1]} ${s[2]} ${s[3]}`.toLowerCase().includes(q)));}
export function greekLifeEvidence(data,id){return (data.greekLife?.schools?.[id]||[]).filter(e=>data.greekLife?.sources?.[e.source]?.url);}
export function greekLifeLabel(data,id){return greekLifeEvidence(data,id).length?'Greek life verified':'Greek life not yet verified';}
