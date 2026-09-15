// Shared, absolute-time poses keep chapter members and campus visitors in scale.
// One cycle is two steps; measuring it in distance prevents treadmill feet.
const TAU=Math.PI*2;
const fract=n=>n-Math.floor(n);
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function gaitPhase(distance,person,jog=false){return distance/((jog?1.48:1.08)*person.height)*TAU+person.phase;}
export function speechGesture(turn,time,phase){
  const u=fract(turn),envelope=smooth(u/.18)*smooth((1-u)/.22);
  return envelope*(.36+.13*Math.sin(time*2.1+phase)+.07*Math.sin(time*3.7+phase));
}
export function footstep(gait,jog=false){
  const u=fract(gait/TAU),stance=jog?.48:.62,travel=(jog?1.48:1.08)*stance;
  if(u<stance)return {z:travel*(.5-u/stance),lift:0,pitch:.16*smooth((u/stance-.72)/.28),planted:true};
  const s=(u-stance)/(1-stance),slope=-(1-stance)/stance;
  // Hermite return matches the backward foot speed at lift-off and touchdown.
  const forward=(-2*s*s*s+3*s*s)+slope*(2*s*s*s-3*s*s+s);
  return {z:travel*(forward-.5),lift:(jog?.23:.12)*Math.sin(Math.PI*s)**2,pitch:.16*(1-s)-.2*Math.sin(Math.PI*s),planted:false};
}
export function kneeBetween(hip,ankle,length=.43){
  const dy=ankle[1]-hip[1],dz=ankle[2]-hip[2],d=Math.hypot(dy,dz)||.001;
  const bend=Math.sqrt(Math.max(0,length*length-d*d/4));
  return [(hip[0]+ankle[0])/2,(hip[1]+ankle[1])/2+dz/d*bend,(hip[2]+ankle[2])/2-dy/d*bend];
}
export function humanPose(person,state,time){
  const action=person.action,phase=person.phase,gait=state.gait||0,buildWidth=person.build??1;
  const seated=['sit','study','lawn'].includes(action),lawn=action==='lawn',skate=action==='skate',jog=action==='jog';
  const moving=Boolean(state.walking)&&!seated,amount=state.motion??(moving?1:0);
  const profile=person.motionProfile;
  const idlePhase=profile?fract((time+profile.idleOffset)/profile.idlePeriod):0;
  const idle=profile?smooth(idlePhase/.10)*(1-smooth((idlePhase-.18)/.16))*profile.idleAmount:0;
  const breath=Math.sin(time*(profile?.breathRate??1.7)+phase)*(profile?.breathAmount??.006);
  const weight=seated?0:moving?Math.sin(gait)*.017*amount:Math.sin(time*(profile?.shiftRate??.43)+phase)*(profile?.shiftAmount??.025);
  const standingHip=.975-(moving?(jog?.105:.075)*amount:0);
  const build=state.construction;
  const hipY=(lawn?.25:seated?.65:standingHip)+breath+(moving&&!skate?Math.cos(gait*2)*(jog?.025:.012)*amount:0)-(build?.bend||0)*.16-(state.arrival?.crouch||0);
  const lean=(seated?.085:jog?.055:skate?.07:.012)+(build?.bend||0)*.18;
  const twist=moving?Math.sin(gait)*.055*amount:Math.sin(time*(profile?.twistRate??.61)+phase)*(profile?.twistAmount??.024);
  const hip=[weight,hipY,0],chest=[weight*.65,hipY+.30,lean];
  const head=[weight*.45,hipY+.72+Math.sin(time*(profile?.nodRate??(state.speaking?1.7:.8))+phase)*(profile?.nodAmount??.006),lean+.018];
  const headYaw=twist+(state.look||0)+Math.sin(time*(profile?.lookRate??.57)+phase)*(profile?.lookAmount??.055)+idle;
  const arms=[],legs=[];
  for(let j=0;j<2;j++){
    const side=j?1:-1,cycle=gait+j*Math.PI,step=footstep(cycle,jog);
    const ankle=[side*.115,.13+(moving?step.lift*amount:0),moving?step.z*amount:side*.025];
    if(seated){ankle[1]=lawn?.12:.13;ankle[2]=lawn?.55:.43;}
    if(skate){ankle[1]=.13+(j?step.lift*.35:0);ankle[2]=j?-.22+step.z*.35:.22;}
    const joint=[hip[0]+side*.105,hipY,0];
    const knee=seated?[side*.13,hipY-.02,.36]:kneeBetween(joint,ankle);
    legs.push({hip:joint,knee,ankle,pitch:moving&&!skate?step.pitch:0});
    const gesture=((state.gesture||0)+(!moving&&!state.pong?idle:0))*(j?1:.2),swing=moving&&!skate?Math.cos(cycle)*amount:0;
    const shoulder=[chest[0]+side*.19*buildWidth,chest[1]+.13,lean-side*twist*.19];
    const upper=(jog?-.38:0)-swing*(jog?.55:.26)+gesture*.30;
    const elbow=[shoulder[0]+side*.025,shoulder[1]-.28*Math.cos(upper),shoulder[2]+.28*Math.sin(upper)];
    const lower=upper+(jog?1.25:.18)+gesture*3.0;
    const hand=[elbow[0]+side*gesture*.07,elbow[1]-.26*Math.cos(lower),elbow[2]+.26*Math.sin(lower)];
    if(seated){elbow[1]=hipY+.22;elbow[2]=.25;hand[1]=hipY+.21;hand[2]=.47;}
    if(action==='groundskeeper'){elbow[2]=.27;hand[1]=hipY+.1;hand[2]=.6;}
    if(action==='dogwalk'&&j){elbow[2]=.12;hand[1]=hipY+.08;hand[2]=.24;}
    if(state.carrying){elbow[2]=.25;elbow[1]=hipY+.18;hand[0]=side*.18;hand[1]=hipY+.14;hand[2]=.42;}
    if(skate){elbow[0]+=side*.08;hand[0]+=side*.14;hand[1]+=.12;}
    if(state.pong&&j){
      const {lift,extension}=state.pong;
      const reach=(point,to)=>point.forEach((v,k)=>{point[k]=v+(to[k]-v)*lift;});
      reach(elbow,[shoulder[0]+.035,shoulder[1]-.13+extension*.07,.23+extension*.08]);
      reach(hand,[shoulder[0]+.025,shoulder[1]+.13-extension*.11,.28+extension*.27]);
    }
    if(build){
      const reach=(point,to,amount)=>point.forEach((v,k)=>{point[k]=v+(to[k]-v)*amount;});
      const carry=build.carry;
      reach(elbow,[side*.22,hipY+.19,.21],carry);reach(hand,[side*.18,hipY+.11,.40],carry);
      if(build.mode==='pickup'){
        reach(elbow,[side*.19,hipY+.08,.23],build.bend);
        reach(hand,[side*.17,hipY-.15,.44],build.bend);
      }
      if(build.effort){
        const stroke=build.stroke,low=build.role==='masonry'||build.role==='saw';
        reach(elbow,[side*.21,hipY+(low?.07:.25),.23],build.effort);
        const y=low?hipY-.01:hipY+.30+(j&&build.role==='hammer'?(1-stroke)*.20:0);
        const z=build.role==='saw'?.38+stroke*.15:build.role==='drill'?.52+stroke*.035:.49;
        reach(hand,[side*(j?.10:.15),y,z],build.effort);
      }
    }
    if(state.arrival){
      const reach=state.arrival.arms;
      const targets=[[shoulder[0]+side*.18,shoulder[1]+.12,.03],[shoulder[0]+side*.26,shoulder[1]+.37,.06]];
      for(const [index,point] of [elbow,hand].entries())point.forEach((v,k)=>point[k]=v+(targets[index][k]-v)*reach);
    }
    arms.push({shoulder,elbow,hand});
  }
  return {hip,chest,head,headYaw,twist,lean,arms,legs,seated};
}
