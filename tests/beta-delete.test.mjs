import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const post=(h,namespace,action,token,p={})=>h.ctx.doPost({postData:{contents:JSON.stringify({_api:namespace,action,_session:token,...p})}});
const api=(h,token,action,p={})=>post(h,'beta',action,token,p);
const setup=()=>{
 const h=harness(),operator=h.login('Arya');
 api(h,operator,'list');return {...h,operator};
};
const join=(h,name,joinRequest)=>post(h,'internal','betajoin','',{invite:'beta',name,email:name.toLowerCase()+'@example.com',phone:'+1 212 555 0100',github:name.toLowerCase()+'-builds',joinRequest});
const rows=(h,table,cols)=>h.ctx.betaRead(table,cols);

for(const administrator of ['Milo','Arya'])test(`${administrator} deletes only the selected beta profile and its attendance and recap`,()=>{
 const h=setup(),a=h.login(administrator),target=join(h,'Maya','a'.repeat(32)),other=join(h,'Riley','b'.repeat(32));
 const core=h.call(h.login('Bijan'),'add',{who:'Bijan',what:'Supplies',category:'supplies',amount:12,date:'2026-09-15'});
 assert.equal(core.ok,true);
 for(const person of [target,other]) {
  assert.equal(api(h,person.token,'attendance',{day:person.member.startDate}).ok,true);
  assert.equal(api(h,person.token,'recap',{learned:'Learned JavaScript',accomplished:'Built a demo',submit:true}).ok,true);
 }
 // Exercise descending deletion through interleaved historical rows.
 h.ctx.betaWrite('internal_beta_attendance',h.ctx.BETA_ATTENDANCE,{id:'target-extra',memberId:target.member.id,day:target.member.endDate,createdAt:'2026-10-08T12:00:00Z'});
 api(h,a,'memberupdate',{id:target.member.id,notes:'Private review',website:'maya.example.com'});
 const preserved={group:JSON.stringify(h.sheets.internal_beta_batches.rows),core:JSON.stringify(h.sheets.invoice.rows),properties:JSON.stringify(h.properties)};
 const result=api(h,a,'memberdelete',{id:target.member.id});
 assert.equal(result.ok,true);assert.equal(result.betaDelete,true);assert.equal(result.deletedMemberId,target.member.id);assert.equal(result.alreadyDeleted,false);
 assert.deepEqual(result.members.map(m=>m.id),[other.member.id]);
 assert.deepEqual(result.attendance.map(r=>r.memberId),[other.member.id]);assert.deepEqual(result.recaps.map(r=>r.memberId),[other.member.id]);
 assert.equal(api(h,target.token,'list').code,'AUTH_REQUIRED');
 assert.equal(post(h,'internal','betalogin','',{code:target.code}).ok,false);
 assert.equal(api(h,other.token,'list').ok,true);assert.equal(post(h,'internal','betalogin','',{code:other.code}).ok,true);
 assert.equal(JSON.stringify(h.sheets.internal_beta_batches.rows),preserved.group);
 assert.equal(JSON.stringify(h.sheets.invoice.rows),preserved.core);assert.equal(JSON.stringify(h.properties),preserved.properties);
 const stored=rows(h,'internal_beta_deletions',h.ctx.BETA_DELETIONS);
 assert.equal(stored.length,1);assert.match(stored[0].joinRequestHash,/^[a-f0-9]{64}$/);
 const tombstone=JSON.stringify(stored);
 for(const privateValue of ['Maya','maya@example.com','Private review','maya.example.com',target.code,'a'.repeat(32)])assert.equal(tombstone.includes(privateValue),false);
 assert.equal(JSON.stringify(result).includes(stored[0].joinRequestHash),false);
});

test('missing IDs are rejected and repeat deletion succeeds without touching remaining records',()=>{
 const h=setup(),target=join(h,'Maya'),other=join(h,'Riley');
 for(const id of [undefined,null,'','  ',[],123,'x'.repeat(101)])assert.equal(api(h,h.operator,'memberdelete',{id}).ok,false);
 assert.equal(api(h,h.operator,'list').members.length,2);
 assert.equal(api(h,h.operator,'memberdelete',{id:target.member.id}).ok,true);
 const before=JSON.stringify(Object.fromEntries(Object.entries(h.sheets).map(([name,sheet])=>[name,sheet.rows])));
 const repeat=api(h,h.operator,'memberdelete',{id:target.member.id});
 assert.equal(repeat.ok,true);assert.equal(repeat.alreadyDeleted,true);
 assert.deepEqual(repeat.members.map(m=>m.id),[other.member.id]);
 assert.equal(JSON.stringify(Object.fromEntries(Object.entries(h.sheets).map(([name,sheet])=>[name,sheet.rows]))),before);
 assert.equal(h.ctx.doGet().betaDelete,true);
});

