import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
function lift(name){
  const at=html.indexOf('function '+name+'(');
  assert.ok(at>=0,'Missing function '+name);
  let depth=0;
  for(let i=html.indexOf('{',at);i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}' && --depth===0)return html.slice(at,i+1);
  }
  throw Error('Unterminated function '+name);
}
const plain=value=>JSON.parse(JSON.stringify(value));
const spend=over=>({id:'spend-a',who:'Arya',loggedBy:'Jesse',what:'Team software',category:'software',amount:50,
  date:'2026-08-31',status:'reimbursed',note:'Two seats',shared:'Jesse, Bijan',
  receipt:'https://example.invalid/august.pdf',...over});
function page(over={}){
  const nodes=new Map(),controls=[];
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,children:[],max:'',min:'',
      classList:{toggle(){},add(){},remove(){}},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},
      addEventListener(){},querySelector(){return null;},focus(){},click(){}});
    return nodes.get(id);
  };
  const c=vm.createContext({
    document:{getElementById:node,querySelectorAll:selector=>selector==='[data-act]'?controls:[]},$:node,URL,Date,Number,Array,Promise,
    identity:{who:'Milo',admin:true,beta:false,operator:true},OPERATORS:['Arya','Milo'],CARD:'Arya',sheetAdmin:true,
    mode:'sheet',sheetCard:true,sheetSubs:true,rows:[spend()],subs:[],days:[],
    picked:'Arya',PAYERS:['Arya','Milo','Jesse','Bijan'],SHARERS:['Arya','Milo','Jesse','Bijan'],
    whoBox:node('who'),guestBox:node('f-guests'),otherOn:false,sharedWith:{},
    repeat:false,editing:null,editingSub:null,monthlySource:null,keptShot:'',dropShot:false,pendingShot:null,busy:false,
    subReceiptSaved:[],subReceiptFiles:[],subReceiptLinks:[],subReceiptRemove:[],subReceiptReading:false,subReceiptEpoch:0,
    byId:(list,id)=>list.find(row=>row.id===id),today:()=> '2026-09-25',tomorrow:()=> '2026-09-26',
    cat:id=>({id,label:id,v:'--s1'}),sharedOf:r=>r.shared.split(',').map(v=>v.trim()),money:value=>'$'+value,niceDate:value=>value,
    isGuest:name=>name.endsWith(' (guest)'),guestName:name=>name.replace(/ \(guest\)$/,''),
    renderSplit(){},resetSplit(){},refreshDate(){},showPicked(){},applyModeUi(){},
    openDrawer(){c.opened=true;},closeDrawer(){c.closed=true;c.exitEdit();},paint(){},runSubs:async()=>{},
    hint:(message,bad)=>{node('f-hint').textContent=message;node('f-hint').bad=bad;},toast:message=>{c.toastMessage=message;},
    fail:error=>error.message,newId:()=> 'new-id',chargeOf:'spend-a',chargePaintKey:'',paintChargeGit(){},
    reviewedCharge:r=>JSON.stringify(r),payerOk:()=>true,
    ...over
  });
  c.splitNames=()=>Object.keys(c.sharedWith).filter(name=>c.sharedWith[name]);
  for(const name of ['esc','safeUrl','isAdmin','onCard','settledStatus','loggerOf','own','canPay','cardLendable','ownRow','canEdit',
    'purchaseApprover','purchaseApproved','purchaseApprovalText','canApprove','permission','requirePermission',
    'subDay','subStep','ord','subReceiptUrl','subReceiptsOf','clearSubReceiptDraft','subReceiptCount','renderSubReceipts',
    'subReceiptPayload','storedSubReceiptPayload','validSubNext','setRepeat','syncRepeat','openEdit','exitEdit',
    'nextMonthlyCharge','openMonthly','startSub','paintCharge','applyPermissionUi'])vm.runInContext(lift(name),c);
  return {c,node,controls};
}

