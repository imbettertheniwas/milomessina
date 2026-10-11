import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationSceneRecords,registrationSceneSummary} from '../registration-scene.mjs';
import {validateMemberHistory} from '../member-series.mjs';
test('member diagram preserves actual signup dates and counts without borrowing chapter dates',()=>{
 const history=validateMemberHistory({available:true,timezone:'UTC',total:8,days:[{date:'2026-10-11',count:5},{date:'2026-09-03',count:3},{date:'2026-09-04',count:0}]});
 const records=registrationSceneRecords(history);
 assert.deepEqual(records.map(r=>[r.registered,r.joined,r.school]),[['2026-09-03',3,'2026-09'],['2026-10-11',5,'2026-10']]);
 assert.equal(records.reduce((sum,r)=>sum+r.joined,0),history.total);
 assert.equal(new Set(records.map(r=>r.id)).size,2);
 assert.ok(records.every(r=>r.memberDay&&!('active' in r)));
});
test('unavailable history never produces synthetic members and remains distinct from an empty export',()=>{
 assert.deepEqual(registrationSceneRecords(null),[]);
 assert.match(registrationSceneSummary(null),/temporarily unavailable/);
 assert.deepEqual(registrationSceneRecords({total:0,days:[]}),[]);
 assert.match(registrationSceneSummary({total:0,days:[]}),/No member registrations/);
});
test('refreshes replace signup counts and dates while keeping stable selection IDs',()=>{
 const before=registrationSceneRecords({days:[{date:'2026-10-10',count:2}]});
 const next=registrationSceneRecords({days:[{date:'2026-10-10',count:3},{date:'2026-10-11',count:1}]});
 assert.equal(next[0].id,before[0].id);assert.equal(next[0].joined,3);assert.equal(next.length,2);
 assert.match(registrationSceneSummary({total:4,days:[{date:'2026-10-10',count:3},{date:'2026-10-11',count:1}]}),/4 member registrations · 2 signup days/);
});
