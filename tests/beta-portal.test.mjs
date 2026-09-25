import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {normalizeSchedule, scheduleFile} from '../invoice/beta-schedule.js';

const source = readFileSync(new URL('../invoice/beta-portal.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/handleLocationChange\(\);\s*$/, 'globalThis.portal = {loadInvite, signInWithAccess, restoreProfile, handleLocationChange, submitJoin, makeJoinAttempt, pendingJoin, refresh, saveWebsite, websiteUrl, scheduleDraft, scheduleChange, scheduleAction, readScheduleFile, saveSchedule, downloadSchedule, joinFields, validateJoinSchedule, state: () => ({token, workspace, invite, inviteBatch, generation, accessCapability, gateBusy, scheduleDrafts})};');
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
function harness(fetchImpl, {session=storage(), local=storage(), hash='', readFile=scheduleFile}={}) {
  const githubRequests=[];
  const downloads=[];
  const elements=new Map(), events=new Map(); let document;
  const makeElement=id=>({id,name:id.replace('beta-join-',''),value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},tagName:'INPUT',
    classList:{toggle(){}},setAttribute(){},removeAttribute(){},replaceChildren(){this.innerHTML='';this.textContent='';},
    focus(){document.activeElement=this;},select(){},setCustomValidity(value){this.validityMessage=value;},checkValidity(){return !this.validityMessage;},reportValidity(){},
    matches(){return false;},contains(element){return element===this || id==='beta-website-form' && element?.id==='beta-website';},closest(){return null;},
    addEventListener(name,fn){events.set(id+':'+name,fn);},
    reset(){['name','email','phone','github','website'].forEach(name=>get('beta-join-'+name).value='');},
    querySelectorAll(selector){if(id==='beta-join-progress')return [get('step1'),get('step2'),get('step3'),get('step4')];if(id==='beta-join-details'||id==='beta-join-form')return ['name','email','phone','github','website'].map(name=>get('beta-join-'+name));if(id==='beta-profile')return [get('beta-website'),get('beta-website-save')];return [];}});
  const get=id=>{if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id);};
  document={getElementById:get,activeElement:null,hidden:false,addEventListener(){},createElement(){return {click(){downloads.push({href:this.href,name:this.download});}};}};
  const location={origin:'https://example.invalid',pathname:'/internal/beta',search:'',hash};
  const context=vm.createContext({document,location,history:{replaceState(_a,_b,url){location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';}},
    window:{addEventListener(name,fn){events.set('window:'+name,fn);}},sessionStorage:session,localStorage:local,
    fetch:async(_url,options)=>reply(await fetchImpl(JSON.parse(options.body))),crypto:webcrypto,URL:class extends URL{static createObjectURL(){return 'blob:private-download';}static revokeObjectURL(){}},URLSearchParams,AbortController,Uint8Array,Date,Intl,TypeError,Error,Blob,atob,
    setTimeout,clearTimeout,setInterval(){},navigator:{clipboard:{writeText:async()=>{}}},
    loadBetaGithub:async(peers,options)=>{githubRequests.push({peers,options});return [];},betaGithubInitial:()=>[],normalizeSchedule,scheduleFile:readFile});
  vm.runInContext(source,context,{filename:'beta-portal.js'});
  return {portal:context.portal,get,session,local,location,events,githubRequests,downloads};
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

test('the permanent root link opens signup and creates a profile only on the join action',async()=>{
  const calls=[];const h=harness(body=>{
    calls.push(body);
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),group:{...batch('A'),name:'Beta'},invite:'beta',periodDays:14};
    if(body.action==='betajoin')return {...identity('A'),code:ACCESS};
    return workspace('A');
  });
  await h.portal.handleLocationChange();
  assert.equal(h.portal.state().invite,'beta');assert.equal(h.get('beta-join-form').hidden,false);
  assert.equal(h.get('beta-join-welcome').hidden,false);assert.equal(h.get('beta-invite-needed').hidden,true);
  assert.deepEqual(calls.map(call=>call.action),['betagroup']);
  assert.match(h.get('beta-invite-summary').innerHTML,/Beta.*14 days, starting the day you join/);
  assert.doesNotMatch(h.get('beta-invite-summary').innerHTML,/Sep 1|Sep 14/);
  await h.portal.submitJoin(fields);
  const join=calls.find(call=>call.action==='betajoin');
  assert.equal(join.invite,'beta');assert.equal(join.phone,fields.phone);assert.match(join.joinRequest,/^[a-f0-9]{32}$/);
  assert.equal(h.portal.state().workspace.member.id,'member-A');assert.equal(h.location.hash,'');
});

test('the permanent root link restores a remembered older group without fetching a new signup group',async()=>{
  const calls=[];const h=harness(body=>{
    calls.push(body.action);
    if(body.action==='session')return identity('older','saved');
    if(body.action==='list')return workspace('older');
    throw Error('A remembered profile does not need a new invite.');
  },{session:storage({'fomo.beta.session':'saved','fomo.beta.access':ACCESS})});
  await h.portal.handleLocationChange();
  assert.equal(h.portal.state().workspace.member.id,'member-older');assert.deepEqual(calls,['session','list']);
});

test('personal join dates drive the summary, attendance, GitHub query, and recap deadline',async()=>{
  const own={...member('A'),startDate:'2026-09-20',endDate:'2026-10-03'};
  const data={...workspace('A'),group:{...batch('A'),name:'Beta'},member:own,permissions:['attendance','github','recap'],
    peers:[own,{id:'later',name:'Later Joiner',github:'later',startDate:'2026-09-24',endDate:'2026-10-07'}]};
  const h=harness(body=>body.action==='betalogin'?{...identity('A'),member:own}:data);
  await h.portal.signInWithAccess(ACCESS);
  assert.deepEqual({...h.portal.state().workspace.period},{startDate:'2026-09-20',endDate:'2026-10-03'});
  assert.equal(h.get('beta-batch').textContent,'Beta');
  assert.match(h.get('beta-summary').innerHTML,/Sep 20.*Oct 3/);
  assert.match(h.get('beta-sections').innerHTML,/min="2026-09-20"/);
  assert.match(h.get('beta-sections').innerHTML,/Due Oct 3/);
  assert.match(h.get('beta-sections').innerHTML,/outside their beta period/);
  assert.equal(h.githubRequests[0].options.startDate,'2026-09-20');assert.equal(h.githubRequests[0].options.endDate,'2026-10-03');
});

test('a delayed permanent-group response cannot overwrite a newly pasted opaque invitation',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='betagroup'?pending.promise:{ok:true,batch:batch('B')});
  const initial=h.portal.handleLocationChange();await Promise.resolve();await Promise.resolve();
  h.location.hash='#invite='+INVITE_B;await h.events.get('window:hashchange')();
  pending.resolve({ok:true,batch:batch('A'),invite:'beta'});await initial;
  assert.equal(h.portal.state().invite,INVITE_B);assert.equal(h.portal.state().inviteBatch.id,'B');
});

