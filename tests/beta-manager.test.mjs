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
  const elements=new Map(),events=new Map(),requests=[],copied=[],githubCalls=[],objectUrls=[],revokedUrls=[];
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
  class FileURL extends URL {
    static createObjectURL(blob){const url='blob:https://example.invalid/'+(objectUrls.length+1);objectUrls.push({url,blob});return url;}
    static revokeObjectURL(url){revokedUrls.push(url);}
  }
  const context=vm.createContext({document,window,location:{origin:'https://example.invalid'},URL:FileURL,Blob,atob,Uint8Array,Date,Set,AbortController,AbortSignal,
    setTimeout,clearTimeout,navigator:{clipboard:{writeText:async text=>copied.push(text)}},
    FormData:class{constructor(form){return Object.entries(form.fields || {});}},
    fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);const out=await fetchImpl(body);return {ok:true,json:async()=>out};},
    loadBetaGithub:async(members,options)=>{githubCalls.push({members,options});return github(members,options);}});
  vm.runInContext(source,context,{filename:'beta-manager.js'});
  return {manager:context.manager,get,events,requests,copied,githubCalls,objectUrls,revokedUrls,document,setIdentity(next,enabled=true){token=next;operator=enabled;events.get('window:fomo:identity')();}};
}
function assertPrivateCleared(h) {
  assert.equal(h.manager.state().data,null);
  for(const id of ['bt-summary','bt-roster','bt-detail','bt-code'])assert.equal(h.get(id).innerHTML,'',id+' should be cleared');
  assert.equal(h.get('bt-code').hidden,true);
  assert.equal(h.get('bt-code').dataset.invite,undefined);
}
const button=attributes=>({dataset:Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_all,c)=>c.toUpperCase()),value])),hasAttribute:key=>key in attributes});
const click=(h,b)=>h.events.get('bt-root:click')({target:{closest:()=>b}});

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

test('delete confirmation names the intern and cancel preserves unsaved form content without a write',async()=>{
  const h=harness(()=>view([member('a',{name:'Alex <One>'})]));await h.manager.load();
  h.get('bt-member-form').fields={name:'Unsaved name',notes:'Unsaved private notes'};
  const initialDetails=h.get('bt-detail').innerHTML;
  await click(h,button({'data-delete-member':'a'}));
  const confirmation=h.get('bt-delete-controls').innerHTML;
  assert.match(confirmation,/Delete Alex &lt;One&gt;\?/);
  assert.match(confirmation,/profile, attendance, recap and private notes will be permanently removed/);
  assert.match(confirmation,/private schedule and its uploaded file will also be removed/);
  assert.match(confirmation,/personal return link and Beta access will be closed/);
  assert.match(confirmation,/data-confirm-delete="a"/);assert.match(confirmation,/cannot be undone/);
  await click(h,button({'data-cancel-delete':''}));
  assert.doesNotMatch(h.get('bt-delete-controls').innerHTML,/data-confirm-delete/);
  assert.equal(h.get('bt-detail').innerHTML,initialDetails,'opening/cancelling does not rebuild the editing form');
  assert.equal(h.get('bt-member-form').fields.notes,'Unsaved private notes');
  assert.deepEqual(h.requests.map(request=>request.action),['list']);
});

test('switching or filtering the selected intern invalidates an earlier delete confirmation',async()=>{
  const h=harness(()=>view([member('a'),member('b')]));await h.manager.load();
  await click(h,button({'data-delete-member':'a'}));const stale=button({'data-confirm-delete':'a'});
  await click(h,button({'data-member':'b'}));await click(h,stale);
  assert.equal(h.manager.state().selected,'b');assert.equal(h.requests.length,1);
  await click(h,button({'data-delete-member':'b'}));const second=button({'data-confirm-delete':'b'});
  h.get('bt-search').value='Intern a';h.events.get('bt-search:input')();await click(h,second);
  assert.equal(h.manager.state().selected,'a');assert.equal(h.requests.length,1);
});

