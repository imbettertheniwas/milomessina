import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
function lift(name){
  let at=html.indexOf('function '+name+'(');assert.ok(at>=0,name);
  if(html.slice(at-6,at)==='async ')at-=6;
  let depth=0;
  for(let i=html.indexOf('{',at);i<html.length;i++){
    if(html[i]==='{')depth++;else if(html[i]==='}' && --depth===0)return html.slice(at,i+1);
  }
  throw Error('Missing function end: '+name);
}
const receipt=(id,url='https://example.invalid/'+id+'.pdf')=>({id,name:'Receipt '+id,url,addedAt:'2026-09-01'});
const rule=over=>({id:'rule-a',who:'Arya',loggedBy:'Milo',what:'Enterprise account',category:'software',amount:50,
  day:31,next:'2026-10-31',last:'2026-09-30',active:'yes',note:'Two seats',shared:'Milo, Jesse',receipts:[receipt('old'),receipt('keep')],...over});
function page(over={}){
  const nodes=new Map(),events=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,children:[],max:'',min:'',
      classList:{toggle(){},add(){},remove(){}},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},
      addEventListener(name,fn){events.set(id+':'+name,fn);},focus(){},click(){}});
    return nodes.get(id);
  };
  const originalSpend={id:'historical',who:'Arya',date:'2026-09-30',amount:50,shared:'Milo, Jesse',receipt:'https://example.invalid/old-charge.pdf',status:'reimbursed'};
  const c=vm.createContext({
    document:{getElementById:node},$:node,URL,Date,Number,Array,Promise,
    identity:{who:'Milo',admin:true,beta:false,operator:true},OPERATORS:['Arya','Milo'],CARD:'Arya',sheetAdmin:true,
    mode:'sheet',sheetCard:true,sheetSubs:true,rows:[originalSpend],subs:[rule()],days:[],
    picked:'Arya',PAYERS:['Arya','Milo','Jesse','Bijan'],SHARERS:['Arya','Milo','Jesse','Bijan'],
    whoBox:node('who'),guestBox:node('f-guests'),otherOn:false,sharedWith:{Milo:true,Jesse:true},
    repeat:false,editing:null,editingSub:null,monthlySource:null,keptShot:'',dropShot:false,pendingShot:null,busy:false,
    subReceiptSaved:[],subReceiptFiles:[],subReceiptLinks:[],subReceiptRemove:[],subReceiptReading:false,subReceiptEpoch:0,
    byId:(list,id)=>list.find(row=>row.id===id),today:()=> '2026-09-25',tomorrow:()=> '2026-09-26',
    cat:id=>({id,label:id,v:'--s1'}),sharedOf:r=>r.shared.split(',').map(v=>v.trim()),money:value=>'$'+value,niceDate:value=>value,
    isGuest:name=>name.endsWith(' (guest)'),guestName:name=>name.replace(/ \(guest\)$/,''),
    renderSplit(){},resetSplit(){},refreshDate(){},showPicked(){},applyModeUi(){},openDrawer(){c.opened=true;},closeDrawer(){c.closed=true;},paint(){},
    hint:(message,bad)=>{node('f-hint').textContent=message;node('f-hint').bad=bad;},toast:message=>{c.toastMessage=message;},
    fail:error=>error.message,saveSubs:()=>true,newId:(()=>{let id=0;return ()=> 'new-'+(++id);})(),
    ...over
  });
  c.splitNames=()=>Object.keys(c.sharedWith).filter(name=>c.sharedWith[name]);
  for(const name of ['esc','safeUrl','isAdmin','onCard','settledStatus','loggerOf','own','canPay','cardLendable','ownRow','canEdit','permission','requirePermission',
    'subOn','subsMode','ord','subReceiptUrl','subReceiptsOf','subReceiptLinksHtml','clearSubReceiptDraft','subReceiptCount','renderSubReceipts','subReceiptPayload','storedSubReceiptPayload',
    'readSubReceipt','addSubReceiptFiles','addSubReceiptLink','removeSubReceipt','applyLocalSubReceipts','subLocal','syncRepeat','renderSubs','openSubEdit','subEditPayload','validSubNext','saveSubEdit','exitEdit'])vm.runInContext(lift(name),c);
  return {c,node,events,originalSpend};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('recurring rows expose Edit and all saved receipts; the editor restores amount, people, notes and cadence',()=>{
  const {c,node}=page();c.renderSubs();
  assert.match(node('subs-body').innerHTML,/data-sub="edit"/);assert.match(node('subs-body').innerHTML,/2 receipts/);
  assert.match(node('subs-body').innerHTML,/keep.pdf/);
  c.openSubEdit('rule-a');
  assert.equal(c.editingSub,'rule-a');assert.equal(c.opened,true);assert.equal(node('drawer-t').textContent,'Edit recurring spend');
  assert.equal(node('f-amt').value,'50.00');assert.equal(node('f-note').value,'Two seats');
  assert.deepEqual(plain(c.splitNames()),['Milo','Jesse']);
  assert.equal(node('f-date-field').hidden,true);assert.equal(node('f-sub-schedule-change').checked,false);
  assert.match(node('f-sub-cadence').textContent,/31st.*2026-10-31/);assert.equal(c.subReceiptSaved.length,2);
});

