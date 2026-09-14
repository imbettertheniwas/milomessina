import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {campusBounds,campusDistrictExists,clampCampusTarget} from '../village-campus-bounds.js';
import {createStreetNetwork,setStreetExtension} from '../village-streets.js';
import {createLots,streetCount,rowExtension} from '../village-layout.js';
import {createDistricts} from '../village-districts.js';

test('campus boundaries retain every house and the stadium, and expand with the roster',()=>{
  for(const count of [0,5,19,20,45,1000]){
    const streets=streetCount(count),extension=rowExtension(count),bounds=campusBounds(streets,extension);
    for(const lot of createLots(count)){
      assert(lot.x-20>bounds.minX&&lot.x+20<bounds.maxX);
      assert(lot.z-20>bounds.minZ&&lot.z+20<bounds.maxZ);
      assert(campusDistrictExists(lot.originX/100,0,streets));
    }
    assert(campusDistrictExists(0,2,streets));
    assert(!campusDistrictExists(bounds.maxColumn+1,0,streets));
    assert(!campusDistrictExists(0,-2,streets));
    const target=clampCampusTarget(new T.Vector3(1e6,4,-1e6),streets,extension);
    assert.equal(target.x,bounds.maxX);assert.equal(target.z,bounds.minZ);assert.equal(target.y,4);
  }
});
test('the compact floor keeps roads aligned with world coordinates and extended intersections',()=>{
  const floor=createStreetNetwork(T),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  try{
    for(const extension of [0,76,133]){
      setStreetExtension(T,floor,extension,3);floor.updateMatrixWorld(true);
      for(const [x,z,sourceZ] of [[0,0,0],[-100,-50,-50],[100,150+extension,150],[0,200+extension,200]]){
        ray.set(new T.Vector3(x,10,z),down);const hit=ray.intersectObject(floor)[0];assert(hit);
        assert(Math.abs(hit.uv.x-(x/300+.5))<1e-5,'Roads must not shift a block sideways');
        assert(Math.abs(hit.uv.y-(.5-sourceZ/300))<1e-5,'Road junctions must move with the row');
      }
      floor.geometry.computeBoundingBox();const size=floor.geometry.boundingBox.getSize(new T.Vector3());
      assert(size.x*size.y<20000*20000*.03,'The background floor no longer spans an unused 20,000-unit world');
      assert.deepEqual(floor.material.userData.campusBounds.toArray(),[-248,248,-148,248+extension]);
    }
  }finally{floor.geometry.dispose();floor.material.dispose();}
});
test('the small campus retains its scenery without generating duplicate districts outside it',()=>{
  const districts=createDistricts(T),initial=new Map(districts.chunks),horizon=districts.horizon;
  try{
    for(const [x,z] of [[100,0],[-100,0],[0,100],[0,200],[500,500],[-900,300],[0,0]]){
      districts.update(x,z);
      for(const [id,chunk] of initial)assert.equal(districts.chunks.get(id),chunk,'Existing campus buildings must not pop out at intersections');
      assert(districts.chunks.size<=10);assert.equal(districts.horizon,horizon);
    }
    assert(districts.chunks.has('0,2'));assert(districts.stadium.root.parent);
  }finally{districts.dispose();}
});
