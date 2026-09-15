import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {createStreetNetwork} from '../village-streets.js';
import {createDistricts} from '../village-districts.js';
import {LOTS,crowdMembers,toWorld,activityPose} from '../village-layout.js';
import {campusPeople,campusPose} from '../village-campus-life.js';
import {roundedLoop} from '../village-district-layout.js';
import {houseStandings,createCompetition} from '../village-competition.js';
const {chapters}=JSON.parse(fs.readFileSync(new URL('../chapters.json',import.meta.url)));
const village=createVillage(THREE,chapters);
test('house ranks use full-roster onboarding progress and preserve genuine ties',()=>{
  assert.deepEqual(houseStandings(chapters).map(c=>[c.id,c.rank,Math.round(c.progress*100)]),[
    ['sigma-chi-sdsu',1,60],['kappa-sigma-coastal',2,49],['phi-delta-theta-tampa',3,42],['phi-kappa-psi-vt',4,2],['tau-kappa-epsilon-tampa',5,0]
  ]);
  const input=[{id:'a',joined:10,active:20},{id:'b',joined:20,active:40},{id:'c',joined:24,active:100},{id:'empty',joined:0,active:0}],before=structuredClone(input);
  assert.deepEqual(houseStandings(input).map(c=>[c.id,c.rank]),[['b',1],['a',1],['c',3]]);
  assert.deepEqual(input,before);
});
test('competition marks only registered houses and aims the spotlight at the leader',()=>{
  const {badges,spotlight,leaderId,board}=village.competition;
  assert.equal(badges.length,5);assert.equal(leaderId,'sigma-chi-sdsu');
  for(const badge of badges){const anchor=village.anchors.find(a=>a.id===badge.userData.chapter);assert(anchor);assert.equal(badge.position.x,anchor.lot.x);assert.equal(badge.position.z,anchor.lot.z);assert(badge.position.y>anchor.point.y);}
  const leader=village.anchors.find(a=>a.id===leaderId);assert.equal(spotlight.target.position.x,leader.lot.x);assert.equal(spotlight.target.position.z,leader.lot.z);
  const front=new THREE.Vector3(0,0,1).applyQuaternion(board.quaternion),towardHouses=new THREE.Vector3(-board.position.x,0,-board.position.z).normalize();assert(front.dot(towardHouses)>.95);
  const empty=createCompetition(THREE,chapters.map(c=>({...c,joined:0})),village.anchors);assert.equal(empty.leaderId,null);assert.equal(empty.spotlight,null);
});
test('each onboarded member appears exactly once at their own chapter',()=>{
  assert.equal(village.members.length,117);
  for(const c of chapters){const members=village.members.filter(m=>m.chapter===c.id);assert.equal(members.length,c.joined);assert.equal(new Set(members.map(m=>m.member)).size,c.joined);}
  assert.equal(village.members.filter(m=>m.chapter==='empty').length,0);
});
test('crowds are reproducible and reject invalid registration counts',()=>{
  assert.deepEqual(crowdMembers(chapters),crowdMembers(chapters));
  for(const joined of [-1,.5,NaN,'60'])assert.throws(()=>crowdMembers([{...chapters[0],joined}]));
});
test('all six lots face the shared boulevard and are individually selectable',()=>{
  village.world.updateMatrixWorld(true);const ray=new THREE.Raycaster();
  for(const anchor of village.anchors){const front=toWorld(anchor.lot,0,10);assert(Math.abs(front.x)<Math.abs(anchor.lot.x));ray.set(new THREE.Vector3(anchor.lot.x,40,anchor.lot.z),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObjects(village.pickables)[0]?.object.userData.chapter,anchor.id);}
  assert.equal(village.anchors.length,6);assert.equal(LOTS.length,6);
});

test('conversation gestures update articulated bodies with finite transforms',()=>{
  const before=Array.from(village.parts.armL.instanceMatrix.array);village.animateCrowd(.7);assert.notDeepEqual(Array.from(village.parts.armL.instanceMatrix.array),before);
  for(const time of [0,1.2,47,3600]){village.animateCrowd(time);for(const [name,part] of Object.entries(village.parts)){assert.equal(part.count,117*(name==='backpack'?7:name==='hair'?2:1));assert([...part.instanceMatrix.array].every(Number.isFinite));}}
});
test('repeated architecture is batched for a bounded draw count',()=>{
  let drawables=0;village.world.traverse(object=>{if(object.isMesh)drawables++;});assert(drawables<150,`Too many scene meshes: ${drawables}`);
});