test('a lost permanent-link join safely retries the same request after a root-page reload',async()=>{
  const session=storage(),attempts=[];
  const first=harness(body=>{
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),invite:'beta'};
    attempts.push(body);throw new TypeError('Lost saved response');
  },{session});
  await first.portal.handleLocationChange();await first.portal.submitJoin(fields);
  const second=harness(body=>{
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),invite:'beta'};
    if(body.action==='betajoin'){attempts.push(body);return {...identity('A'),code:ACCESS,recovered:true};}
    return workspace('A');
  },{session});
  await second.portal.handleLocationChange();
  assert.equal(second.get('beta-join-review').hidden,false);assert.equal(second.get('beta-join-phone').value,fields.phone);
  await second.portal.submitJoin(fields);
  assert.deepEqual(attempts[0],attempts[1]);assert.equal(second.portal.pendingJoin('beta'),null);
});

test('onboarding collects an optional website and reviews it without weakening required details',async()=>{
  const html=readFileSync(new URL('../invoice/beta.html',import.meta.url),'utf8');
  const input=html.match(/<input\b[^>]*id="beta-join-website"[^>]*>/)?.[0];
  assert.ok(input);assert.doesNotMatch(input,/\brequired\b/);assert.match(input,/maxlength="300"/);
  for(const name of ['name','email','phone','github'])assert.match(html,new RegExp('<input\\b[^>]*id="beta-join-'+name+'"[^>]*\\brequired\\b'));
  const h=harness(()=>({ok:true,batch:batch('A')}));await h.portal.loadInvite(INVITE_A);
  for(const [key,value] of Object.entries(fields))h.get('beta-join-'+key).value=value;
  h.get('beta-join-website').value='my-portfolio.example/work';
  h.events.get('beta-details-next:click')();
  assert.equal(h.get('beta-join-schedule').hidden,false);
  h.portal.scheduleDraft('join').noCommitments=true;h.events.get('beta-schedule-next:click')();
  assert.equal(h.get('beta-join-review').hidden,false);
  assert.match(h.get('beta-review-details').innerHTML,/<dt>Website<\/dt><dd>my-portfolio.example\/work/);
  h.get('beta-join-website').value='javascript:alert(1)';h.events.get('beta-details-next:click')();
  assert.equal(h.get('beta-join-details').hidden,false);assert.match(h.get('beta-login-error').textContent,/public website/);
  h.get('beta-join-website').value='';h.events.get('beta-details-next:click')();
  h.events.get('beta-schedule-next:click')();
  assert.equal(h.get('beta-join-review').hidden,false);assert.doesNotMatch(h.get('beta-review-details').innerHTML,/<dt>Website/);
  h.get('beta-join-email').value='';h.events.get('beta-details-next:click')();
  assert.equal(h.get('beta-join-details').hidden,false);assert.match(h.get('beta-login-error').textContent,/email address/);
});

