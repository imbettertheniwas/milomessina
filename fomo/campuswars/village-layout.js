import {conversation,personalClock} from './village-human-behavior.js?v=80';
import {rankedHouseSizes} from './village-house-sizing.js?v=105';
import {hash,appearance,roundedLoop,motionProfile} from './village-district-layout.js?v=80';
import {gaitPhase,smooth} from './village-human-motion.js?v=80';
import {constructionAssignment,constructionActivity} from './village-construction-layout.js?v=80';
const lawnRoute=roundedLoop(-7.9,7,7.9,14.4,1.15);
// Ease over the low lawn/path edges; the walking loop clears the porch steps.
export function lawnGround(x,z){const edge=smooth((12-z)/.25);return .045+.085*smooth((7.5-Math.abs(x))/.25)*edge+.07*smooth((.825-Math.abs(x))/.2)*edge;}
export const LOTS = [
  {x:-20,z:-19,rotation:Math.PI/2,style:0},
  {x:20,z:-19,rotation:-Math.PI/2,style:1},
  {x:-20,z:0,rotation:Math.PI/2,style:2},
  {x:20,z:0,rotation:-Math.PI/2,style:3},
  {x:-20,z:19,rotation:Math.PI/2,style:4},
  {x:20,z:19,rotation:-Math.PI/2,style:5}
];
// A street carries ten plots down each side, twenty in all. Beyond that the
// village grows sideways onto the next parallel street rather than into one
// endless row: streets sit on the campus road grid, alternating east then west
// of the original boulevard.
export const STREET_SIDE_CAPACITY=10,STREET_CAPACITY=STREET_SIDE_CAPACITY*2,STREET_SPACING=100;
// One of the main street's twenty plots belongs to the claimable lot for good,
// so the boulevard houses the nineteen best chapters and the twentieth moves to
// the next street rather than pushing the row a row longer.
export const MAIN_STREET_HOUSES=STREET_CAPACITY-1;
export const streetOriginX=street=>street?(street%2?1:-1)*Math.ceil(street/2)*STREET_SPACING:0;
export function streetCount(chapterCount){return 1+Math.max(0,Math.ceil((chapterCount-MAIN_STREET_HOUSES)/STREET_CAPACITY));}
const plot=(index,street,slot)=>{
  const originX=streetOriginX(street);
  return {x:originX+(slot%2?20:-20),z:-19+Math.floor(slot/2)*19,rotation:slot%2?-Math.PI/2:Math.PI/2,style:index%5,street,originX};
};
function housePlot(index){
  if(index<MAIN_STREET_HOUSES)return plot(index,0,index);
  const beyond=index-MAIN_STREET_HOUSES;
  return plot(index,1+Math.floor(beyond/STREET_CAPACITY),beyond%STREET_CAPACITY);
}
export function createLots(chapterCount) {
  if (!Number.isSafeInteger(chapterCount) || chapterCount < 0) throw new RangeError('Invalid chapter count');
  const houses=Array.from({length:chapterCount},(_,i)=>housePlot(i));
  // The claimable lot holds the reserved plot at the end of the main street,
  // waiting beside the last house until the boulevard fills in around it.
  return [...houses,plot(chapterCount,0,Math.min(chapterCount,MAIN_STREET_HOUSES))];
}
// Every street shares one world length, so the deepest of them sets the extension.
export function rowExtension(chapterCount) {
  const rows=Math.max(...createLots(chapterCount).map(lot=>lot.z))/19+2;
  return Math.max(0,rows-3)*19;
}
export function toWorld(lot,x,z){return {x:lot.x+x*Math.cos(lot.rotation)+z*Math.sin(lot.rotation),z:lot.z-x*Math.sin(lot.rotation)+z*Math.cos(lot.rotation)};}
export const PONG_TABLE={x:3.8,z:9.8,width:1.25,length:2.6,height:.86,playerDistance:2.05};
// Die is played on an eight-by-four sheet: partners share an end, opponents face
// them down the long axis, and each player stands behind a cup set eight inches
// from their back rail and five in from the side.
// The eight-foot axis lies across the lawn, where there is room for it.
export const DIE_TABLE={x:-3.9,z:9.8,width:2.44,depth:1.22,height:.76,playerDistance:1.72,seatOffset:.42,cupInset:.13,cupBack:.2};
export const dieSeat=seat=>({side:seat<2?-1:1,dz:(seat%2?1:-1)*DIE_TABLE.seatOffset});
export const dieSeatSpot=seat=>{const {side,dz}=dieSeat(seat);return {x:DIE_TABLE.x+side*DIE_TABLE.playerDistance,z:DIE_TABLE.z+dz,rotation:side<0?Math.PI/2:-Math.PI/2};};
export const dieCup=seat=>{const {side,dz}=dieSeat(seat);return {x:DIE_TABLE.x+side*(DIE_TABLE.width/2-DIE_TABLE.cupBack),z:DIE_TABLE.z+Math.sign(dz)*(DIE_TABLE.depth/2-DIE_TABLE.cupInset)};};
export {motionProfile} from './village-district-layout.js?v=80';
export function pongTurn(chapter,time){
  const period=3.8+hash(chapter,'pong-period')*2.1,clock=time+hash(chapter,'pong-offset')*19,turn=Math.floor(clock/period);
  return {seat:((turn%2)+2)%2,elapsed:clock-turn*period,release:1.15,flight:.85,turn};
}
export function dieTurn(chapter,time){
  // Play passes around the table. The throw is a high lob that has to clear head
  // height and land past the half line; it either sinks or the defender catches it.
  const period=4.6+hash(chapter,'die-period')*1.9,clock=time+hash(chapter,'die-offset')*23,turn=Math.floor(clock/period);
  const seat=((turn%4)+4)%4;
  return {seat,target:(seat<2?2:0)+Math.abs(turn%2),sink:hash(chapter,turn,'die-sink')>.74,elapsed:clock-turn*period,release:1.1,toss:.82,settle:.74,turn};
}
export function crowdMembers(chapters,lots=createLots(chapters.length),houseSizes=rankedHouseSizes(chapters)){
  return chapters.flatMap((chapter,index)=>{
    if(!Number.isSafeInteger(chapter.joined)||chapter.joined<0)throw new RangeError('Invalid member count');
    if(chapter.joined<15)return Array.from({length:chapter.joined},(_,workerIndex)=>{
      const construction=constructionAssignment(chapter,workerIndex),member=workerIndex+1,lot=lots[index];
      const person={...appearance(chapter.id,member),chapter:chapter.id,member,lot,construction,
        action:'build',walking:false,phase:hash(chapter.id,member,'phase')*20,ground:.13,
        backpack:false,jacket:false,shorts:false,motionProfile:motionProfile(chapter.id,member)};
      const pose=constructionActivity(person,0);return {...person,x:pose.x,z:pose.z,rotation:pose.rotation};
    });
    const lot=lots[index],walkers=Math.floor(chapter.joined/20),standing=chapter.joined-walkers,pong=chapter.joined>=15,die=chapter.joined>=15,porch=chapter.joined>=15&&standing>=9,sizes=[];
    let remaining=standing-(porch?2:0)-(pong?2:0)-(die?4:0);
    while(remaining>0){let size=sizes.length===0&&remaining>=12?7:2+Math.floor(hash(chapter.id,sizes.length,'group-size')*4);size=Math.min(size,remaining);if(remaining-size===1)size++;sizes.push(size);remaining-=size;}
    if(porch)sizes.push(2);
    const groups=[],occupied=[];let member=0;
    if(pong){
      // Reserve the table and both players before placing conversation groups.
      for(let x=-.8;x<=.81;x+=.4)for(let z=-1.5;z<=1.51;z+=.3)occupied.push({x:PONG_TABLE.x+x,z:PONG_TABLE.z+z});
      for(const side of [-1,1])occupied.push({x:PONG_TABLE.x,z:PONG_TABLE.z+side*PONG_TABLE.playerDistance});
    }
    if(die){
      for(let x=-1.3;x<=1.31;x+=.35)for(let z=-.7;z<=.71;z+=.35)occupied.push({x:DIE_TABLE.x+x,z:DIE_TABLE.z+z});
      for(let seat=0;seat<4;seat++)occupied.push(dieSeatSpot(seat));
    }
    sizes.forEach((size,g)=>{
      const isPorch=porch&&g===sizes.length-1,radius=isPorch?.57:.62+size*.105,phase=hash(chapter.id,g,'angle')*Math.PI*2;
      let best=null,bestScore=-Infinity;
      for(let attempt=0;attempt<(isPorch?1:250);attempt++){
        const gx=isPorch?2.05:(hash(chapter.id,g,attempt,'x')-.5)*(14.4-2*radius),gz=isPorch?5.05:7.7+radius+hash(chapter.id,g,attempt,'z')*(5.6-2*radius);
        const seats=Array.from({length:size},(_,seat)=>{const a=phase+seat*Math.PI*2/size,r=radius*(.92+hash(chapter.id,g,seat,'radius')*.16);return {x:gx+Math.sin(a)*r,z:gz+Math.cos(a)*r,a};});
        let clearance=3;for(const seat of seats)for(const other of occupied)clearance=Math.min(clearance,Math.hypot(seat.x-other.x,seat.z-other.z));
        const centerGap=groups.length?Math.min(...groups.map(other=>Math.hypot(other.x-gx,other.z-gz)-other.radius-radius)):2;
        const score=clearance*4+Math.max(-1,Math.min(.5,centerGap))*.3-(Math.abs(gx)<.7?.15:0);
        if(score>bestScore){bestScore=score;best={x:gx,z:gz,radius,seats};}
      }
      groups.push(best);occupied.push(...best.seats);
      for(let seat=0;seat<size;seat++){
        const pos=best.seats[seat],look=appearance(chapter.id,member+1),buildingSize=houseSizes.get(chapter.id);
        const x=isPorch?pos.x*buildingSize.scaleX:pos.x,z=isPorch?pos.z*buildingSize.depthScale+buildingSize.offsetZ:pos.z;
        best.seats[seat]={chapter:chapter.id,member:++member,...toWorld(lot,x,z),lot,rotation:lot.rotation+pos.a+Math.PI,phase:hash(chapter.id,member,'phase')*20,groupPhase:hash(chapter.id,g,'turn')*50,turnDuration:4.2+hash(chapter.id,g,'turn-duration')*4.2,groupSize:size,seat,walking:false,ground:isPorch?.73*buildingSize.scaleY:lawnGround(pos.x,pos.z),...look};
      }
    });
    const people=groups.flatMap(group=>group.seats);
    for(let i=0;i<walkers;i++)people.push({chapter:chapter.id,member:++member,...toWorld(lot,0,9),lot,rotation:lot.rotation,phase:hash(chapter.id,member,'phase')*20,groupPhase:0,groupSize:1,seat:0,walking:true,walkPhase:i/walkers*Math.PI*2,ground:0,...appearance(chapter.id,member)});
    if(pong)for(let seat=0;seat<2;seat++){
      const z=PONG_TABLE.z+(seat?1:-1)*PONG_TABLE.playerDistance;
      people.push({chapter:chapter.id,member:++member,...toWorld(lot,PONG_TABLE.x,z),lot,rotation:lot.rotation+(seat?Math.PI:0),phase:hash(chapter.id,member,'phase')*20,groupPhase:-1,groupSize:2,seat,walking:false,action:'pong',ground:lawnGround(PONG_TABLE.x,z),...appearance(chapter.id,member)});
    }
    if(die)for(let seat=0;seat<4;seat++){
      const spot=dieSeatSpot(seat);
      people.push({chapter:chapter.id,member:++member,...toWorld(lot,spot.x,spot.z),lot,rotation:lot.rotation+spot.rotation,phase:hash(chapter.id,member,'phase')*20,groupPhase:-1,groupSize:4,seat,walking:false,action:'die',ground:lawnGround(spot.x,spot.z),...appearance(chapter.id,member)});
    }
    for(const person of people)person.motionProfile=motionProfile(person.chapter,person.member);
    return people;
  });
}
export function activityPose(member,time){
  if(member.action==='build')return constructionActivity(member,time);
  if(member.walking){
    const clock=personalClock(member,time);
    const distance=clock.time*(member.motionProfile?.walkSpeed??.76)+member.walkPhase/(Math.PI*2)*lawnRoute.length,s=lawnRoute.sample(distance),ahead=lawnRoute.sample(distance+.24);
    const look=Math.atan2(Math.sin(ahead.angle-s.angle),Math.cos(ahead.angle-s.angle))*.45+clock.attention;
    return {...toWorld(member.lot,s.x,s.z),rotation:member.lot.rotation+s.angle,walking:clock.motion>.001,motion:clock.motion,ground:lawnGround(s.x,s.z),gait:gaitPhase(distance,member),look,speaking:false,gesture:0,breath:Math.sin(time*2+member.phase)*.007};
  }
  if(member.action==='pong'){
    const shot=pongTurn(member.chapter,time),active=shot.seat===member.seat,t=shot.elapsed;
    return {x:member.x,z:member.z,rotation:member.rotation,walking:false,gait:0,speaking:false,gesture:0,breath:0,pong:{lift:active?smooth(t/.65)*(1-smooth((t-1.5)/.8)):.18*smooth((t-1.8)/.3)*(1-smooth((t-2.3)/.5)),extension:smooth((t-.72)/.43)}};
  }
  if(member.action==='die'){
    // Throwing and catching arms both ride the pong toss channel: the thrower
    // winds up and lofts, and the defender reaches up as the die comes down.
    const shot=dieTurn(member.chapter,time),t=shot.elapsed,hit=shot.release+shot.toss,caught=hit+shot.settle;
    let lift=0,extension=0;
    if(shot.seat===member.seat){lift=smooth(t/.5)*(1-smooth((t-shot.release-.45)/.6));extension=smooth((t-shot.release+.3)/.45);}
    else if(shot.target===member.seat&&!shot.sink){lift=smooth((t-hit+.5)/.55)*(1-smooth((t-caught-.3)/.5));extension=smooth((t-hit+.2)/.5);}
    return {x:member.x,z:member.z,rotation:member.rotation,walking:false,gait:0,speaking:false,gesture:0,breath:0,pong:{lift,extension}};
  }
  const profile=member.motionProfile,{speaking,gesture}=conversation(member,time);
  // The speaking hand rises only to chest level; listeners keep their arms down.
  return {x:member.x,z:member.z,rotation:member.rotation+Math.sin(time*(profile?.lookRate??.47)+member.phase)*(profile?.lookAmount??.055),walking:false,gait:0,speaking,gesture:gesture*(profile?.gestureAmount??1),breath:Math.sin(time*(profile?.breathRate??1.7)+member.phase)*(profile?.breathAmount??.008)};
}
