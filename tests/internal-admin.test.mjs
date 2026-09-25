import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const spend=(who='Milo',over={})=>({who,what:'Team lunch',category:'lunch',amount:30,date:'2026-09-15',shared:'Milo,Bijan',...over});
const admin=(h,token,action,p={})=>h.ctx.internalAdminApi({_key:'monkey',_session:token,action,...p});
const names=r=>r.roster.map(p=>p.name);
const rowOf=(h,token,table,who,id)=>admin(h,token,'rows',{table,who}).rows.find(r=>r.id===id);

test('the console is Arya and Milo only, and says so rather than going quiet',()=>{
 const h=harness();
 assert.equal(admin(h,'','list').ok,false);
 assert.equal(admin(h,h.login('Bijan'),'list').ok,false);
 assert.equal(admin(h,h.login('Jesse'),'rosteradd',{name:'Nadia'}).ok,false);
 for(const who of ['Arya','Milo']) assert.equal(admin(h,h.login(who),'list').ok,true);
 assert.equal(admin(h,h.login('Milo'),'sudo').ok,false);
});

test('the roster seeds itself as the names that were constants, and says which is which',()=>{
 const h=harness(),m=h.login('Milo');
 const seeded=admin(h,m,'list');
 assert.deepEqual(names(seeded),['Milo','Bijan','Jesse','Luchi','Arya']);
 assert.deepEqual(seeded.roster.filter(p=>p.role==='lead').map(p=>p.name),['Arya']);
 assert.deepEqual(seeded.roster.filter(p=>p.admin).map(p=>p.name),['Milo','Arya']);
 assert.equal(seeded.roster.find(p=>p.name==='Arya').card,true);
 // The login roster and the ledger's own list are the same list.
 assert.equal(h.ctx.doGet().payers.join(),'Milo,Bijan,Jesse,Luchi,Arya');
});

test('an intern added in the console can sign in and log a spend; one who has not cannot',()=>{
 const h=harness(),m=h.login('Milo');
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Nadia',passcode:'monkey'}).ok,false);
 assert.equal(admin(h,m,'rosteradd',{name:'Nadia','role':'intern'}).ok,true);
 const n=h.login('Nadia');
 assert.equal(h.ctx.internalActor({_session:n}),'Nadia');
 assert.equal(h.call(n,'add',spend('Nadia')).rows[0].who,'Nadia');
 assert.equal(h.call(n,'daymark',{who:'Nadia',day:'2026-09-15'}).days[0].who,'Nadia');
 // and she is on the ledger's roster from then on, not only on the console's
 assert.equal(h.ctx.doGet().payers.indexOf('Nadia')>-1,true);
});

test('a roster name has to be a name, and nobody is added twice',()=>{
 const h=harness(),m=h.login('Milo');
 for(const name of ['','   ','Nadia, Bijan','Nadia7','<script>','=cmd()'])
   assert.equal(admin(h,m,'rosteradd',{name}).ok,false);
 assert.equal(admin(h,m,'rosteradd',{name:'Nadia',role:'boss'}).ok,false);
 assert.equal(admin(h,m,'rosteradd',{name:"Ana-Maria O'Neill"}).ok,true);
 assert.equal(admin(h,m,'rosteradd',{name:'Milo'}).ok,false);
 assert.equal(names(admin(h,m,'list')).filter(n=>n==='Ana-Maria O\'Neill').length,1);
});

test('removing somebody stops them signing in and leaves every row they wrote exactly where it was',()=>{
 const h=harness(),m=h.login('Milo'),j=h.login('Jesse');
 const row=h.call(j,'add',spend('Jesse',{shared:'Jesse,Milo'})).rows[0];
 h.call(j,'daymark',{who:'Jesse',day:'2026-09-15'});
 h.call(j,'add',{who:'Jesse',body:'Shipped it',week:'2026-09-14'},'posts');
 const a=h.login('Arya');
 h.call(a,'update',{id:row.id,status:'reimbursed'});

 assert.equal(admin(h,m,'rosterremove',{name:'Jesse'}).ok,true);
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Jesse',passcode:'monkey'}).ok,false);
 assert.equal(h.ctx.internalActor({_session:j}),null);
 assert.equal(h.ctx.doGet().payers.indexOf('Jesse'),-1);

 const after=h.call(m,'list');
 assert.equal(after.rows.find(r=>r.id===row.id).who,'Jesse');
 assert.equal(after.rows.find(r=>r.id===row.id).shared,'Jesse, Milo');
 assert.equal(after.days.filter(d=>d.who==='Jesse').length,1);
 assert.equal(h.call(m,'list',{},'posts').posts.filter(p=>p.who==='Jesse').length,1);
 // and the audit does not then report every one of those rows as a stranger's
 assert.deepEqual(admin(h,m,'list').audit,[]);
});

