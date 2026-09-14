import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {campusHillHeight,campusGroundHeight,campusStairHeight,campusRamp} from '../village-campus-hill.js';
import {districtSpecs} from '../village-district-layout.js';
import {createDistricts} from '../village-districts.js';
import {campusPeople,campusPose,createCampusPeople} from '../village-campus-life.js';
import {createCampusKit} from '../village-campus-kit.js';
import {humanPose} from '../village-human-motion.js';

test('all three academic foundations have level support and the hill meets the road at ground level',()=>{
  for(const spec of districtSpecs(0,-1))for(const dx of [-spec.width/2,0,spec.width/2])for(const dz of [-spec.depth/2,0,spec.depth/2]){
    const x=spec.x+dx*Math.cos(spec.rotation)+dz*Math.sin(spec.rotation),z=spec.z+100-dx*Math.sin(spec.rotation)+dz*Math.cos(spec.rotation);
    assert.equal(campusHillHeight(x,z),6,`${spec.type} foundation at ${x},${z}`);
  }
  for(let x=-65;x<=65;x++)for(const z of [-151,-145,-144,-59,-58,-50])assert.equal(campusGroundHeight(x,z),0);
  for(let z=-145;z<-58;z++)for(const x of [-60,60])assert.equal(campusGroundHeight(x,z),0);
});

test('stairs reach the quad and switchbacks stay below an 1:12 incline',()=>{
  assert.equal(campusStairHeight(32),0);assert.equal(campusStairHeight(8),6);
  let previous=0;
  for(let z=32;z>=8;z-=.1){const height=campusStairHeight(z);assert(height>=previous&&height-previous<=.201);previous=height;assert.equal(campusGroundHeight(2,z-100),height);}
  for(let i=1;i<campusRamp.length;i++){
    const a=campusRamp[i-1],b=campusRamp[i];assert((b[2]-a[2])/Math.hypot(b[0]-a[0],b[1]-a[1])<1/12);
    for(let j=0;j<=20;j++){const t=j/20,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=a[2]+(b[2]-a[2])*t;assert(Math.abs(campusGroundHeight(x,z-100)-y)<1e-9);assert(campusHillHeight(x,z)<=y+.001);}
  }
});

test('rendered students and visitors from Greek Row follow the hill elevation',()=>{
  const kit=createCampusKit(T),matrix=new T.Matrix4();
  for(const [kind,cx,cz] of [['library',0,-1],['greek',0,0]]){
    const crowd=createCampusPeople(T,kit,kind,cx,cz),heads=crowd.root.children[1];
    try{
      for(const time of [0,17,41,83,144]){
        crowd.animate(time);
        crowd.people.forEach((person,i)=>{
          if(person.action!=='journey')return;
          const pose=campusPose(person,time),rig=humanPose(person,pose,time),ground=campusGroundHeight(pose.x+cx*100,pose.z+cz*100);
          heads.getMatrixAt(i*4,matrix);
          assert(Math.abs(matrix.elements[13]-(rig.head[1]*person.height+ground+.17))<.00001);
        });
      }
    }finally{crowd.dispose();kit.disposeChunk(crowd.root);}
  }
  assert(campusPeople('greek',0,0).some(p=>p.purpose==='class to campus coffee'));
});

test('only the main campus rises and a larger campus releases evicted hill geometry',()=>{
  const districts=createDistricts(T,76,5);
  try{
    const main=districts.chunks.get('0,-1'),hill=main.group.getObjectByName('main-campus-hillside');assert(hill);
    assert.equal(main.group.children.find(o=>o.name==='library').position.y,6);
    let disposed=false;hill.geometry.addEventListener('dispose',()=>disposed=true);
    districts.update(300,-100);districts.update(300,176);assert(disposed);
    const other=districts.chunks.get('3,-1');assert.equal(other.group.children.find(o=>o.name==='library').position.y,0);assert(!other.group.getObjectByName('main-campus-hillside'));
    districts.update(0,0);assert(districts.chunks.get('0,-1').group.getObjectByName('main-campus-hillside'));
  }finally{districts.dispose();}
});
