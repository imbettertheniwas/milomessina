import test from 'node:test';
import assert from 'node:assert/strict';
import {mashCalls,chapterStage,callRow} from '../calls-model.mjs';

const chapter=(id,joined,active,registered)=>({id,name:id,school:'S',shortSchool:'S',type:'Fraternity',letters:'X',joined,active,registered});
const caller=(first,outcome,chapters=[],school=null)=>({first,booked:1,attended:outcome==='attended'?1:0,noShow:0,cancelled:0,outcome,school,chapters});

test('chapter stage uses the 80% target',()=>{
 assert.equal(chapterStage(null),'none');
 assert.equal(chapterStage(chapter('a',0,10,'2026-10-01')),'signed');
 assert.equal(chapterStage(chapter('a',7,10,'2026-10-01')),'joining');
 assert.equal(chapterStage(chapter('a',8,10,'2026-10-01')),'onboarded');
 assert.equal(callRow('waited'),'showed');assert.equal(callRow('unknown'),'no-show');
});

test('full onboard rate only counts chapters signed on or after the call',()=>{
 const chapters=[chapter('old',9,10,'2026-09-05'),chapter('new',8,10,'2026-10-02'),chapter('quiet',0,50,'2026-10-02'),chapter('none',3,10,'2026-10-03')];
 const data={from:'2026-09-30',callers:[caller('2026-10-01','attended',['old'],'S'),caller('2026-10-01','no-show',['new'],'S'),caller('2026-10-01','cancelled',['quiet'],'S'),caller('2026-10-01','cancelled')]};
 const {funnel,dots,matched,comparison}=mashCalls(data,chapters);
 assert.deepEqual(funnel,{booked:4,showed:1,signed:3,joining:2,onboarded:2,onboardedAfter:1});
 assert.equal(dots[0].before,true);assert.equal(dots[1].before,false);
 assert.equal(matched.length,3);
 assert.equal(comparison.since,'2026-10-01');
 assert.equal(comparison.called.chapters,2);assert.equal(comparison.uncalled.chapters,1);
});

test('missing chapters from a stale export are ignored, not invented',()=>{
 const {funnel,dots}=mashCalls({from:'2026-09-30',callers:[caller('2026-10-01','attended',['gone'],'S')]},[]);
 assert.equal(funnel.signed,0);assert.equal(dots[0].chapter,null);
});
