import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createFomoBlimp,blimpPose,BLIMP_LAP_SECONDS} from '../village-blimp.js';

test('the flight closes smoothly and faces its direction of travel',()=>{
  const start=blimpPose(0),end=blimpPose(BLIMP_LAP_SECONDS);
  for(const key of ['x','y','z','heading'])assert(Math.abs(start[key]-end[key])<1e-10);
  const blimp=createFomoBlimp(THREE);
  for(let t=0;t<BLIMP_LAP_SECONDS;t+=.5){
    blimp.update(t);blimp.root.updateMatrixWorld(true);
    const a=blimpPose(t),b=blimpPose(t+.001),forward=new THREE.Vector3(1,0,0).applyQuaternion(blimp.root.quaternion);
    assert(forward.dot(new THREE.Vector3(b.x-a.x,0,b.z-a.z).normalize())>.999);
    const bounds=new THREE.Box3().setFromObject(blimp.root);
    assert(bounds.min.y>18,'The entire blimp clears the village rooftops');
  }
  blimp.dispose();
});

test('the envelope and branding are selectable from both sides with bounded geometry',()=>{
  const blimp=createFomoBlimp(THREE);blimp.root.updateMatrixWorld(true);
  for(const side of [-1,1]){
    const origin=blimp.root.position.clone().add(new THREE.Vector3(0,0,side*30));
    const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-side));
    const hit=ray.intersectObjects(blimp.pickables,false)[0];assert(hit);assert.equal(hit.object.userData.action,'discord');
    assert.equal(hit.object.name,`blimp-brand-${side}`);
  }
  let meshes=0,triangles=0;blimp.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.castShadow,false);}});
  assert(meshes<25);assert(triangles<15000);
  const geometry=blimp.root.getObjectByName('blimp-envelope').geometry;let disposals=0;geometry.addEventListener('dispose',()=>disposals++);
  blimp.dispose();assert.equal(disposals,1,'Shared geometry is disposed exactly once');
});
