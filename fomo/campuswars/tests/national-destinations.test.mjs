import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.min.js';
import {schoolStandings,destinationChapters,routeFromHash,destinationHash,resolveDestination,mapPoint} from '../village-destinations.js';
import {rankedHouseSizes} from '../village-house-sizing.js';
import {createVillageRendererAsync} from '../village-renderer.js';
import {schoolTheme,createSchoolDistricts} from '../village-school-theme.js';
import {createSchoolDrop,SCHOOL_DROP_DURATION} from '../village-school-drop.js';
const catalog=JSON.parse(readFileSync(new URL('../data/schools.json',import.meta.url))).schools;
const rows=Array.from({length:201},(_,i)=>({id:'c'+i,name:'Sigma Chi',letters:'ΣΧ',school:i%2?'Rutgers University':'Arizona State University',shortSchool:'Campus',joined:i%31,active:100,registered:'2026-10-04'}));
test('national world contains exactly the top nineteen; no extra chapter streets are created',async()=>{
 const chapters=destinationChapters(rows);assert.equal(chapters.length,19);assert.equal(chapters[0].joined,30);const outside=rows.filter(c=>!chapters.some(a=>a.id===c.id));assert(Math.min(...chapters.map(c=>c.joined))>=Math.max(...outside.map(c=>c.joined)));
 const village=await createVillageRendererAsync(T,chapters,{attachStreet:true,metric:'members'});
 try{assert.equal(village.streetTotal,1);assert.equal(village.anchors.filter(a=>a.id!=='empty').length,19);assert(village.lots.every(l=>l.originX===0));}finally{village.dispose();}
});
test('school grouping merges organization suffixes and institutional aliases without losing chapters or counts',()=>{
 const sample=[{...rows[0],id:'a',school:'Arizona State University · Student organization / club',joined:10},{...rows[1],id:'b',school:'Arizona State University',joined:30},{...rows[2],id:'c',school:'Arizona State University Campus Immersion',joined:20}];
 const schools=schoolStandings(sample,catalog);assert.equal(schools.length,1);assert.equal(schools[0].members,60);assert.equal(schools[0].chapters.length,3);assert.equal(schools[0].chapters[0].id,'b');assert(Number.isFinite(schools[0].lat));
});
test('member totals, not roster percentages, determine size and equal totals have equal sizes',()=>{
 const sample=[{...rows[0],id:'small',joined:20,active:20},{...rows[0],id:'big',joined:90,active:200},{...rows[0],id:'tie',joined:90,active:90}];const sizes=rankedHouseSizes(sample,'members');
 for(const field of ['footprint','roofline','depthScale']){assert(sizes.get('big')[field]>sizes.get('small')[field]);assert.equal(sizes.get('big')[field],sizes.get('tie')[field]);}
});
test('school destinations contain only that campus and chapter deep links resolve to the school',()=>{
 const schools=schoolStandings(rows,catalog),school=schools[0],chapter=school.chapters[0];assert(destinationChapters(rows,school).every(c=>c.school===chapter.school));
 assert.equal(resolveDestination(routeFromHash(destinationHash(school.id,chapter.id)),schools).id,school.id);assert.equal(resolveDestination({chapter:chapter.id},schools).id,school.id);assert.equal(resolveDestination({},schools),null);
});
test('unknown schools stay searchable without invented coordinates and tied schools have stable ranks',()=>{
 const schools=schoolStandings([{...rows[0],school:'Unknown College',joined:5},{...rows[1],school:'Another College',joined:5}],catalog);assert.equal(schools[0].rank,1);assert.equal(schools[1].rank,1);assert.equal(schools[0].lat,undefined);assert.equal(schools[0].members,5);
});
test('all catalog locations are finite and school themes are deterministic and distinct',()=>{
 for(const s of catalog){assert(s.lat>=18&&s.lat<=72);assert(s.lon>=-180&&s.lon<=-60);assert(Number.isFinite(mapPoint(s.lon,s.lat).x));assert.deepEqual(schoolTheme(s),schoolTheme({...s}));}
 const themes=['San Diego State University','University of Colorado at Boulder','New York University'].map(name=>schoolTheme(catalog.find(s=>s.name===name)));assert.equal(new Set(themes.map(t=>t.land)).size,3);
});
test('school environment variants build finite geometry and release instanced scenery on departure',()=>{
 for(const name of ['Arizona State University','San Diego State University','University of Colorado at Boulder','New York University']){const school={...catalog.find(s=>s.name===name),id:name};const world=createSchoolDistricts(T,school,19);let meshes=0,instances=0,released=0;world.root.traverse(o=>{if(o.geometry){meshes++;o.geometry.computeBoundingSphere();assert(Number.isFinite(o.geometry.boundingSphere.radius));}if(o.isInstancedMesh){instances++;o.addEventListener('dispose',()=>released++);}});assert(meshes>0);assert(instances>0);world.dispose();assert.equal(released,instances);}
});
test('The quick canopy opens on the flight and ends with an exact continuous orbit handoff',()=>{
 const scene=new T.Scene(),drop=createSchoolDrop(T,scene),camera=new T.PerspectiveCamera();drop.begin({anchor:{lot:{z:38,originX:0}},aspect:1});
 drop.update(0,camera);assert.equal(drop.root.visible,false);assert(camera.position.y>180);drop.update(2.1,camera);assert.equal(drop.root.visible,true);
 const end=drop.update(SCHOOL_DROP_DURATION,camera),target=new T.Vector3(...end.target),expected=target.clone().add(new T.Vector3(Math.sin(end.theta)*Math.cos(end.phi)*end.radius,Math.sin(end.phi)*end.radius,Math.cos(end.theta)*Math.cos(end.phi)*end.radius));assert(camera.position.distanceTo(expected)<1e-8);assert.equal(camera.fov,48);drop.finish();assert.equal(drop.root.visible,false);drop.dispose();
});
