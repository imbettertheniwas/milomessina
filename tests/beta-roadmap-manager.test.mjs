import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildBetaScheduleOverview,betaScheduleOverviewHTML} from '../invoice/beta-schedule-overview.js';

const source=readFileSync(new URL('../invoice/beta-manager.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/load\(\);\s*$/,'globalThis.manager={load,change};');
const catalog=['portfolio','spend-portal','iterate','feature'].map((id,index)=>({id,title:['Domain & portfolio','Practice spend portal','Push an improvement','Build a feature'][index],brief:'Build and publish your work.',checklist:[{id:'publish',label:'Publish your site'},{id:'iterate',label:'Push a useful change'}]}));
const member=id=>({id,name:'Intern '+id,status:'active',github:'',startDate:'2026-09-27',endDate:'2026-10-10'});
const progress=(over={})=>({memberId:'a',challengeId:'portfolio',status:'submitted',liveUrl:'https://portfolio.example/',repoUrl:'https://github.com/intern/portfolio',checks:['publish'],iterationLinks:['https://github.com/intern/portfolio/commit/abc'],notes:'I made the home page responsive.',submittedAt:'2026-09-27T15:00:00Z',...over});
const view=(over={})=>({ok:true,manager:true,configured:true,betaRoadmap:true,members:[member('a'),member('b')],batches:[],attendance:[],recaps:[],schedules:[],challengeCatalog:catalog,challengeProgress:[progress()],roadmaps:{a:{completed:0,total:4,currentChallengeId:'portfolio',unlocks:{peerWork:false,teamReferences:false}},b:{completed:0,total:4,currentChallengeId:'portfolio',unlocks:{peerWork:false,teamReferences:false}}},challengeReferences:[],...over});
function harness(response=()=>view()) {
  const elements=new Map(),events=new Map(),requests=[];let token='manager',operator=true;
  const get=id=>{
    if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',dataset:{},hidden:false,disabled:false,classList:{toggle(){}},querySelectorAll(){return [];},replaceChildren(){this.innerHTML='';},addEventListener(name,fn){events.set(id+':'+name,fn);},scrollIntoView(){},focus(){}});
    return elements.get(id);
  };
  const window={FOMO_SHEET:{endpoint:'https://example.invalid/api',key:'test',session:()=>token,operator:()=>operator},addEventListener(name,fn){events.set('window:'+name,fn);}};
  const context=vm.createContext({document:{getElementById:get,body:{dataset:{consoleView:'beta'}}},window,location:{origin:'https://example.invalid'},URL,AbortController,AbortSignal,setTimeout,clearTimeout,buildBetaScheduleOverview,betaScheduleOverviewHTML,loadBetaGithub:async()=>[],FormData:class{constructor(form){return Object.entries(form.fields || {});}},navigator:{},fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);return {json:async()=>response(body)};}});
  vm.runInContext(source,context);
  return {get,events,requests,manager:context.manager,signout(){token='';operator=false;events.get('window:fomo:identity')();}};
}
const reviewForm=(fields={},memberId='a',challengeId='portfolio')=>({dataset:{challengeReview:challengeId,memberId},fields});
const referenceForm=fields=>({dataset:{challengeReference:'spend-portal'},fields});
const submit=(h,form,status='approved')=>h.events.get('bt-root:submit')({preventDefault(){},target:form,submitter:{dataset:{reviewStatus:status}}});
const input=(h,form)=>h.events.get('bt-root:input')({target:{closest:()=>form}});
const select=(h,id)=>h.events.get('bt-root:click')({target:{closest:()=>({dataset:{member:id},hasAttribute:()=>false})}});

test('manager roadmap exposes review evidence and progress with later challenges locked',async()=>{
  const h=harness();await h.manager.load();
  const html=h.get('bt-detail').innerHTML;
  assert.match(h.get('bt-roster').innerHTML,/0\/4 challenges complete · Review ready/);
  assert.match(html,/Waiting for review/);assert.match(html,/Reported complete/);assert.match(html,/Not checked/);
  assert.match(html,/href="https:\/\/portfolio.example\/"/);assert.match(html,/Iteration 1/);assert.match(html,/home page responsive/);
  assert.match(html,/data-challenge-review="portfolio"/);assert.doesNotMatch(html,/data-challenge-review="spend-portal"/);
  assert.match(html,/class="bt-challenge locked"/);assert.match(html,/Peer work · after challenge 1/);assert.match(html,/Team examples · after challenge 2/);
});

