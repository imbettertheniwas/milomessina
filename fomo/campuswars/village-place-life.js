import {marketJourneys,greenTrail} from './village-place-layout.js?v=80';

export function placePeople(kind,add){
  const group=(x,z,n,extra={})=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2;add('talk',x+Math.sin(a)*1.35,z+Math.cos(a)*1.35,a+Math.PI,{seat:i,groupSize:n,groupPhase:x+z,...extra});}};
  const walk=(points,n,purpose,extra={})=>{for(let i=0;i<n;i++)add('journey',points[0][0],points[0][1],0,{points,offset:i*19,speed:.85+i%3*.09,purpose,...extra});};
  if(kind==='town'){
    for(const journey of marketJourneys)walk(journey.points,journey.carry==='parcel'?2:5,journey.purpose,{carry:journey.carry,pickupIndex:journey.pickupIndex,dropoffIndex:journey.dropoffIndex});
    for(const side of [-1,1])walk([[side*10,-39,3],[side*10,39,4]],5,'walk the shopping street');
    for(const [x,z] of [[19,24],[28,24],[20,32],[31,32],[-23,23],[-34,25]])for(const side of [-1,1])add('study',x+side*1.05,z,side<0?Math.PI/2:-Math.PI/2,{dayOnly:z===32});
    group(34,28,5);group(-23,31,5,{dayOnly:true});group(16,29,5,{nightOnly:true});group(27,35,5,{nightOnly:true});
    for(let i=0;i<6;i++)add('queue',12.2,-28+i*.8,Math.PI/2);
    return true;
  }
  if(kind==='green'){
    walk(greenTrail.map(p=>[...p,0]),7,'woodland walk',{dayOnly:true});
    walk([[9,-39,2],[15,-26,0],[23,-15,0],[29,3,0],[21,25,0],[9,39,2]],5,'walk through the green');
    for(const [x,z] of [[19,-17],[35,4],[22,20]])for(const side of [-1,1])add('study',x+side*1.05,z,side<0?Math.PI/2:-Math.PI/2,{dayOnly:true});
    for(let i=0;i<4;i++)add('lawn',32,17+i*3,.8,{dayOnly:true});
    group(17,10,4,{dayOnly:true});
    for(const [x,z,a] of [[-23,-4,0],[-27,8,.3]])for(const dx of [-.45,.45])add('sit',x+dx,z,a);
    return true;
  }
  if(kind==='residential'){
    for(const side of [-1,1]){
      walk([[side*10,-39,5],[side*10,39,5]],4,'walk home');
      for(const z of [-23,20]){
        const center=z>0?29:27,w=z>0?20:17;
        for(const seat of [-1,1])add('sit',side*(center-9.6),z+side*seat*w*.265,-side*Math.PI/2,{ground:.68});
        walk([[side*10,39,3],[side*10,z,0],[side*(center-12.6),z,10],[side*10,z,0],[side*10,39,3]],2,'bring a parcel home',{carry:'parcel'});
      }
      for(const seat of [-1,1])add('study',side*29+seat*1.05,0,seat<0?Math.PI/2:-Math.PI/2,{dayOnly:true});
    }
    return true;
  }
  return false;
}
