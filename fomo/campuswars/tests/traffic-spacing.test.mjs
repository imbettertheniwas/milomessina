import test from 'node:test';import assert from 'node:assert/strict';
import {roundedLoop} from '../village-district-layout.js';
import {createTrafficSpacing} from '../village-traffic-spacing.js';
import {helipadState,HELIPAD_SITE} from '../village-helipad.js';
test('traffic queues without overlaps through repeated Maybach arrivals and departures',()=>{
 const loops=[roundedLoop(2.4,-47.6,97.6,180.6,7.8),roundedLoop(-97.6,-47.6,-2.4,180.6,7.8)];
 const cars=Array.from({length:8},(_,i)=>({loop:i%2,length:i===3?6.5:4.5,speed:4.4})),traffic=createTrafficSpacing(loops,cars);let stopped=false;
 for(let t=0;t<450;t+=.05){const s=helipadState(t),obstacle={x:-97.5,z:HELIPAD_SITE.z+s.carZ*HELIPAD_SITE.scale,length:4.68},active=s.sequenceTime>.05&&s.sequenceTime<95.95;
 const poses=traffic.update(t,active?[obstacle]:[]);
 for(let i=0;i<cars.length;i++){
  for(let j=i+1;j<cars.length;j++){const a=poses[i],b=poses[j],axes=[a.angle,a.angle+Math.PI/2,b.angle,b.angle+Math.PI/2];const separate=axes.some(angle=>{const x=Math.sin(angle),z=Math.cos(angle),extent=(p,c)=>Math.abs(x*Math.sin(p.angle)+z*Math.cos(p.angle))*c.length/2+Math.abs(x*Math.cos(p.angle)-z*Math.sin(p.angle))*1.2;return Math.abs((a.x-b.x)*x+(a.z-b.z)*z)>extent(a,cars[i])+extent(b,cars[j]);});assert(separate,`cars ${i}/${j} overlap at ${t}`);}
  if(active&&Math.abs(poses[i].x-obstacle.x)<2)assert(Math.abs(poses[i].z-obstacle.z)>(cars[i].length+obstacle.length)/2,`car ${i} overlaps Maybach at ${t}`);
  if(t>20&&t<100&&cars[i].loop===1&&Math.abs(poses[i].x+97.6)<.1&&poses[i].z>145&&poses[i].z<156)stopped=true;
 }
 }assert(stopped,'A following car waits behind the parked Maybach');
});
