import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolLocation,summarizeStates,STATE_NAMES} from '../geography.mjs';
import {marketRows} from '../model.mjs';
const c=(id,school,joined=0)=>({id,school,joined,active:100,name:'Chapter '+id,type:'Fraternity',letters:'AB',registered:'2026-10-06'});
test('counts only represented US states, including registered chapters at zero members',()=>{
 const result=summarizeStates([c('1','San Diego State University',8),c('2','University of Florida',0),c('3',"Queen's University",4),c('4','Unmapped new campus',3)]);
 assert.equal(Object.keys(STATE_NAMES).length,50);assert.deepEqual(result.states.map(s=>s.code),['CA','FL']);assert.equal(result.other.length,2);assert.equal(result.regions.reduce((sum,s)=>sum+s.members,0),15);
});
test('aliases share one school while each real chapter and member count is retained',()=>{
 const {states}=summarizeStates([c('1','Indiana University - Bloomington',10),c('2','Indiana University-Bloomington',12)]);
 assert.equal(states[0].schools,1);assert.equal(states[0].chapters,2);assert.equal(states[0].members,22);assert.equal(states[0].code,'IN');
});
test('new or ambiguous schools stay unconfirmed instead of guessing a state from the name',()=>{
 assert.equal(schoolLocation('New York mystery school'),null);assert.equal(schoolLocation('Miami'),null);assert.equal(schoolLocation('University of Miami').state,'FL');assert.equal(schoolLocation('Miami University of Ohio').state,'OH');assert.equal(summarizeStates([]).states.length,0);
});
test('state filtering combines with sector and search, and unknown locations remain browsable',()=>{
 const rows=[c('1','San Diego State University',3),c('2','University of Florida',5),c('3','New school',1),{...c('4','University of Florida',2),type:'Club'}];
 assert.deepEqual(marketRows(rows,{geography:'FL',type:'Fraternity',query:'Florida'}).map(c=>c.id),['2']);assert.deepEqual(marketRows(rows,{geography:'unknown'}).map(c=>c.id),['3']);assert.equal(marketRows(rows).length,4);
});
test('coverage changes with new and removed schools in subsequent live snapshots',()=>{
 const first=[c('1','San Diego State University',3)];assert.equal(summarizeStates(first).states.length,1);assert.equal(summarizeStates([...first,c('2','University of Florida',1)]).states.length,2);assert.equal(summarizeStates([c('3',"Queen's University",1)]).states.length,0);
});
