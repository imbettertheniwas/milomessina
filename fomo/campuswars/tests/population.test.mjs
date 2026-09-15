import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createVillagePopulation,populationStatus,villagePopulation} from '../village-population.js';
import {startChapterFeed} from '../chapter-feed.js';

const chapter=(id,joined)=>({id,joined,active:1000,name:id,letters:'ΣΧ',school:'University',shortSchool:'University',type:'Fraternity',registered:'2026-09-15'});

test('population totals include every registered chapter, including zero joins, and exclude active-roster denominators',()=>{
  const chapters=Array.from({length:1000},(_,i)=>chapter(`chapter-${i}`,i%3));
  assert.deepEqual(villagePopulation(chapters),{members:999,chapters:1000});
  assert.deepEqual(villagePopulation([]),{members:0,chapters:0});
});

test('live feed drives sign totals, corrections, chapter removals and unchanged-count recovery',async()=>{
  let now=Date.now(),fail=false;
  const snapshot=chapters=>({live:true,updatedAt:new Date(now).toISOString(),chapters});
  let current=snapshot([chapter('one',400),chapter('two',38)]);
  const sign=createVillagePopulation(T,[]),root=sign.root;
  let changes=0;
  const feed=startChapterFeed({initialSnapshot:current,storageRef:null,now:()=>now,documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:!fail,json:async()=>current}),onUpdate:s=>{changes++;sign.setChapters(s.chapters);},onStatus:s=>sign.setStatus(s)});
  // Match production: counts initialize before the unchanged first response.
  sign.setChapters(current.chapters);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(changes,0);assert.equal(root.userData.members,438);assert.equal(root.userData.status,'LIVE REGISTRATIONS');
  fail=true;await feed.refresh();assert.equal(root.userData.members,438);assert.equal(root.userData.status,'LAST KNOWN REGISTRATIONS');
  fail=false;await feed.refresh();assert.equal(changes,0);assert.equal(root.userData.status,'LIVE REGISTRATIONS');
  now++;current=snapshot([chapter('one',401),chapter('two',38),chapter('three',0)]);await feed.refresh();
  assert.equal(root.userData.members,439);assert.equal(root.userData.chapters,3);
  now++;current=snapshot([chapter('one',399)]);await feed.refresh();
  assert.equal(root.userData.members,399);assert.equal(root.userData.chapters,1);assert.equal(sign.root,root);
  current={...current,stale:true};await feed.refresh();assert.equal(root.userData.status,'LAST KNOWN REGISTRATIONS');
  feed.stop();sign.dispose();
});

test('the sign ages honestly and reuses one shared texture for both directions',t=>{
  const context=new Proxy({},{get:()=>()=>{}}),original=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>context})}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;});
  const now=Date.now(),status={live:true,updatedAt:new Date(now).toISOString()};
  const sign=createVillagePopulation(T,[chapter('one',438)],status),faces=sign.root.children.filter(o=>o.name==='population-sign-face');
  assert.equal(faces.length,2);assert.equal(faces[0].material.map,faces[1].material.map);
  const texture=faces[0].material.map,version=texture.version;
  assert.equal(sign.refresh(now),false);assert.equal(texture.version,version);
  sign.refresh(now+90001);assert.equal(sign.root.userData.status,'LAST KNOWN REGISTRATIONS');assert.equal(texture.version,version+1);
  const bounds=new T.Box3().setFromObject(sign.root);assert(bounds.min.x>8.1,'sign clears the pedestrian pavement');assert(bounds.min.z>-41.7,'sign clears the entrance intersection');
  assert.equal(populationStatus({},now),'CONNECTING · SAVED REGISTRATIONS');
  let disposed=0;texture.addEventListener('dispose',()=>disposed++);sign.dispose();assert.equal(disposed,1);
});
