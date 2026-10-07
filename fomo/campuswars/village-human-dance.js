import {hash} from './village-district-layout.js?v=80';

const TAU=Math.PI*2,profiles=new WeakMap();
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Stable personalities, sampled from absolute time: offscreen people and paused
// or reversed previews return to exactly the same movement without simulation.
export function danceProfile(person){
  let profile=profiles.get(person);
  if(!profile){
    const roll=key=>hash(person.identity??`${person.chapter}:${person.member}`,key);
    profile={style:Math.floor(roll('dance-style')*6),phase:roll('dance-phase')*TAU,
      rate:TAU*(.72+roll('dance-tempo')*.36),energy:.4+roll('dance-energy')*.6,
      period:17+roll('dance-break-period')*19,offset:roll('dance-break-offset')*40,
      lead:roll('dance-lead')>.5?1:-1,arms:.45+roll('dance-arms')*.55,
      cup:hash(person.chapter,person.member,'cup')>.86};
    profiles.set(person,profile);
  }
  return profile;
}

export function danceActivity(person,time){
  const p=danceProfile(person),u=((time+p.offset)%p.period+p.period)%p.period;
  // A short breather fades into and out of the groove, independently per guest.
  const phrase=smooth(u/2)*(1-smooth((u-p.period+4)/2));
  const energy=p.energy*(.18+.82*phrase)*(person.ground>.5?.58:1);
  const beat=time*p.rate+p.phase+.14*Math.sin(time*.37+p.phase);
  return {style:p.style,beat,energy,lead:p.lead,arms:p.arms,cup:p.cup,
    accent:smooth((Math.sin(time*.41+p.phase)-.35)/.65)*phrase};
}

// Keep two fixed-length leg segments while allowing lateral weight transfer.
function danceKnee(hip,ankle){
  const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],dz=ankle[2]-hip[2];
  const d=Math.hypot(dx,dy,dz),bend=Math.sqrt(Math.max(0,.43**2-d*d/4));
  const horizontal=Math.hypot(dx,dy)||1;
  return [(hip[0]+ankle[0])/2-dx*dz/d/horizontal*bend,
    (hip[1]+ankle[1])/2-dy*dz/d/horizontal*bend,
    (hip[2]+ankle[2])/2+horizontal/d*bend];
}

export function applyDancePose(rig,person,state){
  const d=state.dance;
  if(!d||state.walking||state.arrival||state.pong||state.construction||rig.seated)return rig;
  const {beat:b,energy:e,style,lead,arms,cup,accent}=d;
  const sway=Math.sin(b*.5),pulse=(1-Math.cos(b*2))*.5;
  const sideStep=style===0,shoulders=style===1,bounce=style===2,slow=style===3,hands=style===4;
  const shift=sway*e*(sideStep?.085:slow?.075:.045);
  const drop=e*(.025+pulse*(bounce?.065:.028));
  rig.hip[0]+=shift;rig.hip[1]-=drop;
  rig.chest[0]+=shift*.65+Math.sin(b+(shoulders?1.1:0))*e*(shoulders?.035:.016);
  rig.chest[1]-=drop;
  rig.head[0]+=shift*.45;rig.head[1]-=drop+Math.sin(b-.3)*e*(style===5?.024:.012);
  rig.head[2]+=Math.sin(b-.45)*e*.016;
  rig.twist+=Math.sin(b*.5+.7)*e*(shoulders?.19:.10);
  rig.lean+=Math.sin(b-.2)*e*.035;
  rig.roll=-sway*e*(slow?.10:shoulders?.075:.045);
  rig.headYaw+=Math.sin(b*.25+.8)*e*.15;
  for(let j=0;j<2;j++){
    const side=j?1:-1,leg=rig.legs[j];
    leg.hip=[rig.hip[0]+side*.105,rig.hip[1],0];
    // Each foot lifts and returns to its own footprint while the other remains
    // planted. No root translation or foot sliding through the grass.
    const step=Math.max(0,Math.sin(b*.5+side*Math.PI/2));
    const lift=step**4*e*(sideStep?.065:slow?.008:.025);
    leg.ankle[0]+=side*step**4*e*(sideStep?.055:.012);
    leg.ankle[1]+=lift;leg.ankle[2]+=step**4*e*(sideStep?.025:.01);
    leg.pitch=step**4*e*.09;leg.knee=danceKnee(leg.hip,leg.ankle);
    const arm=rig.arms[j],lag=b+side*.65+lead*.4;
    const raised=(side===lead?1:.3)*accent*(hands?1:.42);
    arm.shoulder=[rig.chest[0]+side*.19*(person.build??1),rig.chest[1]+.13+side*Math.sin(b)*e*(shoulders?.025:.01),rig.chest[2]-side*rig.twist*.19];
    let upper=.12+e*((bounce?.1:.25)+Math.sin(lag)*(hands?.42:shoulders?.32:.23)+raised*1.9);
    let lower=upper+.3+e*((slow?.25:.55)+Math.sin(lag-.8)*.28);
    lower+=(state.gesture||0)*(j?1:.2);
    let spread=side*(.09+e*arms*(.12+Math.sin(lag*.5)**2*.18));
    // The cup stays around chest height, with a quiet elbow and no overhead wave.
    if(cup&&j){upper=.12;lower=1.55;spread=.08;}
    const elbow=[arm.shoulder[0]+.28*Math.sin(spread),arm.shoulder[1]-.28*Math.cos(upper)*Math.cos(spread),arm.shoulder[2]+.28*Math.sin(upper)*Math.cos(spread)];
    const hand=[elbow[0]+.26*Math.sin(spread*.6),elbow[1]-.26*Math.cos(lower)*Math.cos(spread*.6),elbow[2]+.26*Math.sin(lower)*Math.cos(spread*.6)];
    arm.elbow=elbow;arm.hand=hand;
  }
  return rig;
}
