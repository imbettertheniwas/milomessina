import test from 'node:test';
import assert from 'node:assert/strict';
import {paintChapterBanner} from '../village-banner-art.js';
test('every chapter banner shows actual joined members against the rounded-up 80% target even after payment',()=>{
  for(const [id,name] of [['sigma-chi-sdsu','Sigma Chi'],['kappa-sigma-coastal','Kappa Sigma'],['phi-delta-theta-tampa','Phi Delta Theta'],['phi-kappa-psi-vt','Phi Kappa Psi'],['tau-kappa-epsilon-tampa','Tau Kappa Epsilon'],['new-chapter','New Chapter']]){
    for(const [joined,active,target] of [[55,69,56],[56,69,56],[0,0,0],[34,69,56],[49,70,56],[60,100,80],[0,21,17],[90,100,80]]){
      const text=[],ctx=new Proxy({measureText:value=>({width:value.length*8}),fillText:value=>text.push(value)},{get:(object,key)=>object[key]??(()=>{})});
      paintChapterBanner(ctx,{id,name,letters:'ΑΒ',school:'Test University',shortSchool:'Test',joined,active},2048,768);
      assert(text.includes(`${joined} / ${target}`),`${id} keeps the member count visible`);
      assert(text.includes(active>0&&joined>=target?'$500 PAID':'ROAD TO $500'),`${id} preserves the payment status`);
      assert(text.includes('MEMBERS ONBOARDED'));
    }
  }
});
