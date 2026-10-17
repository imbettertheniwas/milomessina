import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStepEditors} from '../tasks/steps.js';

test('dinner editors and checkboxes unlock together only after every planning approval',()=>{
 const offers=JSON.parse(fs.readFileSync(new URL('../tasks/offers.json',import.meta.url)));
 const editors=[3,4].map(step=>{
  assert.deepEqual(offers[0].tasks[step].afterApproval,[0,1,2]);
  const fields=new Map(),check={};
  return {dataset:{taskId:'dinner',step:String(step),stepAfter:'0,1,2'},classList:{toggle(){}},
   closest:()=>({querySelector:()=>check}),check,
   querySelector(selector){if(!fields.has(selector))fields.set(selector,{addEventListener(){},replaceChildren(){}});return fields.get(selector);}};
 });
 const original=globalThis.document;
 globalThis.document={querySelectorAll:()=>editors};
 try{
  const p={id:'test',cloud:{tasks:[],steps:[]}};
  const ui=createStepEditors({getProfile:()=>p,write(){},shared:{},onChange(){}});
  const check=locked=>{ui.paint();for(const el of editors){for(const selector of ['[data-step-notes]','[data-step-upload]','[data-step-submit]'])assert.equal(el.querySelector(selector).disabled,locked);assert.equal(el.check.disabled,locked);assert.equal(el.querySelector('[data-step-lock]').hidden,!locked);}};
  check(true);
  p.cloud.steps=[0,1,2].map(step=>({taskId:'dinner',step,status:'submitted'}));check(true);
  p.cloud.steps[2].status='approved';check(true);
  p.cloud.steps[0].status='approved';check(true);
  p.cloud.steps[1].status='approved';check(false);
  p.cloud.steps[0].status='changes_requested';check(true);
 }finally{globalThis.document=original;}
});