test('a lost join response preserves its original website along with the same retry request',async()=>{
  const session=storage(),attempts=[],original={...fields,website:'My-Portfolio.example/work?ref=beta'};
  const first=harness(body=>{
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),invite:'beta'};
    attempts.push(body);throw new TypeError('Connection lost');
  },{session});
  await first.portal.handleLocationChange();await first.portal.submitJoin(original);
  const second=harness(body=>{
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),invite:'beta'};
    if(body.action==='betajoin'){attempts.push(body);return {...identity('A'),code:ACCESS};}
    return workspace('A');
  },{session});
  await second.portal.handleLocationChange();
  assert.equal(second.get('beta-join-website').value,original.website);
  await second.portal.submitJoin({...original,website:'changed.example'});
  assert.deepEqual(attempts[1],attempts[0]);assert.equal(attempts[1].website,original.website);
});

test('an older four-field pending join remains retryable with an empty website',async()=>{
  const request='c'.repeat(32),session=storage({'fomo.beta.pendingJoins':JSON.stringify({beta:{joinRequest:request,fields}})});
  const attempts=[];const h=harness(body=>{
    if(body.action==='betagroup')return {ok:true,batch:batch('A'),invite:'beta'};
    if(body.action==='betajoin'){attempts.push(body);return {...identity('A'),code:ACCESS};}
    return workspace('A');
  },{session});
  await h.portal.handleLocationChange();assert.equal(h.portal.pendingJoin('beta').fields.website,'');
  assert.equal(h.get('beta-join-website').value,'');await h.portal.submitJoin(fields);
  assert.equal(attempts[0].joinRequest,request);assert.equal(attempts[0].website,'');
});

test('website links accept domains and http URLs while rejecting unsafe or malformed destinations',()=>{
  const h=harness(()=>{throw Error('No requests expected');});
  for(const [raw,expected] of [['My-Portfolio.example','https://my-portfolio.example'],[' HTTP://Site.example:8080/Work?x=1&y=2#Bio ','http://site.example:8080/Work?x=1&y=2#Bio'],['','']])assert.equal(h.portal.websiteUrl(raw),expected,raw);
  for(const raw of ['javascript:alert(1)','data:text/html,hello','//evil.example','https://person:secret@site.example','site.example\\@evil.example','https://site.example/a b','https://site.example/\npath','http://localhost','http://127.0.0.1','https://[::1]','https://site..example','https://-site.example','https://site.example:0','https://site.example:65536','https://site.example/<script>','https://site.example/"','https://site.example/\'','https://site.example/`', 'a'.repeat(64)+'.example', 'https://site.example/'+ 'x'.repeat(300)])assert.equal(h.portal.websiteUrl(raw),'',raw);
});

