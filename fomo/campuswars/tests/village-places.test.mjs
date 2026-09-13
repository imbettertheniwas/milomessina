import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createDistricts} from '../village-districts.js';
import {campusPeople,campusPose} from '../village-campus-life.js';
import {journeyPose,marketJourneys} from '../village-place-layout.js';
import {createPreviewServer} from '../../../server/campuswars-preview.mjs';

test('everyday journeys pause at destinations, carry pickups home and stay continuous across cycles',()=>{
  for(const journey of marketJourneys){
    const duration=journeyPose(journey.points,0).duration;
    let stopped=0;
    for(let t=0;t<duration*2;t+=.25){
      const a=journeyPose(journey.points,t),b=journeyPose(journey.points,t+.01);
      assert(Math.hypot(a.x-b.x,a.z-b.z)<.012,'No position jumps, including at a cycle boundary');
      if(!a.walking)stopped++;
    }
    assert(stopped>20);
  }
  const person=campusPeople('town',1,-1).find(p=>p.carry==='pizza');
  assert.equal(campusPose(person,0).carrying,false);
  const duration=journeyPose(person.points,0,person.speed).duration;
  let returning=false;
  for(let t=0;t<duration;t++)if(campusPose(person,t).carrying)returning=true;
  assert(returning,'The pickup appears after the stop at the pizza shop');
});

test('new destinations and routes stay outside buildings and inside crowd bounds as the village grows',()=>{
  for(const [extension,streets] of [[0,1],[133,2],[133,5]]){
    const districts=createDistricts(T,extension,streets);
    try{
      for(const chunk of districts.chunks.values())for(const p of chunk.people){
        for(let time=0;time<400;time+=2.7){
          const pose=campusPose(p,time);
          const point=new T.Vector3(pose.x,2,pose.z).applyMatrix4(chunk.group.matrixWorld);
          assert(chunk.activityBounds.distanceToPoint(point)<-1.5,'Bodies and carried objects fit the culling bounds');
          for(const spec of chunk.specs){
            const dx=pose.x-(spec.x-Math.round(chunk.group.position.x/100)*100),dz=pose.z-(spec.z-(chunk.group.position.z>30?chunk.group.position.z-extension:chunk.group.position.z)),a=spec.rotation;
            assert(!(Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<spec.width/2+.15&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<spec.depth/2+.15),`${p.purpose||p.action} crosses ${spec.label||spec.type}`);
          }
        }
      }
    }finally{districts.dispose();}
  }
});

test('evening activity gathers at the market while the green becomes quieter',()=>{
  const visible=(people,night)=>people.filter(p=>!campusPose(p,100,night).hidden).length;
  const green=campusPeople('green',-1,1),town=campusPeople('town',1,-1);
  assert(visible(green,true)<visible(green,false)/2);
  assert(visible(town,true)>visible(green,true)*4);
  assert(town.filter(p=>p.nightOnly).every(p=>p.x>0&&p.z>20),'Evening groups belong to the patio');
});

test('night lighting survives streaming and paused redraws, and returns exactly to daylight',()=>{
  const districts=createDistricts(T);
  const lights=()=>{const found=new Set();districts.root.traverse(o=>{if(o.material?.userData.placeLight)found.add(o.material);});return [...found];};
  try{
    assert(lights().some(m=>m.userData.placeLight==='shopLight'));
    districts.animate(10);districts.setNight(true);districts.animate(10);
    assert(lights().every(m=>m.emissiveIntensity>.5));
    districts.update(300,300);districts.update(0,0);districts.animate(10);
    assert(lights().every(m=>m.emissiveIntensity>.5));
    districts.setNight(false);districts.animate(10);
    assert(lights().every(m=>m.emissiveIntensity===.04));
    for(const chunk of districts.chunks.values())chunk.group.traverse(o=>{if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite));});
  }finally{districts.dispose();}
});

function request(server,url,method='GET'){
  return new Promise(resolve=>{const result={headers:{}};server.emit('request',{url,method},{setHeader(k,v){result.headers[k]=v;},writeHead(status,headers={}){result.status=status;Object.assign(result.headers,headers);},end(body){result.body=body;resolve(result);}});});
}
test('local preview forwards live public data, preserves source timestamps, and fails honestly on outages',async()=>{
  const snapshot={live:true,source:'Chapter registrations',updatedAt:new Date().toISOString(),chapters:[]};let upstream;
  const server=createPreviewServer(async url=>{upstream=url;return {ok:true,json:async()=>snapshot};});
  const result=await request(server,'/api/campuswars');assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body),snapshot);assert.equal(upstream,'https://milomessina.com/api/campuswars');
  const unavailable=await request(createPreviewServer(async()=>{throw new Error('offline');}),'/api/campuswars');assert.equal(unavailable.status,503);assert(!JSON.parse(unavailable.body).live);
  assert.equal((await request(server,'/api/campuswars','POST')).status,405);
  assert.equal((await request(server,'/.env')).status,404);
  assert.equal((await request(server,'/server/campuswars-preview.mjs')).status,404);
  assert.equal((await request(server,'/fomo/campuswars/')).status,200);
});
