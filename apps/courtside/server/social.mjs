import {required,text,moderate,uuid} from './security.mjs';
import {courts} from './availability.mjs';
import {hasPlus} from './billing.mjs';

const player=r=>({id:r.id,name:r.name,level:Number(r.level),area:r.area,bio:r.bio||'',utr:r.utr==null?null:Number(r.utr),username:r.username||null,theme:r.theme||'forest',ratingSource:'self-reported'});
export async function socialRoute({db,user,path,method,body,url,blocked,event}) {
  const q=db.query,me=user.id;
  if(path==='/v1/player-profile') {
    if(method==='GET') {const [r]=await q('SELECT d.*,i.username,i.theme FROM users u LEFT JOIN player_details d ON d.user_id=u.id LEFT JOIN player_identity i ON i.user_id=u.id WHERE u.id=$1',[me]);return {...player({...user,...r}),discoverable:!!r?.discoverable};}
    if(method==='PUT') {
      const bio=moderate(text(body.bio||'',0,240,'Bio'));
      const utr=body.utr==null?null:body.utr;
      required(utr===null||(typeof utr==='number'&&Number.isFinite(utr)&&utr>=1&&utr<=16.5),400,'Enter a UTR between 1 and 16.5, or leave it blank.');
      required(typeof body.discoverable==='boolean',400,'Choose whether players can find you.');
      return db.transaction(async tx=>{
        const [old]=await tx('SELECT utr FROM player_details WHERE user_id=$1',[me]);
        await tx('INSERT INTO player_details(user_id,bio,utr,discoverable) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET bio=$2,utr=$3,discoverable=$4',[me,bio,utr,body.discoverable?1:0]);
        if(utr!==null&&(old?.utr==null||Number(old.utr)!==utr))await tx('INSERT INTO rating_entries(id,user_id,rating,recorded_at) VALUES($1,$2,$3,$4)',[uuid(),me,utr,Date.now()]);
        return {ok:true};
      });
    }
  }
  if(path==='/v1/ratings'&&method==='GET')return (await q('SELECT id,rating,recorded_at FROM rating_entries WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 100',[me])).map(r=>({id:r.id,rating:Number(r.rating),recordedAt:Number(r.recorded_at)}));
  if(path==='/v1/players'&&method==='GET') {
    const term=text(url.searchParams.get('q')||'',2,40,'Player name').toLowerCase();
    // Literal substring search, rather than exposing wildcard expansion through LIKE.
    const rows=await q(`SELECT u.id,u.name,u.level,u.area,d.bio,d.utr,i.username,i.theme FROM users u JOIN player_details d ON d.user_id=u.id LEFT JOIN player_identity i ON i.user_id=u.id WHERE d.discoverable=1 AND u.disabled=0 AND u.id<>$1 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$1 AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=$1)) AND (LOWER(u.name) LIKE $2 ESCAPE '!' OR i.username LIKE $2 ESCAPE '!') ORDER BY u.name LIMIT 30`,[me,'%'+term.replace(/^@/,'').replace(/[!%_]/g,c=>'!'+c)+'%']);
    return rows.map(player);
  }
  if(path==='/v1/friends'&&method==='GET') {
    const rows=await q('SELECT f.*,u.id,u.name,u.level,u.area,d.bio,d.utr,i.username,i.theme FROM friendships f JOIN users u ON u.id=CASE WHEN f.low_id=$1 THEN f.high_id ELSE f.low_id END LEFT JOIN player_details d ON d.user_id=u.id LEFT JOIN player_identity i ON i.user_id=u.id WHERE (f.low_id=$1 OR f.high_id=$1) AND u.disabled=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$1 AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=$1)) ORDER BY f.created_at DESC',[me]);
    return rows.map(r=>({...player(r),status:r.status,direction:r.requester_id===me?'outgoing':'incoming'}));
  }
  if(path==='/v1/friends'&&method==='POST') {
    const target=text(body.userID,36,36,'Player');required(target!==me,400,'Choose another player.');
    const [other]=await q('SELECT u.id FROM users u JOIN player_details d ON d.user_id=u.id WHERE u.id=$1 AND u.disabled=0 AND d.discoverable=1',[target]);
    required(other&&!await blocked(q,me,target),404,'Player unavailable.');
    const [low,high]=[me,target].sort();
    return db.transaction(async tx=>{
      const created=await tx('INSERT INTO friendships(low_id,high_id,requester_id,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(low_id,high_id) DO NOTHING RETURNING low_id',[low,high,me,'pending',Date.now()]);
      if(created.length)await event(tx,target,'friend',me,'A new tennis connection',`${user.name} sent you a friend request.`);
      return {ok:true};
    });
  }
  const friend=path.match(/^\/v1\/friends\/([^/]+)$/);
  if(friend&&['PATCH','DELETE'].includes(method)) {
    const [low,high]=[me,friend[1]].sort();
    if(method==='DELETE'){await q('DELETE FROM friendships WHERE low_id=$1 AND high_id=$2',[low,high]);return {ok:true};}
    required(body.accept===true&&!await blocked(q,me,friend[1]),400,'This request cannot be accepted.');
    const updated=await q('UPDATE friendships SET status=$1 WHERE low_id=$2 AND high_id=$3 AND requester_id<>$4 AND status=$5 RETURNING low_id',['accepted',low,high,me,'pending']);
    required(updated.length===1,409,'This request is no longer awaiting your response.');return {ok:true};
  }
  if(path==='/v1/journal'&&method==='GET')return (await q('SELECT j.*,u.name AS opponent_name FROM game_logs j LEFT JOIN users u ON u.id=j.opponent_id WHERE j.user_id=$1 ORDER BY j.played_at DESC,j.id DESC LIMIT 1000',[me])).map(r=>({id:r.id,courtID:r.court_id,playedAt:Number(r.played_at),minutes:Number(r.minutes),format:r.format,result:r.result,note:r.note,opponentID:r.opponent_id,opponentName:r.opponent_name||null}));
  if(path==='/v1/journal'&&method==='POST') {
    const id=text(body.id,36,36,'Session ID');required(/^[0-9a-f-]{36}$/i.test(id),400,'Invalid session identifier.');
    required(courts.some(c=>c.id===body.courtID)||(typeof body.courtID==='string'&&body.courtID.startsWith('place:')&&text(body.courtID.slice(6),2,120,'Court name')),400,'Choose a court or enter its name.');
    required(Number.isSafeInteger(body.playedAt)&&body.playedAt<=Date.now()+60000&&body.playedAt>=946684800000,400,'Choose a past playing date.');
    required(Number.isInteger(body.minutes)&&body.minutes>=15&&body.minutes<=480,400,'Choose a duration from 15 to 480 minutes.');
    required(['Singles','Doubles','Rally','Lesson','Live ball'].includes(body.format)&&['Not scored','Win','Loss','Draw'].includes(body.result),400,'Choose a valid session type and result.');
    const note=text(body.note||'',0,1000,'Notes'),opponent=body.opponentID||null;
    if(opponent){const [low,high]=[me,opponent].sort();const [f]=await q('SELECT status FROM friendships WHERE low_id=$1 AND high_id=$2',[low,high]);required(f?.status==='accepted'&&!await blocked(q,me,opponent),400,'Choose a current friend.');}
    return db.transaction(async tx=>{
      const [existing]=await tx('SELECT * FROM game_logs WHERE id=$1',[id]);
      if(existing){required(existing.user_id===me&&existing.court_id===body.courtID&&Number(existing.played_at)===body.playedAt&&Number(existing.minutes)===body.minutes&&existing.format===body.format&&existing.result===body.result&&existing.note===note&&existing.opponent_id===opponent,409,'This session identifier was already used.');return {id};}
      await tx('INSERT INTO game_logs(id,user_id,court_id,played_at,minutes,format,result,note,opponent_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,me,body.courtID,body.playedAt,body.minutes,body.format,body.result,note,opponent,Date.now()]);return {id};
    });
  }
  const log=path.match(/^\/v1\/journal\/([^/]+)$/);
  if(log&&method==='DELETE'){await q('DELETE FROM game_logs WHERE id=$1 AND user_id=$2',[log[1],me]);return {ok:true};}
  if(path==='/v1/insights'&&method==='GET') {
    required(await hasPlus(q,me),402,'Courtside Plus includes personal insights.');
    const rows=await q('SELECT court_id,played_at,minutes,result FROM game_logs WHERE user_id=$1 ORDER BY played_at',[me]);
    const weeks=[];const now=new Date();const end=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
    for(let i=11;i>=0;i--){const start=end-(i+1)*7*86400000;const entries=rows.filter(r=>Number(r.played_at)>=start&&Number(r.played_at)<start+7*86400000);weeks.push({start,minutes:entries.reduce((n,r)=>n+Number(r.minutes),0),sessions:entries.length});}
    return {weeks,sessions:rows.length,minutes:rows.reduce((n,r)=>n+Number(r.minutes),0),courts:new Set(rows.map(r=>r.court_id)).size,wins:rows.filter(r=>r.result==='Win').length,losses:rows.filter(r=>r.result==='Loss').length};
  }
  return undefined;
}
