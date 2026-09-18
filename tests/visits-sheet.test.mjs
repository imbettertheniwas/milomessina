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
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]||null,setProperty:(key,value)=>{props[key]=value;}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType(){return JSON.parse(body);}})},
    LockService:{getScriptLock:()=>({waitLock(){held=true;},hasLock:()=>held,releaseLock(){held=false;}})},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,val)=>cache.set(key,val)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById(id){openedById=id;return book;}}
  });
  vm.runInContext(fs.readFileSync(new URL('../fomo/setup/apps-script.gs',import.meta.url),'utf8'),ctx);
  const call=(action,payload={},secret='test-service-secret-'.repeat(3))=>ctx.visitsApi({action,secret,...payload});
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

/* Visits ride on the existing form receiver's deployment, so both files share
   one global scope in Apps Script. The visits file must add a branch without
   replacing anything the receiver already answers with. */
function receiverHarness(){
  const ctx=vm.createContext({
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType(){return JSON.parse(body);}})},
    LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})}
  });
  const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
  vm.runInContext(read('../fomo/setup/apps-script.gs'),ctx);
  const before={doPost:ctx.doPost,doGet:ctx.doGet,reply:ctx.reply,writeRow:ctx.writeRow};
  vm.runInContext(read('../server/visits/sheet.gs'),ctx);
  return {ctx,before};
}
test('the visits file adds to the receiver without replacing any of it',()=>{
  const {ctx,before}=receiverHarness();
  for(const name of Object.keys(before))
    assert.equal(ctx[name],before[name],name+' was overwritten by the visits file');
  assert.equal(typeof ctx.visitsApi,'function');
});
test('the receiver routes _api visits, and reports it as deployed',()=>{
  const {ctx}=receiverHarness();
  // Reaching visitsApi is what UNCONFIGURED proves: only it answers that code.
  const routed=ctx.doPost({postData:{contents:JSON.stringify({_api:'visits',action:'list',secret:'x'})}});
  assert.deepEqual(routed,{ok:false,data:null,code:'UNCONFIGURED'});
  assert.equal(ctx.doGet().visits,true);
  assert.equal(ctx.doGet().ledger,true);
});
test('a form post is never mistaken for a visit request',()=>{
  const {ctx}=receiverHarness();
  let wrote=null;
  ctx.writeRow=(tab,row)=>{wrote={tab,row};};
  const answer=ctx.doPost({postData:{contents:JSON.stringify({_page:'/fomo/apply/',name:'Someone'})}});
  assert.equal(answer.ok,true);
  assert.equal(wrote.tab,'apply');
});

/* The 5-per-email rule reads committed rows, so varying the email walks right
   past it. The address ceiling is what stops one sender filling the tab. */
test('submissions from one address are capped even when the email changes',()=>{
  const h=sheetHarness({sheetId:'x'}),key='a'.repeat(64);
  for(let n=1;n<=8;n++)
    assert.equal(h.call('submit',{addressKey:key,request:record(n,'guest'+n+'@example.invalid')}).ok,true);
  assert.equal(h.call('submit',{addressKey:key,request:record(9,'guest9@example.invalid')}).code,'RATE_LIMIT');
  // A different sender is unaffected.
  assert.equal(h.call('submit',{addressKey:'b'.repeat(64),request:record(10,'guest10@example.invalid')}).ok,true);
});
test('retrying one request id does not spend the address allowance',()=>{
  const h=sheetHarness({sheetId:'x'}),key='c'.repeat(64),first=record(1,'guest1@example.invalid');
  assert.equal(h.call('submit',{addressKey:key,request:first}).ok,true);
  for(let i=0;i<12;i++)assert.equal(h.call('submit',{addressKey:key,request:first}).data.duplicate,true);
  // Seven of the eight remain, so a flaky connection retrying is not punished.
  for(let n=2;n<=8;n++)
    assert.equal(h.call('submit',{addressKey:key,request:record(n,'guest'+n+'@example.invalid')}).ok,true);
  assert.equal(h.call('submit',{addressKey:key,request:record(9,'guest9@example.invalid')}).code,'RATE_LIMIT');
});

/* Closed days are enforced where the row is written, so a caller holding the
   secret cannot book a Sunday by skipping the form. */
test('the sheet stores availability and refuses a closed day',()=>{
  const h=sheetHarness({sheetId:'x'});
  // 2026-09-27 is a Sunday, 2026-09-28 a Monday.
  const sundayOff=Array.from({length:7},(_,i)=>({open:i!==0,times:['10:00 AM']}));
  assert.equal(h.call('saveSettings',{availability:sundayOff}).ok,true);
  assert.deepEqual(h.call('settings').data.availability,sundayOff);
  const sunday={...record(1),preferred_date:'2026-09-27'};
  assert.equal(h.call('submit',{request:sunday}).code,'CLOSED');
  const monday={...record(2),preferred_date:'2026-09-28'};
  assert.equal(h.call('submit',{request:monday}).ok,true);
  assert.equal(h.call('list').data.requests.length,1);
});
test('unset availability leaves every day open, as before the setting existed',()=>{
  const h=sheetHarness({sheetId:'x'});
  assert.equal(h.call('settings').data.availability,null);
  assert.equal(h.call('submit',{request:{...record(1),preferred_date:'2026-09-27'}}).ok,true);
});

// The file handed to the owner must work on its own, without a second paste.
test('the complete main script includes visits and every existing service',()=>{
  const ctx=vm.createContext({ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType(){return JSON.parse(body);}})}});
  const main=fs.readFileSync(new URL('../fomo/setup/apps-script.gs',import.meta.url),'utf8');
  vm.runInContext(main,ctx);
  for(const key of ['visits','visitHours','ledger','campus','posts','identity','moneyUndo','purchaseApproval'])
    assert.equal(ctx.doGet()[key],true,key+' is missing from the combined deployment');
  for(const name of ['doPost','doGet','invoiceApi','campusApi','postsApi','internalSessionApi'])
    assert.equal(typeof ctx[name],'function');
  const module=fs.readFileSync(new URL('../server/visits/sheet.gs',import.meta.url),'utf8');
  assert.equal(main.slice(main.indexOf('var VISIT_ID=')),module.slice(module.indexOf('var VISIT_ID=')));
});
