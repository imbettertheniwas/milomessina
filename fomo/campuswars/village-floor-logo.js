import {FOMO_BRAND,paintFomoWordmark} from './village-brand.js?v=153';
// Original fomo symbol, with transparent cutouts and unchanged proportions.
export const FOMO_MARK_PATHS=["M36.9747 24.3586C44.1067 24.3587 49.7941 27.9515 52.9484 33.5959C48.7626 38.0418 45.6617 43.7612 44.4679 50.0002C43.2743 56.2391 44.1865 61.9572 46.67 66.4026C41.3555 72.0468 34.2931 75.6408 27.1613 75.6409C18.432 75.6407 11.8659 70.2588 9.46204 62.3196H26.8478C27.4159 62.3193 28.0059 61.8593 28.1691 61.2932L34.6486 38.7043C34.8098 38.1381 34.4815 37.6782 33.9152 37.678H14.1788C19.6213 29.7404 28.2465 24.3588 36.9747 24.3586Z", "M72.3285 24.3586C85.0779 24.3586 93.2156 35.8374 90.5062 49.9993C87.7966 64.1596 75.2646 75.6409 62.515 75.6409C53.7856 75.6408 47.2196 70.2589 44.8158 62.3196H64.1537C64.7218 62.3194 65.3127 61.8594 65.476 61.2932L71.9545 38.7043C72.1157 38.138 71.7876 37.678 71.2211 37.678H49.5316C54.9741 29.7401 63.5999 24.3587 72.3285 24.3586Z"];

export function paintFomoLockup(ctx,x,y,width,height,color=FOMO_BRAND.white){
 const scale=Math.min(width/126,height/24);
 ctx.save();ctx.translate(x+(width-126*scale)/2,y+(height-24*scale)/2);ctx.scale(scale,scale);
 ctx.save();ctx.scale(24/51.2823,24/51.2823);ctx.translate(-9.46204,-24.3586);ctx.fillStyle=color;
 for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();
 paintFomoWordmark(ctx,51,0,75,24,color);ctx.restore();
}
export function createCampusBannerTexture(T){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=3072;canvas.height=640;
 const ctx=canvas.getContext('2d');ctx.scale(2,2);
 function paint(){
  ctx.fillStyle=FOMO_BRAND.navy;ctx.fillRect(0,0,1536,320);
  paintFomoLockup(ctx,100,100,650,124);
  ctx.fillStyle=FOMO_BRAND.white;ctx.font='500 124px Aeonik, Arial, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.letterSpacing='0px';ctx.fillText('/ campus',822,167);
 }
 paint();const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
 document.fonts?.load('500 124px Aeonik').then(()=>{paint();map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});return map;
}
export function createVehicleLogoTexture(T){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=224;const ctx=canvas.getContext('2d');
 ctx.fillStyle=FOMO_BRAND.blue;ctx.fillRect(0,0,768,224);paintFomoLockup(ctx,64,51,640,122);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
}
export function createEntranceEyesTexture(T,aspect=4){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=Math.round(512*aspect);canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle=FOMO_BRAND.blue;ctx.fillRect(0,0,canvas.width,512);
 ctx.strokeStyle=FOMO_BRAND.white;ctx.lineWidth=2;ctx.setLineDash([9,8]);
 for(const y of [12,500]){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(canvas.width-18,y);ctx.stroke();}
 ctx.save();ctx.translate(canvas.width/2-50*6,256-50*6);ctx.scale(6,6);ctx.fillStyle=FOMO_BRAND.white;
 for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
}
