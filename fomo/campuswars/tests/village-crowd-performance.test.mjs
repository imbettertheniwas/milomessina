import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {activityPose} from '../village-layout.js';

const chapters=Array.from({length:45},(_,i)=>({id:`crowd-${i}`,name:'Alpha Beta',letters:'ΑΒ',school:'Test School',shortSchool:'Test',joined:i%3===0?14:20,active:100}));
function cameraAt(x=0,z=38,lookZ=-50){const camera=new T.PerspectiveCamera(48,16/9,1,650);camera.position.set(x,8,z);camera.lookAt(x,2,lookZ);camera.updateMatrixWorld();return camera;}

test('a populated multi-street village skips invisible members with exactly matching visible poses',()=>{
  const optimized=createVillage(T,chapters),reference=createVillage(T,chapters),camera=cameraAt();
  try{
    reference.animateCrowd(23);
    const updated=optimized.animateCrowd(23,camera);
    assert(updated>0&&updated<optimized.members.length/2);assert.equal(optimized.members.length,810);
    const visible=optimized.crowdVisibility.visible(camera,optimized.world.matrixWorld);
    for(const batch of visible)for(const name of Object.keys(optimized.parts)){
      const start=batch.start*16,end=(batch.start+batch.count)*16;
      assert.deepEqual(optimized.parts[name].instanceMatrix.array.slice(start,end),reference.parts[name].instanceMatrix.array.slice(start,end));
    }
    assert(optimized.crowdVisibility.batches.some(b=>b.time===0),'Invisible people retain their initial pose');
    const versions=Object.values(optimized.parts).map(m=>m.instanceMatrix.version);
    assert.equal(optimized.animateCrowd(23,camera),0);
    assert.deepEqual(Object.values(optimized.parts).map(m=>m.instanceMatrix.version),versions);
    // While paused, moving to another street catches its people up to the same
    // frozen clock before rendering. Builders and hand tools catch up too.
    camera.position.set(100,8,130);camera.lookAt(100,2,0);camera.updateMatrixWorld();
    assert(optimized.animateCrowd(23,camera)>0);
    for(const batch of optimized.crowdVisibility.visible(camera,optimized.world.matrixWorld))for(const name of Object.keys(optimized.parts)){
      const start=batch.start*16,end=(batch.start+batch.count)*16;
      assert.deepEqual(optimized.parts[name].instanceMatrix.array.slice(start,end),reference.parts[name].instanceMatrix.array.slice(start,end));
    }
    optimized.animateCrowd(23);
    for(const name of Object.keys(optimized.parts))assert.deepEqual(optimized.parts[name].instanceMatrix.array,reference.parts[name].instanceMatrix.array);
    for(const name of Object.keys(optimized.construction.meshes))assert.deepEqual(optimized.construction.meshes[name].instanceMatrix.array,reference.construction.meshes[name].instanceMatrix.array);
  }finally{optimized.dispose();reference.dispose();}
});

test('chapter bounds contain walkers and builders across their routes, and follow world transforms',()=>{
  const village=createVillage(T,chapters);
  try{
    for(const time of [0,1,5,10,23,60,300])for(const batch of village.crowdVisibility.batches){
      for(let i=batch.start;i<batch.start+batch.count;i++){
        const pose=activityPose(village.members[i],time);
        assert(batch.bounds.distanceToPoint(new T.Vector3(pose.x,pose.ground||0,pose.z))<-2,'Bounds include room for the entire body');
      }
    }
    const camera=cameraAt(),before=village.crowdVisibility.visible(camera,village.world.matrixWorld).map(b=>b.chapter);
    village.world.position.x=500;village.world.updateMatrix();village.world.updateMatrixWorld(true);
    assert.equal(village.crowdVisibility.visible(camera,village.world.matrixWorld).length,0);
    camera.position.x+=500;camera.lookAt(500,2,-50);camera.updateMatrixWorld();
    assert.deepEqual(village.crowdVisibility.visible(camera,village.world.matrixWorld).map(b=>b.chapter),before);
  }finally{village.dispose();}
});