test('completed houses retain conversation groups and five leisure walkers',()=>{
  assert.equal(village.members.filter(m=>m.walking).length,5);
  const standing=village.members.filter(m=>!m.walking&&m.action!=='build');assert(standing.every(m=>m.groupSize>=2));
  for(const member of standing){const a=activityPose(member,0),b=activityPose(member,15);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert(Math.abs(a.breath)<.01&&Math.abs(b.breath)<.01);}
  const groups=Map.groupBy(standing.filter(m=>!['pong','die'].includes(m.action)),m=>m.chapter+':'+m.groupPhase);
  for(const t of [0,4,13,27])for(const group of groups.values())assert(group.filter(m=>activityPose(m,t).speaking).length<=1);
  for(const member of village.members.filter(m=>m.walking)){const a=activityPose(member,0),b=activityPose(member,10);assert(Math.hypot(a.x-b.x,a.z-b.z)>1);}
});

test('the surrounding village streams a bounded number of repeatable blocks',()=>{
  const districts=createDistricts(THREE);
  for(const [x,z] of [[0,0],[500,500],[-900,300],[0,0]]){
    districts.update(x,z);districts.animate(18);assert.equal(districts.chunks.size,9);
    let drawables=0;districts.root.traverse(o=>{if(o.isMesh)drawables++;if(o.isInstancedMesh)assert([...o.instanceMatrix.array].every(Number.isFinite));});assert(drawables<270);
  }
  assert(districts.chunks.has('0,0'));assert.equal(village.members.length,117);
});
test('crowd culling bounds contain all chapter activity positions',()=>{
  for(const time of [0,8,24,50])for(const member of village.members){
    const pose=activityPose(member,time);
    for(const part of Object.values(village.parts))assert(part.boundingSphere.containsPoint(new THREE.Vector3(pose.x,1.5,pose.z)));
  }
  const districts=createDistricts(THREE);assert.equal(districts.update(0,0),false);assert.equal(districts.update(150,0),false);
  for(const chunk of districts.chunks.values())assert.equal(chunk.group.matrixAutoUpdate,false);
});

