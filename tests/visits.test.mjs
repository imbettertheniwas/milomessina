import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createVisitHandler,createSheetStore,verifyInternalIdentity} from '../server/visits/handler.mjs';
import {memoryStore} from '../server/visits-preview.mjs';

const env={VISITS_PUBLIC_ORIGIN:'https://crm.example',VISITS_STORAGE_URL:'https://script.google.com/macros/s/test/exec',
  VISITS_SERVICE_SECRET:'test-service-secret-'.repeat(3)};
const now=Date.parse('2026-09-16T20:00:00Z');
test('internal identity checks the console deployment and never posts to a legacy receiver',async()=>{
  const calls=[];
  const legacy=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true})};};
  assert.equal(await verifyInternalIdentity(env,'',legacy),false);
  assert.equal(calls.length,0);
  assert.equal(await verifyInternalIdentity(env,'session-token',legacy),false);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.method,undefined);
  assert.ok(readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8').includes(calls[0].url));
  assert.notEqual(calls[0].url,env.VISITS_STORAGE_URL);
  for(const [who,admin,expected] of [['Arya',true,{who:'Arya',admin:true}],['Milo',false,{who:'Milo',admin:false}],['Arya',false,{who:'Arya',admin:false}],['Milo',true,{who:'Milo',admin:false}],['Unknown',true,false]]) {
    const fetchIdentity=async(url,options)=>({ok:true,json:async()=>options.method==='POST'?{ok:true,who,admin}:{identity:true}});
    assert.deepEqual(await verifyInternalIdentity(env,'session-token',fetchIdentity),expected);
  }
  for(const who of ['Milo','Arya','Beta intern']) {
    const fetchBeta=async(url,options)=>({ok:true,json:async()=>options.method==='POST'?{ok:true,who,admin:true,beta:true,memberId:'beta-member'}:{identity:true}});
    assert.equal(await verifyInternalIdentity(env,'beta-session-token',fetchBeta),false);
  }
});
const guest={requestId:'00000000-0000-4000-8000-000000000001',name:'Guest',email:'guest@example.invalid',social:'@guest',notes:'A collaboration',website:'',date:'2026-09-17',time:'2:15 PM'};
function harness(overrides={}) {
  const {store,records}=memoryStore();
  const handler=createVisitHandler({env,store,now:()=>now,verifyIdentity:async token=>token==='admin-test'?{who:'Arya',admin:true}:token==='intern-test'?{who:'Milo',admin:false}:false,...overrides});
  async function call(action='submit',body=guest,{method='POST',origin=env.VISITS_PUBLIC_ORIGIN,cookie,headers={}}={}) {
    const result={status:200,headers:{}};
    const req={url:'/api/visits?action='+action,method,body,headers:{origin,'content-type':'application/json',cookie,...headers},socket:{remoteAddress:'127.0.0.1'}};
    const res={setHeader(k,v){result.headers[k]=v;},status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
    await handler(req,res);return result;
  }
  return {call,records};
}
test('missing deployment configuration fails closed without storage access',async()=>{
  let touched=false;
  const h=harness({env:{},store:async()=>{touched=true;}});
  assert.equal((await h.call()).status,503);assert.equal(touched,false);
});
test('public request stores exact New York time, returns receipt and deduplicates retries',async()=>{
  const h=harness(),first=await h.call();
  assert.equal(first.status,201);assert.deepEqual(first.body,{reference:guest.requestId,status:'pending'});
  assert.equal((await h.call()).status,200);assert.equal(h.records.size,1);
  const saved=h.records.get(guest.requestId);
  assert.equal(saved.preferred_time,'2:15 PM');assert.equal(saved.time_zone,'America/New_York');
  assert.equal((await h.call('submit',{...guest,email:'other@example.invalid'})).status,409);
});
test('reject invalid times, past dates, honeypots, malformed JSON, cross-origin and oversized data',async()=>{
  const h=harness();
  for(const patch of [{time:'2:75 PM'},{date:'2026-09-16'},{website:'bot'},{name:' '},{email:'bad'}])
    assert.equal((await h.call('submit',{...guest,...patch})).status,400);
  assert.equal((await h.call('submit','{broken')).status,400);
  assert.equal((await h.call('submit',guest,{origin:'https://evil.example'})).status,403);
  assert.equal((await h.call('submit',guest,{origin:null})).status,403);
  assert.equal((await h.call('submit',guest,{headers:{'content-length':'12001'}})).status,413);
  assert.equal(h.records.size,0);
});
test('internal login replaces the extra password and expired sessions cannot read guests',async()=>{
  const h=harness();
  const admin={headers:{'x-fomo-internal-session':'admin-test'}};
  const intern={headers:{'x-fomo-internal-session':'intern-test'}};
  assert.equal((await h.call('list',null,{method:'GET'})).status,401);
  assert.equal((await h.call('update',{})).status,401);
  assert.equal((await h.call('login',{password:'obsolete-password'})).status,404);
  assert.equal((await h.call('list',null,{method:'GET',cookie:'__Host-fomo-visits=old-cookie'})).status,401);
  assert.equal((await h.call('list',null,{method:'GET',headers:{'x-fomo-internal-session':'expired'}})).status,401);
  await h.call();
  const list=await h.call('list',null,{method:'GET',...intern});
  assert.equal(list.status,200);assert.equal(list.body.requests.length,1);
  assert.equal(list.headers['Cache-Control'],'no-store');
  assert.equal((await h.call('session',null,{method:'GET',...intern})).status,200);
  const edit={id:guest.requestId,status:'confirmed',internalNotes:'Team note',version:1};
  assert.equal((await h.call('update',edit,intern)).status,403);
  assert.equal(h.records.get(guest.requestId).version,1);
  assert.equal((await h.call('update',edit,admin)).body.request.version,2);
  assert.equal((await h.call('update',edit,admin)).status,409);
  assert.equal((await h.call('update',{...edit,version:2,status:'deleted'},admin)).status,400);
});
test('unauthenticated reads and writes never reach guest storage',async()=>{
  let touched=false;
  const h=harness({store:async()=>{touched=true;}});
  for(const [action,method] of [['list','GET'],['session','GET'],['update','POST'],['saveAvailability','POST']])
    assert.equal((await h.call(action,{}, {method})).status,401);
  assert.equal(touched,false);
});
test('beta sessions cannot read or manage visits, even when their display name matches Arya',async()=>{
  const calls=[];
  const h=harness({verifyIdentity:async()=>({who:'Arya',admin:true,beta:true,memberId:'beta-member'}),store:async(action)=>{
    calls.push(action);
    if(action==='settings')return {availability:null};
    if(action==='submit')return {reference:guest.requestId,status:'pending'};
    throw new Error('Protected guest storage must not be reached');
  }});
  const headers={'x-fomo-internal-session':'beta-session-token'};
  for(const [action,method] of [['list','GET'],['session','GET'],['update','POST'],['saveAvailability','POST']])
    assert.equal((await h.call(action,{}, {method,headers})).status,401);
  assert.deepEqual(calls,[]);
  assert.equal((await h.call('availability',null,{method:'GET',headers})).status,200);
  assert.equal((await h.call('submit',guest,{headers})).status,201);
  assert.deepEqual(calls,['settings','submit']);
});
test('public submissions keep their address rate limit',async()=>{
  const calls=[];
  const h=harness({store:async(action,payload)=>{
    calls.push({action,payload});
    return {reference:guest.requestId,status:'pending'};
  }});
  assert.equal((await h.call()).status,201);
  assert.match(calls[0].payload.addressKey,/^[a-f0-9]{64}$/);
});
test('storage errors or malformed receipts never report success',async()=>{
  const h=harness({store:async()=>{throw new Error('secret provider detail');}});
  const response=await h.call();assert.equal(response.status,503);
  assert.equal(JSON.stringify(response.body).includes('secret provider detail'),false);
  assert.equal((await harness({store:async()=>({reference:'wrong',status:'pending'})}).call()).status,503);
});
test('storage credentials stay in the server request, not the public receipt',async()=>{
  let request;
  const store=createSheetStore(env,async(url,options)=>{request={url,options};return {ok:true,json:async()=>({ok:true,data:{reference:guest.requestId,status:'pending'}})};});
  const result=await store('submit',{request:guest});
  assert.equal(JSON.parse(request.options.body).secret,env.VISITS_SERVICE_SECRET);
  // The shared receiver routes on _api, exactly as the ledger does.
  assert.equal(JSON.parse(request.options.body)._api,'visits');
  assert.equal(result.reference,guest.requestId);
});
test('existing console inline scripts still parse; route and iframe-free form remain present',()=>{
  const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert.match(html,/data-view="visits"/);assert.match(html,/href="#\/visits"/);
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.ok(config.rewrites.some(r=>r.source==='/internal'&&r.destination==='/invoice/index.html'));
  const form=readFileSync(new URL('../hqvisitform/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(form,/<iframe/);assert.match(form,/portal-config.js/);
});

import {normalizeAvailability,defaultAvailability,canonicalTime} from '../server/visits/validation.mjs';

test('availability accepts the spellings a person types and stores one of them',()=>{
  const [sunday]=normalizeAvailability([{open:true,times:['14:15','2:15pm','9:05 AM','10:00 AM','nonsense','']},
    ...Array.from({length:6},()=>({open:false,times:[]}))]);
  // 14:15 and 2:15pm are the same slot typed twice, and junk is dropped.
  assert.deepEqual(sunday.times,['9:05 AM','10:00 AM','2:15 PM']);
  assert.equal(canonicalTime('12:30'),'12:30 PM');
  assert.equal(canonicalTime('00:30'),'12:30 AM');
  assert.equal(canonicalTime('25:00'),'');
  assert.equal(canonicalTime('13:00 PM'),'');
});
test('malformed availability falls back to the open-everything default',()=>{
  for(const bad of [null,undefined,'x',[],[{open:true,times:[]}]])
    assert.deepEqual(normalizeAvailability(bad),defaultAvailability());
  assert.equal(defaultAvailability().length,7);
  assert.equal(defaultAvailability().every(d=>d.open),true);
});
test('opening hours are public, but only a session may change them',async()=>{
  const stored=Array.from({length:7},(_,i)=>({open:i===3,times:i===3?['11:00 AM']:[]}));
  const h=harness({store:async(action,payload)=>{
    if(action==='settings')return {availability:stored};
    if(action==='saveSettings')return {availability:payload.availability};
    return {allowed:true};
  }});
  // No cookie: a guest's form has to be able to read this before logging in.
  const open=await h.call('availability',null,{method:'GET',cookie:undefined});
  assert.equal(open.status,200);
  assert.equal(open.body.availability[3].open,true);
  assert.equal(open.body.availability[0].open,false);
  assert.equal((await h.call('saveAvailability',{availability:stored})).status,401);
  const headers={'x-fomo-internal-session':'admin-test'};
  assert.equal((await h.call('saveAvailability',{availability:stored},{headers})).status,200);
  // A malformed payload must not normalize into "every day open".
  assert.equal((await h.call('saveAvailability',{availability:'x'},{headers})).status,400);
  assert.equal((await h.call('saveAvailability',{availability:[]},{headers})).status,400);
});
test('a closed day is refused with a message naming the day, not a generic outage',async()=>{
  const h=harness({store:async action=>{
    if(action==='submit'){const e=new Error('closed');e.code='CLOSED';throw e;}
    return {allowed:true};
  }});
  const response=await h.call();
  assert.equal(response.status,400);
  assert.match(response.body.error,/not open for visits/);
});

test('only Arya can change visiting hours with the existing internal session',async()=>{
  const h=harness();
  assert.equal((await h.call('saveAvailability',{availability:defaultAvailability()},{headers:{'x-fomo-internal-session':'intern-test'}})).status,403);
  assert.equal((await h.call('update',{}, {headers:{'x-fomo-internal-session':''}})).status,401);
});

test('visit view waits for Internal login, loads automatically, and clears data on expiry',async()=>{
  const nodes=new Map(),events=new Map(),calls=[];let token='',expired=false;
  const element=()=>({value:'',hidden:true,textContent:'',classList:{toggle(){}},
    addEventListener(){},replaceChildren(){},append(){},setAttribute(){}});
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
  const window={FOMO_SHEET:{session:()=>token,admin:()=>false},
    addEventListener(name,fn){events.set(name,fn);},dispatchEvent(){}};
  const context=vm.createContext({document,window,URL,location:{origin:'https://crm.example',hash:'#/visits'},
    CustomEvent:class{constructor(type){this.type=type;}},fetch:async(url,options)=>{
      calls.push({url,options});
      return {ok:!expired,status:expired?401:200,json:async()=>expired?{error:'Sign in to Internal to view visit requests.'}:url.includes('availability')?{availability:[]}:{requests:[]}};
    }});
  vm.runInContext(readFileSync(new URL('../invoice/visits.js',import.meta.url),'utf8'),context);
  assert.equal(calls.length,0);
  token='intern-test';events.get('fomo:identity')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[0].url,'/api/visits?action=list');
  assert.equal(calls[0].options.headers['X-Fomo-Internal-Session'],token);
  assert.equal(nodes.get('vr-workspace').hidden,false);
  assert.equal(window.FOMO_VISIT_STATS.total,0);
  expired=true;
  await vm.runInContext('refresh()',context);
  assert.equal(nodes.get('vr-workspace').hidden,true);
  assert.equal(window.FOMO_VISIT_STATS,null);
  assert.equal(calls.some(call=>call.url.includes('login')),false);
  const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="vr-(?:password|login|lock)"/);
});
