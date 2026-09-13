import {palettes} from './village-district-layout.js?v=80';

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
  const shirt=palettes.shirts[person.shirt];
  return [0xe6dfd0,shirt,shirt,0x252d36,person.bagColor,person.bagColor];
}
// A single instanced box batch holds all clothing details, including hidden
// slots, so additional identities don't create individual materials/draw calls.
export function dressPerson(person,rig,draw){
  const build=person.build??1,head=rig.head,yaw=rig.headYaw;
  const atHead=(x,y,z)=>[head[0]+x*Math.cos(yaw)+z*Math.sin(yaw),head[1]+y,head[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];
  const layer=person.outfit==='overshirt'||person.outfit==='hoodie';
  draw(0,[rig.chest[0],rig.chest[1]+.015,rig.chest[2]+.132],layer?.145*build:0,.36,.025,rig.twist);
  draw(1,atHead(0,.135,-.015),0,.11,.28,yaw);
  draw(2,atHead(0,.1,.155),person.cap?.22:0,.025,.12,yaw);
  draw(3,atHead(0,.015,.132),person.glasses?.25:0,.042,.035,yaw);
  for(let side=0;side<2;side++)draw(4+side,[rig.chest[0]+(side?1:-1)*.135*build,rig.chest[1]+.025,rig.chest[2]+.115],person.backpack?.03:0,.36,.045,rig.twist);
}
export function backHair(person,rig){
  const long=person.hairStyle==='long',bun=person.hairStyle==='bun';
  const yaw=rig.headYaw,d=long?-.09:-.15;
  return {point:[rig.head[0]+Math.sin(yaw)*d,rig.head[1]+(bun?.1:-.13),rig.head[2]+Math.cos(yaw)*d],scale:[long?.13:bun?.08:0,long?.23:.08,long?.08:.09]};
}
