import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {recordArrivalHistory,recentArrivalHistory,RECENT_ARRIVAL_MS} from '../chapter-arrival-history.js';
import {startChapterFeed} from '../chapter-feed.js';
import {createLiveArrivals,ARRIVAL_FALL,ARRIVAL_SETTLE} from '../village-arrivals.js';
import {createVillage} from '../village-world.js';
import {createChapterHandler} from '../../../api/campuswars.mjs';
const epoch=Date.parse('2026-09-15T20:00:00Z');
const chapter=joined=>({id:'test',name:'Test',letters:'TT',school:'Test',shortSchool:'Test',type:'Fraternity',registered:'2026-09-15',joined,active:100});
const snap=(joined,seconds=0)=>({live:true,updatedAt:new Date(epoch+seconds*1000).toISOString(),chapters:[chapter(joined)]});
const record=(from,to,seconds)=>({chapter:'test',from,to,at:new Date(epoch+seconds*1000).toISOString()});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('shared server history records only observed increases and expires at five minutes',()=>{
 const first=recordArrivalHistory(snap(20),null);assert.deepEqual(first.recentArrivals,[]);
 const next=recordArrivalHistory(snap(23,30),first);assert.deepEqual(next.recentArrivals,[record(20,23,30)]);
 const same=recordArrivalHistory(snap(23,60),next);assert.deepEqual(same.recentArrivals,next.recentArrivals);
 const less=recordArrivalHistory(snap(21,90),same);assert.equal(less.recentArrivals[0].to,21);
 assert.deepEqual(recordArrivalHistory(snap(30,500),less).recentArrivals,[],'outage cannot turn old joins into recent ones');
 assert.deepEqual(recentArrivalHistory(next.recentArrivals,next.chapters,epoch+330000),[]);
 assert.equal(recentArrivalHistory([...next.recentArrivals,...next.recentArrivals],next.chapters,epoch+60000).length,1);
 assert.deepEqual(recentArrivalHistory([null,record(0,20,100)],next.chapters,epoch),[]);
});

test('first-time visitor replays recent joins even when counts match, then never repeats them while polling',async()=>{
 const current={...snap(24,100),recentArrivals:[record(20,22,20),record(22,24,60),record(1,3,-300),record(5,8,200)]};const updates=[];
 const feed=startChapterFeed({initialSnapshot:current,storageRef:null,now:()=>epoch+100000,onUpdate:s=>updates.push(s),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>current})});
 await flush();assert.equal(updates.length,1);assert.deepEqual(updates[0].arrivals,[{chapter:'test',from:20,to:24}]);assert.equal(updates[0].replayArrivals,true);
 await feed.refresh();assert.equal(updates.length,1);feed.stop();
});

test('saved observed joins replay on reload but stale responses and expired records do not',async()=>{
 for(const stale of [false,true]){
  const updates=[],cached={...snap(22,30),recentArrivals:[record(20,22,30)]};
  const feed=startChapterFeed({initialSnapshot:cached,storageRef:{getItem:()=>JSON.stringify(cached),setItem(){}},now:()=>epoch+60000,onUpdate:s=>updates.push(s),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>({...snap(22,60),stale})})});
  await flush();assert.equal(updates.length,stale?0:1);feed.stop();
 }
});

test('the public endpoint shares recent ranges with a new browser without names or member records',async()=>{
 let time=epoch,joined=20;
 const handler=createChapterHandler({now:()=>time,env:{CAMPUSWARS_ADMIN_PASSWORD:'test-only'},load:async()=>({...snap(joined),updatedAt:new Date(time).toISOString()})});
 const request=async()=>{const r={setHeader(){},status(){return this;},json(body){this.body=body;},end(raw){this.body=raw?JSON.parse(raw):null;}};await handler({method:'GET',headers:{}},r);return r.body;};
 assert.deepEqual((await request()).recentArrivals,[]);time+=30000;joined=22;
 const updated=await request();assert.deepEqual(updated.recentArrivals,[record(20,22,30)]);assert.deepEqual((await request()).recentArrivals,updated.recentArrivals);
});

test('parachutes stay suspended for nine seconds and collapse after landing with one draw batch',()=>{
 const arrivals=createLiveArrivals();arrivals.enqueue([{chapter:'test',from:20,to:22}]);arrivals.start([chapter(22)],0);
 const village=createVillage(T,[chapter(22)],{arrivals,compactCrowd:true});
 village.animateCrowd(4);assert.equal(village.parachutes.mesh.count,2);assert(ARRIVAL_FALL>=9);
 const matrix=new T.Matrix4();village.parachutes.mesh.getMatrixAt(0,matrix);assert(matrix.elements[13]>15);
 const frozen=Array.from(village.parachutes.mesh.instanceMatrix.array);village.animateCrowd(4);assert.deepEqual(Array.from(village.parachutes.mesh.instanceMatrix.array),frozen);
 village.animateCrowd(ARRIVAL_FALL+ARRIVAL_SETTLE+1);assert.equal(village.parachutes.mesh.count,0);
 let disposed=false;village.parachutes.mesh.geometry.addEventListener('dispose',()=>disposed=true);village.dispose();assert(disposed);
});

test('intro defers the arrival clock until the village is ready for the replay',()=>{
 const a=createLiveArrivals(),member={chapter:'test',member:21,lot:{x:0,z:0,rotation:0}},state={x:3,z:10,ground:.13};
 a.enqueue([{chapter:'test',from:20,to:21}]);a.start([chapter(21)],0,false,true);a.advance(30);assert.equal(a.pose(member,state,30),state);
 a.start([chapter(21)],30);assert(a.pose(member,state,30).ground>30);assert(a.pose(member,state,35).ground>10);
});

test('a stale first response does not consume the entry replay before fresh data arrives',async()=>{
 let current={...snap(22,40),recentArrivals:[record(20,22,30)],stale:true};const updates=[];
 const feed=startChapterFeed({initialSnapshot:current,storageRef:null,now:()=>epoch+60000,onUpdate:s=>updates.push(s),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>current})});
 await flush();assert.equal(updates.length,0);current={...current,stale:false};await feed.refresh();assert.deepEqual(updates[0].arrivals,[{chapter:'test',from:20,to:22}]);await feed.refresh();assert.equal(updates.length,1);feed.stop();
});
