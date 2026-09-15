import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {moneyRecipients,createMoneyRain,MONEY_START,MONEY_END,RAIN_HALF_WIDTH,RAIN_BACK,RAIN_FRONT} from '../village-money-rain.js';
const chapters=[{id:'first',joined:60,active:100},{id:'second',joined:34,active:69},{id:'third',joined:21,active:50},{id:'construction',joined:14,active:30},{id:'empty',joined:0,active:60}];
// Lots face the street from both sides of the row, as createLots builds them.
const anchors=chapters.map((c,i)=>({id:c.id,lot:{x:i%2?20:-20,z:Math.floor(i/2)*19-19,rotation:i%2?-Math.PI/2:Math.PI/2},point:new T.Vector3(0,14,0),house:{halfWidth:6,front:4.2}}));
// Bill positions are read back in the lot's own coordinates: +z runs from the
// house across the lawn where the chapter's crowd stands.
const local=(row,point)=>({x:(point.x-row.x)*Math.cos(row.rotation)-(point.z-row.z)*Math.sin(row.rotation),z:(point.x-row.x)*Math.sin(row.rotation)+(point.z-row.z)*Math.cos(row.rotation)});
const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
test('rain follows actual onboarding ranks, excludes construction below its goal, and treats ties equally',()=>{
  const rows=moneyRecipients(chapters,anchors);
  assert.deepEqual(rows.map(row=>row.id),['first','second','third']);
  assert(rows[0].count>rows[1].count&&rows[1].count>rows[2].count);
  const tied=moneyRecipients([{...chapters[0],joined:50},{...chapters[1],joined:50,active:100}],anchors);
  assert.equal(tied[0].rank,tied[1].rank);assert.equal(tied[0].count,tied[1].count);
});
test('clouds and bills exist only during the reward beat, stay over eligible lots, and freeze with time',()=>{
  const rain=createMoneyRain(T,chapters,anchors);
  rain.update(MONEY_START);assert.equal(rain.root.visible,false);
  rain.update(9.5);assert.equal(rain.root.visible,true);assert.equal(rain.root.children.length,2);
  const bills=rain.root.getObjectByName('rank-weighted-money');let index=0;
  for(const row of rain.recipients)for(let i=0;i<row.count;i++){
    bills.getMatrixAt(index++,matrix);matrix.decompose(position,rotation,scale);
    const spot=local(row,position);
    assert(Math.abs(spot.x)<RAIN_HALF_WIDTH+1.2);assert(spot.z>RAIN_BACK-1&&spot.z<RAIN_FRONT+1);
    assert(position.y>0);assert(position.y<=row.roof+12.5);
  }
  const frozen=Array.from(bills.instanceMatrix.array);rain.update(9.5);assert.deepEqual(Array.from(bills.instanceMatrix.array),frozen);
  rain.update(9.6);assert.notDeepEqual(Array.from(bills.instanceMatrix.array),frozen);
  rain.update(MONEY_END);assert.equal(rain.root.visible,false);
  rain.update(9.5);rain.clear();assert.equal(rain.root.visible,false);
  rain.update(9.5);assert.equal(rain.root.visible,true);rain.dispose();
});
test('money falls past the eaves onto the lawn crowd as well as onto the roof',()=>{
  const rain=createMoneyRain(T,chapters,anchors);
  const bills=rain.root.getObjectByName('rank-weighted-money');
  const reach=new Map(rain.recipients.map(row=>[row.id,{roof:0,lawn:0,inside:0}]));
  // One whole beat, so every bill is seen through its fall.
  for(let time=MONEY_START;time<MONEY_END;time+=1/60){
    rain.update(time);let index=0;
    for(const row of rain.recipients){
      const tally=reach.get(row.id);
      for(let i=0;i<row.count;i++){
        bills.getMatrixAt(index++,matrix);matrix.decompose(position,rotation,scale);
        if(scale.x<=.002)continue;
        const spot=local(row,position);
        if(position.y<=row.roof+1.1&&position.y>row.roof-.5&&Math.abs(spot.x)<row.houseHalf&&spot.z<row.houseFront)tally.roof++;
        if(position.y<2.2&&spot.z>row.houseFront)tally.lawn++;
        // Nothing may sink through a roof it was meant to land on.
        if(position.y<row.roof-1&&Math.abs(spot.x)<row.houseHalf-1&&spot.z<row.houseFront-1)tally.inside++;
      }
    }
  }
  for(const [id,tally] of reach){
    assert(tally.roof>0,`${id} keeps bills landing on its roof`);
    assert(tally.lawn>0,`${id} rains on the lawn where its crowd stands`);
    assert.equal(tally.inside,0,`${id} drops no bills through the house`);
  }
  rain.dispose();
});

test('live registration changes rebuild eligible rain and release replaced instance buffers',()=>{
  const rain=createMoneyRain(T,chapters,anchors);let disposed=0;
  rain.root.children.forEach(mesh=>mesh.addEventListener('dispose',()=>disposed++));
  const updated=chapters.map(c=>c.id==='construction'?{...c,joined:15,active:30}:c.id==='first'?{...c,joined:14}:c);
  rain.setChapters(updated,anchors);assert.equal(disposed,2);
  assert(!rain.recipients.some(row=>row.id==='first'));assert(rain.recipients.some(row=>row.id==='construction'));
  rain.update(9);assert.equal(rain.root.visible,true);
  rain.setChapters([],[]);rain.update(9);assert.equal(rain.root.visible,false);assert.equal(rain.root.children.length,0);rain.dispose();
});


test('goal houses celebrate for 20 seconds while other houses stay dry; unchanged feeds do not replay',()=>{
  const goalChapters=chapters.map(c=>c.id==='first'?{...c,joined:80}:c);
  const rain=createMoneyRain(T,goalChapters,anchors);
  rain.updateRewards(12);assert(rain.root.visible);
  const bills=rain.root.getObjectByName('rank-weighted-money');let index=0;
  for(const row of rain.recipients)for(let i=0;i<row.count;i++){
    bills.getMatrixAt(index++,matrix);matrix.decompose(position,rotation,scale);
    if(!row.goalReached)assert.equal(scale.x,0);
  }
  rain.setChapters(goalChapters,anchors);rain.updateRewards(8);assert.equal(rain.root.visible,false);
  rain.updateRewards(1);assert.equal(rain.root.visible,false);
  const reached=goalChapters.map(c=>c.id==='construction'?{...c,joined:24}:c);
  rain.setChapters(reached,anchors);rain.updateRewards(1);assert(rain.root.visible);
  rain.dispose();
});
test('a small chapter can celebrate its 80% goal while its house is under construction',()=>{
  const rain=createMoneyRain(T,[{...chapters[3],joined:8,active:10}],anchors);
  rain.updateRewards(1);assert(rain.root.visible);assert.equal(rain.recipients[0].id,'construction');rain.dispose();
});
