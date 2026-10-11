import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createHelipad,helipadState,HELIPAD_CYCLE,HELIPAD_SITE} from '../village-helipad.js';
import {campusBounds} from '../village-campus-bounds.js';

test('guests arrive, stand together, board before rotor startup, and return to the Maybach',()=>{
  const arrival=helipadState(0),parked=helipadState(9),outside=helipadState(45),boarded=helipadState(62),flight=helipadState(74),returned=helipadState(96);
  assert.equal(arrival.carZ,45);assert.equal(parked.carZ,-.55);
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
  assert.deepEqual(helipadState(45),helipadState(45+HELIPAD_CYCLE));
});

test('pause, replay, reduced motion and live roster relocation preserve the sequence',()=>{
  const h=createHelipad(T);
  try{
    h.restart(400);h.update(445);assert(h.guests.every(g=>g.root.visible));
    const matrices=[];h.root.updateMatrixWorld(true);h.root.traverse(o=>matrices.push(o.matrixWorld.toArray()));
    h.update(445);const again=[];h.root.updateMatrixWorld(true);h.root.traverse(o=>again.push(o.matrixWorld.toArray()));assert.deepEqual(again,matrices);
    h.relocate(133);assert.equal(h.root.position.z,HELIPAD_SITE.z);assert.equal(h.state.time,45);
    h.restart(500,true);assert(h.state.guests.every(g=>g.standing));h.update(500);assert.equal(h.state.time,45);
    h.restart(800);assert.equal(h.state.time,0);
  }finally{h.dispose();}
});

test('helipad is clear of the stadium, inside campus bounds and has a bounded resource cost',()=>{
  const bounds=campusBounds(),h=createHelipad(T);
  try{
    assert(HELIPAD_SITE.x-HELIPAD_SITE.radius*HELIPAD_SITE.scale>-91);assert(HELIPAD_SITE.x+HELIPAD_SITE.radius*HELIPAD_SITE.scale<-41);assert(HELIPAD_SITE.z+HELIPAD_SITE.radius<bounds.maxZ);
    let meshes=0,triangles=0;h.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert([...o.geometry.attributes.position.array].every(Number.isFinite));}});
    assert(meshes<143);assert(triangles<130000);assert.deepEqual(h.guests.map(g=>g.root.name),['Rasmr','Orangie']);
    const resource=[...h.resources][0];let disposed=false;resource.addEventListener('dispose',()=>disposed=true);h.dispose();assert(disposed);assert.equal(h.resources.size,0);
  }finally{h.dispose();}
});

test('portrait surfaces remain independent of the modeled hair and glasses after batching',()=>{
  const h=createHelipad(T);
  try{
    for(const guest of h.guests){
      assert(guest.portraitSurface.parent,'atlas can update the rendered face after loading');
      assert.equal(guest.portraitSurface.visible,false,'modeled fallback is available before the texture loads');
      guest.faceDetails.visible=false;
      assert(guest.head.children.some(child=>child.isMesh&&child.visible),'hair and head anatomy remain visible');
      assert.equal(guest.knees.length,2);assert.equal(guest.forearms.length,2);
    }
    h.root.traverse(o=>{if(o.isMesh&&o.material.vertexColors){assert(o.geometry.attributes.color);assert.equal(o.geometry.attributes.color.count,o.geometry.attributes.position.count);}});
  }finally{h.dispose();}
});

test('passenger doors swing away from the cabin and knees articulate without breaking pause',()=>{
  const h=createHelipad(T);
  try{
    h.update(30);
    for(const door of h.doors){
      if(door.side<0&&!door.isFront){const edge=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),door.root.rotation.y);assert(edge.x<-.5,'pad-side door opens outward');}
      else assert.equal(door.root.rotation.y,0);
    }
    h.update(38);assert(h.guests.some(guest=>guest.knees.some(knee=>knee.rotation.x>.01)));
    h.update(45);assert(h.guests.every(guest=>guest.knees.every(knee=>knee.rotation.x===0)));
  }finally{h.dispose();}
});

test('Maybach wheels stay inside the body and polished paint retains local reflections',()=>{
  const h=createHelipad(T);
  try{
    h.root.position.set(0,0,0);h.car.position.set(0,0,0);h.car.rotation.set(0,0,0);h.root.updateMatrixWorld(true);
    const wheels=[],paints=[];h.car.traverse(o=>{
      if(o.name==='Maybach wheel')wheels.push(o);
      if(o.isMesh&&o.material.clearcoat===1)paints.push(o.material);
    });
    assert.equal(wheels.length,4);
    for(const wheel of wheels){const bounds=new T.Box3().setFromObject(wheel,true);assert(bounds.min.x>=-1.09&&bounds.max.x<=1.09);assert(Math.abs(bounds.max.y-bounds.min.y-.78*HELIPAD_SITE.scale)<.002);}
    assert(paints.length>0);assert(paints.every(material=>material.envMap&&material.envMap.isTexture));
  }finally{h.dispose();}
});

test('Maybach arrives and leaves on the main road and passengers exit toward the helipad',()=>{
  const h=createHelipad(T);
  try{
    for(const t of [1,5,9,27,89,94]){
      const state=h.update(t);h.root.updateMatrixWorld(true);
      const car=h.car.getWorldPosition(new T.Vector3());assert(Math.abs(car.x+97.5)<1e-8);
      assert(state.carX<state.guests[0].x||!state.guests[0].visible);
    }
    const apron=new T.Box3().setFromObject(h.root.getObjectByName('helipad-apron'));
    assert(apron.min.x>=-91.3,'only the footpath and narrow carpet reach the sidewalk');
    assert(apron.max.z<HELIPAD_SITE.z+20,'no driveway crosses the adjacent road');
  }finally{h.dispose();}
});

test('red carpet faces upward and ends at the helicopter cabin',()=>{
 const h=createHelipad(T);try{const carpet=h.root.getObjectByName('helipad-red-carpet');assert(carpet);let strips=0;carpet.traverse(o=>{if(o.isMesh&&o.material.color.getHex()===0xb51e35){strips++;const normals=o.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert(normals.getY(i)>.99);}});assert.equal(strips,1);}finally{h.dispose();}
});

test('chauffeur unrolls one straight carpet before passengers leave the car',()=>{
 const early=helipadState(12),rolling=helipadState(20),ready=helipadState(26),walking=helipadState(38);assert(early.driver.visible);assert.equal(early.carpetProgress,0);assert(rolling.driver.rolling&&rolling.carpetProgress>0&&rolling.carpetProgress<1);assert(rolling.guests.every(g=>!g.visible));assert.equal(ready.carpetProgress,1);assert(ready.guests.every(g=>!g.visible));assert(walking.guests.some(g=>g.visible));
 const a=helipadState(14).carpetTip,b=helipadState(25).carpetTip;for(let t=14;t<=25;t+=.1){const p=helipadState(t).carpetTip;assert.equal(p.z,.3,'carpet stays perpendicular to the north–south road');assert(Math.abs((p.x-a.x)*(b.z-a.z)-(p.z-a.z)*(b.x-a.x))<1e-8,'roll follows a straight line');}
});

test('chauffeur collects the carpet after passengers return and before driving away',()=>{
 for(let t=108;t<=128;t+=.1){const s=helipadState(t);assert(s.guests.every(g=>!g.visible));assert.equal(s.carZ,-.55);}
 assert(helipadState(119).driver.rolling);assert(helipadState(119).carpetProgress<1);assert.equal(helipadState(124).carpetProgress,0);assert(helipadState(125).driver.carrying);assert(!helipadState(128).driver.visible);assert(helipadState(130).carZ<-.55);
});
