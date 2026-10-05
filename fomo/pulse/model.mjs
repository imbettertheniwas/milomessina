export const COLORS=['#a89aff','#7778ff','#e9aeff','#6ce6da','#d7ff9a'];
export function validate(value){
  if(!value||value.live!==true||!Array.isArray(value.chapters)||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Invalid snapshot');
  const ids=new Set();
  const chapters=value.chapters.map(c=>{
    if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['name','school','type','letters','registered'].every(k=>typeof c[k]==='string'&&c[k].length>0)||!/^\d{4}-\d{2}-\d{2}$/.test(c.registered)||!Number.isFinite(Date.parse(c.registered))||!Number.isSafeInteger(c.joined)||c.joined<0||!Number.isSafeInteger(c.active)||c.active<=0)throw Error('Invalid chapter');
    ids.add(c.id);return {id:c.id,name:c.name,school:c.school,shortSchool:c.shortSchool||c.school,type:c.type,letters:c.letters,registered:c.registered,joined:c.joined,active:c.active};
  });
  return {chapters,updatedAt:value.updatedAt,stale:value.stale===true};
}
export function summarize(chapters){
 const joined=chapters.reduce((s,c)=>s+c.joined,0),active=chapters.reduce((s,c)=>s+c.active,0);
 return {joined,active,chapters:chapters.length,schools:new Set(chapters.map(c=>c.school)).size,ready:chapters.filter(c=>c.joined>=Math.ceil(c.active*.8)).length,participation:active?joined/active:0};
}
export function arrivals(previous,next){
 if(!previous)return [];
 const records=new Map(previous.map(c=>[c.id,c]));
 return next.flatMap(c=>{const before=records.get(c.id),count=c.joined-(before?.joined??0);
  // Celebrate an observed crossing, never a chapter already above goal on entry.
  const goalReached=!!before&&before.joined<Math.ceil(before.active*.8)&&c.joined>=Math.ceil(c.active*.8);
  return count>0?[{chapter:c,count,goalReached}]:[];
 });
}
export function hash(str){let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
export function startFeed({onData,onStatus,fetchImpl=fetch,documentRef=document,interval=30000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 let previous=null,latest=0,timer,controller,running=false,stopped=false,failures=0;
 async function refresh(){
  if(stopped||running||documentRef.hidden)return;
  cancel(timer);running=true;controller=new AbortController();const timeout=schedule(()=>controller.abort(),12000);
  try{
   const r=await fetchImpl('/api/campuswars/',{signal:controller.signal});if(!r.ok)throw Error('Feed unavailable');
   const s=validate(await r.json());const at=Date.parse(s.updatedAt);
   if(stopped||documentRef.hidden||controller.signal.aborted)return;
   if(at<latest||at>now()+60000)throw Error('Out of order snapshot');
   const live=!s.stale&&now()-at<=90000;
   const events=live?arrivals(previous,s.chapters):[];
   try{onData(s,events);}catch(error){console.error('PULSE rendering failed',error);throw error;}if(live)previous=s.chapters;
   latest=at;failures=live?0:failures+1;onStatus({live,updatedAt:s.updatedAt});
  }catch{if(!stopped&&!documentRef.hidden){failures++;onStatus({live:false});}}
  finally{cancel(timeout);running=false;if(!stopped&&!documentRef.hidden)timer=schedule(refresh,Math.min(300000,interval*2**Math.min(failures,3)));}
 }
 const visibility=()=>{cancel(timer);if(documentRef.hidden)controller?.abort();else refresh();};
 documentRef.addEventListener('visibilitychange',visibility);refresh();
 return {refresh,stop(){stopped=true;cancel(timer);controller?.abort();documentRef.removeEventListener('visibilitychange',visibility);}};
}

export function chapterState(c){const ratio=c.joined/c.active;return ratio>=.8?'ready':ratio>=.5?'near':'building';}
export function growthSeries(chapters,updatedAt,period=30){const end=Date.parse(updatedAt.slice(0,10)),first=chapters.length?Math.min(...chapters.map(c=>Date.parse(c.registered))):end;const days=period==='all'?Math.max(1,Math.min(730,Math.round((end-first)/86400000)+1)):Number(period);return Array.from({length:days},(_,i)=>{const at=end-(days-1-i)*86400000,date=new Date(at).toISOString().slice(0,10);return {date,daily:chapters.filter(c=>c.registered===date).length,cumulative:chapters.filter(c=>c.registered<=date).length};});}
export function marketRows(chapters,{query='',type='all',signal='all',sort='joined',direction=-1,baseline=new Map(),today=''}={}){const q=query.trim().toLowerCase();return chapters.filter(c=>(type==='all'||c.type===type)&&(!q||[c.name,c.school,c.letters,c.registered].some(v=>v.toLowerCase().includes(q)))&&(signal==='all'||signal==='ready'&&chapterState(c)==='ready'||signal==='near'&&chapterState(c)==='near'||signal==='new'&&c.registered===today||signal==='changes'&&c.joined-(baseline.get(c.id)??0)!==0)).sort((a,b)=>{const value=c=>sort==='ratio'?c.joined/c.active:sort==='remaining'?Math.max(0,Math.ceil(c.active*.8)-c.joined):sort==='delta'?c.joined-(baseline.get(c.id)??0):c[sort];const x=value(a),y=value(b);return (typeof x==='string'?x.localeCompare(y):x-y)*direction||a.id.localeCompare(b.id);});}