test('confirmed delete uses the captured id, clears visible return links, and updates counts and selection',async()=>{
  let removed=false;const first=member('a'),second=member('b');
  const h=harness(body=>{
    if(body.action==='memberdelete'){assert.equal(body.id,'a');removed=true;}
    return view(removed?[second]:[first,second],{
      attendance:removed?[]:[{memberId:'a',day:'2026-09-25'}],recaps:removed?[]:[{memberId:'a',submittedAt:'2026-09-25T16:00:00Z'}],
      ...(body.action==='rotatecode'?{code:'BETA-'+'a'.repeat(32)}:{})});
  });
  await h.manager.load();await h.manager.change('rotatecode',{id:'a'},'Replaced');
  assert.equal(h.get('bt-code').hidden,false);
  await click(h,button({'data-delete-member':'a'}));await click(h,button({'data-confirm-delete':'a'}));
  assert.deepEqual(h.requests.filter(request=>request.action==='memberdelete').map(request=>request.id),['a']);
  assert.equal(h.manager.state().selected,'b');assert.deepEqual(h.manager.state().data.members.map(m=>m.id),['b']);
  assert.match(h.get('bt-summary').innerHTML,/Beta interns<\/span><strong>1/);
  assert.match(h.get('bt-summary').innerHTML,/Days attended<\/span><strong>0/);
  assert.match(h.get('bt-summary').innerHTML,/Recaps submitted<\/span><strong>0/);
  assert.equal(h.get('bt-code').hidden,true);assert.equal(h.get('bt-code').innerHTML,'');assert.equal(h.get('bt-code').dataset.invite,undefined);
  assert.match(h.get('bt-message').textContent,/Intern a was deleted/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/Private evaluation a/);
});

test('deleting the final intern leaves the permanent signup link and a clean empty state',async()=>{
  const h=harness(body=>view(body.action==='memberdelete'?[]:undefined));await h.manager.load();
  await click(h,button({'data-delete-member':'a'}));await click(h,button({'data-confirm-delete':'a'}));
  assert.equal(h.manager.state().selected,'');assert.match(h.get('bt-roster').innerHTML,/Ready for the first arrival/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/bt-member-form|data-delete-member/);
  assert.equal(h.get('bt-invite-link').value,'https://example.invalid/internal/beta');
});

test('a failed deletion keeps its confirmation and a repeated click cannot duplicate an in-flight deletion',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='list'?view():pending.promise);await h.manager.load();
  await click(h,button({'data-delete-member':'a'}));const confirm=button({'data-confirm-delete':'a'});
  const deleting=click(h,confirm);await click(h,confirm);
  assert.equal(h.requests.filter(request=>request.action==='memberdelete').length,1);
  pending.resolve({ok:false,code:'INVALID',error:'Could not delete this intern. Try again.'});await deleting;
  assert.equal(h.manager.state().data.members[0].id,'a');assert.equal(h.manager.state().busy,false);
  assert.match(h.get('bt-delete-controls').innerHTML,/data-confirm-delete="a"/);
  assert.match(h.get('bt-message').textContent,/Could not delete/);
});

test('a late delete response cannot restore private data after an identity change',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='list'?view([member('a'),member('b')]):pending.promise);await h.manager.load();
  await click(h,button({'data-delete-member':'a'}));const deleting=click(h,button({'data-confirm-delete':'a'}));
  h.setIdentity('',false);pending.resolve(view([member('b')]));await deleting;
  assertPrivateCleared(h);
});

test('an explicit unsupported-delete feature flag hides the control',async()=>{
  const h=harness(()=>view(undefined,{betaDelete:false}));await h.manager.load();
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/data-delete-member/);
});

test('an optional portfolio domain is submitted with the profile and safely linked after normalization',async()=>{
  const h=harness(body=>view([member('a',{website:body.action==='memberupdate'?'https://portfolio.example/':'https://portfolio.example/work'})]));
  await h.manager.load();
  assert.match(h.get('bt-detail').innerHTML,/name="website" type="text" inputmode="url"/);
  assert.match(h.get('bt-detail').innerHTML,/href="https:\/\/portfolio\.example\/work"/);
  await h.events.get('bt-root:submit')({preventDefault(){},target:{id:'bt-member-form',fields:{website:'portfolio.example',name:'Intern a'}}});
  await settle();
  const update=h.requests.find(request=>request.action==='memberupdate');assert.equal(update.id,'a');assert.equal(update.website,'portfolio.example');
  assert.match(h.get('bt-detail').innerHTML,/href="https:\/\/portfolio\.example\/"/);
});

