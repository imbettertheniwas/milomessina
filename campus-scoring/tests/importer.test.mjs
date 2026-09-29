import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {csv} from '../src/model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const headers=readFileSync(path.join(root,'data/client-template.csv'),'utf8').trim().split(',');
// Synthetic arithmetic fixtures are temporary, explicitly labeled, and never public campus observations.
function run(row,action){
  mkdirSync(path.join(root,'private'),{recursive:true});
  const dir=mkdtempSync(path.join(root,'private','test-fixture-'));
  const input=path.join(dir,'synthetic-test-only.csv'),out=path.join(dir,'result.json');
  writeFileSync(input,csv([row],headers));
  try{return action(input,out);}finally{rmSync(dir,{recursive:true,force:true});}
}
const base={unitid:'100751',campaign_id:'SYNTHETIC_ARITHMETIC_TEST_ONLY',window_start:'2026-01-01',window_end:'2026-01-31',attribution_definition:'Synthetic test fixture, not actual university performance'};
test('client import derives ratios and preserves blanks without changing public database',()=>{
  const before=readFileSync(path.join(root,'data/campuses.json'),'utf8');
  run({...base,spend_usd:1000,incremental_customers:10,eligible_leads:100,contribution_margin_usd:1500},(input,out)=>{
    execFileSync('python3',['scripts/import_client.py',input,'--client','TEST_ONLY','--out',out],{cwd:root});
    const d=JSON.parse(readFileSync(out));const values=Object.fromEntries(d.observations.map(o=>[o.metric,o.value]));
    assert.equal(values.cac_usd,100);assert.equal(values.conversion_pct,10);assert.equal(values.roi_pct,50);assert.equal(values.leads,100);
    assert.equal(values.customers_per_1000,undefined);assert.equal(values.engagement_pct,undefined);
    assert.ok(d.observations.every(o=>o.calculation_inputs.spend_usd===1000));
  });
  assert.equal(readFileSync(path.join(root,'data/campuses.json'),'utf8'),before);
});
test('zero acquired customers never becomes a zero CAC',()=>{
  run({...base,spend_usd:1000,incremental_customers:0,eligible_leads:100},(input,out)=>{
    execFileSync('python3',['scripts/import_client.py',input,'--client','TEST_ONLY','--out',out],{cwd:root});
    const obs=JSON.parse(readFileSync(out)).observations;
    assert.equal(obs.some(o=>o.metric==='cac_usd'),false);assert.equal(obs.find(o=>o.metric==='conversion_pct').value,0);
  });
});
test('inconsistent conversion denominator is rejected',()=>{
  run({...base,incremental_customers:20,eligible_leads:10},(input,out)=>{
    const p=spawnSync('python3',['scripts/import_client.py',input,'--client','TEST_ONLY','--out',out],{cwd:root,encoding:'utf8'});
    assert.notEqual(p.status,0);assert.match(p.stderr,/Customers exceed eligible leads/);
  });
});