test('the beta home shows simple escaped peer names with safe website links before attendance',async()=>{
  const own={...member('A'),website:'https://own.example'},data={...workspace('A'),member:own,permissions:['attendance'],peers:[
    own,{id:'peer',name:'Lee <Builder>',website:'https://lee.example/work?a=1&b=2',email:'private@example.invalid'},
    {id:'missing',name:'No website'}, {id:'unsafe',name:'Unsafe site',website:'javascript:alert(1)'},
    {id:'credential',name:'Credential site',website:'https://person:secret@site.example'}]};
  const h=harness(body=>body.action==='betalogin'?identity('A'):data);await h.portal.signInWithAccess(ACCESS);
  const markup=h.get('beta-sections').innerHTML,sites=markup.slice(0,markup.indexOf('id="beta-section-attendance"'));
  assert.match(sites,/<ul class="portfolio-names">/);assert.match(sites,/href="https:\/\/lee.example\/work\?a=1&amp;b=2"/);
  assert.match(sites,/Lee &lt;Builder&gt;/);assert.match(sites,/rel="noopener noreferrer"/);
  assert.doesNotMatch(sites,/private@example|Unsafe site|Credential site|No website|<iframe|<img|javascript:/);
  assert.ok(markup.indexOf('id="beta-section-websites"')<markup.indexOf('id="beta-section-attendance"'));
  assert.equal(h.get('beta-website').value,own.website);
});

test('own-profile website save normalizes a bare domain and preserves private profile and recap data',async()=>{
  const requests=[];let current={...workspace('A'),permissions:['recap'],recaps:[{memberId:'member-A',learned:'Learning',accomplished:'Built work',links:[]}]};
  const h=harness(body=>{
    requests.push(body);if(body.action==='betalogin')return identity('A');
    if(body.action==='memberprofile'){current={...current,member:{...current.member,website:body.website},peers:[{...current.member,website:body.website}]};}
    return current;
  });
  await h.portal.signInWithAccess(ACCESS);h.get('beta-website').value='MY-SITE.example/work';
  await h.portal.saveWebsite(h.get('beta-website').value);
  assert.deepEqual(requests.find(body=>body.action==='memberprofile'),{website:'https://my-site.example/work',_api:'beta',action:'memberprofile',_session:'session-A'});
  assert.equal(h.get('beta-website').value,'https://my-site.example/work');
  assert.match(h.get('beta-sections').innerHTML,/href="https:\/\/my-site.example\/work"/);
  assert.match(h.get('beta-profile').innerHTML,/intern@example.invalid/);assert.equal(h.get('beta-learned').value,'Learning');
  assert.equal(h.portal.state().workspace.member.email,fields.email);assert.match(h.get('beta-notice').textContent,/saved/);
  await h.portal.saveWebsite('');
  assert.equal(requests.at(-1).website,'');assert.equal(h.get('beta-website').value,'');
  assert.doesNotMatch(h.get('beta-sections').innerHTML,/https:\/\/my-site.example/);assert.match(h.get('beta-notice').textContent,/removed/);
});

