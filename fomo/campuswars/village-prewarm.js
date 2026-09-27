import {MONEY_START} from './village-money-rain.js?v=111';
import {INTRO_PREWARM_TIMES,aimIntroCamera} from './village-intro.js?v=70';

// Compile and upload everything the intro flight will draw while the loading
// cover is still up, so the flight itself links no shaders and uploads nothing.
// A dusk spotlight and the bonfire raise the scene's light count, which is part
// of every program's cache key: reaching dusk mid-flight without a warm night
// variant relinks the whole village in one frame. Both variants are warmed here.
// Use the real canvas so output and tone-mapping variants match playback, and
// fly the warm-up camera down the real route so the route's own draws — the
// aerial opening, the boulevard, the money over the roofs, the resting view —
// upload their textures and instance buffers now. A one-pixel scissor keeps the
// fragment cost of those passes at nothing.
export async function prewarmVillage(T,renderer,scene,camera,applyLighting,moneyRain,{mobile=false,variantRoots=[]}={}){
  const scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest();
  const home={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
  const compileMaterials=[];
  const lodVisibility=new Map();
  scene.traverse(object=>{if(object.name==='distant-chapter-members'){lodVisibility.set(object,object.visible);object.visible=true;}});
  // Upload scenery along the actual intro route on every device. Distant
  // blocks keep their normal culling instead of filling GPU memory at startup.
  renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
  try{
    // Each light count has independent material bookkeeping, so the driver
    // can compile all programs concurrently instead of waiting four times.
    // Keep their programs alive until the real materials have adopted them.
    const compileJobs=[];
    const queueCompile=()=>{
      const copies=new Map(),originals=[];
      const copy=material=>{
        if(!copies.has(material)){
          const clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;clone.customProgramCacheKey=material.customProgramCacheKey;
          copies.set(material,clone);compileMaterials.push(clone);
        }
        return copies.get(material);
      };
      try{
        scene.traverse(object=>{if(object.material){originals.push([object,object.material]);object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);}});
        // compileAsync collects and submits materials synchronously; only its
        // readiness polling is asynchronous. It must retain its own copies.
        compileJobs.push(Promise.resolve(renderer.compileAsync(scene,camera)));
      }finally{for(const [object,material] of originals)object.material=material;}
    };
    try{
      for(const night of [1,0]){
        applyLighting(night);moneyRain.update(MONEY_START+1,night);queueCompile();
        if(variantRoots.length){
          const visibility=variantRoots.map(root=>root.visible);
          try{variantRoots.forEach(root=>root.visible=false);queueCompile();}
          finally{variantRoots.forEach((root,i)=>root.visible=visibility[i]);}
        }
      }
    }catch(error){await Promise.allSettled(compileJobs);throw error;}
    const compileResults=await Promise.allSettled(compileJobs),compileFailure=compileResults.find(result=>result.status==='rejected');
    if(compileFailure)throw compileFailure.reason;
    for(const night of [1,0]){
      applyLighting(night);moneyRain.update(MONEY_START+1,night);
      await renderer.compileAsync(scene,camera);
      // Compilation alone does not upload textures, instance buffers, or
      // prepare shadow and double-sided transparent draw variants.
      // One shadow pass per lighting variant warms its depth programs; the
      // map itself does not move during the flight.
      renderer.shadowMap.needsUpdate=true;
      for(const seconds of INTRO_PREWARM_TIMES){
        aimIntroCamera(camera,seconds);
        renderer.render(scene,camera);
        if(mobile)await new Promise(resolve=>setTimeout(resolve,0));
      }
      // Optional districts remove their lights from the scene when offscreen.
      // Compile that light-count variant too, before the first camera move.
      if(variantRoots.length){
        const visibility=variantRoots.map(root=>root.visible);
        try{variantRoots.forEach(root=>root.visible=false);await renderer.compileAsync(scene,camera);}
        finally{variantRoots.forEach((root,i)=>root.visible=visibility[i]);}
      }
    }
  }finally{
    for(const material of compileMaterials)material.dispose();
    applyLighting(0);moneyRain.clear();
    for(const [object,visible] of lodVisibility)object.visible=visible;
    camera.position.copy(home.position);camera.quaternion.copy(home.quaternion);
    camera.fov=home.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
    renderer.shadowMap.needsUpdate=true;
  }
  // Every pass above drew into a single pixel, so the canvas is still blank.
  // Paint the opening frame in full before the caller lifts the loading cover,
  // or the cover comes off an empty canvas for the frame before the first tick.
  renderer.render(scene,camera);
}
