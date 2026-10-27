import {feedAuthorized,PRIVATE_HEADERS} from '../server/campuswars-access.mjs';
import {recordArrivalHistory} from '../fomo/campuswars/chapter-arrival-history.js';
import {createHash} from 'node:crypto';
import {waitUntil as vercelWaitUntil} from '@vercel/functions';
import {get,put} from '@vercel/blob';
import {fetchChapterSnapshot,chapterSourceErrorCode} from '../server/campuswars-source.mjs';
const FRESH_MS=30000, LIVE_MS=75000, STALE_MS=300000, SAVED_MS=86400000, SAVE_EVERY_MS=60000, RESTORE_WAIT_MS=2500, RETRY_MS=5000, MAX_RETRY_MS=60000;
// The last good snapshot is kept in private storage so a cold instance can answer
// at once instead of making its first viewer wait for the ~8s source.
const SAVED_PATH='eyes/chapters/latest.json';
async function readSaved(){const file=await get(SAVED_PATH,{access:'private',useCache:false});if(!file||file.statusCode!==200)return null;return JSON.parse(await new Response(file.stream).text());}
async function writeSaved(body){await put(SAVED_PATH,body,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:60});}
const within=(promise,ms)=>Promise.race([promise,new Promise(resolve=>setTimeout(resolve,ms,null))]);
// Warm instances share refreshes behind authentication; responses are never publicly cached.
export function createChapterHandler({load=fetchChapterSnapshot,now=Date.now,env=process.env,waitUntil=vercelWaitUntil,read=readSaved,write=writeSaved}={}){
 let latest=null,pending=null,restoring=null,savedAt=0,retryAt=0,failures=0,lastCode='SOURCE_CONNECTION';
 const storage=!!env.BLOB_READ_WRITE_TOKEN;
 const entry=(snapshot,body,at)=>({snapshot,body,etag:'W/"'+createHash('sha256').update(body).digest('base64url')+'"',at});
 function restore(){
  restoring ??= within(Promise.resolve().then(read),RESTORE_WAIT_MS).then(saved=>{
   const at=Date.parse(saved?.updatedAt);
   if(latest||!Array.isArray(saved?.chapters)||!(at<=now()&&now()-at<SAVED_MS))return;
   latest=entry(saved,JSON.stringify(saved),at);console.log('Chapter feed restored',now()-at+'ms old');
  }).catch(()=>console.warn('Chapter feed restore failed'));
  return restoring;
 }
 function refresh(){
  const started=now();
  pending ??= Promise.resolve().then(()=>load({password:env.CAMPUSWARS_ADMIN_PASSWORD,username:env.CAMPUSWARS_ADMIN_USERNAME||'village'})).then(snapshot=>{
   snapshot=recordArrivalHistory(snapshot,latest?.snapshot);
   const body=JSON.stringify(snapshot);
   latest=entry(snapshot,body,now());
   failures=0;retryAt=0;console.log('Chapter feed refreshed',now()-started+'ms',body.length+'B');
   if(storage&&now()-savedAt>=SAVE_EVERY_MS){savedAt=now();waitUntil(Promise.resolve().then(()=>write(body)).catch(()=>console.warn('Chapter feed save failed')));}
  }).catch(error=>{lastCode=chapterSourceErrorCode(error);console.warn('Chapter feed refresh failed',lastCode,now()-started+'ms');retryAt=now()+Math.min(MAX_RETRY_MS,RETRY_MS*2**Math.min(failures++,4));}).finally(()=>{pending=null;});
  return pending;
 }
 return async function handler(req,res){
  for(const [name,value] of Object.entries(PRIVATE_HEADERS))res.setHeader(name,value);
  if(!await feedAuthorized(req.headers?.cookie,env,req.headers?.authorization))return res.status(401).json({error:'Passcode required'});
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Method not allowed'});}
  function error(status,body){res.status(status);return req.method==='HEAD'?res.end():res.json(body);}
  if(!env.CAMPUSWARS_ADMIN_PASSWORD)return error(503,{error:'Live chapter updates are not configured'});
  const started=now();let cache='HIT';
  if(!latest&&storage)await restore();
  // The source takes ~8s to render. While the last read succeeded, answer from it
  // at once and refresh after the response instead of making the viewer wait;
  // anything older than LIVE_MS is labelled stale so the page re-polls shortly.
  if(latest&&!failures&&now()-latest.at>=FRESH_MS&&now()-latest.at<SAVED_MS){cache='REVALIDATE';if(!pending)waitUntil(refresh());}
  else if(!latest||now()-latest.at>=FRESH_MS){cache=pending?'COALESCED':now()<retryAt?'BACKOFF':'REFRESH';if(pending)await pending;else if(now()>=retryAt)await refresh();}
  res.setHeader('Server-Timing','chapter;dur='+Math.max(0,now()-started)+';desc="'+cache+'"');
  const age=latest?now()-latest.at:Infinity;
  if(cache==='REVALIDATE'&&age>=LIVE_MS){
   // Too old for the page to treat as live; show it now and ask for a quick re-poll.
   res.setHeader('X-Chapter-Cache',cache);res.status(200);return req.method==='HEAD'?res.end():res.json({...latest.snapshot,stale:true,refreshing:true});
  }
  if(age>=FRESH_MS&&cache!=='REVALIDATE'){
   res.setHeader('Retry-After',String(Math.max(1,Math.ceil((retryAt-now())/1000))));
   if(age>=STALE_MS)return error(502,{error:'Chapter updates are temporarily unavailable',code:lastCode});
   res.setHeader('X-Chapter-Cache','STALE');
   res.status(200);return req.method==='HEAD'?res.end():res.json({...latest.snapshot,stale:true});
  }
  res.setHeader('X-Chapter-Cache',cache);res.setHeader('ETag',latest.etag);res.setHeader('Content-Type','application/json; charset=utf-8');
  const matches=String(req.headers?.['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===latest.etag.replace(/^W\//,''));
  if(matches)return res.status(304).end();
  res.status(200);return req.method==='HEAD'?res.end():res.end(latest.body);
 };
}
export default createChapterHandler();
