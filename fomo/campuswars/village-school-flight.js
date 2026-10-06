import {createPrivateJet} from './village-private-jet.js?v=151';
import {createSchoolDrop,SCHOOL_DROP_DURATION} from './village-school-drop.js?v=151';

export const JET_RIDE_DURATION=3.8;
export const SCHOOL_FLIGHT_DURATION=JET_RIDE_DURATION+SCHOOL_DROP_DURATION;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*t*(10+t*(-15+6*t));};
export function schoolFlightStage(time){return time<1.25?'jet':time<2.55?'cabin':time<JET_RIDE_DURATION?'jump':time<JET_RIDE_DURATION+.9?'freefall':time<SCHOOL_FLIGHT_DURATION-1?'parachute':'arrival';}
export function schoolFlightCaption(time,school){
 const stage=schoolFlightStage(time);
 const captions={jet:['Your jet is here.','FOMO AIR · PRIVATE FLIGHT'],cabin:[`Next stop: ${school.name}`,'YOUR CAMPUS IS CALLING'],jump:['See you down there.','NEXT UP · YOUR CAMPUS'],freefall:[school.name,'WELCOME TO YOUR CAMPUS'],parachute:[school.name,'COMING IN HOT'],arrival:[school.name,'YOU’VE ARRIVED']};
 const [title,description]=captions[stage];return {index:stage,title,description,join:false,opacity:1,copyOpacity:1,lift:0,scale:1};
}
export function createSchoolFlight(T,scene){
 const jet=createPrivateJet(T);scene.add(jet.root);jet.root.visible=false;
 const drop=createSchoolDrop(T,scene),clouds=new T.Group();clouds.name='jet-cloud-layer';clouds.visible=false;scene.add(clouds);
 const resources=new Set(),temp=new T.PerspectiveCamera(),endQuaternion=new T.Quaternion(),startQuaternion=new T.Quaternion();
 let path=null,dropStart=new T.Vector3(),dropRotation=new T.Quaternion(),dropFov=68;
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(64,64,1,64,64,63);gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.45,'rgba(245,246,255,.7)');gradient.addColorStop(1,'rgba(245,246,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const map=new T.CanvasTexture(c);resources.add(map);
  for(let i=0;i<28;i++){const material=new T.SpriteMaterial({map,color:0xf4f0fa,transparent:true,opacity:.78,depthWrite:false,fog:false});resources.add(material);const sprite=new T.Sprite(material);sprite.position.set(Math.sin(i*2.4)*(55+i*4),-15-(i%4)*14,Math.cos(i*2.4)*(60+i*5));sprite.scale.set(80+i%3*35,24+i%4*10,1);clouds.add(sprite);}
 }
 function frameCamera(camera,position,aim,fov,roll=0){camera.position.copy(position);camera.fov=fov;camera.near=.06;camera.far=2200;camera.lookAt(aim);camera.rotateZ(roll);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 function begin(options){
  path=options;drop.begin(options);drop.update(0,temp);dropStart.copy(temp.position);dropRotation.copy(temp.quaternion);dropFov=temp.fov;drop.finish();
  clouds.position.copy(dropStart);jet.root.visible=true;clouds.visible=true;jet.exterior.visible=true;jet.cabin.visible=false;
 }
 function update(time,camera){
  if(!path)return;
  const stage=schoolFlightStage(time),mobile=camera.aspect<1;
  jet.root.visible=time<JET_RIDE_DURATION+.5;clouds.visible=time<JET_RIDE_DURATION+.6;
  const origin=dropStart.clone().add(new T.Vector3(0,9,8+(JET_RIDE_DURATION-time)*22));
  jet.root.position.copy(origin);jet.root.rotation.set(0,0,stage==='jet'?-.025:0);
  if(time>=JET_RIDE_DURATION){
   jet.cabin.visible=false;jet.exterior.visible=true;
   if(!drop.root.userData.flightStarted){drop.begin(path);drop.root.userData.flightStarted=true;}
   return {...drop.update(time-JET_RIDE_DURATION,camera),stage};
  }
  jet.exterior.visible=stage==='jet';jet.cabin.visible=stage!=='jet';
  if(stage==='jet'){
   const t=smooth(time/1.25),position=origin.clone().add(new T.Vector3(31-t*5,9-t*2,29-t*4).multiplyScalar(mobile?1.5:1));
   frameCamera(camera,position,origin.clone().add(new T.Vector3(0,.3,-3)),mobile?57:48,-.018);
  }else if(stage==='cabin'){
   const t=smooth((time-1.25)/1.3),position=origin.clone().add(new T.Vector3(.1,.32,2.8-t*4.2));
   const aim=new T.Vector3(-.45,.32,-6).lerp(new T.Vector3(-1.7,.15,-4.2),smooth(t));
   frameCamera(camera,position,origin.clone().add(aim),mobile?83:76);
  }else{
   const elapsed=time-2.55,exit=smooth(elapsed/.45),fall=clamp((elapsed-.45)/.8);
   const position=origin.clone().add(new T.Vector3(.1,.32,-1.4).lerp(new T.Vector3(-3.4,-.05,-4.2),exit));
   if(elapsed>=.45){
    // Match the jet's forward velocity at the door and the freefall velocity at handoff.
    const start=dropStart.clone().add(new T.Vector3(-3.4,8.95,21.4)),u=fall,u2=u*u,u3=u2*u;
    position.copy(start).multiplyScalar(2*u3-3*u2+1).addScaledVector(new T.Vector3(0,0,-22),.8*(u3-2*u2+u)).addScaledVector(dropStart,-2*u3+3*u2).addScaledVector(new T.Vector3(0,-22,-20),.8*(u3-u2));
   }
   temp.position.copy(origin).add(new T.Vector3(.1,.32,-1.4));temp.lookAt(origin.clone().add(new T.Vector3(-1.7,.15,-4.2)));startQuaternion.copy(temp.quaternion);endQuaternion.copy(dropRotation);
   const turn=smooth(fall);
   camera.position.copy(position);camera.quaternion.copy(startQuaternion).slerp(endQuaternion,turn);const fov=mobile?83:76;camera.fov=fov+(dropFov-fov)*turn;camera.near=.06;camera.far=2200;camera.updateProjectionMatrix();camera.updateMatrixWorld();
   jet.cabin.visible=elapsed<.45;jet.exterior.visible=elapsed>=.45;
  }
  return {stage,target:[path.anchor?.lot.originX||0,3,path.anchor?.lot.z??-19],theta:.5,phi:.4,radius:camera.aspect<1?78:58};
 }
 function finish(){path=null;jet.root.visible=false;clouds.visible=false;drop.finish();drop.root.userData.flightStarted=false;}
 return {root:jet.root,drop,begin(options){finish();begin(options);},update,finish,dispose(){finish();jet.dispose();drop.dispose();clouds.removeFromParent();for(const resource of resources)resource.dispose();}};
}
