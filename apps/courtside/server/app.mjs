import {randomBytes} from 'node:crypto';
import {uuid,digest,required,fail,text,moderate,newSession,limit,verifyAppleToken,exchangeCode,encrypted,revokeApple,safeEqual} from './security.mjs';
import {courts,readAvailability,FRESH_MS,liveSources,laDate} from './availability.mjs';
import {hasPlus,verifiedTransaction,syncTransaction,verifyNotification} from './billing.mjs';

const TERMS='2026-10-22';
const profile=u=>({id:u.id,name:u.name,level:Number(u.level),area:u.area});
const parseRequest=r=>({id:r.id,ownerID:r.owner_id,player:r.name,level:Number(r.level),courtID:r.court_id,start:Number(r.start_at),end:Number(r.end_at),minLevel:r.level_min,maxLevel:r.level_max,format:r.format,courtBooked:!!r.court_booked,note:r.note,status:r.status,interest:r.interest||null});
export async function event(q,userID,kind,refID,title,body,eventID=uuid()) {
  await q('INSERT INTO alert_events(id,user_id,kind,ref_id,title,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',[eventID,userID,kind,refID,title,body,Date.now()]);
  await q('INSERT INTO deliveries(event_id,token,next_at) SELECT $1,token,$2 FROM devices WHERE user_id=$3 AND enabled=1 ON CONFLICT(event_id,token) DO NOTHING',[eventID,Date.now(),userID]);
}
async function blocked(q,a,b) {return (await q('SELECT user_id FROM blocks WHERE (user_id=$1 AND blocked_id=$2) OR (user_id=$2 AND blocked_id=$1)',[a,b])).length>0;}
async function conversation(q,id,userID) {
  const [c]=await q('SELECT * FROM conversations WHERE id=$1 AND (host_id=$2 OR guest_id=$2)',[id,userID]);
  required(c,404,'Conversation not found.');
  required(c.active&&!await blocked(q,c.host_id,c.guest_id),403,'This conversation is closed.');
  return c;
}
function checkWindow(body) {
  required(Number.isSafeInteger(body.start)&&Number.isSafeInteger(body.end)&&body.start>Date.now()&&body.start<Date.now()+31*86400000&&body.end-body.start>=1800000&&body.end-body.start<=4*3600000,400,'Choose a future playing window between 30 minutes and 4 hours, within the next month.');
}
export function application(db,{env=process.env,verifyIdentity=verifyAppleToken,exchange=exchangeCode,revoke=revokeApple,verifyPurchase=verifiedTransaction}={}) {
  const q=db.query;
  const configured=()=>!!(env.APPLE_SIGNIN_KEY_PATH&&env.APPLE_TEAM_ID&&env.APPLE_SIGNIN_KEY_ID&&env.APPLE_BUNDLE_ID&&env.TOKEN_ENCRYPTION_KEY);
  async function readBody(req) {
    let raw=''; for await(const chunk of req){raw+=chunk;required(Buffer.byteLength(raw)<=65536,413,'Request too large.');}
    try{return raw?JSON.parse(raw):{};}catch{fail(400,'Invalid JSON.');}
  }
  async function route(req,url,body) {
    const method=req.method,path=url.pathname.replace(/\/$/,'');
    await limit(q,`ip:${digest(req.socket.remoteAddress||'unknown')}`,180);
    if(method==='GET'&&path==='/health')return {ok:true};
    if(method==='GET'&&path==='/v1/config') {
      const recent=await q('SELECT court_id FROM snapshots WHERE state=$1 AND checked_at>$2',['live',Date.now()-FRESH_MS]);
      const monitored=[...new Set(recent.map(r=>r.court_id))].filter(id=>(env.LIVE_SOURCES||'').split(',').includes(id));
      return {termsVersion:TERMS,signInAvailable:configured(),monitoredCourtIDs:monitored,salesEnabled:env.ENABLE_SALES==='true'&&configured()&&!!env.APPLE_ROOT_CERT_PATHS&&!!env.APPLE_APP_ID&&!!env.APNS_KEY_PATH&&!!env.APNS_KEY_ID&&monitored.length>0&&!!env.PRIVACY_URL&&!!env.TERMS_URL&&!!env.SUPPORT_EMAIL,privacyURL:env.PRIVACY_URL||null,termsURL:env.TERMS_URL||null,supportEmail:env.SUPPORT_EMAIL||null};
    }
    if(method==='GET'&&path==='/v1/courts')return courts;
    if(method==='GET'&&path==='/v1/availability')return readAvailability(q,url.searchParams.get('courtID'),url.searchParams.get('date'));
    if(method==='POST'&&path==='/v1/auth/challenge') {
      required(configured(),503,'Sign-in is not available yet. You can still explore courts.');
      await limit(q,`auth:${digest(req.socket.remoteAddress||'unknown')}`,10);
      const id=uuid(),nonce=randomBytes(32).toString('hex');
      await q('INSERT INTO challenges(id,nonce,expires_at) VALUES($1,$2,$3)',[id,nonce,Date.now()+300000]);return {id,nonce};
    }
    if(method==='POST'&&path==='/v1/auth/apple') {
      required(body.termsVersion===TERMS&&body.adult===true,400,'Agree to the terms and confirm you are 18 or older.');
      const [challenge]=await q('DELETE FROM challenges WHERE id=$1 AND expires_at>$2 RETURNING nonce',[body.challengeID||'',Date.now()]);
      required(challenge,401,'Sign-in expired. Please try again.');
      const identity=await verifyIdentity(body.identityToken,challenge.nonce,env);
      const tokens=await exchange(text(body.authorizationCode,1,16000,'Apple authorization'),env);
      const second=await verifyIdentity(tokens.id_token,challenge.nonce,env);
      required(identity.sub===second.sub,401,'Apple account did not match.');
      return db.transaction(async tx=>{
        let [user]=await tx('SELECT * FROM users WHERE apple_sub=$1',[identity.sub]);
        if(!user){
          const id=uuid();const name=moderate(text(body.name||'Player',1,40,'Name'));
          required(tokens.refresh_token,401,'Please reconnect your Apple account.');
          await tx('INSERT INTO users(id,apple_sub,name,refresh_token,terms_version,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(apple_sub) DO NOTHING',[id,identity.sub,name,encrypted(tokens.refresh_token,env),TERMS,Date.now()]);
          [user]=await tx('SELECT * FROM users WHERE apple_sub=$1',[identity.sub]);
        }else if(tokens.refresh_token){await tx('UPDATE users SET refresh_token=$1 WHERE id=$2',[encrypted(tokens.refresh_token,env),user.id]);}
        required(!user.disabled,403,'This account is unavailable. Contact support.');
        return {token:await newSession(tx,user.id),profile:profile(user)};
      });
    }
    if(method==='POST'&&path==='/v1/billing/notifications') {
      const notification=await verifyNotification(text(body.signedPayload,1,60000,'Signed notification'),env);
      if(notification.data?.signedTransactionInfo){const tx=await verifyPurchase(notification.data.signedTransactionInfo,env);const [user]=await q('SELECT id FROM users WHERE id=$1',[tx.appAccountToken||'']);if(user)await syncTransaction(q,tx,user.id);}
      return {ok:true};
    }
    if(path.startsWith('/v1/admin/')) {
      required(env.ADMIN_TOKEN&&safeEqual(req.headers.authorization,`Bearer ${env.ADMIN_TOKEN}`),403,'Forbidden.');
      if(method==='GET'&&path==='/v1/admin/reports')return q('SELECT * FROM reports WHERE status=$1 ORDER BY created_at LIMIT 100',['open']);
      const match=path.match(/^\/v1\/admin\/reports\/([^/]+)$/);
      if(match&&method==='PATCH') {
        required(['resolved','dismissed'].includes(body.status),400,'Invalid report status.');
        await q('UPDATE reports SET status=$1 WHERE id=$2',[body.status,match[1]]);return {ok:true};
      }
      const suspend=path.match(/^\/v1\/admin\/users\/([^/]+)\/suspend$/);
      if(suspend&&method==='POST')return db.transaction(async tx=>{
        await tx('UPDATE users SET disabled=1 WHERE id=$1',[suspend[1]]);
        await tx('DELETE FROM sessions WHERE user_id=$1',[suspend[1]]);
        await tx('UPDATE requests SET status=$1 WHERE owner_id=$2',['cancelled',suspend[1]]);
        await tx('UPDATE conversations SET active=0 WHERE host_id=$1 OR guest_id=$1',[suspend[1]]);
        return {ok:true};
      });
      fail(404,'Not found.');
    }
    const bearer=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    required(bearer,401,'Sign in to continue.');
    const [user]=await q('SELECT u.*,s.created_at AS signed_in_at FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.digest=$1 AND s.expires_at>$2 AND u.disabled=0',[digest(bearer),Date.now()]);
    required(user,401,'Your session expired. Please sign in again.');
    const me=user.id;
    if(method!=='GET')await limit(q,`write:${me}`,40);
    if(path==='/v1/me'&&method==='GET')return {...profile(user),plus:await hasPlus(q,me)};
    if(path==='/v1/me'&&method==='PATCH') {
      const name=moderate(text(body.name,1,40,'Name')),area=text(body.area,1,40,'Area');
      required(['Westside','Beverly Hills','Central LA','The Valley'].includes(area)&&Number.isFinite(body.level)&&body.level>=2&&body.level<=5.5,400,'Choose a valid area and playing level.');
      await q('UPDATE users SET name=$1,level=$2,area=$3 WHERE id=$4',[name,body.level,area,me]);return {...profile(user),name,level:body.level,area};
    }
    if(path==='/v1/me'&&method==='DELETE') {
      required(Date.now()-Number(user.signed_in_at)<300000,401,'For account deletion, sign in again to verify it’s you.');
      await revoke(user.refresh_token,env);
      await q('DELETE FROM users WHERE id=$1',[me]);return {ok:true};
    }
    if(path==='/v1/auth/logout'&&method==='POST'){await q('DELETE FROM sessions WHERE digest=$1',[digest(bearer)]);return {ok:true};}
    if(path==='/v1/requests'&&method==='GET') {
      const start=Number(url.searchParams.get('start')||Date.now()),end=Number(url.searchParams.get('end')||Date.now()+31*86400000),minutes=Number(url.searchParams.get('minutes')||30);
      required(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&[30,60,90,120].includes(minutes),400,'Invalid time filter.');
      const rows=await q(`SELECT r.*,u.name,u.level,i.status AS interest FROM requests r JOIN users u ON u.id=r.owner_id LEFT JOIN interests i ON i.request_id=r.id AND i.user_id=$1 WHERE r.end_at>$2 AND u.disabled=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$1 AND b.blocked_id=r.owner_id) OR (b.user_id=r.owner_id AND b.blocked_id=$1)) ORDER BY r.start_at LIMIT 300`,[me,Date.now()]);
      const mine=url.searchParams.get('mine')==='true',area=url.searchParams.get('area'),level=url.searchParams.get('level');
      return rows.filter(r=>mine?(r.owner_id===me||r.interest):(r.status==='open'&&r.owner_id!==me&&Math.min(Number(r.end_at),end)-Math.max(Number(r.start_at),start)>=minutes*60000&&(!area||courts.find(c=>c.id===r.court_id)?.region===area)&&(!level||(Number(level)>=r.level_min&&Number(level)<=r.level_max)))).map(parseRequest);
    }
    if(path==='/v1/requests'&&method==='POST') {
      checkWindow(body);required(courts.some(c=>c.id===body.courtID),400,'Choose a known court.');
      required(Number.isFinite(body.minLevel)&&Number.isFinite(body.maxLevel)&&body.minLevel>=2&&body.maxLevel<=5.5&&body.minLevel<=body.maxLevel&&['Singles','Doubles','Rally'].includes(body.format),400,'Choose a valid level range and format.');
      const [count]=await q('SELECT COUNT(*) AS n FROM requests WHERE owner_id=$1 AND status=$2 AND end_at>$3',[me,'open',Date.now()]);required(Number(count.n)<10,409,'You already have 10 open requests. Close one first.');
      const id=uuid(),note=moderate(text(body.note||'',0,500,'Note'));
      await q('INSERT INTO requests(id,owner_id,court_id,start_at,end_at,level_min,level_max,format,court_booked,note,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,me,body.courtID,body.start,body.end,body.minLevel,body.maxLevel,body.format,body.courtBooked===true?1:0,note,Date.now()]);return {id};
    }
    const request=path.match(/^\/v1\/requests\/([^/]+)(?:\/(interest|accept))?$/);
    if(request) {
      const [,id,action]=request;const [r]=await q('SELECT r.*,u.name,u.level FROM requests r JOIN users u ON u.id=r.owner_id WHERE r.id=$1',[id]);
      required(r&&!await blocked(q,me,r.owner_id),404,'Playing request not found.');
      if(method==='GET'&&!action){const interests=me===r.owner_id?await q('SELECT i.user_id AS id,u.name,u.level,i.status FROM interests i JOIN users u ON u.id=i.user_id WHERE i.request_id=$1 AND i.status=$2 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$3 AND b.blocked_id=i.user_id) OR (b.user_id=i.user_id AND b.blocked_id=$3))',[id,'pending',me]):[];return {request:parseRequest(r),interests};}
      if(method==='DELETE'&&!action) {
        required(r.owner_id===me,403,'Only the host can cancel this request.');
        return db.transaction(async tx=>{
          await tx('UPDATE requests SET status=$1 WHERE id=$2',['cancelled',id]);
          const guests=await tx('SELECT user_id FROM interests WHERE request_id=$1',[id]);
          await tx('UPDATE conversations SET active=0 WHERE request_id=$1',[id]);
          for(const guest of guests)await event(tx,guest.user_id,'request',id,'Playing request cancelled','The host cancelled this playing request.',`cancel:${id}:${guest.user_id}`);
          return {ok:true};
        });
      }
      if(action==='interest'&&method==='DELETE') {
        return db.transaction(async tx=>{
          const [old]=await tx('DELETE FROM interests WHERE request_id=$1 AND user_id=$2 RETURNING status',[id,me]);
          if(old?.status==='accepted'){
            await tx('UPDATE conversations SET active=0 WHERE request_id=$1 AND guest_id=$2',[id,me]);
            await tx('UPDATE requests SET status=$1 WHERE id=$2 AND status=$3',['cancelled',id,'matched']);
            await event(tx,r.owner_id,'request',id,'Your partner withdrew','Your playing partner can no longer make this game.');
          }
          return {ok:true};
        });
      }
      required(r.status==='open'&&Number(r.end_at)>Date.now(),409,'This playing request is no longer open.');
      if(action==='interest'&&method==='POST') {
        required(me!==r.owner_id,400,'You cannot join your own request.');
        required(user.level>=r.level_min&&user.level<=r.level_max,409,'Your playing level is outside this request’s range.');
        return db.transaction(async tx=>{
          const inserted=await tx('INSERT INTO interests(request_id,user_id,created_at) VALUES($1,$2,$3) ON CONFLICT(request_id,user_id) DO NOTHING RETURNING user_id',[id,me,Date.now()]);
          if(inserted.length)await event(tx,r.owner_id,'request',id,'Someone can play',`${user.name} is interested in your playing window.`,`interest:${id}:${me}`);
          return {ok:true};
        });
      }
      if(action==='accept'&&method==='POST') {
        required(r.owner_id===me,403,'Only the host can accept a player.');
        const [interest]=await q('SELECT * FROM interests WHERE request_id=$1 AND user_id=$2 AND status=$3',[id,body.userID||'','pending']);
        required(interest&&!await blocked(q,me,body.userID),409,'This player is no longer available.');
        return db.transaction(async tx=>{
          const updated=await tx('UPDATE requests SET status=$1 WHERE id=$2 AND status=$3 RETURNING id',['matched',id,'open']);
          required(updated.length===1,409,'This request already has a partner.');
          await tx('UPDATE interests SET status=$1 WHERE request_id=$2 AND user_id=$3',['accepted',id,body.userID]);
          await tx('UPDATE interests SET status=$1 WHERE request_id=$2 AND user_id<>$3',['closed',id,body.userID]);
          const conversationID=uuid();await tx('INSERT INTO conversations(id,request_id,host_id,guest_id,created_at) VALUES($1,$2,$3,$4,$5)',[conversationID,id,me,body.userID,Date.now()]);
          await event(tx,body.userID,'conversation',conversationID,'You have a playing partner','Your request was accepted. Confirm the details in Messages.');return {id:conversationID};
        });
      }
    }
    if(path==='/v1/conversations'&&method==='GET')return (await q('SELECT c.*,u.name AS host_name,v.name AS guest_name,r.court_id,r.start_at FROM conversations c JOIN users u ON u.id=c.host_id JOIN users v ON v.id=c.guest_id JOIN requests r ON r.id=c.request_id WHERE (c.host_id=$1 OR c.guest_id=$1) AND c.active=1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=c.host_id AND b.blocked_id=c.guest_id) OR (b.user_id=c.guest_id AND b.blocked_id=c.host_id)) ORDER BY c.created_at DESC',[me])).map(c=>({id:c.id,requestID:c.request_id,peerID:c.host_id===me?c.guest_id:c.host_id,peerName:c.host_id===me?c.guest_name:c.host_name,courtID:c.court_id,start:Number(c.start_at)}));
    const messages=path.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
    if(messages) {
      const c=await conversation(q,messages[1],me);
      if(method==='GET') {
        const before=Number(url.searchParams.get('before')||Date.now()+1),beforeID=url.searchParams.get('beforeID')||'';required(Number.isFinite(before),400,'Invalid message cursor.');
        return (await q('SELECT * FROM messages WHERE conversation_id=$1 AND (created_at<$2 OR (created_at=$2 AND id<$3)) ORDER BY created_at DESC,id DESC LIMIT 100',[c.id,before,beforeID])).reverse().map(m=>({id:m.id,senderID:m.sender_id,body:m.body,createdAt:Number(m.created_at)}));
      }
      if(method==='POST') {
        const bodyText=moderate(text(body.body,1,2000,'Message')),id=text(body.id,36,36,'Message ID');required(/^[0-9a-f-]{36}$/i.test(id),400,'Invalid message ID.');
        await limit(q,`chat:${me}`,20);
        return db.transaction(async tx=>{
          await conversation(tx,c.id,me);
          const [existing]=await tx('SELECT * FROM messages WHERE id=$1',[id]);
          if(existing){required(existing.sender_id===me&&existing.conversation_id===c.id&&existing.body===bodyText,409,'Message identifier was reused.');return {id};}
          await tx('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES($1,$2,$3,$4,$5)',[id,c.id,me,bodyText,Date.now()]);
          await event(tx,c.host_id===me?c.guest_id:c.host_id,'conversation',c.id,'New Courtside message','Your playing partner sent you a message.',`message:${id}`);
          return {id};
        });
      }
    }
    if(path==='/v1/blocks'&&method==='GET')return q('SELECT b.blocked_id AS id,u.name FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=$1',[me]);
    if(path==='/v1/blocks'&&method==='POST') {
      required(body.userID!==me,400,'You cannot block yourself.');
      const [other]=await q('SELECT id FROM users WHERE id=$1',[body.userID||'']);required(other,404,'Player not found.');
      return db.transaction(async tx=>{
        await tx('INSERT INTO blocks(user_id,blocked_id,created_at) VALUES($1,$2,$3) ON CONFLICT(user_id,blocked_id) DO NOTHING',[me,other.id,Date.now()]);
        await tx('UPDATE conversations SET active=0 WHERE (host_id=$1 AND guest_id=$2) OR (host_id=$2 AND guest_id=$1)',[me,other.id]);
        return {ok:true};
      });
    }
    const block=path.match(/^\/v1\/blocks\/([^/]+)$/);
    if(block&&method==='DELETE'){await q('DELETE FROM blocks WHERE user_id=$1 AND blocked_id=$2',[me,block[1]]);return {ok:true};}
    if(path==='/v1/reports'&&method==='POST') {
      const reason=text(body.reason,5,1000,'Report');
      const [target]=await q('SELECT id FROM users WHERE id=$1',[body.userID||'']);required(target&&target.id!==me,400,'Choose another player to report.');
      if(body.messageID){const [m]=await q('SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=$1 AND (c.host_id=$2 OR c.guest_id=$2) AND m.sender_id=$3',[body.messageID,me,target.id]);required(m,404,'Message not found.');}
      const id=uuid();await q('INSERT INTO reports(id,reporter_id,subject_id,message_id,reason,created_at) VALUES($1,$2,$3,$4,$5,$6)',[id,me,target.id,body.messageID||null,reason,Date.now()]);return {id};
    }
    if(path==='/v1/watches'&&method==='GET')return (await q('SELECT * FROM watches WHERE user_id=$1 ORDER BY created_at DESC',[me])).map(w=>({id:w.id,courtID:w.court_id,start:Number(w.start_at),end:Number(w.end_at),duration:w.duration,active:!!w.active}));
    if(path==='/v1/watches'&&method==='POST') {
      checkWindow(body);required([60,90,120].includes(body.duration)&&body.end-body.start>=body.duration*60000,400,'Choose a duration that fits your window.');
      required(await hasPlus(q,me),402,'Courtside Plus is required for court alerts.');
      const availability=await readAvailability(q,body.courtID,laDate(new Date(body.start)));
      required(availability.state==='live'&&(env.LIVE_SOURCES||'').split(',').includes(body.courtID),409,'Live monitoring is not available for this court.');
      const [count]=await q('SELECT COUNT(*) AS n FROM watches WHERE user_id=$1 AND active=1 AND end_at>$2',[me,Date.now()]);required(Number(count.n)<20,409,'You can have up to 20 active court watches.');
      const id=uuid();await q('INSERT INTO watches(id,user_id,court_id,start_at,end_at,duration,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,me,body.courtID,body.start,body.end,body.duration,Date.now()]);return {id};
    }
    const watch=path.match(/^\/v1\/watches\/([^/]+)$/);
    if(watch&&method==='DELETE'){await q('DELETE FROM watches WHERE id=$1 AND user_id=$2',[watch[1],me]);return {ok:true};}
    if(watch&&method==='PATCH'){required(typeof body.active==='boolean',400,'Invalid watch status.');if(body.active)required(await hasPlus(q,me),402,'Restore your subscription to resume alerts.');await q('UPDATE watches SET active=$1 WHERE id=$2 AND user_id=$3',[body.active?1:0,watch[1],me]);return {ok:true};}
    if(path==='/v1/devices'&&method==='PUT') {
      required(/^[0-9a-f]{64,200}$/i.test(body.token||'')&&['sandbox','production'].includes(body.environment),400,'Invalid notification registration.');
      required(env.NODE_ENV!=='production'||body.environment==='production',400,'Invalid push environment.');
      await q('INSERT INTO devices(token,user_id,environment,enabled,quiet_hours,updated_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(token) DO UPDATE SET user_id=$2,environment=$3,enabled=$4,quiet_hours=$5,updated_at=$6',[body.token,me,body.environment,body.enabled===true?1:0,body.quietHours===false?0:1,Date.now()]);return {ok:true};
    }
    if(path==='/v1/devices'&&method==='DELETE'){await q('DELETE FROM devices WHERE token=$1 AND user_id=$2',[body.token||'',me]);return {ok:true};}
    if(path==='/v1/inbox'&&method==='GET')return (await q('SELECT * FROM alert_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[me])).map(e=>({id:e.id,kind:e.kind,refID:e.ref_id,title:e.title,body:e.body,createdAt:Number(e.created_at),read:e.read_at!==null}));
    const inbox=path.match(/^\/v1\/inbox\/([^/]+)\/read$/);
    if(inbox&&method==='POST'){await q('UPDATE alert_events SET read_at=$1 WHERE id=$2 AND user_id=$3',[Date.now(),inbox[1],me]);return {ok:true};}
    if(path==='/v1/billing/transactions'&&method==='POST'){const tx=await verifyPurchase(text(body.jws,1,60000,'Transaction'),env);await syncTransaction(q,tx,me);return {plus:await hasPlus(q,me)};}
    fail(404,'Not found.');
  }
  return async(req,res)=>{
    const requestID=uuid();res.setHeader('X-Request-ID',requestID);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const url=new URL(req.url,'http://localhost');required(req.url.length<3000,414,'Request URL too long.');
      const body=['POST','PUT','PATCH','DELETE'].includes(req.method)?await readBody(req):{};
      const result=await route(req,url,body);res.writeHead(200);res.end(JSON.stringify(result));
    }catch(error){const status=error.status||500;res.writeHead(status);res.end(JSON.stringify({error:status===500?'Something went wrong. Please try again.':error.message,requestID}));if(status===500)console.error(JSON.stringify({requestID,errorType:error.name}));}
  };
}
