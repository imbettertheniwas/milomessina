import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {rankedHouseSizes} from '../village-house-sizing.js';
import {createVillage} from '../village-world.js';
const chapters=[
  {id:'sigma-chi-sdsu',name:'Sigma Chi',letters:'ΣΧ',school:'San Diego State University',shortSchool:'SDSU',joined:20,active:20},
  {id:'kappa-sigma-coastal',name:'Kappa Sigma',letters:'ΚΣ',school:'Coastal Carolina University',shortSchool:'Coastal',joined:90,active:100},
  {id:'tau-kappa-epsilon-tampa',name:'Tau Kappa Epsilon',letters:'ΤΚΕ',school:'University of Tampa',shortSchool:'Tampa',joined:200,active:400}
];
test('rank determines width, roof height and depth even when lower ranks have more members',()=>{
  const village=createVillage(T,chapters),houses=chapters.map(c=>village.world.getObjectByName(`chapter-house-${c.id}`));
  for(const key of ['footprint','roofline','depthScale']){
    assert(houses[0].userData[key]>houses[1].userData[key]);assert(houses[1].userData[key]>houses[2].userData[key]);
  }
  for(const house of houses){
    const size=house.userData;
    assert(size.footprint<=13.6);assert(size.roofline<=15);assert(size.depthScale<=1);
    assert(Math.abs((size.width+1)*house.scale.x-size.footprint)<1e-9);
    assert(Math.abs((size.height+2.82)*house.scale.y-size.roofline)<1e-9);
    const porch=village.members.filter(m=>m.chapter===size.chapter&&!m.poolRole&&m.action!=='pong'&&!m.walking&&m.ground>.3);
    assert.equal(porch.length,2);assert(porch.every(m=>Math.abs(m.ground-.73*size.scaleY)<1e-9));
  }
  village.dispose();
});
test('live promotions exchange the size hierarchy while preserving colors and exact member counts',()=>{
  const before=createVillage(T,chapters),changed=chapters.map(c=>c.id===chapters[0].id?{...c,active:50}:c);
  const next=createVillage(T,changed,{streets:before.streets,houseFinishes:before.houseFinishes});
  assert.equal(next.competition.leaderId,chapters[1].id);
  const leader=next.world.getObjectByName(`chapter-house-${chapters[1].id}`),former=next.world.getObjectByName(`chapter-house-${chapters[0].id}`);
  assert.equal(leader.userData.rank,1);assert.equal(former.userData.rank,3);assert(leader.userData.footprint>former.userData.footprint);
  for(const c of chapters){assert.equal(next.members.filter(m=>m.chapter===c.id).length,c.joined);assert.deepEqual(next.houseFinishes.get(c.id),before.houseFinishes.get(c.id));}
  before.dispose();next.dispose();
});
test('equal displayed ranks have equal sizes and source ordering does not change sizing',()=>{
  const tied=chapters.map(c=>c.id===chapters[0].id?{...c,joined:90,active:100}:c),sizes=rankedHouseSizes(tied),reordered=rankedHouseSizes([...tied].reverse());
  for(const c of tied)assert.deepEqual(sizes.get(c.id),reordered.get(c.id));
  for(const key of ['rank','footprint','roofline','depthScale'])assert.equal(sizes.get(tied[0].id)[key],sizes.get(tied[1].id)[key]);
});
