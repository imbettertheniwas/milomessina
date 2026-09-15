import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {campusHillHeight,campusGroundHeight,campusStairHeight,campusRamp} from '../village-campus-hill.js';
import {districtSpecs} from '../village-district-layout.js';
import {createDistricts} from '../village-districts.js';
import {campusPeople,campusPose,createCampusPeople} from '../village-campus-life.js';
import {createCampusKit} from '../village-campus-kit.js';
import {humanPose} from '../village-human-motion.js';
import {createNationalPrize,NATIONAL_PRIZE_SITE,NATIONAL_PRIZE_COPY} from '../village-national-prize.js';

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

test('the national prize monument retains a mystery amount and a small static rendering budget',()=>{
  const prize=createNationalPrize(T);
  let cleaned=false;
  try{
    let draws=0,triangles=0;prize.root.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
    assert(draws<=8);assert(triangles<7000);
    assert.equal(prize.root.userData.prizeAmount,null);
    assert.deepEqual(NATIONAL_PRIZE_COPY,['NATIONAL CHAMPION']);
    assert(prize.root.getObjectByName('national-prize-engraved-cup'));
    assert(!prize.root.getObjectByName('national-prize-label'));
    assert.equal(prize.root.getObjectByName('national-prize-gold').material.color.getHex(),0xe7ad3c);
    const cash=prize.root.getObjectByName('national-prize-cash');assert.equal(cash.count,28);
    assert(cash.instanceMatrix.array.every(Number.isFinite));
    let freed=false;cash.geometry.addEventListener('dispose',()=>freed=true);prize.dispose();cleaned=true;assert(freed);
  }finally{if(!cleaned)prize.dispose();}
});
test('the trophy stands on the main hill beside the central walk and clears every academic building',()=>{
  const districts=createDistricts(T);
  let cleaned=false;
  try{
    const trophy=districts.root.getObjectByName('national-prize-trophy');assert(trophy);
    assert.deepEqual(trophy.getWorldPosition(new T.Vector3()).toArray(),[NATIONAL_PRIZE_SITE.x,NATIONAL_PRIZE_SITE.y,NATIONAL_PRIZE_SITE.z]);
    const bounds=new T.Box3().setFromObject(trophy);assert(bounds.min.x>5.4,'The central path stays clear');
    assert(bounds.min.x>26,'The trophy stays to the side of the main quad and its logo');
    assert(bounds.min.z>-96.69,'The cross-quad walkway stays clear');
    assert(Math.abs(bounds.min.y-6)<1e-5);
    for(const spec of districtSpecs(0,-1)){
      const halfX=(Math.abs(Math.cos(spec.rotation))*spec.width+Math.abs(Math.sin(spec.rotation))*spec.depth)/2;
      const halfZ=(Math.abs(Math.sin(spec.rotation))*spec.width+Math.abs(Math.cos(spec.rotation))*spec.depth)/2;
      assert(bounds.max.x<spec.x-halfX||bounds.min.x>spec.x+halfX||bounds.max.z<spec.z-halfZ||bounds.min.z>spec.z+halfZ);
    }
    const logo=new T.Box3().setFromObject(districts.root.getObjectByName('fomo-campus-building-banner'));
    const projected=(box,camera)=>{
      const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera));
      return new T.Box3().setFromPoints(points);
    };
    for(const position of [[0,4,-43],[68,54,-35],[0,104,104]]){
      const camera=new T.PerspectiveCamera(48,16/9,1,650);camera.position.set(...position);camera.lookAt(0,10,-100);camera.updateMatrixWorld();
      const a=projected(bounds,camera),b=projected(logo,camera);
      assert(a.max.x<b.min.x||a.min.x>b.max.x||a.max.y<b.min.y||a.min.y>b.max.y,'The FOMO / campus logo must stay unobstructed');
    }
    const matrix=trophy.matrixWorld.clone();districts.animate(20);assert(trophy.matrixWorld.equals(matrix));
    let disposed=false;trophy.getObjectByName('national-prize-cash').geometry.addEventListener('dispose',()=>disposed=true);
    districts.dispose();cleaned=true;assert(disposed);
  }finally{if(!cleaned)districts.dispose();}
});
