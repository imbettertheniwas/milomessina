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
