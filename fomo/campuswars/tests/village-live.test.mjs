import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {createLots,rowExtension,streetCount,streetOriginX,activityPose} from '../village-layout.js';
import {districtKind,districtSpecs} from '../village-district-layout.js';
import {createDistricts} from '../village-districts.js';
const chapters = count => Array.from({length:count},(_,i)=>({id:`test-${i}`,name:'Alpha Beta',letters:'ΑΒ',school:`School ${i}`,shortSchool:`School ${i}`,joined:i%2?15:1,active:100}));

test('the row adds a selectable lot for every chapter and retains one claim lot',()=>{
  const village=createVillage(THREE,chapters(14));
  assert.equal(village.anchors.length,15);assert.equal(village.anchors.filter(a=>a.id==='empty').length,1);assert.equal(village.extension,95);
  assert.deepEqual(createLots(5).map(({x,z})=>[x,z]),[[-20,-19],[20,-19],[-20,0],[20,0],[-20,19],[20,19]]);
  assert.equal(new Set(village.anchors.map(a=>`${a.lot.x},${a.lot.z}`)).size,15);
  village.world.updateMatrixWorld(true);
  for(const anchor of village.anchors){const ray=new THREE.Raycaster(new THREE.Vector3(anchor.lot.x,40,anchor.lot.z),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObjects(village.pickables)[0]?.object.userData.chapter,anchor.id);}
  for(const mesh of Object.values(village.parts))assert([...mesh.instanceMatrix.array].every(Number.isFinite));
  assert.equal(village.members.length,112);assert(village.competition.board.position.z>village.anchors.at(-1).lot.z+15);village.dispose();
});
test('a street takes ten houses down each side, then the village opens the next one',()=>{
  const plots=count=>{const streets=new Map();for(const lot of createLots(count))streets.set(lot.street,(streets.get(lot.street)||0)+1);return [...streets.values()];};
  const sides=count=>{const lots=createLots(count).filter(lot=>lot.street===0);return [lots.filter(l=>l.x<l.originX).length,lots.filter(l=>l.x>l.originX).length];};
  assert.deepEqual(plots(19),[20]);         // ten a side, and the claim lot fills the twentieth
  assert.deepEqual(sides(19),[10,10]);
  assert.deepEqual(plots(20),[21]);         // the claim lot trails a full street
  assert.deepEqual(plots(21),[21,1]);       // and holds that spot once the next street opens
  assert.deepEqual(plots(45),[21,20,5]);
  assert.equal(streetCount(45),3);
  // Whatever the roster, the claim lot closes the main street rather than moving off it.
  for(const count of [0,1,5,17,20,21,45,120]){
    const lots=createLots(count),claim=lots.at(-1),main=lots.slice(0,count).filter(lot=>lot.street===0);
    assert.equal(claim.street,0,'the claim lot stays on the boulevard');
    assert(main.every(house=>house.z<=claim.z),'no house stands past the claim lot');
    assert(!main.some(house=>house.x===claim.x&&house.z===claim.z),'and nothing shares its plot');
  }
  // Streets stand on the campus road grid, opening east then west of the original.
  assert.deepEqual([0,1,2,3].map(streetOriginX),[0,100,-100,200]);
  for(const lot of createLots(45)){assert.equal(Math.abs(lot.x-lot.originX),20);assert(lot.z>=-19&&lot.z<=171);}
  // Every street shares one length, so the world stops growing with the row.
  for(const count of [21,45,120,400])assert(rowExtension(count)<=152);
  // The row as it stands today is one street and keeps its own length.
  assert.equal(streetCount(17),1);assert.equal(rowExtension(17),114);
  // A street's own block carries houses instead of campus buildings.
  assert.equal(districtKind(1,0,1),'science');
  assert.equal(districtKind(1,0,2),'greek');
  assert.deepEqual(districtSpecs(1,0,2),[]);
  assert.equal(districtKind(1,1,3),'residential','only the row itself turns Greek');
});