test('ordinary changes omit all billing state and combine new receipts with explicit removals',()=>{
  const {c,node}=page();c.openSubEdit('rule-a');c.sharedWith.Bijan=true;
  node('f-note').value='Added Bijan';c.subReceiptFiles=[{name:'seat-change.pdf',type:'application/pdf',data:'JVBERg=='}];
  node('f-sub-link').value='https://example.invalid/new-invoice';c.addSubReceiptLink();c.removeSubReceipt('saved:old');
  const payload=plain(c.subEditPayload('Enterprise account',75));
  assert.equal(payload.id,'rule-a');assert.equal(payload.amount,75);assert.equal(payload.shared,'Milo, Jesse, Bijan');
  assert.deepEqual(payload.receiptRemove,['old']);assert.equal(payload.receiptFiles[0].name,'seat-change.pdf');assert.equal(payload.receiptLinks.length,1);
  for(const field of ['day','next','last','active','loggedBy','date'])assert.equal(field in payload,false,field+' is preserved');
  assert.equal(c.subs[0].receipts.length,2,'removal stays a draft until save');
});

test('billing changes require explicit selection and valid future dates',()=>{
  const {c,node}=page();c.openSubEdit('rule-a');node('f-sub-schedule-change').checked=true;
  node('f-sub-day').value='15';node('f-sub-next').value='2026-10-15';
  const payload=c.subEditPayload('Enterprise',50);assert.equal(payload.day,15);assert.equal(payload.next,'2026-10-15');
  node('f-sub-next').value='2026-09-25';assert.throws(()=>c.subEditPayload('Enterprise',50),/after today/);
  node('f-sub-next').value='2027-02-31';assert.throws(()=>c.subEditPayload('Enterprise',50),/after today/);
  node('f-sub-next').value='2026-10-15';node('f-sub-day').value='32';assert.throws(()=>c.subEditPayload('Enterprise',50),/1 to 31/);
});

test('local edits append and remove receipts while historical charges and billing state stay unchanged',async()=>{
  const {c,originalSpend}=page();const history=JSON.stringify(originalSpend),billing=plain(c.subs[0]);
  await c.subLocal('subsave',{id:'rule-a',amount:75,shared:'Milo, Jesse, Bijan',note:'Three seats',receiptRemove:['old'],
    receiptLinks:[{name:'Seat addition',url:'https://example.invalid/new'}],receiptFiles:[{name:'invoice.pdf',type:'application/pdf',data:'JVBERg=='}]});
  assert.equal(c.subs[0].amount,75);assert.equal(c.subs[0].shared,'Milo, Jesse, Bijan');
  assert.equal(c.subs[0].receipts.length,3);assert.equal(c.subs[0].receipts[0].id,'keep');
  for(const key of ['day','next','last','loggedBy','active'])assert.equal(c.subs[0][key],billing[key]);
  assert.equal(JSON.stringify(c.rows[0]),history);
});

