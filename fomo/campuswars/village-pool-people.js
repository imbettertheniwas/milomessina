import {BACKYARD,backyardUnlocked} from './village-backyards.js?v=112';
import {hash} from './village-district-layout.js?v=80';
import {humanPose} from './village-human-motion.js?v=106';

export const isPoolPerson=p=>Boolean(p.poolRole);
const worldPoint=(lot,x,z)=>({x:lot.x+x*Math.cos(lot.rotation)+z*Math.sin(lot.rotation),z:lot.z-x*Math.sin(lot.rotation)+z*Math.cos(lot.rotation)});
// Move existing members to the reward, preserving identities and the roster.
export function assignPoolPeople(members,chapters){
  for(const chapter of chapters){
    if(!backyardUnlocked(chapter))continue;
    const available=members.filter(m=>m.chapter===chapter.id&&!m.action&&!m.walking&&m.ground<.5);
    const count=Math.min(available.length,chapter.joined>=30?6:chapter.joined>=15?4:chapter.joined>=4?2:1);
    const roles=count>=4?['swim','swim','lounge','lounge','chat','chat']:['swim','lounge'];
    available.slice(0,count).forEach((m,i)=>{
      m.poolRole=roles[i];m.poolSeat=m.poolRole==='swim'?i:m.poolRole==='lounge'?i-(count>=4?2:1):i-4;
      m.action=`pool-${m.poolRole}`;m.walking=m.poolRole==='swim';m.speed=.32;
      m.backpack=false;m.jacket=false;m.cap=false;m.glasses=false;m.shorts=true;m.outfit='swim';
      m.swimsuit=hash(m.chapter,m.member,'swimsuit')>.64?'one-piece':'trunks';
      m.swimColor=[0x257a96,0xd46a55,0xe0a53e,0x597b61,0x7d6c9c][Math.floor(hash(m.chapter,m.member,'swim-color')*5)];
      const initial=poolActivityPose(m,0);Object.assign(m,{x:initial.x,z:initial.z,rotation:initial.rotation,ground:initial.ground});
    });
  }
}
export function poolActivityPose(m,time){
  let x,z,rotation=0,ground=BACKYARD.deckY;
  if(m.poolRole==='swim'){
    // Separate lap lanes, with room for the complete body at the walls, ladder
    // and shallow steps. Cosine easing slows the swimmer naturally at each turn.
    const phase=time*.22+m.poolSeat*Math.PI,travel=Math.sin(phase);
    x=-2.1+Math.cos(phase)*1.4;z=m.poolSeat===0?-11.3:-9.6;
    rotation=-Math.PI/2*Math.tanh(travel*7);ground=BACKYARD.pool.waterY;
  }else if(m.poolRole==='lounge'){
    x=m.poolSeat===0?3.3:4.85;z=-10.2;
  }else{x=m.poolSeat===0?-3:.05;z=-13.6;rotation=m.poolSeat===0?Math.PI/3:-Math.PI/3;}
  return {...worldPoint(m.lot,x,z),rotation:rotation+m.lot.rotation,ground,walking:m.poolRole==='swim',motion:m.poolRole==='swim'?.35:0,gait:0,look:Math.sin(time*.4+m.phase)*.06};
}
export function poolPersonAllowed(m,x,z,state){
  const dx=x-m.lot.x,dz=z-m.lot.z,c=Math.cos(m.lot.rotation),s=Math.sin(m.lot.rotation),lx=dx*c-dz*s,lz=dx*s+dz*c;
  if(m.poolRole==='swim')return lx>=-3.55&&lx<=-.65&&Math.abs(lz-(m.poolSeat===0?-11.3:-9.6))<.09;
  return Math.hypot(x-state.x,z-state.z)<.025;
}
// The same instanced anatomy used on the lawns, posed horizontally for swimming
// and reclined on the existing deck chairs. Bare skin and swimwear are assigned
// in the shared crowd palette; there are no extra avatars or per-person meshes.
export function poolHumanPose(m,state,time){
  if(m.poolRole==='chat')return humanPose(m,{...state,gesture:.08*(1+Math.sin(time*.9+m.phase))},time);
  if(m.poolRole==='lounge'){
    const breath=Math.sin(time*1.4+m.phase)*.004;
    const hip=[0,.57,.05],chest=[0,.74+breath,-.20],head=[0,1.01+breath,-.58];
    return {hip,chest,head,neck:[0,.92,-.48],lean:-.9,hipPitch:Math.PI/2,twist:0,headYaw:Math.sin(time*.25+m.phase)*.08,
      arms:[-1,1].map(side=>({shoulder:[side*.19,.84,-.29],elbow:[side*.29,.61,-.02],hand:[side*.31,.52,.24]})),
      legs:[-1,1].map(side=>({hip:[side*.105,.57,.05],knee:[side*.14,.54,.43],ankle:[side*.14,.48,.83],pitch:0}))};
  }
  const stroke=time*2.3+m.phase,bob=Math.sin(stroke*2)*.016;
  const hip=[0,-.045+bob,-.16],chest=[0,.02+bob,.14],head=[0,.14+bob,.56];
  return {hip,chest,head,neck:[0,.07+bob,.43],lean:Math.PI/2,hipPitch:Math.PI/2,twist:0,headYaw:Math.sin(stroke)*.08,
    arms:[-1,1].map(side=>{
      const sweep=(Math.sin(stroke)+1)/2;
      return {shoulder:[side*.19,.025+bob,.30],elbow:[side*(.25+.30*sweep),-.04,.45-.19*sweep],hand:[side*(.10+.42*sweep),.015+Math.cos(stroke)*.05,.82-.5*sweep]};
    }),
    legs:[-1,1].map(side=>({hip:[side*.105,-.045,-.16],knee:[side*.13,-.075+Math.sin(stroke*2+side)*.04,-.53],ankle:[side*.15,-.07+Math.sin(stroke*2+side)*.07,-.94],pitch:Math.PI/2}))};
}
export function createSwimWakes(T,members){
  const swimmers=members.map((m,i)=>({m,index:i})).filter(({m})=>m.poolRole==='swim');
  const geometry=new T.RingGeometry(.18,.205,28),material=new T.MeshBasicMaterial({color:0xd4f4ed,transparent:true,opacity:.21,depthWrite:false,side:T.DoubleSide});
  geometry.rotateX(-Math.PI/2);
  const mesh=new T.InstancedMesh(geometry,material,swimmers.length*2);mesh.name='pool-swimmer-ripples';mesh.frustumCulled=false;mesh.renderOrder=3;
  const dummy=new T.Object3D();
  return {mesh,update(time,poses,arrivalPose=null){
    for(let i=0;i<swimmers.length;i++){
      const {m,index}=swimmers[i],p=arrivalPose?arrivalPose(m,poses[index]):poses[index];
      for(let j=0;j<2;j++){
        const pulse=((time*.6+m.phase+j*.5)%1+1)%1,scale=.5+pulse*1.2;
        dummy.position.set(p.x-Math.sin(p.rotation)*.35,BACKYARD.pool.waterY+.018,p.z-Math.cos(p.rotation)*.35);
        dummy.rotation.set(0,p.rotation,0);dummy.scale.set(scale*(1-pulse)*2,1,scale*1.6*(1-pulse));
        if(p.arrival)dummy.scale.setScalar(0);
        dummy.updateMatrix();mesh.setMatrixAt(i*2+j,dummy.matrix);
      }
    }mesh.instanceMatrix.needsUpdate=true;
  }};
}
