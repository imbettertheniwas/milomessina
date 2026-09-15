import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {BACKYARD} from '../village-backyards.js';
import {poolActivityPose,poolHumanPose} from '../village-pool-people.js';
import {palettes} from '../village-district-layout.js';
const chapter={id:'pool-party',name:'Sigma Chi',letters:'ΣΧ',school:'San Diego State University',active:100,joined:80};
const local=(lot,x,z)=>{const dx=x-lot.x,dz=z-lot.z,c=Math.cos(lot.rotation),s=Math.sin(lot.rotation);return {x:dx*c-dz*s,z:dx*s+dz*c};};

test('eligible houses move existing members into swimsuits without changing the roster or lawn games',()=>{
  const locked=createVillage(T,[{...chapter,joined:79}]),v=createVillage(T,[chapter]);
  try{
    assert(!locked.members.some(m=>m.poolRole));assert.equal(locked.swimWakes.mesh.count,0);
    assert.equal(v.members.length,80);assert.equal(new Set(v.members.map(m=>m.member)).size,80);
    const bathers=v.members.filter(m=>m.poolRole);
    assert.deepEqual(bathers.map(m=>m.poolRole),['swim','swim','lounge','lounge','chat','chat']);
    assert.equal(v.members.filter(m=>m.action==='pong').length,2);assert.equal(v.members.filter(m=>m.action==='die').length,4);
    for(const m of bathers){
      assert(!m.backpack&&!m.jacket&&!m.cap);assert.equal(m.outfit,'swim');
      const i=v.members.indexOf(m),color=new T.Color();
      v.parts.armL.getColorAt(i,color);assert.equal(color.getHex(),palettes.skin[m.skin]);
      v.parts.pelvis.getColorAt(i,color);assert.equal(color.getHex(),m.swimColor);
    }
    assert.equal(v.swimWakes.mesh.count,4);
    const before=v.swimWakes.mesh.instanceMatrix.array.slice();v.animateCrowd(1);assert.notDeepEqual(v.swimWakes.mesh.instanceMatrix.array,before);
    const paused=v.parts.armL.instanceMatrix.array.slice();v.animateCrowd(1);assert.deepEqual(v.parts.armL.instanceMatrix.array,paused);
  }finally{locked.dispose();v.dispose();}
});

test('swimmers move through separate lanes and bathers remain inside their own terrace on both sides',()=>{
  const v=createVillage(T,[chapter,{...chapter,id:'opposite'}]);
  try{
    const bathers=v.members.filter(m=>m.poolRole),seen=new Map();
    for(let t=0;t<=60;t+=.2){
      v.animateCrowd(t);
      for(const m of bathers){
        const i=v.members.indexOf(m),matrix=new T.Matrix4();v.parts.torso.getMatrixAt(i,matrix);
        const p=local(m.lot,matrix.elements[12],matrix.elements[14]);
        assert(p.x>BACKYARD.minX&&p.x<BACKYARD.maxX&&p.z>BACKYARD.minZ&&p.z<BACKYARD.maxZ);
        if(m.poolRole==='swim'){
          assert(p.x>-5&&p.x<1.1&&p.z>-12.45&&p.z<-8.45,JSON.stringify(p));
          assert(matrix.elements[13]>.6&&matrix.elements[13]<.9,'swimming body meets the water');
          if(!seen.has(m))seen.set(m,[]);seen.get(m).push(p.x);
        }
      }
    }
    for(const xs of seen.values())assert(Math.max(...xs)-Math.min(...xs)>2,'swimmers complete laps instead of treading in one spot');
  }finally{v.dispose();}
});

test('swim strokes articulate arms and legs and remain deterministic after long pauses',()=>{
  const v=createVillage(T,[{...chapter,active:10,joined:8}]);
  try{
    assert.equal(v.members.length,8);assert.deepEqual(v.members.filter(m=>m.poolRole).map(m=>m.poolRole),['swim','lounge']);
    const m=v.members.find(m=>m.poolRole==='swim'),state=poolActivityPose(m,30);
    const a=poolHumanPose(m,state,30),b=poolHumanPose(m,state,30.5);
    assert.notDeepEqual(a.arms[0].hand,b.arms[0].hand);assert.notDeepEqual(a.legs[0].ankle,b.legs[0].ankle);
    assert(a.head[2]>a.hip[2]&&a.legs[0].ankle[2]<a.hip[2]);assert.equal(a.lean,Math.PI/2);
    const future=poolHumanPose(m,poolActivityPose(m,1000),1000);poolHumanPose(m,state,0);
    assert.deepEqual(poolHumanPose(m,poolActivityPose(m,1000),1000),future);
  }finally{v.dispose();}
});
