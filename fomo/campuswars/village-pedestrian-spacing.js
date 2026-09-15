// One world-space spatial grid covers chapter members and campus visitors.
// Steering uses swept circles, so fast walkers cannot skip through a neighbour
// between frames. Rendering/LOD never determines who occupies a walking lane.
import {gaitPhase} from './village-human-motion.js?v=80';

const CELL=2,STEP=1/30,GAP=.025;
const turns=[0,.35,-.35,.7,-.7,1.15,-1.15,1.55,-1.55].map(angle=>({angle,cos:Math.cos(angle),sin:Math.sin(angle)}));
const movingActions=new Set(['walk','jog','journey','doorway','dogwalk','skate','basketball','groundskeeper','build']);
export const pedestrianRadius=p=>(p.action==='skate'||p.action==='jog'?.48:.40)*(p.height??1)*Math.max(1,p.build??1);
export function pedestrianGroup(id,people,sample,{offsetX=0,offsetZ=0,allowed=()=>true,ground=s=>s.ground??0,slots=null}={}){
  return {id,people,sample,offsetX,offsetZ,allowed,ground,slots};
}
function overlapHeight(a,b){return a.ground<b.ground+b.height&&b.ground<a.ground+a.height;}
// Minimum separation throughout both linear movements, not just at the end.
export function sweptDistanceSquared(ax,az,bx,bz,cx,cz,dx,dz){
  const x=ax-cx,z=az-cz,vx=bx-ax-dx+cx,vz=bz-az-dz+cz,vv=vx*vx+vz*vz;
  const t=vv?Math.max(0,Math.min(1,-(x*vx+z*vz)/vv)):0;
  return (x+vx*t)**2+(z+vz*t)**2;
}
export function createPedestrianSpacing(){
  let agents=[],groups=[],lastTime=NaN,revision=0,groupVersions='',result=new Map();
  const grid=new Map();
  const key=(x,z)=>`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`;
  function insert(a){const k=key(a.x,a.z);if(!grid.has(k))grid.set(k,new Set());grid.get(k).add(a);a.cell=k;}
  function moveCell(a){const k=key(a.x,a.z);if(k!==a.cell){grid.get(a.cell)?.delete(a);insert(a);}}
  function nearby(x,z,r=2){const found=[];for(let gx=Math.floor((x-r)/CELL);gx<=Math.floor((x+r)/CELL);gx++)for(let gz=Math.floor((z-r)/CELL);gz<=Math.floor((z+r)/CELL);gz++)for(const a of grid.get(`${gx},${gz}`)||[])found.push(a);return found;}
  function sample(a,time){
    const s=a.group.sample(a.person,time,a.index);a.pose=s;
    a.ground=a.group.ground(s,a.person);a.hidden=Boolean(s.hidden);
    return {x:s.x+a.group.offsetX,z:s.z+a.group.offsetZ};
  }
  const allowed=(a,x,z)=>a.group.allowed(x-a.group.offsetX,z-a.group.offsetZ,a.pose,a.person);
  function free(a,x,z){
    if(!allowed(a,x,z))return false;
    return nearby(x,z).every(b=>b===a||b.hidden||!overlapHeight(a,b)||(x-b.x)**2+(z-b.z)**2>=(a.radius+b.radius+GAP)**2);
  }
  function place(a,target){
    a.x=target.x;a.z=target.z;
    if(a.hidden)return;
    if(!free(a,a.x,a.z)){
      // Resolve initially crowded destinations before the first visible frame.
      // Stable order keeps friends in the same places on reload and camera cuts.
      let found=false;
      for(let ring=1;ring<=(a.group.slots?15:100)&&!found;ring++){
        const radius=ring*.16,steps=Math.max(12,Math.ceil(radius*32));
        for(let j=0;j<steps;j++){
          const angle=j/steps*Math.PI*2,x=target.x+Math.sin(angle)*radius,z=target.z+Math.cos(angle)*radius;
          if(free(a,x,z)){a.x=x;a.z=z;found=true;break;}
        }
      }
      if(!found&&a.group.slots){
        const slots=a.group.slots(a.person).map(p=>({x:p.x+a.group.offsetX,z:p.z+a.group.offsetZ}));
        slots.sort((a,b)=>(a.x-target.x)**2+(a.z-target.z)**2-(b.x-target.x)**2-(b.z-target.z)**2);
        for(const p of slots)if(free(a,p.x,p.z)){a.x=p.x;a.z=p.z;found=true;break;}
      }
      if(!found)throw new Error(`No pedestrian space available for ${a.id}`);
    }
    insert(a);
  }
  function reset(time,preserve=false){
    grid.clear();
    // New streamed neighbours and night visitors take the remaining space;
    // existing people retain their progress and do not jump back to a route.
    const order=preserve?[...agents].sort((a,b)=>Number(Boolean(b.ready))-Number(Boolean(a.ready))):agents;
    for(const a of order){
      const keep=preserve&&a.ready&&!a.hidden,position={x:a.x,z:a.z};
      if(!keep){a.delay=0;a.travel=0;a.vx=a.vz=0;}
      const target=sample(a,time-a.delay);place(a,keep?position:target);
      a.oldX=a.x;a.oldZ=a.z;
      if(!keep){a.gaitOrigin=a.pose.gait||0;a.heading=a.pose.rotation??a.pose.angle??0;}
      a.ready=true;
    }
  }
  function tick(time,dt){
    for(const a of agents){a.oldX=a.x;a.oldZ=a.z;}
    for(const a of agents){
      const wasHidden=a.hidden,target=sample(a,time-a.delay);
      if(a.hidden){grid.get(a.cell)?.delete(a);a.x=target.x;a.z=target.z;continue;}
      if(wasHidden){place(a,target);a.oldX=a.x;a.oldZ=a.z;a.gaitOrigin=a.pose.gait||0;a.heading=a.pose.rotation??a.pose.angle??0;}
      if(!a.mobile){a.vx=a.vz=0;continue;}
      const future=a.group.sample(a.person,time-a.delay+.55,a.index),fx=(future.x-a.pose.x)/.55,fz=(future.z-a.pose.z)/.55,routeSpeed=Math.hypot(fx,fz);
      const dx=target.x-a.x,dz=target.z-a.z,error=Math.hypot(dx,dz),px=fx+dx*.8,pz=fz+dz*.8,length=Math.hypot(px,pz);
      const speed=a.pose.walking?Math.min(length,Math.max(1.15,(a.person.speed??1)*(a.person.action==='jog'?1.45:1))*1.15):error>.7?.45:0;
      const ux=length>1e-5?px/length:Math.sin(a.heading),uz=length>1e-5?pz/length:Math.cos(a.heading);
      const neighbours=nearby(a.x,a.z,2.5).filter(b=>b!==a&&!b.hidden&&overlapHeight(a,b));
      let best={x:a.x,z:a.z,vx:0,vz:0,score:-Infinity};
      const directX=a.x+ux*speed*dt,directZ=a.z+uz*speed*dt;
      const open=speed>.0001&&allowed(a,directX,directZ)&&neighbours.every(b=>{
        const r=a.radius+b.radius+GAP;
        return sweptDistanceSquared(a.oldX,a.oldZ,directX,directZ,b.oldX,b.oldZ,b.x,b.z)>=r*r&&sweptDistanceSquared(directX,directZ,directX+ux*speed*.7,directZ+uz*speed*.7,b.x,b.z,b.x+b.vx*.7,b.z+b.vz*.7)>(r+.35)**2;
      });
      if(open)best={x:directX,z:directZ,vx:ux*speed,vz:uz*speed,score:Infinity};
      if(!open&&speed>.0001)for(const {angle:turn,cos:c,sin:s} of turns)for(const pace of [1,.5]){
        const vx=(ux*c+uz*s)*speed*pace,vz=(uz*c-ux*s)*speed*pace,x=a.x+vx*dt,z=a.z+vz*dt;
        if(!allowed(a,x,z))continue;
        let clear=true,comfort=0;
        for(const b of neighbours){
          const separation=a.radius+b.radius+GAP;
          if(sweptDistanceSquared(a.oldX,a.oldZ,x,z,b.oldX,b.oldZ,b.x,b.z)<separation*separation-1e-10){clear=false;break;}
          const predicted=sweptDistanceSquared(x,z,x+vx*.7,z+vz*.7,b.x,b.z,b.x+b.vx*.7,b.z+b.vz*.7);
          comfort+=Math.max(0,separation+.35-Math.sqrt(predicted));
        }
        if(!clear)continue;
        // Prefer forward progress and early, consistent right-hand passing.
        const score=(vx*ux+vz*uz)-comfort*2.5-Math.abs(turn)*.08+(turn>0?.025:0)-Math.hypot(vx-a.vx,vz-a.vz)*.08;
        if(score>best.score)best={x,z,vx,vz,score};
      }
      const travelled=Math.hypot(best.x-a.x,best.z-a.z),progress=routeSpeed>.001?Math.max(0,((best.x-a.x)*fx+(best.z-a.z)*fz)/routeSpeed):0;
      a.x=best.x;a.z=best.z;a.vx=best.vx;a.vz=best.vz;moveCell(a);
      if(a.pose.walking&&routeSpeed>.001)a.delay+=dt*(1-Math.min(1,progress/(routeSpeed*dt)));
      a.travel+=travelled;
      const motion=Math.min(1,travelled/(dt*Math.max(.65,a.person.speed??.85)));
      a.pose={...a.pose,walking:motion>.025,motion,gait:gaitPhase(a.travel,a.person,a.person.action==='jog')+a.gaitOrigin-a.person.phase};
      if(travelled>.0001){const angle=Math.atan2(best.vx,best.vz),turn=Math.atan2(Math.sin(angle-a.heading),Math.cos(angle-a.heading));a.heading+=Math.max(-dt*4,Math.min(dt*4,turn));}a.pose.rotation=a.heading;a.pose.angle=a.heading;
    }
  }
  function update(time,nextGroups){
    const versions=nextGroups.map(g=>g.revision||0).join(',');
    const changed=versions!==groupVersions||groups.length!==nextGroups.length||groups.some((g,i)=>g!==nextGroups[i]);
    if(!changed&&time===lastTime)return result;
    if(changed){
      const previous=new Map(agents.map(a=>[a.id,a]));
      groups=[...nextGroups];groupVersions=versions;agents=groups.flatMap(group=>group.people.map((person,index)=>({...previous.get(`${group.id}:${person.identity??index}`),group,person,index,id:`${group.id}:${person.identity??index}`,mobile:Boolean(person.walking)||movingActions.has(person.action),radius:pedestrianRadius(person),height:1.8*(person.height??1)})));
      agents.sort((a,b)=>Number(a.mobile)-Number(b.mobile)||a.id.localeCompare(b.id));
    }
    // Long invisible gaps and backwards preview seeks are placed afresh. Live
    // playback always takes short, swept steps, including a slow device's frame.
    const elapsed=time-lastTime;
    if(changed||!Number.isFinite(lastTime)||elapsed<0||elapsed>.5)reset(time,changed&&Number.isFinite(lastTime)&&elapsed>=0&&elapsed<=.5);
    else if(elapsed>0){const count=Math.ceil(elapsed/STEP),dt=elapsed/count;for(let i=1;i<=count;i++)tick(lastTime+dt*i,dt);}
    result=new Map(groups.map(g=>[g,new Array(g.people.length)]));
    for(const a of agents){
      const s={...a.pose,x:a.x-a.group.offsetX,z:a.z-a.group.offsetZ};
      s.ground=a.group.ground(s,a.person);result.get(a.group)[a.index]=s;
    }
    lastTime=time;revision++;return result;
  }
  return {update,get revision(){return revision;},get agents(){return agents;}};
}
