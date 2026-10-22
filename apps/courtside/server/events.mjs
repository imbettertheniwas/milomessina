import {required,text,moderate,uuid} from './security.mjs';
import {hasPlus} from './billing.mjs';
const kinds=['Live ball','Doubles','Singles','Social hit','Practice'];
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const base=`SELECT e.*,u.name AS host_name,i.username,(SELECT COUNT(*) FROM event_guests g WHERE g.event_id=e.id) AS guests,CASE WHEN EXISTS(SELECT 1 FROM event_guests g WHERE g.event_id=e.id AND g.user_id=$1) THEN 1 ELSE 0 END AS joined FROM tennis_events e JOIN users u ON u.id=e.host_id LEFT JOIN player_identity i ON i.user_id=u.id WHERE u.disabled=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$1 AND b.blocked_id=e.host_id) OR (b.user_id=e.host_id AND b.blocked_id=$1))`;
const parse=r=>({id:r.id,hostID:r.host_id,hostName:r.host_name,username:r.username||null,title:r.title,kind:r.kind,venue:r.venue,address:r.address,latitude:Number(r.latitude),longitude:Number(r.longitude),start:Number(r.start_at),minutes:Number(r.minutes),capacity:Number(r.capacity),guests:Number(r.guests),note:r.note,status:r.status,joined:!!r.joined});
export async function eventsRoute({db,user,path,method,body,url,blocked,event}) {
 const q=db.query,me=user.id;
 if(path==='/v1/events'&&method==='GET'){
   if(url.searchParams.get('mine')==='true')return (await q(base+` AND (e.host_id=$1 OR EXISTS(SELECT 1 FROM event_guests g WHERE g.event_id=e.id AND g.user_id=$1)) AND e.start_at>$2 ORDER BY e.start_at LIMIT 100`,[me,Date.now()-86400000])).map(parse);
   const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon'));
   required(url.searchParams.has('lat')&&url.searchParams.has('lon')&&finite(lat,-90,90)&&finite(lon,-180,180),400,'Choose an area to explore.');
   const radius=50/111.32,longitudeRadius=radius/Math.max(0.01,Math.cos(lat*Math.PI/180));
   const rows=await q(base+` AND e.status='open' AND e.start_at>$2 AND e.latitude BETWEEN $3 AND $4 AND (ABS(e.longitude-$5)<=$6 OR ABS(e.longitude-$5)>=360-$6) ORDER BY e.start_at LIMIT 100`,[me,Date.now(),lat-radius,lat+radius,lon,longitudeRadius]);
   return rows.map(parse);
 }
 if(path==='/v1/events'&&method==='POST') {
   required(await hasPlus(q,me),402,'Hosting events is included with Courtside Plus.');
   const id=text(body.id,36,36,'Event ID');required(/^[0-9a-f-]{36}$/i.test(id),400,'Invalid event identifier.');
   const title=moderate(text(body.title,4,70,'Title')),venue=moderate(text(body.venue,2,100,'Venue')),address=moderate(text(body.address,2,200,'Address')),note=moderate(text(body.note||'',0,1000,'Details'));
   required(kinds.includes(body.kind),400,'Choose an event format.');
   required(finite(body.latitude,-90,90)&&finite(body.longitude,-180,180),400,'Choose a map location.');
   required(Number.isSafeInteger(body.start)&&body.start>Date.now()&&body.start<Date.now()+90*86400000,400,'Choose a future date within 90 days.');
   required(Number.isInteger(body.minutes)&&body.minutes>=30&&body.minutes<=240&&Number.isInteger(body.capacity)&&body.capacity>=2&&body.capacity<=32,400,'Choose 30–240 minutes and 2–32 players, including you.');
   required(body.venueConfirmed===true,400,'Confirm you have permission to use the venue.');
   return db.transaction(async tx=>{
     const values=[id,me,title,body.kind,venue,address,body.latitude,body.longitude,body.start,body.minutes,body.capacity,note];
     await tx('INSERT INTO tennis_events(id,host_id,title,kind,venue,address,latitude,longitude,start_at,minutes,capacity,note,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO NOTHING',[...values,Date.now()]);
     const [e]=await tx('SELECT * FROM tennis_events WHERE id=$1',[id]);
     required(e.host_id===me&&e.title===title&&e.kind===body.kind&&e.venue===venue&&e.address===address&&Number(e.start_at)===body.start&&Number(e.minutes)===body.minutes&&Number(e.capacity)===body.capacity&&e.note===note&&Number(e.latitude)===body.latitude&&Number(e.longitude)===body.longitude,409,'That event identifier has already been used.');
     await tx('INSERT INTO event_guests(event_id,user_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,me,Date.now()]);return {id};
   });
 }
 const roster=path.match(/^\/v1\/events\/([^/]+)\/players$/);
 if(roster&&method==='GET') {
   const [e]=await q(base+' AND e.id=$2',[me,roster[1]]);required(e,404,'This event is unavailable.');
   required(e.host_id===me||e.joined,403,'Join the event to see its players.');
   return q(`SELECT u.id,u.name,i.username FROM event_guests g JOIN users u ON u.id=g.user_id LEFT JOIN player_identity i ON i.user_id=u.id WHERE g.event_id=$1 AND u.disabled=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=$2 AND b.blocked_id=u.id) OR (b.user_id=u.id AND b.blocked_id=$2)) ORDER BY g.created_at`,[roster[1],me]);
 }
 const match=path.match(/^\/v1\/events\/([^/]+)(?:\/(rsvp))?$/);if(!match)return undefined;
 const id=match[1];
 if(method==='GET'&&!match[2]){const [r]=await q(base+' AND e.id=$2',[me,id]);required(r,404,'This event is unavailable.');return parse(r);}
 if(!['POST','DELETE'].includes(method))return undefined;
 return db.transaction(async tx=>{
   // Row update serializes capacity checks in PostgreSQL and SQLite, including concurrent RSVPs.
   const [e]=await tx('UPDATE tennis_events SET version=version+1 WHERE id=$1 RETURNING *',[id]);
   required(e,404,'Event not found.');
   if(!match[2]){
     required(method==='DELETE'&&e.host_id===me,403,'Only the host can cancel this event.');
     if(e.status!=='cancelled'){
       await tx('UPDATE tennis_events SET status=$1 WHERE id=$2',['cancelled',id]);
       for(const g of await tx('SELECT user_id FROM event_guests WHERE event_id=$1 AND user_id<>$2',[id,me]))await event(tx,g.user_id,'tennis-event',id,'Event cancelled',`${e.title} has been cancelled.`);
     }return {ok:true};
   }
   required(e.host_id!==me,400,'Hosts can cancel their event instead of leaving.');
   if(method==='DELETE'){await tx('DELETE FROM event_guests WHERE event_id=$1 AND user_id=$2',[id,me]);return {ok:true};}
   const [host]=await tx('SELECT disabled FROM users WHERE id=$1',[e.host_id]);
   required(host&&!host.disabled&&!await blocked(tx,me,e.host_id),404,'This event is unavailable.');
   required(e.status==='open'&&Number(e.start_at)>Date.now(),409,'This event is no longer accepting players.');
   if((await tx('SELECT user_id FROM event_guests WHERE event_id=$1 AND user_id=$2',[id,me])).length)return {ok:true};
   const [count]=await tx('SELECT COUNT(*) AS n FROM event_guests WHERE event_id=$1',[id]);required(Number(count.n)<Number(e.capacity),409,'This event has just filled up.');
   await tx('INSERT INTO event_guests(event_id,user_id,created_at) VALUES($1,$2,$3)',[id,me,Date.now()]);
   await event(tx,e.host_id,'tennis-event',id,'Someone’s joining you',`${user.name} joined ${e.title}.`);return {ok:true};
 });
}
