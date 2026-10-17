import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedTasks} from '../tasks/shared.js';
test('reconnecting preserves an unsaved step when another device has changed it',async()=>{
 const original=globalThis.fetch;const p={account:true,id:'local',name:'QA',school:{id:'duke',name:'Duke University'},token:'token',cloud:{tasks:[],steps:[{taskId:'host',step:0,revision:1}]},stepDrafts:{'host:0':{notes:'My unsaved work',_dirty:true}},progress:{},dirty:false};let message='';let restored=false;
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,member:{},tasks:[],steps:[{taskId:'host',step:0,revision:2,draft:{notes:'Other device'}}]})});
 try{const shared=createSharedTasks({getProfile:()=>p,write(){},onState(){},onRestore(){restored=true;},onMessage(text){message=text;}});await shared.start(p);assert.match(message,/changed on another device/);assert.equal(restored,false);assert.equal(p.stepDrafts['host:0'].notes,'My unsaved work');assert.equal(p.cloud.steps[0].revision,1);}finally{globalThis.fetch=original;}
});
test('calendar-only saves leave older task drafts and records untouched',async()=>{
 const original=globalThis.fetch,requests=[];
 const old={taskId:'host',status:'draft',revision:3,draft:{checks:[true,false],chapter:'Duke',notes:'Existing work'}};
 const p={account:true,id:'calendar-only',school:{name:'Duke'},token:'token',progress:{host:{...old.draft,notes:'Unsaved older work'},calendar:{checks:[true],chapter:'Duke',notes:''}},calendar:{events:[{title:'Mixer',date:'2026-11-07'}],file:null},cloud:{member:{},tasks:[old],steps:[]},dirty:true};
 globalThis.fetch=async(url,options)=>{const input=JSON.parse(options.body);requests.push(input);return{ok:true,json:async()=>({ok:true,member:{},tasks:input.action==='get'?[old]:[old,{taskId:'calendar',status:'draft',revision:1,draft:input.draft}],steps:[]})};};
 try{const shared=createSharedTasks({taskIds:['calendar'],getProfile:()=>p,write(){},onState(){},onRestore(){},onMessage(){}});await shared.start(p);assert.deepEqual(requests.map(r=>[r.action,r.taskId]),[['get',undefined],['save','calendar']]);assert.equal(p.progress.host.notes,'Unsaved older work');assert.equal(p.cloud.tasks[0].revision,3);}finally{globalThis.fetch=original;}
});

test('calendar saves cannot silently rebase an unsaved step over another device',async()=>{
 const original=globalThis.fetch,requests=[];
 const p={id:'conflict',account:true,token:'token',school:{name:'NYU'},progress:{calendar:{checks:[true],chapter:'NYU',notes:''}},calendar:{events:[{title:'Homecoming',date:'2026-11-20'}]},cloud:{member:{},tasks:[],steps:[{taskId:'calendar',step:0,revision:1}]},stepDrafts:{'calendar:0':{notes:'My sponsorship request',_dirty:true,_version:1}},dirty:true};
 const remote={taskId:'calendar',step:0,revision:2,draft:{notes:'Newer request on another device'}};
 globalThis.fetch=async(url,options)=>{const input=JSON.parse(options.body);requests.push(input);return{ok:true,json:async()=>input.action==='savestep'?{ok:false,code:'CONFLICT',error:'This step changed on another device.'}:{ok:true,member:{},tasks:[{taskId:'calendar',revision:1,status:'draft',draft:input.draft}],steps:[remote]}};};
 try{
  const shared=createSharedTasks({taskIds:['calendar'],getProfile:()=>p,write(){},onState(){},onRestore(){},onMessage(){}});
  await assert.rejects(shared.step(p,'calendar',0),{code:'CONFLICT'});
  assert.equal(requests.find(r=>r.action==='savestep').revision,1);
  assert.equal(p.stepDrafts['calendar:0'].notes,'My sponsorship request');assert.equal(p.stepDrafts['calendar:0']._dirty,true);
  await assert.rejects(shared.step(p,'calendar',0),{code:'CONFLICT'});
  assert.equal(requests.at(-1).revision,1,'retry must keep the original edit revision');
 }finally{globalThis.fetch=original;}
});

test('typing during a step save keeps the newer draft dirty and advances only its own revision',async()=>{
 const original=globalThis.fetch,requests=[];
 const d={notes:'First edit',files:[],_dirty:true,_version:1,_baseRevision:1};
 const p={id:'typing',account:true,token:'token',school:{name:'NYU'},progress:{},cloud:{member:{},tasks:[],steps:[{taskId:'host',step:0,revision:1}]},stepDrafts:{'host:0':d}};
 globalThis.fetch=async(url,options)=>{const input=JSON.parse(options.body);requests.push(input);if(requests.length===1){d.notes='Latest edit';d._version++;}return{ok:true,json:async()=>({ok:true,member:{},tasks:[],steps:[{taskId:'host',step:0,revision:input.revision+1,draft:input.draft}]})};};
 try{
  const shared=createSharedTasks({getProfile:()=>p,write(){},onState(){},onRestore(){},onMessage(){}});
  await shared.step(p,'host',0);assert.equal(d._dirty,true);assert.equal(d._baseRevision,2);assert.equal(d.notes,'Latest edit');
  await shared.step(p,'host',0);assert.equal(requests[1].revision,2);assert.equal(requests[1].draft.notes,'Latest edit');assert.equal(d._dirty,false);assert.equal(d._baseRevision,undefined);
 }finally{globalThis.fetch=original;}
});

test('flushing before sign-out saves a pending calendar and retains it if saving fails',async()=>{
 const original=globalThis.fetch,requests=[];
 const p={id:'logout',account:true,token:'token',school:{name:'NYU'},progress:{calendar:{checks:[true],chapter:'NYU',notes:''}},calendar:{events:[{title:'Homecoming',date:'2026-11-20'}]},cloud:{member:{},tasks:[],steps:[]}};
 let failed=true;
 globalThis.fetch=async(url,options)=>{const input=JSON.parse(options.body);requests.push(input);if(failed)throw Error('Offline');return{ok:true,json:async()=>({ok:true,member:{},tasks:[{taskId:'calendar',revision:1,status:'draft',draft:input.draft}],steps:[]})};};
 try{
  const shared=createSharedTasks({taskIds:['calendar'],getProfile:()=>p,write(){},onState(){},onRestore(){},onMessage(){}});
  shared.schedule();await assert.rejects(shared.flush(p),/Offline/);assert.equal(p.dirty,true);assert.equal(p.calendar.events[0].title,'Homecoming');
  failed=false;await shared.flush(p);assert.equal(p.dirty,false);assert.equal(requests.at(-1).draft.calendar.events[0].title,'Homecoming');
  const count=requests.length;await new Promise(resolve=>setTimeout(resolve,1300));assert.equal(requests.length,count,'no stale autosave should run after sign-out');
 }finally{globalThis.fetch=original;}
});
