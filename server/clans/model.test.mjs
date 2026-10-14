import test from 'node:test';import assert from 'node:assert/strict';
import {scopeOf,makePlan,cleanClan,matchClan,buildSnapshot} from './model.mjs';
import {createClanHandler,signSession,validSession,validPassword} from '../../api/clans.mjs';
const now=1791936000000,id='b5708aa2-fb49-48c0-9a98-e42154b83dfa';
const chapters=[{school:'Rutgers University',name:'Phi Sigma Kappa',joined:25},{school:'Rutgers University',name:'Phi Sigma Kappa',joined:12},{school:'Small School',name:'Sigma Chi',joined:10},{school:'Rutgers University',name:'Sigma Chi',joined:1}];
const clan={id,name:'Phi Sigma Kappa Rutgers University',memberCount:25};
test('strict threshold; duplicate admin rows remain separate',()=>{const s=scopeOf(chapters);assert.equal(s.schools.length,1);assert.equal(s.schools[0].onboarded,38);assert.deepEqual(s.chapters[0].onboarded,[25,12]);assert.equal(s.chapters.length,1);});
test('known match uses current counts, valid zero is preserved',()=>{const r=matchClan(cleanClan({...clan,memberCount:0}),scopeOf(chapters));assert.equal(r.members,0);assert.equal(r.status,'Matched');assert.deepEqual(r.onboarded,[25,12]);});
test('a renamed clan requires review',()=>{assert.equal(matchClan(cleanClan({...clan,name:'Different clan'}),scopeOf(chapters)).status,'Needs review');});
test('ambiguous broad school alias does not auto match',()=>{const s=scopeOf([{school:'Ohio University',name:'Sigma Chi',joined:11},{school:'Ohio State University - Columbus',name:'Sigma Chi',joined:12}]);assert.equal(matchClan(cleanClan({...clan,id:'00000000-0000-0000-0000-000000000000',name:'Sigma Chi Ohio'}),s),null);});
test('a newly named school and chapter are matched with inference label',()=>{const r=matchClan(cleanClan({...clan,id:'00000000-0000-0000-0000-000000000001',name:'Phi Sigma Kappa Rutgers'}),scopeOf(chapters));assert.equal(r.status,'Name match');});
test('chapter below threshold remains a school-only match',()=>{const r=matchClan(cleanClan(clan),scopeOf([{school:'Rutgers University',name:'Phi Sigma Kappa',joined:10},{school:'Rutgers University',name:'Other',joined:2}]));assert.equal(r.status,'School match only');assert.equal(r.onboarded,null);});
test('invalid counts and IDs rejected instead of coerced to zero',()=>{for(const memberCount of [null,-1,'2',1.5,NaN])assert.throws(()=>cleanClan({...clan,memberCount}));assert.throws(()=>cleanClan({...clan,id:'https://evil.test'}));});
test('complete discovery reports capped queries and missing matches',()=>{const plan=makePlan(chapters);const searches=plan.queries.map(query=>({query,count:10}));const s=buildSnapshot({clans:[clan],searches,mode:'discovery',startedAt:new Date(now).toISOString()},chapters,null,now);assert.equal(s.coverage.chapterRows,2);assert.equal(s.records.length,1);assert.equal(s.coverage.cappedQueries.length,searches.length);});
test('partial discovery and partial counts cannot replace good data',()=>{const common={clans:[clan],searches:[],startedAt:new Date(now).toISOString()};assert.throws(()=>buildSnapshot({...common,mode:'discovery'},chapters,null,now),/INCOMPLETE/);assert.throws(()=>buildSnapshot({...common,mode:'counts'},chapters,null,now),/INCOMPLETE/);});
test('old uploads rejected',()=>{assert.throws(()=>buildSnapshot({mode:'counts',clans:[],searches:[],startedAt:new Date(now-1000).toISOString()},[],{startedAt:new Date(now).toISOString()},now),/OLD_UPLOAD/);});
test('session expiry, tampering and credential rotation invalidate access',()=>{const token=signSession('correct',now);assert.equal(validSession(token,'correct',now),true);assert.equal(validSession(token,'wrong',now),false);assert.equal(validSession(token+'x','correct',now),false);assert.equal(validSession(token,'correct',now+86400001),false);assert.equal(validPassword('no','correct'),false);});
function request(handler,{method='GET',url='/api/clans',body,headers={}}={}){const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.statusCode=v;return this},json(v){this.body=v;return this}};return handler({method,url,body,headers},res).then(()=>res);}
const env={CAMPUSWARS_ADMIN_PASSWORD:'test-password',BLOB_READ_WRITE_TOKEN:'test-only'};
test('public reads label audit and do not expose storage metadata',async()=>{const handler=createClanHandler({env,read:async()=>({_etag:'secret-metadata',updatedAt:null,records:[]}),now:()=>now});const r=await request(handler);assert.equal(r.body.stale,true);assert.equal(r.body._etag,undefined);});
test('writes require helper header, session token and JSON',async()=>{let writes=0;const h=createClanHandler({env,read:async()=>null,write:async()=>writes++,now:()=>now});assert.equal((await request(h,{method:'POST',body:{}})).statusCode,403);assert.equal((await request(h,{method:'POST',headers:{'x-eyes-client':'browser-helper','content-type':'application/json'},body:{}})).statusCode,401);assert.equal(writes,0);});
test('login token only issued for correct password',async()=>{const h=createClanHandler({env,now:()=>now});const args={method:'POST',url:'/api/clans?action=login',headers:{'x-eyes-client':'browser-helper','content-type':'application/json'}};assert.equal((await request(h,{...args,body:{password:'bad'}})).statusCode,401);const r=await request(h,{...args,body:{password:'test-password'}});assert.equal(validSession(r.body.token,'test-password',now),true);});
test('incomplete upload preserves stored snapshot',async()=>{let writes=0;const h=createClanHandler({env,load:async()=>chapters,read:async()=>null,write:async()=>writes++,now:()=>now});const r=await request(h,{method:'POST',headers:{'x-eyes-client':'browser-helper','content-type':'application/json',authorization:'Bearer '+signSession('test-password',now)},body:{mode:'discovery',clans:[],searches:[],startedAt:new Date(now).toISOString()}});assert.equal(r.statusCode,422);assert.equal(writes,0);});

