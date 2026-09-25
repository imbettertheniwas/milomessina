import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';
const review=r=>JSON.stringify([r.date,r.who,r.what,r.category,Number(r.amount),r.note||'',r.receipt||'',r.shared||'']);
const spend=(who='Jesse',over={})=>({who,what:'Team lunch',category:'lunch',amount:30,date:'2026-09-15',shared:'Jesse,Bijan,Milo',...over});

test('login validates passcode and roster, tokens expire and logout revokes',()=>{
 const h=harness();
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Arya',passcode:'wrong'}).ok,false);
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Unknown',passcode:'monkey'}).ok,false);
 const token=h.login('Jesse');
 assert.equal(h.ctx.internalActor({_session:token,who:'Arya'}),'Jesse');
 assert.equal(h.ctx.internalSessionApi({action:'session',_session:token}).admin,false);
 h.ctx.internalSessionApi({action:'logout',_session:token});
 assert.equal(h.ctx.internalActor({_session:token}),null);
 assert.equal(h.call(token,'add',spend()).ok,false);
});

test('intern can manage only own unpaid spends; Arya can manage all and settle',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call('', 'add',spend()).ok,false);
 assert.equal(h.call(m,'add',spend('Bijan')).ok,false);
 const r=h.call(m,'add',spend()).rows[0];
 assert.equal(h.call(b,'edit',{id:r.id,...spend('Bijan')}).ok,false);
 assert.equal(h.call(m,'edit',{id:r.id,...spend('Bijan')}).ok,false);
 assert.equal(h.call(b,'delete',{id:r.id}).ok,false);
 assert.equal(h.call(m,'settle',{who:'Jesse'}).ok,false);
 assert.equal(h.call(m,'update',{id:r.id,status:'reimbursed'}).ok,false);
 assert.equal(h.call(m,'edit',{id:r.id,...spend('Jesse',{amount:42})}).rows[0].amount,42);
 assert.equal(h.call(a,'update',{id:r.id,status:'reimbursed'}).rows[0].status,'reimbursed');
 assert.equal(h.call(m,'edit',{id:r.id,...spend()}).ok,false);
 assert.equal(h.call(m,'delete',{id:r.id}).ok,false);
 assert.equal(h.call(a,'edit',{id:r.id,...spend('Bijan')}).ok,true);
 assert.equal(h.call(a,'delete',{id:r.id}).rows.length,0);
});

test('only administrators approve a whole purchase; old share endpoints and spoofed names are rejected',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 const r=h.call(m,'add',spend()).rows[0],payload={id:r.id,reviewed:review(r)};
 for(const token of [m,b]){
   assert.equal(h.call(token,'purchaseapprove',{...payload,who:'Arya',approvedBy:'Arya'}).ok,false);
   assert.equal(h.call(token,'purchaseunapprove',payload).ok,false);
 }
 assert.equal(h.call(a,'approve',payload).ok,false);
 assert.equal(h.call(b,'unapprove',payload).ok,false);
 const approved=h.call(a,'purchaseapprove',payload);
 assert.equal(approved.rows[0].approvedBy,'Arya');
 assert.ok(approved.rows[0].approvedAt);
 assert.equal(approved.rows[0].status,'pending');
 const again=h.call(a,'purchaseapprove',payload);
 assert.equal(again.rows[0].approvedAt,approved.rows[0].approvedAt);
 assert.equal(again.moneyHistory.length,approved.moneyHistory.length);
 const edited=h.call(m,'edit',{id:r.id,...spend('Jesse',{amount:60})});
 assert.equal(edited.rows[0].approvedBy,'');
 assert.equal(edited.rows[0].approvedAt,'');
 // A purchase logged by Arya, or without a split, can also be approved.
 const own=h.call(a,'add',spend('Arya',{shared:''})).rows.find(row=>row.who==='Arya');
 assert.equal(h.call(a,'purchaseapprove',{id:own.id,reviewed:review(own)}).rows.find(row=>row.id===own.id).approvedBy,'Arya');
});

