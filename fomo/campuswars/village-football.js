// The game is an absolute-time exhibition: alternating possessions, continuous
// routes and a visible reset between snaps. It never changes chapter standings.
export const PLAY_SECONDS=32;
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function footballState(time){
  time=Math.max(0,Number.isFinite(time)?time:0);
  const play=Math.floor(time/PLAY_SECONDS),t=time%PLAY_SECONDS,direction=play%2?-1:1;
  const phase=t<4?'SET':t<8?'SNAP':t<11?'PASS':t<19?'RUN':t<24?'TOUCHDOWN':'RESET';
  return {play,t,direction,phase,home:14+Math.ceil(play/2)*7+(phase==='TOUCHDOWN'||phase==='RESET'?direction===1?7:0:0),away:7+Math.floor(play/2)*7+(phase==='TOUCHDOWN'||phase==='RESET'?direction===-1?7:0:0),clock:`${String(14-Math.floor((time%900)/60)).padStart(2,'0')}:${String(59-Math.floor(time%60)).padStart(2,'0')}`,quarter:1+Math.floor(time/900)%4,celebration:phase==='TOUCHDOWN'?1:0};
}
function route(index,t){
  const offense=index<11,i=index%11;
  const start=offense?(i===0?[0,-12]:i<6?[(i-3)*1.05,-9]:[(i-8)*3.1,-10]):i<5?[(i-2)*1.15,-7]:[(i-7.5)*2.6,-2];
  let end;
  if(offense)end=i===0?[-1,-16]:i<6?[(i-3)*1.2,-7.5]:[i===8?6:(i-8)*2.8,i===8?26:18-Math.abs(i-8)*2];
  else end=i<5?[(i-2)*1.4,-9]:[i===8?6.7:(i-7.5)*2.1,i===8?24:17-Math.abs(i-8)*2];
  const progress=ease((t-4)/(i<6?5:15));
  let x=mix(start[0],end[0],progress),z=mix(start[1],end[1],progress);
  if(t>24){const reset=ease((t-24)/8);x=mix(end[0],-start[0],reset);z=mix(end[1],-start[1],reset);}
  return {x,z};
}
export function footballPlayer(index,time){
  const state=footballState(time),p=route(index,state.t),next=route(index,Math.min(31.999,state.t+.025));
  // Swap physical teams on possession changes, so the ball belongs to the
  // attacking uniform on every drive. Players reset before the next formation.
  const turn=state.direction;
  // Walk directly into the next formation during the dead ball, with no jumps
  // at the possession boundary and no circular reset through the stands.
  return {x:p.x*turn,z:p.z*turn,angle:Math.atan2(next.x-p.x,next.z-p.z)+(turn<0?Math.PI:0),running:state.t>4&&state.t<19||state.t>24,celebrating:index<11&&state.phase==='TOUCHDOWN',team:index<11?state.play%2:1-state.play%2};
}
export function footballBall(time){
  const state=footballState(time),qb=footballPlayer(0,time),receiver=footballPlayer(8,time);
  if(state.t<4)return {x:0,y:.35,z:-9*state.direction};
  if(state.t<8){const a=ease((state.t-4)/.6);return {x:qb.x*a,y:mix(.35,1.1,a),z:mix(-9*state.direction,qb.z,a)};}
  if(state.t<11){const a=(state.t-8)/3,release=footballPlayer(0,state.play*32+8),catcher=footballPlayer(8,state.play*32+11);return {x:mix(release.x,catcher.x,a),y:1.1+Math.sin(a*Math.PI)*6,z:mix(release.z,catcher.z,a)};}
  if(state.t<24)return {x:receiver.x,y:1.1,z:receiver.z};
  const a=ease((state.t-24)/8),start=footballPlayer(8,state.play*32+24);
  return {x:mix(start.x,0,a),y:mix(1.1,.35,a),z:mix(start.z,9*state.direction,a)};
}
