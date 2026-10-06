import {campusIdentity} from './village-school-identities.js?v=138';
import {createClothBanner} from './village-banners.js?v=138';

const images=new Map();
export function loadCampusLogo(identity){
 if(!identity.logo||typeof Image==='undefined')return Promise.resolve(null);
 if(!images.has(identity.logo))images.set(identity.logo,new Promise(resolve=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{images.delete(identity.logo);resolve(null);};
  image.src=new URL(`./assets/schools/${identity.logo}`,import.meta.url).href;
 }));
 return images.get(identity.logo);
}
function contrast(hex){const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#101820':'#FFFFFF';}
function contain(ctx,image,x,y,w,h){if(!image)return;const ratio=Math.min(w/image.width,h/image.height);ctx.drawImage(image,x+(w-image.width*ratio)/2,y+(h-image.height*ratio)/2,image.width*ratio,image.height*ratio);}
function text(ctx,value,x,y,maxWidth,size,color){ctx.fillStyle=color;ctx.font=`700 ${size}px Aeonik, Arial, sans-serif`;while(ctx.measureText(value).width>maxWidth&&size>8)ctx.font=`700 ${--size}px Aeonik, Arial, sans-serif`;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(value,x,y);}
export function paintCampusSign(ctx,school,identity,logo,w,h,vertical=false){
 const ink=contrast(identity.primary),logoPaper=identity.logoBackground==='primary'?identity.primary:'#FFFFFF';
 ctx.clearRect(0,0,w,h);ctx.fillStyle=identity.primary;ctx.fillRect(0,0,w,h);
 if(vertical){
  ctx.fillStyle=identity.secondary;ctx.fillRect(0,0,w,.025*h);ctx.fillRect(0,h*.94,w,h*.06);
  ctx.fillStyle=logoPaper;ctx.fillRect(w*.08,h*.14,w*.84,h*.36);contain(ctx,logo,w*.15,h*.18,w*.7,h*.28);
  const words=school.name.toUpperCase().split(/\s+/),lines=[''];
  for(const word of words){const i=lines.length-1;if(lines[i]&&(lines[i]+' '+word).length>17)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}
  const step=Math.min(h*.06,h*.30/lines.length);lines.forEach((line,i)=>text(ctx,line,w*.5,h*.62+i*step,w*.82,w*.096,ink));
  ctx.strokeStyle=ink+'66';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.strokeRect(w*.025,h*.012,w*.95,h*.976);ctx.setLineDash([]);
 }else{
  ctx.fillStyle=identity.secondary;ctx.fillRect(0,h*.90,w,h*.10);
  const logoWidth=w*.18;ctx.fillStyle=logoPaper;ctx.fillRect(w*.015,h*.09,logoWidth,h*.72);
  contain(ctx,logo,w*.03,h*.16,logoWidth-w*.03,h*.57);
  text(ctx,school.name.toUpperCase(),w*.59,h*.46,w*.73,h*.37,ink);
 }
}
export function createSchoolEntrance(T,school,kit,wallColor){
 const identity=campusIdentity(school),root=new T.Group();root.name='school-name-entrance';root.position.set(0,0,-70);root.userData.schoolIdentity=identity.id;
 const {box}=kit;let logo=null,disposed=false;
 const ready=loadCampusLogo(identity).then(image=>{logo=image;});
 for(const side of [-1,1]){
  box(root,side*19,11.8,0,1.2,23.6,1.2,wallColor);box(root,side*19,.3,0,2,.6,2,0xe4d5b9);
  box(root,side*22.5,19.8,0,7.3,.16,.18,0x535c62);
  const cloth=createClothBanner(T,{width:4.6,height:10,primary:identity.primary,resolution:512,ready,paint:(ctx,w,h)=>paintCampusSign(ctx,school,identity,logo,w,h,true)});
  cloth.name='school-entrance-banner';cloth.userData.ownedTexture=true;cloth.position.set(side*22.5,14.7,.15);cloth.material.side=T.FrontSide;root.add(cloth);
  const reverse=cloth.clone();reverse.name='school-entrance-banner-back';reverse.rotation.y=Math.PI;reverse.position.z=-.15;root.add(reverse);
 }
 box(root,0,21.2,0,39.2,5.6,.6,0xe4d5b9);
 let map;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=274;const ctx=canvas.getContext('2d');
  const paint=()=>{paintCampusSign(ctx,school,identity,logo,canvas.width,canvas.height);};paint();
  map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  Promise.allSettled([ready,...(document.fonts?[document.fonts.load('700 90px Aeonik')]:[])]).then(()=>{if(disposed)return;paint();map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});
 }
 const material=new T.MeshLambertMaterial(map?{map}:{color:identity.primary});material.addEventListener('dispose',()=>{disposed=true;});
 const face=new T.Mesh(new T.PlaneGeometry(36,4.8),material);face.name='school-name-sign-front';face.userData.ownedTexture=true;face.position.set(0,21.2,.32);root.add(face);
 const back=face.clone();back.name='school-name-sign-back';back.position.z=-.32;back.rotation.y=Math.PI;root.add(back);
 return root;
}
