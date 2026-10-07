import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMemberDaily} from '../../../server/member-daily.mjs';
import {validateMemberHistory} from '../member-series.mjs';
import {joinTimeSummary,validateJoinTimes,localJoinDate,hourRange} from '../join-times.mjs';
const csv=dates=>'name,email,joined\n'+dates.map(d=>'PRIVATE,secret@example.com,'+d).join('\n');
test('Eastern dates and hours handle UTC midnight, summer time and winter time',()=>{
 const history=parseMemberDaily(csv(['2026-10-07T00:30:00Z','2026-01-02T05:30:00Z','2026-07-02T04:30:00Z']),Date.parse('2026-12-01'));
 assert.equal(history.timeOfDay.days[0].counts[0],1);assert.equal(history.timeOfDay.days[1].counts[0],1);
 assert.equal(history.timeOfDay.days[2].date,'2026-10-06');assert.equal(history.timeOfDay.days[2].counts[20],1);
 assert.equal(history.days.at(-1).date,'2026-10-07');assert(!/PRIVATE|secret|email/.test(JSON.stringify(history)));
 assert.deepEqual(validateMemberHistory(history).timeOfDay,history.timeOfDay);
});
test('DST repeated hour combines both joins; spring skipped hour stays empty',()=>{
 const history=parseMemberDaily(csv(['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-03-08T06:30:00Z','2026-03-08T07:30:00Z']),Date.parse('2026-12-01'));
 assert.equal(history.timeOfDay.days[1].counts[1],2);assert.deepEqual(history.timeOfDay.days[0].counts.slice(1,4),[1,0,1]);
});
test('7-day window uses Eastern calendar dates and excludes older and future dates',()=>{
 const h=parseMemberDaily(csv(['2026-09-29T16:00:00Z','2026-09-30T16:00:00Z','2026-10-07T00:30:00Z','2026-10-07T16:00:00Z']),Date.parse('2026-10-08')).timeOfDay;
 const s=joinTimeSummary(h,'2026-10-07T01:00:00Z',7);assert.equal(s.start,'2026-09-30');assert.equal(s.end,'2026-10-06');assert.equal(s.total,2);assert.deepEqual(s.peakHours,[12,20]);assert.equal(s.dayparts.reduce((n,p)=>n+p.count,0),s.total);
 assert.equal(joinTimeSummary(h,'2026-10-07T01:00:00Z','all').total,3);assert.equal(localJoinDate('2026-10-07T01:00:00Z'),'2026-10-06');assert.equal(hourRange(23),'11 PM–12 AM');
});
test('unavailable and empty data are distinct, malformed hours cannot appear as real counts',()=>{
 assert.equal(joinTimeSummary(null,'2026-10-06'),null);
 const empty={timezone:'America/New_York',days:[]};assert.equal(joinTimeSummary(empty,'2026-10-06').total,0);assert.deepEqual(joinTimeSummary(empty,'2026-10-06').peakHours,[]);
 const day={date:'2026-10-06',counts:Array(24).fill(0)};day.counts[12]=1;
 for(const value of [{timezone:'UTC',days:[day]},{timezone:'America/New_York',days:[day,day]},{timezone:'America/New_York',days:[{...day,date:'2026-02-30'}]},{timezone:'America/New_York',days:[{...day,counts:[1]}]},{timezone:'America/New_York',days:[{...day,counts:Array(24).fill(-1)}]}])assert.equal(validateJoinTimes(value,1),null);
 assert.equal(validateJoinTimes({timezone:'America/New_York',days:[day]},2),null);
 const old=validateMemberHistory({available:true,timezone:'UTC',total:1,days:[{date:'2026-10-06',count:1}]});assert.equal(old.total,1);assert.equal(old.timeOfDay,null);
});
