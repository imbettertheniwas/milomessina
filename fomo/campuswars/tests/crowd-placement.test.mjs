import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crowdMembers,createLots} from '../village-layout.js';

const chapter=(id,joined,active=300)=>({id,name:'Alpha Beta',joined,active});
// Full member records captured from the exhaustive 250-candidate algorithm
// before optimization, prior to the optional social itinerary pass: locations, poses, appearance, activities and population.
const cases=[
  ['construction',[0,1,2,8,14].map((n,i)=>chapter(`builders-${i}`,n)),'f792802718dd55087bb9e7b0808a9f550309dacf321e650d2afb0c3dbab9354d'],
  ['house thresholds',[1,2,8,14,15,16,19,20,21].map((n,i)=>chapter(`threshold-${i}`,n,i<4?1:100)),'2b936725a25e0c06e92ae75c92152ac54bcb6062f7dead5d31cb799530eaeda5'],
  ['dense crowds',[37,60,81,120,180].map((n,i)=>chapter(`dense-${i}`,n)),'5d649397c53762760f2cd474bbdd1b2003f2c73f4bed6244e7e61df8fe41720b'],
  ['multiple streets',Array.from({length:23},(_,i)=>chapter(`street-${i}`,15+(i%4)*7)),'4828ca0e3c6d71e1c9a53f043e9210535f96e37e7f91f5eec5cfd5ad653b590d']
];
for(const [name,chapters,expected] of cases)test(`faster crowd placement preserves every member exactly: ${name}`,()=>{
  const members=crowdMembers(chapters,createLots(chapters.length),undefined,{social:false});
  assert.equal(members.length,chapters.reduce((sum,c)=>sum+c.joined,0));
  assert.equal(createHash('sha256').update(JSON.stringify(members)).digest('hex'),expected);
});
