import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
function lift(name){
 const start=html.indexOf('function '+name+'('); assert.ok(start>=0,name);
 let depth=0;
 for(let i=html.indexOf('{',start);i<html.length;i++){
  if(html[i]==='{')depth++;
  if(html[i]==='}' && --depth===0)return html.slice(start,i+1);
 }
 throw new Error('Missing function end: '+name);
}
function context(names,values){const c=vm.createContext({Promise,AbortSignal,JSON,Date,...values});for(const name of names)vm.runInContext(lift(name),c);return c;}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const reply=out=>({ok:true,json:async()=>out,text:async()=>JSON.stringify(out)});

test('capability callers share one pending request; a failed probe can be retried',async()=>{
 const pending=deferred();let calls=0;
 const c=context(['gateProbe'],{gateFeatures:null,gateFlight:null,gateAt:0,ENDPOINT:'endpoint',fetch(){calls++;return pending.promise;}});
 const first=c.gateProbe();const second=c.gateProbe();assert.equal(first,second);assert.equal(calls,1);
 pending.reject(new Error('offline'));await assert.rejects(first,/offline/);assert.equal(c.gateFlight,null);
 c.fetch=async()=>{calls++;return reply({ok:true,ledger:true});};
 assert.equal((await c.gateProbe()).ledger,true);await c.gateProbe();assert.equal(calls,2);
 c.gateAt=Date.now()-60001;await c.gateProbe();assert.equal(calls,3);
});
function ledger(){
 const requests=[];let paints=0,saves=0;
 const c=context(['apiSheet','apiSheetRequest'],{
  sheetListFlight:null,sheetWriteVersion:0,lastSheetData:'',listAhead:null,
  moneyHistory:[],profiles:[],rows:[],days:[],subs:[],sheetDays:false,sheetSubs:false,
  ENDPOINT:'endpoint',PASSCODE:'test',identity:{token:'test'},requirePermission:()=>null,
  fetch(url,options){const pending=deferred();requests.push({...pending,action:JSON.parse(options.body).action});return pending.promise;},
  settledStatus:(who,status)=>status,subReceiptsOf:()=>[],rememberMoneyUndo(){},setLive(){},clockNow:()=>'',hideBanner(){},
  render(){paints++;},saveSeen(){saves++;}
 });
 return {c,requests,counts:()=>({paints,saves})};
}
const snapshot=amount=>({ok:true,rows:[{id:'one',who:'Milo',amount,status:'pending'}],days:[],subs:[],profiles:[],moneyHistory:[]});

test('simultaneous ledger reads share the same result, and unchanged polls skip repaint/storage',async()=>{
 const {c,requests,counts}=ledger();const a=c.apiSheet('list'),b=c.apiSheet('list');assert.equal(a,b);assert.equal(requests.length,1);
 requests[0].resolve(reply(snapshot(10)));await a;assert.equal(c.rows[0].amount,10);assert.deepEqual(counts(),{paints:1,saves:1});
 const next=c.apiSheet('list');requests[1].resolve(reply(snapshot(10)));await next;assert.deepEqual(counts(),{paints:1,saves:1});
 const changed=c.apiSheet('list');requests[2].resolve(reply(snapshot(20)));await changed;assert.equal(c.rows[0].amount,20);assert.deepEqual(counts(),{paints:2,saves:2});
});

test('a delayed read cannot overwrite a completed edit, and the next read is fresh',async()=>{
 const {c,requests}=ledger();const old=c.apiSheet('list');const write=c.apiSheet('edit',{id:'one',amount:20});
 requests[1].resolve(reply(snapshot(20)));await write;
 requests[0].resolve(reply(snapshot(10)));await old;assert.equal(c.rows[0].amount,20);
 const fresh=c.apiSheet('list');assert.equal(requests.length,3);requests[2].resolve(reply(snapshot(30)));await fresh;assert.equal(c.rows[0].amount,30);
});

test('a rejected ledger read releases its pending slot for recovery',async()=>{
 const {c,requests}=ledger();const first=c.apiSheet('list');requests[0].reject(new Error('offline'));await assert.rejects(first,/offline/);
 const retry=c.apiSheet('list');requests[1].resolve(reply(snapshot(10)));await retry;assert.equal(c.rows.length,1);
});

test('unrelated views do not build hidden ledger tables, attendance, rules or GitHub calendars',()=>{
 let clocks=0,shifts=0,subs=0;
 const c=context(['render','renderGh'],{view:'overview',renderClock(){clocks++;},renderShifts(){shifts++;},renderSubs(){subs++;},visible(){throw Error('Hidden ledger was read');}});
 for(const view of ['overview','person','charge','campus','posts','visits','schedules','beta']){c.view=view;c.render();c.renderGh();}
 assert.deepEqual([clocks,shifts,subs],[0,0,0]);
 c.view='attendance';c.render();assert.deepEqual([clocks,shifts,subs],[1,1,0]);
 c.view='subs';c.render();assert.deepEqual([clocks,shifts,subs],[1,1,1]);
});

test('permission updates preserve per-record access without repeated linear row searches',()=>{
 const buttons={
  '[data-act]':[{dataset:{act:'edit',id:'mine'}},{dataset:{act:'edit',id:'theirs'}}],
  '[data-shift]':[{dataset:{shift:'day-other'}}],
  '[data-sub]':[{dataset:{id:'sub-other'}}]
 };
 const c=context(['applyPermissionUi'],{identity:{who:'Milo'},rows:[{id:'mine',who:'Milo'},{id:'theirs',who:'Jesse'}],days:[{id:'day-other',who:'Jesse'}],subs:[{id:'sub-other',who:'Jesse'}],
 document:{querySelectorAll:selector=>buttons[selector]||[]},canEdit:r=>r?.who==='Milo',own:who=>who==='Milo',ownRow:r=>r?.who==='Milo',isAdmin:()=>false});
 c.applyPermissionUi();assert.equal(buttons['[data-act]'][0].hidden,false);assert.equal(buttons['[data-act]'][1].hidden,true);assert.equal(buttons['[data-shift]'][0].hidden,true);assert.equal(buttons['[data-sub]'][0].hidden,true);
});


test('a read started during an edit cannot roll back the completed edit',async()=>{
 const {c,requests}=ledger();const write=c.apiSheet('edit',{id:'one',amount:20});const during=c.apiSheet('list');
 requests[0].resolve(reply(snapshot(20)));await write;
 requests[1].resolve(reply(snapshot(10)));await during;assert.equal(c.rows[0].amount,20);
 const fresh=c.apiSheet('list');assert.equal(requests.length,3);requests[2].resolve(reply(snapshot(30)));await fresh;assert.equal(c.rows[0].amount,30);
});

test('reused currency formatter preserves the existing amounts and rounding',()=>{
 const c=context(['money'],{});
 for(const amount of [0,12.5,1000000.23,-1234.569,0.005,-0.004,null,'19.95','bad']){
  const expected='$'+(Math.round((Number(amount)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  assert.equal(c.money(amount),expected);
 }
});
