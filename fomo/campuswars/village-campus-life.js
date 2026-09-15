import {createPedestrianSpacing,pedestrianGroup} from './village-pedestrian-spacing.js?v=103';
import {createDistantCrowd} from './village-distant-crowd.js?v=113';
import {DETAIL_COUNT,detailSlots,hairShape,detailColors,dressPerson,backHair} from './village-human-style.js?v=80';
import {personalClock,conversation} from './village-human-behavior.js?v=80';
import {campusGroundHeight,isCampusHill,campusRamp} from './village-campus-hill.js?v=105';
import {FOMO_VEHICLE_COLOR} from './village-vehicles.js?v=77';
import {gaitPhase,humanPose,smooth} from './village-human-motion.js?v=80';
import {roundedLoop,mod,hash,appearance,palettes,districtSpecs} from './village-district-layout.js?v=80';
import {journeyPose} from './village-place-layout.js?v=80';
import {placePeople} from './village-place-life.js?v=80';

// Physical routes keep activity on sidewalks, lawns and bike lanes.
export function campusPeople(kind,cx,cz,streets=1,extension=0){
  const core=kind==='greek',people=[];
  const add=(action,x,z,angle=0,extra={})=>{
    const i=people.length,p={action,x,z,angle,phase:hash(cx,cz,i,'phase')*40,...appearance(`${cx},${cz}`,i),...extra};
    if(action==='talk'||action==='lawn'){
      p.x+=(hash(cx,cz,i,'space-x')-.5)*.32;p.z+=(hash(cx,cz,i,'space-z')-.5)*.32;
      p.angle+=(hash(cx,cz,i,'stance')-.5)*.38;
    }
    if(action==='journey'){
      p.offset+=hash(cx,cz,i,'departure')*17;
      p.speed*=.88+hash(cx,cz,i,'pace')*.24;
      p.points=p.points.map(([px,pz,wait])=>[px,pz,wait?wait*(.65+hash(cx,cz,i,px,pz,'linger')*.9):0]);
    }
    if(action==='jog'||action==='basketball'){p.outfit='athletic';p.shorts=true;p.jacket=false;p.backpack=false;}
    if(action==='study'){p.backpack=hash(cx,cz,i,'study-bag')>.15;}
    people.push(p);
  };
  if(isCampusHill(cx,cz)){
    for(let i=0;i<24;i++){
      const x=(i%2?1:-1)*(1.8+hash(i,'class-lane')*1.5);
      add('journey',x,39,0,{points:i%3===0?[[x,39,2],[x,5,0],[-15.5,5,8],[x,5,0],[x,39,1]]:i%3===1?[[x,39,1],[x,-7,0],[18.8,-7,7],[x,-7,0],[x,39,1]]:[[x,39,1],[x,-6,4],[x,39,1]],offset:i*4.9,speed:.75+hash(i,'class')*.3,purpose:'walking to class'});
    }
    for(let i=0;i<4;i++)add('journey',10,38,0,{points:[...campusRamp.map(([x,z])=>[x,z,1]),...campusRamp.slice(0,-1).reverse().map(([x,z])=>[x,z,1])],offset:i*26,speed:.8,purpose:'quad hillside walk'});
    for(const [gx,gz] of [[-9,-3],[10,1],[-12,8]])for(let seat=0;seat<4;seat++){const a=seat*Math.PI/2;add('talk',gx+Math.sin(a),gz+Math.cos(a),a+Math.PI,{seat,groupSize:4,groupPhase:hash(gx,gz)*30});}
    for(const side of [-1,1])for(const z of [3,11])for(const dz of [-.45,.45])add('study',side*13,z+dz,side<0?Math.PI/2:-Math.PI/2);
    for(let i=0;i<6;i++)add('lawn',-15+(i%3)*1.7+hash(i,'lawn-space')*.4,-1+Math.floor(i/3)*2.2,.4+hash(i,'lawn-angle')*1.4);
    for(const spec of districtSpecs(cx,cz,streets)){
      const a=spec.rotation,d=spec.depth/2+.36;
      for(let i=0;i<2;i++)add('doorway',spec.x+Math.sin(a)*d,spec.z-cz*100+Math.cos(a)*d,a,{offset:hash(spec.seed,i)*24,speed:.65});
    }
    return people;
  }
  if(placePeople(kind,add))return people;
  const spine=kind==='library'||kind==='athletics'||kind==='commons';
  for(let i=0;i<(core?30:spine?24:10);i++){
    const side=i%2?1:-1;
    add(hash(cx,cz,i,'jog')>.9?'jog':'walk',side*(core?(i%4<2?7.15:39.1):spine?3.4:7.25),0,0,{offset:hash(cx,cz,i,'route')*140,speed:.85+hash(cx,cz,i,'speed')*.3,routeStart:spine?1:-39,routeEnd:core?39+extension:39});
  }
  if(core){
    for(const [x,z] of [[46,-11],[52,-11],[55,-11]])for(const side of [-1,1])add('study',x+side*1.05,z,side<0?Math.PI/2:-Math.PI/2);
    for(const [x,z] of [[44,32+extension],[56,32+extension]])for(const offset of [-.4,.45])add('sit',x, z+offset,x<50?Math.PI/2:-Math.PI/2);
    for(let i=0;i<8;i++)add('queue',48+i*.6,-15.6,Math.PI);
    for(const [gx,gz] of [[44,-5],[44,24],[-44,-11],[-44,28]])for(let seat=0;seat<3;seat++){const a=seat*Math.PI*2/3;add('talk',gx+Math.sin(a)*.8,gz+Math.cos(a)*.8,a+Math.PI,{seat,groupPhase:hash(gx,gz,'turn')*30});}
    for(let i=0;i<4;i++)add('basketball',-51+(i%2?3:-3),6+Math.floor(i/2)*7,0,{seat:i});
    for(let i=0;i<3;i++)add('lawn',-47+i*1.7,-24,.4);
  }else if(spine){
    for(const [gx,gz] of (kind==='athletics'?[[13,-4],[25,-11],[-20,-5]]:[[-13,27],[13,30],[-21,34]]))for(let seat=0;seat<3;seat++){const a=seat*Math.PI*2/3;add('talk',gx+Math.sin(a)*.85,gz+Math.cos(a)*.85,a+Math.PI,{seat,groupPhase:hash(gx,gz,'turn')*30});}
    for(let i=0;i<6;i++)add('lawn',(kind==='athletics'?13:-20)+i*2.1,(kind==='athletics'?-21:15)+(i%2)*2,.8);
    for(const side of [-1,1])for(let i=0;i<2;i++)add('study',side*12+i*.7,36,Math.PI);
  }else{
    for(const side of [-1,1])for(let seat=0;seat<3;seat++){const a=seat*Math.PI*2/3;add('talk',side*18+Math.sin(a)*.85,38+Math.cos(a)*.85,a+Math.PI,{seat,groupPhase:hash(side,38,'turn')*30});}
    for(const side of [-1,1])for(const dx of [-.4,.4])add('study',side*29+dx,38,Math.PI);
  }
  // Destination clusters carry the population; side streets stay quiet.
  const gatherings=core?[[-26,-33],[24,-33],[44,26],[-44,28]]:spine?[[-9,34],[8,28],[18,38]]:[[18,36]];
  for(const [gx,gz] of gatherings){const size=4+Math.floor(hash(cx,cz,gx,gz)*4);for(let seat=0;seat<size;seat++){const a=seat*Math.PI*2/size,r=1+hash(gx,gz,seat)*.35;add('talk',gx+Math.sin(a)*r,gz+Math.cos(a)*r,a+Math.PI,{seat,groupSize:size,groupPhase:hash(gx,gz,'turn')*30});}}
  for(const spec of districtSpecs(cx,cz,streets)){
    const a=spec.rotation,d=spec.depth/2+.36,x=spec.x-cx*100+Math.sin(a)*d,z=spec.z-cz*100+Math.cos(a)*d;
    for(let i=0;i<2;i++)add('doorway',x,z,a,{offset:hash(cx,cz,spec.seed,i)*24,speed:.65});
  }
  if(core){
    if(cx===0&&cz===0)for(let i=0;i<6;i++)add('journey',7,-105,0,{points:[[2.6,-105,6],[2.6,-61,0],[7,-59,0],[7,-41,0],[39.5,-41,0],[39.5,-15,0],[44,-15,10],[39.5,-15,0],[39.5,-41,0],[7,-41,0],[7,-59,0],[2.6,-61,0],[2.6,-105,8]],offset:i*31,speed:.95,purpose:'class to campus coffee',carry:'coffee',pickupIndex:6,dayOnly:true});
    add('dogwalk',39.1,0,0,{offset:43,speed:.8,routeStart:-32,routeEnd:39+extension});
    add('skate',-7.15,0,0,{offset:14,speed:1.7,routeStart:-37});
    add('skate',7.15,0,0,{offset:81,speed:1.6,routeStart:-37});
    add('groundskeeper',-48,-29,Math.PI/2);
    add('frisbee',-48,-19,Math.PI/2,{seat:0});add('frisbee',-42,-19,-Math.PI/2,{seat:1});
  }
  return people;
}
const routes=new WeakMap();
const maintenanceRoute=roundedLoop(-51,-29.6,-45,-28.4,.6);
export function campusPose(person,time,night=false){
  let {x,z,angle}=person,gait=0,walking=false,look=0,motion=1,hidden=false;
  let carrying=false;
  const clock=personalClock(person,time);
  if(person.action==='journey'){
    const s=journeyPose(person.points,clock.time,person.speed,person.offset);x=s.x;z=s.z;angle=s.angle;walking=s.walking;motion=s.motion*clock.motion;walking=walking&&motion>.001;look=clock.attention;gait=gaitPhase(s.distance,person);carrying=Boolean(person.carry);
    if(person.pickupIndex!==undefined)carrying=carrying&&(s.pointIndex>person.pickupIndex||s.pointIndex===person.pickupIndex&&walking);
    if(person.dropoffIndex!==undefined)carrying=carrying&&(s.pointIndex<person.dropoffIndex||s.pointIndex===person.dropoffIndex&&!walking);
  }else if(['walk','jog','dogwalk','skate'].includes(person.action)){
    let route=routes.get(person);
    if(!route){const side=Math.sign(x);route=roundedLoop(side>0?x:x-1.3,person.routeStart,side>0?x+1.3:x,person.routeEnd??39,.55);routes.set(person,route);}
    const speed=person.speed*(person.action==='jog'?1.45:1),distance=person.offset+(person.action==='walk'?clock.time:time)*speed;
    const s=route.sample(distance),ahead=route.sample(distance+.2);
    x=s.x;z=s.z;angle=s.angle;look=Math.atan2(Math.sin(ahead.angle-angle),Math.cos(ahead.angle-angle))*.45;
    motion=person.action==='walk'?clock.motion:1;walking=motion>.001;look+=person.action==='walk'?clock.attention:0;gait=gaitPhase(distance,person,person.action==='jog');
  }else if(person.action==='basketball'){
    x+=Math.sin(time*.38+person.phase)*1.8;z+=Math.sin(time*.26+person.phase)*2;angle=Math.atan2(-x-51,10-z);gait=time*3.2+person.phase;walking=true;motion=.55;
  }else if(person.action==='doorway'){
    const cycle=mod(time+person.offset,24),u=cycle<8?cycle/8:cycle<16?1:(cycle-16)/8;
    const distance=cycle<8?5*(1-smooth(u)):cycle<16?0:5*smooth(u);
    x+=Math.sin(angle)*distance;z+=Math.cos(angle)*distance;
    hidden=cycle>=8&&cycle<16;if(cycle<8)angle+=Math.PI;else if(cycle>=22)angle+=Math.PI*smooth((cycle-22)/2);
    gait=gaitPhase(cycle<8?5-distance:5+distance,person);walking=!hidden;motion=hidden?0:4*u*(1-u);
  }else if(person.action==='groundskeeper'){
    const distance=time*.39,s=maintenanceRoute.sample(distance);x=s.x;z=s.z;angle=s.angle;gait=gaitPhase(distance,person);walking=true;
  }
  const chat=conversation(person,time),speaking=person.action==='talk'&&chat.speaking;
  const gesture=speaking?chat.gesture:person.action==='frisbee'?.2*(1+Math.sin(time*.8+person.phase)):0;
  hidden=hidden||Boolean(person.dayOnly&&night)||Boolean(person.nightOnly&&!night);
  return {x,z,angle,gait,hidden,walking,motion,look,speaking,gesture,carrying};
}

