import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const post = (h, token, action='list', payload={}, namespace='beta') => h.ctx.doPost({postData:{contents:JSON.stringify({_api:namespace, _session:token, action, ...payload})}});
const join = (h, name='Maya') => post(h, '', 'betajoin', {invite:'beta', name, email:name.toLowerCase()+'@example.com', phone:'+1 212 555 0100', github:name.toLowerCase()+'-builds'}, 'internal');
function lockWatch(h) {
  const state = {held:false, acquired:0, released:0};
  h.ctx.LockService.getScriptLock = () => ({
    waitLock() { assert.equal(state.held, false); state.held=true; state.acquired++; },
    releaseLock() { assert.equal(state.held, true); state.held=false; state.released++; }
  });
  return state;
}
function populated() {
  const h=harness(), token=h.login('Arya');
  assert.equal(post(h,token).ok,true);
  const joined=join(h);
  assert.equal(joined.ok,true);
  for(const [name,key] of [['internal_beta_schedules','BETA_SCHEDULES'],['internal_beta_attendance','BETA_ATTENDANCE'],['internal_beta_recaps','BETA_RECAPS']]) {
    h.ctx.betaWrite(name,h.ctx[key],{id:'record-'+name,memberId:joined.member.id});
  }
  return {h,token,joined};
}
function watchServices(h) {
  const counts={opens:0,lookups:0,values:0,sizes:0,properties:0};
  const tables={};
  const book=h.ctx.SpreadsheetApp.getActiveSpreadsheet(), getSheet=book.getSheetByName;
  book.getSheetByName=(...args)=>{counts.lookups++;return getSheet(...args);};
  for(const method of ['getActiveSpreadsheet','openById']) {
    const call=h.ctx.SpreadsheetApp[method];
    h.ctx.SpreadsheetApp[method]=(...args)=>{counts.opens++;return call(...args);};
  }
  for(const [name,sheet] of Object.entries(h.sheets)) {
    tables[name]=0;
    for(const method of ['getLastRow','getLastColumn']) {
      const call=sheet[method];
      sheet[method]=(...args)=>{counts.sizes++;return call(...args);};
    }
    const getRange=sheet.getRange;
    sheet.getRange=(...args)=>{
      const range=getRange(...args), getValues=range.getValues;
      range.getValues=()=>{counts.values++;tables[name]++;return getValues();};
      return range;
    };
  }
  const props=h.ctx.PropertiesService.getScriptProperties(), getProperty=props.getProperty;
  props.getProperty=(...args)=>{counts.properties++;return getProperty(...args);};
  h.ctx.PropertiesService.getScriptProperties=()=>props;
  return {counts,tables};
}

test('a populated Beta list uses 23 service operations with absent roadmap tables and never joins the write queue',()=>{
  const {h,token}=populated(), locks=lockWatch(h), {counts,tables}=watchServices(h);
  const listed=post(h,token);
  assert.equal(listed.ok,true);
  assert.equal(listed.members.length,1);
  // The two roadmap tables add presence lookups only until there is a saved
  // submission or reference. Existing table reads and property calls stay flat.
  assert.deepEqual(counts,{opens:1,lookups:8,values:6,sizes:6,properties:2});
  assert.equal(Object.values(counts).reduce((sum,count)=>sum+count,0),23);
  assert.equal(h.sheets.internal_beta_challenge_progress,undefined);
  assert.equal(h.sheets.internal_beta_challenge_references,undefined);
  for(const count of Object.values(tables))assert.equal(count,1,'read each populated table including its header exactly once');
  assert.equal(locks.acquired,0);
  assert.equal(h.ctx.internalRequestState,null,'discard every private snapshot after the response');
});

test('Beta first-use initialization and legacy header upgrades retry under the write lock',()=>{
  const h=harness(), token=h.login('Arya'), locks=lockWatch(h);
  const write=h.ctx.betaWrite, setProperty=h.ctx.internalSetProperty;
  h.ctx.betaWrite=(...args)=>{assert.equal(locks.held,true);return write(...args);};
  h.ctx.internalSetProperty=(...args)=>{assert.equal(locks.held,true);return setProperty(...args);};
  assert.equal(post(h,token).ok,true);
  assert.equal(locks.acquired,1);
  const joined=join(h);assert.equal(joined.ok,true);
  const members=h.sheets.internal_beta_members;
  members.rows.forEach(row=>row.splice(13));
  const getRange=members.getRange;
  members.getRange=(...args)=>{
    const range=getRange(...args), setValues=range.setValues;
    range.setValues=(...values)=>{assert.equal(locks.held,true,'never migrate headers outside the write lock');return setValues.apply(range,values);};
    return range;
  };
  const before=locks.acquired, listed=post(h,token);
  assert.equal(listed.ok,true);
  assert.equal(listed.members[0].id,joined.member.id);
  assert.equal(locks.acquired,before+1);
  assert.deepEqual(members.rows[0],Array.from(h.ctx.BETA_MEMBERS));
  assert.equal(post(h,token).ok,true);
  assert.equal(locks.acquired,before+1,'subsequent reads require no lock');
  assert.equal(locks.acquired,locks.released);
});

