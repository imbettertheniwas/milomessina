import {toWorld,lawnGround} from './village-layout.js?v=112';
import {smooth} from './village-human-motion.js?v=80';

export const ARRIVAL_HEIGHT=36,ARRIVAL_FALL=9,ARRIVAL_SETTLE=.65,ARRIVAL_RETURN=1.4;
const duration=ARRIVAL_FALL+ARRIVAL_SETTLE+ARRIVAL_RETURN;
const delay=(member,from)=>Math.min((member-from-1)*.55,5);

// Public aggregate increases provide anonymous member slots, never identities.
// Keep this controller outside the renderer so rank changes and streaming cannot
// restart a fall or lose arrivals while an asynchronous house build finishes.
export function createLiveArrivals(){
  let queued=[],revision=0;
  const active=new Map();
  function enqueue(ranges=[]){queued.push(...ranges);}
  function start(chapters,time,reduced=false,defer=false){
    const counts=new Map(chapters.map(c=>[c.id,c.joined]));
    for(const [id,ranges] of active){
      const next=ranges.map(r=>({...r,to:Math.min(r.to,counts.get(id)??0)})).filter(r=>r.to>r.from);
      if(next.length)active.set(id,next);else active.delete(id);
    }
    if(defer&&!reduced){advance(time);return;}
    if(!reduced)for(const range of queued){
      const to=Math.min(range.to,counts.get(range.chapter)??0);
      if(to<=range.from)continue;
      if(!active.has(range.chapter))active.set(range.chapter,[]);
      active.get(range.chapter).push({...range,to,start:time});
    }
    if(queued.length)revision++;
    queued=[];
    advance(time);
  }
  function advance(time){
    for(const [id,ranges] of active){
      const next=ranges.filter(r=>time-r.start<duration+delay(r.to,r.from));
      if(next.length)active.set(id,next);else active.delete(id);
    }
  }
  function pose(member,state,time){
    const range=active.get(member.chapter)?.find(r=>member.member>r.from&&member.member<=r.to);
    if(!range)return state;
    const elapsed=time-range.start-delay(member.member,range.from);
    if(elapsed>=duration)return state;
    // Ordinary lawn positions land in place. Porch/building roles first touch
    // down on the front grass, then ease back into their existing activity.
    const dx=state.x-member.lot.x,dz=state.z-member.lot.z,c=Math.cos(member.lot.rotation),s=Math.sin(member.lot.rotation);
    const local={x:dx*c-dz*s,z:dx*s+dz*c};
    const onLawn=Math.abs(local.x)>.95&&Math.abs(local.x)<8.5&&local.z>=7&&local.z<=14.8&&(state.ground??member.ground??0)<.3;
    const x=onLawn?local.x:((member.member%2?1:-1)*(2+(member.member%4)*1.3)),z=onLawn?local.z:13.1;
    const landing=toWorld(member.lot,x,z),ground=lawnGround(x,z);
    const falling=elapsed<ARRIVAL_FALL;
    const fall=Math.min(1,Math.max(0,elapsed)/ARRIVAL_FALL);
    const settle=Math.max(0,elapsed-ARRIVAL_FALL)/ARRIVAL_SETTLE;
    const returning=smooth((elapsed-ARRIVAL_FALL-ARRIVAL_SETTLE)/ARRIVAL_RETURN);
    const height=falling?ARRIVAL_HEIGHT*(1-fall):settle<1?.32*Math.sin(Math.PI*settle):0;
    const sway=falling?Math.sin(Math.PI*fall):0;
    return {...state,x:landing.x+(state.x-landing.x)*returning+Math.sin(elapsed*1.3+member.member)*.45*sway,z:landing.z+(state.z-landing.z)*returning+Math.cos(elapsed+member.member)*.25*sway,
      ground:ground+height+((state.ground??member.ground??0)-ground)*returning,
      walking:returning>0&&returning<1,motion:returning>0?Math.sin(Math.PI*returning):0,gait:elapsed*7,
      construction:state.construction?{...state.construction,mode:'arrival',effort:0,carry:0,delivered:0,bend:0}:undefined,pong:undefined,gesture:0,speaking:false,
      arrival:{canopy:falling?1:1-smooth(settle),arms:falling?1:1-smooth(settle),crouch:falling?0:Math.sin(Math.PI*Math.min(1,settle))*.18}};
  }
  return {enqueue,start,advance,pose,get revision(){return revision;},has:chapter=>active.has(chapter)};
}
