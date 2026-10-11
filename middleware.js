// Vercel Routing Middleware: password gate for /eyes (FOMO Pulse) and its assets.
// Only the SHA-256 of the password lives here; any username is accepted.
export const config={matcher:['/eyes','/eyes/','/fomo/pulse/:path*']};

const EYES_PASSWORD_SHA256='5688e8defef948980fed26a1cd56d5fe78fedf6e23b90709075ac1c0bc2d5486';

async function sha256Hex(text){
 const bits=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');
}

export async function eyesAuthorized(header){
 const m=/^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header||'');
 if(!m)return false;
 let decoded;try{decoded=atob(m[1]);}catch{return false;}
 const i=decoded.indexOf(':');if(i<0)return false;
 const digest=await sha256Hex(decoded.slice(i+1));
 let diff=0;for(let j=0;j<digest.length;j++)diff|=digest.charCodeAt(j)^EYES_PASSWORD_SHA256.charCodeAt(j);
 return diff===0;
}

export default async function middleware(request){
 if(await eyesAuthorized(request.headers.get('authorization')))return;
 return new Response('Password required.',{status:401,headers:{
  'WWW-Authenticate':'Basic realm="FOMO Pulse", charset="UTF-8"',
  'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'}});
}
