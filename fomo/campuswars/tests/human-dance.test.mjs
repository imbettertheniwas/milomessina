import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdMembers,activityPose} from '../village-layout.js';
import {humanPose} from '../village-human-motion.js';
import {danceActivity,danceProfile} from '../village-human-dance.js';
import {createDistantCrowd} from '../village-distant-crowd.js';
import * as T from '../vendor/three.module.min.js';

const people=crowdMembers([{id:'dance-test',name:'Alpha Beta',joined:80,active:100}]);
const dancers=people.filter(p=>!p.walking&&!p.action);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('front-lawn guests have unique timing, six movement styles and individual breathers',()=>{
  assert.equal(new Set(dancers.map(p=>danceProfile(p).style)).size,6);
  const signatures=dancers.map(p=>[0,1,2,4,10,20].map(t=>JSON.stringify(danceActivity(p,t))).join('|'));
  assert.equal(new Set(signatures).size,dancers.length);
  for(const p of dancers){
    const profile=danceProfile(p),low=danceActivity(p,-profile.offset),high=danceActivity(p,5-profile.offset);
    assert(high.energy>low.energy*4);
    const future=danceActivity(p,10000);danceActivity(p,0);
    assert.deepEqual(danceActivity({...p},10000),future);
  }
});

test('dancing keeps a planted support foot, anatomical limb lengths and bounded personal space',()=>{
  for(const p of dancers)for(let t=0;t<40;t+=.137){
    const state=activityPose(p,t),rig=humanPose(p,state,t);
    assert.equal(state.x,p.x);assert.equal(state.z,p.z);
    assert(rig.legs.some(leg=>Math.abs(leg.ankle[1]-.13)<1e-10));
    for(const leg of rig.legs){
      assert(leg.ankle[1]>=.13&&leg.ankle[1]<.2);
      assert(Math.abs(distance(leg.hip,leg.knee)-.43)<1e-8);
      assert(Math.abs(distance(leg.knee,leg.ankle)-.43)<1e-8);
    }
    for(const arm of rig.arms){
      assert(Math.abs(distance(arm.shoulder,arm.elbow)-.28)<1e-8);
      assert(Math.abs(distance(arm.elbow,arm.hand)-.26)<1e-8);
      assert(Math.abs(arm.hand[0])<.55);
    }
  }
});

test('all dance joints remain continuous at steps and rest transitions',()=>{
  for(const p of dancers){
    const profile=danceProfile(p);
    const samples=[...Array.from({length:200},(_,i)=>i*.151),...Array.from({length:5},(_,i)=>profile.period-profile.offset+i-2)];
    for(const t of samples){
      const a=humanPose(p,activityPose(p,t),t),b=humanPose(p,activityPose(p,t+1e-5),t+1e-5);
      for(const key of ['hip','chest','head'])assert(distance(a[key],b[key])<.0001);
      for(let j=0;j<2;j++)for(const key of ['shoulder','elbow','hand'])assert(distance(a.arms[j][key],b.arms[j][key])<.0001);
    }
  }
});

test('walkers, table players, builders and airborne arrivals retain their own activities',()=>{
  for(const p of people.filter(p=>p.walking||p.action))assert.equal(activityPose(p,12).dance,undefined);
  const builder=crowdMembers([{id:'new',name:'Alpha Beta',joined:3,active:100}])[0];
  assert.equal(activityPose(builder,12).dance,undefined);
  const p=dancers[0],state=activityPose(p,12),airborne={...state,arrival:{arms:.8,crouch:.1}};
  assert.deepEqual(humanPose(p,airborne,12),humanPose(p,{...airborne,dance:undefined},12));
});

test('distant guests retain their individual dance clocks with no additional draw calls',()=>{
  const crowd=createDistantCrowd(T,100),attribute=crowd.mesh.geometry.attributes.dance;
  try{
    crowd.begin(10);
    for(const p of dancers)crowd.add(p,activityPose(p,10));
    crowd.finish();assert.equal(crowd.mesh.count,dancers.length);
    dancers.forEach((p,i)=>assert(Math.abs(attribute.getX(i)-danceActivity(p,10).beat)<1e-5));
    assert.deepEqual(attribute.updateRanges,[{start:0,count:dancers.length*4}]);
    crowd.begin(11);crowd.add(dancers[0],{...activityPose(dancers[0],11),arrival:{arms:1}});crowd.finish();
    assert.equal(attribute.getY(0),0);
  }finally{crowd.dispose();}
});
