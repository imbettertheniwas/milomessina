import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createLiveArrivals,ARRIVAL_HEIGHT,ARRIVAL_FALL} from '../village-arrivals.js';
import {createVillage} from '../village-world.js';
import {toWorld,lawnGround} from '../village-layout.js';
import {startChapterFeed} from '../chapter-feed.js';
import {humanPose} from '../village-human-motion.js';
const chapter=(joined,id='test')=>({id,joined,active:100,name:'Test Chapter',letters:'TC',school:'Test University',shortSchool:'Test',type:'Fraternity',registered:'Sep 15, 2026'});
const snapshot=(joined,extra={})=>({live:true,updatedAt:new Date().toISOString(),chapters:[chapter(joined)],...extra});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('live feed counts only fresh increases after the first network baseline',async()=>{
  let current=snapshot(20);const updates=[];
  const feed=startChapterFeed({initialSnapshot:snapshot(1,{updatedAt:'2026-01-01T00:00:00Z'}),storageRef:null,onUpdate:s=>updates.push(s),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>current})});
  await flush();assert.deepEqual(updates.at(-1).arrivals,[]);
  current=snapshot(23);await feed.refresh();assert.deepEqual(updates.at(-1).arrivals,[{chapter:'test',from:20,to:23}]);
  const count=updates.length;await feed.refresh();assert.equal(updates.length,count);
  current=snapshot(21);await feed.refresh();assert.deepEqual(updates.at(-1).arrivals,[]);
  current=snapshot(25,{stale:true});await feed.refresh();assert.deepEqual(updates.at(-1).arrivals,[]);
  current=snapshot(25,{chapters:[chapter(25),chapter(3,'new-chapter')]});await feed.refresh();assert.deepEqual(updates.at(-1).arrivals,[{chapter:'new-chapter',from:0,to:3}]);
  feed.stop();
});

test('unchanged first network data still establishes the join baseline',async()=>{
  let current=snapshot(20);const updates=[];
  const feed=startChapterFeed({initialSnapshot:current,storageRef:null,onUpdate:s=>updates.push(s),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>current})});
  await flush();assert.equal(updates.length,0);current=snapshot(21);await feed.refresh();assert.equal(updates[0].arrivals[0].from,20);feed.stop();
});

test('only new member slots fall, touch the grass, bounce and resume their normal pose',()=>{
  const arrivals=createLiveArrivals(),village=createVillage(T,[chapter(21)]);
  arrivals.enqueue([{chapter:'test',from:20,to:21}]);arrivals.start([chapter(21)],10);
  const member=village.members.find(m=>m.member===21),state={...toWorld(member.lot,3,10),ground:lawnGround(3,10),rotation:member.rotation};
  const start=arrivals.pose(member,state,10),mid=arrivals.pose(member,state,11),land=arrivals.pose(member,state,10+ARRIVAL_FALL);
  assert.equal(start.ground,state.ground+ARRIVAL_HEIGHT);assert(mid.ground<start.ground&&mid.ground>state.ground);
  assert(Math.abs(land.ground-state.ground)<1e-10);assert(arrivals.pose(member,state,12.45).ground>state.ground);
  assert.deepEqual(arrivals.pose(village.members[0],state,10),state);
  assert.deepEqual(arrivals.pose(member,state,10),start,'frozen clock keeps the airborne pose');
  assert.deepEqual(arrivals.pose(member,state,20),state);
  const rig=humanPose(member,start,10);assert(rig.arms.every(a=>a.hand[1]>a.shoulder[1]));
  arrivals.advance(20);assert.equal(arrivals.has('test'),false);village.dispose();
});

test('arrivals survive replacement, use the new chapter lawn, and keep exact crowd totals',()=>{
  const arrivals=createLiveArrivals();arrivals.enqueue([{chapter:'test',from:19,to:21}]);arrivals.start([chapter(21),chapter(50,'leader')],5);
  const old=createVillage(T,[chapter(21),chapter(50,'leader')],{arrivals});old.animateCrowd(6);
  const next=createVillage(T,[chapter(90),chapter(50,'leader')],{arrivals,streets:old.streets});
  arrivals.start([chapter(90),chapter(50,'leader')],6);next.animateCrowd(6);
  assert.equal(next.members.length,140);assert.notDeepEqual(old.anchors.find(a=>a.id==='test').lot,next.anchors.find(a=>a.id==='test').lot);
  const matrix=new T.Matrix4(),point=new T.Vector3();
  for(const village of [old,next]){
    const index=village.members.findIndex(m=>m.chapter==='test'&&m.member===20);
    village.parts.head.getMatrixAt(index,matrix);point.setFromMatrixPosition(matrix);assert(point.y>20);assert(village.parts.head.boundingSphere.containsPoint(point));
    const member=village.members[index];assert(Math.hypot(point.x-member.lot.x,point.z-member.lot.z)<20);
  }
  old.dispose();next.dispose();
});

test('new construction members land on front grass and reduced motion skips the fall',()=>{
  const arrivals=createLiveArrivals(),input=[chapter(3)],village=createVillage(T,input),m=village.members[2];
  arrivals.enqueue([{chapter:'test',from:2,to:3}]);arrivals.start(input,0);
  const animated=createVillage(T,input,{arrivals});animated.animateCrowd(1);animated.animateCrowd(ARRIVAL_FALL);animated.dispose();
  const state={x:m.lot.x,z:m.lot.z,ground:4,rotation:0};
  const landed=arrivals.pose(m,state,ARRIVAL_FALL);assert(landed.ground<.2);assert(Math.hypot(landed.x-m.lot.x,landed.z-m.lot.z)>10);
  const reduced=createLiveArrivals();reduced.enqueue([{chapter:'test',from:2,to:3}]);reduced.start(input,0,true);assert.equal(reduced.pose(m,state,0),state);
  arrivals.start([chapter(1)],1);assert.equal(arrivals.has('test'),false);village.dispose();
});
