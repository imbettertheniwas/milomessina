import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {createVillageRendererAsync,createVillageRenderer,villageRenderLayout,visibleHouseIndices} from '../village-renderer.js';
import {assignHouseFinishes} from '../village-house-colors.js';
import {createPointerHover,releasedMouseDrag} from '../village-pointer-hover.js';

const rows=Array.from({length:1000},(_,i)=>({id:`scale-${String(i).padStart(4,'0')}`,name:'Alpha Beta',letters:'ΑΒ',school:'University of Tampa',shortSchool:'Tampa',joined:20,active:100}));
function cameraAt(x=0,z=38,lookZ=-50){const c=new T.PerspectiveCamera(48,16/9,1,650);c.position.set(x,8,z);c.lookAt(x,2,lookZ);c.updateMatrixWorld();return c;}
test('1,000 addresses retain unique finishes and full metadata while only the current view is resident',()=>{
  const camera=cameraAt(),v=createVillageRenderer(T,rows,{camera});
  try{
    assert.equal(v.anchors.length,1001);assert.equal(v.lots.length,1001);assert.equal(v.streetTotal,51);
    assert(v.residentCount<100);assert(v.members.length<2000);
    assert.equal(new Set([...v.houseFinishes.values()].map(f=>f.color)).size,1000);
    const total=v.members.length,updated=v.animateCrowd(23,camera);assert(updated<total);assert.equal(v.parts.torso.count,updated);
    const wide=new T.PerspectiveCamera(48,16/9,1,650);wide.position.set(0,280,360);wide.lookAt(0,2,0);wide.updateMatrixWorld();v.animateCrowd(23,wide);
    const visible=v.crowdVisibility.visible(wide,v.world.matrixWorld).reduce((sum,b)=>sum+b.count,0);
    assert.equal(v.parts.torso.count+v.distantCrowd.mesh.count,visible,'LOD keeps every visible member');
    assert(v.distantCrowd.mesh.count>0);assert(v.distantCrowd.mesh.geometry.attributes.position.count/3<400);
    assert(v.distantCrowd.mesh.instanceMatrix.array.every(Number.isFinite));
    v.animateCrowd(23,camera);assert.equal(v.parts.torso.count,updated,'Zooming back restores detailed people even while paused');
    const road=v.streets,originalIndices=v.residentIndices;let focused=false;
    v.nightLife.setNight(true);const destination=v.anchors[990];v.focus(destination.id,()=>focused=true);
    let steps=0;while(v.building){v.advance(Infinity);assert(++steps<5);}
    assert(focused);assert(v.renderAnchors.some(a=>a.id===destination.id));assert.equal(v.streets,road);assert.equal(road.parent,v.world);
    assert(v.residentCount<100);assert([...originalIndices].some(i=>!v.residentIndices.has(i)));
    assert(v.world.getObjectByName(`chapter-house-${destination.id}`));
    const globeLights=[];v.world.traverse(o=>{if(o.isLight)globeLights.push(o);});assert(globeLights.length>=4);
    v.animateCrowd(23,cameraAt(destination.lot.originX,destination.lot.z+20,destination.lot.z));
    for(const mesh of Object.values(v.parts))assert(mesh.instanceMatrix.array.every(Number.isFinite));
  }finally{v.dispose();}
});
test('packing visible members preserves the exact full-detail poses and clothing colors',()=>{
  const input=rows.slice(0,8),layout=villageRenderLayout(T,input),indices=new Set(layout.lots.map((_,i)=>i));
  const reference=createVillage(T,input,{layout,indices}),packed=createVillage(T,input,{layout,indices,compactCrowd:true}),camera=cameraAt();
  try{
    reference.animateCrowd(23);packed.animateCrowd(23,camera);let offset=0;
    for(const batch of packed.crowdVisibility.visible(camera,packed.world.matrixWorld)){
      for(const [name,mesh] of Object.entries(packed.parts)){
        const original=reference.parts[name],stride=original.instanceMatrix.count/reference.members.length;
        assert.deepEqual(mesh.instanceMatrix.array.slice(offset*stride*16,(offset+batch.count)*stride*16),original.instanceMatrix.array.slice(batch.start*stride*16,(batch.start+batch.count)*stride*16));
        assert.deepEqual(mesh.instanceColor.array.slice(offset*stride*3,(offset+batch.count)*stride*3),original.instanceColor.array.slice(batch.start*stride*3,(batch.start+batch.count)*stride*3));
      }
      offset+=batch.count;
    }
    const version=packed.parts.torso.instanceMatrix.version;packed.animateCrowd(23,camera);assert.equal(packed.parts.torso.instanceMatrix.version,version);
    camera.lookAt(0,2,200);camera.updateMatrixWorld();packed.animateCrowd(23,camera);assert(packed.parts.torso.instanceMatrix.version>version);
  }finally{reference.dispose();packed.dispose();}
});
test('house finish cursor optimization reproduces existing colors and preserves saved assignments',()=>{
  const first=assignHouseFinishes(rows.slice(0,100)),grown=assignHouseFinishes(rows,first);
  for(const [id,finish] of first)assert.deepEqual(grown.get(id),finish);
  assert.deepEqual(grown,assignHouseFinishes(rows));
});
test('road hover coalesces a high-polling pointer burst and does no model hit-testing over pavement',()=>{
  let queued,scheduled=0,casts=0,writes=0;
  class Raycaster extends T.Raycaster{intersectObjects(){casts++;return [];}}
  const style={set cursor(value){writes++;}},canvas={style,set title(value){writes++;},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})};
  const root=new T.Group();root.position.set(0,40,0);root.updateMatrixWorld();
  const hover=createPointerHover({...T,Raycaster},canvas,cameraAt(),{root,pickables:[]},{schedule:fn=>{queued=fn;return ++scheduled;},cancel:()=>{queued=null;}});
  for(let i=0;i<1000;i++)hover.move({clientX:500+i/1000,clientY:799});
  assert.equal(scheduled,1);queued();assert.equal(casts,0);assert.equal(writes,0);
  assert(releasedMouseDrag({pointerType:'mouse',buttons:0}));assert(!releasedMouseDrag({pointerType:'mouse',buttons:1}));assert(!releasedMouseDrag({pointerType:'touch',buttons:0}));hover.clear();
});
test('the same view loads the same houses regardless of the total addresses beyond the camera',()=>{
  const camera=cameraAt(),small=villageRenderLayout(T,rows.slice(0,200)),large=villageRenderLayout(T,rows);
  const ids=(layout)=>[...visibleHouseIndices(T,layout,camera)].filter(i=>i<layout.chapters.length).map(i=>layout.chapters[i].id).sort();
  assert.deepEqual(ids(small),ids(large));
});

 test('asynchronous startup keeps terrain attached when a large village streams to a new block',async()=>{
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>setImmediate(callback);
  let village;
  try{
    village=await createVillageRendererAsync(T,rows.slice(0,100),{camera:cameraAt(),attachStreet:true});
    assert.equal(village.streets.parent,village.world);
    const destination=village.anchors[95];let focused=false;
    village.focus(destination.id,()=>focused=true);
    while(village.building)village.advance(Infinity);
    assert(focused);assert.equal(village.streets.parent,village.world);
    assert(village.renderAnchors.some(anchor=>anchor.id===destination.id));
  }finally{village?.dispose();if(previous)globalThis.requestAnimationFrame=previous;else delete globalThis.requestAnimationFrame;}
 });