test('invalid and failed website saves keep the existing link and allow correction without losing the draft',async()=>{
  let fail=true;const calls=[],data={...workspace('A'),member:{...member('A'),website:'https://saved.example'},peers:[{...member('A'),website:'https://saved.example'}]};
  const h=harness(body=>{
    calls.push(body);if(body.action==='betalogin')return identity('A');
    if(body.action==='memberprofile'&&fail)throw new TypeError('Network unavailable');
    if(body.action==='memberprofile')return {...data,member:{...data.member,website:body.website},peers:[{...data.member,website:body.website}]};
    return data;
  });
  await h.portal.signInWithAccess(ACCESS);
  await h.portal.saveWebsite('javascript:alert(1)');
  assert.equal(calls.filter(body=>body.action==='memberprofile').length,0);assert.equal(h.get('beta-website-error').hidden,false);
  h.get('beta-website').value='new.example';h.events.get('beta-profile:input')({target:h.get('beta-website')});
  assert.equal(h.get('beta-website-error').hidden,true);await h.portal.saveWebsite('new.example');
  assert.equal(h.get('beta-website').value,'new.example');assert.match(h.get('beta-website-error').textContent,/Could not connect/);
  assert.equal(h.portal.state().workspace.member.website,'https://saved.example');assert.match(h.get('beta-sections').innerHTML,/https:\/\/saved.example/);
  fail=false;await h.portal.saveWebsite('new.example');
  assert.equal(h.portal.state().workspace.member.website,'https://new.example');assert.equal(h.get('beta-website-error').hidden,true);
});

test('a focused website draft survives automatic refresh and unrelated saved data',async()=>{
  const h=harness(body=>body.action==='betalogin'?identity('A'):{...workspace('A'),member:{...member('A'),website:'https://saved.example'}});
  await h.portal.signInWithAccess(ACCESS);h.get('beta-website').value='unsaved.example';h.get('beta-website').focus();
  h.events.get('beta-profile:input')({target:h.get('beta-website')});
  await h.portal.refresh(true);assert.equal(h.get('beta-website').value,'unsaved.example');assert.equal(h.get('beta-website').disabled,false);
  await h.portal.refresh();assert.equal(h.get('beta-website').value,'unsaved.example');
});

test('a website save cannot restore private data after signout',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='betalogin'?identity('A'):body.action==='memberprofile'?pending.promise:body.action==='logout'?{ok:true}:workspace('A'));
  await h.portal.signInWithAccess(ACCESS);const save=h.portal.saveWebsite('new.example');
  h.events.get('beta-signout:click')();pending.resolve({...workspace('A'),member:{...member('A'),website:'https://new.example'}});await save;
  assert.equal(h.portal.state().workspace,null);assert.equal(h.get('beta-workspace').hidden,true);
  assert.equal(h.get('beta-profile').innerHTML,'');assert.equal(h.get('beta-sections').innerHTML,'');assert.equal(h.get('beta-notice').textContent,'');
});

test('denied website editing clears the old profile while retaining its personal return capability',async()=>{
  let revoked=false;const h=harness(body=>{
    if(revoked)return {ok:false,code:'AUTH_REQUIRED',error:'This profile is paused.'};
    return body.action==='betalogin'?identity('A'):workspace('A');
  });
  await h.portal.signInWithAccess(ACCESS);revoked=true;await h.portal.saveWebsite('new.example');
  assert.equal(h.portal.state().workspace,null);assert.equal(h.get('beta-profile').innerHTML,'');
  assert.equal(h.get('beta-workspace').hidden,true);assert.equal(h.local.getItem('fomo.beta.access'),ACCESS);
});

const manualSchedule=()=>({timezone:'America/New_York',mode:'manual',blocks:[{day:1,start:'09:00',end:'11:30',label:'Class'}],noCommitments:false});
const pdfFile={name:'Schedule.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.4\nprivate schedule').toString('base64')};
const inputFile=(name,type,text)=>({name,type,size:Buffer.byteLength(text),arrayBuffer:async()=>Uint8Array.from(Buffer.from(text)).buffer});
function changeSchedule(h,scope,field,value,index){
  const target={dataset:{scheduleScope:scope,scheduleField:field},value,checked:Boolean(value)};
  if(index!==undefined)target.dataset.scheduleIndex=String(index);
  h.portal.scheduleChange({target});
}
function scheduleButton(h,scope,action,index){
  const button={dataset:{scheduleScope:scope,scheduleAction:action,scheduleIndex:String(index??0)}};
  h.portal.scheduleAction({target:{closest:()=>button}});
}

