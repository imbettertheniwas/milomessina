import http2 from 'node:http2';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {database} from './db.mjs';
import {event} from './app.mjs';
import {signedJWT,required} from './security.mjs';
import {collectCalendar,liveSources,laDate,laEpoch,FRESH_MS,readAvailability} from './availability.mjs';

export async function storeSnapshot(db,courtID,date,snapshot) {
  await db.transaction(async q=>{
    const key=`${courtID}:${date}`;
    const [previous]=await q('SELECT * FROM snapshots WHERE key=$1',[key]);
    await q('INSERT INTO snapshots(key,court_id,date,checked_at,state,payload,source_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(key) DO UPDATE SET checked_at=$4,state=$5,payload=$6,source_url=$7',[key,courtID,date,snapshot.checkedAt,'live',JSON.stringify(snapshot.slots),snapshot.sourceURL]);
    // Baseline and recovery do not masquerade as cancellations.
    if(!previous||previous.state!=='live'||snapshot.checkedAt-Number(previous.checked_at)>FRESH_MS)return;
    const priorIDs=new Set(JSON.parse(previous.payload).map(s=>s.id));
    const watches=await q('SELECT w.* FROM watches w JOIN entitlements e ON e.user_id=w.user_id JOIN users u ON u.id=w.user_id WHERE w.court_id=$1 AND w.active=1 AND w.end_at>$2 AND e.expires_at>$2 AND e.revoked=0 AND u.disabled=0',[courtID,Date.now()]);
    for(const slot of snapshot.slots.filter(s=>!priorIDs.has(s.id))) {
      for(const watch of watches) {
        if(slot.start<Number(watch.start_at)||slot.end>Number(watch.end_at)||slot.end-slot.start<watch.duration*60000)continue;
        await event(q,watch.user_id,'opening',`${courtID}|${slot.id}|${date}`,'A court fits your schedule',`${slot.resourceName} has an opening. Availability can change before booking.`,`opening:${watch.id}:${slot.id}`);
      }
    }
  });
}
async function apns(device,payload,env) {
  required(env.APNS_KEY_PATH&&env.APNS_KEY_ID&&env.APPLE_TEAM_ID&&env.APPLE_BUNDLE_ID,503,'Push service is not configured.');
  const now=Math.floor(Date.now()/1000);
  const jwt=signedJWT({iss:env.APPLE_TEAM_ID,iat:now},readFileSync(env.APNS_KEY_PATH),env.APNS_KEY_ID);
  const host=device.environment==='production'?'https://api.push.apple.com':'https://api.sandbox.push.apple.com';
  const client=http2.connect(host);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{client.destroy();reject(Error('APNs timeout'));},10000);
    client.on('error',error=>{clearTimeout(timer);client.destroy();reject(error);});
    const req=client.request({':method':'POST',':path':`/3/device/${device.token}`,authorization:`bearer ${jwt}`,'apns-topic':env.APPLE_BUNDLE_ID,'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(now+120)});
    let responseBody='';let status=500;req.on('response',headers=>{status=Number(headers[':status']);});req.on('data',chunk=>{responseBody+=chunk;});
    req.on('end',()=>{clearTimeout(timer);client.close();let reason;try{reason=JSON.parse(responseBody).reason;}catch{}resolve({status,reason});});req.on('error',error=>{clearTimeout(timer);client.close();reject(error);});req.end(JSON.stringify(payload));
  });
}
export async function deliverNotifications(db,{env=process.env,send=apns}={}) {
  const q=db.query,now=Date.now();
  const jobs=await q('SELECT d.*,v.user_id,v.environment,v.enabled,v.quiet_hours,e.kind,e.ref_id,e.title,e.body,e.created_at FROM deliveries d JOIN devices v ON v.token=d.token JOIN alert_events e ON e.id=d.event_id AND e.user_id=v.user_id WHERE d.state=$1 AND d.next_at<=$2 AND d.lease_until<$2 ORDER BY d.next_at LIMIT 100',['pending',now]);
  for(const job of jobs) {
    const claimed=await q('UPDATE deliveries SET lease_until=$1 WHERE event_id=$2 AND token=$3 AND lease_until<$4 AND state=$5 RETURNING event_id',[now+30000,job.event_id,job.token,now,'pending']);if(!claimed.length)continue;
    let eligible=!!job.enabled;
    if(job.kind==='conversation') {
      const [c]=await q('SELECT * FROM conversations WHERE id=$1 AND active=1',[job.ref_id]);eligible=eligible&&!!c;
    }
    if(job.kind==='opening') {
      const [courtID,id,date]=job.ref_id.split('|');const availability=await readAvailability(q,courtID,date);
      const [entitlement]=await q('SELECT user_id FROM entitlements WHERE user_id=$1 AND expires_at>$2 AND revoked=0',[job.user_id,now]);
      eligible=eligible&&!!entitlement&&availability.state==='live'&&availability.slots.some(s=>s.id===id)&&now-Number(job.created_at)<FRESH_MS;
    }
    if(!eligible){await q('UPDATE deliveries SET state=$1 WHERE event_id=$2 AND token=$3',['skipped',job.event_id,job.token]);continue;}
    const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hourCycle:'h23'}).format(now));
    if(job.quiet_hours&&(hour>=22||hour<7)) {
      if(job.kind==='opening'){await q('UPDATE deliveries SET state=$1 WHERE event_id=$2 AND token=$3',['quiet',job.event_id,job.token]);continue;}
      const day=laDate(new Date(now+(hour>=22?86400000:0))).replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1');
      await q('UPDATE deliveries SET next_at=$1,lease_until=0 WHERE event_id=$2 AND token=$3',[laEpoch(day,7*3600),job.event_id,job.token]);continue;
    }
    try {
      const response=await send(job,{aps:{alert:{title:job.title,body:job.body},sound:'default'},kind:job.kind,refID:job.ref_id},env);
      const status=typeof response==='number'?response:response.status;
      if(status===410||(status===400&&['BadDeviceToken','DeviceTokenNotForTopic'].includes(response.reason))){await q('DELETE FROM devices WHERE token=$1',[job.token]);continue;}
      if(status!==200)throw Error('APNs delivery failed');
      await q('UPDATE deliveries SET state=$1,attempts=attempts+1 WHERE event_id=$2 AND token=$3',['sent',job.event_id,job.token]);
    }catch{
      const attempts=job.attempts+1;
      await q('UPDATE deliveries SET attempts=$1,next_at=$2,lease_until=0,state=$3 WHERE event_id=$4 AND token=$5',[attempts,Date.now()+Math.min(3600000,30000*2**attempts),attempts>=8?'failed':'pending',job.event_id,job.token]);
    }
  }
}
async function main() {
  const db=await database();const pushOnly=process.env.WORKER_MODE==='push';const browser=pushOnly?null:await (await import('playwright')).chromium.launch({headless:true});
  const sources=(process.env.LIVE_SOURCES||'').split(',').filter(id=>liveSources[id]);let stopped=false;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;});
  try {
    while(!stopped) {
      const started=Date.now();
      for(const id of (pushOnly?[]:sources)) {
        const demanded=await db.query('SELECT start_at FROM watches WHERE court_id=$1 AND active=1 AND end_at>$2',[id,Date.now()]);
        const dates=[...new Set([laDate(),laDate(new Date(Date.now()+86400000)),...demanded.map(w=>laDate(new Date(Number(w.start_at))))])].sort().slice(0,9);
        for(const date of dates) {
          try {await storeSnapshot(db,id,date,await collectCalendar(browser,id,date));}
          catch {await db.query('UPDATE snapshots SET state=$1 WHERE key=$2',['unavailable',`${id}:${date}`]);console.warn(JSON.stringify({source:id,date,status:'unavailable'}));}
        }
      }
      await deliverNotifications(db);
      await db.query('DELETE FROM challenges WHERE expires_at<$1',[Date.now()]);
      await db.query('DELETE FROM sessions WHERE expires_at<$1',[Date.now()]);
      await db.query('DELETE FROM rate_limits WHERE resets_at<$1',[Date.now()-86400000]);
      await db.query('DELETE FROM snapshots WHERE checked_at<$1',[Date.now()-7*86400000]);
      await db.query('DELETE FROM alert_events WHERE created_at<$1',[Date.now()-30*86400000]);
      await new Promise(resolve=>setTimeout(resolve,Math.max(1000,(pushOnly?5000:120000)-(Date.now()-started))));
    }
  } finally {await browser?.close();await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
