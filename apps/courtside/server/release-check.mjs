import {accessSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Configuration preflight only. Passing this does not certify App Review or live-feed reliability.
export function releaseChecks(env=process.env) {
  const checks=[];
  const add=(name,ok)=>checks.push({name,ok:!!ok});
  for(const name of ['DATABASE_URL','APPLE_TEAM_ID','APPLE_BUNDLE_ID','APPLE_SIGNIN_KEY_ID','APNS_KEY_ID','APPLE_APP_ID','SUPPORT_EMAIL','ADMIN_TOKEN']) add(name,env[name]);
  add('TOKEN_ENCRYPTION_KEY (32 bytes)',Buffer.from(env.TOKEN_ENCRYPTION_KEY||'','base64').length===32);
  for(const name of ['PRIVACY_URL','TERMS_URL']) {
    let valid=false;try {valid=new URL(env[name]).protocol==='https:';}catch{}
    add(name,valid);
  }
  for(const name of ['APPLE_SIGNIN_KEY_PATH','APNS_KEY_PATH','APPLE_ROOT_CERT_PATHS']) {
    const paths=(env[name]||'').split(',').filter(Boolean);
    let readable=paths.length>0;
    for(const path of paths)try {accessSync(path,constants.R_OK);}catch{readable=false;}
    add(name,readable);
  }
  add('LIVE_SOURCES configured',!!env.LIVE_SOURCES);
  add('OPENAI_API_KEY configured',!!env.OPENAI_API_KEY);
  add('OPENAI_MODEL selected',!!env.OPENAI_MODEL);
  add('ENABLE_COACH tested and enabled',env.ENABLE_COACH==='true');
  return checks;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const checks=releaseChecks();
  for(const check of checks)console.log(`${check.ok?'PASS':'MISSING'} ${check.name}`);
  console.log('Manual gates: sustained live calendar checks, deployed API/Postgres, moderation coverage, device push, sandbox purchase/restore/refund, account deletion and full UI audit.');
  process.exitCode=checks.every(c=>c.ok)?0:1;
}