test('Beta retry discards the unlocked snapshot before rechecking authorization',()=>{
  const h=harness(), token=h.login('Milo');
  let acquired=0;
  h.ctx.LockService.getScriptLock=()=>({waitLock(){
    acquired++;
    const row=h.sheets.internal_roster.rows.find(row=>row[0]==='Milo');
    row[4]='removed while waiting';
  },releaseLock(){}});
  const denied=post(h,token);
  assert.equal(acquired,1);
  assert.equal(denied.code,'AUTH_REQUIRED');
  assert.equal(h.sheets.internal_beta_batches,undefined);
});

test('Beta snapshots refresh membership, batch epochs, roster access and secrets every request',()=>{
  const {h,joined}=populated(), token=h.login('Milo');
  assert.equal(post(h,joined.token).ok,true);
  const members=h.sheets.internal_beta_members.rows;
  const member=members.find(row=>String(row[0]).replace(/^\u200b/,'')===joined.member.id);
  member[h.ctx.BETA_MEMBERS.indexOf('epoch')]=99;
  assert.equal(post(h,joined.token).code,'AUTH_REQUIRED');
  member[h.ctx.BETA_MEMBERS.indexOf('epoch')]=1;
  assert.equal(post(h,joined.token).ok,true);
  const batch=h.sheets.internal_beta_batches.rows[1];
  batch[h.ctx.BETA_BATCHES.indexOf('active')]=false;
  assert.equal(post(h,joined.token).code,'AUTH_REQUIRED');
  batch[h.ctx.BETA_BATCHES.indexOf('active')]=true;
  h.properties.INTERNAL_BETA_SECRET='changed-secret-'.repeat(4);
  assert.equal(post(h,joined.token).code,'AUTH_REQUIRED');
  const row=h.sheets.internal_roster.rows.find(row=>row[0]==='Milo');
  row[4]='removed';
  assert.equal(post(h,token).code,'AUTH_REQUIRED');
});

test('writes invalidate their request snapshots and deletion returns no removed records',()=>{
  const {h,token,joined}=populated(), locks=lockWatch(h);
  const updated=post(h,token,'memberupdate',{id:joined.member.id,name:'Maya Updated'});
  assert.equal(updated.ok,true);assert.equal(updated.members[0].name,'Maya Updated');
  const renamed=post(h,token,'batchupdate',{id:updated.group.id,name:'Updated group'});
  assert.equal(renamed.ok,true);assert.equal(renamed.group.name,'Updated group');
  assert.equal(renamed.members[0].batch,'Updated group');
  const marked=post(h,joined.token,'attendance',{day:h.ctx.betaToday()});
  assert.equal(marked.ok,true);
  assert.equal(marked.attendance.filter(row=>row.day===h.ctx.betaToday()).length,1);
  const removed=post(h,joined.token,'attendanceremove',{day:h.ctx.betaToday()});
  assert.equal(removed.ok,true);
  assert.equal(removed.attendance.filter(row=>row.day===h.ctx.betaToday()).length,0);
  const deleted=post(h,token,'memberdelete',{id:joined.member.id});
  assert.equal(deleted.ok,true);assert.equal(deleted.members.length,0);
  assert.equal(deleted.schedules.length,0);assert.equal(deleted.recaps.length,0);assert.equal(deleted.attendance.length,0);
  assert.equal(locks.acquired,5);assert.equal(locks.acquired,locks.released);
});