test('a person still owed money is not quietly taken off the roster',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan');
 h.call(b,'add',spend('Bijan',{amount:42}));
 const refused=admin(h,m,'rosterremove',{name:'Bijan'});
 assert.equal(refused.ok,false);
 assert.match(refused.error,/42\.00/);
 assert.equal(names(admin(h,m,'list')).indexOf('Bijan')>-1,true);
 assert.equal(admin(h,m,'rosterremove',{name:'Bijan',evenThoughOwed:true}).ok,true);
});

test('the two who hold the console, and the card everything is logged against, cannot be removed',()=>{
 const h=harness(),m=h.login('Milo');
 for(const name of ['Milo','Arya']) assert.equal(admin(h,m,'rosterremove',{name}).ok,false);
 assert.equal(names(admin(h,m,'list')).join(),'Milo,Bijan,Jesse,Luchi,Arya');
});

test('somebody who comes back is the row that was already there, not a second one',()=>{
 const h=harness(),m=h.login('Milo');
 admin(h,m,'rosterremove',{name:'Luchi'});
 const back=admin(h,m,'rosteradd',{name:'Luchi'});
 assert.equal(back.ok,true);
 assert.equal(back.roster.filter(p=>p.name==='Luchi').length,1);
 assert.equal(back.roster.find(p=>p.name==='Luchi').removed,'');
 assert.equal(h.login('Luchi').length>0,true);
});

test('a lead is off the attendance board but still on the ledger',()=>{
 const h=harness(),m=h.login('Milo'),l=h.login('Luchi');
 h.call(l,'daymark',{who:'Luchi',day:'2026-09-15'});
 assert.equal(admin(h,m,'rosterrole',{name:'Luchi',role:'lead'}).ok,true);
 assert.equal(h.call(l,'daymark',{who:'Luchi',day:'2026-09-16'}).ok,false);
 assert.equal(h.call(l,'add',spend('Luchi')).ok,true);
 assert.equal(h.call(m,'list').days.filter(d=>d.who==='Luchi').length,1);
 assert.equal(admin(h,m,'rosterrole',{name:'Luchi',role:'intern'}).ok,true);
 assert.equal(h.call(l,'daymark',{who:'Luchi',day:'2026-09-16'}).ok,true);
});

test('a rename follows the name through every tab that was keyed on it',()=>{
 const h=harness(),m=h.login('Milo'),j=h.login('Jesse');
 const row=h.call(j,'add',spend('Arya',{shared:'Jesse,Milo'})).rows[0]; // logged by Jesse, on Arya's card
 const own=h.call(j,'add',spend('Jesse')).rows.find(r=>r.id!==row.id);
 h.call(j,'daymark',{who:'Jesse',day:'2026-09-15'});
 h.call(j,'subadd',spend('Jesse',{date:'2026-10-15',day:15}));
 h.call(j,'add',{who:'Jesse',body:'Talked to @Milo',week:'2026-09-14'},'posts');
 h.call(j,'profileupdate',{who:'Jesse',headline:'Building',bio:'About me',link:''});

 assert.equal(admin(h,m,'rosterrename',{name:'Jesse',to:'Jess'}).ok,false); // no confirmation
 assert.equal(admin(h,m,'rosterrename',{name:'Jesse',to:'Milo',confirm:'Milo'}).ok,false); // taken
 assert.equal(admin(h,m,'rosterrename',{name:'Jesse',to:'Jess',confirm:'Jess'}).ok,true);

 const after=h.call(m,'list');
 assert.equal(after.rows.find(r=>r.id===own.id).who,'Jess');
 assert.equal(after.rows.find(r=>r.id===row.id).loggedBy,'Jess');
 assert.equal(after.rows.find(r=>r.id===row.id).shared,'Jess, Milo');
 assert.equal(after.days[0].who,'Jess');
 assert.equal(after.subs[0].who,'Jess');
 assert.equal(after.profiles[0].who,'Jess');
 assert.equal(h.call(m,'list',{},'posts').posts[0].who,'Jess');
 assert.deepEqual(names(admin(h,m,'list')),['Milo','Bijan','Jess','Luchi','Arya']);
 // the renamed person owns their rows under the new name and not the old one
 assert.equal(h.login('Jess').length>0,true);
 assert.equal(h.call(h.login('Jess'),'edit',{id:own.id,...spend('Jess',{amount:31})}).rows.find(r=>r.id===own.id).amount,31);
});

