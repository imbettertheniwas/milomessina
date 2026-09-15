import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createPedestrianSpacing,pedestrianGroup,sweptDistanceSquared} from '../village-pedestrian-spacing.js';
import {createVillage} from '../village-world.js';
import {createDistricts} from '../village-districts.js';

const person=(id,extra={})=>({identity:id,height:1,build:1,phase:0,walking:true,speed:1,...extra});
function check(agents,previous=null){
  const grid=new Map();
  for(const a of agents){
    if(a.hidden)continue;
    const x=Math.floor(a.x/2),z=Math.floor(a.z/2);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const b of grid.get(`${x+dx},${z+dz}`)||[]){
      if(a.ground>=b.ground+b.height||b.ground>=a.ground+a.height)continue;
      const limit=(a.radius+b.radius)**2;
      assert((a.x-b.x)**2+(a.z-b.z)**2>=limit-1e-8,`${a.id} overlaps ${b.id}`);
      if(previous&&previous.has(a.id)&&previous.has(b.id)){
        const old=previous.get(a.id),other=previous.get(b.id);
        assert(sweptDistanceSquared(old.x,old.z,a.x,a.z,other.x,other.z,b.x,b.z)>=limit-1e-8,`${a.id} crossed through ${b.id}`);
      }
    }
    const k=`${x},${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(a);
  }
}
for(const [name,paths] of [
  ['head-on',[(t)=>[-4+t,0],(t)=>[4-t,0]]],
  ['crossing',[(t)=>[-4+t,0],(t)=>[0,-4+t]]],
  ['overtaking',[(t)=>[-4+t*1.7,0],(t)=>[-2+t*.6,0]]],
])test(`${name} walkers pass without touching, including between frames`,()=>{
  const people=paths.map((_,i)=>person(String(i),{speed:2})),group=pedestrianGroup(name,people,(p,t,i)=>({x:paths[i](t)[0],z:paths[i](t)[1],walking:true,motion:1,gait:t,angle:0})),spacing=createPedestrianSpacing();
  let previous=null;
  for(let frame=0;frame<=600;frame++){
    spacing.update(frame/60,[group]);check(spacing.agents,previous);previous=new Map(spacing.agents.map(a=>[a.id,{x:a.x,z:a.z}]));
  }
  assert(spacing.agents.some(a=>a.x>1||a.z>1),'People must continue their journeys rather than remain blocked');
});

test('crowded starting points get distinct positions; stationary friends stay put and paused updates reuse poses',()=>{
  const people=Array.from({length:40},(_,i)=>person(String(i),{walking:false})),group=pedestrianGroup('friends',people,()=>({x:0,z:0,walking:false,angle:0})),spacing=createPedestrianSpacing();
  const start=spacing.update(0,[group]);check(spacing.agents);
  const positions=spacing.agents.map(a=>[a.x,a.z]);spacing.update(.1,[group]);assert.deepEqual(spacing.agents.map(a=>[a.x,a.z]),positions);
  const paused=spacing.update(.1,[group]);assert.equal(spacing.update(.1,[group]),paused);
  const fresh=createPedestrianSpacing();assert.deepEqual(fresh.update(0,[group]),start);
});

test('people on separate levels and hidden visitors do not occupy each other’s paths; night changes refresh paused poses',()=>{
  let hidden=true;const people=[person('a',{walking:false}),person('b',{walking:false}),person('c',{walking:false})];
  const group=pedestrianGroup('levels',people,(p)=>({x:0,z:0,ground:p.identity==='b'?3:0,hidden:p.identity==='c'&&hidden,walking:false})),spacing=createPedestrianSpacing();
  spacing.update(0,[group]);assert.equal(spacing.agents[0].x,spacing.agents[1].x);check(spacing.agents);
  hidden=false;group.revision=1;spacing.update(0,[group]);check(spacing.agents);assert(spacing.agents.every(a=>!a.hidden));
});

test('chapter lawns and campus sidewalks share collision space and render the resolved positions at both detail levels',()=>{
  const chapters=[{id:'sigma-chi-sdsu',name:'Sigma Chi',letters:'ΣΧ',school:'San Diego State University',joined:60,active:100},{id:'kappa-sigma-coastal',name:'Kappa Sigma',letters:'ΚΣ',school:'Coastal Carolina University',joined:200,active:250}];
  const village=createVillage(T,chapters,{compactCrowd:true}),districts=createDistricts(T),spacing=createPedestrianSpacing(),groups=[...village.pedestrians,...districts.pedestrians];
  try{
    for(const time of [0,10,23,60,180,500]){
      let poses=spacing.update(time,groups);check(spacing.agents);
      for(let step=1;step<=12;step++){poses=spacing.update(time+step/30,groups);check(spacing.agents);}
      village.animateCrowd(time+.4,null,poses);districts.animate(time+.4,0,0,null,poses);
      const p=poses.get(village.pedestrians[0])[0],matrix=new T.Matrix4();village.parts.pelvis.getMatrixAt(0,matrix);
      assert(Math.hypot(matrix.elements[12]-p.x,matrix.elements[14]-p.z)<.1,'Rendered bodies use collision-adjusted positions');
      for(const a of spacing.agents)assert(a.group.allowed(a.x-a.group.offsetX,a.z-a.group.offsetZ,a.pose,a.person),'Avoidance must keep people outside buildings');
    }
    const far=new T.PerspectiveCamera(48,2,1,1000);far.position.set(0,180,220);far.lookAt(0,2,0);far.updateMatrixWorld();
    const poses=spacing.update(500.4,groups),expected=poses.get(village.pedestrians[0]);village.animateCrowd(500.4,far,poses);
    assert.equal(village.distantCrowd.mesh.count,village.members.length);
    for(let i=0;i<expected.length;i++){const matrix=new T.Matrix4();village.distantCrowd.mesh.getMatrixAt(i,matrix);assert(Math.abs(matrix.elements[12]-expected[i].x)<1e-5);assert(Math.abs(matrix.elements[14]-expected[i].z)<1e-5);}
  }finally{village.dispose();districts.dispose();}
});

test('streaming neighbours and changing night activity preserve existing walkers’ progress',()=>{
  const people=[person('a'),person('b')],group=pedestrianGroup('street',people,(p,t)=>({x:p.identity==='a'?-2+t:2-t,z:0,walking:true,angle:0})),spacing=createPedestrianSpacing();
  for(let i=0;i<=240;i++)spacing.update(i/60,[group]);
  const before=spacing.agents.map(a=>({id:a.id,x:a.x,z:a.z,delay:a.delay}));
  const next=pedestrianGroup('neighbour',[person('c',{walking:false})],()=>({x:0,z:8,walking:false}));
  spacing.update(4,[group,next]);check(spacing.agents);
  for(const previous of before){const a=spacing.agents.find(a=>a.id===previous.id);assert.equal(a.x,previous.x);assert.equal(a.z,previous.z);assert.equal(a.delay,previous.delay);}
  group.revision=1;spacing.update(4,[group,next]);check(spacing.agents);
  for(const previous of before){const a=spacing.agents.find(a=>a.id===previous.id);assert.equal(a.x,previous.x);assert.equal(a.z,previous.z);}
});

test('a walker waits with planted feet when a narrow path is occupied, then resumes when it clears',()=>{
  const walker=person('walker'),friend=person('friend',{walking:false}),path=pedestrianGroup('path',[walker],(p,t)=>({x:-4+t,z:0,walking:true,angle:Math.PI/2}),{allowed:(x,z)=>Math.abs(z)<.001});
  const obstacle=pedestrianGroup('obstacle',[friend],()=>({x:0,z:0,walking:false})),spacing=createPedestrianSpacing();
  let poses;
  for(let i=0;i<=360;i++){poses=spacing.update(i/60,[path,obstacle]);check(spacing.agents);}
  const waiting=poses.get(path)[0];assert.equal(waiting.walking,false);assert.equal(waiting.motion,0);assert(waiting.x<-.8);
  for(let i=361;i<=540;i++)poses=spacing.update(i/60,[path]);
  assert(poses.get(path)[0].x>waiting.x+1,'Removing the obstruction lets the walker carry on');
});
