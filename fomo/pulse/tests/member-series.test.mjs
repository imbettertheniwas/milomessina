import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMemberDaily} from '../../../server/member-daily.mjs';
import {fetchChapterSnapshot} from '../../../server/campuswars-source.mjs';
import {memberGrowthSeries,validateMemberHistory} from '../member-series.mjs';
const now=Date.parse('2026-10-06T23:00:00Z');
test('private member CSV is reduced to daily UTC totals, including escaped fields and multiline names',()=>{
 const csv='first_name,email,joined\r\n"PRIVATE, \"\"NAME\"\"",private@example.com,2026-10-01T23:30:00-04:00\r\n"PRIVATE\nNAME",secret@example.com,2026-10-02T12:00:00.123456+00:00\r\nOther,last@example.com,2026-10-06T10:00:00Z\r\n';
 const history=parseMemberDaily(csv,now);const {timeOfDay,...daily}=history;assert.deepEqual(daily,{available:true,timezone:'UTC',total:3,days:[{date:'2026-10-02',count:2},{date:'2026-10-06',count:1}]});assert(!/PRIVATE|example|email|NAME/.test(JSON.stringify(history)));
});
test('malformed or incomplete exports fail rather than reporting false zeroes',()=>{
 for(const csv of ['<html>Login required</html>','name,joined\n"unclosed,date','name,joined\nx,not-a-date','name,joined\nx,2026-10-07T10:00:00Z','name,joined\nx,2026-10-01T10:00:00Z,extra'])assert.throws(()=>parseMemberDaily(csv,now));
 assert.deepEqual(parseMemberDaily('name,joined\n',now).days,[]);
});
test('cumulative member counts include signups before the displayed window and daily gaps are zero',()=>{
 const history=validateMemberHistory({available:true,timezone:'UTC',total:13,days:[{date:'2026-09-01',count:8},{date:'2026-10-01',count:3},{date:'2026-10-06',count:2}],private:'STRIP ME'});
 const days=memberGrowthSeries(history,'2026-10-06T23:00:00Z',7);assert.equal(days[0].date,'2026-09-30');assert.equal(days[0].daily,0);assert.equal(days[0].cumulative,8);assert.equal(days.at(-1).cumulative,13);assert.equal(days.reduce((s,d)=>s+d.daily,0),5);assert(!JSON.stringify(history).includes('STRIP ME'));
 assert.equal(memberGrowthSeries(history,'2026-10-06T23:00:00Z','all').length,36);
});
test('missing history stays unavailable; malformed totals and duplicate dates are rejected',()=>{
 assert.equal(validateMemberHistory({available:false}),null);assert.equal(memberGrowthSeries(null,'2026-10-06',30),null);
 for(const days of [[{date:'2026-10-06',count:-1}],[{date:'2026-02-30',count:1}],[{date:'2026-10-06',count:1},{date:'2026-10-06',count:1}]])assert.equal(validateMemberHistory({available:true,timezone:'UTC',total:1,days}),null);
 assert.equal(validateMemberHistory({available:true,timezone:'UTC',total:5,days:[]}),null);
});
const html='<table><tr><th>Chapter</th><th>Who</th><th>Contact</th><th>Progress</th><th>Registered</th><th>Delete</th></tr><tr><td><div class="ch">Alpha Beta</div><div class="sc">Test school · Fraternity</div></td><td>PRIVATE</td><td>CONTACT</td><td><span class="prog">1 / 8</span>10 actives</td><td>Oct 1, 2026</td><td><button data-del="aaaaaaaa-abcd-abcd-abcd-123456789012"></button></td></tr></table>';
test('source requests member export server-side and returns only allowlisted aggregates',async()=>{
 const requests=[];const snapshot=await fetchChapterSnapshot({password:'private-test-secret',now:()=>new Date(now),fetchImpl:async(url,options)=>{requests.push(url);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return new Response(url.endsWith('.csv')?'first_name,email,joined\nPRIVATE,secret@example.com,2026-10-06T10:00:00Z':html);}});
 assert.deepEqual(requests,['https://fomocampus.com/admin/','https://fomocampus.com/admin/members.csv']);assert.equal(snapshot.memberHistory.total,1);assert(!/PRIVATE|CONTACT|secret|example/.test(JSON.stringify(snapshot)));
});
test('failed member export preserves the live chapter feed and marks history unavailable',async()=>{
 const snapshot=await fetchChapterSnapshot({password:'test',fetchImpl:async url=>new Response(url.endsWith('.csv')?'Unavailable':html,{status:url.endsWith('.csv')?503:200})});assert.equal(snapshot.chapters.length,1);assert.deepEqual(snapshot.memberHistory,{available:false});
});
