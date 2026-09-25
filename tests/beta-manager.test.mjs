import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const managerSource = readFileSync(new URL('../invoice/beta-manager.js', import.meta.url), 'utf8');
const source = managerSource.replace(/^import[^\n]*\n/, '').replace(/load\(\);\s*$/, 'globalThis.manager = {load, change, state: () => ({data, selected, busy, loadedFor, generation})};');
const group = {id:'permanent',name:'Beta interns',active:true,startDate:'2020-01-01',endDate:'2020-01-14'};
const member = (id='a', over={}) => ({id,name:'Intern ' + id,email:id+'@example.invalid',phone:'+1 202 555 0100',github:'intern-'+id,status:'active',notes:'Private evaluation '+id,batchId:group.id,createdAt:'2026-09-25T16:00:00Z',startDate:'2026-09-25',endDate:'2026-10-08',...over});
const view = (members=[member()], over={}) => ({ok:true,manager:true,configured:true,group,batches:[group],members,attendance:[],recaps:[],...over});
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle = () => new Promise(resolve=>setImmediate(resolve));
function harness(fetchImpl, {github=async()=>[]}={}) {
  const elements=new Map(),events=new Map(),requests=[],copied=[],githubCalls=[];
  let token='operator-a',operator=true;
  const get=id=>{
    if(!elements.has(id)) elements.set(id,{id,value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},
      classList:{toggle(){}},querySelectorAll(){return [];},replaceChildren(){this.innerHTML='';this.textContent='';},
      addEventListener(type,fn){events.set(id+':'+type,fn);},focus(){},select(){},scrollIntoView(){}});
    return elements.get(id);
  };
  const document={getElementById:get,body:{dataset:{consoleView:'beta'}}};
  const window={FOMO_SHEET:{endpoint:'https://example.invalid/api',key:'test',session:()=>token,operator:()=>operator},
    addEventListener(type,fn){events.set('window:'+type,fn);}};
  const context=vm.createContext({document,window,location:{origin:'https://example.invalid'},URL,Date,Set,AbortController,AbortSignal,
    setTimeout,clearTimeout,navigator:{clipboard:{writeText:async text=>copied.push(text)}},
    FormData:class{constructor(form){return Object.entries(form.fields || {});}},
    fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);const out=await fetchImpl(body);return {ok:true,json:async()=>out};},
    loadBetaGithub:async(members,options)=>{githubCalls.push({members,options});return github(members,options);}});
  vm.runInContext(source,context,{filename:'beta-manager.js'});
  return {manager:context.manager,get,events,requests,copied,githubCalls,document,setIdentity(next,enabled=true){token=next;operator=enabled;events.get('window:fomo:identity')();}};
}
function assertPrivateCleared(h) {
  assert.equal(h.manager.state().data,null);
  for(const id of ['bt-summary','bt-roster','bt-detail','bt-code'])assert.equal(h.get(id).innerHTML,'',id+' should be cleared');
  assert.equal(h.get('bt-code').hidden,true);
  assert.equal(h.get('bt-code').dataset.invite,undefined);
}