test('four-step onboarding requires a schedule before review while allowing an explicit empty week',async()=>{
  const html=readFileSync(new URL('../invoice/beta.html',import.meta.url),'utf8');
  assert.match(html,/<span>3<\/span> Schedule/);assert.match(html,/<span>4<\/span> Review/);
  const h=harness(()=>({ok:true,batch:batch('A')}));await h.portal.loadInvite(INVITE_A);
  for(const [key,value] of Object.entries(fields))h.get('beta-join-'+key).value=value;
  h.events.get('beta-details-next:click')();assert.equal(h.get('beta-join-schedule').hidden,false);
  assert.equal(h.portal.scheduleDraft('join').timezone,'America/New_York');
  h.events.get('beta-schedule-next:click')();assert.equal(h.get('beta-join-review').hidden,true);
  assert.match(h.get('beta-join-schedule-error').textContent,/time block|regular commitments/);
  changeSchedule(h,'join','noCommitments',true);h.events.get('beta-schedule-next:click')();
  assert.equal(h.get('beta-join-review').hidden,false);assert.match(h.get('beta-review-details').innerHTML,/No regular weekly commitments/);
  assert.equal(h.portal.joinFields().schedule.noCommitments,true);assert.equal(h.portal.joinFields().schedule.blocks.length,0);
});

test('manual schedule rows validate time ranges, cap at 80, and appear escaped in signup review and payload',async()=>{
  const h=harness(()=>({ok:true,batch:batch('A')}));await h.portal.loadInvite(INVITE_A);
  scheduleButton(h,'join','add');changeSchedule(h,'join','start','12:00',0);changeSchedule(h,'join','end','09:00',0);
  assert.equal(h.portal.validateJoinSchedule(),false);assert.match(h.get('beta-join-schedule-error').textContent,/end after the start/);
  changeSchedule(h,'join','start','08:00',0);changeSchedule(h,'join','label','Class <studio>',0);
  h.events.get('beta-schedule-next:click')();assert.match(h.get('beta-review-details').innerHTML,/Monday 08:00–09:00 · Class &lt;studio&gt;/);
  assert.equal(h.portal.joinFields().schedule.blocks[0].label,'Class <studio>');
  for(let i=0;i<90;i++)scheduleButton(h,'join','add');assert.equal(h.portal.scheduleDraft('join').blocks.length,80);
  scheduleButton(h,'join','remove',2);assert.equal(h.portal.scheduleDraft('join').blocks.length,79);
});

test('a schedule file can be selected or dropped and is summarized without exposing its contents',async()=>{
  const h=harness(()=>({ok:true,batch:batch('A')}));await h.portal.loadInvite(INVITE_A);
  await h.portal.readScheduleFile('join',[inputFile('Personal <week>.ics','text/plain','BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR')]);
  assert.equal(h.portal.scheduleDraft('join').file.type,'text/calendar');assert.equal(h.portal.scheduleDraft('join').mode,'file');
  assert.equal(h.portal.validateJoinSchedule(),true);h.events.get('beta-schedule-next:click')();
  assert.match(h.get('beta-review-details').innerHTML,/Personal &lt;week&gt;.ics/);
  assert.doesNotMatch(h.get('beta-review-details').innerHTML,/BEGIN:VCALENDAR|QkVHSU4/);
  assert.match(h.get('beta-join-schedule-editor').innerHTML,/type="file"/);assert.match(h.get('beta-join-schedule-editor').innerHTML,/\.ics/);
  assert.ok(h.events.has('beta-join-schedule-editor:drop'));assert.ok(h.events.has('beta-join-schedule-editor:dragover'));
  await h.portal.readScheduleFile('join',[inputFile('fake.pdf','application/pdf','not a PDF')]);
  assert.match(h.get('beta-join-schedule-error').textContent,/contents/);assert.equal(h.portal.scheduleDraft('join').file.name,'Personal <week>.ics');
  await h.portal.readScheduleFile('join',[{name:'large.pdf',type:'application/pdf',size:2097153}]);
  assert.match(h.get('beta-join-schedule-error').textContent,/2 MB/);
});

