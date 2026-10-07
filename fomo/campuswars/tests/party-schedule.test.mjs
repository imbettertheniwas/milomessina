import test from 'node:test';
import assert from 'node:assert/strict';
import {isPartyNight} from '../village-party-schedule.js';
test('party nights run Thursday through Saturday from 8 PM to 4 AM Eastern',()=>{
  for(const [time,expected] of [
    ['2026-10-08T23:59:59Z',false],['2026-10-09T00:00:00Z',true],
    ['2026-10-09T07:59:59Z',true],['2026-10-09T08:00:00Z',false],
    ['2026-10-10T00:00:00Z',true],['2026-10-11T00:00:00Z',true],
    ['2026-10-11T07:59:59Z',true],['2026-10-11T08:00:00Z',false],
    ['2026-10-12T00:00:00Z',false],['2026-10-08T02:00:00Z',false],
    ['2026-12-11T00:59:59Z',false],['2026-12-11T01:00:00Z',true],
    ['2026-11-01T05:30:00Z',true],['2026-11-01T06:30:00Z',true],['2026-11-01T09:00:00Z',false]
  ])assert.equal(isPartyNight(new Date(time)),expected,time);
});
