import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createStadium,STADIUM_SITE} from '../village-stadium.js';
import {createDistricts} from '../village-districts.js';
import {footballState,footballPlayer,footballBall} from '../village-football.js';

test('stadium sits beyond a full athletics block and its reserved site survives streaming and growth',()=>{
  assert(STADIUM_SITE.z-STADIUM_SITE.depth/2>150);
  for(const extension of [0,133]){
    const d=createDistricts(T,extension,5);
    try{
      const stadium=d.stadium;
      assert.equal(stadium.root.position.z,200+extension);
      d.update(0,200+extension);const site=d.chunks.get('0,2');
      assert.equal(site.kind,'stadium');assert.deepEqual(site.specs,[]);assert.equal(site.people.length,0);
      d.setNight(true);d.animate(19);assert(stadium.night);assert.equal(stadium.crowdUniforms.stadiumRoar.value,1);
      d.update(500,500);d.update(0,200+extension);assert.equal(d.stadium,stadium);assert(stadium.night);
      d.setNight(false);assert.equal(stadium.night,false);
    }finally{d.dispose();}
  }
});
test('passes, catches and alternating possessions stay continuous and inside the playing surface',()=>{
  for(let time=0;time<128;time+=.037){
    for(let i=0;i<22;i++){
      const a=footballPlayer(i,time),b=footballPlayer(i,time+.001);
      assert(Math.abs(a.x)<13.33&&Math.abs(a.z)<=30,'Every player remains on the field');
      assert(Math.hypot(a.x-b.x,a.z-b.z)<.03,'Players do not teleport between plays');
    }
    const a=footballBall(time),b=footballBall(time+.001);
    assert(Object.values(a).every(Number.isFinite));assert(a.y>=.349&&a.y<7.2);
    assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.03,'Snap, pass, catch and reset are continuous');
  }
  for(const t of [11,19,23,43,51]){
    const ball=footballBall(t),receiver=footballPlayer(8,t);assert(Math.hypot(ball.x-receiver.x,ball.z-receiver.z)<1e-9);
  }
  assert.equal(footballState(19).home,21);assert.equal(footballState(32).home,21);
  assert.equal(footballState(51).away,14);assert.equal(footballState(64).away,14);
});
test('thousands of cheering fans use one static instance buffer, with a fixed stadium graphics budget',()=>{
  const s=createStadium(T);
  try{
    assert(s.fanCount>2500);let draws=0,instances=0,triangles=0;
    s.root.traverse(o=>{if(o.isMesh){draws++;instances+=o.isInstancedMesh?o.count:0;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
    assert(draws<=40);assert(instances<7000);assert(triangles<850000);
    const fans=s.fanMesh.instanceMatrix.array.slice(),version=s.fanMesh.instanceMatrix.version;
    s.animate(9);const players=s.playerParts.instanceMatrix.array.slice();s.animate(19);
    assert.equal(s.fanMesh.instanceMatrix.version,version);assert.deepEqual(s.fanMesh.instanceMatrix.array,fans);
    assert.notDeepEqual(s.playerParts.instanceMatrix.array,players);assert.equal(s.crowdUniforms.stadiumTime.value,19);
    const playerVersion=s.playerParts.instanceMatrix.version;s.animate(19);assert.equal(s.playerParts.instanceMatrix.version,playerVersion);
    s.root.traverse(o=>{if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite));});
  }finally{s.dispose();}
});
test('offscreen games catch up exactly when visible, including a paused camera move',()=>{
  const d=createDistricts(T),camera=new T.PerspectiveCamera(48,16/9,1,650);
  try{
    camera.position.set(0,8,38);camera.lookAt(0,2,-80);camera.updateMatrixWorld();
    d.animate(19,0,0,camera);assert.equal(d.stadium.crowdUniforms.stadiumTime.value,0);
    camera.position.set(0,35,135);camera.lookAt(0,2,200);camera.updateMatrixWorld();
    d.animate(19,0,200,camera);assert.equal(d.stadium.crowdUniforms.stadiumTime.value,19);
    assert.equal(d.stadium.crowdUniforms.stadiumRoar.value,1);
    const version=d.stadium.playerParts.instanceMatrix.version;d.animate(19,0,200,camera);assert.equal(d.stadium.playerParts.instanceMatrix.version,version);
  }finally{d.dispose();}
});