function paintedFloor(){
  const paint=[];let path=[];
  const context={scale(){},fillRect(x,z,w,d){paint.push({kind:'rect',x,z,w,d,color:this.fillStyle});},beginPath(){path=[];},arc(x,z,r){path.push({x,z,r});},moveTo(x,z){path.push({x,z});},lineTo(x,z){path.push({x,z});},fill(){paint.push({kind:'circle',...path[0],color:this.fillStyle});},stroke(){for(let i=1;i<path.length;i++)paint.push({kind:'line',a:path[i-1],b:path[i],width:this.lineWidth,color:this.strokeStyle});}};
  context.createRadialGradient=()=>({addColorStop(){}});
  const aux={scale(){},fillRect(){},beginPath(){},arc(){},moveTo(){},lineTo(){},quadraticCurveTo(){},fill(){},stroke(){},putImageData(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})};
  let canvases=0;const original=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>canvases++===0?context:aux})};
  let streets;try{streets=createStreetNetwork(THREE);}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
  const at=(x,z)=>{
    const u=((x/300+.5)%1+1)%1*300,v=((-z/300+.5)%1+1)%1*300;
    return paint.findLast(r=>{
      if(r.kind==='rect')return u>=r.x&&u<r.x+r.w&&v>=r.z&&v<r.z+r.d;
      if(r.kind==='circle')return Math.hypot(u-r.x,v-r.z)<=r.r;
      const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,t=Math.max(0,Math.min(1,((u-r.a.x)*dx+(v-r.a.z)*dz)/(dx*dx+dz*dz)));
      return Math.hypot(u-r.a.x-t*dx,v-r.a.z-t*dz)<=r.width/2;
    })?.color;
  };
  return {streets,at};
}
test('the opaque campus floor has connected roads and pedestrian-only academic axes',()=>{
  const {streets,at}=paintedFloor();
  assert.deepEqual(streets.material.map.offset.toArray(),[0,0]);assert.deepEqual(streets.material.map.repeat.toArray(),[1,1]);
  for(const [x,z] of [[1,0],[101,0],[-101,0],[20,51],[1,50],[101,-50],[301,0]])assert.equal(at(x,z),'#505a60');
  assert.equal(at(0,100),'#c4c2b3');assert.equal(at(0,-85),'#c4c2b3');
  assert.equal(at(7,0),'#bfc0b5');
});
test('cars and bicycles stay on the painted street network through every corner',()=>{
  const {at}=paintedFloor();const roads=new Set(['#505a60','#c5bea5','#d9d6c7','#a5b4a4','#4b555b','#566066','#485259','#788083','#414c53','#586567']);
  for(const path of [roundedLoop(2.4,-47.6,97.6,47.6,7.8),roundedLoop(-97.6,-47.6,-2.4,47.6,7.8),roundedLoop(4.7,-45.3,95.3,45.3,8),roundedLoop(-95.3,-45.3,-4.7,45.3,8)]){
    for(let distance=0;distance<path.length;distance+=1.7){const p=path.sample(distance);assert(roads.has(at(p.x,p.z)),`Traffic leaves pavement at ${p.x}, ${p.z}: ${at(p.x,p.z)}`);}
    const start=path.sample(0),end=path.sample(path.length-1e-5);assert(Math.hypot(start.x-end.x,start.z-end.z)<.001);
  }
});
test('campus activity varies and stays outside building footprints',()=>{
  const districts=createDistricts(THREE),actions=new Set();
  for(const chunk of districts.chunks.values())for(const person of chunk.people){
    actions.add(person.action);
    for(const time of [0,7,19,45,90]){
      const pose=campusPose(person,time);assert([pose.x,pose.z,pose.angle].every(Number.isFinite));
      for(const spec of chunk.specs){const dx=pose.x-(spec.x-chunk.group.position.x),dz=pose.z-(spec.z-chunk.group.position.z),a=spec.rotation,x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);assert(!(Math.abs(x)<spec.width/2+.15&&Math.abs(z)<spec.depth/2+.15),`${person.action} intersects ${spec.type}`);}
    }
  }
  for(const action of ['walk','jog','talk','study','sit','lawn','queue','basketball'])assert(actions.has(action));
  assert.equal(districts.traffic.cars.length,8);assert.equal(districts.traffic.cyclists.length,12);
  for(const time of [0,1,240,10000]){districts.animate(time);districts.root.traverse(o=>{if(o.isInstancedMesh)assert([...o.instanceMatrix.array].every(Number.isFinite));});}
});
test('streaming neighborhoods never replaces or removes the street network',()=>{
  const districts=createDistricts(THREE),street=village.streets,parent=street.parent;
  for(const [x,z] of [[49,0],[51,0],[-51,150],[0,0]]){districts.update(x,z);assert.equal(street.parent,parent);assert.equal(street,village.streets);}
  street.geometry.computeBoundingBox();assert(street.geometry.boundingBox.max.x-street.geometry.boundingBox.min.x<3000);assert.equal(street.position.y,.045);
});

test('terrain and roads use one opaque floor without a competing large plane',()=>{
  const floors=[];
  village.world.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();if(o.geometry.boundingBox.max.x-o.geometry.boundingBox.min.x>=1000)floors.push(o);}});
  assert.equal(floors.length,1);assert.equal(floors[0],village.streets);
  assert.equal(floors[0].material.alphaTest,0);assert.equal(floors[0].material.transparent,false);assert.equal(floors[0].material.depthWrite,true);
});

test('registered chapters stay under construction until the fifteenth member',()=>{
  for(const joined of [0,2,14,15]){
    const data=chapters.map((chapter,index)=>index===0?{...chapter,joined}:chapter),scene=createVillage(THREE,data),id=data[0].id;
    assert.equal(Boolean(scene.world.getObjectByName(`chapter-construction-${id}`)),joined<15);
    assert.equal(Boolean(scene.world.getObjectByName(`chapter-house-${id}`)),joined>=15);
    const banner=scene.world.getObjectByName(`chapter-banner-${id}`);
    assert.equal(banner.userData.joined,joined);assert(scene.pickables.includes(banner));
    assert.equal(scene.members.filter(member=>member.chapter===id).length,joined);
    assert.equal(scene.anchors.length,6);
  }
});

