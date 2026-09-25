import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const subscription=(over={})=>({who:'Jesse',what:'Enterprise workspace',category:'software',amount:375,date:'2099-10-25',day:25,note:'Initial account',shared:'Jesse, Bijan',...over});
const setup=()=>{
 const h=harness();h.owner=h.login('Jesse');h.admin=h.login('Arya');h.uploads=[];
 h.ctx.Utilities.base64Decode=data=>Array.from(Buffer.from(data,'base64'));
 h.ctx.saveReceipt=file=>{h.uploads.push({...file});return 'https://drive.google.com/file/d/receipt-'+h.uploads.length+'/view';};
 return h;
};
const add=(h,over={})=>h.call(h.owner,'subadd',subscription(over));
const file=(name='account.pdf',content='%PDF-1.7\nAccount')=>({name,type:'application/pdf',data:Buffer.from(content).toString('base64')});
const get=(h,id)=>h.call(h.admin,'list').subs.find(s=>s.id===id);

test('an ordinary edit preserves billing state, logger and every already-accrued ledger line',()=>{
 const h=setup(),first=add(h),rule=first.subs[0];
 const historical=h.call(h.owner,'add',subscription({date:'2026-09-25',receipt:'https://example.com/september.pdf'})).rows[0];
 const sheet=h.sheets.subs;
 sheet.getRange(2,h.ctx.SUB_COLS.indexOf('last')+1).setValue('2026-09-25');
 h.call(h.owner,'subpause',{id:rule.id,active:false});
 const before=h.ctx.subRead(sheet)[0],ledger=JSON.stringify(h.sheets.invoice.rows);
 const changed=h.call(h.owner,'subsave',{id:rule.id,who:'Arya',what:'Expanded enterprise workspace',amount:525,category:'software',note:'Added a teammate',shared:'Jesse,Bijan,Milo',created:'fake',last:'fake',active:true,logged_by:'Milo',date:'2020-01-01'});
 assert.equal(changed.ok,true);const saved=get(h,rule.id);
 assert.equal(saved.amount,525);assert.equal(saved.who,'Arya');assert.equal(saved.note,'Added a teammate');assert.equal(saved.shared,'Jesse, Bijan, Milo');assert.equal(saved.loggedBy,'Jesse');
 for(const key of ['id','created','day','next','last','active','logged_by'])assert.equal(h.ctx.subRead(sheet)[0][key],before[key],key);
 assert.equal(JSON.stringify(h.sheets.invoice.rows),ledger);assert.equal(changed.rows.find(r=>r.id===historical.id).amount,375);
});

test('both administrators edit another owner’s recurrence while other interns and beta identities cannot',()=>{
 const h=setup(),rule=add(h).subs[0];
 assert.equal(h.call(h.login('Bijan'),'subsave',{id:rule.id,amount:99,who:'Arya',admin:true}).ok,false);
 assert.equal(h.call(h.owner,'subsave',{id:rule.id,who:'Bijan'}).ok,false);
 for(const who of ['Milo','Arya'])assert.equal(h.call(h.login(who),'subsave',{id:rule.id,amount:400,who:'Bijan'}).ok,true);
 assert.equal(get(h,rule.id).loggedBy,'Jesse');
 h.ctx.betaApi({_session:h.admin,action:'list'});
 const beta=h.ctx.internalSessionApi({action:'betajoin',invite:'beta',name:'Arya',email:'beta@example.com',phone:'+1 212 555 0100',github:'beta-builder'});
 assert.equal(h.call(beta.token,'subsave',{id:rule.id,amount:1}).ok,false);
 assert.equal(h.call('','subsave',{id:rule.id,amount:1}).ok,false);assert.equal(get(h,rule.id).amount,400);
});

test('explicit billing edits affect only future scheduling and refuse past backfills',()=>{
 const h=setup(),rule=add(h).subs[0];
 h.sheets.subs.getRange(2,h.ctx.SUB_COLS.indexOf('last')+1).setValue('2026-09-25');
 const changed=h.call(h.owner,'subsave',{id:rule.id,day:31,next:'2099-11-30'});
 assert.equal(changed.ok,true);assert.equal(changed.subs[0].day,31);assert.equal(changed.subs[0].next,'2099-11-30');assert.equal(changed.subs[0].last,'2026-09-25');
 for(const patch of [{day:0},{day:32},{day:2.5},{next:'2020-01-01'},{next:'2099-02-31'},{next:h.ctx.betaToday()}])assert.equal(h.call(h.owner,'subsave',{id:rule.id,...patch}).ok,false,JSON.stringify(patch));
 assert.equal(get(h,rule.id).next,'2099-11-30');assert.equal(h.sheets.invoice.getLastRow(),1);
});

