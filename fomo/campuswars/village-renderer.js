import {villageQuality} from './village-quality.js?v=97';
import {createVillage,buildVillageSteps} from './village-world.js?v=111';
import {houseStandings} from './village-competition.js?v=111';
import {rankedHouseSizes} from './village-house-sizing.js?v=111';
import {assignHouseFinishes} from './village-house-colors.js?v=87';
import {createLots,rowExtension,streetCount} from './village-layout.js?v=105';
import {unoccludedHouses} from './village-occlusion.js?v=87';

export const STREAMING_THRESHOLD=80;
export function villageRenderLayout(T,input,previousFinishes){
  const ranked=houseStandings(input),rankedIds=new Set(ranked.map(c=>c.id));
  const chapters=[...ranked,...input.filter(c=>!rankedIds.has(c.id)).sort((a,b)=>a.id.localeCompare(b.id))];
  const lots=createLots(chapters.length).map((lot,sourceIndex)=>({...lot,sourceIndex}));
  const houseSizes=rankedHouseSizes(chapters),houseFinishes=assignHouseFinishes(chapters,previousFinishes);
  const anchors=lots.map((lot,index)=>{
    const chapter=chapters[index],size=chapter&&houseSizes.get(chapter.id),finished=chapter?.joined>=15;
    return {id:chapter?.id||'empty',lot,point:new T.Vector3(lot.x,chapter?(finished?size.roofline+1:6):4,lot.z),...(finished?{house:{halfWidth:size.footprint/2,front:size.offsetZ+7.5*size.depthScale/2}}:{})};
  });
  return {chapters,lots,houseSizes,houseFinishes,anchors,extension:rowExtension(chapters.length),streetTotal:streetCount(chapters.length)};
}
export function visibleHouseIndices(T,layout,camera,margin=0){
  const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const bounds=new T.Sphere(new T.Vector3(),24+margin),indices=new Set();
  layout.lots.forEach((lot,i)=>{bounds.center.set(lot.x,7,lot.z);if(frustum.intersectsSphere(bounds))indices.add(i);});
  return unoccludedHouses(T,layout,camera,indices);
}
function startingIndices(T,layout,options){
  if(options.camera)return visibleHouseIndices(T,layout,options.camera,24);
  // Cover the actual intro flight as well as the resting view before lifting
  // the loading cover. No school artwork for houses outside the camera is created.
  const indices=new Set(),camera=new T.PerspectiveCamera(66,options.aspect||16/9,1,650);
  for(const [x,y,z,tx,ty,tz] of [[0,104,104,0,2,-5],[0,7,30,-13,4,-19],[0,8,-38,-20,5,-19],[48,40,12,0,3,0],[0,30,58,0,3,0]]){
    camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);camera.updateMatrixWorld();for(const i of visibleHouseIndices(T,layout,camera,8))indices.add(i);
  }
  indices.add(layout.chapters.length);return indices;
}
export function createVillageRenderer(T,chapters,options={}){
  if(chapters.length<=STREAMING_THRESHOLD)return createVillage(T,chapters,{compactCrowd:villageQuality().mobile,...options});
  const layout=villageRenderLayout(T,chapters,options.houseFinishes),indices=startingIndices(T,layout,options);
  const active=createVillage(T,layout.chapters,{...options,layout,indices,compactCrowd:true});
  return streamedRenderer(T,layout,active,indices,true,options.arrivals);
}
export async function createVillageRendererAsync(T,chapters,options={}){
  const streaming=chapters.length>STREAMING_THRESHOLD;
  const layout=streaming?villageRenderLayout(T,chapters,options.houseFinishes):null;
  const indices=streaming?startingIndices(T,layout,options):null;
  const steps=buildVillageSteps(T,layout?.chapters||chapters,{...options,layout,indices,attachStreet:!streaming&&(options.attachStreet??false),compactCrowd:streaming||villageQuality().mobile});
  let result;
  do{
    const start=performance.now();do{result=steps.next();}while(!result.done&&performance.now()-start<4);
    if(!result.done)await new Promise(resolve=>requestAnimationFrame(resolve));
  }while(!result.done);
  return streaming?streamedRenderer(T,layout,result.value,indices,options.attachStreet??false,options.arrivals):result.value;
}
function streamedRenderer(T,layout,initial,initialIndices,attachStreet=true,arrivals){
  const world=new T.Group();world.name='streamed-greek-village';world.add(initial.world);if(attachStreet)world.add(initial.streets);
  const streets=initial.streets;
  let active=initial,resident=initialIndices,pending=null,night=false,disposed=false,revision=0,focusPending=null,lastViewCheck=-Infinity;
  const checkedView=new T.Matrix4(),checkedProjection=new T.Matrix4();
  const contains=(outer,inner)=>[...inner].every(i=>outer.has(i));
  function discard(){if(!pending)return;pending.control.dispose?.();pending.steps.return();pending=null;}
  function request(indices){
    if(pending&&contains(pending.indices,indices))return;
    discard();const control={};
    pending={indices,control,steps:buildVillageSteps(T,layout.chapters,{streets,layout,indices,attachStreet:false,compactCrowd:true,control,arrivals})};
  }
  function advance(budget=4){
    if(!pending||disposed)return false;
    const start=performance.now();let result;
    do{result=pending.steps.next();}while(!result.done&&performance.now()-start<budget);
    if(!result.done)return false;
    const next=result.value,old=active;resident=pending.indices;pending=null;active=next;
    next.nightLife.setNight(night);world.add(next.world);old.world.removeFromParent();old.dispose();world.updateMatrixWorld(true);revision++;
    if(focusPending){const focus=focusPending;focusPending=null;focus.ready();}
    return true;
  }
  function updateView(camera){
    if(disposed)return false;
    const now=performance.now();
    if(!focusPending&&now-lastViewCheck>=100&&(!checkedView.equals(camera.matrixWorldInverse)||!checkedProjection.equals(camera.projectionMatrix)||lastViewCheck===-Infinity)){
      checkedView.copy(camera.matrixWorldInverse);checkedProjection.copy(camera.projectionMatrix);lastViewCheck=now;
      const needed=visibleHouseIndices(T,layout,camera,2);
      if(!contains(resident,needed)&&(!pending||!contains(pending.indices,needed)))request(visibleHouseIndices(T,layout,camera,30));
    }
    return advance();
  }
  function focus(id,ready){
    const index=layout.anchors.findIndex(a=>a.id===id);if(index<0)return;
    if(resident.has(index)){ready();return;}
    const lot=layout.lots[index],indices=new Set();
    layout.lots.forEach((candidate,i)=>{if(Math.abs(candidate.x-lot.x)<90&&Math.abs(candidate.z-lot.z)<85)indices.add(i);});
    focusPending={id,ready};request(indices);
  }
  return {
    world,streets,...layout,updateView,advance,focus,cancelFocus(){focusPending=null;},
    get streaming(){return true;},get building(){return Boolean(pending);},get revision(){return revision;},get residentCount(){return resident.size;},get residentIndices(){return new Set(resident);},
    get renderAnchors(){return active.anchors;},get members(){return active.members;},get pedestrians(){return active.pedestrians;},get parts(){return active.parts;},get distantCrowd(){return active.distantCrowd;},get crowdVisibility(){return active.crowdVisibility;},get pickables(){return active.pickables;},get competition(){return active.competition;},get beacon(){return active.beacon;},get pong(){return active.pong;},get die(){return active.die;},get construction(){return active.construction;},
    nightLife:{setNight(enabled){night=Boolean(enabled);active.nightLife.setNight(night);}},
    animateCrowd(time,camera,poses){return active.animateCrowd(time,camera,poses);},animateEffects(time){active.animateEffects(time);},
    dispose(){disposed=true;discard();active.dispose();world.removeFromParent();}
  };
}
