import test from 'node:test';
import assert from 'node:assert/strict';
import {villageQuality,createResolutionBudget} from '../village-quality.js';
test('phones retain sharp rendering while limiting large texture memory',()=>{
 const phone=villageQuality(true),desktop=villageQuality(false);
 assert.equal(phone.terrainResolution**2/desktop.terrainResolution**2,.25);
 assert.equal(phone.bannerResolution**2/desktop.bannerResolution**2,1/4);
 assert.equal(phone.antialias,false);assert.equal(phone.pixelRatio,1.25);
 assert.equal(phone.minPixelRatio,1);assert.equal(phone.frameRate,30);assert.equal(desktop.frameRate,60);
});

function samples(budget,count,{start=0,cost=8,gap=1000/30,busy=false}={}){
  for(let i=1;i<=count;i++)budget.sample(start+i*gap,cost,gap,{busy});
  return budget.ratio;
}
test('phones recover sharpness gradually after sustained headroom, never beyond their pixel budget',()=>{
  const budget=createResolutionBudget(villageQuality(true),3);
  assert.equal(samples(budget,179),1.25);
  assert.equal(samples(budget,1,{start:179*1000/30}),1.375);
  assert.equal(samples(budget,600,{start:6000}),1.5);
});
test('CPU or GPU pressure reduces resolution and recovery waits fifteen seconds',()=>{
  for(const [cost,gap] of [[29,1000/30],[5,50],[5,300]]){
    const budget=createResolutionBudget(villageQuality(true),2);
    assert.equal(samples(budget,12,{cost,gap}),1.125);
    assert.equal(samples(budget,12,{cost,gap,start:5000}),1);
    const finish=5000+12*gap;
    assert.equal(samples(budget,180,{start:finish}),1);
    assert.equal(samples(budget,1200,{start:finish+6000}),1.5);
  }
});
test('idle gaps, scene builds and isolated slow frames do not trigger buffer reallocations',()=>{
  const budget=createResolutionBudget(villageQuality(true),2);
  samples(budget,300,{cost:100,gap:0});
  samples(budget,300,{cost:100,busy:true});
  for(let i=0;i<100;i++){
    budget.sample(i*100,40,50);budget.sample(i*100+33,8,33);
  }
  assert.equal(budget.ratio,1.25);
});
test('low-density displays never upscale and desktop retains its fixed resolution',()=>{
  for(const deviceRatio of [.8,1,1.2]){
    const budget=createResolutionBudget(villageQuality(true),deviceRatio);
    assert.equal(samples(budget,900),deviceRatio);
    assert(samples(budget,300,{cost:40,gap:50})<=deviceRatio);
  }
  const desktop=createResolutionBudget(villageQuality(false),2);
  assert.equal(samples(desktop,300,{cost:100,gap:100}),2);
});
