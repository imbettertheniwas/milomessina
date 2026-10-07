import {palettes,hash} from './village-district-layout.js?v=80';

// A social crowd's wardrobe is cosmetic, not a claim about member demographics.
// Keep identity/skin/build and every activity stable when registrations change.
export function greekPartyStyle(person){
  if(person.action==='build')return person;
  const roll=key=>hash(person.identity,'party',key),pick=(list,key)=>list[Math.floor(roll(key)*list.length)];
  const look=roll('look')<.46?'sorority':'fraternity';
  const outfit=pick(look==='sorority'?['tank','fitted-tee','sundress','tank-skirt','crop-tee']:['polo','pocket-tee','rugby','button-down','athletic-tee'],'outfit');
  const skirt=outfit==='sundress'||outfit==='tank-skirt';
  const shirtColor=pick(look==='sorority'?[0xf4e7db,0xe7a8be,0xa8bade,0x272c37,0xb9aed8,0xe0b9a4,0xffffff]:[0xf1ede0,0x8eafce,0xd7afae,0x28425c,0x96b8ad,0x8d3546,0xb4c4dc],'shirt');
  const bottomColor=outfit==='sundress'?shirtColor:pick(look==='sorority'?[0x8fa7b7,0xece7df,0x343744,0xafbed0]:[0xbfa783,0xe6dfc8,0x899faf,0x35455d,0x9daca5],'bottom');
  return {...person,partyLook:look,outfit,shirtColor,bottomColor,skirt,sleeveless:outfit==='tank'||outfit==='tank-skirt'||outfit==='sundress',
    backpack:false,jacket:false,shorts:skirt||roll('shorts')<(look==='sorority'?.85:.88),
    cap:look==='fraternity'&&roll('cap')>.72,glasses:roll('sunglasses')>.63,
    hairStyle:pick(look==='sorority'?['long','long','ponytail','bob','bun']:['crop','curls','crop','curls'],'hair'),
    shoeColor:pick([0xf3f0e7,0xf3f0e7,0xdce3e5,0x31383d],'sneakers')};
}

export const DETAIL_COUNT=6;
export function hairShape(person){
  if(person.cap)return [.146,.11,.153,.10];
  switch(person.hairStyle){
    case 'curls':return [.151,.15,.158,.08];
    case 'bob':return [.15,.19,.154,.015];
    case 'long':return [.142,.16,.15,.045];
    default:return [.134,.1,.143,.08];
  }
}
export function detailSlots(person){return [person.outfit==='overshirt'||person.outfit==='hoodie',false,person.cap,person.glasses,person.backpack,person.backpack];}
export function detailColors(person){
  const shirt=person.shirtColor??palettes.shirts[person.shirt];
  if(person.partyLook)return [person.outfit==='rugby'?0xf1eee5:shirt,person.skirt?person.bottomColor:palettes.skin[person.skin],shirt,0x252d36,person.outfit==='polo'||person.outfit==='rugby'?0xf1eee5:shirt,person.outfit==='polo'||person.outfit==='rugby'?0xf1eee5:shirt];
  return [0xe6dfd0,shirt,shirt,0x252d36,person.bagColor,person.bagColor];
}
// A single instanced box batch holds all clothing details, including hidden
// slots, so additional identities don't create individual materials/draw calls.
export function dressPerson(person,rig,draw){
  const build=person.build??1,head=rig.head,yaw=rig.headYaw;
  const atHead=(x,y,z)=>[head[0]+x*Math.cos(yaw)+z*Math.sin(yaw),head[1]+y,head[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];
  if(person.partyLook){
    const collar=['polo','rugby','button-down'].includes(person.outfit),stripe=person.outfit==='rugby';
    const width=person.partyLook==='sorority'?.34:.42;
    const front=rig.chest[2]+.136;
    draw(0,[rig.chest[0]+(collar||stripe?0:.09),rig.chest[1]+.065,front],stripe?width*build:collar?.022:.065,stripe?.09:collar?.19:.075,.012,rig.twist);
    const cropped=person.outfit==='crop-tee';
    draw(1,[rig.hip[0],rig.hip[1]+(cropped?.15:.06),rig.hip[2]+(cropped?0:.132)],person.skirt?.30*build:cropped?.28*build:0,cropped?.15:.028,cropped?.21:.02,rig.twist);
    draw(2,atHead(0,.1,.155),person.cap?.22:0,.025,.12,yaw);
    draw(3,atHead(0,.015,.132),person.glasses?.25:0,.042,.035,yaw);
    for(let side=0;side<2;side++)draw(4+side,[rig.chest[0]+(side?1:-1)*.07*build,rig.chest[1]+.205,front-.012],collar?.09:0,.055,.04,rig.twist+(side?-.35:.35));
    return;
  }
  const layer=person.outfit==='overshirt'||person.outfit==='hoodie';
  draw(0,[rig.chest[0],rig.chest[1]+.015,rig.chest[2]+.132],layer?.145*build:0,.36,.025,rig.twist);
  draw(1,atHead(0,.135,-.015),0,.11,.28,yaw);
  draw(2,atHead(0,.1,.155),person.cap?.22:0,.025,.12,yaw);
  draw(3,atHead(0,.015,.132),person.glasses?.25:0,.042,.035,yaw);
  for(let side=0;side<2;side++)draw(4+side,[rig.chest[0]+(side?1:-1)*.135*build,rig.chest[1]+.025,rig.chest[2]+.115],person.backpack?.03:0,.36,.045,rig.twist);
}
export function backHair(person,rig){
  const long=person.hairStyle==='long',bun=person.hairStyle==='bun',pony=person.hairStyle==='ponytail';
  const yaw=rig.headYaw,d=long?-.09:pony?-.18:-.15;
  return {point:[rig.head[0]+Math.sin(yaw)*d,rig.head[1]+(bun?.1:pony?-.09:-.13),rig.head[2]+Math.cos(yaw)*d],scale:[long?(person.partyLook?.19:.13):bun?.08:pony?.075:0,long?(person.partyLook?.28:.23):pony?.22:.08,long?.10:.09]};
}
