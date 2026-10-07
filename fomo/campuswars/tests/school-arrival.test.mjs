import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {schoolDestinations,mergeSchoolCatalog,customSchool,destinationHash,routeFromHash,resolveDestination} from '../village-destinations.js';
import {schoolChoices,searchSchools,SCHOOL_PROMPT_DELAY} from '../village-school-search.js';
import {createSchoolFlight,DOOR_EXIT_DURATION,SCHOOL_FLIGHT_DURATION,schoolFlightStage} from '../village-school-flight.js';
import {createSchoolDrop} from '../village-school-drop.js';
import {createVillageRendererAsync} from '../village-renderer.js';
const catalog=[{id:'a',name:'Alpha University',aliases:['AU'],city:'Austin',state:'TX'},{id:'b',name:'Beta College',aliases:['BC'],city:'Boston',state:'MA'}];
const chapters=[{id:'c1',school:'AU',joined:22,active:40,name:'Sigma Chi',letters:'SC'}];
test('autocomplete includes registered and empty campuses, matches aliases, and keeps existing chapters',()=>{
 const schools=schoolDestinations(chapters,catalog);assert.equal(schools.length,2);
 assert.equal(searchSchools(schools,'AU')[0].name,'Alpha University');
 assert.equal(searchSchools(schools,'beta')[0].chapters.length,0);
 assert.equal(searchSchools(schools,'alpha')[0].chapters[0].id,'c1');
 assert.equal(searchSchools(schools,'Boston')[0].name,'Beta College');
 assert.equal(SCHOOL_PROMPT_DELAY,6000);
});
test('a school outside the catalog gets a named starter campus and survives a reload link',()=>{
 const school=schoolChoices(schoolDestinations(chapters,catalog),'New Campus College')[0];assert(school.custom);assert.equal(school.chapters.length,0);
 const route=routeFromHash(destinationHash(school.id,'empty',school.name));assert.deepEqual(resolveDestination(route,[]),school);
 assert.equal(resolveDestination({school:school.id,name:'Different school'},[]),null);
 assert.equal(customSchool(' '),null);assert.deepEqual(schoolChoices([],''),[]);
});
test('empty-campus worlds have a claimable lot and never fabricate chapters or member counts',async()=>{
 const village=await createVillageRendererAsync(T,[],{attachStreet:true,metric:'members'});
 assert.equal(village.anchors.length,1);assert.equal(village.anchors[0].id,'empty');assert(village.beacon);village.dispose();
});
test('school selection starts at the doorway and never shows the exterior',()=>{
 const scene=new T.Scene(),flight=createSchoolFlight(T,scene),camera=new T.PerspectiveCamera(48,.5,.1,2000),options={anchor:{lot:{z:38,originX:0}},aspect:.5};flight.begin(options);
 for(let time=0;time<=SCHOOL_FLIGHT_DURATION;time+=.1){const pose=flight.update(time,camera);assert(camera.position.toArray().every(Number.isFinite));assert(Number.isFinite(camera.fov));assert(pose.target.every(Number.isFinite));}
 assert.equal(schoolFlightStage(0),'jump');assert.equal(schoolFlightStage(.1),'jump');assert.equal(schoolFlightStage(.9),'freefall');
 flight.update(0,camera);assert(flight.root.visible);assert(!flight.root.getObjectByName('jet-exterior').visible);assert(flight.root.getObjectByName('jet-cabin').visible);
 flight.update(.1,camera);assert(flight.root.getObjectByName('jet-cabin').visible);
 for(let t=0;t<SCHOOL_FLIGHT_DURATION;t+=.02){flight.update(t,camera);assert(!flight.root.getObjectByName('jet-exterior').visible);}
 flight.update(2.35,camera);assert(!flight.root.visible);assert(flight.drop.root.visible);
 flight.finish();assert(!flight.root.visible);assert(!flight.drop.root.visible);flight.dispose();assert.equal(scene.children.length,0);
});
test('jet exit meets the original drop camera continuously and lands at the exact orbit view',()=>{
 const scene=new T.Scene(),flight=createSchoolFlight(T,scene),camera=new T.PerspectiveCamera(),reference=new T.PerspectiveCamera(),options={anchor:{lot:{z:-19,originX:100}},aspect:1};
 const drop=createSchoolDrop(T,new T.Scene());drop.begin(options);drop.update(0,reference);flight.begin(options);
 flight.update(DOOR_EXIT_DURATION-1e-6,camera);assert(camera.position.distanceTo(reference.position)<.001);assert(camera.quaternion.angleTo(reference.quaternion)<.001);
 flight.update(DOOR_EXIT_DURATION,camera);assert(camera.position.distanceTo(reference.position)<1e-8);
 const pose=flight.update(SCHOOL_FLIGHT_DURATION,camera),expected=new T.Vector3(...pose.target).add(new T.Vector3(Math.sin(pose.theta)*Math.cos(pose.phi)*pose.radius,Math.sin(pose.phi)*pose.radius,Math.cos(pose.theta)*Math.cos(pose.phi)*pose.radius));assert(camera.position.distanceTo(expected)<1e-8);assert.equal(camera.fov,48);
 flight.finish();flight.begin(options);flight.update(DOOR_EXIT_DURATION+.6,camera);assert(!flight.root.visible);flight.dispose();drop.dispose();
});