test('only the selected submitted challenge can be reviewed and changes need feedback',async()=>{
  let status='submitted';const h=harness(body=>{
    if(body.action==='challengereview')status=body.status;
    return view({challengeProgress:[progress({status})]});
  });await h.manager.load();
  await submit(h,reviewForm({feedback:'   '}),'changes_requested');
  assert.equal(h.requests.length,1);assert.match(h.get('bt-message').textContent,/Add feedback/);
  await submit(h,reviewForm({feedback:'Improve layout'},'b'));
  await submit(h,reviewForm({feedback:'Improve layout'},'a','spend-portal'));
  assert.equal(h.requests.length,1);
  await submit(h,reviewForm({feedback:' Ship it. '}));
  const request=h.requests.at(-1);
  assert.equal(request.action,'challengereview');assert.equal(request.memberId,'a');assert.equal(request.challengeId,'portfolio');assert.equal(request.status,'approved');assert.equal(request.feedback,'Ship it.');
  assert.match(h.get('bt-detail').innerHTML,/cannot be reopened/);assert.doesNotMatch(h.get('bt-detail').innerHTML,/data-challenge-review="portfolio"/);
  await submit(h,reviewForm({feedback:'Stale form'}),'changes_requested');assert.equal(h.requests.length,2);
});

test('review feedback survives refresh and switching interns, but not a new submission or signout',async()=>{
  let submittedAt='2026-09-27T15:00:00Z';const h=harness(()=>view({challengeProgress:[progress({submittedAt})]}));await h.manager.load();
  input(h,reviewForm({feedback:'Draft <feedback>'}));await h.manager.load(true);
  assert.match(h.get('bt-detail').innerHTML,/Draft &lt;feedback&gt;/);
  await select(h,'b');assert.doesNotMatch(h.get('bt-detail').innerHTML,/Draft &lt;feedback&gt;/);
  await select(h,'a');assert.match(h.get('bt-detail').innerHTML,/Draft &lt;feedback&gt;/);
  submittedAt='2026-09-27T16:00:00Z';await h.manager.load(true);assert.doesNotMatch(h.get('bt-detail').innerHTML,/Draft &lt;feedback&gt;/);
  input(h,reviewForm({feedback:'Private draft'}));h.signout();assert.equal(h.get('bt-detail').innerHTML,'');assert.equal(h.get('bt-schedule-overview').innerHTML,'');
});

test('reference settings are available before anyone joins, preserve drafts and send removal',async()=>{
  const h=harness(body=>view({members:[],challengeReferences:body.action==='challengereference' && body.url?[{challengeId:'spend-portal',title:body.title,url:body.url,notes:body.notes}]:[]}));await h.manager.load();
  assert.match(h.get('bt-schedule-overview').innerHTML,/Team example sites/);assert.match(h.get('bt-schedule-overview').innerHTML,/sample data only/);assert.match(h.get('bt-schedule-overview').innerHTML,/do not grant access/);
  const draft=referenceForm({title:'Practice spend',url:'https://demo.example.com',notes:'Study the iteration history.'});
  input(h,draft);await h.manager.load(true);
  assert.match(h.get('bt-schedule-overview').innerHTML,/<details open>/);assert.match(h.get('bt-schedule-overview').innerHTML,/Study the iteration history/);
  await submit(h,draft);let request=h.requests.at(-1);
  assert.equal(request.action,'challengereference');assert.equal(request.challengeId,'spend-portal');assert.equal(request.url,'https://demo.example.com');
  await submit(h,referenceForm({title:'',url:'',notes:''}));request=h.requests.at(-1);
  assert.equal(request.action,'challengereference');assert.equal(request.url,'');assert.match(h.get('bt-message').textContent,/removed/);
});

test('unsafe evidence is not linked and markup in challenge content is escaped',async()=>{
  const h=harness(()=>view({challengeProgress:[progress({liveUrl:'javascript:alert(1)',repoUrl:'https://user:secret@example.com',iterationLinks:['data:text/html,test','https://github.com/intern/commit/abc'],notes:'<script>bad()</script>',feedback:'<img src=x>'})]}));await h.manager.load();
  const html=h.get('bt-detail').innerHTML;
  assert.doesNotMatch(html,/href="javascript:|href="data:|href="https:\/\/user:|<script|<img src=x>/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);
  await submit(h,referenceForm({title:'Unsafe',url:'javascript:alert(1)'}));assert.equal(h.requests.length,1);
});

test('missing roadmap capability hides mutations and shows deployment guidance',async()=>{
  const h=harness(()=>view({betaRoadmap:undefined}));await h.manager.load();
  assert.match(h.get('bt-detail').innerHTML,/updated shared service is deployed/);
  assert.doesNotMatch(h.get('bt-detail').innerHTML,/data-challenge-review/);assert.doesNotMatch(h.get('bt-schedule-overview').innerHTML,/data-challenge-reference/);
  await submit(h,reviewForm({feedback:'Approve'}));await submit(h,referenceForm({title:'Demo',url:'https://demo.example.com'}));assert.equal(h.requests.length,1);
});

test('a late challenge approval cannot restore private manager detail after signout',async()=>{
  let resolve;const pending=new Promise(done=>resolve=done),h=harness(body=>body.action==='list'?view():pending);await h.manager.load();
  const saving=submit(h,reviewForm({feedback:'Approved'}));h.signout();resolve(view({challengeProgress:[progress({status:'approved'})]}));await saving;
  assert.equal(h.get('bt-detail').innerHTML,'');assert.equal(h.get('bt-schedule-overview').innerHTML,'');
});