test('file selection completed after changing identities cannot restore the previous private schedule',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='betalogin'?identity('B'):body.action==='list'?workspace('B'):{ok:true,batch:batch('A')},{readFile:()=>pending.promise});
  await h.portal.loadInvite(INVITE_A);const upload=h.portal.readScheduleFile('join',[{name:'old.pdf'}]);
  await h.portal.signInWithAccess(ACCESS);pending.resolve(pdfFile);await upload;
  assert.equal(h.portal.state().workspace.member.id,'member-B');assert.equal(h.portal.state().scheduleDrafts.join,null);
  assert.equal(h.get('beta-join-schedule-editor').innerHTML,'');assert.doesNotMatch(h.get('beta-sections').innerHTML,/Schedule.pdf/);
});

test('a lost signup response retries the exact original file schedule after reload',async()=>{
  const session=storage(),attempts=[],original={...fields,schedule:{timezone:'America/New_York',mode:'file',blocks:[],file:pdfFile}};
  const first=harness(body=>{if(body.action==='betainvite')return {ok:true,batch:batch('A')};attempts.push(body);throw new TypeError('Lost saved response');},{session});
  await first.portal.loadInvite(INVITE_A);await first.portal.submitJoin(original);
  const second=harness(body=>{if(body.action==='betainvite')return {ok:true,batch:batch('A')};if(body.action==='betajoin'){attempts.push(body);return {...identity('A'),code:ACCESS};}return workspace('A');},{session});
  await second.portal.loadInvite(INVITE_A);assert.equal(second.get('beta-join-review').hidden,false);
  assert.equal(second.portal.scheduleDraft('join').file.data,pdfFile.data);
  await second.portal.submitJoin({...original,schedule:manualSchedule()});assert.deepEqual(attempts[1],attempts[0]);
  assert.equal(second.portal.pendingJoin(INVITE_A),null);assert.equal(second.get('beta-join-schedule-editor').innerHTML,'');
});

test('a legacy pending signup keeps schedule absent instead of changing the recoverable identity',async()=>{
  const request='d'.repeat(32),session=storage({'fomo.beta.pendingJoins':JSON.stringify({beta:{joinRequest:request,fields}})});
  const h=harness(()=>({ok:true,batch:batch('A')}),{session});await h.portal.handleLocationChange();
  assert.equal(h.get('beta-join-review').hidden,false);assert.match(h.get('beta-review-details').innerHTML,/earlier join/);
  assert.equal(Object.hasOwn(h.portal.joinFields(),'schedule'),false);
});

test('signup never sends a schedule when browser storage cannot preserve a safe retry',async()=>{
  const session=storage(),attempts=[];session.setItem=()=>{throw Error('Storage quota');};
  const h=harness(body=>{attempts.push(body);return {ok:true,batch:batch('A')};},{session});await h.portal.loadInvite(INVITE_A);
  await assert.rejects(h.portal.submitJoin({...fields,schedule:manualSchedule()}),/safely remember/);
  assert.equal(attempts.some(body=>body.action==='betajoin'),false);assert.equal(h.portal.pendingJoin(INVITE_A),null);
});

test('schedule edits save only the owner and peer schedules never enter the participant view',async()=>{
  const calls=[];let data={...workspace('A'),schedules:[{...manualSchedule(),memberId:'member-A',updatedAt:'2026-09-25T12:00:00Z'},{...manualSchedule(),memberId:'peer',blocks:[{day:1,start:'10:00',end:'11:00',label:'Secret peer class'}]}]};
  const h=harness(body=>{calls.push(body);if(body.action==='betalogin')return identity('A');if(body.action==='schedulesave')data={...data,schedules:[{...body.schedule,memberId:'member-A'}]};return data;});
  await h.portal.signInWithAccess(ACCESS);assert.equal(h.portal.state().workspace.schedules.length,1);assert.doesNotMatch(h.get('beta-sections').innerHTML,/Secret peer class/);
  changeSchedule(h,'own','label','Updated <work>',0);await h.portal.saveSchedule();
  const sent=calls.find(body=>body.action==='schedulesave');assert.equal(sent._session,'session-A');assert.equal(Object.hasOwn(sent,'id'),false);assert.equal(sent.schedule.blocks[0].label,'Updated <work>');
  assert.match(h.get('beta-sections').innerHTML,/Updated &lt;work&gt;/);assert.match(h.get('beta-notice').textContent,/private schedule is saved/);
  assert.match(h.get('beta-sections').innerHTML,/Only you, Arya, and Milo/);
});

