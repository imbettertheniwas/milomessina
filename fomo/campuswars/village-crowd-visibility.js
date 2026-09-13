// Chapter members occupy contiguous instance slots. Cull whole lawns before
// calculating poses, while retaining every member and their absolute-time motion.
export function createCrowdVisibility(T,members){
  const batches=[];
  for(let i=0;i<members.length;i++){
    const member=members[i];let batch=batches.at(-1);
    if(!batch||batch.chapter!==member.chapter){
      batch={chapter:member.chapter,start:i,count:0,time:NaN,bounds:new T.Sphere(new T.Vector3(member.lot.x,4,member.lot.z),24)};
      batches.push(batch);
    }
    batch.count++;
  }
  const frustum=new T.Frustum(),projection=new T.Matrix4(),worldBounds=new T.Sphere();
  function visible(camera,matrixWorld){
    if(camera)frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    return batches.filter(batch=>!camera||frustum.intersectsSphere(worldBounds.copy(batch.bounds).applyMatrix4(matrixWorld)));
  }
  return {batches,visible};
}
