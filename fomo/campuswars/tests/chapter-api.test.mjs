import test from 'node:test';
import assert from 'node:assert/strict';
import {createChapterHandler} from '../../../api/campuswars.mjs';
import {readChapterSource,chapterSourceErrorCode,parseChapterAdmin} from '../../../server/campuswars-source.mjs';

const env={CAMPUSWARS_ADMIN_PASSWORD:'test-only'};
const snapshot=joined=>({live:true,source:'Chapter registrations',updatedAt:'2026-09-13T12:00:00Z',chapters:[{id:'test-chapter',joined}]});
function response(){return {headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(raw){this.raw=raw;this.body=raw?JSON.parse(raw):undefined;return this;}};}
async function request(handler,headers={},method='GET'){const res=response();await handler({method,headers},res);return res;}

test('1,000 concurrent visitors share one source read; cache hits reuse the serialized response',async()=>{
  let calls=0,release;const hold=new Promise(resolve=>release=resolve);
  const handler=createChapterHandler({env,load:async()=>{calls++;await hold;return snapshot(10);}});
  const requests=Array.from({length:1000},()=>request(handler));
  await Promise.resolve();assert.equal(calls,1);release();
  const results=await Promise.all(requests);
  assert(results.every(r=>r.code===200&&r.raw===results[0].raw));
  assert(results.slice(1).every(r=>r.headers['X-Chapter-Cache']==='COALESCED'));
  const hit=await request(handler);assert.equal(calls,1);assert.equal(hit.headers['X-Chapter-Cache'],'HIT');
  assert.match(hit.headers['Vercel-CDN-Cache-Control'],/s-maxage=\d+, stale-while-revalidate=30/);
  assert.equal(hit.headers['Cache-Control'],'public, max-age=0, must-revalidate');
});

test('conditional reads and HEAD avoid sending the snapshot body; changed data invalidates the ETag',async()=>{
  let time=0,joined=10;
  const handler=createChapterHandler({env,now:()=>time,load:async()=>snapshot(joined)});
  const first=await request(handler),etag=first.headers.ETag;
  for(const tag of [etag,etag.replace('W/',''),`"other", ${etag}`,'*']){
    const result=await request(handler,{'if-none-match':tag});assert.equal(result.code,304);assert.equal(result.body,undefined);
  }
  const head=await request(handler,{},'HEAD');assert.equal(head.code,200);assert.equal(head.body,undefined);assert.equal(head.headers.ETag,etag);
  time=29900;assert.match((await request(handler)).headers['Vercel-CDN-Cache-Control'],/s-maxage=1,/);
  time=30000;joined=11;
  const next=await request(handler,{'if-none-match':etag});assert.equal(next.code,200);assert.notEqual(next.headers.ETag,etag);assert.equal(next.body.chapters[0].joined,11);
});

test('outages retain honest saved data, suppress retry bursts, expire old snapshots, and recover',async()=>{
  let time=0,calls=0,fail=false;
  const handler=createChapterHandler({env,now:()=>time,load:async()=>{calls++;if(fail)throw Error('PRIVATE admin secret');return snapshot(calls);}});
  const first=await request(handler);fail=true;time=30000;
  const stale=await request(handler,{'if-none-match':first.headers.ETag});
  assert.equal(stale.code,200);assert.equal(stale.body.stale,true);assert.equal(stale.body.updatedAt,first.body.updatedAt);
  assert.deepEqual(stale.body.chapters,first.body.chapters);assert.equal(stale.headers['Retry-After'],'5');
  assert.equal(stale.headers['Cache-Control'],'no-store');assert.equal(stale.headers['Vercel-CDN-Cache-Control'],'no-store');assert.equal(stale.headers.ETag,undefined);
  await Promise.all(Array.from({length:1000},()=>request(handler)));assert.equal(calls,2);
  time=35000;assert.equal((await request(handler)).headers['Retry-After'],'10');assert.equal(calls,3);
  time=300000;const expired=await request(handler);assert.equal(expired.code,502);assert.equal(expired.body.code,'SOURCE_CONNECTION');assert(!JSON.stringify(expired).includes('PRIVATE'));
  time+=Number(expired.headers['Retry-After'])*1000;fail=false;
  const recovered=await request(handler);assert.equal(recovered.code,200);assert.equal(recovered.body.stale,undefined);assert(recovered.body.chapters[0].joined>1);
  fail=true;time+=30000;assert.equal((await request(handler)).headers['Retry-After'],'5','Success resets outage backoff');
});

test('cold-instance failures back off up to one minute and never cache error responses',async()=>{
  let time=0,calls=0;
  const handler=createChapterHandler({env,now:()=>time,load:async()=>{calls++;throw Object.assign(Error('secret'),{name:'TimeoutError'});}});
  for(const delay of [5,10,20,40,60,60]){
    const result=await request(handler);assert.equal(result.code,502);assert.equal(result.body.code,'SOURCE_TIMEOUT');
    assert.equal(result.headers['Retry-After'],String(delay));assert.equal(result.headers['Vercel-CDN-Cache-Control'],'no-store');
    const before=calls;await request(handler);assert.equal(calls,before);time+=delay*1000;
  }
  const unavailable=createChapterHandler({env:{}});
  assert.equal((await request(unavailable)).code,503);assert.equal((await request(unavailable,{},'HEAD')).body,undefined);
  assert.equal((await request(unavailable,{},'POST')).headers.Allow,'GET, HEAD');
});

test('source byte limits reject misleading lengths and cancel oversized streams',async()=>{
  assert.equal(await readChapterSource(new Response('ΑΒ'),4),'ΑΒ');
  for(const headers of [{},{'content-length':'1'},{'content-length':'100'}]){
    await assert.rejects(readChapterSource(new Response('ΑΒ',{headers}),3),error=>chapterSourceErrorCode(error)==='SOURCE_SIZE');
  }
  let cancelled=false;
  const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
  await assert.rejects(readChapterSource(new Response(body),10));assert.equal(cancelled,true);
  // A code point split across network chunks is decoded only after reassembly.
  const bytes=new TextEncoder().encode('ΣΧ');
  const split=new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));controller.close();}});
  assert.equal(await readChapterSource(new Response(split),4),'ΣΧ');
});

test('a 1,000-school source preserves distinct identities and excludes private columns',()=>{
  const rows=Array.from({length:1000},(_,i)=>`<tr><td><div class="ch">Alpha Beta</div><div class="sc">School ${i} · Fraternity</div></td><td>PRIVATE NAME</td><td>PRIVATE CONTACT</td><td><span class="prog">50 / 80</span>100 actives</td><td>PRIVATE NOMINATION</td><td>Sep 13, 2026</td><td><button data-del="${i.toString(16).padStart(8,'0')}-abcd-abcd-abcd-123456789012">Delete</button></td></tr>`).join('');
  const html=`<table><tr>${['Chapter','Who','Contact','Progress','Best','Registered','Link'].map(h=>`<th>${h}</th>`).join('')}</tr>${rows}</table>`;
  const chapters=parseChapterAdmin(html);assert.equal(chapters.length,1000);assert.equal(new Set(chapters.map(c=>c.id)).size,1000);
  assert.equal(chapters.reduce((sum,c)=>sum+c.joined,0),50000);assert(!JSON.stringify(chapters).includes('PRIVATE'));
});
