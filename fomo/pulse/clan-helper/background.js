const API='https://milomessina.com/api/clans';
let running=false;
const status=async(message,extra={})=>chrome.storage.local.set({status:message,...extra});
async function eyes(action,body){
 const {token}=await chrome.storage.session.get('token');
 const r=await fetch(API+(action?'?action='+action:''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Eyes-Client':'browser-helper',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Eyes connection failed');return result;
}
async function fomo(tabId,path){
 // Runs a read-only request in the existing FOMO tab. The browser sends its
 // cookies normally; no cookie, token, profile, wallet or individual trade data is read.
 const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async path=>{
  if(location.origin!=='https://fomo.family')throw Error('Open fomo.family first');
  if(!/^\/v2\/clans\/(search\?searchTerm=|[a-f0-9-]{36}\?window=(24h|all))/.test(path))throw Error('Invalid clan request');
  const r=await fetch('https://prod-api.fomo.family'+path,{credentials:'include',headers:{'App-Language':'en'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if([401,403,431].includes(r.status))return {error:'Sign in to FOMO again, then click Refresh.'};
  if(r.status===429)return {error:'FOMO rate limit reached. Wait before refreshing.'};
  if(!r.ok)return {error:'FOMO request failed ('+r.status+') for '+path+'.'};
  const data=await r.json();if(!data.success)return {error:'FOMO could not return clan data.'};
  const raw=path.startsWith('/v2/clans/search?')?data.responseObject?.leaderboard:[data.responseObject];
  if(!Array.isArray(raw))return {error:'FOMO changed its response format.'};
  const profitField=path.endsWith('?window=all')?'pnlAllTimeUsd':'pnl24hUsd';
  return {clans:raw.map(c=>({id:c.id,name:c.name,memberCount:c.memberCount,...(!path.startsWith('/v2/clans/search?')?{[profitField]:typeof c.pnl==='number'&&Number.isFinite(c.pnl)?c.pnl:null}:{})}))};
 },args:[path]});
 const result=results[0]?.result;if(!result||result.error)throw Error(result?.error||'FOMO tab closed or reloaded.');return result.clans;
}
export async function sync(forceDiscovery=false){
 if(running)return;running=true;
 try{
  const {enabled}=await chrome.storage.local.get('enabled');if(!enabled)return;
  const {token}=await chrome.storage.session.get('token');if(!token)throw Error('Connect with your campus admin password.');
  const tabs=await chrome.tabs.query({url:'https://fomo.family/*'});if(!tabs.length)throw Error('Keep a signed-in fomo.family tab open.');
  const tab=tabs.find(t=>t.active)||tabs[0],plan=await eyes('plan');
  const mode=forceDiscovery||!plan.discoveryAt||Date.now()-Date.parse(plan.discoveryAt)>=3600000?'discovery':'counts';
  const startedAt=new Date().toISOString(),clans=new Map(),searches=[];
  // Verify known clan counts first. An auth failure stops after one request.
  const work=[...plan.ids.flatMap(id=>[{id,window:'24h'},{id,window:'all'}]),...(mode==='discovery'?plan.queries.map(query=>({query})):[])];
  for(let i=0;i<work.length;i++){
   if(!(await chrome.storage.local.get('enabled')).enabled)throw Error('Sync paused. Previous data retained.');
   const item=work[i];await status(`${mode==='discovery'?'Searching clans':'Refreshing counts'}: ${i+1} / ${work.length}`);
   const rows=await fomo(tab.id,item.id?`/v2/clans/${item.id}?window=${item.window}`:`/v2/clans/search?searchTerm=${encodeURIComponent(item.query)}`);
   for(const row of rows)clans.set(row.id,{...clans.get(row.id),...row});if(item.query)searches.push({query:item.query,count:rows.length});
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  const result=await eyes('',{mode,startedAt,clans:[...clans.values()],searches});
  await status(`Saved ${result.records} matching clans.`,{lastSuccess:result.updatedAt});
 }catch(error){await status(error.message||'Refresh failed. Previous results retained.');}
 finally{running=false;}
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='clan-sync')void sync();});
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('clan-sync',{periodInMinutes:5}));
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('clan-sync',{periodInMinutes:5}));
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 (async()=>{
  if(message.type==='connect'){
   const data=await eyes('login',{password:message.password});await chrome.storage.session.set({token:data.token});await chrome.storage.local.set({enabled:true});await chrome.alarms.create('clan-sync',{periodInMinutes:5});void sync();return {ok:true};
  }
  if(message.type==='refresh'){void sync(!!message.discovery);return {ok:true};}
  if(message.type==='pause'){await chrome.storage.local.set({enabled:false});await status('Paused. Saved results remain in Eyes.');return {ok:true};}
  if(message.type==='resume'){await chrome.storage.local.set({enabled:true});void sync();return {ok:true};}
  if(message.type==='disconnect'){await chrome.storage.session.remove('token');await chrome.storage.local.set({enabled:false});await status('Disconnected.');return {ok:true};}
  return {error:'Unknown action'};
 })().then(respond,error=>respond({error:error.message}));return true;
});
