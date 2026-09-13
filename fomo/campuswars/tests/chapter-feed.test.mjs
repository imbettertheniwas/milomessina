import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChapterAdmin,fetchChapterSnapshot} from '../../../server/campuswars-source.mjs';
import {startChapterFeed as startFeed,validateSnapshot} from '../chapter-feed.js';
import {createChapterHandler} from '../../../api/campuswars.mjs';
const startChapterFeed=options=>startFeed({random:()=>0,now:()=>Date.parse('2026-09-09T13:00:01Z'),...options});

const row = ({id='12345678-abcd-abcd-abcd-123456789012',name='Phi Delta Theta',school='Florida International University',joined=1,active=55}={}) => `<tr><td><div class="ch">${name}</div><div class="sc">${school} · Fraternity</div></td><td>PRIVATE NAME</td><td>private@example.com</td><td><span class="prog">${joined} / ${Math.ceil(active*.8)}</span><div class="dim">${active} actives</div></td><td>PRIVATE NOMINATION</td><td>Sep 9, 2026</td><td><input value="PRIVATE INVITE"><button data-del="${id}">Delete</button></td></tr>`;
const table = rows => `<table><thead><tr>${['Chapter','Who registered','Contact','Progress','Best / worst','Registered','Join link'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
const snapshot = joined => ({live:true,updatedAt:'2026-09-09T13:00:00Z',chapters:parseChapterAdmin(table(row({joined})))});

test('admin adapter uses full rosters and exposes only approved chapter aggregates',()=>{
  const chapters=parseChapterAdmin(table(row()));
  assert.equal(chapters.length,1);assert.equal(chapters[0].active,55);assert.equal(chapters[0].joined,1);assert.equal(chapters[0].letters,'ΦΔΘ');
  assert.deepEqual(Object.keys(chapters[0]).sort(),['id','name','letters','school','shortSchool','type','joined','active','registered','house'].sort());
  assert(!/PRIVATE|private@example|INVITE/.test(JSON.stringify(chapters)));
});
test('different schools keep distinct chapter identities and old share links survive',()=>{
  const chapters=parseChapterAdmin(table(row()+row({id:'22345678-abcd-abcd-abcd-123456789012',school:'University of Tampa'})));
  assert.equal(chapters[0].id,'phi-delta-theta-tampa');assert.notEqual(chapters[0].id,chapters[1].id);
  assert.equal(parseChapterAdmin(table(row({name:'Alpha &amp; Omega',school:'St. John&#39;s University'})))[0].school,"St. John's University");
});
test('login pages, incomplete rows, duplicate identities and invalid totals fail closed',()=>{
  for(const html of ['Authentication required','<html>Service unavailable</html>',table(row().replace('55 actives','unavailable')),table(row()+row()),table(row().replace('1 / 44','-1 / 44'))])assert.throws(()=>parseChapterAdmin(html));
  assert.deepEqual(parseChapterAdmin(table('')),[]);
});
test('server reads the fixed authenticated source without following redirects or leaking credentials',async()=>{
  const result=await fetchChapterSnapshot({password:'test-only-password',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://www.aryatoufanian.com/admin/');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert(options.headers.Authorization.startsWith('Basic '));return {ok:true,text:async()=>table(row())};
  }});
  assert.equal(result.live,true);assert.equal(result.chapters.length,1);assert(!JSON.stringify(result).includes('password'));
  await assert.rejects(fetchChapterSnapshot({password:'test-only',fetchImpl:async()=>({ok:false,status:401})}));
});
test('browser rejects malformed updates instead of replacing the last good village',()=>{
  for(const change of [{live:false},{chapters:null},{updatedAt:'invalid'},{chapters:[{...snapshot(1).chapters[0],joined:-1}]},{chapters:[...snapshot(1).chapters,...snapshot(1).chapters]}])assert.throws(()=>validateSnapshot({...snapshot(1),...change}));
});
test('refresh applies new data, skips unchanged payloads, recovers after failure and pauses hidden pages',async()=>{
  const updates=[],statuses=[],timers=new Map();let n=0,handler,calls=0,fail=false,current=snapshot(1);
  const doc={hidden:false,addEventListener:(_,fn)=>handler=fn,removeEventListener(){handler=null;}};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const feed=startChapterFeed({documentRef:doc,onUpdate:s=>updates.push(s),onStatus:s=>statuses.push(s),schedule:(fn,delay)=>{timers.set(++n,{fn,delay});return n;},cancel:id=>timers.delete(id),fetchImpl:async()=>{calls++;return {ok:!fail,json:async()=>current};}});
  await flush();assert.equal(updates.length,1);assert([...timers.values()].some(t=>t.delay===30000));
  await feed.refresh();assert.equal(updates.length,1);
  current=snapshot(15);await feed.refresh();assert.equal(updates.at(-1).chapters[0].joined,15);
  fail=true;await feed.refresh();assert.equal(updates.length,2);assert.equal(statuses.at(-1).live,false);
  fail=false;await feed.refresh();assert.equal(statuses.at(-1).live,true);
  doc.hidden=true;handler();const previous=calls;await feed.refresh();assert.equal(calls,previous);assert.equal(timers.size,0);
  doc.hidden=false;handler();await flush();assert.equal(calls,previous+1);feed.stop();assert.equal(timers.size,0);
});

test('hosted endpoint rejects writes, hides upstream failures and coalesces concurrent reads',async()=>{
  const password=process.env.CAMPUSWARS_ADMIN_PASSWORD,originalFetch=globalThis.fetch;
  let time=0;const handler=createChapterHandler({now:()=>time});
  const response=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;},end(body){this.body=body?JSON.parse(body):undefined;return this;}});
  try {
    delete process.env.CAMPUSWARS_ADMIN_PASSWORD;
    const missing=response();await handler({method:'GET'},missing);assert.equal(missing.code,503);assert.equal(missing.headers['Cache-Control'],'no-store');
    const write=response();await handler({method:'POST'},write);assert.equal(write.code,405);
    process.env.CAMPUSWARS_ADMIN_PASSWORD='test-only';
    globalThis.fetch=async()=>{throw new Error('PRIVATE secret source error');};
    const failed=response();await handler({method:'GET'},failed);assert.equal(failed.code,502);assert(!JSON.stringify(failed.body).includes('PRIVATE'));
    time=5000;
    let requests=0,release;const held=new Promise(resolve=>release=resolve);
    globalThis.fetch=async()=>{requests++;await held;return {ok:true,text:async()=>table(row())};};
    const a=response(),b=response();const pending=Promise.all([handler({method:'GET'},a),handler({method:'GET'},b)]);release();await pending;
    assert.equal(requests,1);assert.equal(a.code,200);assert.deepEqual(a.body,b.body);
    await handler({method:'GET'},response());assert.equal(requests,1);
  } finally {globalThis.fetch=originalFetch;if(password===undefined)delete process.env.CAMPUSWARS_ADMIN_PASSWORD;else process.env.CAMPUSWARS_ADMIN_PASSWORD=password;}
});


test('a saved full village survives reload during an outage, then live recovery replaces and saves it',async()=>{
  const values=new Map(),updates=[],statuses=[];let fail=false,current=snapshot(19);
  const options={storageRef:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},onUpdate:value=>updates.push(value),onStatus:value=>statuses.push(value),documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:!fail,json:async()=>current})};
  const first=startChapterFeed(options);await new Promise(resolve=>setImmediate(resolve));first.stop();
  assert.equal(values.size,1);fail=true;updates.length=0;
  const second=startChapterFeed(options);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(updates.length,1);assert.equal(updates[0].chapters[0].joined,19);assert.equal(updates[0].live,false);assert.equal(statuses.at(-1).live,false);
  current=snapshot(25);fail=false;await second.refresh();assert.equal(updates.at(-1).chapters[0].joined,25);assert.equal(statuses.at(-1).live,true);second.stop();
});
test('corrupt or inaccessible storage cannot prevent live chapter loading',async()=>{
  for(const storageRef of [{getItem:()=>'{broken',setItem(){}},{getItem(){throw Error('denied');},setItem(){throw Error('full');}}]){
    const updates=[];const feed=startChapterFeed({storageRef,onUpdate:value=>updates.push(value),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>snapshot(7)})});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(updates[0].chapters[0].joined,7);feed.stop();
  }
});
test('an older cached village cannot replace a newer bundled snapshot',async()=>{
  const updates=[];const feed=startChapterFeed({initialSnapshot:{updatedAt:'2026-09-10T00:00:00Z'},storageRef:{getItem:()=>JSON.stringify(snapshot(1))},onUpdate:value=>updates.push(value),onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:false})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(updates.length,0);feed.stop();
});


test('admin field readers accept status and layout classes added around their semantic class',()=>{
  const original=table(row({joined:44}));
  const expected=parseChapterAdmin(original);
  for(const html of [
    original.replace('class="ch"','class="ch title"').replace('class="sc"',"class='muted sc small'").replace('class="prog"','class="prog hit"'),
    original.replace('class="prog"','class="complete prog"')
  ])assert.deepEqual(parseChapterAdmin(html),expected);
  assert.throws(()=>parseChapterAdmin(original.replace('class="prog"','class="progress"')));
});

test('unchanged initial counts avoid rebuilding the village and repeated cache hits avoid storage writes',async()=>{
  const updates=[],statuses=[];let writes=0;
  const feed=startChapterFeed({initialSnapshot:snapshot(10),storageRef:{getItem(){},setItem(){writes++;}},onUpdate:s=>updates.push(s),onStatus:s=>statuses.push(s),documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async(_url,options)=>{
    assert.equal(options.cache,undefined,'Polling permits shared HTTP caching');return {ok:true,json:async()=>snapshot(10)};
  }});
  await new Promise(resolve=>setImmediate(resolve));await feed.refresh();feed.stop();
  assert.equal(updates.length,0);assert.equal(writes,1);assert.equal(statuses.at(-1).live,true);
});

test('polling backs off with jitter and Retry-After, caps delays, and resets after recovery',async()=>{
  let fail=true,retry=90,id=0;const timers=new Map();
  const feed=startChapterFeed({random:()=>.5,storageRef:null,onUpdate(){},onStatus(){},documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},cancel:id=>timers.delete(id),fetchImpl:async()=>({ok:!fail,headers:{get:()=>String(retry)},json:async()=>snapshot(1)})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal([...timers.values()][0].delay,90000);
  retry=0;await feed.refresh();assert.equal([...timers.values()][0].delay,126000);
  for(let i=0;i<8;i++)await feed.refresh();assert.equal([...timers.values()][0].delay,300000);
  fail=false;await feed.refresh();assert.equal([...timers.values()][0].delay,31500);feed.stop();
});

test('stale responses and old CDN timestamps never claim fresh data or roll counts backward',async()=>{
  const updates=[],statuses=[];let current={...snapshot(12),stale:true};
  const feed=startChapterFeed({storageRef:null,onUpdate:s=>updates.push(s),onStatus:s=>statuses.push(s),documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>current})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(updates.length,1);assert.equal(statuses.at(-1).live,false);
  current=snapshot(12);await feed.refresh();assert.equal(statuses.at(-1).live,true);assert.equal(updates.length,1);
  current={...snapshot(2),updatedAt:'2026-09-09T12:59:00Z'};await feed.refresh();assert.equal(updates.length,1);assert.equal(statuses.at(-1).live,false);feed.stop();
  const old=startChapterFeed({now:()=>Date.parse('2026-09-09T13:02:00Z'),storageRef:null,onUpdate(){},onStatus:s=>statuses.push(s),documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},schedule:()=>1,cancel(){},fetchImpl:async()=>({ok:true,json:async()=>snapshot(12)})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(statuses.at(-1).live,false);old.stop();
});

test('hiding a tab aborts an in-flight read and prevents late updates after stop',async()=>{
  let visibility,signal,release;const updates=[],statuses=[],timers=new Map();let id=0;
  const doc={hidden:false,addEventListener:(_,fn)=>visibility=fn,removeEventListener(){}};
  const feed=startChapterFeed({storageRef:null,documentRef:doc,onUpdate:s=>updates.push(s),onStatus:s=>statuses.push(s),schedule:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},cancel:id=>timers.delete(id),fetchImpl:async(_url,options)=>{
    signal=options.signal;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>snapshot(2)};
  }});
  assert([...timers.values()].some(t=>t.delay===12000));doc.hidden=true;visibility();assert.equal(signal.aborted,true);
  feed.stop();release();await new Promise(resolve=>setImmediate(resolve));assert.equal(updates.length,0);assert.equal(statuses.length,0);assert.equal(timers.size,0);
});

test('a quick hide and return refreshes immediately after the cancelled request settles',async()=>{
  let visibility,id=0;const timers=new Map(),statuses=[];
  const doc={hidden:false,addEventListener:(_,fn)=>visibility=fn,removeEventListener(){}};
  const feed=startChapterFeed({storageRef:null,documentRef:doc,onUpdate(){},onStatus:s=>statuses.push(s),schedule:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},cancel:id=>timers.delete(id),fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))});
  doc.hidden=true;visibility();doc.hidden=false;visibility();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(statuses.length,0,'An intentional cancellation is not an outage');
  assert.equal([...timers.values()][0].delay,0);feed.stop();
});
