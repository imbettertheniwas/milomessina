// Server-only passcode and signed, expiring access sessions. No secret is bundled.
const encoder = new TextEncoder();
export const COOKIE = '__Host-campuswars_access';
export const EYES_COOKIE = '__Host-eyes_feed_access';
export const SESSION_SECONDS = 8 * 60 * 60;
export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Vary': 'Cookie'
};
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function passwordMatches(value, env=process.env) {
  if (!env.CAMPUSWARS_ACCESS_PASSWORD || typeof value !== 'string' || value.length > 256) return false;
  const [a,b] = await Promise.all([digest(value),digest(env.CAMPUSWARS_ACCESS_PASSWORD)]);
  let diff=0; for(let i=0;i<a.length;i++) diff |= a[i]^b[i]; return diff===0;
}
async function key(env) {
  if (!env.CAMPUSWARS_SESSION_SECRET || !env.CAMPUSWARS_ACCESS_PASSWORD) return null;
  return crypto.subtle.importKey('raw', encoder.encode(env.CAMPUSWARS_SESSION_SECRET+'\n'+env.CAMPUSWARS_ACCESS_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const hex = bytes => Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export async function createSession(env=process.env, now=Date.now(), audience='campuswars') {
  const k=await key(env); if(!k) throw Error('Access not configured');
  const payload=audience+'.'+Math.floor(now/1000+SESSION_SECONDS)+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  return payload+'.'+hex(await crypto.subtle.sign('HMAC',k,encoder.encode(payload)));
}
export async function sessionAuthorized(cookie,env=process.env,now=Date.now(),audience='campuswars') {
  const k=await key(env); if(!k) return false;
  const name=audience==='eyes'?EYES_COOKIE:COOKIE;
  const value=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
  const m=/^(campuswars|eyes)\.(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value||'');
  if(!m || m[1]!==audience || Number(m[2])<=now/1000 || Number(m[2])>now/1000+SESSION_SECONDS) return false;
  const signature=Uint8Array.from(m[4].match(/../g),v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',k,signature,encoder.encode(m.slice(1,4).join('.')));
}
export function sessionCookie(token,audience='campuswars') {
  return (audience==='eyes'?EYES_COOKIE:COOKIE)+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+SESSION_SECONDS;
}
export async function feedAuthorized(cookie,env=process.env) {
  return await sessionAuthorized(cookie,env) || await sessionAuthorized(cookie,env,Date.now(),'eyes');
}
