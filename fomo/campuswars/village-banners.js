import {villageQuality} from './village-quality.js?v=97';
import {bannerIdentity,paintChapterBanner} from './village-banner-art.js?v=104';
export {bannerIdentity} from './village-banner-art.js?v=104';
// Chapter-specific artwork on shared sewn cloth and mounting hardware.
const hardware=new WeakMap();
export function createChapterBanner(T,chapter,width,options={}){
  const banner=createClothBanner(T,{width,height:2.17,primary:bannerIdentity(chapter).primary,paint:(ctx,w,h)=>paintChapterBanner(ctx,chapter,w,h),...options});
  banner.name=`chapter-banner-${chapter.id}`;banner.userData={chapter:chapter.id,name:chapter.name,joined:chapter.joined,active:chapter.active,design:bannerIdentity(chapter).key};
  return banner;
}
export function createClothBanner(T,{width,height,primary,paint,ready=Promise.resolve(),resolution=2048,adaptive=false,shrink=true}){
  const quality=villageQuality();resolution=Math.min(resolution,quality.bannerResolution);
  let map,bumpMap,disposed=false,updateArtwork;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=adaptive?Math.min(256,resolution):resolution;canvas.height=Math.round(canvas.width*height/width);
    const ctx=canvas.getContext('2d'),h=canvas.height,w=canvas.width;
    paint(ctx,w,h);map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=quality.mobile?8:16;map.minFilter=T.LinearMipmapLinearFilter;
    const weave=document.createElement('canvas');weave.width=weave.height=64;const c=weave.getContext('2d');c.fillStyle='#888888';c.fillRect(0,0,64,64);
    for(let i=0;i<64;i+=4){c.fillStyle='#999999';c.fillRect(i,0,1,64);c.fillStyle='#777777';c.fillRect(0,i+2,64,1);}
    bumpMap=new T.CanvasTexture(weave);bumpMap.wrapS=bumpMap.wrapT=T.RepeatWrapping;bumpMap.repeat.set(width*5,height*5);bumpMap.anisotropy=8;
    updateArtwork=requested=>{const next=Math.min(resolution,Math.max(256,2**Math.ceil(Math.log2(requested))));if(disposed||next===canvas.width||next<canvas.width&&(!shrink||next>canvas.width/4))return;canvas.width=next;canvas.height=Math.round(next*height/width);paint(ctx,canvas.width,canvas.height);map.needsUpdate=true;};
    Promise.allSettled([ready,...(document.fonts?[document.fonts.load('700 90px Aeonik'),document.fonts.load('500 158px Aeonik')]:[])]).then(()=>{if(disposed)return;paint(ctx,canvas.width,canvas.height);map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});
  }
  const geometry=new T.PlaneGeometry(width,height,quality.mobile?32:48,quality.mobile?12:16),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),drop=(height/2-y)/height;
    positions.setY(i,y-.055*Math.cos(x/width*Math.PI)*drop);
    positions.setZ(i,.025*Math.sin(x/width*Math.PI*6)*drop+.045*Math.sin(drop*Math.PI));
  }
  geometry.computeVertexNormals();
  const banner=new T.Mesh(geometry,new T.MeshPhysicalMaterial({color:map?0xffffff:primary,...(map?{map,bumpMap,bumpScale:.018}:{}),roughness:.88,sheen:.65,sheenColor:0xf0e9db,sheenRoughness:.9,side:T.DoubleSide}));
  banner.material.addEventListener('dispose',()=>{disposed=true;});
  if(adaptive&&updateArtwork){
    const point=new T.Vector3(),scale=new T.Vector3(),viewport=new T.Vector2();
    banner.onBeforeRender=function(renderer,scene,camera){
      const banner=this;
      point.setFromMatrixPosition(banner.matrixWorld);scale.setFromMatrixScale(banner.matrixWorld);renderer.getDrawingBufferSize(viewport);
      const distance=Math.max(.5,point.distanceTo(camera.position)-Math.max(width*scale.x,height*scale.y)*.5);
      const pixelsPerUnit=viewport.y*camera.projectionMatrix.elements[5]/(2*distance);
      // Retain the full artwork at close range; distant cloth only allocates
      // the texels its actual screen size can show, with 1.5x oversampling.
      updateArtwork(width*Math.max(scale.x,scale.y)*pixelsPerUnit*1.5);
    };
  }
  if(!hardware.has(T))hardware.set(T,{geometry:new T.TorusGeometry(.045,.012,6,16),material:new T.MeshStandardMaterial({color:0xb4ab91,metalness:.65,roughness:.35})});
  const kit=hardware.get(T);kit.geometry.userData.sharedResource=true;kit.material.userData.sharedResource=true;
  for(const x of [-width/2+.14,width/2-.14])for(const y of [-height/2+.14,height/2-.14]){
    const ring=new T.Mesh(kit.geometry,kit.material);ring.position.set(x,y,.038);banner.add(ring);
  }
  return banner;
}
