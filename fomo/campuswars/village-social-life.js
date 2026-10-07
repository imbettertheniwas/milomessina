import {hash} from './village-district-layout.js?v=80';
import {conversation} from './village-human-behavior.js?v=162';
import {gaitPhase,smooth} from './village-human-motion.js?v=162';

const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*smooth(t);
const world=(lot,p)=>({x:lot.x+p.x*Math.cos(lot.rotation)+p.z*Math.sin(lot.rotation),z:lot.z-p.x*Math.sin(lot.rotation)+p.z*Math.cos(lot.rotation)});
const ground=(x,z)=>.045+.085*smooth((7.5-Math.abs(x))/.25)*smooth((12-z)/.25)+.07*smooth((.825-Math.abs(x))/.2)*smooth((12-z)/.25);
// Route around the table tops. Live pedestrian steering handles other guests.
const obstacles=[{x:3.8,z:9.8,w:1.12,d:1.8},{x:-3.9,z:9.8,w:1.72,d:1.11}];
function clear(a,b){
  return obstacles.every(r=>{
    let lo=0,hi=1;
    for(const [axis,half] of [['x',r.w],['z',r.d]]){
      const delta=b[axis]-a[axis],min=r[axis]-half,max=r[axis]+half;
      if(Math.abs(delta)<1e-9){if(a[axis]<=min||a[axis]>=max)return true;}
      else {let u=(min-a[axis])/delta,v=(max-a[axis])/delta;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>=hi)return true;}
    }
    return false;
  });
}
function route(start,end){
  const nodes=[start,end,...obstacles.flatMap(r=>[-1,1].flatMap(s=>[-1,1].map(t=>({x:r.x+s*(r.w+.04),z:r.z+t*(r.d+.04)}))))];
  const dist=nodes.map(()=>Infinity),prev=[],seen=new Set();dist[0]=0;
  while(!seen.has(1)){
    let i=-1;for(let j=0;j<nodes.length;j++)if(!seen.has(j)&&(i<0||dist[j]<dist[i]))i=j;
    if(i<0||!Number.isFinite(dist[i]))return [start,end];seen.add(i);
    for(let j=0;j<nodes.length;j++)if(!seen.has(j)&&clear(nodes[i],nodes[j])){const d=dist[i]+Math.hypot(nodes[j].x-nodes[i].x,nodes[j].z-nodes[i].z);if(d<dist[j]){dist[j]=d;prev[j]=i;}}
  }
  const path=[];for(let i=1;i!==undefined;i=prev[i])path.unshift(nodes[i]);return path;
}
function leg(points,speed){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.z-points[i].z));
  const length=lengths.reduce((a,b)=>a+b,0);return {points,lengths,length,duration:length/speed+1.2};
}
export function assignSocialLife(people,groups,size){
  const lawn=groups.filter(g=>g.seats[0]?.ground<.5);
  for(const p of people){
    if(p.action||p.ground>.5)continue;
    // Roughly one in six guests keeps dancing. Everyone else talks or mingles.
    p.danceGuest=!p.walking&&hash(p.identity,'likes-dancing')<.18;
  }
  lawn.forEach((group,i)=>{
    const visitor=group.seats.filter(p=>!p.danceGuest).sort((a,b)=>b.local.z-a.local.z)[0];
    if(!visitor||lawn.length<2||group.seats.length<3)return;
    const target=lawn[(i+1)%lawn.length],start=visitor.local;
    // Stand on the street-facing edge of the next group, facing its center.
    const end={x:target.x,z:target.z+target.radius+.48};
    const speed=.62+hash(visitor.identity,'mingle-speed')*.22;
    visitor.social={home:{...visitor},away:{...visitor,groupPhase:target.seats[0].groupPhase,turnDuration:target.seats[0].turnDuration,groupSize:target.seats.length+1,seat:target.seats.length,rotation:visitor.lot.rotation+Math.PI},out:leg([...route(start,{x:start.x,z:14.7}),{x:end.x,z:14.7},end],speed),back:leg([end,{x:end.x,z:14.7},{x:start.x,z:14.7},start],speed),homeWait:30+hash(visitor.identity,'home-chat')*30,awayWait:24+hash(visitor.identity,'away-chat')*30,offset:hash(visitor.identity,'social-offset')*130};
    visitor.danceGuest=false;
    for(const p of target.seats)p.groupSize=target.seats.length+1;
  });
  // Existing roaming guests occasionally enter the house, linger, then return.
  people.filter(p=>p.walking).forEach((p,i)=>{
    const target=lawn[i%lawn.length];if(!target)return;
    const start={x:target.x,z:target.z+target.radius+.6},door={x:0,z:size.offsetZ+3.05*size.depthScale};
    const path=[start,{x:start.x,z:14.7},{x:0,z:14.7},{x:0,z:7},door],speed=.72+hash(p.identity,'door-speed')*.16;
    p.danceGuest=false;p.local=start;
    p.social={home:{...p,groupPhase:target.seats[0].groupPhase,turnDuration:target.seats[0].turnDuration,groupSize:target.seats.length+1,seat:target.seats.length,rotation:p.lot.rotation+Math.PI},away:{...p},out:leg(path,speed),back:leg([...path].reverse(),speed),homeWait:36+hash(p.identity,'door-chat')*24,awayWait:14+hash(p.identity,'inside')*18,offset:hash(p.identity,'door-offset')*100,door:true,size};
    for(const host of target.seats)host.groupSize=target.seats.length+1;
  });
}
function travel(person,trip,t,reverse){
  const ramp=.6,cruise=trip.duration-2*ramp;
  const integral=u=>u*u*u-.5*u*u*u*u;
  let d=t<ramp?ramp*integral(t/ramp):t<ramp+cruise?ramp/2+t-ramp:ramp/2+cruise+ramp*((t-ramp-cruise)/ramp-integral((t-ramp-cruise)/ramp));
  d=Math.max(0,Math.min(trip.length,d*trip.length/(cruise+ramp)));
  let remaining=d,index=0;while(index<trip.lengths.length-1&&remaining>trip.lengths[index])remaining-=trip.lengths[index++];
  const a=trip.points[index],b=trip.points[index+1],u=remaining/(trip.lengths[index]||1),p={x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u};
  const heading=person.lot.rotation+Math.atan2(b.x-a.x,b.z-a.z),social=person.social;
  const from=reverse?social.away.rotation:social.home.rotation,to=reverse?social.home.rotation:social.away.rotation;
  const rotation=t<.8?turn(from??heading,heading,t/.8):t>trip.duration-.8?turn(heading,to??heading,(t-trip.duration+.8)/.8):heading;
  let y=ground(p.x,p.z);
  if(social.door)y+=smooth((6.8-p.z)/1.6)*(.73*social.size.scaleY-y);
  return {...world(person.lot,p),rotation,ground:y,walking:true,motion:smooth(t/ramp)*smooth((trip.duration-t)/ramp),gait:gaitPhase(d,person),speaking:false,gesture:0,doorVisit:social.door,social:true};
}
export function socialActivity(person,time){
  const s=person.social,period=s.homeWait+s.out.duration+s.awayWait+s.back.duration;
  let t=((time+s.offset)%period+period)%period;
  const idle=(guest,point,hidden=false)=>({...world(person.lot,point),rotation:guest.rotation??person.rotation,ground:s.door&&hidden?.73*s.size.scaleY:ground(point.x,point.z),walking:false,gait:0,...conversation(guest,time),hidden,doorVisit:s.door,social:true});
  if(t<s.homeWait)return idle(s.home,s.out.points[0]);t-=s.homeWait;
  if(t<s.out.duration)return travel(person,s.out,t,false);t-=s.out.duration;
  if(t<s.awayWait)return idle(s.away,s.out.points.at(-1),s.door);t-=s.awayWait;
  return travel(person,s.back,t,true);
}
