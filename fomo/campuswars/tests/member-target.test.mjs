import test from 'node:test';
import assert from 'node:assert/strict';
import {paintChapterBanner} from '../village-banner-art.js';
test('every chapter banner shows actual joined members against the rounded-up 80% target before and after reaching the goal',()=>{
  for(const [id,name] of [['sigma-chi-sdsu','Sigma Chi'],['kappa-sigma-coastal','Kappa Sigma'],['phi-delta-theta-tampa','Phi Delta Theta'],['phi-kappa-psi-vt','Phi Kappa Psi'],['tau-kappa-epsilon-tampa','Tau Kappa Epsilon'],['new-chapter','New Chapter']]){
    for(const [joined,active,target] of [[55,69,56],[56,69,56],[0,0,0],[34,69,56],[49,70,56],[60,100,80],[0,21,17],[90,100,80]]){
      const text=[],ctx=new Proxy({measureText:value=>({width:value.length*8}),fillText:value=>text.push(value)},{get:(object,key)=>object[key]??(()=>{})});
      paintChapterBanner(ctx,{id,name,letters:'ΑΒ',school:'Test University',shortSchool:'Test',joined,active},2048,768);
      assert(text.includes(`${joined} / ${target}`),`${id} keeps the member count visible`);
      assert(text.includes(`$${(joined*6.25).toLocaleString('en-US',{minimumFractionDigits:Number.isInteger(joined*6.25)?0:2,maximumFractionDigits:2})} EARNED`),`${id} shows live per-member earnings`);
      assert.equal(text.includes('GOAL REACHED'),active>0&&joined>=target);
      assert(!text.some(value=>value.includes('PAID')||value.includes('ROAD TO $500')));
      assert(text.includes('MEMBERS ONBOARDED'));
    }
  }
});

test('live earning labels honor Greek, professional, business and club rates with cent rounding',()=>{
  for(const [type,joined,expected] of [
    ['Fraternity',80,'$500 EARNED'],['Sorority',90,'$562.50 EARNED'],
    ['Professional fraternity',3,'$9.38 EARNED'],['Business fraternity',80,'$250 EARNED'],
    ['Student organization / club',3,'$6.25 EARNED'],['Club',80,'$166.67 EARNED'],
    ['Fraternity',0,'$0 EARNED'],['Co-ed / other Greek org',200,'$1,250 EARNED']
  ]){
    const text=[],ctx=new Proxy({measureText:value=>({width:value.length*8}),fillText:value=>text.push(value)},{get:(object,key)=>object[key]??(()=>{})});
    paintChapterBanner(ctx,{id:'rate-check',name:'Rate Check',letters:'RC',school:'Test University',joined,active:100,type},2048,768);
    assert(text.includes(expected),`${type}: ${text.join(' | ')}`);
  }
});
