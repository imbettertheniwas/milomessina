// Shared addresses keep storefronts, furniture and everyday journeys aligned.
export const marketShops=[
  {x:25,z:-28,width:16,depth:20,height:10,rotation:-Math.PI/2,label:'CORNER SLICE',color:0xa85942,awning:0x9b3f36},
  {x:25,z:-10,width:17,depth:20,height:13,rotation:-Math.PI/2,label:'AFTER HOURS',color:0xbaa181,awning:0x344d48},
  {x:25,z:9,width:16,depth:20,height:9,rotation:-Math.PI/2,label:'SECOND HAND',color:0x748e88,awning:0xd0aa65},
  {x:-26,z:-25,width:19,depth:19,height:11,rotation:Math.PI/2,label:'CAMPUS MARKET',color:0xb6805c,awning:0x3b6455},
  {x:-27,z:-3,width:18,depth:21,height:8,rotation:Math.PI/2,label:'NEEDLE & GROOVE',color:0x8a6f60,awning:0x59617c}
];
export const marketPaths=[[[10,-40],[10,40]], [[-10,-40],[-10,40]], [[-40,40],[40,40]], [[10,26],[36,26]], [[-10,17],[-34,17]]];
export const greenTrail=[[-9,-39],[-15,-30],[-14,-8],[-21,9],[-14,28],[-9,39]];

// Closed journeys stop at real destinations. Each point is [x,z,waitSeconds].
export const marketJourneys=[
  {purpose:'pick up pizza',carry:'pizza',pickupIndex:2,points:[[10,40,2],[10,-28,0],[13,-28,9],[10,-28,0],[10,40,2]]},
  {purpose:'records to patio',points:[[-14,-3,6],[-10,-3,0],[-10,40,0],[10,40,0],[10,26,0],[23,26,13],[10,26,0],[10,40,0],[-10,40,0],[-10,-3,0],[-14,-3,2]]},
  {purpose:'market delivery',carry:'parcel',dropoffIndex:3,points:[[-38,-37,4],[-11,-37,0],[-11,-25,0],[-14,-25,9],[-11,-25,0],[-11,-37,0],[-38,-37,4]]}
];

const journeyCache=new WeakMap();
export function journeyPose(points,time,speed=1,offset=0){
  let speeds=journeyCache.get(points);if(!speeds){speeds=new Map();journeyCache.set(points,speeds);}
  let route=speeds.get(speed);
  if(!route){
    const segments=[];let duration=0,distance=0;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(a[2]){segments.push({a,b,start:duration,duration:a[2],distance,length:0,pointIndex:i});duration+=a[2];}
      if(length){const seconds=length/speed+1;segments.push({a,b,start:duration,duration:seconds,distance,length,pointIndex:i});duration+=seconds;distance+=length;}
    }
    for(let i=0;i<segments.length;i++){
      const s=segments[i],outgoing=Array.from({length:segments.length},(_,j)=>segments[(i+j)%segments.length]).find(p=>p.length)||s;
      s.angle=Math.atan2(outgoing.b[0]-outgoing.a[0],outgoing.b[1]-outgoing.a[1]);
    }
    for(let i=0;i<segments.length;i++)segments[i].entryAngle=segments[(i-1+segments.length)%segments.length].angle;
    route={segments,duration,distance};speeds.set(speed,route);
  }
  const {segments,duration,distance}=route;
  const clock=((time+offset)%duration+duration)%duration;
  const s=segments.find(s=>clock<s.start+s.duration)||segments.at(-1),u=(clock-s.start)/s.duration;
  // Ease the first/last half-second; distance drives the gait, including stops.
  const edge=.5/s.duration,integral=v=>v<edge?v*v/(2*edge):v>1-edge?1-edge-(1-v)*(1-v)/(2*edge):v-edge/2;
  const progress=s.length?integral(u)/(1-edge):0;
  const turn=Math.max(0,Math.min(1,(clock-s.start)/Math.min(.7,s.duration))),ease=turn*turn*(3-2*turn);
  const angle=s.entryAngle+Math.atan2(Math.sin(s.angle-s.entryAngle),Math.cos(s.angle-s.entryAngle))*ease;
  return {x:s.a[0]+(s.b[0]-s.a[0])*progress,z:s.a[1]+(s.b[1]-s.a[1])*progress,angle,walking:s.length>0,distance:Math.floor((time+offset)/duration)*distance+s.distance+s.length*progress,motion:s.length?Math.min(1,u/edge,(1-u)/edge):0,duration,pointIndex:s.pointIndex};
}
