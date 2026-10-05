import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createDistantCrowd} from '../village-distant-crowd.js';
import {appearance} from '../village-district-layout.js';

const member={...appearance('test',0),chapter:'test',member:0,phase:.7};
const pose={x:1,z:2,rotation:.3,walking:true,gait:1.2,motion:.25};
test('distant legs follow resolved travel and speed, including slowing, pause and backwards seeks',()=>{
  const crowd=createDistantCrowd(T,1000),motion=crowd.mesh.geometry.attributes.motion;
  try{
    const draw=(time,state)=>{crowd.begin(time);crowd.add(member,state);crowd.finish();return [motion.getX(0),motion.getY(0)];};
    const first=draw(10,pose);
    assert(Math.abs(first[0]-pose.gait)<1e-6);assert(Math.abs(first[1]-.48*pose.motion)<1e-6);
    assert.deepEqual(draw(100,pose),first,'camera catch-up uses distance rather than a new shader clock');
    assert.deepEqual(draw(10,pose),first);
    assert.equal(draw(10,{...pose,motion:0})[1],0,'a stopped gait does not march');
    const idle=draw(10,{...pose,walking:false});
    assert(Math.abs(idle[0]-(20+member.phase))<1e-5);assert(Math.abs(idle[1]-.055)<1e-6);
  }finally{crowd.dispose();}
});

test('distant uploads cover visible residents only and retain pending writes until consumed',()=>{
  const crowd=createDistantCrowd(T,1000),mesh=crowd.mesh;
  try{
    crowd.begin(1);crowd.add(member,pose);crowd.add({...member,identity:'second'},pose);crowd.finish();
    assert.equal(mesh.count,2);
    for(const attribute of [mesh.instanceMatrix,mesh.instanceColor,...['skin','pants','hair','poolRole','motion'].map(name=>mesh.geometry.attributes[name])]){
      assert.deepEqual(attribute.updateRanges,[{start:0,count:2*attribute.itemSize}]);
      assert(attribute.updateRanges[0].count<attribute.array.length);
    }
    crowd.begin(2);crowd.add(member,pose);crowd.finish();
    assert.equal(mesh.instanceMatrix.updateRanges.length,2,'unrendered writes are retained');
    mesh.instanceMatrix.clearUpdateRanges();
    const version=mesh.instanceMatrix.version;
    crowd.begin(3);crowd.finish();assert.equal(mesh.count,0);
    assert.equal(mesh.instanceMatrix.version,version);assert.deepEqual(mesh.instanceMatrix.updateRanges,[]);
  }finally{crowd.dispose();}
});
