import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,rankCampuses,selectRollout,validateConfig,validateData,csv,haversine} from '../src/model.mjs';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const data=load('data/campuses.json'),metrics=load('config/metrics.json'),profiles=load('config/profiles.json'),policy=load('config/rollout.json');
const source={url:'https://example.edu/report',publisher:'Test fixture institution',accessed:'2026-09-29',data_year:'2026',source_type:'university_primary'};
const fixture=(values)=>({as_of:'2026-09-29',sources:{test:source},schools:[{unitid:'fixture',school:'Test fixture — not a real campus',latitude:40,longitude:-75,region:'test',cbsa:null,metrics:Object.fromEntries(values.map((v,i)=>['m'+i,{value:v,source_ids:v===null?[]:['test'],qualifier:'reported'}]))}]});
const config={m0:{label:'Fixture A',category:'a',weight:1,unit:'students',normalization:{method:'linear',min:0,max:100}},m1:{label:'Fixture B',category:'b',weight:1,unit:'students',normalization:{method:'linear',min:0,max:100}}};

test('fixed anchors clamp and invert without cohort dependence',()=>{
  assert.equal(normalize(-5,{method:'linear',min:0,max:100}),0);
  assert.equal(normalize(200,{method:'linear',min:0,max:100}),100);
  assert.equal(normalize(25,{method:'linear',min:0,max:100,invert:true}),75);
  assert.equal(normalize(9,{method:'log',min:0,max:99}),50);
  assert.equal(normalize(null,{method:'linear',min:0,max:100}),null);
});
test('complete weighted average has zero-width uncertainty bounds',()=>{
  const [r]=rankCampuses(fixture([80,20]),config,{a:75,b:25});
  assert.equal(r.overall_score,65);assert.equal(r.score_lower_bound,65);assert.equal(r.score_upper_bound,65);assert.equal(r.weighted_completeness_pct,100);
});
test('missing is not zero and bounds retain all requested weight',()=>{
  const [r]=rankCampuses(fixture([80,null]),config,{a:75,b:25});
  assert.equal(r.overall_score,80);assert.equal(r.score_lower_bound,60);assert.equal(r.score_upper_bound,85);assert.equal(r.weighted_completeness_pct,75);assert.equal(r.category_scores.b.score,null);
  assert.equal(r.metrics.m1.value,null);
});
test('observed zero contributes evidence and differs from missing',()=>{
  const [r]=rankCampuses(fixture([80,0]),config,{a:75,b:25});
  assert.equal(r.overall_score,60);assert.equal(r.weighted_completeness_pct,100);
});
test('no observations produces no score or false confidence',()=>{
  const [r]=rankCampuses(fixture([null,null]),config,{a:75,b:25});
  assert.equal(r.overall_score,null);assert.equal(r.confidence_score,null);assert.equal(r.weighted_completeness_pct,0);
});
test('rescaling weights is invariant',()=>{
  const a=rankCampuses(data,metrics,profiles.default),b=rankCampuses(data,metrics,Object.fromEntries(Object.entries(profiles.default).map(([k,v])=>[k,v*2])));
  assert.deepEqual(a.map(s=>s.overall_score),b.map(s=>s.overall_score));
});
test('invalid weights and anchors fail closed',()=>{
  assert.throws(()=>validateConfig(config,{a:0,b:0}));assert.throws(()=>validateConfig(config,{a:-1,b:20}));assert.throws(()=>validateConfig(config,{a:NaN,b:20}));assert.throws(()=>normalize(5,{method:'linear',min:5,max:5}));
});
test('new campus does not change existing individual scores',()=>{
  const a=rankCampuses(data,metrics,profiles.default),copy=structuredClone(data);copy.schools.push({...structuredClone(copy.schools[0]),unitid:'fixture-added'});
  const b=rankCampuses(copy,metrics,profiles.default);
  for(const s of a)assert.equal(s.overall_score,b.find(c=>c.unitid===s.unitid).overall_score);
});
test('selected universe has unique campuses and sourced finite values',()=>{
  const selected=load('data/candidates.json').filter(s=>s.selected).length;
  assert.equal(data.schools.length,selected);assert.equal(new Set(data.schools.map(s=>s.unitid)).size,selected);validateData(data,metrics);
  for(const profile of Object.values(profiles))for(const s of rankCampuses(data,metrics,profile)){
    assert.ok(s.overall_score>=0&&s.overall_score<=100);assert.ok(s.score_lower_bound<=s.overall_score+1e-9);assert.ok(s.score_upper_bound>=s.overall_score-1e-9);
  }
});
test('unprovided client data and unaudited creator density remain null',()=>{
  for(const s of data.schools)for(const [id,m] of Object.entries(metrics))if(['customers','performance'].includes(m.category)||id==='verified_creators_per_1000')assert.equal(s.metrics[id].value,null);
});
test('WSU system figures are excluded from campus scoring',()=>{
  const s=data.schools.find(s=>s.unitid==='236939');assert.equal(s.metrics.undergraduates.value,null);assert.equal(s.metrics.undergraduates.reported_institution_value,21923);assert.equal(s.metrics.relevant_awards.value,null);
});
test('unsourced values and duplicate identities are rejected',()=>{
  const d=fixture([80,20]);d.schools[0].metrics.m0.source_ids=[];assert.throws(()=>validateData(d,config));
  const dup=fixture([80,20]);dup.schools.push(dup.schools[0]);assert.throws(()=>validateData(dup,config));
});
test('rollout meets hard caps, evidence threshold, uniqueness and deterministic order',()=>{
  const ranked=rankCampuses(data,metrics,profiles.default),a=selectRollout(ranked,policy),b=selectRollout(ranked,policy);
  assert.equal(a.selected,20);assert.deepEqual(a,b);assert.equal(new Set(a.campuses.map(s=>s.unitid)).size,20);
  const regions={},metros={};for(const s of a.campuses){regions[s.region]=(regions[s.region]||0)+1;if(s.cbsa)metros[s.cbsa]=(metros[s.cbsa]||0)+1;assert.ok(s.weighted_completeness_pct>=policy.min_weighted_completeness_pct);}
  assert.ok(Object.values(regions).every(n=>n<=policy.max_per_region));assert.ok(Object.values(metros).every(n=>n<=policy.max_per_metro));
});
test('infeasible rollout returns shortfall instead of silently relaxing constraints',()=>{
  const r=selectRollout(rankCampuses(data,metrics,profiles.default),{...policy,min_weighted_completeness_pct:100});assert.equal(r.selected,0);assert.equal(r.complete,false);
});
test('geographic distance is symmetric and zero for identical coordinates',()=>{
  const a={latitude:0,longitude:0},b={latitude:0,longitude:1};assert.equal(haversine(a,a),0);assert.ok(Math.abs(haversine(a,b)-111.195)<.01);assert.equal(haversine(a,b),haversine(b,a));
});
test('CSV preserves missing values, escapes quotes and mitigates formulas',()=>{
  assert.equal(csv([{a:null,b:'=SUM(1,2)',c:'A "quote"'}],['a','b','c']),'"a","b","c"\n"","\'=SUM(1,2)","A ""quote"""\n');
});
test('client audience target changes normalization explicitly',()=>{
  assert.equal(normalize(70,{method:'target',target:70,tolerance:50}),100);assert.equal(normalize(20,{method:'target',target:70,tolerance:50}),0);
});
test('ROI can be negative or above 100 without being treated as a share',()=>{
  const d=structuredClone(data);d.schools[0].metrics.roi_pct={value:-50,source_ids:['HD2024'],qualifier:'test_fixture'};validateData(d,metrics);
  d.schools[0].metrics.roi_pct.value=200;validateData(d,metrics);
});