test('ordinary core identities and beta identities named administrators cannot delete any intern',()=>{
 const h=setup(),target=join(h,'Maya');
 for(const token of ['',h.login('Bijan'),join(h,'Milo').token,join(h,'Arya').token,target.token]) {
  const result=api(h,token,'memberdelete',{id:target.member.id,who:'Arya',admin:true,operator:true});
  assert.equal(result.ok,false);assert.equal(rows(h,'internal_beta_members',h.ctx.BETA_MEMBERS).some(m=>m.id===target.member.id),true);
  assert.equal(api(h,target.token,'list').ok,true);
 }
 assert.equal(h.sheets.internal_beta_deletions,undefined);
});

test('interrupted cascade keeps access revoked and deletion retry finishes cleanup',()=>{
 const h=setup(),target=join(h,'Maya','c'.repeat(32)),other=join(h,'Riley');
 for(const person of [target,other]) {
  api(h,person.token,'attendance',{day:person.member.startDate});
  api(h,person.token,'recap',{learned:'Learned',accomplished:'Built',submit:true});
 }
 const recaps=h.sheets.internal_beta_recaps,remove=recaps.deleteRow;
 recaps.deleteRow=()=>{throw new Error('Temporary recap sheet failure');};
 const failed=api(h,h.operator,'memberdelete',{id:target.member.id});
 assert.equal(failed.ok,false);assert.match(failed.error,/recap sheet failure/);
 const member=rows(h,'internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===target.member.id);
 assert.equal(member.status,'paused');assert.equal(member.codeHash,'');
 assert.equal(api(h,target.token,'list').ok,false);assert.equal(post(h,'internal','betalogin','',{code:target.code}).ok,false);
 assert.equal(join(h,'Maya','c'.repeat(32)).ok,false);
 assert.equal(rows(h,'internal_beta_attendance',h.ctx.BETA_ATTENDANCE).some(r=>r.memberId===target.member.id),false);
 recaps.deleteRow=remove;
 const retried=api(h,h.operator,'memberdelete',{id:target.member.id});
 assert.equal(retried.ok,true);assert.deepEqual(retried.members.map(m=>m.id),[other.member.id]);
 assert.deepEqual(retried.recaps.map(r=>r.memberId),[other.member.id]);assert.equal(api(h,other.token,'list').ok,true);
});

test('a failure to save revocation never begins deleting related data',()=>{
 const h=setup(),target=join(h,'Maya');
 api(h,target.token,'attendance',{day:target.member.startDate});
 const write=h.ctx.betaWrite;
 h.ctx.betaWrite=(table,columns,record)=>{if(table==='internal_beta_members')throw new Error('Cannot revoke yet');return write(table,columns,record);};
 assert.equal(api(h,h.operator,'memberdelete',{id:target.member.id}).ok,false);
 assert.equal(rows(h,'internal_beta_attendance',h.ctx.BETA_ATTENDANCE).length,1);
 assert.equal(rows(h,'internal_beta_members',h.ctx.BETA_MEMBERS).length,1);assert.equal(h.sheets.internal_beta_deletions,undefined);
 h.ctx.betaWrite=write;
 assert.equal(api(h,h.operator,'memberdelete',{id:target.member.id}).ok,true);
});

test('consumed join requests stay deleted while intentional fresh signup gets a new profile and personal link',()=>{
 const h=setup(),request='d'.repeat(32),original=join(h,'Maya',request);
 assert.equal(api(h,h.operator,'memberdelete',{id:original.member.id}).ok,true);
 const replay=join(h,'Maya',request);
 assert.equal(replay.ok,false);assert.equal(replay.joinSaved,false);assert.match(replay.error,/deleted profile/);
 assert.equal(api(h,h.operator,'list').members.length,0);
 const fresh=join(h,'Maya','e'.repeat(32));
 assert.equal(fresh.ok,true);assert.notEqual(fresh.member.id,original.member.id);assert.notEqual(fresh.code,original.code);
 assert.equal(post(h,'internal','betalogin','',{code:original.code}).ok,false);
 assert.equal(api(h,original.token,'list').ok,false);
 assert.equal(join(h,'Maya',request).ok,false);
});

test('join and deletion execute under the same request lock and release it on success or failure',()=>{
 const h=setup();let locked=false,acquired=0,released=0;
 h.ctx.LockService.getScriptLock=()=>({waitLock(){assert.equal(locked,false);locked=true;acquired++;},releaseLock(){assert.equal(locked,true);locked=false;released++;}});
 const write=h.ctx.betaWrite;
 h.ctx.betaWrite=(...args)=>{assert.equal(locked,true);return write(...args);};
 const target=join(h,'Maya','f'.repeat(32));assert.equal(target.ok,true);
 assert.equal(api(h,h.operator,'memberdelete',{id:target.member.id}).ok,true);
 assert.equal(api(h,h.operator,'memberdelete',{id:''}).ok,false);
 assert.equal(acquired,3);assert.equal(released,3);assert.equal(locked,false);
});