test('seeded campus details and appearances reproduce across independent builds',async()=>{
  const {hash,appearance,palettes}=await import('../village-district-layout.js');
  const {createHash}=await import('node:crypto');
  const samples=Array.from({length:300},(_,i)=>appearance('campus',i));
  assert.deepEqual(samples,Array.from({length:300},(_,i)=>appearance('campus',i)));
  assert(new Set(samples.map(p=>p.shirt)).size>20);assert(new Set(samples.map(p=>p.skin)).size===palettes.skin.length);
  for(const p of samples){assert(p.height>=.9&&p.height<=1.1);assert(p.hairLength>=0&&p.hairLength<1);}
  for(const key of ['shirt','skin','height'])assert.notEqual(hash(-2,7,key),hash(-2,8,key));
  const digest=d=>{const h=createHash('sha256');d.root.traverse(o=>{if(o.isInstancedMesh){h.update(o.geometry.type+o.count);h.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)h.update(Buffer.from(o.instanceColor.array.buffer));}});return h.digest('hex');};
  const a=createDistricts(THREE),b=createDistricts(THREE);assert.equal(digest(a),digest(b));
  a.animate(17);b.animate(17);assert.equal(digest(a),digest(b));
});

test('a denser campus retains bounded instances and a persistent static horizon',()=>{
  const districts=createDistricts(THREE),horizon=districts.horizon;
  const counts=[...districts.chunks.values()].map(c=>c.people.length);
  assert(counts.reduce((a,b)=>a+b,0)>=400);assert(Math.max(...counts)>Math.min(...counts)*2);
  const horizonMatrix=horizon.matrixWorld.toArray(),horizonChildren=horizon.children.length;
  for(const [x,z] of [[0,0],[500,500],[-900,300],[2000,-3000],[0,0]]){
    districts.update(x,z);assert.equal(districts.chunks.size,9);
    // Keep the existing campus budget; the stadium and eight-draw national
    // prize monument have their own fixed, separately tested budgets.
    const stadiumObjects=new Set();districts.stadium.root.traverse(o=>stadiumObjects.add(o));
    districts.root.getObjectByName('national-prize-trophy')?.traverse(o=>stadiumObjects.add(o));
    let instances=0,drawables=0,distantBatches=0;districts.root.traverse(o=>{if(stadiumObjects.has(o))return;if(o.name==='distant-chapter-members'){distantBatches++;return;}if(o.isMesh)drawables++;if(o.isInstancedMesh)instances+=o.count;});
    assert(distantBatches<=9,'At most one distant crowd draw per streamed block');assert(instances<22000,`Unbounded instances: ${instances}`);assert(drawables<200,`Unbounded meshes: ${drawables}`);
    for(const time of [0,8,16,23.99,240,10000]){districts.animate(time,x,z);districts.root.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite));if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite));});}
    assert.equal(districts.horizon,horizon);assert.equal(horizon.parent,districts.root);assert.deepEqual(horizon.matrixWorld.toArray(),horizonMatrix);assert.equal(horizon.children.length,horizonChildren);
  }
});

test('new campus activities have deterministic paths and parked cars clear buildings',()=>{
  const districts=createDistricts(THREE),actions=new Set();let cars=0;
  for(const c of districts.chunks.values()){
    for(const person of c.people){actions.add(person.action);if(person.action==='doorway'){assert(campusPose(person,8-person.offset).hidden);assert(!campusPose(person,17-person.offset).hidden);}}
    c.group.traverse(o=>{if(o.name!=='parked-campus-car')return;cars++;
      for(const [x,z] of [[0,0],[-.9,-2.1],[-.9,2.1],[.9,-2.1],[.9,2.1]]){
        const point=o.localToWorld(new THREE.Vector3(x,0,z));
        for(const spec of c.specs){const dx=point.x-spec.x,dz=point.z-spec.z,a=spec.rotation,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);assert(!(Math.abs(lx)<spec.width/2+.2&&Math.abs(lz)<spec.depth/2+.2),`Parked car intersects ${spec.type}`);}
      }
    });
  }
  assert(cars>=70);for(const action of ['doorway','dogwalk','skate','frisbee','groundskeeper'])assert(actions.has(action));
  assert.equal(districts.traffic.cars.length,8);assert.equal(districts.traffic.cyclists.length,12);
});

test('member conversations spread across the lawn and porch without body overlap',()=>{
  const members=crowdMembers(chapters);
  for(const chapter of chapters){const standing=members.filter(m=>m.chapter===chapter.id&&!m.walking);
    for(let i=0;i<standing.length;i++)for(let j=i+1;j<standing.length;j++)assert(Math.hypot(standing[i].x-standing[j].x,standing[i].z-standing[j].z)>.5);
    if(chapter.joined>=15){assert(standing.some(m=>m.ground>.3));assert(new Set(standing.map(m=>m.groupSize)).size>=3);}
  }
});

