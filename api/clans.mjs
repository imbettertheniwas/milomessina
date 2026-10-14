import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {get,head,put,BlobNotFoundError} from '@vercel/blob';
import {parseChapterAdmin} from '../server/campuswars-source.mjs';
import {makePlan,buildSnapshot} from '../server/clans/model.mjs';
import {labelClan} from '../fomo/pulse/clan-status.mjs';
const PATH='eyes/clans/latest.json';
const digest=s=>createHash('sha256').update(String(s)).digest();
export function validPassword(value,password){return !!password&&typeof value==='string'&&timingSafeEqual(digest(value),digest(password));}
export function signSession(password,now=Date.now()){const expiry=String(now+86400000);return expiry+'.'+createHmac('sha256',password).update('eyes-clans:'+expiry).digest('base64url');}
export function validSession(value,password,now=Date.now()){
 if(!password||typeof value!=='string')return false;const [expiry,signature]=value.split('.');
 if(!/^\d{13}$/.test(expiry)||Number(expiry)<=now||Number(expiry)>now+86400000)return false;
 return validPassword(signature,createHmac('sha256',password).update('eyes-clans:'+expiry).digest('base64url'));
}
async function loadCampus(env){
 const response=await fetch('https://fomocampus.com/admin/',{headers:{authorization:'Basic '+Buffer.from((env.CAMPUSWARS_ADMIN_USERNAME||'village')+':'+env.CAMPUSWARS_ADMIN_PASSWORD).toString('base64')},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('CAMPUS_UNAVAILABLE');const html=await response.text();if(html.length>8*1024*1024)throw Error('CAMPUS_TOO_LARGE');return parseChapterAdmin(html);
}
export async function readSnapshot({metadata=head,download=get}={}){
 // Read the storage version before the body. The download response ETag can
 // describe its HTTP representation rather than the conditional-write version.
 let version;try{version=await metadata(PATH);}catch(error){if(error instanceof BlobNotFoundError)return null;throw error;}
 const file=await download(PATH,{access:'private',useCache:false});if(!file)return null;if(file.statusCode!==200||!version.etag)throw Error('STORAGE_READ');
 return {...JSON.parse(await new Response(file.stream).text()),_etag:version.etag};
}
const readSaved=()=>readSnapshot();
async function writeSaved(data,previous){await put(PATH,JSON.stringify(data),{access:'private',addRandomSuffix:false,allowOverwrite:!!previous,...(previous?._etag?{ifMatch:previous._etag}:{}),contentType:'application/json',cacheControlMaxAge:60});}
const seedPromise=readFile(new URL('../server/clans/seed.json',import.meta.url),'utf8').then(JSON.parse);
export function createClanHandler({env=process.env,load=loadCampus,read=readSaved,write=writeSaved,seed=()=>seedPromise,now=Date.now}={}){
 let campus=null,campusAt=0,pending;const attempts=new Map();
 async function chapters(){if(campus&&now()-campusAt<30000)return campus;pending??=Promise.resolve(load(env)).then(c=>{campus=c;campusAt=now();return c;}).finally(()=>pending=null);return pending;}
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const query=new URL(req.url,'https://milomessina.com').searchParams;
  const token=String(req.headers?.authorization||'').replace(/^Bearer /,'');
  const authorized=validSession(token,env.CAMPUSWARS_ADMIN_PASSWORD,now());
  const configured=!!env.BLOB_READ_WRITE_TOKEN;
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  try{
   if(req.method==='GET'){
    if(query.get('action')==='session')return res.json({authorized,storageReady:configured});
    let saved=configured?await read():null;
    if(query.get('action')==='plan'){
     if(!authorized)return res.status(401).json({error:'Connect with the campus admin password first.'});
     if(!configured)return res.status(503).json({error:'Clan storage is not configured.'});
     return res.json(makePlan(await chapters(),saved));
    }
    const snapshot=saved||await seed();const {_etag,...publicSnapshot}=snapshot;return res.json({...publicSnapshot,records:publicSnapshot.records.map(labelClan),storageReady:configured,stale:!snapshot.updatedAt||now()-Date.parse(snapshot.updatedAt)>10*60000});
   }
   // The extension sends a scoped, expiring token; FOMO cookies never leave its tab.
   if(req.headers?.['x-eyes-client']!=='browser-helper')return res.status(403).json({error:'Use the browser helper to sync.'});
   if(!String(req.headers?.['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON required'});
   if(Number(req.headers?.['content-length'])>1500000)return res.status(413).json({error:'Upload too large'});
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(!body||JSON.stringify(body).length>1500000)return res.status(400).json({error:'Invalid upload'});
   if(query.get('action')==='login'){
    const ip=String(req.headers?.['x-forwarded-for']||'local').split(',')[0],attempt=attempts.get(ip);
    if(attempt&&attempt.until>now()&&attempt.count>=5)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
    if(!validPassword(body.password,env.CAMPUSWARS_ADMIN_PASSWORD)){for(const [key,v] of attempts)if(v.until<=now())attempts.delete(key);attempts.set(ip,{count:(attempt?.until>now()?attempt.count:0)+1,until:now()+900000});return res.status(401).json({error:'Incorrect admin password'});}
    attempts.delete(ip);return res.json({ok:true,token:signSession(env.CAMPUSWARS_ADMIN_PASSWORD,now())});
   }
   if(!authorized)return res.status(401).json({error:'Reconnect with the campus admin password.'});
   if(!configured)return res.status(503).json({error:'Clan storage is not configured.'});
   const previous=await read();const snapshot=buildSnapshot(body,await chapters(),previous,now());await write(snapshot,previous);return res.json({ok:true,updatedAt:snapshot.updatedAt,records:snapshot.records.length});
  }catch(error){
   const invalid=/^(INVALID_|INCOMPLETE_|OLD_UPLOAD)/.test(error.message);console.error('Clan sync',invalid?error.message:'SOURCE_OR_STORAGE_UNAVAILABLE',String(error.constructor?.name||error.name||'Error').slice(0,80),String(error.message).match(/ETag mismatch|ifMatch[^.]*|CAMPUS_[A-Z_]+|STORAGE_[A-Z_]+|allowOverwrite[^.]*|Access denied|maximum size[^.]*|not supported[^.]*/i)?.[0]||'UNCLASSIFIED');return res.status(invalid?422:503).json({error:invalid?'Refresh incomplete or outdated. Previous results were retained.':'Clan data could not be saved or loaded. Previous results were retained.'});
  }
 };
}
export default createClanHandler();
