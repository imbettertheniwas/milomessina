import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createHelipad,helipadState,HELIPAD_CYCLE,HELIPAD_SITE} from '../village-helipad.js';
import {campusBounds} from '../village-campus-bounds.js';

test('guests arrive, stand together, board before rotor startup, and return to the Maybach',()=>{
  const arrival=helipadState(0),parked=helipadState(9),outside=helipadState(27),boarded=helipadState(44),flight=helipadState(56),returned=helipadState(78);
  assert.equal(arrival.carZ,45);assert.equal(parked.carZ,10);
  assert(arrival.guests.every(g=>!g.visible));assert(outside.guests.every(g=>g.visible&&g.standing));
  assert.equal(outside.rotor,0);assert.equal(outside.helicopter.y,0);
  assert(boarded.guests.every(g=>!g.visible));assert.equal(boarded.cabin,0);
  assert.equal(flight.helicopter.y,36);assert(returned.guests.every(g=>g.visible));
  for(let t=0;t<HELIPAD_CYCLE;t+=.025){const s=helipadState(t);if(s.rotor>0)assert(s.guests.every(g=>!g.visible),'Guests board before rotors turn, and exit after rotors stop');}
});

test('visible walking and helicopter flight remain continuous across every phase',()=>{
  for(let t=0;t<HELIPAD_CYCLE-.002;t+=.017){const a=helipadState(t),b=helipadState(t+.001);
    for(let i=0;i<2;i++)if(a.guests[i].visible&&b.guests[i].visible){const p=a.guests[i],q=b.guests[i];assert(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<.03,`Guest discontinuity at ${t}`);}
    assert(Math.hypot(a.helicopter.x-b.helicopter.x,a.helicopter.y-b.helicopter.y,a.helicopter.z-b.helicopter.z)<.04);
    assert(Object.values(a.helicopter).every(Number.isFinite));
  }
  assert.deepEqual(helipadState(27),helipadState(27+HELIPAD_CYCLE));
});

test('pause, replay, reduced motion and live roster relocation preserve the sequence',()=>{
  const h=createHelipad(T);
  try{
    h.restart(400);h.update(427);assert(h.guests.every(g=>g.root.visible));
    const matrices=[];h.root.updateMatrixWorld(true);h.root.traverse(o=>matrices.push(o.matrixWorld.toArray()));
    h.update(427);const again=[];h.root.updateMatrixWorld(true);h.root.traverse(o=>again.push(o.matrixWorld.toArray()));assert.deepEqual(again,matrices);
    h.relocate(133);assert.equal(h.root.position.z,333);assert.equal(h.state.time,27);
    h.restart(500,true);assert(h.state.guests.every(g=>g.standing));h.update(500);assert.equal(h.state.time,27);
    h.restart(800);assert.equal(h.state.time,0);
  }finally{h.dispose();}
});

test('helipad is clear of the stadium, inside campus bounds and has a bounded resource cost',()=>{
  const bounds=campusBounds(),h=createHelipad(T);
  try{
    assert(HELIPAD_SITE.x-HELIPAD_SITE.radius>41);assert(HELIPAD_SITE.x+HELIPAD_SITE.radius<bounds.maxX);assert(HELIPAD_SITE.z+HELIPAD_SITE.radius<bounds.maxZ);
    let meshes=0,triangles=0;h.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert([...o.geometry.attributes.position.array].every(Number.isFinite));}});
    assert(meshes<140);assert(triangles<130000);assert.deepEqual(h.guests.map(g=>g.root.name),['Rasmr','Orangie']);
    const resource=[...h.resources][0];let disposed=false;resource.addEventListener('dispose',()=>disposed=true);h.dispose();assert(disposed);assert.equal(h.resources.size,0);
  }finally{h.dispose();}
});
