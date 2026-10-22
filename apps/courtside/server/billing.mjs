import {readFileSync} from 'node:fs';
import {required} from './security.mjs';
export const PRODUCTS=['com.courtside.plus.monthly','com.courtside.plus.annual'];
const verifiers=new Map();
async function getVerifier(environment,env=process.env) {
  required(env.APPLE_ROOT_CERT_PATHS&&env.APPLE_BUNDLE_ID&&env.APPLE_APP_ID,503,'Subscriptions are not configured.');
  const key=JSON.stringify([environment,env.APPLE_ROOT_CERT_PATHS,env.APPLE_BUNDLE_ID,env.APPLE_APP_ID]);
  if(!verifiers.has(key)) {
    const {SignedDataVerifier}=await import('@apple/app-store-server-library');
    verifiers.set(key,new SignedDataVerifier(env.APPLE_ROOT_CERT_PATHS.split(',').map(p=>readFileSync(p)),true,environment,env.APPLE_BUNDLE_ID,Number(env.APPLE_APP_ID)));
  }
  return verifiers.get(key);
}
// App Review/TestFlight use signed sandbox transactions against the deployed API.
// Retry only an environment mismatch, never an invalid signature or wrong app.
export async function verifyStorePayload(jws,method,env=process.env,factory=getVerifier) {
  const {VerificationStatus}=await import('@apple/app-store-server-library');
  try {return await (await factory('Production',env))[method](jws);}
  catch(error) {
    if(error.status!==VerificationStatus.INVALID_ENVIRONMENT)throw error;
    return (await factory('Sandbox',env))[method](jws);
  }
}
export async function verifiedTransaction(jws,env=process.env) {
  const tx=await verifyStorePayload(jws,'verifyAndDecodeTransaction',env);
  required(PRODUCTS.includes(tx.productId)&&tx.type==='Auto-Renewable Subscription',400,'This purchase is not a Courtside subscription.');
  return tx;
}
export async function syncTransaction(q,tx,userID) {
  required(tx.appAccountToken?.toLowerCase()===userID.toLowerCase(),403,'This purchase belongs to another Courtside account.');
  const originalID=tx.environment==='Sandbox'?`Sandbox:${tx.originalTransactionId}`:tx.originalTransactionId;
  const [account]=await q('SELECT * FROM entitlements WHERE user_id=$1',[userID]);
  if(tx.environment==='Sandbox'&&account&&!account.original_id.startsWith('Sandbox:'))return;
  const [prior]=await q('SELECT * FROM entitlements WHERE original_id=$1',[originalID]);
  required(!prior||prior.user_id===userID,403,'Purchase already belongs to another account.');
  await q(`INSERT INTO entitlements(user_id,original_id,product_id,expires_at,revoked,signed_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET original_id=$2,product_id=$3,expires_at=$4,revoked=$5,signed_at=$6 WHERE (entitlements.signed_at<=$6 OR (entitlements.original_id LIKE 'Sandbox:%' AND $7=0)) AND ($7=0 OR entitlements.original_id LIKE 'Sandbox:%')`,[userID,originalID,tx.productId,tx.expiresDate||0,tx.revocationDate?1:0,tx.signedDate||0,tx.environment==='Sandbox'?1:0]);
}
export async function verifyNotification(jws,env=process.env) {return verifyStorePayload(jws,'verifyAndDecodeNotification',env);}
export async function hasPlus(q,userID) {const [r]=await q('SELECT expires_at FROM entitlements WHERE user_id=$1 AND revoked=0 AND expires_at>$2',[userID,Date.now()]);return !!r;}