// Locomotion regressions: check physical constraints, not just changing matrices.
const {footstep,gaitPhase,humanPose,speechGesture}=await import('../village-human-motion.js');
test('feet hold ground during stance and return smoothly across each stride',()=>{
  for(const height of [.9,1,1.1])for(const speed of [.65,1,1.6])for(const jog of [false,true]){
    const person={height,phase:0},cycle=(jog?1.48:1.08)*height,samples=[.1,.2,.3];
    const positions=samples.map(u=>{const distance=u*cycle,foot=footstep(gaitPhase(distance,person,jog),jog);assert(foot.planted);assert.equal(foot.lift,0);return distance+foot.z*height;});
    assert(Math.max(...positions)-Math.min(...positions)<1e-9,'A planted foot slides');
    for(const u of [0,jog?.48:.62,1]){
      const a=footstep((u-1e-6)*Math.PI*2,jog),b=footstep((u+1e-6)*Math.PI*2,jog);
      assert(Math.abs(a.z-b.z)<1e-4&&Math.abs(a.lift-b.lift)<1e-4&&Math.abs(a.pitch-b.pitch)<1e-4,'Foot pops at stride boundary');
    }
    assert(footstep(.8*Math.PI*2,jog).lift>.05);
    const dt=.001,d=.2*cycle,a=footstep(gaitPhase(d,person,jog),jog),b=footstep(gaitPhase(d+dt*speed,person,jog),jog);
    assert(Math.abs(speed+(b.z-a.z)*height/dt)<1e-8);
  }
});
test('knees bend forward without stretching legs and standing feet stay still',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(const action of ['walk','jog'])for(let t=0;t<8;t+=.025){
    const p={action,height:1,phase:.7},rig=humanPose(p,{walking:true,gait:gaitPhase(t,p,action==='jog')},t);
    for(const leg of rig.legs){assert(Math.abs(distance(leg.hip,leg.knee)-.43)<.002);assert(Math.abs(distance(leg.knee,leg.ankle)-.43)<.002);assert(leg.knee[2]>(leg.hip[2]+leg.ankle[2])/2);}
  }
  const p={height:1,phase:2},a=humanPose(p,{walking:false},0),b=humanPose(p,{walking:false},17);
  assert.deepEqual(a.legs.map(l=>l.ankle),b.legs.map(l=>l.ankle));assert.notDeepEqual(a.chest,b.chest);
});
test('chapter walkers pause smoothly and clear their conversation groups',()=>{
  const members=crowdMembers(chapters);
  for(const p of members.filter(m=>m.walking))for(let t=0;t<70;t+=.2){
    const a=activityPose(p,t),b=activityPose(p,t+.001);
    assert(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)/.001-p.motionProfile.walkSpeed*a.motion)<.002);
    assert(Math.cos(a.rotation)*(b.z-a.z)+Math.sin(a.rotation)*(b.x-a.x)>=-1e-8);
    for(const other of members.filter(m=>!m.walking&&m.chapter===p.chapter))assert(Math.hypot(a.x-other.x,a.z-other.z)>.5);
  }
});
test('conversation hands settle before speaker changes and routes turn continuously',()=>{
  for(const boundary of [0,1,2,10])assert(speechGesture(boundary-1e-6,6*boundary,2)<1e-8&&speechGesture(boundary+1e-6,6*boundary,2)<1e-8);
  const people=campusPeople('greek',0,0);
  for(const p of people.filter(p=>['walk','jog','groundskeeper'].includes(p.action)))for(let t=0;t<240;t+=.5){
    const a=campusPose(p,t),b=campusPose(p,t+.001),turn=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
    assert(Math.abs(turn)<.01,'Instant direction reversal');
  }
});

