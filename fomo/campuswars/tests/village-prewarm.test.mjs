import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {prewarmVillage} from '../village-prewarm.js';

function harness(){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(66,1.5,1,650);
  camera.position.set(0,104,104);camera.lookAt(0,2,-5);
  const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);
  scene.add(mesh);const calls=[];let complete,lost=false;
  const renderer={shadowMap:{needsUpdate:false},
    compileAsync(s,c){assert.equal(s,scene);assert.equal(c,camera);calls.push('compile');return new Promise(resolve=>complete=resolve);},
    getContext:()=>({isContextLost:()=>lost}),
    render(s,c){assert.equal(s,scene);assert.equal(c,camera);assert(renderer.shadowMap.needsUpdate);calls.push('present');}
  };
  return {scene,camera,mesh,material,renderer,calls,complete:()=>complete(),lose:()=>lost=true};
}

test('startup compiles once and presents exactly one full-quality frame',async()=>{
  const h=harness(),position=h.camera.position.clone(),rotation=h.camera.quaternion.clone();
  const done=prewarmVillage(h.renderer,h.scene,h.camera);
  assert.deepEqual(h.calls,['compile']);h.complete();assert.equal(await done,true);
  assert.deepEqual(h.calls,['compile','present']);
  assert.equal(h.mesh.material,h.material);assert.equal(h.mesh.frustumCulled,true);
  assert.deepEqual(h.camera.position,position);assert.deepEqual(h.camera.quaternion.toArray(),rotation.toArray());
});

test('a context loss during compilation does not expose a blank canvas',async()=>{
  const h=harness(),done=prewarmVillage(h.renderer,h.scene,h.camera);
  h.lose();h.complete();assert.equal(await done,false);assert.deepEqual(h.calls,['compile']);
});

test('shader errors leave the loader in control and do not draw',async()=>{
  const h=harness();h.renderer.compileAsync=async()=>{throw new Error('GPU unavailable');};
  await assert.rejects(prewarmVillage(h.renderer,h.scene,h.camera),/GPU unavailable/);
  assert.deepEqual(h.calls,[]);assert.equal(h.mesh.material,h.material);
});