test('houses on a second street stand clear of the campus and keep their own frontage',()=>{
  const village=createVillage(THREE,chapters(25));
  assert.equal(village.streetTotal,2);
  const second=village.anchors.filter(a=>a.lot.street===1);
  assert.equal(second.length,5,'five houses, with the claimable lot left on the main street');
  assert.equal(village.anchors.find(a=>a.id==='empty').lot.street,0);
  for(const anchor of second){
    assert.equal(anchor.lot.originX,100);
    assert(village.world.getObjectByName(`chapter-house-${anchor.id}`)||village.world.getObjectByName(`chapter-construction-${anchor.id}`)||anchor.id==='empty');
  }
  // Lamps, benches and trees follow each street rather than only the first.
  const meshes=[];village.world.updateMatrixWorld(true);
  village.world.traverse(o=>{if(o.isMesh)meshes.push(o.getWorldPosition(new THREE.Vector3()));});
  assert(meshes.some(p=>Math.abs(p.x-107.6)<.01),'the second street is lit too');
  village.dispose();
});

test('new members complete a new chapter house while shared terrain survives scene replacement',()=>{
  const input=chapters(7),old=createVillage(THREE,input),street=old.streets;let disposed=false;street.geometry.addEventListener('dispose',()=>disposed=true);
  assert(old.world.getObjectByName('chapter-construction-test-6'));
  input[6].joined=15;const next=createVillage(THREE,input,{streets:street});old.dispose();
  assert.equal(next.streets,street);assert.equal(disposed,false);assert(next.world.getObjectByName('chapter-house-test-6'));
  assert.equal(next.members.filter(m=>m.chapter==='test-6').length,15);next.dispose();
});
test('long-row crowds remain inside their rendering bounds and scenery clears the end of the row',()=>{
  const village=createVillage(THREE,chapters(20)),districts=createDistricts(THREE,village.extension,village.streetTotal);
  for(const m of village.members){const p=activityPose(m,5);for(const part of Object.values(village.parts))assert(part.boundingSphere.containsPoint(new THREE.Vector3(p.x,1.5,p.z)));}
  assert.equal(districts.chunks.get('0,1').group.position.z,100+village.extension);
  assert(districts.traffic.loops[0].sample(200).z<=50+village.extension);
  districts.update(0,village.anchors.at(-1).lot.z);assert.equal(districts.chunks.size,9);districts.dispose();village.dispose();
});
test('street geometry inserts continuous sections without overlapping floors',()=>{
  const village=createVillage(THREE,chapters(6)),g=village.streets.geometry;
  assert.equal(rowExtension(6),19);assert.equal(village.streets.userData.extension,19);
  assert([...g.attributes.position.array,...g.attributes.uv.array].every(Number.isFinite));
  const z=[...g.attributes.position.array].filter((_,i)=>i%3===1).map(y=>-y);assert(z.includes(30)&&z.includes(49));
  for(let i=0;i<g.attributes.normal.count;i++)assert(g.attributes.normal.getZ(i)>.99);
  village.dispose();
});

test('rising chapters move toward the leaders with their crowds, banners and stable architecture',()=>{
  const input=chapters(8).map((c,i)=>({...c,joined:15+i,active:100}));
  const old=createVillage(THREE,input),oldAnchor=old.anchors.find(a=>a.id==='test-0');
  assert.equal(oldAnchor.lot.z,38);
  const promoted=input.map(c=>c.id==='test-0'?{...c,joined:90}:c);
  const next=createVillage(THREE,promoted,{streets:old.streets}),anchor=next.anchors.find(a=>a.id==='test-0');
  assert.deepEqual([anchor.lot.x,anchor.lot.z],[-20,-19]);
  assert.equal(next.competition.leaderId,'test-0');
  assert(next.members.filter(m=>m.chapter==='test-0').every(m=>m.lot===anchor.lot));
  next.world.updateMatrixWorld(true);
  const banner=next.world.getObjectByName('chapter-banner-test-0');
  assert(Math.abs(banner.getWorldPosition(new THREE.Vector3()).z-anchor.lot.z)<10);
  assert.deepEqual(next.anchors.map(a=>a.id),['test-0','test-7','test-6','test-5','test-4','test-3','test-2','test-1','empty']);
  const reordered=createVillage(THREE,[...promoted].reverse());
  assert.deepEqual(reordered.anchors.map(a=>[a.id,a.lot.x,a.lot.z]),next.anchors.map(a=>[a.id,a.lot.x,a.lot.z]));
  old.dispose();next.dispose();reordered.dispose();
});
