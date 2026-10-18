import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCoverageIndex,compareCoverage,filterCoverage} from '../coverage-model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/school-coverage.json',import.meta.url))),index=createCoverageIndex(data);
test('every directory school has an actual projected location',()=>{assert.equal(data.schools.length,5994);assert.equal(new Set(data.schools.map(s=>s[0])).size,5994);for(const s of data.schools){const m=data.maps.find(m=>m.id===s[7]);assert(m);assert(s[5]>=0&&s[5]<=m.width&&s[6]>=0&&s[6]<=m.height,s[1]);}});
test('source aliases deduplicate and zero-member chapters count as presence',()=>{const r=compareCoverage(data,index,[{school:'Indiana University',joined:0},{school:'Indiana University - Bloomington',joined:20},{school:'University of Akron',joined:0},{school:'University of Arkansas - Fayetteville',joined:0},{school:'State University of New York College at New Paltz',joined:0}]);assert.equal(r.represented,4);assert.equal(r.missing.length,5990);assert.deepEqual(r.unknown,[]);assert(!r.missing.some(s=>['151351','200800','106397','196176'].includes(s[0])));});
test('unknown schools are reported and known Canada schools are outside the comparison',()=>{const r=compareCoverage(data,index,[{school:'New unmatched school'},{school:"Queen's University"},{school:'Western University'}]);assert.deepEqual(r.unknown,['New unmatched school']);assert.equal(r.outside.length,2);assert.equal(r.represented,0);});
test('ambiguous directory aliases are not silently assigned',()=>{const d={schools:[['1','One'],['2','Two']],aliases:{},directoryAliases:[['Shared','1'],['Shared','2']]};assert.equal(createCoverageIndex(d).resolve('Shared'),null);});
test('new registrations remove a school and branch campuses stay distinct',()=>{const before=compareCoverage(data,index,[]),after=compareCoverage(data,index,[{school:'University of Washington'}]);assert.equal(before.missing.length-after.missing.length,1);assert(!after.missing.some(s=>s[0]==='236948'));assert(after.missing.some(s=>s[0]==='377555'));});
test('state, type, and search filters compose',()=>{const result=filterCoverage(data.schools,{state:'CA',level:'1',query:'Berkeley'});assert(result.length>0);assert(result.every(s=>s[3]==='CA'&&s[4]===1&&`${s[1]} ${s[2]}`.includes('Berkeley')));});
test('unavailable chapter data cannot become zero represented schools',()=>{assert.throws(()=>compareCoverage(data,index,null));});

test('Greek-life classifications require a known school and a traceable official source',()=>{
 const ids=new Set(data.schools.map(s=>s[0]));assert.equal(data.greekLife.verifiedAt,'2026-10-18');assert(Object.keys(data.greekLife.schools).length>600);
 for(const [id,evidence] of Object.entries(data.greekLife.schools)){assert(ids.has(id),id);assert(evidence.length);for(const e of evidence){assert(e.listedName);assert(['thesororitylife.com','sigep.org'].includes(new URL(data.greekLife.sources[e.source].url).hostname));}}
});
test('unverified schools remain unknown, never classified as having no Greek life',async()=>{
 const {greekLifeEvidence,greekLifeLabel}=await import('../coverage-model.mjs');assert.deepEqual(greekLifeEvidence({},'123'),[]);assert.equal(greekLifeLabel({},'123'),'Greek life not yet verified');assert.equal(greekLifeLabel(data,'110662'),'Greek life verified');
});
test('Greek-life evidence does not change FOMO chapter coverage or borrow another campus evidence',async()=>{
 const {greekLifeEvidence}=await import('../coverage-model.mjs'),copy={...data,greekLife:{sources:{test:{url:'https://sigep.org/chapters/'}},schools:{'236948':[{source:'test'}]}}};
 assert.equal(greekLifeEvidence(copy,'377555').length,0);assert.equal(compareCoverage(copy,index,[]).missing.length,5994);assert.equal(compareCoverage(copy,index,[{school:'University of Washington'}]).missing.length,5993);
});
