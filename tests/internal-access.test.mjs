import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';
const spend=(who='Milo',over={})=>({who,what:'Team lunch',category:'lunch',amount:30,date:'2026-09-15',shared:'Milo,Bijan,Jesse',...over});

test('login validates passcode and roster, tokens expire and logout revokes',()=>{
 const h=harness();
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Arya',passcode:'wrong'}).ok,false);
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Unknown',passcode:'monkey'}).ok,false);
 const token=h.login('Milo');
 assert.equal(h.ctx.internalActor({_session:token,who:'Arya'}),'Milo');
 assert.equal(h.ctx.internalSessionApi({action:'session',_session:token}).admin,false);
 h.ctx.internalSessionApi({action:'logout',_session:token});
 assert.equal(h.ctx.internalActor({_session:token}),null);
 assert.equal(h.call(token,'add',spend()).ok,false);
});

test('intern can manage only own unpaid spends; Arya can manage all and settle',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call('', 'add',spend()).ok,false);
 assert.equal(h.call(m,'add',spend('Bijan')).ok,false);
 const r=h.call(m,'add',spend()).rows[0];
 assert.equal(h.call(b,'edit',{id:r.id,...spend('Bijan')}).ok,false);
 assert.equal(h.call(m,'edit',{id:r.id,...spend('Bijan')}).ok,false);
 assert.equal(h.call(b,'delete',{id:r.id}).ok,false);
 assert.equal(h.call(m,'settle',{who:'Milo'}).ok,false);
 assert.equal(h.call(m,'update',{id:r.id,status:'reimbursed'}).ok,false);
 assert.equal(h.call(m,'edit',{id:r.id,...spend('Milo',{amount:42})}).rows[0].amount,42);
 assert.equal(h.call(a,'update',{id:r.id,status:'reimbursed'}).rows[0].status,'reimbursed');
 assert.equal(h.call(m,'edit',{id:r.id,...spend()}).ok,false);
 assert.equal(h.call(m,'delete',{id:r.id}).ok,false);
 assert.equal(h.call(a,'edit',{id:r.id,...spend('Bijan')}).ok,true);
 assert.equal(h.call(a,'delete',{id:r.id}).rows.length,0);
});

test('participant approval is idempotent, actor-bound and reset after edits',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),l=h.login('Luchi');
 const r=h.call(m,'add',spend()).rows[0];
 assert.equal(h.call(m,'approve',{id:r.id}).ok,false);
 assert.equal(h.call(l,'approve',{id:r.id,who:'Bijan'}).ok,false);
 assert.equal(h.call(b,'approve',{id:r.id,who:'Jesse',approvals:'Arya'}).rows[0].approvals,'Bijan');
 const again=h.call(b,'approve',{id:r.id});
 assert.equal(again.rows[0].approvals,'Bijan');
 assert.equal(again.rows[0].status,'pending');
 const edited=h.call(m,'edit',{id:r.id,...spend('Milo',{amount:60})});
 assert.equal(edited.rows[0].approvals,'');
});

test('attendance and subscriptions enforce owner including imports and legacy actions',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call(m,'daymark',{who:'Bijan',day:'2026-09-15'}).ok,false);
 const d=h.call(m,'daymark',{who:'Milo',day:'2026-09-15'}).days[0];
 assert.equal(h.call(b,'daydelete',{id:d.id}).ok,false);
 assert.equal(h.call(b,'dayclear',{who:'Milo',day:d.day}).ok,false);
 assert.equal(h.call(b,'dayimport',{days:[{who:'Milo',day:d.day}]}).ok,false);
 assert.equal(h.call(b,'shiftimport',{shifts:[{who:'Milo'}]}).ok,false);
 assert.equal(h.call(b,'clockin',{who:'Milo'}).ok,false);
 assert.equal(h.call(a,'daydelete',{id:d.id}).ok,true);
 assert.equal(h.call(m,'subadd',spend('Bijan')).ok,false);
 const sub=h.call(m,'subadd',spend('Milo',{day:15,date:'2026-10-15'})).subs[0];
 assert.ok(sub);
 assert.equal(h.call(b,'subpause',{id:sub.id,active:false}).ok,false);
 assert.equal(h.call(b,'subdelete',{id:sub.id}).ok,false);
 assert.equal(h.call(m,'subpause',{id:sub.id,active:false}).ok,true);
 assert.equal(h.call(a,'subdelete',{id:sub.id}).ok,true);
});

test('post identity cannot be spoofed; only author or Arya can delete',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call(m,'add',{who:'Bijan',body:'Wrong author'},'posts').ok,false);
 const post=h.call(m,'add',{who:'Milo',body:'Shipped the update',week:'2026-09-14'},'posts').posts[0];
 assert.equal(h.call(b,'delete',{id:post.id},'posts').ok,false);
 assert.equal(h.call(a,'delete',{id:post.id},'posts').ok,true);
 assert.equal(h.call(m,'teamadd',{},'campus').ok,false);
 assert.equal(h.call('', 'applicant',{},'campus').ok,false);
});


test('profiles start empty, preserve ledger data and are editable only by owner or Arya',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 const before=h.call(m,'add',spend());
 assert.equal(before.profiles.length,0);
 const data={who:'Milo',headline:'Building at fomo',bio:'About me',link:'https://example.invalid'};
 assert.equal(h.call(b,'profileupdate',data).ok,false);
 const saved=h.call(m,'profileupdate',data);
 assert.equal(saved.profiles[0].bio,'About me');
 assert.deepEqual(saved.rows,before.rows);
 assert.equal(h.call(m,'profileupdate',{...data,link:'javascript:alert(1)'}).ok,false);
 assert.equal(h.call(m,'profileupdate',{...data,bio:'x'.repeat(601)}).ok,false);
 assert.equal(h.call(a,'profileupdate',{...data,bio:'Updated'}).profiles[0].bio,'Updated');
 assert.equal(h.call(a,'profileupdate',{...data,who:'Arya'}).profiles.length,2);
});

test('public form route cannot bypass ownership by selecting an internal tab',()=>{
 const h=harness();
 for(const body of [{_page:'/invoice',who:'Arya',amount:999},{_page:'/internal_profiles',who:'Arya'},{_api:'unknown',_page:'/fomo/apply'}]) {
   assert.equal(h.ctx.doPost({postData:{contents:JSON.stringify(body)}}).ok,false);
 }
 assert.deepEqual(Object.keys(h.sheets),[]);
});
