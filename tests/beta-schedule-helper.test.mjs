import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleFile, normalizeSchedule, SCHEDULE_MAX_FILE_BYTES} from '../invoice/beta-schedule.js';

const manual = (over={}) => ({mode:'manual',timezone:'America/New_York',blocks:[{day:1,start:'09:00',end:'12:30',label:' Class '}],...over});
const file = (name,type,bytes) => ({name,type,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});

test('schedule helper validates manual commitments and explicit empty schedules',()=>{
  assert.equal(normalizeSchedule(manual()).blocks[0].label,'Class');
  for(const blocks of [[{day:7,start:'09:00',end:'10:00'}],[{day:1,start:'12:00',end:'10:00'}],[{day:1,start:'9:00',end:'10:00'}],Array(81).fill(manual().blocks[0]),[]]) assert.throws(()=>normalizeSchedule(manual({blocks})));
  assert.throws(()=>normalizeSchedule(manual({timezone:'Invalid/Zone'})));
  assert.equal(normalizeSchedule(manual({blocks:[],noCommitments:true})).noCommitments,true);
  assert.throws(()=>normalizeSchedule(null));
  assert.equal(normalizeSchedule(null,{allowEmpty:true}),null);
});

test('schedule helper preserves supported file bytes and canonical MIME',async()=>{
  for(const [name,type,bytes,canonical] of [
    ['week.pdf','application/pdf',Buffer.from('%PDF-1.7\nTest'),'application/pdf'],
    ['week.png','',Buffer.from([137,80,78,71,13,10,26,10]),'image/png'],
    ['week.jpg','image/jpeg',Buffer.from([255,216,255,224]),'image/jpeg'],
    ['week.ics','text/plain',Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'),'text/calendar']
  ]) {
    const saved=await scheduleFile(file(name,type,bytes));
    assert.equal(saved.type,canonical);assert.equal(saved.data,bytes.toString('base64'));
    assert.deepEqual(normalizeSchedule({mode:'file',timezone:'UTC',file:saved}).file,saved);
  }
});

test('schedule helper rejects invalid names, disguised bytes, and oversized files before reading',async()=>{
  for(const input of [file('week.txt','application/pdf',Buffer.from('%PDF-1.7')),file('../week.pdf','application/pdf',Buffer.from('%PDF-1.7')),file('week.pdf','image/png',Buffer.from('%PDF-1.7')),file('week.pdf','application/pdf',Buffer.from('<script>')),file('week.ics','text/calendar',Buffer.from('BEGIN:VEVENT\nEND:VEVENT'))]) await assert.rejects(scheduleFile(input));
  let read=false;await assert.rejects(scheduleFile({name:'week.pdf',type:'application/pdf',size:SCHEDULE_MAX_FILE_BYTES+1,arrayBuffer:async()=>{read=true;}}));assert.equal(read,false);
  assert.throws(()=>normalizeSchedule({mode:'file',timezone:'UTC',file:{name:'week.pdf',type:'application/pdf',data:'bad!'}}));
});

test('existing attachment reuse is explicit and disallowed on onboarding',()=>{
  const input={mode:'file',timezone:'UTC',keepFile:true,file:{name:'week.pdf',type:'application/pdf',size:10}};
  assert.throws(()=>normalizeSchedule(input));
  assert.deepEqual(normalizeSchedule(input,{allowExistingFile:true}),{mode:'file',timezone:'UTC',blocks:[],keepFile:true});
});
