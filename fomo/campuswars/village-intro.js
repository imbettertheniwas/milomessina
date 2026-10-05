// One visible-time clock drives the flight, lens, lighting and brief captions.
export const INTRO_DURATION = 13.6;
export const INTRO_PACE = .85;
export const openingView = {target:[1.808,2,-8.101],theta:2.956047,phi:.224457,radius:46.627674};
export const introStages = [
  {start:0,end:2.72,title:'GREEK WARS.',description:'Your chapter. Your team. A trading competition on fomo.'},
  {start:2.72,end:5.95,title:"IF YOU'RE IN A FRAT.",description:'fomo has committed $500,000'},
  {start:5.95,end:10.2,title:'$6.25 PER BROTHER ONBOARDED',description:'Every member who joins pays the chapter. Rally yours.'},
  {start:10.2,end:13.6,title:'YOUR CHAPTER. NEXT.',description:'Bring your people to Greek Wars.'}
];
const home=[openingView.target[0]+Math.sin(openingView.theta)*Math.cos(openingView.phi)*openingView.radius,openingView.target[1]+Math.sin(openingView.phi)*openingView.radius,openingView.target[2]+Math.cos(openingView.theta)*Math.cos(openingView.phi)*openingView.radius];
// Shared velocities and zero acceleration at each knot make the whole route C2 continuous.
// Low waypoints keep the flight over the boulevard; the bank remains above rooftops.
const knots=[
  {time:0,position:[0,104,104],velocity:[0,-15,-24],target:[0,2,-5],fov:66,roll:0},
  {time:3.2,position:[0,7,30],velocity:[0,0,-27],target:[-13,4,-19],fov:72,roll:-.055},
  {time:6.4,position:[0,8,-38],velocity:[0,0,-12],target:[-20,5,-19],fov:60,roll:.045},
  {time:9.5,position:[48,40,12],velocity:[0,0,28],target:[0,3,0],fov:64,roll:-.10},
  {time:12.5,position:[0,30,58],velocity:[-12,-2,-12],target:[0,3,0],fov:56,roll:.04},
  {time:16,position:home,velocity:[0,0,0],target:openingView.target,fov:48,roll:0}
];
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
// Quintic Hermite basis, with shared first derivatives and zero second derivatives.
function interpolate(a,b,va,vb,t,span){
  const t2=t*t,t3=t2*t,t4=t3*t,t5=t4*t;
  return a*(1-10*t3+15*t4-6*t5)+b*(10*t3-15*t4+6*t5)+va*span*(t-6*t3+8*t4-3*t5)+vb*span*(-4*t3+7*t4-3*t5);
}
function targetVelocity(index,axis){
  if(index===0||index===knots.length-1)return 0;
  return (knots[index+1].target[axis]-knots[index-1].target[axis])/(knots[index+1].time-knots[index-1].time);
}
export function introViewAt(seconds){
  const time=Math.max(0,Math.min(16,seconds/INTRO_PACE));
  const index=knots.findIndex((k,i)=>i<knots.length-1&&time<=knots[i+1].time),a=knots[index],b=knots[index+1];
  const span=b.time-a.time,t=(time-a.time)/span;
  const position=a.position.map((value,i)=>interpolate(value,b.position[i],a.velocity[i],b.velocity[i],t,span));
  const target=a.target.map((value,i)=>interpolate(value,b.target[i],targetVelocity(index,i),targetVelocity(index+1,i),t,span));
  const offset=position.map((value,i)=>value-target[i]),radius=Math.hypot(...offset);
  const night=smooth((time-6.8)/1.1)*(1-smooth((time-11.5)/1.4));
  return {target,theta:Math.atan2(offset[0],offset[2]),phi:Math.asin(offset[1]/radius),radius,fov:interpolate(a.fov,b.fov,0,0,t,span),roll:interpolate(a.roll,b.roll,0,0,t,span),night};
}
export function introCaptionAt(seconds){
  const time=Math.max(0,Math.min(INTRO_DURATION,seconds));
  const index=introStages.findIndex((stage,i)=>time<stage.end||i===introStages.length-1),stage=introStages[index];
  const local=time-stage.start,hold=(index===3?3.8:2.5)*INTRO_PACE;
  const reveal=smooth((local-.3*INTRO_PACE)/.22),exit=1-smooth((local-hold)/.3);
  return {index,...stage,opacity:clamp((INTRO_DURATION-time)/.35),copyOpacity:reveal*exit,lift:(1-reveal)*24,scale:1+(1-reveal)*.12,join:index===3};
}
// The flight's warm-up and its playback must frame identical views, or the
// warm-up compiles draws the flight never makes and misses the ones it does.
export function aimIntroCamera(camera,seconds){
  const view=introViewAt(seconds),[x,y,z]=view.target;
  camera.position.set(x+Math.sin(view.theta)*Math.cos(view.phi)*view.radius,y+Math.sin(view.phi)*view.radius,z+Math.cos(view.theta)*Math.cos(view.phi)*view.radius);
  camera.lookAt(x,y,z);
  if(view.roll)camera.rotateZ(view.roll);
  camera.fov=view.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return view;
}
// Every beat that brings new scenery into frame: the aerial opening, the drop
// onto the boulevard, the low run between the houses, the bank over the roofs,
// the high orbit, and the resting view the flight hands over to.
export const INTRO_PREWARM_TIMES=[0,1.4,3.2,5,6.6,8.2,10,11.8,INTRO_DURATION];
