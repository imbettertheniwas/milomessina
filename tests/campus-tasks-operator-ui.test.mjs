import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../invoice/campus-tasks.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function ui(listing){
 const nodes=new Map(),requests=[],state={confirm:true,downloads:[]};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},addEventListener(event,handler){this[event]=handler;},querySelectorAll(){return[];},replaceChildren(){this.innerHTML='';}});return nodes.get(id);};
 const blobs=[];
 const context=vm.createContext({stepTitles:{},downloadTaskFile(){},Blob:class{constructor(parts){blobs.push(parts.join(''));}},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},setTimeout,
  document:{body:{dataset:{consoleView:'tasks'}},getElementById:node,createElement:()=>({click(){state.downloads.push(this.download);}})},
  window:{FOMO_SHEET:{operator:()=>true,session:()=>'admin',endpoint:'/test'},addEventListener(){},confirm:()=>state.confirm},AbortSignal,
  fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);return{json:async()=>structuredClone(listing)};}});
 vm.runInContext(source,context);
 return{node,requests,state,blobs};
}
const member={id:'one',name:'Alex',schoolName:'Duke',activeSessions:2};
const v5={ok:true,members:[member],tasks:[],steps:[],audit:[],notes:[{memberId:'one',notes:'Prefers Venmo',updatedBy:'Arya',updatedAt:'2026-10-01T12:00:00.000Z'}],
 payouts:[{memberId:'one',name:'Alex',schoolName:'Duke',kind:'bonus',amount:100,paidAt:'2026-10-02',paidBy:'Milo',reference:'=HYPERLINK("x")',deleted:false},{memberId:'gone',name:'Sam',schoolName:'NYU',kind:'referral',amount:50,paidAt:'2026-10-03',paidBy:'Milo',reference:'T-1',deleted:true}],
 deleted:[{id:'gone',name:'Sam',schoolName:'NYU',deletedBy:'Milo',deletedAt:'2026-10-04'}]};
test('v5 listing shows the ledger total, sessions, notes and deleted signups',async()=>{
 const h=ui(v5);await new Promise(setImmediate);
 assert.match(h.node('ct-summary').innerHTML,/\$150/);
 assert.match(h.node('ct-detail').innerHTML,/Signed in on 2 devices/);assert.match(h.node('ct-detail').innerHTML,/Prefers Venmo/);assert.match(h.node('ct-detail').innerHTML,/data-ct-note="2026-10-01T12:00:00.000Z"/);
 assert.match(h.node('ct-members').innerHTML,/Deleted signups \(1\)/);assert.match(h.node('ct-members').innerHTML,/data-ct-restore="gone"/);
 assert.equal(h.node('ct-export').hidden,false);
});
test('restore, sign-out and notes send the expected operator actions',async()=>{
 const h=ui(v5);await new Promise(setImmediate);
 await h.node('ct-members').click({target:{closest:s=>s==='[data-ct-restore]'?{dataset:{ctRestore:'gone'}}:null}});
 assert.deepEqual([h.requests.at(-1).action,h.requests.at(-1).memberId],['restoreSignup','gone']);
 await h.node('ct-detail').click({target:{closest:()=>({dataset:{ctRevoke:'one'}})}});
 assert.deepEqual([h.requests.at(-1).action,h.requests.at(-1).memberId],['revokeSessions','one']);
 h.state.confirm=false;const before=h.requests.length;await h.node('ct-detail').click({target:{closest:()=>({dataset:{ctRevoke:'one'}})}});assert.equal(h.requests.length,before);
 await h.node('ct-detail').submit({preventDefault(){},target:{closest:s=>s==='[data-ct-note]'?{dataset:{ctNote:'2026-10-01T12:00:00.000Z'},elements:{notes:{value:'Called'}}}:null}});
 assert.deepEqual([h.requests.at(-1).action,h.requests.at(-1).notes,h.requests.at(-1).since],['note','Called','2026-10-01T12:00:00.000Z']);
});
test('payout export neutralizes spreadsheet formulas and marks deleted signups',async()=>{
 const h=ui(v5);await new Promise(setImmediate);h.node('ct-export').click();
 assert.match(h.state.downloads[0],/^campus-task-payouts-\d{4}-\d{2}-\d{2}\.csv$/);
 const lines=h.blobs[0].split('\r\n');assert.equal(lines.length,3);
 assert.match(lines[1],/"'=HYPERLINK\(""x""\)"/);assert.match(lines[2],/Chapter referral,50,Milo,T-1,yes$/);
});
test('an older backend hides the new controls and keeps the old paid total',async()=>{
 const h=ui({ok:true,members:[{id:'one',name:'Alex',schoolName:'Duke',bonusPaidAt:'2026-10-02'}],tasks:[],steps:[],audit:[]});await new Promise(setImmediate);
 assert.match(h.node('ct-summary').innerHTML,/\$100/);assert.equal(h.node('ct-export').hidden,true);
 assert.doesNotMatch(h.node('ct-detail').innerHTML,/Operator notes|Sign out everywhere|Signed in on/);assert.doesNotMatch(h.node('ct-members').innerHTML,/Deleted signups/);
});
