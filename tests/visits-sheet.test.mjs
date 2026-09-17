import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function sheetHarness({sheetId='',seed=null}={}){
  const rows=seed?seed.map(r=>[...r]):[],cache=new Map();let writes=0,held=false,openedById=null;
  const sheet={
    appendRow(row){rows.push([...row]);writes++;},
    setFrozenRows(){},
    getLastRow(){return rows.length;},
    getDataRange(){return {getValues:()=>rows.map(r=>[...r])};},
    getRange(row,col,height,width){return {setNumberFormat(){return this;},setValues(values){for(let i=0;i<values.length;i++)rows[row-1+i]=[...values[i]];writes++;return this;}}}
  };
  let exists=!!seed;
  const book={getSheetByName:()=>exists?sheet:null,insertSheet(){exists=true;return sheet;}};
  // getProperty has to answer per key: the script reads VISITS_SHEET_ID too.
  const props={VISITS_SERVICE_SECRET:'test-service-secret-'.repeat(3),VISITS_SHEET_ID:sheetId};
  const ctx=vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]||null})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType(){return JSON.parse(body);}})},
    LockService:{getScriptLock:()=>({waitLock(){held=true;},hasLock:()=>held,releaseLock(){held=false;}})},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,val)=>cache.set(key,val)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById(id){openedById=id;return book;}}
  });
  vm.runInContext(fs.readFileSync(new URL('../server/visits/sheet.gs',import.meta.url),'utf8'),ctx);
  const call=(action,payload={},secret='test-service-secret-'.repeat(3))=>ctx.doPost({postData:{contents:JSON.stringify({action,secret,...payload})}});
  return {call,rows,getWrites:()=>writes,openedById:()=>openedById};
}
const VISIT_HEADER=['id','name','email','social','notes','preferred_date','preferred_time','time_zone','status','created_at','updated_at','internal_notes','version'];
function record(n=1,email='guest@example.invalid'){
  return {id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),name:'=HYPERLINK("bad")',email,social:'@guest',notes:"'=literal",preferred_date:'2026-09-17',
    preferred_time:'2:15 PM',time_zone:'America/New_York',status:'pending',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),internal_notes:'',version:1};
}
test('isolated sheet rejects unauthorized reads and writes without creating a tab',()=>{
  const h=sheetHarness();
  assert.equal(h.call('list',{},'wrong').ok,false);assert.equal(h.getWrites(),0);
});
test('sheet preserves literal text, idempotency and optimistic concurrency under lock',()=>{
  const h=sheetHarness(),r=record();
  assert.equal(h.call('submit',{request:r}).ok,true);
  const written=h.getWrites();
  assert.equal(h.call('submit',{request:r}).data.duplicate,true);assert.equal(h.getWrites(),written);
  const saved=h.call('list').data.requests[0];
  assert.deepEqual(saved,r);
  assert.ok(h.rows[1][1].startsWith('\u200b='));
  assert.equal(h.call('update',{id:r.id,status:'confirmed',version:1,internalNotes:'@literal note',now:r.created_at}).ok,true);
  assert.equal(h.call('update',{id:r.id,status:'declined',version:1,internalNotes:'stale',now:r.created_at}).code,'CONFLICT');
  const updated=h.call('list').data.requests[0];
  assert.equal(updated.version,2);assert.equal(updated.internal_notes,'@literal note');assert.equal(updated.status,'confirmed');
});
test('sheet limits email submissions and shared login attempts',()=>{
  const h=sheetHarness();
  for(let n=1;n<=5;n++)assert.equal(h.call('submit',{request:record(n)}).ok,true);
  assert.equal(h.call('submit',{request:record(6)}).code,'RATE_LIMIT');
  for(let n=0;n<10;n++)assert.equal(h.call('throttle',{key:'a'.repeat(64)}).ok,true);
  assert.equal(h.call('throttle',{key:'a'.repeat(64)}).code,'RATE_LIMIT');
});

// Sharing the fomo CRM spreadsheet means another writer is in the same file.
// The CRM form receiver appends a row, and a column, to whatever tab name its
// request names, so neither may take the visit list down.
test('VISITS_SHEET_ID targets the existing spreadsheet instead of a bound one',()=>{
  const h=sheetHarness({sheetId:'fomo-crm-sheet-id'});
  assert.equal(h.call('submit',{request:record()}).ok,true);
  assert.equal(h.openedById(),'fomo-crm-sheet-id');
  assert.equal(sheetHarness().openedById(),null);
});
test('a foreign row in the tab is ignored rather than breaking the list',()=>{
  const h=sheetHarness({sheetId:'x',seed:[VISIT_HEADER,['not-a-uuid','Drive-by','x@example.invalid']]});
  assert.equal(h.call('submit',{request:record()}).ok,true);
  const requests=h.call('list').data.requests;
  assert.equal(requests.length,1);
  assert.equal(requests[0].name,'=HYPERLINK("bad")');
  // The stray row is also not counted against anyone's 24-hour limit.
  for(let n=2;n<=5;n++)assert.equal(h.call('submit',{request:record(n)}).ok,true);
  assert.equal(h.call('submit',{request:record(6)}).code,'RATE_LIMIT');
});
test('an extra column appended by the CRM receiver does not trip the schema check',()=>{
  const h=sheetHarness({sheetId:'x',seed:[VISIT_HEADER.concat(['phone'])]});
  assert.equal(h.call('submit',{request:record()}).ok,true);
  assert.equal(h.call('list').data.requests.length,1);
  assert.equal(h.call('update',{id:record().id,status:'confirmed',version:1,internalNotes:'','now':new Date().toISOString()}).ok,true);
  assert.equal(h.call('list').data.requests[0].status,'confirmed');
});