test('unsafe portfolio protocols and embedded credentials are never rendered as clickable links',async()=>{
  for(const website of ['javascript:alert(1)','https://user:secret@example.invalid/','data:text/html,test']) {
    const h=harness(()=>view([member('a',{website})]));await h.manager.load();
    assert.doesNotMatch(h.get('bt-detail').innerHTML,/class="bt-portfolio"/);
  }
});

const schedule=(id='a',over={})=>({memberId:id,mode:'manual',timezone:'America/New_York',blocks:[{day:1,start:'09:00',end:'11:30',label:'Class <A>'}],noCommitments:false,file:null,ready:true,updatedAt:'2026-09-25T16:00:00Z',...over});
const scheduleFile=(type='application/pdf',over={})=>{
  const bytes=Buffer.from(type==='text/calendar'?'BEGIN:VCALENDAR\nEND:VCALENDAR':'%PDF-1.7\n');
  return {name:type==='text/calendar'?'classes.ics':'classes.pdf',type,size:bytes.length,data:bytes.toString('base64'),...over};
};
const fileSchedule=(id='a',over={})=>{const {data:_bytes,...file}=scheduleFile();return schedule(id,{mode:'file',blocks:[],file,...over});};

test('private manual schedules show only the selected intern with day, times, label and timezone',async()=>{
  const h=harness(()=>view([member('a'),member('b')],{schedules:[schedule(),schedule('b',{blocks:[{day:4,start:'13:00',end:'14:00',label:'Other private class'}]})]}));
  await h.manager.load();
  assert.match(h.get('bt-detail').innerHTML,/Private schedule/);assert.match(h.get('bt-detail').innerHTML,/Only this intern, Arya and Milo/);
  assert.match(h.get('bt-detail').innerHTML,/Monday/);assert.match(h.get('bt-detail').innerHTML,/9:00 AM – 11:30 AM/);
  assert.match(h.get('bt-detail').innerHTML,/Class &lt;A&gt;/);assert.match(h.get('bt-detail').innerHTML,/America\/New_York/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/Other private class/);
  await click(h,button({'data-member':'b'}));
  assert.match(h.get('bt-detail').innerHTML,/Other private class/);assert.doesNotMatch(h.get('bt-detail').innerHTML,/Class &lt;A&gt;/);
});

test('a declared empty schedule differs from no schedule and an unfinished upload cannot be opened',async()=>{
  const h=harness(()=>view([member('a'),member('b'),member('c')],{schedules:[schedule('a',{noCommitments:true,blocks:[]}),fileSchedule('c',{ready:false})]}));
  await h.manager.load();assert.match(h.get('bt-detail').innerHTML,/No recurring commitments/);
  await click(h,button({'data-member':'b'}));assert.match(h.get('bt-detail').innerHTML,/No schedule provided yet/);
  await click(h,button({'data-member':'c'}));assert.match(h.get('bt-detail').innerHTML,/has not finished saving/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/data-schedule-file/);
  await click(h,button({'data-schedule-file':'c'}));assert.deepEqual(h.requests.map(request=>request.action),['list']);
});

test('authenticated schedule file reads produce private object URLs without replacing manager data',async()=>{
  const h=harness(body=>body.action==='schedulefile'?{ok:true,file:scheduleFile()}:view(undefined,{schedules:[fileSchedule()]}));
  await h.manager.load();const before=h.manager.state().data;
  assert.match(h.get('bt-detail').innerHTML,/classes.pdf/);assert.match(h.get('bt-detail').innerHTML,/PDF · 1 KB/);
  await click(h,button({'data-schedule-file':'a'}));
  const request=h.requests.at(-1);assert.equal(request.action,'schedulefile');assert.equal(request.id,'a');assert.equal(request._session,'operator-a');
  assert.equal(h.manager.state().data,before);assert.equal(h.manager.state().selected,'a');
  assert.equal(h.objectUrls.length,1);assert.equal(h.objectUrls[0].blob.type,'application/pdf');
  assert.equal(h.objectUrls[0].blob.size,scheduleFile().size);
  assert.match(h.get('bt-schedule-preview').innerHTML,/href="blob:https:\/\/example.invalid\/1"/);
  assert.match(h.get('bt-schedule-preview').innerHTML,/download="classes.pdf"/);assert.match(h.get('bt-schedule-preview').innerHTML,/Open PDF/);
  assert.doesNotMatch(h.get('bt-schedule-preview').innerHTML,/drive.google|data:application|base64/);
});

