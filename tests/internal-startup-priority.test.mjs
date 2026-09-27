import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../invoice/'+file,import.meta.url),'utf8');
const html=read('index.html');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function lift(name){
  const start=html.indexOf('function '+name+'(');assert(start>=0,name);
  let depth=0;
  for(let i=html.indexOf('{',start);i<html.length;i++){
    if(html[i]==='{')depth++;
    if(html[i]==='}' && --depth===0)return html.slice(start,i+1);
  }
  throw Error('Missing function end: '+name);
}
function fixture({route='overview',seen=false,backend='auto'}={}){
  const nodes=new Map(),events=new Map(),calls=[],timers=[],polls=[];
  const on=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  const node=id=>({id,hidden:false,value:'',innerHTML:'',textContent:'',style:{},dataset:{},children:[],open:false,
    classList:{toggle(){}},querySelectorAll:()=>[],querySelector:()=>null,append(){},replaceChildren(){this.innerHTML='';},
    setAttribute(){},addEventListener(type,fn){on(id+':'+type,fn);},focus(){},scrollIntoView(){}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
  const document={hidden:false,body:{dataset:{consoleView:route==='beta'?'overview':route}},getElementById:get,
    createElement:node,querySelectorAll:()=>[],addEventListener:(type,fn)=>on('document:'+type,fn)};
  const window={addEventListener:on,dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);}};
  const snapshot={at:Date.now(),payers:['Milo','Arya'],rows:[],days:[],profiles:[],subs:[]};
  const c=vm.createContext({document,window,URL,AbortSignal,AbortController,Blob,JSON,Date,
    location:{origin:'https://example.invalid',hash:'#/'+(route==='beta'?'overview':route),replace(url){c.redirect=url;}},
    Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type){this.type=type;}},
    identity:null,view:route==='beta'?'overview':route,initialBetaRoute:route==='beta',personOf:null,
    initialLedgerDeferred:false,deferredLedgerSnapshot:null,sheetReadAt:0,busy:false,mode:'device',poll:null,
    BACKEND:backend,ENDPOINT:'/sheet',PASSCODE:'test',PEOPLE:['Milo'],whoBox:{children:[]},bfWho:{},LS_DAYS:'days',
    rows:[],days:[],subs:[],profiles:[],listAhead:null,carried:null,sheetPayers:[],sheetCard:false,sheetGuests:false,sheetDays:false,
    sessionStorage:{setItem(){}},$:get,
    isAdmin:()=>c.identity?.admin===true,isOperator:()=>c.identity?.operator===true,
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
    setInterval(fn,ms){polls.push({fn,ms});return polls.length;},
    applyRoster(){},buildNav(){},resetSplit(){},applyModeUi(){},setLive(_on,message){c.live=message;},render(){},loadLocal(){},refreshCard(){},
    lsGet:()=>[],carriedFromShifts:()=>[],seenSnapshot:()=>seen?snapshot:null,seenStamp:()=>'',
    probeSheet:async()=> 'shared',offerCarry(){c.offers++;},runSubs(){c.recurring++;},offers:0,recurring:0,
    fail(error){c.failure=error;},unSheet(){c.mode='device';},
    loadGh(){},buildGhLink(){},renderGh(){},refreshGh(){},tickClock(){},refreshDate(){},
    buildBetaScheduleOverview:()=>null,betaScheduleOverviewHTML:()=>'',buildBetaGroupOverview:()=>null,betaGroupOverviewHTML:()=>'',betaGroupGithubInitial:()=>[],loadBetaGroupGithub:async()=>[],
    fetch:async(_url,options)=>{calls.push(JSON.parse(options.body)._api);return {ok:true,text:async()=>'{}'};},
    api:async()=>{
      if(c.listAhead){await c.listAhead;c.listAhead=null;}else calls.push('invoice');
      c.sheetReadAt=Date.now();
    }
  });
  window.FOMO_SHEET={session:()=>c.identity?.token||'',operator:c.isOperator,admin:c.isAdmin,
    read:async api=>{calls.push(api);return api==='visits'?{requests:[]}:{ok:true,manager:true,configured:true,members:[],batches:[],attendance:[],recaps:[],schedules:[]};}};
  c.setView=id=>{c.view=id;document.body.dataset.consoleView=id;c.location.hash='#/'+id;window.dispatchEvent(new c.Event('fomo:view-change'));c.refreshVisibleLedger();};
  for(const name of ['ledgerView','readInitialLedger','goSheet','ledgerReady','refreshVisibleLedger','open_','signedIn'])vm.runInContext(lift(name),c);
  vm.runInContext(html.slice(html.indexOf('document.getElementById("t-refresh").addEventListener'),html.indexOf('document.getElementById("t-csv").addEventListener')),c);
  if(route==='visits' || route==='beta')vm.runInContext('(function(){'+read(route==='visits'?'visits.js':'beta-manager.js').replace(/^import [^\n]+\n/gm,'')+'\n})()',c);
  return {c,calls,timers,polls,emit(name){for(const fn of events.get(name)||[])fn.call(get(name.split(':')[0]));},
    signIn(overrides={}){c.signedIn({who:'Milo',token:'current-session',admin:true,operator:true,...overrides});}};
}