test('claim beacon stays subtle, animates after batching, and its street-facing board is selectable',()=>{
  const {beacon}=village,{beam,board,rings}=beacon;
  assert.equal(beam.material.side,THREE.BackSide);assert.equal(beam.material.depthWrite,false);
  assert.equal(beam.material.blending,THREE.AdditiveBlending);assert(beam.geometry.parameters.openEnded);
  const pixels=beam.material.alphaMap.image.data;assert(pixels[1]>pixels[pixels.length-3]);
  village.world.updateMatrixWorld(true);const before=rings[0].matrixWorld.toArray();
  for(let t=0;t<6;t+=.1){village.animateEffects(t);assert(beam.material.opacity>=.10&&beam.material.opacity<=.19);}
  village.world.updateMatrixWorld(true);assert.notDeepEqual(rings[0].matrixWorld.toArray(),before);
  const front=new THREE.Vector3(0,0,1).transformDirection(board.matrixWorld),point=board.getWorldPosition(new THREE.Vector3());
  assert(front.x<-.99);const ray=new THREE.Raycaster(point.clone().addScaledVector(front,4),front.clone().negate());
  assert.equal(ray.intersectObjects(village.pickables,false)[0].object,board);assert.equal(board.userData.action,'register');
});
test('party windows restore their daylight materials and the largest house gets uplights',()=>{
  const {nightLife}=village;assert(nightLife.windows.size>=2);assert.equal(nightLife.uplights.length,2);
  const day=[...nightLife.windows.keys()].map(m=>[m.color.getHex(),m.emissive.getHex(),m.emissiveIntensity]);
  nightLife.setNight(true);assert(nightLife.root.visible);
  for(const m of nightLife.windows.keys())assert(m.emissiveIntensity>3);
  const biggest=village.anchors.find(a=>a.id===chapters.toSorted((a,b)=>b.joined-a.joined)[0].id);
  assert.equal(nightLife.uplights[0].parent.position.x,biggest.lot.x);assert.equal(nightLife.uplights[0].parent.position.z,biggest.lot.z);
  village.animateEffects(1);const before=nightLife.flames[0].scale.toArray();village.animateEffects(1.2);assert.notDeepEqual(nightLife.flames[0].scale.toArray(),before);
  nightLife.setNight(false);assert(!nightLife.root.visible);
  assert.deepEqual([...nightLife.windows.keys()].map(m=>[m.color.getHex(),m.emissive.getHex(),m.emissiveIntensity]),day);
});

test('chapter members have independent, bounded movement ranges and timing with planted feet',()=>{
  const people=village.members.filter(m=>!m.walking&&m.action!=='pong');
  assert.equal(new Set(people.map(m=>JSON.stringify(m.motionProfile))).size,people.length);
  const ranges=[],signatures=[];
  for(const person of people){
    const samples=Array.from({length:240},(_,i)=>humanPose(person,{walking:false},i*.4));
    const x=samples.map(p=>p.hip[0]),range=Math.max(...x)-Math.min(...x);ranges.push(range);
    assert(range>.02&&range<.09);assert(samples.every(p=>p.legs.every((l,i)=>l.ankle.every((v,j)=>v===samples[0].legs[i].ankle[j]))));
    signatures.push(samples.slice(0,20).map(p=>p.headYaw.toFixed(5)).join(','));
  }
  assert(Math.max(...ranges)-Math.min(...ranges)>.035);assert.equal(new Set(signatures).size,people.length);
  const walkers=village.members.filter(m=>m.walking);assert.equal(new Set(walkers.map(m=>m.motionProfile.walkSpeed)).size,walkers.length);
});

test('beer pong uses existing members and keeps players and bystanders clear of each table',async()=>{
  const {PONG_TABLE}=await import('../village-layout.js');
  assert.equal(village.pong.games.length,3);assert.equal(village.members.filter(m=>m.action==='pong').length,6);
  for(const game of village.pong.games){
    assert.equal(game.players.length,2);assert.equal(game.cups.length,12);
    assert(game.players.every(p=>village.members.includes(p)&&p.chapter===game.chapter));
    for(const member of village.members.filter(m=>m.chapter===game.chapter&&!m.walking)){
      const dx=member.x-member.lot.x,dz=member.z-member.lot.z,a=member.lot.rotation;
      const x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
      assert(Math.abs(x-PONG_TABLE.x)>PONG_TABLE.width/2+.2||Math.abs(z-PONG_TABLE.z)>PONG_TABLE.length/2+.2);
    }
  }
});

