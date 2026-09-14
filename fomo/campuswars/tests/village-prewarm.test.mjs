import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {prewarmVillage} from '../village-prewarm.js';
import {INTRO_DURATION,INTRO_PREWARM_TIMES,aimIntroCamera,introViewAt} from '../village-intro.js';

function harness({fail=false,mobile=false}={}){
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  const effects=new THREE.Group();effects.visible=false;scene.add(mesh,effects);
  const originalScissor=new THREE.Vector4(4,8,640,480),scissor=originalScissor.clone(),calls=[],aimed=[];
  const camera=new THREE.PerspectiveCamera(48,1.5,1,650);camera.position.set(3,7,11);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const home={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
  let scissorTest=false,lighting=0;
  const renderer={
    shadowMap:{needsUpdate:false},
    getScissor:target=>target.copy(scissor),getScissorTest:()=>scissorTest,
    setScissor(x,y,z,w){if(x.isVector4)scissor.copy(x);else scissor.set(x,y,z,w);},setScissorTest:value=>{scissorTest=value;},
    async compileAsync(){calls.push(['compile',lighting]);assert(effects.visible);if(fail)throw new Error('context lost');},
    render(){calls.push([scissorTest?'render':'present',lighting]);aimed.push(camera.position.clone());if(scissorTest)assert.deepEqual(scissor.toArray(),[0,0,1,1]);}
  };
  const applyLighting=night=>{lighting=night;},moneyRain={update(){effects.visible=true;},clear(){effects.visible=false;}};
  return {calls,aimed,camera,
    run:()=>prewarmVillage(THREE,renderer,scene,camera,applyLighting,moneyRain,{mobile}),
    assertRestored(){
      assert.equal(lighting,0);assert.equal(effects.visible,false);assert.equal(mesh.frustumCulled,true);
      assert.deepEqual(scissor,originalScissor);assert.equal(scissorTest,false);assert(renderer.shadowMap.needsUpdate);
      // The flight must start from the view the page had framed, not wherever
      // the warm-up left the lens.
      assert.deepEqual(camera.position.toArray(),home.position.toArray());
      assert.deepEqual(camera.quaternion.toArray(),home.quaternion.toArray());
      assert.equal(camera.fov,home.fov);
    }};
}

// Each variant compiles, then flies the route a pixel at a time; the last draw
// is the full-canvas opening frame the loading cover lifts off.
const sequence=()=>[['compile',1],...INTRO_PREWARM_TIMES.map(()=>['render',1]),['compile',0],...INTRO_PREWARM_TIMES.map(()=>['render',0]),['present',0]];

test('both lighting variants compile and fly the whole route before playback state is restored',async()=>{
  const h=harness();await h.run();
  assert.deepEqual(h.calls,sequence());h.assertRestored();
});

test('the warm-up flies the real route, so it draws what the flight will draw',async()=>{
  const h=harness();await h.run();
  const probe=new THREE.PerspectiveCamera();
  const route=INTRO_PREWARM_TIMES.map(seconds=>{aimIntroCamera(probe,seconds);return probe.position.clone();});
  // Each lighting variant walks the same route, in order.
  for(const pass of [0,1])route.forEach((position,i)=>{
    const drawn=h.aimed[pass*route.length+i];
    assert(drawn.distanceTo(position)<1e-9,`warm-up frame ${i} stood at ${drawn.toArray()} instead of ${position.toArray()}`);
  });
});

test('failed warmup still restores lighting, effects, culling, the canvas and the lens',async()=>{
  const h=harness({fail:true});await assert.rejects(h.run(),/context lost/);h.assertRestored();
});

test('phones warm the dusk variant too, so reaching dusk mid-flight relinks nothing',async()=>{
  const h=harness({mobile:true});await h.run();
  assert.deepEqual(h.calls,sequence());h.assertRestored();
});

test('phones keep frustum culling, so warming never uploads the entire world at once',async()=>{
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);
  const seen=[];
  const renderer={
    shadowMap:{needsUpdate:false},getScissor:t=>t,getScissorTest:()=>false,setScissor(){},setScissorTest(){},
    async compileAsync(){seen.push(mesh.frustumCulled);},render(){seen.push(mesh.frustumCulled);}
  };
  await prewarmVillage(THREE,renderer,scene,new THREE.PerspectiveCamera(),()=>{},{update(){},clear(){}},{mobile:true});
  assert(seen.length>0);
  assert(seen.every(Boolean),'a phone dropped frustum culling during warm-up');
});

test('the loading cover lifts off a painted opening frame, not a blank canvas',async()=>{
  const h=harness();await h.run();
  assert.deepEqual(h.calls.at(-1),['present',0],'the warm-up never painted the full canvas');
  // Painted from where the page had framed the opening shot.
  assert.deepEqual(h.aimed.at(-1).toArray(),h.camera.position.toArray());
});

test('a failed warm-up paints nothing and leaves the cover to the caller',async()=>{
  const h=harness({fail:true});await assert.rejects(h.run(),/context lost/);
  assert(!h.calls.some(([kind])=>kind==='present'));
});

test('desktop warm-up also keeps offscreen scenery out of texture uploads',async()=>{
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);
  const seen=[];
  const renderer={
    shadowMap:{needsUpdate:false},getScissor:t=>t,getScissorTest:()=>false,setScissor(){},setScissorTest(){},
    async compileAsync(){seen.push(mesh.frustumCulled);},render(){seen.push(mesh.frustumCulled);}
  };
  await prewarmVillage(THREE,renderer,scene,new THREE.PerspectiveCamera(),()=>{},{update(){},clear(){}});
  assert(seen.every(Boolean),'desktop warm-up uploaded offscreen scenery');
  // The opening frame is a playback frame, so it culls the way playback does.
  assert.equal(seen.at(-1),true);
  assert.equal(mesh.frustumCulled,true);
});

test('the warm-up route covers the flight from its first frame to its last',()=>{
  assert.equal(INTRO_PREWARM_TIMES[0],0);
  assert.equal(INTRO_PREWARM_TIMES.at(-1),INTRO_DURATION);
  for(let i=1;i<INTRO_PREWARM_TIMES.length;i++)assert(INTRO_PREWARM_TIMES[i]>INTRO_PREWARM_TIMES[i-1]);
  // No stretch of the flight goes unwarmed for long enough to bring a whole
  // new block of scenery into frame unannounced.
  for(let i=1;i<INTRO_PREWARM_TIMES.length;i++)assert(INTRO_PREWARM_TIMES[i]-INTRO_PREWARM_TIMES[i-1]<=2,'a gap in the warm-up route');
});

test('the warm-up lens matches the flight lens at every sampled beat',()=>{
  const camera=new THREE.PerspectiveCamera();
  for(const seconds of INTRO_PREWARM_TIMES){
    const view=aimIntroCamera(camera,seconds),expected=introViewAt(seconds);
    assert.equal(camera.fov,expected.fov);
    assert.deepEqual(view.target,expected.target);
    const radius=camera.position.distanceTo(new THREE.Vector3(...expected.target));
    assert(Math.abs(radius-expected.radius)<1e-6,`radius ${radius} did not match ${expected.radius}`);
  }
});