test('direct Beta and Visits loads request their own table before any ledger work',async()=>{
  for(const route of ['beta','visits'])for(const seen of [false,true])for(const backend of ['auto','sheet']){
    const h=fixture({route,seen,backend});h.signIn();await settle();
    assert.deepEqual(h.calls,[route],route+' '+backend+' '+(seen?'saved snapshot':'new browser'));
    assert.equal(h.c.mode,'sheet');assert.equal(h.c.initialLedgerDeferred,true);
    assert.equal(h.c.live,'shared','the header must not imply a deferred ledger is still syncing');
    assert.equal(h.c.view,route);assert.equal(h.c.identity.token,'current-session');
    for(const timer of h.timers)if(timer.ms===8000)timer.fn();
    await settle();
    assert.equal(h.c.window.FOMO_SHEET.ledgerReady,undefined,'the timeout cannot start speculative sheet work');
    h.emit('document:visibilitychange');
    for(const poll of h.polls)if(poll.ms===30000)poll.fn();
    await settle();assert.equal(h.c.recurring,0,'a return to the private tab cannot start ledger work indirectly');
    assert.deepEqual(h.calls,[route]);
  }
});

test('later ledger entry performs the deferred initial load once and completes its normal setup',async()=>{
  for(const route of ['beta','visits']){
    const h=fixture({route,seen:true});h.signIn();await settle();
    h.c.setView('overview');await settle();
    assert.deepEqual(h.calls,[route,'invoice']);
    assert.equal(h.c.initialLedgerDeferred,false);
    assert.equal(h.c.window.FOMO_SHEET.ledgerReady,true);
    assert.equal(h.c.offers,1);assert.equal(h.c.recurring,1);
    h.c.setView('ledger');await settle();assert.deepEqual(h.calls,[route,'invoice']);
    h.c.setView(route);await settle();assert.deepEqual(h.calls,[route,'invoice'],'private tab reuses its loaded view');
  }
});

test('ordinary overview boot retains its initial ledger load with and without a saved snapshot',async()=>{
  for(const seen of [false,true]){
    const h=fixture({seen});h.signIn();await settle();
    assert.deepEqual(h.calls,['invoice']);assert.equal(h.c.initialLedgerDeferred,false);
    assert.equal(h.c.window.FOMO_SHEET.ledgerReady,true);assert.equal(h.c.offers,1);assert.equal(h.c.recurring,1);
  }
});

test('a failed deferred ledger load retries its initial completion hooks on the next entry',async()=>{
  const h=fixture({route:'visits',seen:true});h.signIn();await settle();
  const original=h.c.api;h.c.api=async()=>{h.calls.push('invoice-failed');throw Error('Temporary outage');};
  h.c.setView('overview');await settle();
  assert.equal(h.c.initialLedgerDeferred,true);assert.match(h.c.failure.message,/Temporary outage/);
  assert.equal(h.c.offers,0);assert.equal(h.c.recurring,0);
  h.c.api=original;h.c.setView('ledger');await settle();
  assert.deepEqual(h.calls,['visits','invoice-failed','invoice']);
  assert.equal(h.c.initialLedgerDeferred,false);assert.equal(h.c.window.FOMO_SHEET.ledgerReady,true);
  assert.equal(h.c.offers,1);assert.equal(h.c.recurring,1);
});

test('manual Refresh completes initial setup immediately after a deferred read failure',async()=>{
  const h=fixture({route:'visits'});h.signIn();await settle();
  const original=h.c.api;h.c.api=async()=>{throw Error('Temporary outage');};
  h.c.setView('ledger');await settle();
  assert.equal(h.c.initialLedgerDeferred,true);
  h.c.api=original;h.emit('t-refresh:click');await settle();
  assert.deepEqual(h.calls,['visits','invoice']);
  assert.equal(h.c.initialLedgerDeferred,false);
  assert.equal(h.c.window.FOMO_SHEET.ledgerReady,true);
  assert.equal(h.c.offers,1);assert.equal(h.c.recurring,1);
  assert.equal(h.c.document.getElementById('t-refresh').disabled,false);
});

test('a stale saved deployment keeps the existing local fallback after a deferred ledger read',async()=>{
  const h=fixture({route:'beta',seen:true});h.signIn();await settle();
  h.c.api=async()=>{h.calls.push('invoice');throw Object.assign(Error('Old deployment'),{stale:true});};
  h.c.setView('ledger');await settle();
  assert.deepEqual(h.calls,['beta','invoice']);assert.equal(h.c.mode,'device');
  assert.equal(h.c.initialLedgerDeferred,false);assert.equal(h.c.failure,undefined);
});

test('Beta route priority never overrides a denied core role or beta member redirect',async()=>{
  const intern=fixture({route:'beta'});intern.signIn({who:'Jesse',admin:false,operator:false});await settle();
  assert.equal(intern.c.view,'overview');assert.deepEqual(intern.calls,['invoice']);
  const beta=fixture({route:'beta'});beta.signIn({beta:true});await settle();
  assert.equal(beta.c.redirect,'/internal/beta');assert.equal(beta.c.identity,null);assert.deepEqual(beta.calls,[]);
});
