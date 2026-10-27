// Kept inline because the platform compiles middleware.js as CommonJS.
const encoder = new TextEncoder();
const COOKIE = '__Host-campuswars_access';
const EYES_COOKIE = '__Host-eyes_feed_access';
const SESSION_SECONDS = 8 * 60 * 60;
const PRIVATE_HEADERS = {'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Vary':'Cookie'};
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
async function key(env){if(!env.CAMPUSWARS_SESSION_SECRET||!env.CAMPUSWARS_ACCESS_PASSWORD)return null;return crypto.subtle.importKey('raw',encoder.encode(env.CAMPUSWARS_SESSION_SECRET+'\n'+env.CAMPUSWARS_ACCESS_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function createSession(env=process.env,now=Date.now(),audience='campuswars'){const k=await key(env);if(!k)throw Error('Access not configured');const payload=audience+'.'+Math.floor(now/1000+SESSION_SECONDS)+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));return payload+'.'+hex(await crypto.subtle.sign('HMAC',k,encoder.encode(payload)));}
async function sessionAuthorized(cookie,env=process.env,now=Date.now(),audience='campuswars'){const k=await key(env);if(!k)return false;const name=audience==='eyes'?EYES_COOKIE:COOKIE;const value=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);const m=/^(campuswars|eyes)\.(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value||'');if(!m||m[1]!==audience||Number(m[2])<=now/1000||Number(m[2])>now/1000+SESSION_SECONDS)return false;const signature=Uint8Array.from(m[4].match(/../g),v=>parseInt(v,16));return crypto.subtle.verify('HMAC',k,signature,encoder.encode(m.slice(1,4).join('.')));}
function sessionCookie(token,audience='campuswars'){return(audience==='eyes'?EYES_COOKIE:COOKIE)+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+SESSION_SECONDS;}
async function feedAuthorized(cookie,env=process.env){return await sessionAuthorized(cookie,env)||await sessionAuthorized(cookie,env,Date.now(),'eyes');}
export const config={matcher:['/:path*']};
const EYES_PASSWORD_SHA256='5688e8defef948980fed26a1cd56d5fe78fedf6e23b90709075ac1c0bc2d5486';
async function sha256Hex(text){const bits=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');}
export async function eyesAuthorized(header){const m=/^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header||'');if(!m)return false;let decoded;try{decoded=atob(m[1]);}catch{return false;}const i=decoded.indexOf(':');if(i<0)return false;const digest=await sha256Hex(decoded.slice(i+1));let diff=0;for(let j=0;j<digest.length;j++)diff|=digest.charCodeAt(j)^EYES_PASSWORD_SHA256.charCodeAt(j);return diff===0;}
// Every Eyes request accepts either the saved browser password or the signed session
// it earned. Safari can drop the password for subresources, and a cached page load
// can skip the cookie; with one gate for page, graphics and feed, either is enough.
const EYES_RENEW_MS=4*60*60*1000;
const EYES_ASSET_HEADERS={'Cache-Control':'private, max-age=86400','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
async function eyesAccess(request,headers={}){
const env=process.env,configured=!!(env.CAMPUSWARS_SESSION_SECRET&&env.CAMPUSWARS_ACCESS_PASSWORD),cookie=request.headers.get('cookie');
const password=await eyesAuthorized(request.headers.get('authorization'));
if(!password&&!(configured&&await feedAuthorized(cookie,env)))return false;
// Renew while the password works, well before an open page's session would lapse.
if(password&&configured&&!await sessionAuthorized(cookie,env,Date.now()+EYES_RENEW_MS,'eyes'))headers={...headers,'Set-Cookie':sessionCookie(await createSession(env,Date.now(),'eyes'),'eyes')};
return Object.keys(headers).length?new Response(null,{headers:{...headers,'x-middleware-next':'1'}}):undefined;}
const passwordRequired=()=>new Response('Password required.',{status:401,headers:{'WWW-Authenticate':'Basic realm="FOMO Pulse", charset="UTF-8"','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'}});
export default async function middleware(request){
let path;try{path=decodeURIComponent(new URL(request.url).pathname).replace(/\\/g,'/').replace(/\/+/g,'/').toLowerCase();}catch{return new Response('Invalid path',{status:400});}
if(path==='/eyes'||path==='/eyes/'||path==='/fomo/pulse'||path.startsWith('/fomo/pulse/')){const access=await eyesAccess(request);return access===false?passwordRequired():access;}
const page=path==='/fomo/campuswars'||path.startsWith('/fomo/campuswars/');const api=/^\/api\/campuswars(?:\/|\.|$)/.test(path);if(!page&&!api)return;
// Campus wars is taken down; its code stays in the repo. Eyes still imports these
// graphics modules, so only they are served, and only to Eyes viewers. They never
// change, so browsers keep them privately instead of downloading ~720 KB each visit.
const eyesAsset=['/fomo/campuswars/vendor/three.module.min.js','/fomo/campuswars/vendor/three.core.min.js','/fomo/campuswars/village-floor-logo.js','/fomo/campuswars/village-brand.js'].includes(path);
if(page&&!eyesAsset)return new Response('Not found',{status:404,headers:PRIVATE_HEADERS});
if(!process.env.CAMPUSWARS_ACCESS_PASSWORD||!process.env.CAMPUSWARS_SESSION_SECRET)return new Response('Private access is temporarily unavailable.',{status:503,headers:PRIVATE_HEADERS});
const access=await eyesAccess(request,eyesAsset?EYES_ASSET_HEADERS:PRIVATE_HEADERS);if(access!==false)return access;
if(api)return new Response('{"error":"Passcode required"}',{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'application/json'}});return new Response('Not found',{status:404,headers:PRIVATE_HEADERS});}