test('overdue edits do not advance dates and require a ledger refresh to accrue charges at the previous price',()=>{
 const h=setup(),rule=add(h).subs[0],format=h.ctx.Utilities.formatDate;
 h.ctx.Utilities.formatDate=(d,zone,pattern)=>pattern==='yyyy-MM-dd'?'2099-10-25':format(d,zone,pattern);
 const before=JSON.stringify(h.sheets.subs.rows);
 const denied=h.call(h.owner,'subsave',{id:rule.id,amount:525,note:'New seats'});
 assert.equal(denied.ok,false);assert.match(denied.error,/Reload the ledger/);
 assert.equal(JSON.stringify(h.sheets.subs.rows),before);assert.equal(h.sheets.invoice.getLastRow(),1);
 const refreshed=h.call(h.owner,'list');assert.equal(refreshed.rows[0].amount,375);
 const edited=h.call(h.owner,'subsave',{id:rule.id,amount:525,note:'New seats'});
 assert.equal(edited.ok,true);assert.equal(edited.rows.length,1);assert.equal(edited.rows[0].amount,375);assert.equal(edited.rows[0].note,'Initial account');
 assert.equal(edited.subs[0].next,'2099-11-25');assert.equal(edited.subs[0].last,'2099-10-25');
 h.ctx.Utilities.formatDate=(d,zone,pattern)=>pattern==='yyyy-MM-dd'?'2099-11-25':format(d,zone,pattern);
 const rolled=h.call(h.owner,'list');
 assert.equal(rolled.rows.length,2);assert.equal(rolled.rows.find(r=>r.date==='2099-11-25').amount,525);
 assert.equal(rolled.rows.find(r=>r.date==='2099-10-25').amount,375);
});

test('recurring receipts append files and links, detach by stable ID and preserve original proof',()=>{
 const h=setup(),created=add(h,{receipt:'https://example.com/account-one.pdf',receiptFiles:[file()]}),rule=created.subs[0];
 assert.equal(created.ok,true);assert.equal(rule.receipts.length,2);assert.equal(rule.receipt,rule.receipts[0].url);assert.equal(h.uploads.length,1);
 assert.equal(new Set(rule.receipts.map(r=>r.id)).size,2);assert.ok(rule.receipts.every(r=>r.addedAt));
 const added=h.call(h.owner,'subsave',{id:rule.id,receiptLinks:[{name:'Added Nadia',url:'https://example.com/new-seat.pdf'}],receiptFiles:[file('extra-seat.pdf','%PDF-1.7\nExtra seat')]});
 assert.equal(added.ok,true);assert.equal(added.subs[0].receipts.length,4);assert.deepEqual(added.subs[0].receipts.slice(0,2),rule.receipts);
 const detached=h.call(h.owner,'subsave',{id:rule.id,receiptRemove:[rule.receipts[0].id]});
 assert.equal(detached.ok,true);assert.equal(detached.subs[0].receipts.length,3);assert.equal(detached.subs[0].receipts.some(r=>r.id===rule.receipts[0].id),false);
 assert.equal(h.uploads.length,2,'detaching never deletes stored files');
 assert.equal(h.call(h.owner,'subsave',{id:rule.id,receiptFiles:[file('extra-seat.pdf','%PDF-1.7\nExtra seat')]}).subs[0].receipts.length,3);assert.equal(h.uploads.length,2,'identical saved uploads are reused');
 assert.equal(h.call(h.owner,'subsave',{id:rule.id,receiptLinks:[{url:'https://example.com/new-seat.pdf'}]}).subs[0].receipts.length,3);
 assert.equal(JSON.stringify(get(h,rule.id)).includes('uploadHash'),false);assert.equal(h.ctx.doGet().recurringReceipts,true);
});