export function createCampusPeople(T,kit,kind,cx,cz,streets=1,extension=0){
  const root=new T.Group(),people=campusPeople(kind,cx,cz,streets,extension),n=people.length;let night=false;
  root.name='campus-people';
  const capsule=new T.CapsuleGeometry(.5,1,2,7);capsule.scale(1,.5,1);
  const sphere=new T.SphereGeometry(1,8,6),cube=kit.geometries.box;
  const activityRadius=kind==='greek'?Math.hypot(70,(cx===0&&cz===0?118:45)+extension/2):66;
  const instances=(geometry,count)=>{const mesh=kit.instances(root,geometry,count,activityRadius);if(kind==='greek')mesh.boundingSphere.center.z=extension/2;return mesh;};
  let detailCount=0;
  const detailIndices=people.map(p=>detailSlots(p).map(visible=>visible?detailCount++:-1));
  const core=kind==='greek',body=instances(capsule,n*11+(core?7:0)),heads=instances(sphere,n*4),hair=instances(sphere,n*2),gear=instances(cube,n*2+detailCount+(core?3:0)),shoes=instances(kit.geometries.shoe,n*2),balls=instances(sphere,core?2:0);
  const {shirts,skin:skins,pants}=palettes;
  const color=new T.Color();
  people.forEach((p,i)=>{
    const skin=skins[p.skin];
    for(let part=0;part<11;part++)body.setColorAt(i*11+part,color.set(part===0||part===1||part===3||(p.jacket&&part<5)?shirts[p.shirt]:part<5||part===10||(p.shorts&&(part===6||part===8))?skin:pants[p.pants]));
    for(let j=0;j<4;j++)heads.setColorAt(i*4+j,color.set(skin));
    for(let j=0;j<2;j++)hair.setColorAt(i*2+j,color.set(j===0&&p.cap?palettes.shirts[p.shirt]:palettes.hair[p.hair]));
    detailColors(p).forEach((c,j)=>{const slot=detailIndices[i][j];if(slot>=0)gear.setColorAt(n*2+(core?3:0)+slot,color.set(c));});
    gear.setColorAt(i*2,color.set(p.bagColor));gear.setColorAt(i*2+1,color.set(0xe0d9c8));
    for(let j=0;j<2;j++)shoes.setColorAt(i*2+j,color.set(p.shoeColor));
  });
  if(core){balls.setColorAt(0,color.set(0xbb713e));balls.setColorAt(1,color.set(0xd7a765));for(let i=0;i<7;i++)body.setColorAt(n*11+i,color.set(i===6?0x4a5453:0xa17c52));for(let i=0;i<3;i++)gear.setColorAt(n*2+i,color.set(i===2?0x312b25:0x94704d));}
  const dummy=new T.Object3D(),a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0);
  function pose(mesh,i,x,y,z,sx,sy,sz,angle=0,lean=0){dummy.position.set(x,y,z);dummy.rotation.set(lean,angle,0,'YXZ');dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  function limb(mesh,i,from,to,r){a.set(...from);b.set(...to);direction.subVectors(b,a);dummy.position.copy(a).add(b).multiplyScalar(.5);const length=direction.length();dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.scale.set(r,length+.025,r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  const distant=core?null:createDistantCrowd(T,n),detailMeshes=[body,heads,hair,gear,shoes,balls],viewBounds={bounds:new T.Sphere(new T.Vector3(0,2,core?extension/2:0),activityRadius)};
  if(distant)root.add(distant.mesh);
  const obstacles=[];
  for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)obstacles.push(...districtSpecs(x,z,streets).map(b=>({...b,cos:Math.cos(b.rotation),sin:Math.sin(b.rotation)})));
  const ground=(s,p)=>campusGroundHeight(s.x+cx*100,s.z+cz*100)+(p.ground??(p.action==='basketball'?.33:p.action==='skate'?.14:p.action==='doorway'?.27:p.action==='journey'?.17:.045));
  const pedestrian=pedestrianGroup(`campus:${cx},${cz}`,people,(p,time)=>campusPose(p,time,night),{
    offsetX:cx*100,offsetZ:cz*100+(cz>0?extension:0),ground,
    allowed:(x,z,s,p)=>{
      if(Math.hypot(x-s.x,z-s.z)>2.4)return false;
      if(core&&Math.abs(x)>25.1&&Math.abs(x)<37.6&&z>-27&&z<27+extension)return false;
      for(const b of obstacles){const dx=x+cx*100-b.x,dz=z+cz*100-b.z,c=b.cos,a=b.sin;if(Math.abs(dx*c-dz*a)<b.width/2+.2&&Math.abs(dx*a+dz*c)<b.depth/2+.2)return false;}
      return true;
    }
  });
  const spacing=createPedestrianSpacing();let previousPoses=null;
  let lastPose=NaN,lastDistant=false;
  function animate(time,camera=null,sharedPoses=null){
    const poses=sharedPoses?.get(pedestrian)||spacing.update(time,[pedestrian]).get(pedestrian),posesChanged=poses!==previousPoses;previousPoses=poses;
    const useDistant=distant?.distant(viewBounds,camera,root.matrixWorld)||false;
    if(time===lastPose&&useDistant===lastDistant&&!posesChanged)return;lastPose=time;lastDistant=useDistant;
    for(const mesh of detailMeshes)mesh.visible=!useDistant;
    if(distant)distant.mesh.visible=useDistant;
    if(useDistant){
      distant.begin(time);for(const [i,p] of people.entries()){const s=poses[i];if(s.hidden)continue;const ground=campusGroundHeight(s.x+cx*100,s.z+cz*100)+(p.ground??(p.action==='basketball'?.33:p.action==='skate'?.14:p.action==='doorway'?.27:p.action==='journey'?.17:.045));distant.add(p,{...s,rotation:s.angle,ground});}distant.finish();return;
    }
    people.forEach((p,i)=>{
      const s=poses[i],rig=humanPose(p,s,time),h=p.height,w=p.build??1,cos=Math.cos(s.angle),sin=Math.sin(s.angle);
      const ground=campusGroundHeight(s.x+cx*100,s.z+cz*100)+(p.ground??(p.action==='basketball'?.33:p.action==='skate'?.14:p.action==='doorway'?.27:p.action==='journey'?.17:.045));
      const local=([x,y,z])=>[s.x+(x*cos+z*sin)*h,y*h+ground+(s.hidden?-20:0),s.z+(-x*sin+z*cos)*h];
      const part=(mesh,index,point,x,y,z,yaw=0,pitch=0)=>pose(mesh,index,...local(point),x*h,y*h,z*h,s.angle+yaw,pitch);
      part(body,i*11,rig.chest,.40*w,.52,.25*w,rig.twist,rig.lean);
      part(body,i*11+9,rig.hip,.29*w,.20,.23*w,-rig.twist*.5);
      part(body,i*11+10,[rig.head[0],rig.head[1]-.19,rig.head[2]],.12,.15,.12);
      part(heads,i*4,rig.head,.126,.17,.136,rig.headYaw);
      const [hx,hy,hz,dy]=hairShape(p),back=backHair(p,rig);
      part(hair,i*2,[rig.head[0]-Math.sin(rig.headYaw)*.025,rig.head[1]+dy,rig.head[2]-Math.cos(rig.headYaw)*.025],hx,hy,hz,rig.headYaw);
      part(hair,i*2+1,back.point,...back.scale,rig.headYaw);
      dressPerson(p,rig,(j,point,x,y,z,yaw)=>{const slot=detailIndices[i][j];if(slot>=0)part(gear,n*2+(core?3:0)+slot,point,x,y,z,yaw);});
      part(heads,i*4+3,[rig.head[0]+Math.sin(rig.headYaw)*.132,rig.head[1]-.01,rig.head[2]+Math.cos(rig.headYaw)*.132],.026,.036,.036,rig.headYaw);
      for(let j=0;j<2;j++){
        const arm=rig.arms[j],leg=rig.legs[j];
        limb(body,i*11+1+j*2,local(arm.shoulder),local(arm.elbow),.115*h*w);
        limb(body,i*11+2+j*2,local(arm.elbow),local(arm.hand),.083*h);
        part(heads,i*4+1+j,arm.hand,.047,.067,.043);
        limb(body,i*11+5+j*2,local(leg.hip),local(leg.knee),.155*h*w);
        limb(body,i*11+6+j*2,local(leg.knee),local(leg.ankle),.11*h*w);
        part(shoes,i*2+j,[leg.ankle[0],leg.ankle[1]-.055+Math.abs(Math.sin(leg.pitch))*.145,leg.ankle[2]+.045],.15,.13,.29,0,leg.pitch);
      }
      part(gear,i*2,[rig.chest[0],rig.chest[1]-.025,rig.chest[2]-.19],p.backpack?.28:0,.34,.15,rig.twist);
      const book=p.action==='study'||p.action==='lawn';
      if(p.action==='skate')part(gear,i*2+1,[0,-.04,0],.27,.07,.78);
      else if(p.action==='groundskeeper')part(gear,i*2+1,[0,.22,.75],.65,.35,.8);
      else if(s.carrying)part(gear,i*2+1,[0,rig.hip[1]+.16,.43],p.carry==='coffee'?.12:p.carry==='pizza'?.65:.4,p.carry==='coffee'?.2:p.carry==='pizza'?.07:.3,p.carry==='coffee'?.12:.4);
      else part(gear,i*2+1,[0,rig.hip[1]+.19,.49],book?.34:0,.035,.26);
    });
    if(balls.count){const p=poses[people.findIndex(p=>p.action==='basketball')];pose(balls,0,p.x+.42,.55+Math.abs(Math.sin(time*3.3))*1.05,p.z+.35,.19,.19,.19);}
    if(core){
      // The dog and its leash share the existing body/accessory instance buffers.
      const owner=people.find(p=>p.action==='dogwalk'),dog=poses[people.indexOf(owner)],hand=humanPose(owner,dog,time).arms[1].hand,a=dog.angle,local=(x,y,z)=>[dog.x+x*Math.cos(a)+z*Math.sin(a),y,dog.z-x*Math.sin(a)+z*Math.cos(a)];
      pose(body,n*11,...local(.85,.43,.5),.32,.35,.63,a);
      for(let j=0;j<4;j++){const x=.85+(j%2?-.12:.12),z=.5+(j<2?-.22:.22),swing=Math.sin(time*5+j*Math.PI/2)*.1;limb(body,n*11+1+j,local(x,.39,z),local(x,.08,z+swing),.08);}
      limb(body,n*11+5,local(.85,.5,.2),local(.85,.7,-.05),.07);
      limb(body,n*11+6,local(...hand.map(v=>v*owner.height)),local(.85,.55,.8),.014);
      pose(gear,n*2,...local(.85,.57,.87),.25,.25,.3,a);pose(gear,n*2+1,...local(.73,.58,.81),.07,.27,.15,a);pose(gear,n*2+2,...local(.85,.56,1.04),.13,.1,.1,a);
      const flight=(Math.sin(time*.8)+1)/2;pose(balls,1,-48+flight*6,1.2+Math.sin(flight*Math.PI)*1.1,-19,.19,.035,.19);
    }
    for(const m of [body,heads,hair,gear,shoes,balls])m.instanceMatrix.needsUpdate=true;
  }
  animate(0);return {root,people,pedestrian,get poses(){return previousPoses;},animate,setNight(enabled){night=enabled;pedestrian.revision=(pedestrian.revision||0)+1;lastPose=NaN;},dispose(){capsule.dispose();sphere.dispose();distant?.dispose();}};
}

export function createCampusTraffic(T,kit,extension=0){
  const root=new T.Group(),dummy=new T.Object3D(),color=new T.Color();
  // Two one-way circuits have separate lane centers and rounded junction turns.
  const loops=[roundedLoop(2.4,-47.6,97.6,47.6+extension,7.8),roundedLoop(-97.6,-47.6,-2.4,47.6+extension,7.8)];
  const cars=Array.from({length:8},(_,i)=>({loop:i%2,offset:22+i*83,speed:4.4,shuttle:i===3,style:i===3?'shuttle':i%3===1?'crossover':'sedan',branded:i%2===1,color:i%2===1?FOMO_VEHICLE_COLOR:[0xf1e9d6,0x66829e,0xa75a49,0xd6dbd8,0x48585e,0xbaa283,0x8c959e,0x555766][i]}));
  const cyclists=Array.from({length:12},(_,i)=>({loop:i%2,offset:i*57+19,speed:2.65,phase:i*2.1}));
  const bikeLoops=[roundedLoop(4.7,-45.3,95.3,45.3+extension,8),roundedLoop(-95.3,-45.3,-4.7,45.3+extension,8)];
  const rounded=new T.CapsuleGeometry(.5,1,3,10);rounded.scale(1,.5,1);
  function instances(geo,n){const m=new T.InstancedMesh(geo,kit.material(0xffffff),n);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.boundingSphere=new T.Sphere(new T.Vector3(0,2,extension/2),145+extension/2);root.add(m);return m;}
  const fleet=kit.vehicles.movingFleet(root,cars);
  const bikeWheels=instances(kit.geometries.wheel,cyclists.length*2),bikeTubes=instances(kit.geometries.cylinder,cyclists.length*13),riders=instances(rounded,cyclists.length*9),heads=instances(kit.geometries.sphere,cyclists.length*2);
  cyclists.forEach((c,i)=>{for(let j=0;j<2;j++){bikeWheels.setColorAt(i*2+j,color.set(0x303d42));heads.setColorAt(i*2+j,color.set(j?0xe0d9c7:0xc69b7a));}for(let j=0;j<13;j++)bikeTubes.setColorAt(i*13+j,color.set(j<6?0x6b8491:0x899593));for(let j=0;j<9;j++){riders.setColorAt(i*9+j,color.set(j===0?[0xb99269,0x576e99,0x994f47][i%3]:j<5?0xc69b7a:0x43505b));}});
  const a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0);
  function pose(mesh,i,x,y,z,sx,sy,sz,angle=0){dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  function tube(mesh,i,from,to,r){a.set(...from);b.set(...to);direction.subVectors(b,a);const length=direction.length();dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.scale.set(r,length,r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  function animate(t,focusX=0,focusZ=0){
    // Translate the circuits to the nearest 300-unit campus; no traffic crosses lawns.
    const ox=Math.round(focusX/300)*300,oz=extension?0:Math.round(focusZ/300)*300;root.position.set(ox,0,oz);root.updateMatrix();root.updateMatrixWorld(true);
    fleet.update(cars.map(c=>{const loop=loops[c.loop],distance=c.offset+t*c.speed,p=loop.sample(distance),ahead=loop.sample(distance+1);const turn=Math.atan2(Math.sin(ahead.angle-p.angle),Math.cos(ahead.angle-p.angle));return {...p,steer:Math.max(-.4,Math.min(.4,turn*kit.vehicles.model(c.style).wheelbase*2))};}),t);
    cyclists.forEach((c,i)=>{
      const s=bikeLoops[c.loop].sample(c.offset+t*c.speed),cos=Math.cos(s.angle),sin=Math.sin(s.angle),local=(x,y,z)=>[s.x+x*cos+z*sin,y,s.z-x*sin+z*cos];
      for(let j=0;j<2;j++)pose(bikeWheels,i*2+j,...local(0,.4,j?.65:-.65),1,1,1,s.angle+Math.PI/2);
      const rear=local(0,.4,-.65),front=local(0,.4,.65),crank=local(0,.45,-.03),seat=local(0,1.04,-.25),bar=local(0,1.04,.46);
      [[rear,crank],[rear,seat],[seat,crank],[seat,bar],[bar,crank],[bar,front],[bar,local(0,1.19,.42)],[local(-.23,1.19,.42),local(.23,1.19,.42)],[local(-.12,1.06,-.25),local(.12,1.06,-.25)]].forEach(([a,b],j)=>tube(bikeTubes,i*13+j,a,b,.032));
      for(let wheel=0;wheel<2;wheel++)for(let spoke=0;spoke<2;spoke++){
        const a=t*c.speed/.34+spoke*Math.PI/2,dy=Math.cos(a)*.31,dz=Math.sin(a)*.31,z=wheel?.65:-.65;
        tube(bikeTubes,i*13+9+wheel*2+spoke,local(0,.4+dy,z+dz),local(0,.4-dy,z-dz),.009);
      }
      const pelvis=local(0,1.12,-.2),shoulder=local(0,1.46,.08),head=local(0,1.75,.19);
      tube(riders,i*9,pelvis,shoulder,.35);pose(heads,i*2,...head,.14,.17,.15,s.angle);pose(heads,i*2+1,...local(0,1.87,.19),.16,.08,.17,s.angle);
      for(let j=0;j<2;j++){const side=j?1:-1,pedal=t*5+c.phase+j*Math.PI;
        const elbow=local(side*.23,1.25,.29),hand=local(side*.23,1.19,.42),knee=local(side*.15,.86,.18+Math.sin(pedal)*.12),foot=local(side*.15,.47+Math.cos(pedal)*.19,Math.sin(pedal)*.19);
        tube(riders,i*9+1+j*2,local(side*.2,1.44,.08),elbow,.095);tube(riders,i*9+2+j*2,elbow,hand,.075);
        tube(riders,i*9+5+j*2,local(side*.12,1.1,-.2),knee,.135);tube(riders,i*9+6+j*2,knee,foot,.1);
      }
    });
    for(const m of [bikeWheels,bikeTubes,riders,heads])m.instanceMatrix.needsUpdate=true;
  }
  animate(0);return {root,animate,cars,cyclists,loops,fleet};
}