test('storage failure or an overdue charge leaves the original recurring rule unchanged',async()=>{
  const failing=page({saveSubs:()=>false});const before=plain(failing.c.subs);
  await assert.rejects(failing.c.subLocal('subsave',{id:'rule-a',amount:90,receiptRemove:['old']}),/out of room/);
  assert.deepEqual(plain(failing.c.subs),before);
  const overdue=page({subs:[rule({next:'2026-09-25'})]});
  await assert.rejects(overdue.c.subLocal('subsave',{id:'rule-a',amount:90}),/Reload the ledger/);
  assert.equal(overdue.c.subs[0].amount,50);
});

test('only the rule logger or a verified administrator can edit it',()=>{
  for(const identity of [{who:'Jesse',admin:false},{who:'Milo',admin:false,beta:true}]){
    const {c}=page({identity,subs:[rule({loggedBy:'Bijan'})]});
    assert.notEqual(c.permission('subsave',{id:'rule-a',who:'Arya'}),'');c.openSubEdit('rule-a');assert.equal(c.editingSub,null);
  }
  const {c}=page({identity:{who:'Jesse',admin:false},subs:[rule({loggedBy:'Jesse'})]});
  assert.equal(c.permission('subsave',{id:'rule-a',who:'Arya'}),'');assert.notEqual(c.permission('subsave',{id:'rule-a',who:'Bijan'}),'');
});

test('rejected saves keep edited fields, receipt drafts and the visible error',async()=>{
  const {c,node}=page();c.openSubEdit('rule-a');node('f-note').value='New seats';
  c.subReceiptFiles=[{name:'new.pdf',type:'application/pdf',data:'JVBERg=='}];c.subApi=async()=>{throw Error('Reload the ledger first');};
  await c.saveSubEdit('Enterprise',100);
  assert.equal(c.editingSub,'rule-a');assert.equal(node('f-note').value,'New seats');assert.equal(c.subReceiptFiles.length,1);
  assert.match(node('f-hint').textContent,/Reload the ledger first/);assert.equal(node('f-submit').disabled,false);
});

test('canceling a recurring edit discards attachment changes without touching its saved record',()=>{
  const {c,node}=page();c.openSubEdit('rule-a');c.removeSubReceipt('saved:old');c.subReceiptLinks.push({name:'Pending',url:'https://example.invalid/pending'});
  c.exitEdit();assert.equal(c.editingSub,null);assert.equal(c.subReceiptSaved.length,0);assert.equal(c.subReceiptLinks.length,0);
  assert.equal(c.subs[0].receipts.length,2);assert.equal(node('f-date-field').hidden,false);assert.equal(node('f-sub-receipts').hidden,true);
});

test('an attachment still being prepared cannot appear in a different edit after cancellation',async()=>{
  const {c,node}=page();c.openSubEdit('rule-a');let resolve;c.readSubReceipt=()=>new Promise(done=>resolve=done);
  const loading=c.addSubReceiptFiles([{name:'late.pdf'}]);assert.equal(node('f-submit').disabled,true);
  c.exitEdit();assert.equal(node('f-submit').disabled,false);
  resolve({name:'late.pdf',type:'application/pdf',data:'JVBERg=='});await loading;
  assert.equal(c.subReceiptFiles.length,0);assert.equal(c.subReceiptReading,false);
});

test('unsafe receipt links are rejected, duplicates stay single, and local migration keeps receipt attachments',()=>{
  const {c,node}=page();c.openSubEdit('rule-a');
  for(const url of ['javascript:alert(1)','https://','https://user:secret@example.invalid/']){node('f-sub-link').value=url;c.addSubReceiptLink();assert.equal(c.subReceiptLinks.length,0);}
  node('f-sub-link').value='https://example.invalid/new';c.addSubReceiptLink();node('f-sub-link').value='https://example.invalid/new';c.addSubReceiptLink();assert.equal(c.subReceiptLinks.length,1);
  const migrated=plain(c.storedSubReceiptPayload(rule({receipts:[receipt('link'),receipt('pdf','data:application/pdf;base64,JVBERg==')]})));
  assert.equal(migrated.receiptFiles[0].type,'application/pdf');assert.equal(migrated.receiptLinks[0].url,'https://example.invalid/link.pdf');
});