test('a force delete reaches a row its owner cannot, but not one that changed while it was on screen',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 const row=h.call(b,'add',spend('Bijan')).rows[0];
 h.call(a,'update',{id:row.id,status:'reimbursed'});
 assert.equal(h.call(b,'delete',{id:row.id}).ok,false); // locked to its owner, as it should be

 const seen=rowOf(h,m,'invoice','Bijan',row.id);
 assert.equal(seen.line.includes('Team lunch'),true);
 assert.equal(admin(h,m,'forcedelete',{table:'invoice',id:row.id,reviewed:'stale'}).ok,false);
 assert.equal(admin(h,m,'forcedelete',{table:'ledger',id:row.id,reviewed:seen.key}).ok,false);
 const gone=admin(h,m,'forcedelete',{table:'invoice',id:row.id,reviewed:seen.key});
 assert.equal(gone.ok,true);
 assert.equal(h.call(m,'list').rows.length,0);

 // money is money: the ledger's own history can put it back
 const undo=h.call(m,'list').moneyHistory.find(e=>e.action==='delete');
 assert.equal(h.call(m,'moneyundo',{undoId:undo.id}).rows[0].id,row.id);
});

test('a force delete reaches attendance, posts and schedules too, and logs every one',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan');
 const day=h.call(b,'daymark',{who:'Bijan',day:'2026-09-15'}).days[0];
 const post=h.call(b,'add',{who:'Bijan',body:'A note',week:'2026-09-14'},'posts').posts[0];
 for(const [table,id] of [['days',day.id],['posts',post.id]]){
   const seen=rowOf(h,m,table,'Bijan',id);
   assert.equal(admin(h,m,'forcedelete',{table,id,reviewed:seen.key}).ok,true);
 }
 assert.equal(h.call(m,'list').days.length,0);
 assert.equal(h.call(m,'list',{},'posts').posts.length,0);
 const log=admin(h,m,'list').log;
 assert.equal(log.filter(e=>e.action==='forcedelete').length,2);
 assert.equal(log.every(e=>e.who==='Milo'),true);
});

test('the audit names the rows nobody on the roster owns, and the console can reach them',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan');
 const row=h.call(b,'add',spend('Bijan')).rows[0];
 assert.deepEqual(admin(h,m,'list').audit,[]);
 // a name hand-typed into the sheet, which is how these actually appear
 h.sheets.invoice.getRange(2,h.ctx.INVOICE_COLS.indexOf('who')+1).setValue('Someone Else');
 const found=admin(h,m,'list').audit;
 assert.equal(found.length,1);
 assert.equal(found[0].kind,'stranger');
 assert.equal(found[0].table,'invoice');
 assert.equal(admin(h,m,'forcedelete',{table:'invoice',id:row.id,reviewed:found[0].key}).ok,true);
 assert.deepEqual(admin(h,m,'list').audit,[]);
});

test('counts say what a name is holding before anybody decides to remove it',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan');
 h.call(b,'add',spend('Bijan',{amount:25}));
 h.call(b,'daymark',{who:'Bijan',day:'2026-09-15'});
 const counts=admin(h,m,'list').counts.Bijan;
 assert.equal(counts.rows,1);
 assert.equal(counts.days,1);
 assert.equal(counts.owed,25);
});

test('ordinary interns cannot use administrator actions or another person records',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),j=h.login('Jesse');
 const row=h.call(j,'add',spend('Jesse')).rows[0];
 assert.equal(h.call(b,'purchaseapprove',{id:row.id,reviewed:'x'}).ok,false);
 assert.equal(h.call(b,'settle',{who:'Jesse'}).ok,false);
 assert.equal(h.call(b,'edit',{id:row.id,...spend('Jesse',{amount:1})}).ok,false);
 assert.equal(h.call(b,'list').rows[0].amount,30);
 assert.equal(h.ctx.internalAdminApi({_key:'monkey',action:'rosteradd',name:'Nadia'}).ok,false);
 assert.equal(h.ctx.internalAdminApi({_key:'wrong',_session:m,action:'list'}).ok,false);
});