test('attendance and subscriptions enforce owner including imports and legacy actions',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call(m,'daymark',{who:'Bijan',day:'2026-09-15'}).ok,false);
 const d=h.call(m,'daymark',{who:'Jesse',day:'2026-09-15'}).days[0];
 assert.equal(h.call(b,'daydelete',{id:d.id}).ok,false);
 assert.equal(h.call(b,'dayclear',{who:'Jesse',day:d.day}).ok,false);
 assert.equal(h.call(b,'dayimport',{days:[{who:'Jesse',day:d.day}]}).ok,false);
 assert.equal(h.call(b,'shiftimport',{shifts:[{who:'Jesse'}]}).ok,false);
 assert.equal(h.call(b,'clockin',{who:'Jesse'}).ok,false);
 assert.equal(h.call(a,'daydelete',{id:d.id}).ok,true);
 assert.equal(h.call(m,'subadd',spend('Bijan')).ok,false);
 const sub=h.call(m,'subadd',spend('Jesse',{day:15,date:'2026-10-15'})).subs[0];
 assert.ok(sub);
 assert.equal(h.call(b,'subpause',{id:sub.id,active:false}).ok,false);
 assert.equal(h.call(b,'subdelete',{id:sub.id}).ok,false);
 assert.equal(h.call(m,'subpause',{id:sub.id,active:false}).ok,true);
 assert.equal(h.call(a,'subdelete',{id:sub.id}).ok,true);
});

test('post identity cannot be spoofed; only author or an administrator can delete',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 assert.equal(h.call(m,'add',{who:'Bijan',body:'Wrong author'},'posts').ok,false);
 const post=h.call(m,'add',{who:'Jesse',body:'Shipped the update',week:'2026-09-14'},'posts').posts[0];
 assert.equal(h.call(b,'delete',{id:post.id},'posts').ok,false);
 assert.equal(h.call(a,'delete',{id:post.id},'posts').ok,true);
 assert.equal(h.call(m,'teamadd',{},'campus').ok,false);
 assert.equal(h.call('', 'applicant',{},'campus').ok,false);
});


