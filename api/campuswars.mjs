import {createHash} from 'node:crypto';
import {fetchChapterSnapshot,chapterSourceErrorCode} from '../server/campuswars-source.mjs';

const FRESH_MS=30000, STALE_MS=300000, RETRY_MS=5000, MAX_RETRY_MS=60000;

// Each warm instance shares one refresh. The CDN shares the public, allowlisted
// response across visitors; no authenticated source response is ever cached here.
export function createChapterHandler({load=fetchChapterSnapshot,now=Date.now,env=process.env}={}){
  let latest=null,pending=null,retryAt=0,failures=0,lastCode='SOURCE_CONNECTION';
  function refresh(){
    pending ??= Promise.resolve().then(()=>load({password:env.CAMPUSWARS_ADMIN_PASSWORD,username:env.CAMPUSWARS_ADMIN_USERNAME||'village'})).then(snapshot=>{
      const body=JSON.stringify(snapshot);
      latest={snapshot,body,etag:`W/"${createHash('sha256').update(body).digest('base64url')}"`,at:now()};
      failures=0;retryAt=0;
    }).catch(error=>{
      lastCode=chapterSourceErrorCode(error);
      retryAt=now()+Math.min(MAX_RETRY_MS,RETRY_MS*2**Math.min(failures++,4));
    }).finally(()=>{pending=null;});
    return pending;
  }
  return async function handler(req,res){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vercel-CDN-Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Method not allowed'});
    }
    function error(status,body){res.status(status);return req.method==='HEAD'?res.end():res.json(body);}
    if(!env.CAMPUSWARS_ADMIN_PASSWORD)return error(503,{error:'Live chapter updates are not configured'});
    const started=now();
    let cache='HIT';
    if(!latest||now()-latest.at>=FRESH_MS){
      cache=pending?'COALESCED':now()<retryAt?'BACKOFF':'REFRESH';
      if(pending)await pending;
      else if(now()>=retryAt)await refresh();
    }
    res.setHeader('Server-Timing',`chapter;dur=${Math.max(0,now()-started)};desc="${cache}"`);
    const age=latest?now()-latest.at:Infinity;
    if(age>=FRESH_MS){
      res.setHeader('Retry-After',String(Math.max(1,Math.ceil((retryAt-now())/1000))));
      if(age>=STALE_MS)return error(502,{error:'Chapter updates are temporarily unavailable',code:lastCode});
      // Saved counts remain usable, but must never be presented or cached as a
      // newly verified live response. Keep their original source timestamp.
      res.setHeader('X-Chapter-Cache','STALE');
      res.status(200);return req.method==='HEAD'?res.end():res.json({...latest.snapshot,stale:true});
    }
    // Subtract the warm-cache age so successive CDN misses cannot extend the
    // freshness window indefinitely. The CDN owns background revalidation.
    const ttl=Math.max(1,Math.floor((FRESH_MS-age)/1000));
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control',`public, s-maxage=${ttl}, stale-while-revalidate=30`);
    res.setHeader('X-Chapter-Cache',cache);
    res.setHeader('ETag',latest.etag);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const matches=String(req.headers?.['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===latest.etag.replace(/^W\//,''));
    if(matches)return res.status(304).end();
    res.status(200);return req.method==='HEAD'?res.end():res.end(latest.body);
  };
}

export default createChapterHandler();
