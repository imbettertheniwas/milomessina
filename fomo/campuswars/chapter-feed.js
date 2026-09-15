export function validateSnapshot(value) {
  if (!value || !Array.isArray(value.chapters) || value.live !== true || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error('Invalid chapter update');
  const ids = new Set();
  for (const c of value.chapters) {
    if (!c || !/^[a-z0-9-]+$/.test(c.id) || c.id === 'empty' || ids.has(c.id) || !['name','letters','school','shortSchool','type','registered'].every(k => typeof c[k] === 'string' && c[k].length > 0) || !Number.isSafeInteger(c.joined) || c.joined < 0 || !Number.isSafeInteger(c.active) || c.active <= 0) throw new Error('Invalid chapter update');
    ids.add(c.id);
  }
  return value;
}

const SNAPSHOT_KEY='campuswars:last-good-chapters:v1';
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}

export function startChapterFeed({initialSnapshot,storageRef=browserStorage(),onUpdate, onStatus, fetchImpl=fetch, documentRef=document, interval=30000, schedule=setTimeout, cancel=clearTimeout,random=Math.random,now=Date.now}) {
  let timer, stopped=false, running=false, controller, failures=0,refreshOnResume=false;
  let signature=initialSnapshot?.chapters?JSON.stringify(initialSnapshot.chapters):'';
  let observedCounts=null;
  let latestAt=Date.parse(initialSnapshot?.updatedAt)||0,lastSaved='';
  // Restore public chapter aggregates before the first network request. Storage
  // is optional: Safari private mode and quota failures must not stop the feed.
  try{
    const cached=validateSnapshot(JSON.parse(storageRef?.getItem(SNAPSHOT_KEY)||'null'));
    if(!initialSnapshot?.updatedAt||Date.parse(cached.updatedAt)>Date.parse(initialSnapshot.updatedAt)){
      onUpdate({...cached,live:false});signature=JSON.stringify(cached.chapters);
      latestAt=Date.parse(cached.updatedAt);lastSaved=JSON.stringify(cached);
      onStatus({live:false,updatedAt:cached.updatedAt});
    }
  }catch{}

  async function refresh() {
    if (stopped || running || documentRef.hidden) return;
    cancel(timer); running=true; controller=new AbortController();
    const timeout=schedule(()=>controller.abort(),12000);
    let retryAfter=0;
    try {
      // Use the public HTTP cache so the CDN can serve shared snapshots and the
      // browser can validate ETags without downloading an unchanged response.
      const response=await fetchImpl('/api/campuswars',{signal:controller.signal});
      retryAfter=Math.min(300000,Math.max(0,Number(response.headers?.get('retry-after'))*1000||0));
      if (!response.ok) throw new Error('Chapter update unavailable');
      const snapshot=validateSnapshot(await response.json());
      if (stopped || documentRef.hidden || controller.signal.aborted) return;
      // Different CDN regions may briefly disagree. Never roll a saved village
      // backward when a visitor reconnects through an older cache.
      const updatedAt=Date.parse(snapshot.updatedAt);
      if(updatedAt<latestAt)throw new Error('Older chapter update');
      const next=JSON.stringify(snapshot.chapters);
      const live=snapshot.stale!==true&&now()-updatedAt<=90000;
      // Establish a network baseline first: saved/initial rosters are not joins.
      const arrivals=live&&observedCounts?snapshot.chapters.flatMap(c=>{
        const from=observedCounts.get(c.id)??0;
        return c.joined>from?[{chapter:c.id,from,to:c.joined}]:[];
      }):[];
      observedCounts=new Map(snapshot.chapters.map(c=>[c.id,c.joined]));
      if (next!==signature) {onUpdate({...snapshot,arrivals}); signature=next;}
      latestAt=updatedAt;
      const saved=JSON.stringify(snapshot);
      if(saved!==lastSaved)try{storageRef?.setItem(SNAPSHOT_KEY,saved);lastSaved=saved;}catch{}
      failures=live?0:failures+1;
      onStatus({live,updatedAt:snapshot.updatedAt});
    } catch {
      if (!stopped&&!documentRef.hidden&&controller.signal.reason!=='hidden'){failures++;onStatus({live:false});}
    } finally {
      cancel(timeout);running=false;
      if (!stopped && !documentRef.hidden){
        const base=Math.min(300000,interval*2**Math.min(failures,4));
        const delay=Math.min(300000,Math.max(retryAfter,base+Math.floor(random()*base*.1)));
        timer=schedule(refresh,refreshOnResume?0:delay);refreshOnResume=false;
      }
    }
  }
  function visibility() {cancel(timer);if(documentRef.hidden)controller?.abort('hidden');else if(running)refreshOnResume=true;else refresh();}
  documentRef.addEventListener('visibilitychange',visibility);
  refresh();
  return {refresh,stop(){stopped=true;cancel(timer);controller?.abort();documentRef.removeEventListener('visibilitychange',visibility);}};
}