test('an existing file can keep its private attachment when changing timezone and download is authenticated',async()=>{
  const calls=[],saved={memberId:'member-A',mode:'file',timezone:'America/New_York',blocks:[],ready:true,file:{name:pdfFile.name,type:pdfFile.type,size:24}};
  const h=harness(body=>{calls.push(body);if(body.action==='betalogin')return identity('A');if(body.action==='schedulefile')return {ok:true,file:pdfFile};return {...workspace('A'),schedules:[{...saved,timezone:body.schedule?.timezone||saved.timezone}]};});
  await h.portal.signInWithAccess(ACCESS);changeSchedule(h,'own','timezone','America/Chicago');await h.portal.saveSchedule();
  const sent=calls.find(body=>body.action==='schedulesave');assert.deepEqual(sent.schedule,{mode:'file',timezone:'America/Chicago',blocks:[],keepFile:true});
  assert.equal(Object.hasOwn(sent.schedule,'file'),false);await h.portal.downloadSchedule();
  assert.deepEqual(calls.find(body=>body.action==='schedulefile'),{id:'member-A',_api:'beta',action:'schedulefile',_session:'session-A'});
  assert.deepEqual(h.downloads,[{href:'blob:private-download',name:'Schedule.pdf'}]);assert.doesNotMatch(h.get('beta-sections').innerHTML,/JVBER|data:application|<iframe/);
});

test('schedule failures retain drafts, refresh respects edits, and a late save cannot revive a signed-out profile',async()=>{
  let fail=true,pending=null;const saved={...manualSchedule(),memberId:'member-A'};
  const h=harness(body=>{if(body.action==='betalogin')return identity('A');if(body.action==='schedulesave'){if(pending)return pending.promise;if(fail)throw new TypeError('Offline');}return {...workspace('A'),schedules:[saved]};});
  await h.portal.signInWithAccess(ACCESS);changeSchedule(h,'own','label','Draft work',0);await h.portal.saveSchedule();
  assert.match(h.get('beta-own-schedule-error').textContent,/Could not connect/);await h.portal.refresh();assert.equal(h.portal.scheduleDraft('own').blocks[0].label,'Draft work');
  assert.equal(h.portal.state().workspace.schedules[0].blocks[0].label,'Class');
  fail=false;pending=deferred();const save=h.portal.saveSchedule();h.events.get('beta-signout:click')();pending.resolve({...workspace('A'),schedules:[saved]});await save;
  assert.equal(h.portal.state().workspace,null);assert.equal(h.get('beta-sections').innerHTML,'');assert.equal(h.get('beta-notice').textContent,'');
});

test('a reloaded staged file can finish saving without uploading its intact attachment again',async()=>{
  const calls=[],saved={memberId:'member-A',mode:'file',timezone:'America/New_York',blocks:[],ready:false,file:{name:pdfFile.name,type:pdfFile.type,size:24}};
  const h=harness(body=>{calls.push(body);if(body.action==='betalogin')return identity('A');return {...workspace('A'),schedules:[{...saved,ready:body.action==='schedulesave'}]};});
  await h.portal.signInWithAccess(ACCESS);
  assert.match(h.get('beta-sections').innerHTML,/Try Save schedule again/);
  assert.doesNotMatch(h.get('beta-sections').innerHTML,/id="beta-schedule-download"/);
  await h.portal.saveSchedule();
  assert.equal(calls.find(body=>body.action==='schedulesave').schedule.keepFile,true);
  assert.equal(h.portal.state().workspace.schedules[0].ready,true);
  assert.match(h.get('beta-sections').innerHTML,/id="beta-schedule-download"/);
});
