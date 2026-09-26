import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommitHandler} from '../api/commits.mjs';
import {createInternalIdentityVerifier,createVisitHandler} from '../server/visits/handler.mjs';

const NOW=Date.parse('2026-09-25T12:00:00Z');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function request(handler,{url='/api/commits',method='GET',headers={},body}={}){
  const result={status:200,headers:{}};
  const response={setHeader(k,v){result.headers[k]=v;},status(status){result.status=status;return this;},
    json(value){result.body=value;return this;},end(raw){result.body=raw?JSON.parse(raw):undefined;return this;}};
  await handler({url,method,headers,body},response);
  return result;
}
const json=value=>({ok:true,json:async()=>value});
const repo=(login,i=0)=>({full_name:login+'/project-'+i,pushed_at:'2026-09-25T00:00:00Z'});
function githubResponse(url){
  const login=url.match(/\/users\/([^/]+)\/repos/)?.[1];
  if(login)return json([repo(login)]);
  if(url.includes('/contributions'))return {ok:true,text:async()=>'<div>No calendar</div>'};
  const author=url.match(/\/repos\/([^/]+)\//)[1];
  return json([{sha:author,author:{login:author},commit:{author:{date:'2026-09-24T12:00:00Z'},message:'A real commit'}}]);
}

test('commit refresh overlaps upstream reads within a shared limit and coalesces callers',async()=>{
  let active=0,peak=0,reads=0;
  const handler=createCommitHandler({env:{},now:()=>NOW,fetchImpl:async(url,options)=>{
    assert(options.signal instanceof AbortSignal);
    reads++;active++;peak=Math.max(peak,active);
    // Include response-body work in the simulated network delay.
    const response=githubResponse(url),consume=response.json?'json':'text';
    return {...response,[consume]:async()=>{
      await tick();active--;return response[consume]();
    }};
  }});
  const results=await Promise.all(Array.from({length:20},()=>request(handler)));
  assert.equal(peak,4,'independent scans overlap, including body consumption');
  assert.equal(active,0);
  assert.equal(reads,18,'six aliases each need a listing, commit page, and calendar');
  assert(results.every(result=>result.status===200));
  assert(results.slice(1).every(result=>result.headers['X-Commits-Cache']==='COALESCED'));
  assert.equal(results[0].body.people.Jesse.days['2026-09-24'],2);
  assert.equal(results[0].body.people.Arya.days['2026-09-24'],1);
  await request(handler);
  assert.equal(reads,18,'a fresh snapshot does not read GitHub again');
});

test('concurrent commit pagination stays within the existing sixty-read budget',async()=>{
  let reads=0,active=0,peak=0;
  const handler=createCommitHandler({env:{},now:()=>NOW,fetchImpl:async url=>{
    reads++;active++;peak=Math.max(peak,active);await tick();active--;
    const login=url.match(/\/users\/([^/]+)\/repos/)?.[1];
    if(login)return json(Array.from({length:6},(_,i)=>repo(login,i)));
    if(url.includes('/contributions'))return {ok:true,text:async()=>''};
    return json(Array.from({length:100},()=>({})));
  }});
  const result=await request(handler);
  assert.equal(result.status,200);assert.equal(reads,60);assert.equal(peak,4);
  assert(Object.values(result.body.people).every(person=>person.truncated));
});

for(const [requestTimeoutMs,refreshTimeoutMs] of [[10,100],[100,10]])
test(`commit deadlines (${requestTimeoutMs}/${refreshTimeoutMs} ms) stop slow reads, back off and recover`,async()=>{
  let calls=0,fail=true,time=NOW;
  const handler=createCommitHandler({env:{},now:()=>time,requestTimeoutMs,refreshTimeoutMs,
    fetchImpl:async(url,{signal})=>{
      calls++;
      if(!fail)return githubResponse(url);
      return new Promise((resolve,reject)=>{
        // A referenced timer keeps this fixture alive while AbortSignal expires.
        const timer=setTimeout(()=>resolve(githubResponse(url)),1000);
        signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
      });
    }});
  const first=await request(handler);
  assert.equal(first.status,503);assert.match(first.body.detail,/timed out/);
  assert(calls<=(refreshTimeoutMs<requestTimeoutMs?4:6),'the deadline prevents expired queued work from starting');
  const before=calls;
  await request(handler);assert.equal(calls,before,'outage backoff suppresses repeat work');
  time+=30000;fail=false;
  assert.equal((await request(handler)).status,200);
});

test('GitHub rate limiting stops queued reads without an upstream retry burst',async()=>{
  let calls=0;
  const handler=createCommitHandler({env:{},now:()=>NOW,fetchImpl:async()=>{
    calls++;await tick();return {ok:false,status:429,headers:new Headers()};
  }});
  const result=await request(handler);
  assert.equal(result.status,503);assert.equal(calls,4);
  await request(handler);assert.equal(calls,4);
});

test('visit authorization reuses capability probes and in-flight checks, never completed sessions',async()=>{
  let time=NOW,probes=0,sessions=0,revoked=false;
  const verify=createInternalIdentityVerifier({now:()=>time,fetchImpl:async(url,options)=>{
    await tick();
    if(options.method!=='POST'){probes++;return json({identity:true});}
    sessions++;
    return json(revoked?{ok:false}:{ok:true,who:'Arya',admin:true});
  }});
  const results=await Promise.all(Array.from({length:10},()=>verify('one-session')));
  assert(results.every(identity=>identity.admin===true));
  assert.equal(probes,1);assert.equal(sessions,1);
  revoked=true;
  assert.equal(await verify('one-session'),false,'revocation takes effect on the very next completed check');
  assert.equal(probes,1);assert.equal(sessions,2);
  time+=60000;
  await verify('one-session');
  assert.equal(probes,2,'capabilities expire after one minute');
});

test('visit capability failures clear pending work and never post to legacy receivers',async()=>{
  let supported=false,probes=0,posts=0;
  const verify=createInternalIdentityVerifier({fetchImpl:async(url,options)=>{
    if(options.method==='POST'){posts++;return json({ok:true,who:'Milo',admin:true});}
    probes++;return json({identity:supported});
  }});
  assert.equal(await verify('session'),false);assert.equal(posts,0);
  supported=true;
  assert.deepEqual(await verify('session'),{who:'Milo',admin:true});
  assert.equal(probes,2);assert.equal(posts,1);
});

test('visits share concurrent list reads only after authorization and release completed data',async()=>{
  const hold=deferred();let reads=0,authorizations=0;
  const env={VISITS_PUBLIC_ORIGIN:'https://crm.example',VISITS_STORAGE_URL:'https://script.google.com/macros/s/test/exec',
    VISITS_SERVICE_SECRET:'test-service-secret-'.repeat(3)};
  const handler=createVisitHandler({env,verifyIdentity:async token=>{
    authorizations++;return token==='valid'?{who:'Arya',admin:true}:false;
  },store:async action=>{assert.equal(action,'list');reads++;await hold.promise;return {requests:[]};}});
  const args={url:'/api/visits?action=list',headers:{'x-fomo-internal-session':'valid'}};
  const requests=Array.from({length:10},()=>request(handler,args));
  await tick();assert.equal(reads,1);assert.equal(authorizations,10);
  assert.equal((await request(handler,{url:args.url})).status,401);
  assert.equal(reads,1);
  hold.resolve();assert((await Promise.all(requests)).every(result=>result.status===200));
  await request(handler,args);assert.equal(reads,2,'completed private records are not retained as a cache');
});
