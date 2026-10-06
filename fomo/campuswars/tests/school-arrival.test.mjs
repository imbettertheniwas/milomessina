import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {schoolDestinations,mergeSchoolCatalog,customSchool,destinationHash,routeFromHash,resolveDestination} from '../village-destinations.js';
import {schoolChoices,searchSchools,SCHOOL_PROMPT_DELAY} from '../village-school-search.js';
import {createSchoolFlight,JET_RIDE_DURATION,SCHOOL_FLIGHT_DURATION,schoolFlightStage} from '../village-school-flight.js';
import {createSchoolDrop} from '../village-school-drop.js';
import {createVillageRendererAsync} from '../village-renderer.js';
const catalog=[{id:'a',name:'Alpha University',aliases:['AU'],city:'Austin',state:'TX'},{id:'b',name:'Beta College',aliases:['BC'],city:'Boston',state:'MA'}];
const chapters=[{id:'c1',school:'AU',joined:22,active:40,name:'Sigma Chi',letters:'ΣΧ'}];
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
test('the jet ride includes exterior, cabin and exit before the existing freefall sequence',()=>{
 const scene=new T.Scene(),flight=createSchoolFlight(T,scene),camera=new T.PerspectiveCamera(48,.5,.1,2000),options={anchor:{lot:{z:38,originX:0}},aspect:.5};flight.begin(options);
 for(let time=0;time<=SCHOOL_FLIGHT_DURATION;time+=.1){const pose=flight.update(time,camera);assert(camera.position.toArray().every(Number.isFinite));assert(Number.isFinite(camera.fov));assert(pose.target.every(Number.isFinite));}
 assert.equal(schoolFlightStage(0),'jet');assert.equal(schoolFlightStage(4),'cabin');assert.equal(schoolFlightStage(7),'jump');assert.equal(schoolFlightStage(8.1),'freefall');
 flight.update(0,camera);assert(flight.root.visible);assert(flight.root.getObjectByName('jet-exterior').visible);
 flight.update(4,camera);assert(flight.root.getObjectByName('jet-cabin').visible);
 flight.update(10,camera);assert(!flight.root.visible);assert(flight.drop.root.visible);
 flight.finish();assert(!flight.root.visible);assert(!flight.drop.root.visible);flight.dispose();assert.equal(scene.children.length,0);
});
test('jet exit meets the original drop camera continuously and lands at the exact orbit view',()=>{
 const scene=new T.Scene(),flight=createSchoolFlight(T,scene),camera=new T.PerspectiveCamera(),reference=new T.PerspectiveCamera(),options={anchor:{lot:{z:-19,originX:100}},aspect:1};
 const drop=createSchoolDrop(T,new T.Scene());drop.begin(options);drop.update(0,reference);flight.begin(options);
 flight.update(JET_RIDE_DURATION-1e-6,camera);assert(camera.position.distanceTo(reference.position)<.001);assert(camera.quaternion.angleTo(reference.quaternion)<.001);
 flight.update(JET_RIDE_DURATION,camera);assert(camera.position.distanceTo(reference.position)<1e-8);
 const pose=flight.update(SCHOOL_FLIGHT_DURATION,camera),expected=new T.Vector3(...pose.target).add(new T.Vector3(Math.sin(pose.theta)*Math.cos(pose.phi)*pose.radius,Math.sin(pose.phi)*pose.radius,Math.cos(pose.theta)*Math.cos(pose.phi)*pose.radius));assert(camera.position.distanceTo(expected)<1e-8);assert.equal(camera.fov,48);
 flight.finish();flight.begin(options);flight.update(JET_RIDE_DURATION+.1,camera);assert(!flight.root.visible);flight.dispose();drop.dispose();
});

test('supplementary search names reuse a curated campus when its website matches',()=>{
 const base=[{...catalog[0],website:'alpha.edu'}],extra=[{id:'directory-alpha',name:'Alpha University Main Campus',aliases:['alpha'],website:'https://www.alpha.edu/'},{id:'directory-new',name:'New College',aliases:[],website:'https://new.edu'}];
 const merged=mergeSchoolCatalog(base,extra);assert.equal(merged.length,2);assert.equal(merged[0].id,'a');assert(merged[0].aliases.includes('Alpha University Main Campus'));assert.equal(base[0].aliases.length,1);
 const destinations=schoolDestinations([{...chapters[0],school:'Alpha University Main Campus'}],merged);assert.equal(destinations.find(s=>s.id==='school-a').chapters.length,1);assert.equal(destinations.find(s=>s.id==='school-directory-new').chapters.length,0);
});
