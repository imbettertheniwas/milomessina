import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {database} from '../db.mjs';
import {application} from '../app.mjs';
import {newSession} from '../security.mjs';
import {normalizeRows,readAvailability,calendarURL,laDate,FRESH_MS} from '../availability.mjs';
import {storeSnapshot,deliverNotifications} from '../worker.mjs';
import {syncTransaction} from '../billing.mjs';

async function fixture(t,options={}){
 const db=await database({production:false,url:null});
 const people=[];for(const name of ['Host','Guest','Another','Outsider']){const id=randomUUID();await db.query('INSERT INTO users(id,apple_sub,name,terms_version,created_at) VALUES($1,$2,$3,$4,$5)',[id,id,name,'2026-10-22',Date.now()]);people.push({id,token:await newSession(db.query,id)});}
 const env={LIVE_SOURCES:'balboa',...options.env};const handler=application(db,{env,revoke:async()=>{},...options,env});
 t.after(async()=>{await db.close();});
 // Exercise the actual HTTP handler and streamed JSON body without a listening port.
 const call=async(path,who,method='GET',body)=>{
   const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
   Object.assign(req,{url:`/v1${path}`,method,headers:{'content-type':'application/json',...(who?{authorization:`Bearer ${who.token}`}:{})},socket:{remoteAddress:'127.0.0.1'}});
   let status=200,payload;const res={setHeader(){},writeHead(value){status=value;},end(value){payload=value;}};
   await handler(req,res);return {status,body:JSON.parse(payload)};
 };
 const request={courtID:'balboa',start:Date.now()+86400000,end:Date.now()+90000000,minLevel:3,maxLevel:4,format:'Singles',courtBooked:false,note:'A relaxed hour of tennis.'};
 let httpCall;
 if(process.env.TEST_HTTP==='true') {
   const server=createServer(handler);
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   t.after(()=>new Promise(resolve=>server.close(resolve)));
   httpCall=async(path,who,method='GET',body)=>{
     const response=await fetch(`http://127.0.0.1:${server.address().port}/v1${path}`,{method,headers:{'content-type':'application/json',...(who?{authorization:`Bearer ${who.token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
     return {status:response.status,body:await response.json()};
   };
 }
 return {db,people,call:httpCall||call,request};
}
test('anonymous browsing has no fabricated inventory; private data requires login',async t=>{const {call}=await fixture(t);assert.equal((await call('/courts')).body.length,14);const a=await call(`/availability?courtID=balboa&date=${laDate()}`);assert.equal(a.body.state,'unavailable');assert.deepEqual(a.body.slots,[]);assert.equal((await call('/conversations')).status,401);assert.equal((await call('/config')).body.salesEnabled,false);});
test('requests validate windows and matching respects level/time; duplicate interests are safe',async t=>{const {call,people:[host,guest],request}=await fixture(t);assert.equal((await call('/requests',host,'POST',{...request,end:request.start})).status,400);const {body:{id}}=await call('/requests',host,'POST',request);assert.equal((await call(`/requests/${id}/interest`,host,'POST')).status,400);assert.equal((await call(`/requests/${id}/interest`,guest,'POST')).status,200);await call(`/requests/${id}/interest`,guest,'POST');assert.equal((await call(`/requests/${id}`,host)).body.interests.length,1);assert.equal((await call(`/requests?level=5`,guest)).body.length,0);assert.equal((await call('/requests?level=3.5',guest)).body.length,1);assert.equal((await call(`/requests/${id}/accept`,guest,'POST',{userID:host.id})).status,403);});
test('simultaneous accepts create exactly one conversation; messages isolate members and deduplicate retries',async t=>{const {call,people:[host,guest,other,outsider],request,db}=await fixture(t);const id=(await call('/requests',host,'POST',request)).body.id;for(const p of [guest,other])await call(`/requests/${id}/interest`,p,'POST');const results=await Promise.all([guest,other].map(p=>call(`/requests/${id}/accept`,host,'POST',{userID:p.id})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const cid=results.find(r=>r.status===200).body.id;assert.equal((await db.query('SELECT id FROM conversations')).length,1);assert.equal((await call(`/conversations/${cid}/messages`,outsider)).status,404);const mid=randomUUID();const msg={id:mid,body:'See you at the court!'};assert.equal((await call(`/conversations/${cid}/messages`,host,'POST',msg)).status,200);assert.equal((await call(`/conversations/${cid}/messages`,host,'POST',msg)).status,200);assert.equal((await call(`/conversations/${cid}/messages`,host,'POST',{...msg,body:'Changed'})).status,409);assert.equal((await call(`/conversations/${cid}/messages`,host)).body.length,1);assert.equal((await call(`/conversations/${cid}/messages`,host,'POST',{id:randomUUID(),body:' '})).status,400);});
test('blocking closes chat both ways; reports are scoped; deletion cascades',async t=>{const {call,people:[host,guest,,outsider],request,db}=await fixture(t);const id=(await call('/requests',host,'POST',request)).body.id;await call(`/requests/${id}/interest`,guest,'POST');const cid=(await call(`/requests/${id}/accept`,host,'POST',{userID:guest.id})).body.id;const mid=randomUUID();await call(`/conversations/${cid}/messages`,host,'POST',{id:mid,body:'Ready to play'});assert.equal((await call('/reports',outsider,'POST',{userID:host.id,messageID:mid,reason:'Test unauthorized report'})).status,404);assert.equal((await call('/reports',guest,'POST',{userID:host.id,messageID:mid,reason:'Test report for moderation'})).status,200);await call('/blocks',guest,'POST',{userID:host.id});assert.equal((await call(`/conversations/${cid}/messages`,host)).status,403);assert.deepEqual((await call('/conversations',guest)).body,[]);assert.equal((await call('/me',host,'DELETE')).status,200);assert.equal((await db.query('SELECT id FROM messages')).length,0);assert.equal((await db.query('SELECT subject_id FROM reports'))[0].subject_id,null);assert.equal((await call('/me',host)).status,401);});
test('availability parser excludes pro/pickleball, rejects resource mismatch and strips booking tokens',()=>{const day='12/15/2026',date='2026-12-15',slot={resourceID:'12',day,endDay:day,start:36000,end:39600};const row={name:'Balboa Tennis Court 1',location:'Balboa Pay Tennis',sport:'Tennis Court',resourceID:'12',slots:[slot]};const result=normalizeRows([row,{...row,name:'Balboa Pro Court 5'},{...row,sport:'Pickleball Court'}],'balboa',date,0);assert.equal(result.length,1);assert.equal(result[0].end-result[0].start,3600000);assert.ok(!result[0].bookingURL.includes('_csrf'));assert.throws(()=>normalizeRows([{...row,slots:[{...slot,resourceID:'13'}]}],'balboa',date,0));assert.throws(()=>normalizeRows([],'balboa',date));});
test('freshness, baselines, re-openings and recovery produce only valid deduplicated alerts',async t=>{const {db,people:[user],call}=await fixture(t);const date=laDate(new Date(Date.now()+86400000)),now=Date.now(),start=now+86400000;await syncTransaction(db.query,{appAccountToken:user.id,originalTransactionId:'test-1',productId:'com.courtside.plus.monthly',expiresDate:now+86400000,signedDate:now},user.id);await db.query('INSERT INTO watches(id,user_id,court_id,start_at,end_at,duration,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',['watch',user.id,'balboa',start,start+7200000,60,now]);const snapshot={checkedAt:now,sourceURL:calendarURL('balboa',date),slots:[]};await storeSnapshot(db,'balboa',date,snapshot);assert.equal((await db.query('SELECT id FROM alert_events')).length,0);const slot={id:'slot',courtID:'balboa',resourceID:'1',resourceName:'Court 1',start,end:start+3600000,checkedAt:now,bookingURL:snapshot.sourceURL};await storeSnapshot(db,'balboa',date,{...snapshot,slots:[slot]});await storeSnapshot(db,'balboa',date,{...snapshot,slots:[slot]});assert.equal((await db.query('SELECT id FROM alert_events')).length,1);const stale=await readAvailability(db.query,'balboa',date,now+FRESH_MS+1);assert.equal(stale.state,'stale');assert.deepEqual(stale.slots,[]);await storeSnapshot(db,'balboa',date,{...snapshot,checkedAt:now+FRESH_MS+2,slots:[{...slot,id:'recovery'}]});assert.equal((await db.query('SELECT id FROM alert_events')).length,1);assert.equal((await call('/config')).body.salesEnabled,false);});
test('billing rejects cross-account purchases and old signed transactions cannot restore refunded access',async t=>{const {db,people:[user,other]}=await fixture(t);const tx={appAccountToken:user.id,originalTransactionId:'one',productId:'com.courtside.plus.monthly',expiresDate:Date.now()+86400000,signedDate:10};await assert.rejects(syncTransaction(db.query,tx,other.id));await syncTransaction(db.query,tx,user.id);await syncTransaction(db.query,{...tx,revocationDate:Date.now(),signedDate:20},user.id);await syncTransaction(db.query,tx,user.id);assert.equal((await db.query('SELECT revoked FROM entitlements'))[0].revoked,1);});
test('push outbox retries server failures and removes only invalid tokens',async t=>{const {db,people:[user]}=await fixture(t);const now=Date.now(),token='a'.repeat(64);await db.query('INSERT INTO devices(token,user_id,environment,enabled,quiet_hours,updated_at) VALUES($1,$2,$3,1,0,$4)',[token,user.id,'sandbox',now]);await db.query('INSERT INTO alert_events(id,user_id,kind,ref_id,title,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',['event',user.id,'request','request','Update','Test only',now]);await db.query('INSERT INTO deliveries(event_id,token,next_at) VALUES($1,$2,$3)',['event',token,now-1]);await deliverNotifications(db,{send:async()=>({status:400,reason:'BadPriority'})});assert.equal((await db.query('SELECT token FROM devices')).length,1);assert.equal((await db.query('SELECT attempts FROM deliveries'))[0].attempts,1);await db.query('UPDATE deliveries SET next_at=0');await deliverNotifications(db,{send:async()=>200});assert.equal((await db.query('SELECT state FROM deliveries'))[0].state,'sent');});

test('a reassigned device never receives the previous account’s queued notification',async t=>{
 const {db,people:[first,second]}=await fixture(t);const token='b'.repeat(64),now=Date.now();
 await db.query('INSERT INTO devices(token,user_id,environment,enabled,quiet_hours,updated_at) VALUES($1,$2,$3,1,0,$4)',[token,first.id,'sandbox',now]);
 await db.query('INSERT INTO alert_events(id,user_id,kind,ref_id,title,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',['private-event',first.id,'request','request','Private update','Only for the original account',now]);
 await db.query('INSERT INTO deliveries(event_id,token,next_at) VALUES($1,$2,$3)',['private-event',token,now-1]);
 await db.query('UPDATE devices SET user_id=$1 WHERE token=$2',[second.id,token]);
 let sent=0;await deliverNotifications(db,{send:async()=>{sent++;return 200;}});assert.equal(sent,0);
});

test('adjacent observed slots combine only on the same resource with no gaps',()=>{
 const day='12/15/2026',date='2026-12-15';
 const row={name:'Court 1',location:'Balboa Pay Tennis',sport:'Tennis Court',resourceID:'12',slots:[36000,39600,46800].map(start=>({resourceID:'12',day,endDay:day,start,end:start+3600}))};
 const slots=normalizeRows([row],'balboa',date,0);
 assert.equal(slots.filter(s=>s.end-s.start===7200000).length,1);
 assert.ok(slots.every(s=>s.end-s.start<=7200000));
 assert.equal(slots.length,4);
});

test('sandbox verification retries only environment mismatch, not a bad signature',async()=>{
 const {verifyStorePayload}=await import('../billing.mjs');const {VerificationStatus}=await import('@apple/app-store-server-library');
 const calls=[];const factory=async environment=>({verifyAndDecodeTransaction:async()=>{calls.push(environment);if(environment==='Production')throw {status:VerificationStatus.INVALID_ENVIRONMENT};return {environment};}});
 assert.equal((await verifyStorePayload('signed','verifyAndDecodeTransaction',{},factory)).environment,'Sandbox');
 assert.deepEqual(calls,['Production','Sandbox']);
 let attempts=0;await assert.rejects(verifyStorePayload('invalid','verifyAndDecodeTransaction',{},async()=>({verifyAndDecodeTransaction:async()=>{attempts++;throw Error('Invalid signature');}})));
 assert.equal(attempts,1);
});

test('sandbox transactions cannot overwrite a production entitlement',async t=>{
 const {db,people:[user]}=await fixture(t);const tx={appAccountToken:user.id,originalTransactionId:'paid',productId:'com.courtside.plus.monthly',expiresDate:Date.now()+86400000,signedDate:10,environment:'Production'};
 await syncTransaction(db.query,tx,user.id);await syncTransaction(db.query,{...tx,originalTransactionId:'test',environment:'Sandbox',signedDate:20,revocationDate:Date.now()},user.id);
 assert.equal((await db.query('SELECT original_id FROM entitlements'))[0].original_id,'paid');
});

test('friend discovery is opt-in; requests require recipient acceptance; blocking removes the relationship',async t=>{
 const {call,people:[a,b,c]}=await fixture(t);
 assert.equal((await call('/players?q=Guest',a)).body.length,0);
 assert.equal((await call('/player-profile',b,'PUT',{bio:'Evening rallies',utr:4.2,discoverable:true})).status,200);
 assert.equal((await call('/players?q=Guest',a)).body.length,1);
 assert.equal((await call('/friends',a,'POST',{userID:b.id})).status,200);
 await call('/friends',a,'POST',{userID:b.id});
 assert.equal((await call('/friends',b)).body.length,1);
 assert.equal((await call(`/friends/${b.id}`,a,'PATCH',{accept:true})).status,409);
 assert.equal((await call(`/friends/${a.id}`,b,'PATCH',{accept:true})).status,200);
 assert.equal((await call('/friends',a)).body[0].status,'accepted');
 assert.equal((await call('/friends',c)).body.length,0);
 await call('/blocks',b,'POST',{userID:a.id});
 assert.equal((await call('/friends',a)).body.length,0);
 assert.equal((await call('/players?q=Guest',a)).body.length,0);
 assert.equal((await call('/friends',a,'POST',{userID:b.id})).status,404);
});
test('journal retries are idempotent, private and validate real past sessions',async t=>{
 const {call,people:[a,b]}=await fixture(t);
 const entry={id:randomUUID(),courtID:'westwood',playedAt:Date.now()-86400000,minutes:60,format:'Rally',result:'Not scored',note:'Worked on backhands.'};
 assert.equal((await call('/journal',a,'POST',{...entry,playedAt:Date.now()+86400000})).status,400);
 assert.equal((await call('/journal',a,'POST',{...entry,opponentID:b.id})).status,400);
 assert.equal((await call('/journal',a,'POST',entry)).status,200);
 assert.equal((await call('/journal',a,'POST',entry)).status,200);
 assert.equal((await call('/journal',a,'POST',{...entry,minutes:90})).status,409);
 assert.equal((await call('/journal',a)).body.length,1);
 assert.equal((await call('/journal',b)).body.length,0);
 await call(`/journal/${entry.id}`,b,'DELETE');
 assert.equal((await call('/journal',a)).body.length,1);
 assert.equal((await call('/insights',a)).status,402);
 await call(`/journal/${entry.id}`,a,'DELETE');
 assert.equal((await call('/journal',a)).body.length,0);
});
test('self-reported rating history is private and account deletion removes all social data',async t=>{
 const {call,db,people:[a,b]}=await fixture(t);
 assert.equal((await call('/player-profile',a,'PUT',{bio:'',utr:20,discoverable:false})).status,400);
 await call('/player-profile',a,'PUT',{bio:'',utr:4.25,discoverable:false});
 await call('/player-profile',a,'PUT',{bio:'',utr:4.25,discoverable:false});
 assert.equal((await call('/ratings',a)).body.length,1);
 assert.equal((await call('/ratings',b)).body.length,0);
 await call('/me',a,'DELETE');
 assert.equal((await db.query('SELECT * FROM player_details WHERE user_id=$1',[a.id])).length,0);
 assert.equal((await db.query('SELECT * FROM rating_entries WHERE user_id=$1',[a.id])).length,0);
});

async function grantPlus(db,user){await syncTransaction(db.query,{appAccountToken:user.id,originalTransactionId:randomUUID(),productId:'com.courtside.plus.monthly',expiresDate:Date.now()+86400000,signedDate:Date.now()},user.id);}
test('usernames are case-insensitive, uniquely claimed, immutable and searchable only with consent',async t=>{
 const {call,people:[a,b]}=await fixture(t);
 const results=await Promise.all([a,b].map(p=>call('/identity',p,'PUT',{username:'Court_Ace',theme:'forest'})));
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);const winner=results[0].status===200?a:b,other=winner===a?b:a;
 assert.equal((await call('/identity',winner)).body.username,'court_ace');
 assert.equal((await call('/identity',winner,'PUT',{username:'different',theme:'clay'})).status,409);
 assert.equal((await call('/identity',other,'PUT',{username:'admin',theme:'forest'})).status,400);
 assert.deepEqual((await call('/players?q=@court_ace',other)).body,[]);
 await call('/player-profile',winner,'PUT',{bio:'',utr:6.25,discoverable:true});
 assert.equal((await call('/players?q=@court_ace',other)).body[0].username,'court_ace');
 assert.deepEqual((await call('/players?q=__',other)).body,[]);
 assert.equal((await call('/player-profile',winner)).body.username,'court_ace');
});
test('global events gate hosting, enforce capacity under concurrent joins and notify cancellation',async t=>{
 const {call,db,people:[host,a,b]}=await fixture(t);
 const data={id:randomUUID(),title:'London live ball',kind:'Live ball',venue:'Test-only tennis venue',address:'London test fixture',latitude:51.5,longitude:-0.12,start:Date.now()+86400000,minutes:90,capacity:2,note:'Test fixture only',venueConfirmed:true};
 assert.equal((await call('/events',host,'POST',data)).status,402);await grantPlus(db,host);
 assert.equal((await call('/events',host,'POST',{...data,venueConfirmed:false})).status,400);
 assert.equal((await call('/events',host,'POST',data)).status,200);
 assert.equal((await call('/events',host,'POST',data)).status,200);
 assert.equal((await call('/events',host,'POST',{...data,title:'Changed title'})).status,409);
 assert.equal((await call('/events?lat=51.5&lon=-0.1',a)).body.length,1);
 assert.equal((await call('/events?lat=34&lon=-118',a)).body.length,0);
 const attempts=await Promise.all([a,b].map(p=>call(`/events/${data.id}/rsvp`,p,'POST')));assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
 const joined=attempts[0].status===200?a:b;
 assert.equal((await call(`/events/${data.id}/rsvp`,joined,'POST')).status,200);
 assert.equal((await call(`/events/${data.id}`,joined)).body.guests,2);
 assert.equal((await call(`/events/${data.id}/players`,joined)).body.length,2);
 assert.equal((await call(`/events/${data.id}/players`,joined===a?b:a)).status,403);
 assert.equal((await call(`/events/${data.id}`,joined,'DELETE')).status,403);
 await call(`/events/${data.id}`,host,'DELETE');assert.equal((await call(`/events/${data.id}/rsvp`,a,'POST')).status,409);
 assert.equal((await call('/inbox',joined)).body.some(x=>x.kind==='tennis-event'&&x.title==='Event cancelled'),true);
});
test('blocking removes event access and attendance; worldwide journals and areas work',async t=>{
 const {call,db,people:[host,a]}=await fixture(t);await grantPlus(db,host);
 const data={id:randomUUID(),title:'Test doubles',kind:'Doubles',venue:'Test venue',address:'Tokyo fixture',latitude:35.6,longitude:139.7,start:Date.now()+86400000,minutes:60,capacity:4,note:'',venueConfirmed:true};
 await call('/events',host,'POST',data);await call(`/events/${data.id}/rsvp`,a,'POST');await call('/blocks',host,'POST',{userID:a.id});
 assert.equal((await call(`/events/${data.id}`,a)).status,404);assert.equal((await call(`/events/${data.id}/rsvp`,a,'POST')).status,404);
 assert.equal((await call(`/events/${data.id}`,host)).body.guests,1);
 assert.equal((await call('/me',a,'PATCH',{name:'Guest',level:3.5,area:'Tokyo'})).status,200);
 const game={id:randomUUID(),courtID:'place:My Tokyo court',playedAt:Date.now()-60000,minutes:60,format:'Doubles',result:'Win',note:'Test journal'};
 assert.equal((await call('/journal',a,'POST',game)).status,200);assert.equal((await call('/journal',a)).body[0].courtID,game.courtID);
});
test('coaching requires Plus and explicit consent; excludes private journal until opt-in; retries do not regenerate',async t=>{
 const sent=[];const {call,db,people:[a,b]}=await fixture(t,{env:{ENABLE_COACH:'true',OPENAI_API_KEY:'test-only-no-network',OPENAI_MODEL:'test-only'},generate:async({input})=>{sent.push(input);return 'Test-only coaching response.';}});
 const message={id:randomUUID(),prompt:'Help me practice my serve.'};
 assert.equal((await call('/coach',a,'POST',message)).status,402);await grantPlus(db,a);
 assert.equal((await call('/coach',a,'POST',message)).status,403);
 const game={id:randomUUID(),courtID:'westwood',playedAt:Date.now()-60000,minutes:60,format:'Rally',result:'Not scored',note:'PRIVATE JOURNAL MARKER'};await call('/journal',a,'POST',game);
 await call('/coach/preferences',a,'PUT',{goal:'Serve consistency',consent:true,journalContext:false});
 assert.equal((await call('/coach',a,'POST',message)).status,200);assert.equal((await call('/coach',a,'POST',message)).status,200);assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent[0]).includes('PRIVATE JOURNAL MARKER'));
 await call('/coach/preferences',a,'PUT',{goal:'Serve consistency',consent:true,journalContext:true});
 assert.equal((await call('/coach',a,'POST',{...message,id:randomUUID()})).status,200);assert.ok(JSON.stringify(sent[1]).includes('PRIVATE JOURNAL MARKER'));
 assert.equal((await call('/coach',b)).body.turns.length,0);
 await call('/coach/preferences',a,'PUT',{goal:'',consent:false,journalContext:false});assert.equal((await call('/coach',a)).body.turns.length,0);
 assert.equal((await call('/coach',a,'POST',{...message,id:randomUUID()})).status,403);
});
test('failed coaching requests can retry; account deletion clears identity, hosted events and coaching',async t=>{
 let attempts=0;const {call,db,people:[a]}=await fixture(t,{env:{ENABLE_COACH:'true',OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'},generate:async()=>{if(++attempts===1)throw Object.assign(Error('Temporary test failure'),{status:503});return 'Test response';}});await grantPlus(db,a);
 await call('/identity',a,'PUT',{username:'test_player',theme:'clay'});await call('/coach/preferences',a,'PUT',{goal:'Test goal',consent:true,journalContext:false});
 const message={id:randomUUID(),prompt:'Test serve practice'};assert.equal((await call('/coach',a,'POST',message)).status,503);assert.equal((await call('/coach',a,'POST',message)).status,200);
 await call('/me',a,'DELETE');for(const table of ['coach_turns','coach_preferences','player_identity'])assert.equal((await db.query(`SELECT * FROM ${table}`)).length,0);
});