test('monthly scheduling selects the next future anniversary without historical backfill',()=>{
  const cases=[
    ['2026-09-25','2026-09-25',{day:25,next:'2026-10-25'}],
    ['2026-09-25','2020-01-01',{day:1,next:'2026-10-01'}],
    ['2026-09-25','2020-01-31',{day:31,next:'2026-09-30'}],
    ['2026-09-30','2026-08-31',{day:31,next:'2026-10-31'}],
    ['2028-02-15','2028-01-31',{day:31,next:'2028-02-29'}],
    ['2028-02-29','2028-01-31',{day:31,next:'2028-03-31'}],
    ['2027-02-15','2027-01-31',{day:31,next:'2027-02-28'}],
    ['2026-12-31','2026-10-31',{day:31,next:'2027-01-31'}]
  ];
  for(const [now,date,expected] of cases){
    const {c}=page({today:()=>now});
    assert.deepEqual(plain(c.nextMonthlyCharge(date)),expected,now+' / '+date);
  }
});

test('Make monthly prefills the future rule and its receipt without changing the original spend',()=>{
  const {c,node}=page();const before=plain(c.rows);
  c.openMonthly('spend-a');
  assert.equal(c.opened,true);assert.equal(c.monthlySource,'spend-a');assert.equal(c.editing,null);assert.equal(c.repeat,true);
  assert.equal(node('f-what').value,'Team software');assert.equal(node('f-amt').value,'50.00');
  assert.equal(node('f-note').value,'Two seats');assert.equal(node('f-date').value,'2026-09-30');
  assert.equal(Number(node('f-monthly-day').value),31);assert.equal(node('f-monthly-day').disabled,false);
  assert.deepEqual(plain(c.splitNames()),['Jesse','Bijan']);
  assert.equal(c.subReceiptLinks.length,1);assert.equal(c.subReceiptLinks[0].url,before[0].receipt);
  assert.deepEqual(plain(c.rows),before);
});

test('Make monthly carries local inline proof as an attachment without modifying it',()=>{
  const receipt='data:application/pdf;base64,JVBERg==';const {c}=page({mode:'device',rows:[spend({receipt})]});
  c.openMonthly('spend-a');
  assert.equal(c.subReceiptFiles.length,1);assert.equal(c.subReceiptFiles[0].type,'application/pdf');
  assert.equal(c.subReceiptFiles[0].data,'JVBERg==');assert.equal(c.rows[0].receipt,receipt);
});

test('another owner and a reimbursed personal spend cannot start monthly setup',()=>{
  for(const row of [spend({loggedBy:'Bijan'}),spend({who:'Jesse',loggedBy:'Jesse',status:'reimbursed'})]){
    const {c,node}=page({identity:{who:'Jesse',admin:false},rows:[row]});const before=plain(c.rows);
    node('f-what').value='Untouched draft';c.openMonthly(row.id);
    assert.equal(c.monthlySource,null);assert.equal(c.editing,null);assert.equal(c.repeat,false);assert.equal(c.opened,undefined);
    assert.equal(node('f-what').value,'Untouched draft');assert.deepEqual(plain(c.rows),before);
  }
});

test('monthly conversion refuses past, today, invalid dates and invalid billing days before any API call',async()=>{
  const cases=[['2026-08-31',31],['2026-09-25',31],['2027-02-31',31],['2026-09-30',0],['2026-09-30',32],['2026-09-30',1.5]];
  for(const [date,day] of cases){
    const {c,node}=page();c.openMonthly('spend-a');let calls=0;c.subApi=async()=>{calls++;};
    node('f-date').value=date;node('f-monthly-day').value=String(day);
    await c.startSub('Team software',50,date);
    assert.equal(calls,0,date+' / '+day);assert.equal(c.monthlySource,'spend-a');assert.equal(c.closed,undefined);
    assert.equal(node('f-hint').bad,true);
  }
});

