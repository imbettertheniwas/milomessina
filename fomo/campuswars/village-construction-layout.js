import {hash} from './village-district-layout.js?v=80';
import {gaitPhase,smooth} from './village-human-motion.js?v=80';

const forms=['longhouse','twin-wing','courtyard','townhouse','pavilion'];
const roles=['hammer','masonry','drill','saw'];
// Architecture and work lanes share a stable plan, independent of roster order.
export function constructionPlan(chapter){
  const seed=(key)=>hash(chapter.id,key);
  const form=forms[Math.floor(seed('construction-design')*forms.length)];
  const width=7.8+seed('build-width')*2,depth=5+seed('build-depth');
  const side=seed('build-side')>.5?1:-1,split=.35+seed('build-split')*.25;
  const wallHeight=2.7+seed('build-height')*.7;
  return {key:chapter.id,form,width,depth,side,split,wallHeight,
    staging:['excavator','gantry','pipe-yard','site-office','formwork'][Math.floor(seed('build-staging')*5)],
    accent:[0xd59a32,0x507c86,0xa55c43,0x6c7394,0x708352][Math.floor(seed('build-accent')*5)],
    scaffoldHeight:.9+seed('build-platform')*.95,
    timber:[0xc69d68,0xaa7d49,0xd7b587,0xb48c60][Math.floor(seed('build-wood')*4)],
    masonry:[0xb17458,0xc0b7a3,0x92584b,0xa39885][Math.floor(seed('build-brick')*4)],
    scaffoldZ:(seed('build-scaffold')-.5)*1.2,
    bays:4+Math.floor(seed('build-bays')*3),
    progress:Math.max(0,Math.min(14,chapter.joined))/15};
}
export function constructionStation(plan,index){
  // Seven independent lanes on each face: no head-on traffic or crossing stockpiles.
  const side=index<7?1:-1,lane=index%7;
  const order=[3,1,5,0,6,2,4];
  const x=(order[lane]/6-.5)*(plan.width-1.2),wallZ=side*plan.depth/2;
  return {x,side,wallZ,workZ:wallZ+side*.68,supplyZ:wallZ+side*2.43,
    role:roles[(index+Math.floor(hash(plan.key,'crew-role')*4))%4]};
}
export function constructionAssignment(chapter,index){
  const plan=constructionPlan(chapter),station=constructionStation(plan,index);
  const pickup=2,travel=2.6+hash(chapter.id,index,'build-speed')*.6,work=5+hash(chapter.id,index,'build-work')*2;
  const turn=.8,period=pickup+travel*2+work+turn*3;
  return {...station,pickup,travel,work,turn,period,offset:hash(chapter.id,index,'build-offset')*period,
    helmet:[0xffc83d,0xe8e9df,0xf28b32][Math.floor(hash(chapter.id,index,'helmet')*3)]};
}
export function constructionActivity(person,time){
  const job=person.construction,t=((time+job.offset)%job.period+job.period)%job.period;
  const {pickup,travel,work,turn}=job;
  let z=job.supplyZ,angle=job.side===1?0:Math.PI,mode='pickup',carry=0,effort=0,bend=0,stroke=0,motion=0,distance=0;
  const toward=angle+Math.PI;
  let elapsed=t;
  if(elapsed<pickup){bend=Math.sin(Math.PI*elapsed/pickup)**2;carry=smooth((elapsed-pickup*.55)/(pickup*.3));}
  else if((elapsed-=pickup)<turn){mode='turn';angle+=Math.PI*smooth(elapsed/turn);carry=1;}
  else if((elapsed-=turn)<travel){
    mode='carry';const u=elapsed/travel,s=smooth(u);z=job.supplyZ+(job.workZ-job.supplyZ)*s;angle=toward;carry=1;
    distance=Math.abs(z-job.supplyZ);motion=4*u*(1-u);
  }else if((elapsed-=travel)<work){
    mode='work';z=job.workZ;angle=toward;
    carry=1-smooth(elapsed/.65);effort=smooth(elapsed/.75)*smooth((work-elapsed)/.65);
    stroke=(1-Math.cos(Math.max(0,elapsed-.5)*Math.PI*2*(job.role==='saw'?1.25:1.7)))/2;
    bend=(job.role==='masonry'?.55:job.role==='saw'?.3:.05)*effort;
  }else if((elapsed-=work)<turn){mode='turn';z=job.workZ;angle=toward-Math.PI*smooth(elapsed/turn);}
  else if((elapsed-=turn)<travel){
    mode='return';const u=elapsed/travel;z=job.workZ+(job.supplyZ-job.workZ)*smooth(u);
    distance=Math.abs(z-job.workZ);motion=4*u*(1-u);
  }else{elapsed-=travel;mode='settle';}
  const delivered=mode==='work'?1-carry:mode==='return'||mode==='settle'||(mode==='turn'&&z===job.workZ)?1:0;
  const a=person.lot.rotation;
  return {x:person.lot.x+job.x*Math.cos(a)+z*Math.sin(a),z:person.lot.z-job.x*Math.sin(a)+z*Math.cos(a),
    rotation:a+angle,walking:mode==='carry'||mode==='return',motion,gait:gaitPhase(distance,person),ground:.13,
    speaking:false,gesture:0,breath:0,construction:{mode,role:job.role,carry,delivered,effort,bend,stroke}};
}
