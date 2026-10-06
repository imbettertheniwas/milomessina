import test from 'node:test';
import assert from 'node:assert/strict';
import {paintChapterBanner,houseEarnings} from '../village-banner-art.js';
function painted(chapter){const text=[],ctx=new Proxy({measureText:value=>({width:value.length*8}),fillText:value=>text.push(value)},{get:(object,key)=>object[key]??(()=>{})});paintChapterBanner(ctx,{id:'test',name:'Test Chapter',letters:'ΑΒ',school:'Test University',...chapter},2048,768);return text;}
test('every chapter keeps member progress visible, with earnings only above twenty members',()=>{
 for(const [joined,active,target] of [[55,69,56],[56,69,56],[0,0,0],[20,25,20],[21,100,80],[49,70,56],[90,100,80]]){
  const text=painted({joined,active});assert(text.includes(`${joined} / ${target}`));assert(text.includes('MEMBERS ONBOARDED'));
  assert.equal(text.some(s=>s.endsWith(' EARNED')),joined>20);
  assert.equal(text.includes('GOAL REACHED'),active>0&&joined>=target);
  assert(!text.some(s=>s.includes('PAID')));
 }
});
test('all eligible houses earn $6.25 per member regardless of organization type or 80% target',()=>{
 for(const type of ['Fraternity','Sorority','Professional fraternity','Business fraternity','Student organization / club'])for(const [joined,expected] of [[21,'$131.25 EARNED'],[22,'$137.50 EARNED'],[23,'$143.75 EARNED'],[80,'$500 EARNED'],[200,'$1,250 EARNED']]){
  assert.equal(houseEarnings({joined,type}),joined*6.25);assert(painted({joined,active:1000,type}).includes(expected));
 }
 for(const joined of [0,19,20])assert.equal(houseEarnings({joined}),null);
});