test('profiles start empty, preserve ledger data and are editable only by owner or an administrator',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 const before=h.call(m,'add',spend());
 assert.equal(before.profiles.length,0);
 const data={who:'Jesse',headline:'Building at fomo',bio:'About me',link:'https://example.invalid'};
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

test('Arya can undo purchase approval directly or through immediate undo without changing spend data',()=>{
 const h=harness(),m=h.login('Jesse'),a=h.login('Arya');
 const r=h.call(m,'add',spend()).rows[0],payload={id:r.id,reviewed:review(r)};
 const approved=h.call(a,'purchaseapprove',payload),undoId=approved.moneyHistory[0].id;
 assert.equal(h.call(m,'moneyundo',{undoId}).ok,false);
 const undone=h.call(a,'moneyundo',{undoId});
 assert.equal(undone.rows[0].approvedBy,'');
 assert.equal(undone.rows[0].amount,r.amount);
 assert.equal(undone.rows[0].status,r.status);
 h.call(a,'purchaseapprove',payload);
 assert.equal(h.call(a,'purchaseunapprove',payload).rows[0].approvedBy,'');
});

test('stale or missing review details cannot approve a changed purchase',()=>{
 const h=harness(),m=h.login('Jesse'),a=h.login('Arya');
 const r=h.call(m,'add',spend()).rows[0];
 h.call(m,'edit',{id:r.id,...spend('Jesse',{amount:90})});
 assert.equal(h.call(a,'purchaseapprove',{id:r.id,reviewed:review(r)}).ok,false);
 assert.equal(h.call(a,'purchaseapprove',{id:r.id}).ok,false);
 assert.equal(h.call(a,'list').rows[0].approvedBy,'');
});

test('legacy share approvals remain intact and do not become purchase approvals',()=>{
 const h=harness(),m=h.login('Jesse'),a=h.login('Arya');
 const r=h.call(m,'add',spend()).rows[0];
 const sheet=h.sheets.invoice;
 sheet.getRange(2,h.ctx.INVOICE_COLS.indexOf('approvals')+1).setValue('Arya,Bijan');
 const legacy=h.call(m,'list').rows[0];
 assert.equal(legacy.approvedBy,'');
 assert.equal(h.call(m,'edit',{id:r.id,...spend('Jesse',{approvedBy:'Arya',approved_by:'Arya'})}).rows[0].approvedBy,'');
 const approved=h.call(a,'purchaseapprove',{id:r.id,reviewed:review(r)}).rows[0];
 assert.equal(approved.approvals,'Arya,Bijan');
 assert.equal(approved.approvedBy,'Arya');
});

test('money history reverses add, edit and delete without changing unrelated records',()=>{
 const h=harness(),m=h.login('Jesse'),b=h.login('Bijan'),a=h.login('Arya');
 const added=h.call(m,'add',spend()),id=added.rows[0].id,addUndo=added.moneyHistory[0].id;
 assert.equal(h.call(b,'list').moneyHistory.length,0);
 assert.equal(h.call(b,'moneyundo',{undoId:addUndo}).ok,false);
 const edited=h.call(m,'edit',{id,...spend('Jesse',{amount:55,receipt:'https://example.invalid/receipt.jpg'})});
 const editUndo=edited.moneyHistory[0].id;
 const unrelated=h.call(b,'add',spend('Bijan')).rows.find(r=>r.id!==id);
 assert.equal(h.call(m,'moneyundo',{undoId:addUndo}).ok,false);
 const restored=h.call(m,'moneyundo',{undoId:editUndo});
 assert.equal(restored.rows.find(r=>r.id===id).amount,30);
 assert.equal(restored.rows.find(r=>r.id===unrelated.id).amount,30);
 const deleted=h.call(m,'delete',{id});
 const returned=h.call(a,'moneyundo',{undoId:deleted.moneyHistory[0].id});
 assert.equal(returned.rows.find(r=>r.id===id).id,id);
 assert.equal(h.call(m,'moneyundo',{undoId:addUndo}).rows.some(r=>r.id===id),false);
 assert.equal(h.call(m,'moneyundo',{undoId:addUndo}).ok,true);
});

test('settlement undo restores only the exact settled group, atomically rejects later changes',()=>{
 const h=harness(),m=h.login('Jesse'),a=h.login('Arya');
 const first=h.call(m,'add',spend()).rows[0];
 h.call(a,'update',{id:first.id,status:'reimbursed'});
 const second=h.call(m,'add',spend()).rows.find(r=>r.id!==first.id);
 const third=h.call(m,'add',spend()).rows.find(r=>r.id!==first.id&&r.id!==second.id);
 const settled=h.call(a,'settle',{who:'Jesse'}),undo=settled.moneyHistory[0].id;
 assert.equal(h.call(m,'moneyundo',{undoId:undo}).ok,false);
 const reversed=h.call(a,'moneyundo',{undoId:undo});
 assert.equal(reversed.rows.find(r=>r.id===first.id).status,'reimbursed');
 assert.equal(reversed.rows.find(r=>r.id===second.id).status,'pending');
 assert.equal(reversed.rows.find(r=>r.id===third.id).status,'pending');
 const next=h.call(a,'settle',{who:'Jesse'}).moneyHistory[0].id;
 h.call(a,'edit',{id:second.id,...spend('Jesse',{amount:80})});
 assert.equal(h.call(a,'moneyundo',{undoId:next}).ok,false);
 assert.equal(h.call(a,'list').rows.find(r=>r.id===third.id).status,'reimbursed');
});

test('recurring changes can be undone without losing their existing spends',()=>{
 const h=harness(),m=h.login('Jesse');
 const created=h.call(m,'subadd',spend('Jesse',{date:'2026-10-15',day:15}));
 const sub=created.subs[0];
 const paused=h.call(m,'subpause',{id:sub.id,active:false});
 assert.equal(h.call(m,'moneyundo',{undoId:paused.moneyHistory[0].id}).subs[0].active,'yes');
 const deleted=h.call(m,'subdelete',{id:sub.id});
 assert.equal(h.call(m,'moneyundo',{undoId:deleted.moneyHistory[0].id}).subs[0].id,sub.id);
 assert.equal(h.call(m,'moneyundo',{undoId:created.moneyHistory[0].id}).subs.length,0);
});

test('money change is rolled back when its undo history cannot be saved',()=>{
 const h=harness(),m=h.login('Jesse');
 const original=h.call(m,'add',spend()).rows[0];
 const history=h.sheets.internal_money_history,range=history.getRange;
 history.getRange=function(...args){const result=range.apply(this,args);if(args[0]>1)result.setValues=()=>{throw Error('Storage unavailable');};return result;};
 const changed=h.call(m,'edit',{id:original.id,...spend('Jesse',{amount:900})});
 assert.equal(changed.ok,false);
 assert.deepEqual(h.call(m,'list').rows[0],original);
});
