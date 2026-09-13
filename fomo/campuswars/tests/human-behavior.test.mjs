import test from 'node:test';
import assert from 'node:assert/strict';
import {appearance,districtSpecs} from '../village-district-layout.js';
import {campusPeople,campusPose} from '../village-campus-life.js';
import {personalClock,conversation} from '../village-human-behavior.js';
import {journeyPose,marketJourneys} from '../village-place-layout.js';
import {crowdMembers} from '../village-layout.js';

test('individual clocks stop, accelerate continuously and reproduce after long offscreen gaps',()=>{
  const signatures=[];
  for(let i=0;i<24;i++){
    const person=appearance('student',i),samples=[];let stops=0;
    for(let t=0;t<200;t+=.17){
      const a=personalClock(person,t),b=personalClock(person,t+.0001);
      assert(a.motion>=0&&a.motion<=1);
      assert(Math.abs((b.time-a.time)/.0001-a.motion)<.001);
      assert(Math.abs(b.motion-a.motion)<.001);
      if(a.motion===0)stops++;
      samples.push(a.motion.toFixed(2));
    }
    assert(stops>0);signatures.push(samples.join(','));
    const future=personalClock(person,4000);personalClock(person,1);
    assert.deepEqual(personalClock(appearance('student',i),4000),future);
  }
  assert.equal(new Set(signatures).size,24);
});

test('conversations include quiet moments and variable speakers without simultaneous talking',()=>{
  const group=Array.from({length:5},(_,seat)=>({...appearance('friends',seat),groupPhase:19,groupSize:5,seat,phase:seat}));
  const speakers=new Set();let quiet=0;
  for(let t=0;t<160;t+=.2){
    const active=group.filter(p=>conversation(p,t).speaking);
    assert(active.length<=1);if(!active.length)quiet++;else speakers.add(active[0].seat);
  }
  assert(quiet>0);assert.equal(speakers.size,5);
});

test('academic destinations stay outside buildings and retain diverse stable identities',()=>{
  const people=campusPeople('library',0,-1),specs=districtSpecs(0,-1);
  assert(new Set(people.filter(p=>p.action==='journey').map(p=>JSON.stringify(p.points))).size>20);
  for(const t of [0,10,30,60,110,170,250,1000])for(const person of people){
    const pose=campusPose(person,t);if(pose.hidden||person.action==='doorway')continue;
    for(const spec of specs){
      const dx=pose.x-spec.x,dz=pose.z-(spec.z+100),a=spec.rotation,x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
      assert(!(Math.abs(x)<spec.width/2&&Math.abs(z)<spec.depth/2));
    }
  }
  assert.deepEqual(people,campusPeople('library',0,-1));
  for(const trait of ['hairStyle','outfit','temperament'])assert(new Set(people.map(p=>p[trait])).size>=4);
  const a=crowdMembers([{id:'test',name:'Alpha Beta',school:'Test School',joined:40,active:100}]),b=crowdMembers([{id:'test',name:'Alpha Beta',school:'Test School',joined:41,active:100}]);
  for(const p of a){const other=b.find(m=>m.member===p.member);for(const key of ['identity','shirt','skin','hairStyle','outfit','build'])assert.equal(p[key],other[key]);}
});

test('destination turns remain continuous through stops and cycle boundaries',()=>{
  for(const points of [[[0,0,3],[0,8,0],[4,8,4],[4,0,0]],...marketJourneys.map(j=>j.points)])for(let t=0;t<300;t+=.013){
    const a=journeyPose(points,t,.9),b=journeyPose(points,t+.0001,.9);
    assert(Math.hypot(a.x-b.x,a.z-b.z)<.001);
    assert(Math.abs(Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle)))<.002);
  }
});
