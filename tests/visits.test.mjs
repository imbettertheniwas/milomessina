import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createVisitHandler,issueSession,validSession,createSheetStore} from '../server/visits/handler.mjs';
import {memoryStore} from '../server/visits-preview.mjs';

const env={VISITS_PUBLIC_ORIGIN:'https://crm.example',VISITS_STORAGE_URL:'https://script.google.com/macros/s/test/exec',
  VISITS_SERVICE_SECRET:'test-service-secret-'.repeat(3),VISITS_SESSION_SECRET:'test-session-secret-'.repeat(3),
  VISITS_ADMIN_PASSWORD:'test-admin-password-for-visits'};
const now=Date.parse('2026-09-16T20:00:00Z');
const guest={requestId:'00000000-0000-4000-8000-000000000001',name:'Guest',email:'guest@example.invalid',social:'@guest',notes:'A collaboration',website:'',date:'2026-09-17',time:'2:15 PM'};
function harness(overrides={}) {
  const {store,records}=memoryStore();
  const handler=createVisitHandler({env,store,now:()=>now,...overrides});
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
test('private list and updates require a valid signed session',async()=>{
  const h=harness();
  assert.equal((await h.call('list',null,{method:'GET'})).status,401);
  assert.equal((await h.call('update',{})).status,401);
  assert.equal((await h.call('login',{password:'wrong'})).status,401);
  const login=await h.call('login',{password:env.VISITS_ADMIN_PASSWORD});
  assert.equal(login.status,200);
  const cookie=login.headers['Set-Cookie'];
  assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(validSession(cookie,env,now),true);
  assert.equal(validSession(cookie,env,now+4*3600000),false);
  assert.equal(validSession(cookie,{...env,VISITS_ADMIN_PASSWORD:'rotated'},now),false);
  assert.equal(validSession(cookie.replace(/.$/,'x'),env,now),true); // Attribute changes do not change the signed token.
  assert.equal(validSession(cookie.replace('__Host-fomo-visits=','__Host-fomo-visits=forged'),env,now),false);
  await h.call();
  const list=await h.call('list',null,{method:'GET',cookie});
  assert.equal(list.status,200);assert.equal(list.body.requests.length,1);
  const edit={id:guest.requestId,status:'confirmed',internalNotes:'Team note',version:1};
  assert.equal((await h.call('update',edit,{cookie})).body.request.version,2);
  assert.equal((await h.call('update',edit,{cookie})).status,409);
  assert.equal((await h.call('update',{...edit,version:2,status:'deleted'},{cookie})).status,400);
  const logout=await h.call('logout',{}, {cookie});assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
});
test('shared login limiter is consulted before checking passwords',async()=>{
  const h=harness();
  for(let i=0;i<10;i++)assert.equal((await h.call('login',{password:'incorrect'})).status,401);
  assert.equal((await h.call('login',{password:env.VISITS_ADMIN_PASSWORD})).status,429);
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
  assert.equal(result.reference,guest.requestId);
});
test('existing console inline scripts still parse; route and iframe-free form remain present',()=>{
  const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert.match(html,/data-view="visits"/);assert.match(html,/data-go="visits"/);
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.ok(config.rewrites.some(r=>r.source==='/internal'&&r.destination==='/invoice/index.html'));
  const form=readFileSync(new URL('../hqvisitform/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(form,/<iframe/);assert.match(form,/portal-config.js/);
});
