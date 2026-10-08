import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedTasks} from '../tasks/shared.js';
test('reconnecting preserves an unsaved step when another device has changed it',async()=>{
 const original=globalThis.fetch;const p={id:'local',token:'token',cloud:{tasks:[],steps:[{taskId:'host',step:0,revision:1}]},stepDrafts:{'host:0':{notes:'My unsaved work',_dirty:true}},progress:{},dirty:false};let message='';let restored=false;
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,member:{},tasks:[],steps:[{taskId:'host',step:0,revision:2,draft:{notes:'Other device'}}]})});
 try{const shared=createSharedTasks({getProfile:()=>p,write(){},onState(){},onRestore(){restored=true;},onMessage(text){message=text;}});await shared.start(p);assert.match(message,/changed on another device/);assert.equal(restored,false);assert.equal(p.stepDrafts['host:0'].notes,'My unsaved work');assert.equal(p.cloud.steps[0].revision,1);}finally{globalThis.fetch=original;}
});
