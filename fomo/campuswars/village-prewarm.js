// Prepare only the lighting and camera view that will actually be presented.
// Warming every intro camera in both day and night used to render the campus
// eighteen times and compile four copies of every material behind the loader.
// Playback now keeps the scheduled lighting, so those other variants are not
// part of startup. Three.js caches programs as additional scenery comes into view.
export async function prewarmVillage(renderer,scene,camera){
  await renderer.compileAsync(scene,camera);
  if(renderer.getContext?.().isContextLost())return false;
  renderer.shadowMap.needsUpdate=true;
  // Present a real, full-resolution frame before lifting the loading cover.
  renderer.render(scene,camera);
  return true;
}
