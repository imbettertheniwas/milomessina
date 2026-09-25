import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source = readFileSync(new URL('../invoice/beta-portal.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]*\n/, '')
  .replace(/handleLocationChange\(\);\s*$/, 'globalThis.portal = {loadInvite, signInWithAccess, restoreProfile, handleLocationChange, submitJoin, makeJoinAttempt, pendingJoin, refresh, state: () => ({token, workspace, invite, inviteBatch, generation, accessCapability, gateBusy})};');
const ACCESS = 'BETA-' + 'a'.repeat(32);
const INVITE_A = 'BATCH-' + '1'.repeat(32), INVITE_B = 'BATCH-' + '2'.repeat(32);
const fields = {name:'Example Intern', email:'intern@example.invalid', phone:'+1 202 555 0100', github:'example-intern'};
const member = batch => ({id:'member-' + batch, batchId:batch, batch:'Group ' + batch, status:'active', ...fields});
const batch = id => ({id, name:'Group ' + id, startDate:'2026-09-01', endDate:'2026-09-14', active:true});
const identity = (id, token='session-' + id) => ({ok:true, beta:true, token, member:member(id), permissions:[]});
const workspace = id => ({ok:true, manager:false, member:member(id), batch:batch(id), permissions:[], peers:[member(id)], attendance:[], recaps:[]});
const reply = value => ({ok:true, json:async() => value});
function storage(values={}) {
  const map=new Map(Object.entries(values));
  return {getItem:key=>map.get(key) || null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),map};
}
function harness(fetchImpl, {session=storage(), local=storage(), hash=''}={}) {
  const elements=new Map(), events=new Map(); let document;
  const makeElement=id=>({id,name:id.replace('beta-join-',''),value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,
    classList:{toggle(){}},setAttribute(){},removeAttribute(){},replaceChildren(){this.innerHTML='';this.textContent='';},
    focus(){document.activeElement=this;},select(){},setCustomValidity(){},checkValidity(){return true;},reportValidity(){},
    matches(){return false;},contains(element){return element===this;},closest(){return null;},
    addEventListener(name,fn){events.set(id+':'+name,fn);},
    reset(){['name','email','phone','github'].forEach(name=>get('beta-join-'+name).value='');},
    querySelectorAll(selector){if(id==='beta-join-progress')return [get('step1'),get('step2'),get('step3')];if(id==='beta-join-details'||id==='beta-join-form')return ['name','email','phone','github'].map(name=>get('beta-join-'+name));return [];}});
  const get=id=>{if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  document={getElementById:get,activeElement:null,hidden:false,addEventListener(){}};
  const location={origin:'https://example.invalid',pathname:'/internal/beta',search:'',hash};
  const context=vm.createContext({document,location,history:{replaceState(_a,_b,url){location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';}},
    window:{addEventListener(name,fn){events.set('window:'+name,fn);}},sessionStorage:session,localStorage:local,
    fetch:async(_url,options)=>reply(await fetchImpl(JSON.parse(options.body))),crypto:webcrypto,URL,URLSearchParams,AbortController,Uint8Array,Date,Intl,TypeError,Error,
    setTimeout,clearTimeout,setInterval(){},navigator:{clipboard:{writeText:async()=>{}}},
    loadBetaGithub:async()=>[],betaGithubInitial:()=>[]});
  vm.runInContext(source,context,{filename:'beta-portal.js'});
  return {portal:context.portal,get,session,local,location,events};
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}

test('passwordless markup has no manual access-code form and does not force saving a return link',()=>{
  const html=readFileSync(new URL('../invoice/beta.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/type=["']password|id=["']beta-code|beta-login-form/);
  assert.match(html,/id="beta-copy-link"/);assert.match(html,/id="beta-hide-link"/);
  assert.match(html,/id="beta-profile"/);
});

test('an existing same-batch session opens its profile instead of the join form',async()=>{
  const calls=[];const session=storage({'fomo.beta.session':'saved-A'}),local=storage({'fomo.beta.access':ACCESS});
  const h=harness(body=>{calls.push(body);if(body.action==='betainvite')return {ok:true,batch:batch('A')};if(body.action==='session')return identity('A','saved-A');if(body.action==='list')return workspace('A');throw Error('Unexpected request');},{session,local});
  await h.portal.loadInvite(INVITE_A);
  assert.equal(h.portal.state().workspace.member.id,'member-A');assert.equal(h.get('beta-workspace').hidden,false);
  assert.equal(h.get('beta-gate').hidden,true);assert.equal(session.getItem('fomo.beta.session'),'saved-A');
  assert.equal(calls.some(call=>call.action==='betajoin'),false);assert.equal(local.getItem('fomo.beta.access'),ACCESS);
});

test('opening another batch keeps the stored identity while showing its invitation',async()=>{
  const session=storage({'fomo.beta.session':'saved-A'}),local=storage({'fomo.beta.access':ACCESS});
  const h=harness(body=>body.action==='betainvite'?{ok:true,batch:batch('B')}:identity('A','saved-A'),{session,local});
  await h.portal.loadInvite(INVITE_B);
  assert.equal(h.portal.state().inviteBatch.id,'B');assert.equal(h.portal.state().workspace,null);
  assert.equal(session.getItem('fomo.beta.session'),'saved-A');assert.equal(local.getItem('fomo.beta.access'),ACCESS);
  assert.equal(h.get('beta-join-form').hidden,false);
});

test('an expired six-hour session recovers from the remembered personal link',async()=>{
  const calls=[];const h=harness(body=>{calls.push(body);if(body.action==='session')return {ok:false,error:'Session expired. Enter the passcode and select your name again.'};if(body.action==='betalogin')return identity('A','renewed');return workspace('A');},
    {session:storage({'fomo.beta.session':'expired'}),local:storage({'fomo.beta.access':ACCESS})});
  await h.portal.restoreProfile();
  assert.equal(h.portal.state().token,'renewed');assert.equal(h.session.getItem('fomo.beta.session'),'renewed');
  assert.equal(calls.find(call=>call.action==='betalogin').code,ACCESS);
});

test('a lost join response preserves its request and original details across reload and retry',async()=>{
  const shared=storage(),calls=[];
  const first=harness(body=>{if(body.action==='betainvite')return {ok:true,batch:batch('A')};calls.push(body);throw new TypeError('Network lost after write');},{session:shared});
  await first.portal.loadInvite(INVITE_A);await first.portal.submitJoin(fields);
  const request=first.portal.pendingJoin(INVITE_A);assert.match(request.joinRequest,/^[a-f0-9]{32}$/);
  assert.equal(first.portal.state().workspace,null);assert.equal(first.local.getItem('fomo.beta.access'),null);
  const second=harness(body=>{if(body.action==='betainvite')return {ok:true,batch:batch('A')};if(body.action==='betajoin'){calls.push(body);return {...identity('A'),code:ACCESS,recovered:true};}return workspace('A');},{session:shared});
  await second.portal.loadInvite(INVITE_A);
  assert.equal(second.get('beta-join-phone').value,fields.phone);assert.equal(second.get('beta-join-review').hidden,false);
  await second.portal.submitJoin(fields);
  assert.equal(calls[0].joinRequest,calls[1].joinRequest);assert.deepEqual(calls[0],calls[1]);
  assert.equal(second.portal.pendingJoin(INVITE_A),null);assert.equal(second.local.getItem('fomo.beta.access'),ACCESS);
  assert.equal(second.get('beta-workspace').hidden,false);
});

test('new invitation fragments ignore stale responses from the earlier invitation',async()=>{
  const first=deferred();const h=harness(body=>body.invite===INVITE_A?first.promise:{ok:true,batch:batch('B')});
  const old=h.portal.loadInvite(INVITE_A);h.location.hash='#invite='+INVITE_B;
  await h.events.get('window:hashchange')();first.resolve({ok:true,batch:batch('A')});await old;
  assert.equal(h.portal.state().invite,INVITE_B);assert.equal(h.portal.state().inviteBatch.id,'B');
  assert.match(h.get('beta-invite-summary').innerHTML,/Group B/);
});

test('a personal-link fragment opens the profile and signout clears remembered identity',async()=>{
  const h=harness(body=>body.action==='betalogin'?identity('A'):body.action==='logout'?{ok:true}:workspace('A'));
  h.location.hash='#access='+ACCESS;await h.events.get('window:hashchange')();
  assert.equal(h.local.getItem('fomo.beta.access'),ACCESS);assert.equal(h.location.hash,'');
  h.events.get('beta-signout:click')();
  assert.equal(h.local.getItem('fomo.beta.access'),null);assert.equal(h.session.getItem('fomo.beta.session'),null);
  assert.equal(h.portal.state().workspace,null);assert.equal(h.get('beta-workspace').hidden,true);
});


test('a tab keeps its own personal link when another tab remembers a different profile',async()=>{
  const accessB='BETA-'+'b'.repeat(32);
  const h=harness(body=>body.action==='session'?identity('A','saved-A'):workspace('A'),{
    session:storage({'fomo.beta.session':'saved-A','fomo.beta.access':ACCESS}),local:storage({'fomo.beta.access':accessB})});
  await h.portal.restoreProfile();
  assert.equal(h.portal.state().workspace.member.id,'member-A');
  assert.equal(h.portal.state().accessCapability,ACCESS);
  assert.doesNotMatch(h.get('beta-return-link').value,new RegExp(accessB));
});

test('a legacy session never displays another profile’s unpaired device return link',async()=>{
  const h=harness(body=>body.action==='session'?identity('A','saved-A'):workspace('A'),{
    session:storage({'fomo.beta.session':'saved-A'}),local:storage({'fomo.beta.access':'BETA-'+'b'.repeat(32)})});
  await h.portal.restoreProfile();
  assert.equal(h.portal.state().workspace.member.id,'member-A');
  assert.equal(h.portal.state().accessCapability,'');
  assert.equal(h.get('beta-return-link').value,'');
});

test('refresh transparently renews an expired session while its profile is open',async()=>{
  let expired=false;
  const h=harness(body=>{
    if(body.action==='betalogin')return identity('A',expired?'renewed':'initial');
    if(body.action==='list' && expired && body._session==='initial')return {ok:false,code:'AUTH_REQUIRED',error:'Session expired'};
    return workspace('A');
  });
  await h.portal.signInWithAccess(ACCESS);expired=true;await h.portal.refresh();
  assert.equal(h.portal.state().token,'renewed');assert.equal(h.portal.state().workspace.member.id,'member-A');
  assert.equal(h.get('beta-workspace').hidden,false);
});

test('a stale join response cannot replace the identity or invite in a newer route',async()=>{
  const pending=deferred();const h=harness(body=>{
    if(body.action==='betainvite')return {ok:true,batch:batch(body.invite===INVITE_A?'A':'B')};
    if(body.action==='betajoin')return pending.promise;
    throw Error('Unexpected request');
  });
  await h.portal.loadInvite(INVITE_A);const old=h.portal.submitJoin(fields);
  await h.portal.loadInvite(INVITE_B);pending.resolve({...identity('A'),code:ACCESS});await old;
  assert.equal(h.portal.state().inviteBatch.id,'B');assert.equal(h.portal.state().workspace,null);
  assert.equal(h.local.getItem('fomo.beta.access'),null);
  assert.ok(h.portal.pendingJoin(INVITE_A));
});

test('a confirmed pre-save rejection lets the user correct fields with a new request',async()=>{
  const attempts=[];const h=harness(body=>{
    if(body.action==='betainvite')return {ok:true,batch:batch('A')};
    if(body.action==='betajoin'){attempts.push(body);if(attempts.length===1)return {ok:false,code:'INVALID',joinSaved:false,error:'Enter a valid email address.'};return {...identity('A'),code:ACCESS};}
    return workspace('A');
  });
  await h.portal.loadInvite(INVITE_A);await h.portal.submitJoin({...fields,email:'person@example'});
  assert.equal(h.portal.pendingJoin(INVITE_A),null);assert.equal(h.get('beta-join-details').hidden,false);
  await h.portal.submitJoin(fields);
  assert.notEqual(attempts[0].joinRequest,attempts[1].joinRequest);assert.equal(attempts[1].email,fields.email);
  assert.equal(h.portal.state().workspace.member.id,'member-A');
});

test('a paused profile clears visible data but keeps its return link for reactivation',async()=>{
  let paused=false;const h=harness(body=>{
    if(paused)return {ok:false,code:'AUTH_REQUIRED',error:'This batch is paused.'};
    return body.action==='betalogin'?identity('A'):workspace('A');
  });
  await h.portal.signInWithAccess(ACCESS);paused=true;await h.portal.refresh();
  assert.equal(h.portal.state().workspace,null);assert.equal(h.get('beta-workspace').hidden,true);
  assert.equal(h.local.getItem('fomo.beta.access'),ACCESS);assert.equal(h.session.getItem('fomo.beta.session'),null);
  paused=false;await h.portal.restoreProfile();assert.equal(h.portal.state().workspace.member.id,'member-A');
});
