import {PRIVATE_HEADERS,passwordMatches,createSession,sessionAuthorized,sessionCookie,feedAuthorized} from './server/campuswars-access.mjs';
export const config={matcher:['/:path*']};
const EYES_PASSWORD_SHA256='5688e8defef948980fed26a1cd56d5fe78fedf6e23b90709075ac1c0bc2d5486';
async function sha256Hex(text){const bits=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');}
export async function eyesAuthorized(header){
 const m=/^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header||'');if(!m)return false;
 let decoded;try{decoded=atob(m[1]);}catch{return false;}
 const i=decoded.indexOf(':');if(i<0)return false;
 const digest=await sha256Hex(decoded.slice(i+1));let diff=0;
 for(let j=0;j<digest.length;j++)diff|=digest.charCodeAt(j)^EYES_PASSWORD_SHA256.charCodeAt(j);return diff===0;
}
async function eyesMiddleware(request){
 if(await eyesAuthorized(request.headers.get('authorization'))){
  if(process.env.CAMPUSWARS_SESSION_SECRET&&process.env.CAMPUSWARS_ACCESS_PASSWORD)return new Response(null,{headers:{'x-middleware-next':'1','Set-Cookie':sessionCookie(await createSession(process.env,Date.now(),'eyes'),'eyes')}});
  return;
 }
 return new Response('Password required.',{status:401,headers:{'WWW-Authenticate':'Basic realm="FOMO Pulse", charset="UTF-8"','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'}});
}
function locked(message='Enter the passcode to continue.'){
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private access</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#101116;color:#f6f6fa;font-family:system-ui,sans-serif}main{width:100%;max-width:370px}small{color:#9194a4;letter-spacing:.15em;font-size:11px}h1{font-size:32px;font-weight:500;letter-spacing:-1px;margin:18px 0 10px}p{color:#a8aabd;font-size:14px;line-height:1.6}label{display:block;margin:28px 0 9px;font-size:13px}input,button{width:100%;border-radius:10px;padding:14px;font:inherit}input{background:#1b1d26;border:1px solid #383b4a;color:white}button{margin-top:12px;border:0;background:#c9c1ff;color:#171329;cursor:pointer;font-weight:600}input:focus{outline:2px solid #c9c1ff;outline-offset:2px}</style><main><small>RESTRICTED ACCESS</small><h1>This page is private.</h1><p role="status">'+message+'</p><form method="post" action="/fomo/campuswars/_unlock"><label for="passcode">Passcode</label><input id="passcode" name="passcode" type="password" autocomplete="current-password" maxlength="256" required autofocus><button type="submit">Unlock</button></form></main></html>';
 return new Response(html,{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
export default async function middleware(request){
 let path;try{path=decodeURIComponent(new URL(request.url).pathname).replace(/\\/g,'/').replace(/\/+/g,'/').toLowerCase();}catch{return new Response('Invalid path',{status:400});}
 if(path==='/eyes'||path==='/eyes/'||path==='/fomo/pulse'||path.startsWith('/fomo/pulse/'))return eyesMiddleware(request);
 const page=path==='/fomo/campuswars'||path.startsWith('/fomo/campuswars/');
 const api=/^\/api\/campuswars(?:\/|\.|$)/.test(path);
 if(!page&&!api)return;
 if(!process.env.CAMPUSWARS_ACCESS_PASSWORD||!process.env.CAMPUSWARS_SESSION_SECRET)return new Response('Private access is temporarily unavailable.',{status:503,headers:PRIVATE_HEADERS});
 if(path==='/fomo/campuswars/_unlock'&&request.method==='POST'){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return new Response('Forbidden',{status:403,headers:PRIVATE_HEADERS});
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Unsupported form',{status:415,headers:PRIVATE_HEADERS});
  if(Number(request.headers.get('content-length'))>1024)return new Response('Form too large',{status:413,headers:PRIVATE_HEADERS});
  const body=await request.text();if(body.length>1024)return new Response('Form too large',{status:413,headers:PRIVATE_HEADERS});
  if(!await passwordMatches(new URLSearchParams(body).get('passcode')))return locked('Incorrect passcode. Try again.');
  return new Response(null,{status:303,headers:{...PRIVATE_HEADERS,'Location':'/fomo/campuswars/','Set-Cookie':sessionCookie(await createSession())}});
 }
 const cookie=request.headers.get('cookie');
 if(api?await feedAuthorized(cookie):await sessionAuthorized(cookie))return new Response(null,{headers:{...PRIVATE_HEADERS,'x-middleware-next':'1'}});
 if(api)return new Response('{"error":"Passcode required"}',{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'application/json'}});
 return locked();
}
