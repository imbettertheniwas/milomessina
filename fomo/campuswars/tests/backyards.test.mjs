import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createBackyards,BACKYARD,backyardUnlocked,onboardingGoal,backyardStatus} from '../village-backyards.js';
import {createVillage} from '../village-world.js';
import {villageRenderLayout} from '../village-renderer.js';
import {createLots,toWorld} from '../village-layout.js';
const chapter={id:'test-pool',name:'Sigma Chi',letters:'ΣΧ',school:'San Diego State University',shortSchool:'SDSU',active:100,joined:80};

test('every school earns a pool at the rounded 80% goal, not at 15 members',()=>{
  assert.equal(onboardingGoal({...chapter,active:69}),56);
  for(const joined of [0,14,15,79])assert.equal(backyardUnlocked({...chapter,joined}),false);
  for(const name of ['Sigma Chi','Unknown new chapter'])assert.equal(backyardUnlocked({...chapter,name,school:'Any school'}),true);
  assert.equal(backyardUnlocked({...chapter,active:69,joined:55}),false);
  assert.equal(backyardUnlocked({...chapter,active:69,joined:56}),true);
  for(const active of [0,-1,NaN,Infinity,'100'])assert.equal(backyardUnlocked({...chapter,active}),false);
  assert.equal(backyardStatus({...chapter,joined:79}).message,'1 more to unlock your backyard pool.');
});

test('pool appears on a live goal crossing while the house design, terrain and member count survive',()=>{
  const old=createVillage(T,[{...chapter,joined:79}]),before=old.world.getObjectByName(`chapter-house-${chapter.id}`).userData;
  assert.equal(old.backyards.yards.length,0);
  const next=createVillage(T,[chapter],{streets:old.streets,houseFinishes:old.houseFinishes}),after=next.world.getObjectByName(`chapter-house-${chapter.id}`).userData;
  for(const key of ['style','width','height','exterior'])assert.deepEqual(after[key],before[key]);
  assert.equal(after.realHouse,undefined);assert.equal(next.streets,old.streets);
  assert.equal(next.backyards.yards.length,1);assert.equal(next.members.length,80);
  old.dispose();next.animateEffects(12);assert.equal(next.backyards.uniforms.time.value,12);
  next.animateEffects(12);assert.equal(next.backyards.uniforms.time.value,12,'paused activity shares a frozen clock');
  next.nightLife.setNight(true);assert.equal(next.backyards.uniforms.night.value,1);
  next.nightLife.setNight(false);assert.equal(next.backyards.uniforms.night.value,0);
  const disposed=[];for(const asset of [next.backyards.waters[0].geometry,next.backyards.waters[0].material])asset.addEventListener('dispose',()=>disposed.push(asset));
  next.dispose();assert.equal(disposed.length,2);
});

test('rear terraces fit every street, remain separate from neighboring lots, and keep water above terrain',()=>{
  const yards=createBackyards(T),root=new T.Group(),yard=yards.add(root,chapter);
  root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);
  assert(bounds.min.x>=-7.6&&bounds.max.x<=7.6);
  assert(bounds.min.z>=-17.1&&bounds.max.z<5,'side path never reaches the front lawn games');
  assert(bounds.min.y>=0,'continuous world ground cannot cover the pool floor');
  assert.equal(yard.water.position.y,BACKYARD.pool.waterY);
  assert(yard.water.position.y>0&&yard.water.position.y<BACKYARD.deckY);
  const lots=createLots(41);
  for(const lot of lots){
    const back=toWorld(lot,0,-11),front=toWorld(lot,0,10);
    assert(Math.abs(back.x-lot.originX)>Math.abs(lot.x-lot.originX));
    assert(Math.abs(front.x-lot.originX)<Math.abs(lot.x-lot.originX));
    for(const other of lots.filter(o=>o!==lot&&o.street===lot.street&&o.x===lot.x))assert(Math.abs(other.z-lot.z)>bounds.max.x-bounds.min.x);
  }
  assert(yards.contains(chapter.id,0,-10));assert(!yards.contains(chapter.id,0,10));
});

test('small rosters can earn a finished house and pool before the starter milestone',()=>{
  const c={...chapter,active:10,joined:8},village=createVillage(T,[c]),layout=villageRenderLayout(T,[c]);
  assert(village.world.getObjectByName(`chapter-house-${c.id}`));assert.equal(village.backyards.yards.length,1);
  assert(village.members.every(m=>m.action!=='build'));assert.equal(village.members.length,8);
  assert.equal(layout.anchors[0].point.y,village.anchors[0].point.y);village.dispose();
});

test('reordering keeps rewards with chapters and corrections remove ineligible pools',()=>{
  const chapters=[chapter,{...chapter,id:'other',joined:79}];
  const first=createVillage(T,chapters),next=createVillage(T,[{...chapters[1],joined:90},{...chapter,active:101}],{streets:first.streets});
  assert.deepEqual(first.backyards.yards.map(y=>y.chapter),[chapter.id]);assert.deepEqual(next.backyards.yards.map(y=>y.chapter),['other']);
  first.dispose();next.dispose();
});

test('all-qualified row reuses geometry and water shading instead of adding reflections or lights per pool',()=>{
  const village=createVillage(T,Array.from({length:20},(_,i)=>({...chapter,id:`chapter-${i}`,joined:16,active:20})));
  assert.equal(village.backyards.yards.length,20);
  assert.equal(new Set(village.backyards.waters.map(w=>w.material)).size,1);
  assert.equal(new Set(village.backyards.waters.map(w=>w.geometry)).size,1);
  let meshes=0;village.world.traverse(o=>{if(o.isMesh)meshes++;});assert(meshes<300,`${meshes} meshes`);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <normal_fragment_begin>\n#include <color_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>'};
  village.backyards.waters[0].material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.poolTime,village.backyards.uniforms.time);
  assert(shader.fragmentShader.includes('fresnel'));assert(shader.fragmentShader.includes('poolGlow'));
  village.dispose();
});
