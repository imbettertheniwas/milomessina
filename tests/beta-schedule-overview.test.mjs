import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBetaScheduleOverview, betaScheduleOverviewHTML} from '../invoice/beta-schedule-overview.js';

const member=(id, over={})=>({id,name:'Intern '+id,status:'active',batchId:'one',...over});
const block=(day,start='09:00',end='10:00',label='Class')=>({day,start,end,label});
const schedule=(memberId,over={})=>({memberId,mode:'manual',ready:true,timezone:'America/New_York',blocks:[block(1)],noCommitments:false,...over});
const data=(members,schedules,over={})=>({manager:true,members,schedules,batches:[{id:'one',name:'First group'},{id:'two',name:'Second group'}],...over});

test('weekly overview combines every member, Monday through Sunday, preserving separate time zones',()=>{
  const overview=buildBetaScheduleOverview(data([member('b'),member('a'),member('c')],[
    schedule('a',{blocks:[block(0,'12:00','13:00'),block(1,'11:00','12:00')]}),
    schedule('b',{blocks:[block(1,'09:00','10:30')]}),
    schedule('c',{timezone:'America/Los_Angeles',blocks:[block(1,'08:00','09:00')]})
  ]));
  assert.equal(overview.rows.length,3);assert.equal(overview.counts.manual,3);assert.equal(overview.lanes.length,2);
  const ny=overview.lanes.find(lane=>lane.timezone==='America/New_York');
  assert.deepEqual(ny.days.map(day=>day.day),[1,2,3,4,5,6,0]);
  assert.deepEqual(ny.days[0].blocks.map(item=>item.memberId),['b','a']);
  assert.equal(ny.days[6].blocks[0].memberId,'a');
  assert.equal(overview.lanes[0].days[0].blocks[0].start,'08:00','submitted wall-clock times are not silently converted');
});

test('missing, unfinished, attached and explicitly empty schedules never become available time blocks',()=>{
  const overview=buildBetaScheduleOverview(data(['missing','pending','file','clear','invalid'].map(id=>member(id)),[
    schedule('pending',{ready:false}),schedule('file',{mode:'file',file:{name:'classes.pdf'},blocks:[]}),
    schedule('clear',{blocks:[],noCommitments:true}),schedule('invalid',{blocks:[]})
  ]));
  assert.deepEqual(Object.fromEntries(overview.rows.map(row=>[row.memberId,row.status])),{clear:'clear',file:'file',invalid:'review',missing:'missing',pending:'pending'});
  assert.equal(overview.lanes.length,0);
  const html=betaScheduleOverviewHTML(overview);
  for(const label of ['No schedule provided','Saving unfinished','File to review','No recurring commitments','Schedule needs review'])assert.ok(html.includes(label));
  assert.match(html,/Empty days mean no recorded commitments, not confirmed availability/);
  assert.doesNotMatch(html,/data-schedule-file|fetch\(|href=/);
});

test('malformed blocks, inconsistent empty declarations and invalid zones are flagged for review',()=>{
  const schedules=[
    schedule('badTime',{blocks:[block(1,'10:00','09:00')]}),
    schedule('badDay',{blocks:[block(7)]}),
    schedule('incomplete',{blocks:[block(1),block(3,'not-a-time')]}),
    schedule('badZone',{timezone:'Not/A_Zone'}),
    schedule('contradiction',{noCommitments:true}),
    schedule('missingReady',{ready:undefined})
  ];
  const view=buildBetaScheduleOverview(data(schedules.map(item=>member(item.memberId)),schedules));
  assert.equal(view.counts.review,5);assert.equal(view.counts.pending,1);assert.equal(view.lanes.length,0);
});

test('batch and timezone filters include unknown schedules and recover cleanly after members disappear',()=>{
  const payload=data([member('a'),member('b',{batchId:'two'}),member('c',{batchId:'two'})],[schedule('a'),schedule('b',{timezone:'America/Chicago'})]);
  const all=buildBetaScheduleOverview(payload);
  assert.equal(all.batchOptions.length,2);assert.ok(all.timezoneOptions.includes(''));
  const group=buildBetaScheduleOverview(payload,{batch:'two'});
  assert.deepEqual(group.rows.map(row=>row.memberId),['b','c']);
  assert.deepEqual(group.timezoneOptions,['','America/Chicago']);
  assert.deepEqual(buildBetaScheduleOverview(payload,{batch:'two',timezone:''}).rows.map(row=>row.memberId),['c']);
  assert.deepEqual(buildBetaScheduleOverview(payload,{batch:'two',timezone:'America/Chicago'}).rows.map(row=>row.memberId),['b']);
  const stale=buildBetaScheduleOverview(payload,{batch:'deleted',timezone:'Europe/London'});
  assert.equal(stale.batch,'all');assert.equal(stale.timezone,'all');assert.equal(stale.rows.length,3);
});

test('overview requires a manager response, ignores orphan schedules, and omits private profile fields',()=>{
  const payload=data([member('a',{email:'private@example.invalid',phone:'secret phone',notes:'secret notes'})],[schedule('a'),schedule('orphan')]);
  assert.equal(buildBetaScheduleOverview({...payload,manager:false}),null);
  const overview=buildBetaScheduleOverview(payload),html=betaScheduleOverviewHTML(overview);
  assert.equal(overview.rows.length,1);assert.equal(overview.lanes[0].days[0].blocks.length,1);
  assert.doesNotMatch(JSON.stringify(overview)+html,/private@example|secret phone|secret notes|orphan/);
});

test('rendered group names, member names, IDs and commitment labels cannot inject markup',()=>{
  const overview=buildBetaScheduleOverview(data([member('a" onclick="bad',{name:'<script>bad()</script>'}),member('b',{batchId:'two'})],[
    schedule('a" onclick="bad',{blocks:[block(1,'09:00','10:00','<img src=x onerror=bad()>')]})
  ],{batches:[{id:'one',name:'<svg onload=bad()>'},{id:'two',name:'Other'}]}));
  const html=betaScheduleOverviewHTML(overview);
  assert.doesNotMatch(html,/<script|<img|<svg|data-overview-member="a" onclick=/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.match(html,/&lt;svg/);
});