test('pong balls leave the throwing hand continuously, arc to cups and alternate players independently',async()=>{
  const {pongTurn,PONG_TABLE}=await import('../village-layout.js');
  const clocks=village.pong.games.map(g=>pongTurn(g.chapter,0).elapsed);assert.equal(new Set(clocks).size,clocks.length);
  for(const game of village.pong.games){
    const shot=pongTurn(game.chapter,20),releaseTime=20-shot.elapsed+shot.release,player=game.players[shot.seat];
    village.pong.animate(releaseTime-1e-5);const before=game.ball.position.clone();
    village.pong.animate(releaseTime);const start=game.ball.position.clone();assert(start.distanceTo(before)<.001);
    assert(start.distanceTo(village.pong.handPosition(player,releaseTime))<1e-8);
    village.pong.animate(releaseTime+shot.flight/2);const mid=game.ball.position.clone();
    village.pong.animate(releaseTime+shot.flight);const end=game.ball.position.clone();assert(mid.y>(start.y+end.y)/2+.8);
    assert(Math.abs(end.y-(PONG_TABLE.height+.19))<1e-8);
    assert(game.cups.some(cup=>{const p=cup.position.clone();p.y=PONG_TABLE.height+.19;p.applyAxisAngle(new THREE.Vector3(0,1,0),player.lot.rotation).add(new THREE.Vector3(player.lot.x,0,player.lot.z));return end.distanceTo(p)<1e-8;}));
    village.pong.animate(releaseTime+shot.flight+.2);assert(!game.ball.visible);
    assert.notEqual(pongTurn(game.chapter,releaseTime+6).seat,shot.seat);
    village.animateCrowd(releaseTime+.3);village.world.updateMatrixWorld(true);assert(game.ball.matrixAutoUpdate);assert(game.ball.matrixWorld.elements.every(Number.isFinite));
  }
});


test('every built house sets up a regulation die table with four players at its corners',async()=>{
  const {DIE_TABLE,dieSeat,dieSeatSpot,dieCup}=await import('../village-layout.js');
  // Eight by four feet, in metres.
  assert(Math.abs(DIE_TABLE.width-2.44)<.01&&Math.abs(DIE_TABLE.depth-1.22)<.01);
  assert.equal(village.die.games.length,3);assert.equal(village.members.filter(m=>m.action==='die').length,12);
  for(const game of village.die.games){
    assert.deepEqual(game.players.map(p=>p.seat),[0,1,2,3]);assert.equal(game.cups.length,4);
    assert(game.players.every(p=>village.members.includes(p)&&p.chapter===game.chapter&&p.ground<.3));
    // Partners share an end; opponents are down the long axis.
    assert.equal(dieSeat(0).side,dieSeat(1).side);assert.equal(dieSeat(2).side,-dieSeat(0).side);
    for(const [seat,player] of game.players.entries()){
      const spot=dieSeatSpot(seat),cup=dieCup(seat),front=toWorld(player.lot,spot.x,spot.z);
      assert(Math.hypot(front.x-player.x,front.z-player.z)<1e-9);
      assert(Math.abs(Math.abs(spot.x-DIE_TABLE.x)-DIE_TABLE.playerDistance)<1e-9);
      // A cup eight inches from the back rail and five in from the side.
      assert(Math.abs(Math.abs(cup.x-DIE_TABLE.x)-(DIE_TABLE.width/2-.2))<1e-9);
      assert(Math.abs(Math.abs(cup.z-DIE_TABLE.z)-(DIE_TABLE.depth/2-.13))<1e-9);
      assert.equal(Math.sign(cup.x-DIE_TABLE.x),dieSeat(seat).side);
      assert.equal(Math.sign(cup.z-DIE_TABLE.z),Math.sign(dieSeat(seat).dz));
      // Each player looks down the table at the pair opposite.
      const facing=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),spot.rotation);
      assert(facing.x*-dieSeat(seat).side>.99);
    }
    for(const member of village.members.filter(m=>m.chapter===game.chapter&&!m.walking&&m.action!=='die')){
      const dx=member.x-member.lot.x,dz=member.z-member.lot.z,a=member.lot.rotation;
      const x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
      assert(Math.abs(x-DIE_TABLE.x)>DIE_TABLE.width/2+.2||Math.abs(z-DIE_TABLE.z)>DIE_TABLE.depth/2+.2);
    }
  }
});

