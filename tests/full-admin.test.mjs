import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const spend=(over={})=>({who:'Jesse',what:'Team lunch',category:'lunch',amount:30,date:'2026-09-15',shared:'Jesse,Bijan',...over});
const review=r=>JSON.stringify([r.date,r.who,r.what,r.category,Number(r.amount),r.note||'',r.receipt||'',r.shared||'']);
const block={who:'Jesse',label:'Class',kind:'class',days:[1,3],start:'09:00',end:'10:00'};
const admin=(h,token,action,p={})=>h.ctx.internalAdminApi({_key:'monkey',_session:token,action,...p});

test('both core administrators receive the same verified role, while request fields cannot grant it',()=>{
 const h=harness();
 for(const who of ['Milo','Arya','Bijan']) {
  const signed=h.ctx.internalSessionApi({action:'login',who,passcode:'monkey'});
  const expected=who!=='Bijan';
  assert.equal(signed.ok,true);assert.equal(signed.admin,expected);assert.equal(signed.operator,expected);
  const verified=h.ctx.internalSessionApi({action:'session',_session:signed.token,who:'Arya',admin:true});
  assert.equal(verified.who,who);assert.equal(verified.admin,expected);assert.equal(verified.operator,expected);
 }
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Milo',passcode:'wrong'}).ok,false);
 const b=h.login('Bijan');
 assert.equal(admin(h,b,'rosteradd',{name:'Nadia',who:'Arya',admin:true}).ok,false);
});

for(const administrator of ['Milo','Arya']) {
 test(`${administrator} approves, settles, edits and deletes another person's purchase`,()=>{
  const h=harness(),a=h.login(administrator),j=h.login('Jesse'),b=h.login('Bijan');
  const row=h.call(j,'add',spend()).rows[0];
  assert.equal(h.call(b,'purchaseapprove',{id:row.id,reviewed:review(row),who:administrator,admin:true}).ok,false);
  const approved=h.call(a,'purchaseapprove',{id:row.id,reviewed:review(row)});
  assert.equal(approved.ok,true);assert.equal(approved.rows[0].approvedBy,administrator);assert.ok(approved.rows[0].approvedAt);
  assert.equal(h.call(a,'settle',{who:'Jesse'}).rows[0].status,'reimbursed');
  assert.equal(h.call(b,'edit',{id:row.id,...spend({amount:35})}).ok,false);
  const edited=h.call(a,'edit',{id:row.id,...spend({amount:35})});
  assert.equal(edited.ok,true);assert.equal(edited.rows[0].amount,35);assert.equal(edited.rows[0].approvedBy,'');
  assert.equal(h.call(a,'purchaseapprove',{id:row.id,reviewed:review(edited.rows[0])}).rows[0].approvedBy,administrator);
  assert.equal(h.call(a,'purchaseunapprove',{id:row.id}).rows[0].approvedBy,'');
  assert.equal(h.call(a,'delete',{id:row.id}).rows.length,0);
 });

 test(`${administrator} can review and undo another person's money history without bypassing stale-record protection`,()=>{
  const h=harness(),a=h.login(administrator),j=h.login('Jesse'),b=h.login('Bijan');
  const first=h.call(j,'add',spend());
  const undoId=first.moneyHistory[0].id,id=first.rows[0].id;
  h.call(b,'add',spend({who:'Bijan',what:'Office supplies'}));
  assert.deepEqual(new Set(h.call(a,'list').moneyHistory.map(e=>e.actor)),new Set(['Jesse','Bijan']));
  assert.deepEqual(h.call(b,'list').moneyHistory.map(e=>e.actor),['Bijan']);
  assert.equal(h.call(b,'moneyundo',{undoId}).ok,false);
  const edited=h.call(j,'edit',{id,...spend({amount:31})});
  assert.equal(h.call(a,'moneyundo',{undoId}).ok,false,'stale snapshots must still be refused');
  assert.equal(h.call(a,'moneyundo',{undoId:edited.moneyHistory[0].id}).ok,true);
  const undone=h.call(a,'moneyundo',{undoId});
  assert.equal(undone.ok,true);assert.deepEqual(undone.rows.map(r=>r.who),['Bijan']);
 });

 test(`${administrator} manages other people's attendance, profiles, recurring charges and roster`,()=>{
  const h=harness(),a=h.login(administrator),b=h.login('Bijan');
  const profile={who:'Jesse',headline:'Building',bio:'Updated by an administrator',link:''};
  assert.equal(h.call(b,'profileupdate',profile).ok,false);
  assert.equal(h.call(a,'profileupdate',profile).profiles[0].bio,profile.bio);
  assert.equal(h.call(b,'daymark',{who:'Jesse',day:'2026-09-15'}).ok,false);
  const day=h.call(a,'daymark',{who:'Jesse',day:'2026-09-15'}).days[0];
  assert.equal(h.call(a,'daydelete',{id:day.id}).days.length,0);
  assert.equal(h.call(a,'dayimport',{days:[{who:'Jesse',day:'2026-09-16'}]}).ok,true);
  const subscription=h.call(a,'subadd',spend({date:'2099-10-15',day:15}));
  assert.equal(subscription.ok,true);
  assert.equal(h.call(b,'subdelete',{id:subscription.subs[0].id}).ok,false);
  assert.equal(h.call(a,'subdelete',{id:subscription.subs[0].id}).subs.length,0);
  assert.equal(admin(h,a,'rosteradd',{name:'Nadia'}).ok,true);
  assert.equal(admin(h,a,'rosterrole',{name:'Nadia',role:'lead'}).ok,true);
  assert.equal(admin(h,a,'rosterremove',{name:'Nadia'}).ok,true);
  for(const name of ['Milo','Arya']) {
   assert.equal(admin(h,a,'rosterremove',{name}).ok,false);
   assert.equal(admin(h,a,'rosterrename',{name,to:'Renamed',confirm:'Renamed'}).ok,false);
   assert.ok(h.login(name));
  }
 });

 test(`${administrator} manages campus records and other people's posts and schedules`,()=>{
  const h=harness(),a=h.login(administrator),b=h.login('Bijan');
  const person={name:'Nadia',campus:'Stanford',state:'CA',seat:'pres'};
  assert.equal(h.call(b,'teamadd',person,'campus').ok,false);
  const team=h.call(a,'teamadd',person,'campus');
  assert.equal(team.ok,true);
  assert.equal(h.call(a,'teamupdate',{id:team.team[0].id,...person,status:'paused'},'campus').team[0].status,'paused');
  assert.equal(h.call(a,'teamdelete',{id:team.team[0].id},'campus').team.length,0);
  const post=h.call(a,'add',{who:'Jesse',body:'Week update',week:'2026-09-14'},'posts').posts[0];
  assert.equal(h.call(b,'edit',{id:post.id,body:'No'},'posts').ok,false);
  assert.equal(h.call(a,'edit',{id:post.id,body:'Reviewed update'},'posts').posts[0].body,'Reviewed update');
  assert.equal(h.call(a,'delete',{id:post.id},'posts').posts.length,0);
  const schedule=h.call(a,'add',block,'schedules').schedules[0];
  assert.equal(h.call(b,'edit',{id:schedule.id,...block,label:'No'},'schedules').ok,false);
  assert.equal(h.call(a,'edit',{id:schedule.id,...block,label:'Updated class'},'schedules').schedules[0].label,'Updated class');
  assert.equal(h.call(a,'delete',{id:schedule.id},'schedules').schedules.length,0);
  assert.equal(h.call(a,'import',{who:'Jesse',source:'ics',blocks:[block]},'schedules').schedules.length,1);
  assert.equal(h.call(a,'clear',{who:'Jesse'},'schedules').schedules.length,0);
 });
}