test('discovery queries respect the live FOMO 30 character maximum',()=>{
 const plan=makePlan([{school:'Florida International University',name:'Alpha Epsilon Pi',joined:20}],null);
 assert.ok(plan.queries.includes('Florida International Universi'));
 assert.ok(plan.queries.every(q=>q.length<=30));
 assert.equal(new Set(plan.queries).size,plan.queries.length);
});

test('profit retains signed USD and real zero while missing values stay unknown',()=>{
 const clan={id:'00000000-0000-0000-0000-000000000001',name:'Example',memberCount:4};
 assert.equal(cleanClan(clan).pnl24hUsd,null);
 assert.equal(cleanClan({...clan,pnl24hUsd:0,pnlAllTimeUsd:-125.75}).pnl24hUsd,0);
 assert.equal(cleanClan({...clan,pnlAllTimeUsd:-125.75}).pnlAllTimeUsd,-125.75);
 for(const pnl24hUsd of [Infinity,NaN,'12',1e16])assert.throws(()=>cleanClan({...clan,pnl24hUsd}));
});

test('snapshot writes use the storage version read before downloading its body',async()=>{
 const {readSnapshot}=await import('../../api/clans.mjs');const order=[];
 const value=await readSnapshot({metadata:async()=>{order.push('metadata');return {etag:'storage-version'};},download:async()=>{order.push('body');return {statusCode:200,blob:{etag:'download-representation'},stream:new Response(JSON.stringify({records:[]})).body};}});
 assert.deepEqual(order,['metadata','body']);assert.equal(value._etag,'storage-version');
});

test('school-wide clans stay visible but never become chapter matches',async()=>{
 const {schoolOnly,chapterMatch,matchGroup}=await import('../../fomo/pulse/clan-status.mjs');
 const scoped=scopeOf([{school:'Purdue University',name:'Sigma Chi',joined:20}]);
 for(const id of ['6187b958-81e8-46cd-9e13-28ed6f0470a5','00000000-0000-0000-0000-000000000001']){
  const r=matchClan(cleanClan({id,name:'Purdue University',memberCount:15,pnl24hUsd:-4,pnlAllTimeUsd:12}),scoped);
  assert.equal(r.status,'School only');assert.equal(schoolOnly(r),true);assert.equal(chapterMatch(r),false);assert.equal(matchGroup(r),'school');
  assert.equal(r.members,15);assert.equal(r.pnl24hUsd,-4);assert.equal(r.pnlAllTimeUsd,12);
 }
 assert.equal(chapterMatch({chapter:'Alpha Epsilon Pi',status:'School match only'}),false);
 assert.equal(matchGroup({chapter:'Alpha Epsilon Pi',status:'School match only'}),'review');
 assert.equal(chapterMatch({chapter:'Sigma Chi',status:'Matched'}),true);
});
test('existing saved school clans are relabeled without changing the observation time or profits',async()=>{
 const record={name:'Purdue University',school:'Purdue University',chapter:'',status:'Matched',members:15,pnl24hUsd:-4,pnlAllTimeUsd:12};
 const saved={updatedAt:new Date(now-1000).toISOString(),records:[record]};
 const h=createClanHandler({env,read:async()=>saved,now:()=>now});const response=await request(h);
 assert.equal(response.body.records[0].status,'School only');assert.equal(response.body.records[0].pnlAllTimeUsd,12);
 assert.equal(response.body.updatedAt,saved.updatedAt);assert.equal(saved.records[0].status,'Matched');
});
