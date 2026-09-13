import {marketShops} from './village-place-layout.js?v=80';
// Stable per-instance hashing: unrelated objects do not repeat in stripes or shift
// when another instance is inserted. No runtime randomness or network state.
export function hash(...keys){let h=2166136261;for(const key of keys){for(const c of String(key)){h=Math.imul(h^c.charCodeAt(0),16777619);}h=Math.imul(h^255,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;}
export const pick=(list,...keys)=>list[Math.floor(hash(...keys)*list.length)];
export const palettes={shirts:[0xe7decc,0x5f7397,0x984d47,0x43594c,0xc4a36a,0xa8b8bb,0x5e5274,0xd8dce1,0x7b8064,0x879cab,0xc27c5d,0xbba1a5,0x313d52,0xb2b692,0x85817c,0xe4ba83,0x734645,0x9bada2,0x4a656d,0xbbc5d4,0x7c6388,0xc7b7a4,0x8d9659,0xddd6b7],skin:[0xe5b28a,0xba8662,0x835c43,0xd7a074,0x684a38,0xc78c66,0xf0c3a0,0x9f7151],hair:[0x352a23,0x735036,0xc4a779,0x211f20,0x987149,0x554035,0xb69768,0x6e4c38],pants:[0x314357,0x63686b,0xab9576,0x393c49,0x727767,0x495d70]};
export function appearance(id,index){
  const roll=key=>hash(id,index,key),outfit=pick(['tee','hoodie','overshirt','athletic'],id,index,'outfit');
  return {identity:`${id}:${index}`,shirt:Math.floor(roll('shirt')*palettes.shirts.length),skin:Math.floor(roll('skin')*palettes.skin.length),hair:Math.floor(roll('hair')*palettes.hair.length),hairLength:roll('hair-length'),hairStyle:pick(['crop','curls','bob','long','bun'],id,index,'hairstyle'),height:.9+roll('height')*.2,build:.87+roll('build')*.28,outfit,backpack:roll('bag')>.46,jacket:outfit==='hoodie'||outfit==='overshirt',shorts:outfit==='athletic'||roll('shorts')>.78,pants:Math.floor(roll('pants')*palettes.pants.length),cap:roll('cap')>.82,glasses:roll('glasses')>.78,shoeColor:pick([0xe7e3d9,0x353a40,0x905c4e,0x526b66],id,index,'shoes'),bagColor:pick([0x586574,0x9c7856,0x705658,0x394f43],id,index,'bag-color'),temperament:pick(['relaxed','purposeful','curious','social'],id,index,'temperament'),motionProfile:motionProfile(id,index)};
}


export const BLOCK=100;
export const mod=(n,d)=>((n%d)+d)%d;
export function districtAt(x,z){return {x:Math.floor((x+50)/BLOCK),z:Math.floor((z+50)/BLOCK)};}
// Greek Row's own blocks hold houses instead of campus buildings. Streets open
// east then west of the original boulevard, so column cx is Greek Row's while a
// street is standing on it.
export function greekColumn(cx,streets=1){return cx===0||(cx>0?cx*2-1:cx*-2)<streets;}
export function districtKind(cx,cz,streets=1){
  if(cz===0&&greekColumn(cx,streets))return 'greek';
  if(cx===-1&&cz===1)return 'green';
  const x=mod(cx+1,3)-1,z=mod(cz+1,3)-1;
  if(x===0)return z<0?'library':z>0?'athletics':'commons';
  if(z===0)return x<0?'arts':'science';
  return x===z?'residential':'town';
}
export function districtSpecs(cx,cz,streets=1){
  const kind=districtKind(cx,cz,streets),seed=Math.floor(hash(cx,cz,'district')*1000000),ox=cx*BLOCK,oz=cz*BLOCK;
  const specs=[];
  const add=(type,x,z,width,depth,height,rotation=0,label='')=>specs.push({type,x:ox+x,z:oz+z,width,depth,height,rotation,label,seed:Math.floor(hash(cx,cz,type,x,z)*1000000)});
  if(kind==='greek')return specs;
  if(kind==='green')return specs;
  if(kind==='library'||kind==='commons'){
    add('library',0,-20,36,19,12,0,'UNIVERSITY LIBRARY');
    add('hall',-31,5,17,29,8,Math.PI/2,'HUMANITIES');
    add('hall',32,-7,18,25,9,-Math.PI/2,'');
  }else if(kind==='athletics'){
    add('gym',-23,18,34,26,10,Math.PI,'RECREATION CENTER');
    add('residence',26,20,29,22,15,Math.PI,'STUDENT RESIDENCES');
  }else if(kind==='science'){
    add('science',-27,-9,31,24,13,Math.PI/2,'SCIENCE & ENGINEERING');
    add('union',28,17,28,25,8,-Math.PI/2,'STUDENT UNION');
    add('hall',29,-27,23,15,7,0,'');
  }else if(kind==='arts'){
    add('arts',27,-12,30,24,10,-Math.PI/2,'SCHOOL OF THE ARTS');
    add('hall',-28,17,27,22,10,Math.PI/2,'LECTURE HALL');
    add('shops',-28,-28,25,12,5,0,'BOOKS / RECORDS');
  }else if(kind==='residential'){
    for(const side of [-1,1])for(const z of [-23,20])add('cottage',side*(27+(z>0?2:0)),z,17+(z>0?3:0),16,6+hash(cx,cz,side,z)*2,-side*Math.PI/2,'');
  }else{
    for(const shop of marketShops){add('storefront',shop.x,shop.z,shop.width,shop.depth,shop.height,shop.rotation,shop.label);Object.assign(specs.at(-1),{color:shop.color,awning:shop.awning});}
  }
  return specs;
}
// Positive-length rounded loops are shared by the road paint and traffic.
export function roundedLoop(x0,z0,x1,z1,r=7){
  const w=x1-x0,d=z1-z0,straightX=w-2*r,straightZ=d-2*r,arc=Math.PI*r/2;
  const lengths=[straightX,arc,straightZ,arc,straightX,arc,straightZ,arc],length=lengths.reduce((a,b)=>a+b,0);
  return {length,sample(distance){
    let u=mod(distance,length),segment=0;
    while(u>lengths[segment]&&segment<7)u-=lengths[segment++];
    if(segment===0)return {x:x0+r+u,z:z0,angle:Math.PI/2};
    if(segment===2)return {x:x1,z:z0+r+u,angle:0};
    if(segment===4)return {x:x1-r-u,z:z1,angle:-Math.PI/2};
    if(segment===6)return {x:x0,z:z1-r-u,angle:Math.PI};
    const corners={1:[x1-r,z0+r,-Math.PI/2],3:[x1-r,z1-r,0],5:[x0+r,z1-r,Math.PI/2],7:[x0+r,z0+r,Math.PI]};
    const [cx,cz,start]=corners[segment],a=start+u/r;
    return {x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r,angle:-a};
  }};
}

export function motionProfile(chapter,member){
  const value=(key,min,range)=>min+hash(chapter,member,key)*range;
  return {breathRate:value('breath-rate',1.05,1.05),breathAmount:value('breath-range',.002,.005),shiftRate:value('shift-rate',.21,.37),shiftAmount:value('shift-range',.014,.03),twistRate:value('twist-rate',.31,.51),twistAmount:value('twist-range',.012,.023),nodRate:value('nod-rate',.5,.8),nodAmount:value('nod-range',.002,.005),lookRate:value('look-rate',.27,.53),lookAmount:value('look-range',.025,.065),idlePeriod:value('idle-period',7,12),idleOffset:value('idle-offset',0,30),idleAmount:value('idle-range',.035,.085),gestureRate:value('gesture-rate',.65,.8),gestureAmount:value('gesture-range',.55,.6),walkSpeed:value('walk-speed',.59,.28)};
}
