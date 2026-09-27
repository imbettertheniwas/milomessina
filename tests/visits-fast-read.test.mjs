import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createInternalIdentityVerifier,createSheetStore,createVisitHandler} from '../server/visits/handler.mjs';
import {harness} from './support/internal-harness.mjs';

const internalUrl='https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const secret='test-service-secret-'.repeat(3);
const json=value=>({ok:true,json:async()=>value});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function sheet(){
  const h=harness({VISITS_SERVICE_SECRET:secret,INTERNAL_BETA_SECRET:'test-beta-secret-'.repeat(3)});
  // Exercise the reference module too: existing separate-file deployments
  // must retain the same session boundary as the complete shared script.
  vm.runInContext(readFileSync(new URL('../server/visits/sheet.gs',import.meta.url),'utf8'),h.ctx);
  return h;
}
async function request(handler,token='valid'){
  const result={status:200,headers:{}};
  const res={setHeader(name,value){result.headers[name]=value;},status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  await handler({url:'/api/visits?action=list',method:'GET',headers:{'x-fomo-internal-session':token}},res);
  return result;
}
function transport({supported=true,separate=false,dispatch}={}){
  const calls=[];
  const env={VISITS_PUBLIC_ORIGIN:'https://crm.example',VISITS_STORAGE_URL:separate?'https://script.google.com/macros/s/separate/exec':internalUrl,VISITS_SERVICE_SECRET:secret};
  const fetchImpl=async(url,options)=>{
    const body=options.method==='POST'?JSON.parse(options.body):null;
    calls.push({url,body});
    if(!body)return json({identity:true,visitsAuthenticatedList:supported});
    if(dispatch)return json(await dispatch(body));
    if(body._api==='internal')return json({ok:true,who:'Arya',admin:true});
    return json({ok:true,data:{requests:[]}});
  };
  const verifyIdentity=createInternalIdentityVerifier({fetchImpl});
  const handler=createVisitHandler({env,verifyIdentity,store:createSheetStore(env,fetchImpl)});
  return {handler,calls};
}

test('combined Visits read uses one authenticated POST after one shared cold capability probe',async()=>{
  const {handler,calls}=transport();
  assert.equal((await request(handler)).status,200);
  assert.deepEqual(calls.map(call=>call.body?.action||'capability'),['capability','authenticatedList']);
  assert.equal(calls[1].body._session,'valid');
  assert.equal(calls[1].body.secret,secret);
  assert.equal((await request(handler)).status,200);
  assert.deepEqual(calls.map(call=>call.body?.action||'capability'),['capability','authenticatedList','authenticatedList']);
});

test('combined Visits reads preserve separate storage and older supported deployments',async()=>{
  for(const configuration of [{supported:false},{separate:true}]){
    const {handler,calls}=transport(configuration);
    assert.equal((await request(handler)).status,200);
    assert.deepEqual(calls.map(call=>call.body?.action||'capability'),['capability','session','list']);
    assert.equal((await request(handler)).status,200);
    assert.deepEqual(calls.slice(3).map(call=>call.body.action),['session','list']);
  }
});

test('invalid token shapes do not start a combined read or a capability request',async()=>{
  const {handler,calls}=transport();
  for(const token of ['',null,'x'.repeat(101),['valid']])assert.equal((await request(handler,token)).status,401);
  assert.equal(calls.length,0);
});

test('combined Visits route rechecks core sessions and rejects revoked or beta sessions before guest storage',async()=>{
  const h=sheet(),token=h.login('Arya');
  let guestReads=0;
  const visitBook=h.ctx.visitBook;
  h.ctx.visitBook=()=>{guestReads++;return visitBook();};
  h.sessions.set(h.ctx.betaSessionPrefix()+'example-session',JSON.stringify({id:'beta-member',name:'Arya',admin:true,epoch:1,batchEpoch:1}));
  const {handler,calls}=transport({dispatch:body=>h.ctx.visitsApi(body)});
  const first=await request(handler,token);
  assert.equal(first.status,200);
  assert.deepEqual(first.body,{requests:[]});
  assert.equal(first.headers['Cache-Control'],'no-store');
  assert.equal(guestReads,1);
  assert.equal(h.sheets.visit_requests,undefined,'reading an empty inbox does not create a sheet');
  h.ctx.internalSessionApi({action:'logout',_session:token});
  for(const invalid of [token,'example-session','unrecognized'])assert.equal((await request(handler,invalid)).status,401);
  assert.equal(guestReads,1,'denied tokens cannot reach guest rows');
  assert.equal(calls.filter(call=>call.body?.action==='session').length,0);
  assert.equal(calls.filter(call=>call.body?.action==='authenticatedList').length,4);
});

test('combined sheet read requires both service secret and a core session and honors the core allowlist',()=>{
  const h=sheet(),token=h.login('Milo');
  let reads=0;h.ctx.visitBook=()=>{reads++;throw Error('Guest storage reached');};
  assert.equal(h.ctx.visitsApi({action:'authenticatedList',secret:'wrong',_session:token}).code,'UNAUTHORIZED');
  assert.equal(h.ctx.visitsApi({action:'authenticatedList',secret}).code,'AUTH_REQUIRED');
  h.sessions.set('internal:not-a-core-teammate','New Person');
  const original=h.ctx.internalActor;h.ctx.internalActor=()=> 'New Person';
  assert.equal(h.ctx.visitsApi({action:'authenticatedList',secret,_session:'not-a-core-teammate'}).code,'AUTH_REQUIRED');
  h.ctx.internalActor=original;
  assert.equal(reads,0);
});

test('concurrent combined reads coalesce only for the same token and release completed private data',async()=>{
  let finish;const hold=new Promise(resolve=>{finish=resolve;});
  const {handler,calls}=transport({dispatch:async body=>{
    assert.equal(body.action,'authenticatedList');
    await hold;
    return body._session==='valid'?{ok:true,data:{requests:[]}}:{ok:false,code:'AUTH_REQUIRED'};
  }});
  const first=request(handler),second=request(handler),denied=request(handler,'other');
  await tick();
  assert.equal(calls.length,3,'one capability probe and one POST per distinct token');
  finish();
  assert.deepEqual((await Promise.all([first,second,denied])).map(result=>result.status),[200,200,401]);
  assert.equal((await request(handler)).status,200);
  assert.equal(calls.length,4,'the next completed read checks the session again');
});

test('reading an absent visit list or public hours never creates guest storage',()=>{
  const h=sheet();
  assert.deepEqual(h.ctx.visitsApi({action:'list',secret}).data.requests,[]);
  assert.equal(h.ctx.visitsApi({action:'settings',secret}).ok,true);
  assert.equal(h.sheets.visit_requests,undefined);
});
