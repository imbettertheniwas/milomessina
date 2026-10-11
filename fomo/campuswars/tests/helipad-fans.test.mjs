import test from 'node:test';import assert from 'node:assert/strict';import {helipadFanPose,HELIPAD_FAN_COUNT} from '../village-helipad-fans.js';
test('fans run in on arrival, photograph the helicopter, and clear the carpet corridor',()=>{
 let flashes=0;
 for(let i=0;i<HELIPAD_FAN_COUNT;i++){
  assert(helipadFanPose(i,0).visible);assert(helipadFanPose(i,20).moving||helipadFanPose(i,20).excited);assert(helipadFanPose(i,50).excited);assert(helipadFanPose(i,124).visible);
  for(let t=9;t<123;t+=.07){const p=helipadFanPose(i,t),q=helipadFanPose(i,t+.001);assert(Math.hypot(p.x-q.x,p.z-q.z)<.05);assert(Math.hypot(p.x,p.z)>12);if(p.x<0)assert(Math.abs(p.z-.3)>1.8);if(p.flash)flashes++;}
 }assert(flashes>0);
});

test('crowd fills both carpet edges with varied gestures instead of synchronized jumps',()=>{
 const poses=Array.from({length:HELIPAD_FAN_COUNT},(_,i)=>helipadFanPose(i,54));
 assert.equal(poses.length,48);assert(poses.filter(p=>p.x< -12&&p.z<0).length>=8);assert(poses.filter(p=>p.x< -12&&p.z>0).length>=8);
 assert(poses.filter(p=>p.hop===0).length>=44);assert(new Set(poses.map(p=>p.phase)).size===48);assert(poses.some(p=>p.phoneRaise>.8));assert(poses.some(p=>p.phoneRaise<.4));
});


test('the same campus residents stay visible and return continuously between arrivals',()=>{
  for(let i=0;i<HELIPAD_FAN_COUNT;i++){
    for(const t of [0,8,40,108,123,133.999,134])assert(helipadFanPose(i,t).visible);
    const last=helipadFanPose(i,133.999),first=helipadFanPose(i,134);
    assert(Math.hypot(last.x-first.x,last.z-first.z)<.01,'cycle boundary must not teleport residents');
  }
  const waiting=Array.from({length:HELIPAD_FAN_COUNT},(_,i)=>helipadFanPose(i,0));
  assert(waiting.some(p=>p.moving)&&waiting.some(p=>!p.moving));
  assert(Math.max(...waiting.map(p=>p.z))-Math.min(...waiting.map(p=>p.z))>75);
});
