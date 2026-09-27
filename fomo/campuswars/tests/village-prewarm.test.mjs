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
const sequence=()=>[['compile',1],['compile',0],['compile',1],...INTRO_PREWARM_TIMES.map(()=>['render',1]),['compile',0],...INTRO_PREWARM_TIMES.map(()=>['render',0]),['present',0]];

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

function parallelHarness({reject=false,throwAt=0}={}){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture();
  const material=new THREE.MeshStandardMaterial({map:texture}),customUniform={value:1};
  material.onBeforeCompile=shader=>{shader.uniforms.test=customUniform;};material.customProgramCacheKey=()=> 'village-test-shader';
  const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material),multi=new THREE.Mesh(geometry,[material,material]);
  const district=new THREE.Group();district.add(new THREE.PointLight());scene.add(a,b,multi,district);
  const references=[a.material,b.material,multi.material],snapshots=[],pending=[],disposed=new Set(),draws=[];
  const cloneMaterial=material.clone;material.clone=function(){const clone=cloneMaterial.call(this);clone.addEventListener('dispose',()=>disposed.add(clone));return clone;};
  let night=0,call=0,textureDisposed=false,geometryDisposed=false;
  texture.addEventListener('dispose',()=>{textureDisposed=true;});geometry.addEventListener('dispose',()=>{geometryDisposed=true;});
  const renderer={
    shadowMap:{needsUpdate:false},getScissor:t=>t,getScissorTest:()=>false,setScissor(){},setScissorTest(){},
    compileAsync(){
      call++;
      const clone=a.material;
      if(throwAt===call)throw new Error('synchronous compilation failure');
      if(clone!==material){
        assert.equal(b.material,clone);assert.deepEqual(multi.material,[clone,clone]);
        assert.equal(clone.map,texture);assert.equal(clone.onBeforeCompile,material.onBeforeCompile);assert.equal(clone.customProgramCacheKey,material.customProgramCacheKey);
        snapshots.push({night,district:district.visible,material:clone});
        return new Promise((resolve,rejectJob)=>pending.push(()=>reject&&pending.length===4?rejectJob(new Error('asynchronous compilation failure')):resolve()));
      }
      assert.equal(disposed.size,0,'temporary programs were released before real materials adopted them');
      return Promise.resolve();
    },
    render(){assert.equal(a.material,material);draws.push({night,district:district.visible});}
  };
  return {scene,snapshots,pending,disposed,draws,
    run:()=>prewarmVillage(THREE,renderer,scene,camera,value=>{night=value;},{update(){},clear(){}},{variantRoots:[district]}),
    assertRestored({finished=true}={}){assert.equal(a.material,references[0]);assert.equal(b.material,references[1]);assert.equal(multi.material,references[2]);assert.equal(district.visible,true);if(finished)assert.equal(night,0);assert(!textureDisposed);assert(!geometryDisposed);}
  };
}

test('all lighting and district shader jobs start before waiting, with independent material state',async()=>{
  const h=parallelHarness(),finished=h.run();
  assert.deepEqual(h.snapshots.map(({night,district})=>[night,district]),[[1,true],[1,false],[0,true],[0,false]]);
  assert.equal(new Set(h.snapshots.map(entry=>entry.material)).size,4);
  // The scene is already restored while GPU compilation is still pending.
  h.assertRestored();assert.equal(h.draws.length,0);assert.equal(h.disposed.size,0);
  for(const resolve of h.pending)resolve();await finished;
  assert.equal(h.disposed.size,4);assert(h.draws.length>0);h.assertRestored();
});

test('asynchronous shader failure waits for every job and releases only temporary materials',async()=>{
  const h=parallelHarness({reject:true}),finished=h.run();
  h.pending[0]();await Promise.resolve();assert.equal(h.disposed.size,0);
  for(const settle of h.pending.slice(1))settle();
  await assert.rejects(finished,/asynchronous compilation failure/);
  assert.equal(h.disposed.size,4);assert.equal(h.draws.length,0);h.assertRestored();
});

test('synchronous shader failure restores scene references while earlier jobs finish',async()=>{
  const h=parallelHarness({throwAt:2}),finished=h.run();
  assert.equal(h.pending.length,1);h.assertRestored({finished:false});assert.equal(h.disposed.size,0);
  h.pending[0]();await assert.rejects(finished,/synchronous compilation failure/);
  assert.equal(h.disposed.size,2);assert.equal(h.draws.length,0);h.assertRestored();
});