test('calendar files are downloadable without being opened as webpage content',async()=>{
  const file=scheduleFile('text/calendar');const h=harness(body=>body.action==='schedulefile'?{ok:true,file}:view(undefined,{schedules:[fileSchedule('a',{file})]}));
  await h.manager.load();await click(h,button({'data-schedule-file':'a'}));
  assert.match(h.get('bt-schedule-preview').innerHTML,/Download calendar file/);
  assert.doesNotMatch(h.get('bt-schedule-preview').innerHTML,/<img|<iframe|target="_blank"/);
});

test('images use a local preview and object URLs are revoked on selection changes and signout',async()=>{
  const file=scheduleFile('image/png',{name:'schedule.png'});
  const h=harness(body=>body.action==='schedulefile'?{ok:true,file}:view([member('a'),member('b')],{schedules:[fileSchedule('a'),fileSchedule('b')]}));
  await h.manager.load();await click(h,button({'data-schedule-file':'a'}));
  assert.match(h.get('bt-schedule-preview').innerHTML,/<img[^>]+src="blob:/);
  await click(h,button({'data-member':'b'}));
  assert.deepEqual(h.revokedUrls,['blob:https://example.invalid/1']);assert.equal(h.get('bt-schedule-preview').innerHTML,'');
  await click(h,button({'data-schedule-file':'b'}));h.setIdentity('',false);
  assert.deepEqual(h.revokedUrls,['blob:https://example.invalid/1','blob:https://example.invalid/2']);assertPrivateCleared(h);
});

test('a late file response cannot show or download a former selected intern’s schedule',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='schedulefile'?pending.promise:view([member('a'),member('b')],{schedules:[fileSchedule('a'),fileSchedule('b')]}));
  await h.manager.load();const loading=click(h,button({'data-schedule-file':'a'}));
  await click(h,button({'data-member':'b'}));pending.resolve({ok:true,file:scheduleFile()});await loading;
  assert.equal(h.objectUrls.length,0);assert.equal(h.manager.state().selected,'b');assert.equal(h.get('bt-schedule-preview').innerHTML,'');
});

test('logout while a private file is loading discards the response before making any downloadable URL',async()=>{
  const pending=deferred();const h=harness(body=>body.action==='schedulefile'?pending.promise:view(undefined,{schedules:[fileSchedule()]}));
  await h.manager.load();const loading=click(h,button({'data-schedule-file':'a'}));
  h.setIdentity('',false);pending.resolve({ok:true,file:scheduleFile()});await loading;
  assert.equal(h.objectUrls.length,0);assert.equal(h.get('bt-schedule-preview').innerHTML,'');assertPrivateCleared(h);
});

test('unauthorized file access clears private manager data and malformed files never become download links',async()=>{
  const denied=harness(body=>body.action==='schedulefile'?{ok:false,code:'AUTH_REQUIRED',error:'Session expired'}:view(undefined,{schedules:[fileSchedule()]}));
  await denied.manager.load();await click(denied,button({'data-schedule-file':'a'}));assertPrivateCleared(denied);
  for(const file of [scheduleFile('text/html'),scheduleFile('toString'),scheduleFile('application/pdf',{size:200}),scheduleFile('application/pdf',{data:'<invalid>'}),scheduleFile('application/pdf',{data:'A'.repeat(4*Math.ceil((2*1024*1024)/3)+4)})]) {
    const h=harness(body=>body.action==='schedulefile'?{ok:true,file}:view(undefined,{schedules:[fileSchedule()]}));
    await h.manager.load();await click(h,button({'data-schedule-file':'a'}));
    assert.equal(h.objectUrls.length,0);assert.doesNotMatch(h.get('bt-schedule-preview').innerHTML,/<a /);
    assert.equal(h.manager.state().data.members[0].id,'a');
  }
});