test('monthly setup sends one future rule and leaves the source charge and receipt untouched',async()=>{
  const {c,node}=page();const before=plain(c.rows),calls=[];c.openMonthly('spend-a');
  c.subApi=async(action,payload)=>{calls.push({action,payload:plain(payload)});return {ok:true,createdSubId:'rule-new'};};
  node('f-amt').value='75';node('f-date').value='2026-10-31';
  await c.startSub('Expanded team software',75,'2026-10-31');
  assert.equal(calls.length,1);assert.equal(calls[0].action,'subadd');
  assert.equal(calls[0].payload.date,'2026-10-31');assert.equal(calls[0].payload.day,31);
  assert.equal(calls[0].payload.amount,75);assert.equal(calls[0].payload.what,'Expanded team software');
  assert.equal(calls[0].payload.receiptLinks[0].url,before[0].receipt);
  assert.deepEqual(plain(c.rows),before);assert.equal(c.monthlySource,null);assert.equal(c.closed,true);
});

test('canceling monthly setup clears its source and attachment drafts before the next spend',()=>{
  const {c,node}=page();const before=plain(c.rows);c.openMonthly('spend-a');node('f-monthly-day').value='32';c.exitEdit();
  assert.equal(c.monthlySource,null);assert.equal(c.repeat,false);assert.equal(c.editing,null);
  assert.equal(node('f-monthly-day').disabled,true,'an invalid hidden billing day must not block the next spend form');
  assert.equal(c.subReceiptLinks.length,0);assert.equal(c.subReceiptFiles.length,0);
  assert.equal(node('f-what').value,'');assert.equal(node('drawer-t').textContent,'Log a spend');assert.deepEqual(plain(c.rows),before);
});

test('a rejected monthly save retains the source, future schedule and receipt draft for correction',async()=>{
  const {c,node}=page();const before=plain(c.rows);c.openMonthly('spend-a');
  const links=plain(c.subReceiptLinks);node('f-note').value='Three seats';
  c.subApi=async()=>{throw Error('The sheet could not save this rule');};
  await c.startSub('Team software',75,'2026-09-30');
  assert.equal(c.monthlySource,'spend-a');assert.equal(c.repeat,true);assert.equal(c.closed,undefined);
  assert.equal(node('f-date').value,'2026-09-30');assert.equal(Number(node('f-monthly-day').value),31);
  assert.equal(node('f-note').value,'Three seats');assert.deepEqual(plain(c.subReceiptLinks),links);
  assert.equal(node('f-submit').disabled,false);assert.equal(c.busy,false);
  assert.match(node('f-hint').textContent,/could not save/);assert.equal(node('f-hint').bad,true);
  assert.deepEqual(plain(c.rows),before);
});

test('a deleted source or a permission change while the drawer is open cannot create a monthly rule',async()=>{
  for(const change of [c=>{c.rows=[];},c=>{c.identity={who:'Bijan',admin:false};}]){
    const {c}=page();c.openMonthly('spend-a');change(c);let calls=0;c.subApi=async()=>{calls++;};
    await c.startSub('Team software',50,'2026-09-30');
    assert.equal(calls,0);assert.equal(c.closed,undefined);assert.equal(c.monthlySource,'spend-a');
  }
});

test('purchase review exposes Edit spend and Make monthly to permitted owners and administrators',()=>{
  for(const identity of [{who:'Milo',admin:true},{who:'Jesse',admin:false}]){
    const {c,node}=page({identity});c.paintCharge();const rendered=node('charge-detail').innerHTML;
    assert.match(rendered,/>Edit spend</);assert.match(rendered,/>Make monthly</);
    assert.match(rendered,/data-act="edit"/);assert.match(rendered,/data-act="monthly"/);
  }
});

test('Edit spend and Make monthly share the original spend permissions',()=>{
  for(const [identity,row,allowed] of [
    [{who:'Milo',admin:true},spend({who:'Bijan',status:'reimbursed'}),true],
    [{who:'Jesse',admin:false},spend(),true],
    [{who:'Jesse',admin:false},spend({who:'Jesse',status:'pending'}),true],
    [{who:'Bijan',admin:false},spend(),false],
    [{who:'Jesse',admin:false},spend({who:'Jesse',status:'reimbursed'}),false]
  ]){
    const {c,controls}=page({identity,rows:[row]});
    controls.push(...['edit','monthly'].map(act=>({dataset:{act,id:row.id},hidden:false})));
    c.applyPermissionUi();assert.deepEqual(controls.map(button=>!button.hidden),[allowed,allowed]);
  }
});