test('invalid receipt collections and content are refused before upload or rule mutation',()=>{
 const h=setup(),rule=add(h).subs[0],before=JSON.stringify(h.sheets.subs.rows);
 const invalid=[{receiptRemove:['other-rule-receipt']},{receiptLinks:[{url:'javascript:alert(1)'}]},{receiptLinks:[{url:'data:text/html,x'}]},{receiptLinks:[{url:'https://user:pass@example.com/file'}]},{receiptLinks:[{url:'https://example.com/<script>'}]},{receiptLinks:[{url:'https://example.com/'+ 'a'.repeat(500)}]},{receiptFiles:[file('bad.pdf','<html>not a PDF')]},{receiptFiles:[{...file(),type:'image/svg+xml'}]},{receiptFiles:[{...file(),data:'bad!'}]},{receiptFiles:Array.from({length:9},()=>file())},{receiptLinks:Array.from({length:21},(_,n)=>({url:'https://example.com/'+n}))}];
 for(const patch of invalid)assert.equal(h.call(h.owner,'subsave',{id:rule.id,...patch}).ok,false,JSON.stringify(patch).slice(0,100));
 assert.equal(h.uploads.length,0);assert.equal(JSON.stringify(h.sheets.subs.rows),before);
 const png={name:'seat.png',type:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')};
 assert.equal(h.call(h.owner,'subsave',{id:rule.id,receiptFile:png}).subs[0].receipts.length,1);
});

test('the receipt cap counts retained plus appended receipts and permits replacing selected proof',()=>{
 const h=setup(),rule=add(h,{receiptLinks:Array.from({length:20},(_,n)=>({name:'Seat '+n,url:'https://example.com/seat-'+n}))}).subs[0];
 assert.equal(rule.receipts.length,20);
 assert.equal(h.call(h.owner,'subsave',{id:rule.id,receiptFiles:[file()]}).ok,false);assert.equal(h.uploads.length,0);
 const replacement=h.call(h.owner,'subsave',{id:rule.id,receiptRemove:[rule.receipts[0].id],receiptFiles:[file()]});
 assert.equal(replacement.ok,true);assert.equal(replacement.subs[0].receipts.length,20);assert.equal(h.uploads.length,1);
});

test('subscription edits including receipt changes support undo and stale-record protection',()=>{
 const h=setup(),rule=add(h,{receiptLinks:[{url:'https://example.com/old.pdf'}]}).subs[0];
 const edited=h.call(h.owner,'subsave',{id:rule.id,amount:500,receiptLinks:[{url:'https://example.com/new.pdf'}]});
 const undo=edited.moneyHistory[0];assert.equal(undo.action,'subsave');
 assert.equal(h.call(h.login('Bijan'),'moneyundo',{undoId:undo.id}).ok,false);
 const restored=h.call(h.login('Milo'),'moneyundo',{undoId:undo.id});
 assert.equal(restored.ok,true);assert.equal(restored.subs[0].amount,375);assert.deepEqual(restored.subs[0].receipts,rule.receipts);
 const again=h.call(h.owner,'subsave',{id:rule.id,amount:525}),previous=again.moneyHistory[0].id;
 h.call(h.owner,'subsave',{id:rule.id,note:'Later edit'});
 assert.equal(h.call(h.admin,'moneyundo',{undoId:previous}).ok,false);
});

test('the receipt column appends without rewriting old rows and old undo records remain valid',()=>{
 const h=setup(),created=add(h),rule=created.subs[0],sheet=h.sheets.subs;
 const paused=h.call(h.owner,'subpause',{id:rule.id,active:false}),undoId=paused.moneyHistory[0].id,index=h.ctx.SUB_COLS.indexOf('receipts');
 sheet.rows.forEach((row,n)=>{sheet.rows[n]=row.slice(0,index);});const before=sheet.rows.map(r=>[...r]);
 const history=h.sheets.internal_money_history;
 for(const row of history.rows.slice(1))for(const column of ['before','after']) {
  const at=h.ctx.MONEY_COLS.indexOf(column),value=JSON.parse(row[at]);
  if(value&&value.table==='subs'){value.values=value.values.slice(0,index);row[at]=JSON.stringify(value);}
 }
 assert.equal(h.call(h.admin,'list').subs[0].receipts.length,0);assert.deepEqual(sheet.rows[0].slice(0,index),before[0]);assert.deepEqual(sheet.rows.slice(1),before.slice(1));
 assert.equal(sheet.rows[0][index],'receipts');assert.equal(h.call(h.owner,'moneyundo',{undoId}).subs[0].active,'yes');
 const single=h.ctx.subPublic({...h.ctx.subRead(sheet)[0],receipt:'https://example.com/old-receipt.pdf'});
 assert.equal(single.receipts[0].id,'legacy-'+h.ctx.internalDigest(single.receipt).slice(0,16));
});
