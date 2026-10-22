import {createHash, randomBytes, randomUUID, createPublicKey, verify, sign, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const uuid = randomUUID;
export const digest = value => createHash('sha256').update(value).digest('hex');
export function fail(status, message) { throw Object.assign(Error(message), {status}); }
export function required(condition, status, message) { if(!condition) fail(status,message); }
export function text(value, min, max, label) {
  required(typeof value === 'string',400,`${label} is required.`);
  const result=value.trim().normalize('NFKC');
  required(result.length>=min && result.length<=max && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result),400,`${label} must be ${min}–${max} characters.`);
  return result;
}
export function moderate(value) {
  // Baseline filter, not a substitute for a staffed moderation queue.
  required(!/(?:\bkill yourself\b|\bi will kill\b|\bnigger\b|\bfaggot\b|\bchild porn\b)/i.test(value),422,'Please keep this respectful and tennis-related.');
  return value;
}
export function safeEqual(a,b) { const x=Buffer.from(a||''),y=Buffer.from(b||''); return x.length===y.length&&x.length>0&&timingSafeEqual(x,y); }
export function encrypted(value, env=process.env) {
  const key=Buffer.from(env.TOKEN_ENCRYPTION_KEY||'','base64');
  required(key.length===32,503,'Account service is not configured.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function decrypted(value, env=process.env) {
  const data=Buffer.from(value,'base64'),key=Buffer.from(env.TOKEN_ENCRYPTION_KEY||'','base64');
  const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12)); cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]).toString('utf8');
}
export function signedJWT(payload, key, kid) {
  const head=Buffer.from(JSON.stringify({alg:'ES256',kid,typ:'JWT'})).toString('base64url');
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${head}.${body}.${sign('sha256',Buffer.from(`${head}.${body}`),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}
let keys, keysUntil=0;
export async function verifyAppleToken(token, nonce, env=process.env) {
  required(typeof token==='string'&&token.length<16000,401,'Invalid Apple credential.');
  let header,payload,parts;
  try {parts=token.split('.'); header=JSON.parse(Buffer.from(parts[0],'base64url')); payload=JSON.parse(Buffer.from(parts[1],'base64url'));} catch {fail(401,'Invalid Apple credential.');}
  required(parts.length===3&&header.alg==='RS256',401,'Invalid Apple credential.');
  if(!keys||Date.now()>keysUntil||!keys.some(k=>k.kid===header.kid)) {
    const response=await fetch('https://appleid.apple.com/auth/keys',{signal:AbortSignal.timeout(10000)});
    required(response.ok,503,'Apple sign-in is temporarily unavailable.'); keys=(await response.json()).keys; keysUntil=Date.now()+3600000;
  }
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');
  required(jwk && verify('RSA-SHA256',Buffer.from(parts.slice(0,2).join('.')),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')),401,'Invalid Apple signature.');
  const now=Date.now()/1000;
  required(payload.iss==='https://appleid.apple.com'&&payload.aud===env.APPLE_BUNDLE_ID&&typeof payload.sub==='string'&&payload.exp>now&&payload.iat<=now+60&&payload.nonce===digest(nonce),401,'Apple credential expired or did not match this sign-in.');
  return payload;
}
function appleSecret(env) {
  required(env.APPLE_SIGNIN_KEY_PATH&&env.APPLE_TEAM_ID&&env.APPLE_SIGNIN_KEY_ID&&env.APPLE_BUNDLE_ID,503,'Apple sign-in is not configured.');
  const now=Math.floor(Date.now()/1000);
  return signedJWT({iss:env.APPLE_TEAM_ID,iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:env.APPLE_BUNDLE_ID},readFileSync(env.APPLE_SIGNIN_KEY_PATH),env.APPLE_SIGNIN_KEY_ID);
}
export async function exchangeCode(code,env=process.env) {
  const body=new URLSearchParams({client_id:env.APPLE_BUNDLE_ID,client_secret:appleSecret(env),code,grant_type:'authorization_code'});
  const response=await fetch('https://appleid.apple.com/auth/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
  required(response.ok,401,'Apple sign-in could not be completed. Please try again.');
  return response.json();
}
export async function revokeApple(token,env=process.env) {
  if(!token)return;
  const body=new URLSearchParams({client_id:env.APPLE_BUNDLE_ID,client_secret:appleSecret(env),token:decrypted(token,env),token_type_hint:'refresh_token'});
  const response=await fetch('https://appleid.apple.com/auth/revoke',{method:'POST',body,signal:AbortSignal.timeout(10000)});
  required(response.ok,503,'Account deletion could not complete. Please try again.');
}
export async function newSession(q,userID) {
  const token=randomBytes(32).toString('base64url'),now=Date.now();
  await q('INSERT INTO sessions(digest,user_id,expires_at,created_at) VALUES($1,$2,$3,$4)',[digest(token),userID,now+30*86400000,now]);
  return token;
}
export async function limit(q,key,max,period=60000) {
  const now=Date.now();
  const rows=await q('INSERT INTO rate_limits(key,count,resets_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<$3 THEN 1 ELSE rate_limits.count+1 END,resets_at=CASE WHEN rate_limits.resets_at<$3 THEN $2 ELSE rate_limits.resets_at END RETURNING count',[key,now+period,now]);
  required(rows[0].count<=max,429,'Please wait a moment before trying again.');
}