test('the die is lofted over head height, lands past the half line, then sinks or is caught',async()=>{
  const {dieTurn,dieSeat,dieCup,DIE_TABLE,lawnGround}=await import('../village-layout.js');
  const surface=lawnGround(DIE_TABLE.x,DIE_TABLE.z)+DIE_TABLE.height+.075;
  const clocks=village.die.games.map(g=>dieTurn(g.chapter,0).elapsed);assert.equal(new Set(clocks).size,clocks.length);
  const outcomes=new Set();
  for(const game of village.die.games)for(const turn of [0,1,2,3,4,5,6,7]){
    const shot=dieTurn(game.chapter,20+turn*7),releaseTime=20+turn*7-shot.elapsed+shot.release;
    const thrower=game.players[shot.seat],defender=game.players[shot.target];
    assert.equal(dieSeat(shot.target).side,-dieSeat(shot.seat).side);
    outcomes.add(shot.sink);
    village.die.animate(releaseTime-1e-5);const before=game.die.position.clone();
    village.die.animate(releaseTime);const start=game.die.position.clone();assert(start.distanceTo(before)<.001);
    assert(start.distanceTo(village.die.handPosition(thrower,releaseTime))<1e-8);
    // The throw has to clear the eight-foot line before it comes down.
    let apex=0;for(let s=0;s<=20;s++){village.die.animate(releaseTime+shot.toss*s/20);apex=Math.max(apex,game.die.position.y);}
    assert(apex>2.44,`die only reached ${apex.toFixed(2)}m`);
    village.die.animate(releaseTime+shot.toss);const land=game.die.position.clone();
    assert(Math.abs(land.y-surface)<1e-8);
    const rel=land.clone().sub(new THREE.Vector3(DIE_TABLE.x,0,DIE_TABLE.z).applyAxisAngle(new THREE.Vector3(0,1,0),thrower.lot.rotation).add(new THREE.Vector3(thrower.lot.x,0,thrower.lot.z))).applyAxisAngle(new THREE.Vector3(0,1,0),-thrower.lot.rotation);
    assert(Math.abs(rel.x)<DIE_TABLE.width/2&&Math.abs(rel.z)<DIE_TABLE.depth/2);
    assert.equal(Math.sign(rel.x),-dieSeat(shot.seat).side,'the die must land past the half line');
    village.die.animate(releaseTime+shot.toss+shot.settle-1e-6);const end=game.die.position.clone();
    if(shot.sink){
      const cup=dieCup(shot.target);
      const world=new THREE.Vector3(cup.x,0,cup.z).applyAxisAngle(new THREE.Vector3(0,1,0),thrower.lot.rotation).add(new THREE.Vector3(thrower.lot.x,0,thrower.lot.z));
      assert(Math.hypot(end.x-world.x,end.z-world.z)<.02,'a sunk die ends in the cup it was aimed at');
    }else{
      // Otherwise the defender takes it one-handed, and their arm is up for it.
      const hand=village.die.handPosition(defender,releaseTime+shot.toss+shot.settle);
      assert(end.distanceTo(hand)<.05,'a live die ends in the defending hand');
      const reach=activityPose(defender,releaseTime+shot.toss+shot.settle-.1).pong;
      assert(reach.lift>.6,`defender reaches ${reach.lift.toFixed(2)}`);
    }
    village.die.animate(releaseTime+shot.toss+shot.settle+.05);assert(!game.die.visible);
  }
  assert.equal(outcomes.size,2,'houses both sink and lose the die across turns');
  for(const game of village.die.games){
    const seats=new Map();for(let t=20;seats.size<4;t+=.2){const next=dieTurn(game.chapter,t);if(!seats.has(next.turn))seats.set(next.turn,next.seat);}
    const order=[...seats.entries()].toSorted((a,b)=>a[0]-b[0]).map(([,seat])=>seat);
    assert.deepEqual(order.toSorted(),[0,1,2,3]);assert(order.every((seat,i)=>!i||seat===(order[i-1]+1)%4));
    village.animateCrowd(37.4);village.world.updateMatrixWorld(true);
    assert([...village.die.dice.instanceMatrix.array].every(Number.isFinite));
  }
});

test('fomo eyes banner hangs from both building walls with no ground supports',()=>{
  for(const count of [5,9]){
    const data=Array.from({length:count},(_,i)=>({...chapters[i%chapters.length],id:`entry-${i}`}));
    const scene=createVillage(THREE,data),entrance=scene.world.getObjectByName('fomo-row-entrance');
    assert.equal(entrance.position.z,114+scene.extension);
    assert.equal(entrance.position.x,2.75);
    const brackets=[];entrance.traverse(o=>{if(o.name==='building-banner-anchor')brackets.push(o);});
    assert.equal(brackets.length,4);
    assert.deepEqual([...new Set(brackets.map(o=>o.position.x+entrance.position.x))].sort((a,b)=>a-b),[-6,11.5]);
    const bounds=new THREE.Box3().setFromObject(entrance);assert(bounds.min.y>6,'No poles or other ground supports');
    const front=entrance.getObjectByName('fomo-eyes-banner-front');
    front.geometry.computeBoundingBox();
    assert(front.geometry.boundingBox.min.y+front.position.y>6,'Fabric must clear vehicles and sightlines');
    assert(Math.abs(front.rotation.y-Math.PI)<1e-9,'Eyes must face the opening camera');
    assert(entrance.getObjectByName('fomo-eyes-banner-back'));
    scene.dispose();
  }
});
