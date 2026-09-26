import {createHmac} from 'node:crypto';
import {validateRequest,normalizeAvailability} from './validation.mjs';

// Match the console's ENDPOINT. Guest storage can live in a separate script.
const INTERNAL_SESSION_URL = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const statuses = new Set(['pending','confirmed','completed','declined']);
const internalAdmins = new Set(['Arya','Milo']);
const CAPABILITY_TTL_MS = 60000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function configured(env) {
  try {
    const storage = new URL(env.VISITS_STORAGE_URL);
    const origin = new URL(env.VISITS_PUBLIC_ORIGIN);
    return storage.protocol==='https:' && storage.hostname==='script.google.com' &&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(storage.pathname) &&
      !storage.search && !storage.username &&
      origin.origin===env.VISITS_PUBLIC_ORIGIN &&
      (origin.protocol==='https:' || (env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(origin.hostname))) &&
      env.VISITS_SERVICE_SECRET?.length>=32;
  } catch { return false; }
}
function addressKey(req,env,scope) {
  const address=String(req.headers?.['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHmac('sha256',env.VISITS_SERVICE_SECRET).update(scope+':'+address).digest('hex');
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
// Reuse only the deployment capability, never a completed authorization result.
// Concurrent reads for the same token can share the current verification, while
// the next request still detects an expired or revoked Internal session.
export function createInternalIdentityVerifier({fetchImpl=fetch,now=Date.now}={}) {
  let capabilityUntil=0,capabilityPending=null;
  const identities=new Map();
  async function hasIdentity(){
    if(now()<capabilityUntil)return true;
    capabilityPending ??= Promise.resolve().then(async()=>{
      // Legacy form receivers treat unknown POST namespaces as submissions.
      const response=await fetchImpl(INTERNAL_SESSION_URL,{signal:AbortSignal.timeout(15000)});
      if(!response.ok || (await response.json()).identity!==true)return false;
      capabilityUntil=now()+CAPABILITY_TTL_MS;
      return true;
    }).finally(()=>{capabilityPending=null;});
    return capabilityPending;
  }
  return function verify(token){
    if(typeof token!=='string' || !token || token.length>100)return Promise.resolve(false);
    if(identities.has(token))return identities.get(token);
    const pending=Promise.resolve().then(async()=>{
      if(!await hasIdentity())return false;
      const response=await fetchImpl(INTERNAL_SESSION_URL,{
        method:'POST',body:JSON.stringify({_api:'internal',action:'session',_session:token}),
        signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)return false;
      const identity=await response.json();
      // A beta member can share a display name with somebody on the core team.
      // Their scoped session never grants access to guest contact information.
      if(identity?.ok!==true || identity.beta===true || !['Milo','Bijan','Jesse','Luchi','Arya'].includes(identity.who))return false;
      return {who:identity.who,admin:internalAdmins.has(identity.who) && identity.admin===true};
    }).finally(()=>{identities.delete(token);});
    identities.set(token,pending);
    return pending;
  };
}
export function verifyInternalIdentity(env,token,fetchImpl=fetch) {
  return createInternalIdentityVerifier({fetchImpl})(token);
}
export function createVisitHandler({env=process.env,store=createSheetStore(env),now=Date.now,verifyIdentity}={}) {
  verifyIdentity ??= createInternalIdentityVerifier({now});
  const reads=new Map();
  function readStore(action){
    if(reads.has(action))return reads.get(action);
    const pending=Promise.resolve().then(()=>store(action)).finally(()=>{
      if(reads.get(action)===pending)reads.delete(action);
    });
    reads.set(action,pending);
    return pending;
  }
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
    const allowed={submit:'POST',list:'GET',update:'POST',session:'GET',availability:'GET',saveAvailability:'POST'};
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
      if(action==='availability'){
        const data=await readStore('settings');
        // Opening hours are public and change rarely, so let the CDN absorb the
        // form's traffic instead of waking Apps Script on every page load.
        res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
        res.setHeader('Vercel-CDN-Cache-Control','max-age=60');
        return res.status(200).json({availability:normalizeAvailability(data?.availability)});
      }
      if(action!=='submit'){
        const identity=await verifyIdentity(req.headers?.['x-fomo-internal-session']);
        if(!identity || identity.beta===true)return fail(401,'Sign in to Internal to view visit requests.');
        if(['update','saveAvailability'].includes(action) && !(internalAdmins.has(identity.who) && identity.admin===true))
          return fail(403,'Only Milo and Arya can change visit requests or opening hours.');
      }
      if(action==='session')return res.status(200).json({authenticated:true});
      if(action==='saveAvailability'){
        // Reject a malformed payload rather than normalizing it into defaults,
        // which would quietly reopen every day the team had closed.
        if(!Array.isArray(body.availability) || body.availability.length!==7)return fail(400,'Check the availability settings.');
        const data=await store('saveSettings',{availability:normalizeAvailability(body.availability)});
        reads.delete('settings');
        return res.status(200).json({availability:normalizeAvailability(data?.availability)});
      }
      if(action==='list'){
        const data=await readStore('list');
        if(!Array.isArray(data?.requests))throw new Error('Invalid storage response');
        return res.status(200).json({requests:data.requests.map(cleanRecord)});
      }
      if(action==='update'){
        if(!uuid.test(body.id) || !statuses.has(body.status) || typeof body.internalNotes!=='string' ||
          body.internalNotes.length>3000 || !Number.isInteger(body.version) || body.version<1)return fail(400,'Check the status and notes.');
        const data=await store('update',{id:body.id,status:body.status,internalNotes:body.internalNotes.trim(),version:body.version,now:new Date(now()).toISOString()});
        reads.delete('list');
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
      reads.delete('list');
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