test('purchase approval preserves each legacy approver and attributes a fresh review to its actual administrator',()=>{
 const h=harness(),m=h.login('Milo'),a=h.login('Arya'),j=h.login('Jesse');
 const row=h.call(j,'add',spend()).rows[0],request={id:row.id,reviewed:review(row)};
 const sh=h.sheets.invoice;
 sh.getRange(2,h.ctx.INVOICE_COLS.indexOf('approved_by')+1).setValue('Arya');
 sh.getRange(2,h.ctx.INVOICE_COLS.indexOf('approved_at')+1).setValue('2026-09-14T10:00:00');
 assert.equal(h.call(m,'list').rows[0].approvedBy,'Arya');
 assert.equal(h.call(a,'purchaseapprove',request).rows[0].approvedAt,'2026-09-14T10:00:00');
 h.ctx.invoiceStamp=()=> '2026-09-15T12:00:00';
 const fresh=h.call(m,'purchaseapprove',request).rows[0];
 assert.equal(fresh.approvedBy,'Milo');assert.equal(fresh.approvedAt,'2026-09-15T12:00:00');
 h.ctx.invoiceStamp=()=> '2026-09-16T13:00:00';
 assert.equal(h.call(m,'purchaseapprove',request).rows[0].approvedAt,fresh.approvedAt);
 const rereview=h.call(a,'purchaseapprove',request).rows[0];
 assert.equal(rereview.approvedBy,'Arya');assert.equal(rereview.approvedAt,'2026-09-16T13:00:00');
});

test('administrator status does not turn Milo into the shared card payer',()=>{
 const h=harness(),m=h.login('Milo');
 const rows=h.call(m,'add',spend({who:'Milo'})).rows;
 assert.equal(rows[0].status,'pending');
 const both=h.call(m,'add',spend({who:'Arya'})).rows;
 assert.equal(both.find(r=>r.who==='Arya').status,'reimbursed');
 assert.equal(both.find(r=>r.who==='Milo').status,'pending');
 assert.equal(h.ctx.CARD_PAYER,'Arya');
});

test('beta members named Milo or Arya never receive core administrator authority',()=>{
 const h=harness(),a=h.login('Arya');
 const batch=h.ctx.betaApi({_session:a,action:'batchadd',name:'Role isolation',startDate:'2026-09-25'});
 for(const name of ['Milo','Arya']) {
  const joined=h.ctx.internalSessionApi({action:'betajoin',invite:batch.invite,name,email:name.toLowerCase()+'@example.com',phone:'+1 212 555 0100',github:'beta-'+name.toLowerCase()});
  assert.equal(joined.ok,true);
  for(const identity of [joined,h.ctx.internalSessionApi({action:'session',_session:joined.token}),h.ctx.internalSessionApi({action:'betalogin',code:joined.code})]) {
   assert.equal(identity.beta,true);assert.equal(identity.admin,undefined);assert.equal(identity.operator,undefined);
  }
  assert.equal(h.ctx.internalActor({_session:joined.token,who:name,admin:true}),null);
  for(const namespace of ['invoice','campus','posts','schedules','forms','admin','refer']) {
   const denied=h.ctx.doPost({postData:{contents:JSON.stringify({_api:namespace,_key:'monkey',_session:joined.token,action:'list',who:name,admin:true})}});
   assert.equal(denied.ok,false,namespace);
  }
  assert.equal(h.call(joined.token,'purchaseapprove',{id:'any',reviewed:'any',who:name,admin:true}).ok,false);
  assert.equal(admin(h,joined.token,'rosteradd',{name:'Nadia'}).ok,false);
  assert.equal(h.ctx.betaApi({_session:joined.token,action:'batchadd',name:'Escalated',startDate:'2026-09-25'}).ok,false);
 }
});
