import {required,text,moderate} from './security.mjs';
const reserved=new Set(['admin','support','courtside','official','moderator','help','apple','utrsports','utr']);
export async function identityRoute({db,user,path,method,body}) {
  if(path!=='/v1/identity')return undefined;
  if(method==='GET'){const [r]=await db.query('SELECT username,theme FROM player_identity WHERE user_id=$1',[user.id]);return r||{username:null,theme:'forest'};}
  if(method!=='PUT')return undefined;
  const username=moderate(text(body.username,3,20,'Username').toLowerCase());
  required(/^[a-z][a-z0-9_]{2,19}$/.test(username)&&!reserved.has(username),400,'Use 3–20 letters, numbers or underscores, starting with a letter. This name must not be reserved.');
  required(['forest','clay','midnight'].includes(body.theme),400,'Choose a card color.');
  return db.transaction(async q=>{
    const [old]=await q('SELECT username FROM player_identity WHERE user_id=$1',[user.id]);
    required(!old||old.username===username,409,'Your username is already claimed. You can still change your card color.');
    const rows=await q('INSERT INTO player_identity(user_id,username,theme,claimed_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING user_id',[user.id,username,body.theme,Date.now()]);
    const [identity]=await q('SELECT username FROM player_identity WHERE user_id=$1',[user.id]);
    required(identity?.username===username,409,'That username is already taken. Try another.');
    await q('UPDATE player_identity SET theme=$1 WHERE user_id=$2',[body.theme,user.id]);return {ok:true};
  });
}
