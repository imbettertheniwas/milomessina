import {createGrassMaterial} from './village-grass.js?v=88';
import {createNationalPrize,NATIONAL_PRIZE_SITE} from './village-national-prize.js?v=2';

// The original academic block, immediately north of Greek Row. Heights are
// shared by the landscape and students, including visitors from other blocks.
export const CAMPUS_HILL_HEIGHT=6;
export const isCampusHill=(cx,cz)=>cx===0&&cz===-1;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const campusRamp=[[10,38,0],[37,32,1.5],[10,26,3],[37,20,4.5],[10,14,6]];
function rampSample(x,z){
  let nearest={distance:Infinity,height:0};
  for(let i=1;i<campusRamp.length;i++){
    const a=campusRamp[i-1],b=campusRamp[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
    const distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
    if(distance<nearest.distance)nearest={distance,height:a[2]+(b[2]-a[2])*t};
  }
  return nearest;
}
export function campusStairHeight(z){
  const u=Math.max(0,Math.min(24,32-z)),flight=Math.floor(u/8);
  return Math.min(6,flight*2+Math.ceil(Math.min(6,u-flight*8)/.6)*.2);
}
export function campusHillHeight(x,z){
  if(Math.abs(x)>=58||z<=-44||z>=41)return 0;
  const side=smooth((58-Math.abs(x))/12),back=smooth((z+44)/12),front=smooth((41-z)/27);
  let height=6*side*back*front;
  if(z>=32&&Math.abs(x)<6.5)height*=1-smooth((6.5-Math.abs(x))/1.1);
  // Grade the hillside into the walks, leaving room for their stone surface.
  if(z>=8&&z<=32&&Math.abs(x)<6.5){const blend=smooth((6.5-Math.abs(x))/1.1);height+=(Math.max(0,campusStairHeight(z)-.12)-height)*blend;}
  const ramp=rampSample(x,z),blend=1-smooth((ramp.distance-1.45)/1.8);
  height+=(Math.max(0,ramp.height-.08)-height)*blend;
  return height;
}
export function campusGroundHeight(x,z){
  const localZ=z+100;
  if(Math.abs(x)>=58||localZ<=-44||localZ>=41)return 0;
  if(Math.abs(x)<=5.4&&localZ>=8&&localZ<=32)return campusStairHeight(localZ);
  const ramp=rampSample(x,localZ);
  if(ramp.distance<=1.45)return ramp.height;
  return campusHillHeight(x,localZ);
}

export function createCampusHill(T,kit,p){
  const {box,cylinder,bar,mesh,path,tree,bench,lamp,sign}=kit;
  const terrain=new T.PlaneGeometry(116,85,116,85);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,-1.5);
  const positions=terrain.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,campusHillHeight(positions.getX(i),positions.getZ(i))+.052);
  terrain.computeVertexNormals();
  const lawn=new T.Mesh(terrain,createGrassMaterial(T));lawn.name='main-campus-hillside';lawn.receiveShadow=true;lawn.userData.ownedGeometry=true;p.add(lawn);
  const raised=new T.Group();raised.position.y=6;raised.name='academic-quad';p.add(raised);
  const prize=createNationalPrize(T);prize.root.position.set(NATIONAL_PRIZE_SITE.x,0,NATIONAL_PRIZE_SITE.z+100);raised.add(prize.root);p.userData.nationalPrize=prize;
  // A paved forecourt connects the three academic entrances around a real lawn.
  path(raised,[0,-8],[0,8],10.8);path(raised,[-16.1,5],[19.1,5],3.4);
  path(raised,[19.1,5],[19.1,-7],3.4);path(raised,[-15,-7],[19.1,-7],3.4);
  path(raised,[-15,6],[18,6],2.6);
  box(raised,0,.1,-6,21,.15,7,0xd0c7b4,'stone');
  for(const side of [-1,1]){
    for(const z of [3,11]){bench(raised,side*13,z,side<0?Math.PI/2:-Math.PI/2);lamp(raised,side*7.3,z);}
    kit.bins(raised,side*16,12);
    // Low stone planters frame the steps without obscuring the campus facade.
    box(raised,side*8.7,.32,13,4.5,.55,1.6,0xb7ae99,'stone');
    for(let i=0;i<5;i++)mesh(raised,'leaf',side*8.7-1.7+i*.85,.83,13,.55,.5,.55,0x61734d);
    tree(raised,side*15,10,12+side,1.1);
  }
  for(const [x,z,size] of [[-41,-25,1.1],[42,-23,1.3],[-40,26,1.35],[-26,27,1.1],[-17,33,.9],[44,9,1.15],[43,34,1.05]]){
    const grove=new T.Group();grove.position.y=campusHillHeight(x,z);p.add(grove);tree(grove,x,z,x+z,size);
  }
  // Three ten-riser flights with generous level landings and paired handrails.
  for(let flight=0;flight<3;flight++){
    const bottom=32-flight*8;
    for(let i=0;i<10;i++){
      const top=flight*2+(i+1)*.2;
      box(p,0,top/2+.07,bottom-(i+.5)*.6,10.8,top,.6,0xcac2af,'stone');
    }
    const top=(flight+1)*2;
    box(p,0,top/2+.07,bottom-7,10.8,top,2,0xcac2af,'stone');
    for(const side of [-1,1]){
      bar(p,[side*5.1,flight*2+1, bottom],[side*5.1,top+1,bottom-6],.045,0x505e59);
      bar(p,[side*5.1,top+1,bottom-6],[side*5.1,top+1,bottom-8],.045,0x505e59);
      for(const i of [0,5,10])cylinder(p,side*5.1,flight*2+i*.2+.55,bottom-i*.6,.045,1.1,0x505e59);
    }
  }
  path(p,[-8,39],[12,39],3);path(p,[0,32],[0,41],10.8);
  // Switchbacks rise 1.5 units per 27.7-unit run, with level turning pads.
  for(let i=1;i<campusRamp.length;i++){
    const a=campusRamp[i-1],b=campusRamp[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length*1.4,nz=dx/length*1.4;
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute([a[0]+nx,a[2]+.12,a[1]+nz,a[0]-nx,a[2]+.12,a[1]-nz,b[0]+nx,b[2]+.12,b[1]+nz,b[0]-nx,b[2]+.12,b[1]-nz],3));
    geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();
    const walk=new T.Mesh(geometry,kit.material(0xc9c3b2,'stone'));walk.material.side=T.DoubleSide;walk.name='campus-accessible-walk';walk.receiveShadow=true;walk.userData.ownedGeometry=true;p.add(walk);
    for(const side of [-1,1]){
      bar(p,[a[0]+nx*side,a[2]+1.05,a[1]+nz*side],[b[0]+nx*side,b[2]+1.05,b[1]+nz*side],.035,0x647068);
      for(let j=0;j<=4;j++){const t=j/4;cylinder(p,a[0]+dx*t+nx*side,a[2]+(b[2]-a[2])*t+.58,a[1]+dz*t+nz*side,.035,1,0x647068);}
    }
  }
  for(const [x,z,y] of campusRamp){const landing=new T.Group();landing.position.y=y;p.add(landing);box(landing,x,.06,z,3,.12,3,0xc9c3b2,'stone');}
  path(raised,[0,8],[7,8],3);path(raised,[7,8],[7,14],3);path(raised,[7,14],[10,14],3);
  // A small campus marker, bicycle parking and a flagpole establish human scale.
  box(p,-10,1.05,39,5,1.9,.9,0xa99980,'stone');sign(p,'CAMPUS QUAD',-10,1.35,39.47,4.5,.55);
  for(const x of [11,13])box(p,x,1.1,40,.12,2,.12,0x71614d);
  box(p,12,1.65,40,2.6,1.5,.16,0x635a46);sign(p,'CAMPUS LIFE',12,2.07,40.1,2.35,.35);
  for(let i=0;i<6;i++)box(p,11.2+(i%3)*.78,1.66-Math.floor(i/3)*.5,40.1,.55,.38,.025,[0xc69368,0xdcd6b2,0x919ead][i%3]);
  box(raised,-11,.08,-6,7,.12,3,0xbeb8a7,'stone');
  for(let i=0;i<5;i++){
    const x=-14+i*1.2;bar(raised,[x,.12,-6],[x,.9,-6],.045,0x566563);bar(raised,[x,.9,-6],[x,.9,-5],.045,0x566563);bar(raised,[x,.9,-5],[x,.12,-5],.045,0x566563);
    if(i%2===0){
      for(const z of [-6.1,-4.8]){const wheel=mesh(raised,'wheel',x+.18,.4,z,1,1,1,0x3b4644);wheel.rotation.y=Math.PI/2;}
      bar(raised,[x+.18,.4,-6.1],[x+.18,.9,-5.6],.035,0x9b7653);bar(raised,[x+.18,.9,-5.6],[x+.18,.4,-4.8],.035,0x9b7653);bar(raised,[x+.18,.4,-6.1],[x+.18,.4,-4.8],.035,0x9b7653);
      box(raised,x+.18,.97,-5.6,.25,.08,.3,0x3b4644);bar(raised,[x+.18,.4,-4.8],[x+.18,1.05,-4.9],.035,0x566563);bar(raised,[x-.12,1.05,-4.9],[x+.48,1.05,-4.9],.035,0x566563);
    }
  }
  cylinder(raised,-16,4.5,-4,.075,9,0xa1aaa2);mesh(raised,'sphere',-16,9.05,-4,.14,.14,.14,0xcbb982);box(raised,-14.7,7.8,-4,2.5,1.4,.045,0x7074b3);
  sign(raised,'GREEK VILLAGE',-14.7,7.8,-3.96,2.2,.35);
  return lawn;
}
