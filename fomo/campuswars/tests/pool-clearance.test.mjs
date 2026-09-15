import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createDistricts} from '../village-districts.js';
import {createLots,toWorld,rowExtension,streetCount} from '../village-layout.js';
import {BACKYARD} from '../village-backyards.js';

function meshBounds(root){
  const boxes=[],instance=new T.Matrix4(),matrix=new T.Matrix4();root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(let p=o;p;p=p.parent)if(p.name==='campus-people')return;
    o.geometry.computeBoundingBox();
    for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
      if(o.isInstancedMesh){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);}else matrix.copy(o.matrixWorld);
      boxes.push(o.geometry.boundingBox.clone().applyMatrix4(matrix));
    }
  });return boxes;
}
test('district structures and paths clear every backyard on short, extended and neighboring rows',()=>{
  for(const count of [5,19,41]){
    const districts=createDistricts(T,rowExtension(count),streetCount(count));
    try{
      const boxes=[...districts.chunks.values()].flatMap(c=>meshBounds(c.group));
      for(const lot of createLots(count)){
        const a=toWorld(lot,BACKYARD.minX,BACKYARD.minZ),b=toWorld(lot,BACKYARD.maxX,BACKYARD.maxZ);
        const yard=new T.Box3(new T.Vector3(Math.min(a.x,b.x),0,Math.min(a.z,b.z)),new T.Vector3(Math.max(a.x,b.x),10,Math.max(a.z,b.z)));
        const overlaps=boxes.filter(b=>b.intersectsBox(yard));
        assert.equal(overlaps.length,0,`${count} chapters, lot ${lot.x},${lot.z}: ${JSON.stringify(overlaps.slice(0,3))}`);
      }
    }finally{districts.dispose();}
  }
});