test('manager has one permanent invite and no batch creation, selector or rotation controls',()=>{
  const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
  const beta=html.slice(html.indexOf('<section class="view" data-view="beta">'),html.indexOf('<!-- ────────── one person'));
  assert.match(beta,/id="bt-invite-link"/);assert.match(beta,/value="https:\/\/milomessina\.com\/internal\/beta"/);
  assert.match(beta,/Day 1/);assert.match(beta,/Day 14/);
  assert.doesNotMatch(beta,/id="bt-(?:batch|new-batch|create-batch)|<select|Create batch|Rotate invite/i);
  assert.doesNotMatch(managerSource,/change\(['"](?:batchadd|batchupdate|rotateinvite)['"]/);
});

test('the permanent signup link stays available after rereading an empty group',async()=>{
  const h=harness(()=>view([]));
  await h.manager.load();await h.events.get('bt-copy-invite:click')();
  await h.manager.load(true);await h.events.get('bt-copy-invite:click')();
  assert.deepEqual(h.copied,['https://example.invalid/internal/beta','https://example.invalid/internal/beta']);
  assert.deepEqual(h.requests.map(r=>r.action),['list','list']);
  assert.match(h.get('bt-roster').innerHTML,/Ready for the first arrival/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/bt-member-form/);
});

test('member details and GitHub requests use each individual period instead of old group dates',async()=>{
  const first=member('a'),second=member('b',{startDate:'2026-10-02',endDate:'2026-10-15'});
  const h=harness(()=>view([first,second]));await h.manager.load();await settle();
  const label=value=>new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  assert.ok(h.get('bt-detail').innerHTML.includes(label(first.startDate)));
  assert.ok(h.get('bt-detail').innerHTML.includes(label(first.endDate)));
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/2020/);
  const button={dataset:{member:'b'},hasAttribute:()=>false};
  await h.events.get('bt-root:click')({target:{closest:()=>button}});await settle();
  assert.ok(h.get('bt-detail').innerHTML.includes(label(second.endDate)));
  assert.equal(h.githubCalls.at(-1).members[0].id,'b');
  assert.equal(h.githubCalls.at(-1).options.startDate,second.startDate);
  assert.equal(h.githubCalls.at(-1).options.endDate,second.endDate);
});

test('missing member dates stay unavailable instead of borrowing an old group period',async()=>{
  const h=harness(()=>view([member('a',{startDate:'',endDate:''})]));
  await h.manager.load();await settle();
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/2020/);
  assert.equal(h.githubCalls.length,0);
  assert.match(h.get('bt-github').innerHTML,/dates are unavailable/i);
});

test('an expired manager refresh clears private records and a revealed return link',async()=>{
  let expired=false;const h=harness(body=>expired?{ok:false,code:'AUTH_REQUIRED',error:'Session expired'}:view(undefined,body.action==='rotatecode'?{code:'BETA-'+'a'.repeat(32)}:{}));
  await h.manager.load();await h.manager.change('rotatecode',{id:'a'},'Replaced');
  assert.match(h.get('bt-detail').innerHTML,/Private evaluation a/);assert.equal(h.get('bt-code').hidden,false);
  expired=true;await h.manager.load(true);assertPrivateCleared(h);
  assert.match(h.get('bt-message').textContent,/Session expired/i);
});

test('a rejected manager mutation clears private records instead of leaving stale editing controls',async()=>{
  const h=harness(body=>body.action==='list'?view():{ok:false,code:'FORBIDDEN',error:'Admin access changed'});
  await h.manager.load();await h.manager.change('memberupdate',{id:'a',notes:'Changed'},'Saved');
  assertPrivateCleared(h);
});

test('a participant response cannot leave the former manager private records visible',async()=>{
  let participant=false;const h=harness(()=>view(undefined,{manager:!participant}));
  await h.manager.load();participant=true;await h.manager.load(true);
  assertPrivateCleared(h);
});

test('a late read cannot restore private records after signout',async()=>{
  const pending=deferred();const h=harness(()=>pending.promise);
  const loading=h.manager.load();h.setIdentity('',false);
  pending.resolve(view());await loading;assertPrivateCleared(h);
});

test('a late link replacement cannot reveal the old identity capability after signout',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='list'?view():pending.promise);
  await h.manager.load();const changing=h.manager.change('rotatecode',{id:'a'},'Replaced');
  h.setIdentity('',false);pending.resolve(view(undefined,{code:'BETA-'+'a'.repeat(32)}));
  await changing;assertPrivateCleared(h);
});

test('a stale request cannot release the newer identity loading guard or replace its data',async()=>{
  const old=deferred(),fresh=deferred();const h=harness(body=>body._session==='operator-a'?old.promise:fresh.promise);
  const loading=h.manager.load();h.setIdentity('operator-b');assert.equal(h.manager.state().busy,true);
  old.resolve(view([member('old')]));await loading;
  assert.equal(h.manager.state().busy,true,'the new identity is still loading');
  assert.equal(h.manager.state().data,null);
  fresh.resolve(view([member('new')]));await settle();
  assert.equal(h.manager.state().busy,false);assert.equal(h.manager.state().data.members[0].id,'new');
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/Private evaluation old/);
});

test('late GitHub results cannot return private detail after identity changes',async()=>{
  const pending=deferred();const h=harness(()=>view(),{github:()=>pending.promise});
  await h.manager.load();h.setIdentity('',false);
  pending.resolve([{memberId:'a',status:'ready',total:3,startDate:'2026-09-25',endDate:'2026-10-08',commits:[],message:'Old account activity'}]);
  await settle();assertPrivateCleared(h);assert.doesNotMatch(h.get('bt-github').innerHTML,/Old account activity/);
});
