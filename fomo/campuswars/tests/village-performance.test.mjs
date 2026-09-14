import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createDistricts} from '../village-districts.js';

function cameraAt(x=0,y=8,z=38,lookX=0,lookZ=0){
  const camera=new T.PerspectiveCamera(48,16/9,1,650);
  camera.position.set(x,y,z);camera.lookAt(lookX,2,lookZ);camera.updateMatrixWorld();return camera;
}
function movingMeshes(chunk){
  const meshes=[];chunk.group.traverse(o=>{if(o.isInstancedMesh&&o.instanceMatrix.usage===T.DynamicDrawUsage)meshes.push(o);});return meshes;
}
test('offscreen crowd work is skipped without changing any visible poses or population',()=>{
  const optimized=createDistricts(T),reference=createDistricts(T),camera=cameraAt();
  try{
    const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    reference.animate(23);optimized.animate(23,0,0,camera);
    let skipped=0,visible=0;
    for(const [key,chunk] of optimized.chunks){
      const expected=reference.chunks.get(key),actualMeshes=movingMeshes(chunk),expectedMeshes=movingMeshes(expected);
      assert.deepEqual(chunk.people,expected.people);
      assert.equal(actualMeshes.length,expectedMeshes.length);
      if(frustum.intersectsSphere(chunk.activityBounds)){
        visible++;
        actualMeshes.forEach((mesh,i)=>assert.deepEqual(mesh.instanceMatrix.array,expectedMeshes[i].instanceMatrix.array));
      }else{
        skipped++;
        assert(actualMeshes.every(mesh=>mesh.instanceMatrix.version===1),'Invisible batches keep their initial upload');
      }
    }
    assert(skipped>0);assert(visible>0);assert.equal(optimized.chunks.size,9);
    // Turn to the opposite end without advancing the clock (paused activity).
    camera.lookAt(0,2,200);camera.updateMatrixWorld();optimized.animate(23,0,0,camera);
    frustum.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const [key,chunk] of optimized.chunks)if(frustum.intersectsSphere(chunk.activityBounds)){
      const expected=movingMeshes(reference.chunks.get(key));
      movingMeshes(chunk).forEach((mesh,i)=>assert.deepEqual(mesh.instanceMatrix.array,expected[i].instanceMatrix.array));
    }
    const versions=[...optimized.chunks.values()].flatMap(chunk=>movingMeshes(chunk).map(mesh=>mesh.instanceMatrix.version));
    optimized.animate(23,0,0,camera);
    assert.deepEqual([...optimized.chunks.values()].flatMap(chunk=>movingMeshes(chunk).map(mesh=>mesh.instanceMatrix.version)),versions,'Paused camera redraws do not re-upload unchanged crowd matrices');
  }finally{optimized.dispose();reference.dispose();}
});

test('visibility bounds follow streamed blocks and chapter-row extensions',()=>{
  const districts=createDistricts(T,76);
  try{
    for(const [x,z] of [[0,0],[500,500],[-900,300]]){
      districts.update(x,z);
      for(const chunk of districts.chunks.values()){
        for(const mesh of movingMeshes(chunk)){
          const expected=mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
          assert(chunk.activityBounds.center.distanceTo(expected.center)<1e-8);
          assert(chunk.activityBounds.radius>=expected.radius);
        }
      }
      districts.animate(10,x,z,cameraAt(x,8,z+38,x,z));
    }
  }finally{districts.dispose();}
});

test('mobile district streaming builds one block at a time and abandons obsolete destinations',()=>{
  const districts=createDistricts(T,0,1,{incremental:true});
  try{
    assert.equal(districts.chunks.size,1);assert(districts.chunks.has('0,0'));assert(districts.building);
    for(let i=2;i<=9;i++){districts.update(0,0);assert.equal(districts.chunks.size,i);}
    assert.equal(districts.building,false);assert.equal(districts.update(0,0),false);
    const resident=[...districts.chunks.values()];
    districts.update(500,500);assert(!districts.building);assert(!districts.chunks.has('5,5'));
    districts.update(-500,-500);assert(!districts.building);assert(!districts.chunks.has('-5,-5'));
    assert.equal(districts.chunks.size,9);
    assert.deepEqual([...districts.chunks.values()],resident,'Leaving the campus does not rebuild its scenery');
  }finally{districts.dispose();}
});