test('supplementary search names reuse a curated campus when its website matches',()=>{
 const base=[{...catalog[0],website:'alpha.edu'}],extra=[{id:'directory-alpha',name:'Alpha University Main Campus',aliases:['alpha'],website:'https://www.alpha.edu/'},{id:'directory-new',name:'New College',aliases:[],website:'https://new.edu'}];
 const merged=mergeSchoolCatalog(base,extra);assert.equal(merged.length,2);assert.equal(merged[0].id,'a');assert(merged[0].aliases.includes('Alpha University Main Campus'));assert.equal(base[0].aliases.length,1);
 const destinations=schoolDestinations([{...chapters[0],school:'Alpha University Main Campus'}],merged);assert.equal(destinations.find(s=>s.id==='school-a').chapters.length,1);assert.equal(destinations.find(s=>s.id==='school-directory-new').chapters.length,0);
});

test('quick arrival keeps descent finite and downward, and matches velocity at the jump handoff',()=>{
 assert(Math.abs(SCHOOL_FLIGHT_DURATION-3.75)<1e-9);
 const scene=new T.Scene(),flight=createSchoolFlight(T,scene),camera=new T.PerspectiveCamera(48,.5),options={anchor:{lot:{z:-19,originX:100}},aspect:.5};flight.begin(options);
 const h=.0001;flight.update(DOOR_EXIT_DURATION-h,camera);const before=camera.position.clone();flight.update(DOOR_EXIT_DURATION,camera);const at=camera.position.clone();flight.update(DOOR_EXIT_DURATION+h,camera);const after=camera.position.clone();
 assert(at.clone().sub(before).divideScalar(h).distanceTo(after.clone().sub(at).divideScalar(h))<.05);
 let previous=Infinity;for(let t=DOOR_EXIT_DURATION;t<=SCHOOL_FLIGHT_DURATION;t+=1/60){flight.update(t,camera);assert(camera.position.y<=previous+.0001);previous=camera.position.y;assert(camera.quaternion.toArray().every(Number.isFinite));flight.drop.root.updateMatrixWorld(true);assert(flight.drop.root.matrixWorld.elements.every(Number.isFinite));assert(camera.fov>=47.99&&camera.fov<=94.01);}
 flight.dispose();
});
test('canopy opacity is independent of frame rate and resets when the flight is replayed',()=>{
 const drop=createSchoolDrop(T,new T.Scene()),camera=new T.PerspectiveCamera(),options={anchor:{lot:{z:-19,originX:0}}};drop.begin(options);
 const cloth=drop.root.getObjectByName('parachute-visible-cloth');drop.update(2.6,camera);const expected=cloth.material.opacity;for(let i=0;i<20;i++)drop.update(2.6,camera);assert.equal(cloth.material.opacity,expected);
 drop.update(2.95,camera);assert.equal(cloth.material.opacity,0);drop.finish();drop.begin(options);drop.update(2,camera);assert.equal(cloth.material.opacity,1);drop.dispose();
});
test('opening the canopy reduces fall speed continuously without a second acceleration',()=>{const drop=createSchoolDrop(T,new T.Scene()),camera=new T.PerspectiveCamera();drop.begin({anchor:{lot:{z:-19,originX:0}}});const speed=t=>{drop.update(t,camera);const y=camera.position.y;drop.update(t+.001,camera);return (y-camera.position.y)/.001;};assert(speed(.5)>speed(.1));let previous=speed(.56);for(let t=.57;t<2.94;t+=.02){const next=speed(t);assert(next<=previous+.001);assert(next>=0);previous=next;}drop.dispose();});


test('original dive lifts with the canopy, reveals cloth, and settles on desktop and phone',()=>{
 for(const aspect of [16/9,390/844]){
  const drop=createSchoolDrop(T,new T.Scene()),camera=new T.PerspectiveCamera(48,aspect),direction=new T.Vector3();
  drop.begin({anchor:{lot:{z:-19,originX:0}},aspect});
  drop.update(0,camera);camera.getWorldDirection(direction);assert(direction.y<-.85);assert(!drop.root.visible);
  drop.update(1.2,camera);camera.getWorldDirection(direction);assert(Math.abs(direction.y)<.2);assert(drop.root.visible);
  drop.root.updateMatrixWorld(true);
  let visible=0;for(const panel of drop.root.children.filter(c=>c.name==='parachute-visible-cloth')){
   const points=panel.geometry.attributes.position;
   for(let i=0;i<points.count;i++){const p=new T.Vector3().fromBufferAttribute(points,i).applyMatrix4(panel.matrixWorld).project(camera);if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1)visible++;}
  }
  assert(visible>20,'canopy cloth must actually enter the camera frame');
  const h=.0001;drop.update(2.95-h,camera);const q=camera.quaternion.clone(),p=camera.position.clone();drop.update(2.95,camera);
  assert(camera.quaternion.angleTo(q)<.00001);assert(camera.position.distanceTo(p)<.00001);assert.equal(camera.fov,48);
  drop.dispose();
 }
});

test('doorway looks out through the side hatch before rotating into freefall',()=>{
 const flight=createSchoolFlight(T,new T.Scene()),camera=new T.PerspectiveCamera(),direction=new T.Vector3();flight.begin({anchor:{lot:{z:-19,originX:0}}});
 flight.update(0,camera);camera.getWorldDirection(direction);assert(direction.x<-.8);assert(direction.y>-.5);
 flight.update(DOOR_EXIT_DURATION,camera);camera.getWorldDirection(direction);assert(direction.y<-.85);flight.dispose();
});
