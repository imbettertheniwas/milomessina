import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../fomo/girls/girls.js',import.meta.url),'utf8');
const capture=script.slice(script.indexOf('function capture('),script.indexOf('function missionButton('));
function harness(answers={}){let saved=0;const ctx=vm.createContext({state:{answers},persist:()=>saved++});vm.runInContext(capture,ctx);return {ctx,get saved(){return saved;}};}
test('tap choices save only the selected radio, independent of option order',()=>{const h=harness();h.ctx.capture({elements:[{name:'college',type:'radio',checked:false,value:'student'},{name:'college',type:'radio',checked:true,value:'graduate'},{name:'college',type:'radio',checked:false,value:'other'},{name:'name',type:'text',value:' Test Person '}]});assert.equal(h.ctx.state.answers.college,'graduate');assert.equal(h.ctx.state.answers.name,'Test Person');assert.equal(h.saved,1);});
test('changing a tap choice updates the answer and unchecking consent is retained',()=>{const h=harness({college:'student',consent:true});h.ctx.capture({elements:[{name:'college',type:'radio',checked:false,value:'student'},{name:'college',type:'radio',checked:true,value:'other'},{name:'consent',type:'checkbox',checked:false},{name:'website',type:'text',value:'spam'}]});assert.equal(h.ctx.state.answers.college,'other');assert.equal(h.ctx.state.answers.consent,false);assert.equal(h.ctx.state.answers.website,undefined);});
