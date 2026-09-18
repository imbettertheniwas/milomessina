import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {validateRequest,normalizeAvailability} from './validation.mjs';

const SESSION_SECONDS = 4 * 60 * 60;
const COOKIE = '__Host-fomo-visits';
// Match the console's ENDPOINT. Guest storage can live in a separate script.
const INTERNAL_SESSION_URL = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const statuses = new Set(['pending','confirmed','completed','declined']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function equal(a,b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
}
function configured(env) {
  try {
    const storage = new URL(env.VISITS_STORAGE_URL);
    const origin = new URL(env.VISITS_PUBLIC_ORIGIN);
    return storage.protocol==='https:' && storage.hostname==='script.google.com' &&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(storage.pathname) &&
      !storage.search && !storage.username &&
      origin.origin===env.VISITS_PUBLIC_ORIGIN &&
      (origin.protocol==='https:' || (env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(origin.hostname))) &&
      env.VISITS_SERVICE_SECRET?.length>=32 && env.VISITS_SESSION_SECRET?.length>=32 &&
      env.VISITS_ADMIN_PASSWORD?.length>=16;
  } catch { return false; }
}
function sign(value,env) {
  return createHmac('sha256',env.VISITS_SESSION_SECRET).update(env.VISITS_ADMIN_PASSWORD+'\n'+value).digest('base64url');
}
export function issueSession(env, now=Date.now()) {
  const value=String(Math.floor(now/1000)+SESSION_SECONDS)+'.'+randomBytes(24).toString('base64url');
  return value+'.'+sign(value,env);
}
export function validSession(cookie,env,now=Date.now()) {
  if(typeof cookie!=='string' || cookie.length>1000)return false;
  const token=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token)return false;
  const parts=token.split('.');
  if(parts.length!==3 || !/^\d+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{32}$/.test(parts[1]))return false;
  const expires=Number(parts[0]);
  if(expires<=Math.floor(now/1000) || expires>Math.floor(now/1000)+SESSION_SECONDS)return false;
  return equal(sign(parts[0]+'.'+parts[1],env),parts[2]);
}
function addressKey(req,env,scope) {
  const address=String(req.headers?.['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHmac('sha256',env.VISITS_SERVICE_SECRET).update(scope+':'+address).digest('hex');
}
function sessionCookie(token,seconds=SESSION_SECONDS) {
  return COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+seconds;
}
export function createSheetStore(env,fetchImpl=fetch) {
  return async (action,payload={})=>{
    const response=await fetchImpl(env.VISITS_STORAGE_URL,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({_api:'visits',action,secret:env.VISITS_SERVICE_SECRET,...payload}),
      signal:AbortSignal.timeout(15000)
    });
    if(!response.ok)throw new Error('Storage unavailable');
    const result=await response.json();
    if(result?.ok!==true) {
      const error=new Error('Storage request failed');
      error.code=result?.code;throw error;
    }
    return result.data;
  };
}
function cleanRecord(row) {
  if(!row || !uuid.test(row.id) || !statuses.has(row.status) || !Number.isInteger(row.version))throw new Error('Invalid record');
  const keys=['id','name','email','social','notes','preferred_date','preferred_time','time_zone','status','created_at','updated_at','internal_notes','version'];
  return Object.fromEntries(keys.map(key=>[key,row[key]]));
}
// Internal identity narrows the existing guest-access session; it never replaces it.
export async function verifyInternalAdmin(env, token, fetchImpl=fetch) {
  if(typeof token!=='string' || !token || token.length>100)return false;
  // Older form receivers interpret unknown POST namespaces as submissions.
  // Probe first, so a rollout mismatch cannot create a stray spreadsheet row.
  const capability=await fetchImpl(INTERNAL_SESSION_URL,{signal:AbortSignal.timeout(15000)});
  if(!capability.ok || (await capability.json()).identity!==true)return false;
  const response=await fetchImpl(INTERNAL_SESSION_URL,{
    method:'POST',body:JSON.stringify({_api:'internal',action:'session',_session:token}),
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return false;
  const identity=await response.json();
  return identity?.ok===true && identity.who==='Arya' && identity.admin===true;
}
export function createVisitHandler({env=process.env,store=createSheetStore(env),now=Date.now,verifyAdmin=token=>verifyInternalAdmin(env,token)}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vercel-CDN-Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const fail=(status,error)=>res.status(status).json({error});
    if(!configured(env))return fail(503,'Visit requests are not connected yet. Please contact the fomo team.');
    const origin=req.headers?.origin;
    // The form and console are same-origin. Cross-origin requests are never enabled.
    if(origin && origin!==env.VISITS_PUBLIC_ORIGIN)return fail(403,'Please use the visit portal.');
    const action=new URL(req.url,'https://local.invalid').searchParams.get('action')||'submit';
    const allowed={submit:'POST',login:'POST',logout:'POST',list:'GET',update:'POST',session:'GET',availability:'GET',saveAvailability:'POST'};
    if(!Object.hasOwn(allowed,action))return fail(404,'Unknown action.');
    if(req.method!==allowed[action]){res.setHeader('Allow',allowed[action]);return fail(405,'Method not allowed.');}
    if(req.method==='POST' && origin!==env.VISITS_PUBLIC_ORIGIN)return fail(403,'Please use the visit portal.');
    let body={};
    if(req.method==='POST'){
      if(!String(req.headers?.['content-type']||'').toLowerCase().includes('application/json'))return fail(415,'Use JSON.');
      try {
        if(Number(req.headers?.['content-length']||0)>12000)return fail(413,'Please shorten your request.');
        const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
        if(!raw || Buffer.byteLength(raw)>12000)return fail(413,'Please shorten your request.');
        body=JSON.parse(raw);
        if(!body || typeof body!=='object' || Array.isArray(body))return fail(400,'Invalid request.');
      } catch {return fail(400,'Invalid request.');}
    }
    try {
      if(action==='login'){
        if(typeof body.password!=='string' || body.password.length>512)return fail(400,'Enter the visit-access password.');
        await store('throttle',{key:addressKey(req,env,'login')});
        if(!equal(body.password,env.VISITS_ADMIN_PASSWORD))return fail(401,'That password did not match.');
        res.setHeader('Set-Cookie',sessionCookie(issueSession(env,now())));
        return res.status(200).json({authenticated:true});
      }
      if(action==='logout'){
        res.setHeader('Set-Cookie',sessionCookie('',0));
        return res.status(200).json({authenticated:false});
      }
      if(action==='availability'){
        const data=await store('settings');
        // Opening hours are public and change rarely, so let the CDN absorb the
        // form's traffic instead of waking Apps Script on every page load.
        res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
        res.setHeader('Vercel-CDN-Cache-Control','max-age=60');
        return res.status(200).json({availability:normalizeAvailability(data?.availability)});
      }
      if(action!=='submit' && !validSession(req.headers?.cookie,env,now()))return fail(401,'Unlock visit requests to continue.');
      if(action==='session')return res.status(200).json({authenticated:true});
      if(['update','saveAvailability'].includes(action) && !await verifyAdmin(req.headers?.['x-fomo-internal-session']))return fail(403,'Only Arya can change visit requests or opening hours.');
      if(action==='saveAvailability'){
        // Reject a malformed payload rather than normalizing it into defaults,
        // which would quietly reopen every day the team had closed.
        if(!Array.isArray(body.availability) || body.availability.length!==7)return fail(400,'Check the availability settings.');
        const data=await store('saveSettings',{availability:normalizeAvailability(body.availability)});
        return res.status(200).json({availability:normalizeAvailability(data?.availability)});
      }
      if(action==='list'){
        const data=await store('list');
        if(!Array.isArray(data?.requests))throw new Error('Invalid storage response');
        return res.status(200).json({requests:data.requests.map(cleanRecord)});
      }
      if(action==='update'){
        if(!uuid.test(body.id) || !statuses.has(body.status) || typeof body.internalNotes!=='string' ||
          body.internalNotes.length>3000 || !Number.isInteger(body.version) || body.version<1)return fail(400,'Check the status and notes.');
        const data=await store('update',{id:body.id,status:body.status,internalNotes:body.internalNotes.trim(),version:body.version,now:new Date(now()).toISOString()});
        return res.status(200).json({request:cleanRecord(data?.request)});
      }
      const invalid=validateRequest(body,new Date(now()));
      if(invalid)return fail(400,invalid);
      const data=await store('submit',{addressKey:addressKey(req,env,'submit'),request:{
        id:body.requestId,name:body.name.trim(),email:body.email.trim().toLowerCase(),
        social:body.social.trim(),notes:body.notes.trim(),preferred_date:body.date,
        preferred_time:body.time,time_zone:'America/New_York',status:'pending',
        created_at:new Date(now()).toISOString(),updated_at:new Date(now()).toISOString(),
        internal_notes:'',version:1
      }});
      if(data?.reference!==body.requestId || data.status!=='pending')throw new Error('Invalid receipt');
      return res.status(data.duplicate?200:201).json({reference:data.reference,status:'pending'});
    } catch(error) {
      if(error.code==='RATE_LIMIT')return fail(429,'Too many requests. Please try again later.');
      if(error.code==='CONFLICT')return fail(409,'This request changed. Refresh before trying again.');
      if(error.code==='NOT_FOUND')return fail(404,'This request is no longer available.');
      if(error.code==='CLOSED')return fail(400,'That day is not open for visits. Please choose another date.');
      // The public message stays vague on purpose, so the distinguishing detail
      // goes to the server log: an unmapped code here is a misconfiguration,
      // and UNAUTHORIZED specifically means the two secrets do not match.
      console.error('visits: storage rejected '+action+' with '+(error.code||'no code'));
      return fail(503,'We could not save or load requests right now. Please try again.');
    }
  };
}