test('Beta reads proceed while another request owns the lock, but mutating list routes still acquire it',()=>{
  const {h,token}=populated();
  let attempts=0;
  h.ctx.LockService.getScriptLock=()=>({waitLock(){attempts++;throw Error('Another request owns the lock');},releaseLock(){}});
  assert.equal(post(h,token).ok,true);
  assert.equal(attempts,0);
  for(const namespace of ['invoice','refer']) {
    const result=post(h,token,'list',{_key:'monkey'},namespace);
    assert.equal(result.ok,false);
    assert.match(result.error,/owns the lock/);
  }
  assert.equal(attempts,2);
});

test('a manager read cannot leave private rows in a later participant response',()=>{
  const {h,token,joined}=populated(), other=join(h,'Riley');
  assert.equal(other.ok,true);
  assert.equal(post(h,token,'memberupdate',{id:joined.member.id,notes:'Private manager evaluation'}).ok,true);
  const manager=post(h,token);
  assert.equal(manager.members.length,2);
  assert.equal(manager.schedules.length,1);
  const participant=post(h,other.token);
  assert.equal(participant.ok,true);
  assert.equal(participant.manager,false);
  assert.equal(participant.members.length,1);
  assert.equal(participant.members[0].id,other.member.id);
  assert.equal(participant.schedules.length,0);
  assert.equal(participant.recaps.length,0);
  assert.equal(JSON.stringify(participant).includes('maya@example.com'),false);
  assert.equal(JSON.stringify(participant).includes('Private manager evaluation'),false);
});

test('Visits list and hours bypass the write queue while missing core-roster setup retries locked',()=>{
  const secret='visits-lock-review-secret-'.repeat(2), h=harness({VISITS_SERVICE_SECRET:secret});
  const token=h.login('Milo'), locks=lockWatch(h);
  for(const action of ['authenticatedList','list','settings']) {
    const result=post(h,token,action,{secret},'visits');
    assert.equal(result.ok,true);
  }
  assert.equal(locks.acquired,0);
  assert.equal(h.sheets.visit_requests,undefined);
  assert.equal(post(h,'invalid','authenticatedList',{secret},'visits').code,'AUTH_REQUIRED');
  assert.equal(post(h,token,'authenticatedList',{secret:'invalid'},'visits').code,'UNAUTHORIZED');
  assert.equal(locks.acquired,0);
  delete h.sheets.internal_roster;
  const book=h.ctx.SpreadsheetApp.getActiveSpreadsheet(), insert=book.insertSheet;
  book.insertSheet=(name)=>{assert.equal(locks.held,true,'initialization must hold the lock');return insert(name);};
  assert.equal(post(h,token,'authenticatedList',{secret},'visits').ok,true);
  assert.equal(locks.acquired,1);
  assert.equal(locks.released,1);
  assert.equal(h.sheets.visit_requests,undefined);
  const saved=post(h,token,'saveSettings',{secret,availability:Array.from({length:7},()=>({open:true}))},'visits');
  assert.equal(saved.ok,true);
  assert.equal(locks.acquired,2,'availability writes retain the lock');
});

test('an unlocked list retries a partially initialized Beta or Visits header behind its writer',()=>{
  const {h,token}=populated(), secret='visits-concurrent-header-'.repeat(2);
  h.properties.VISITS_SERVICE_SECRET=secret;
  const batches=h.sheets.internal_beta_batches.rows;
  const header=batches[0].slice();
  batches[0]=[];
  let acquisitions=0;
  h.ctx.LockService.getScriptLock=()=>({waitLock(){acquisitions++;batches[0]=header;},releaseLock(){}});
  assert.equal(post(h,token).ok,true);
  assert.equal(acquisitions,1);
  let visitGrid=[[]];
  const book=h.ctx.SpreadsheetApp.getActiveSpreadsheet(), getSheet=book.getSheetByName;
  book.getSheetByName=name=>name==='visit_requests'?{getDataRange:()=>({getValues:()=>visitGrid})}:getSheet(name);
  h.ctx.LockService.getScriptLock=()=>({waitLock(){acquisitions++;visitGrid=[Array.from(h.ctx.VISIT_COLUMNS)];},releaseLock(){}});
  assert.equal(post(h,token,'authenticatedList',{secret},'visits').ok,true);
  assert.equal(acquisitions,2);
  visitGrid=[['wrong header']];
  h.ctx.LockService.getScriptLock=()=>({waitLock(){acquisitions++;},releaseLock(){}});
  assert.equal(post(h,token,'authenticatedList',{secret},'visits').code,'SCHEMA');
  assert.equal(acquisitions,3,'persistent corruption retries once, then still fails');
  assert.deepEqual(visitGrid,[['wrong header']]);
});
