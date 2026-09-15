// All records contain public aggregate slot ranges, never member identities.
export const RECENT_ARRIVAL_MS=5*60*1000;
export function recentArrivalHistory(records,chapters,now){
  const counts=new Map(chapters.map(c=>[c.id,c.joined]));
  const seen=new Set();
  return (Array.isArray(records)?records:[]).flatMap(r=>{
    const at=Date.parse(r?.at),to=Math.min(r?.to,counts.get(r?.chapter)??0);
    if(!Number.isFinite(at)||at>now||now-at>=RECENT_ARRIVAL_MS||!Number.isSafeInteger(r.from)||!Number.isSafeInteger(r.to)||r.from<0||to<=r.from)return [];
    const key=[r.chapter,r.from,to,at].join(':');if(seen.has(key))return [];seen.add(key);
    return [{chapter:r.chapter,from:r.from,to,at:new Date(at).toISOString()}];
  });
}
export function arrivalRanges(records){
  const groups=new Map();
  for(const r of records){if(!groups.has(r.chapter))groups.set(r.chapter,[]);groups.get(r.chapter).push(r);}
  return [...groups].flatMap(([chapter,ranges])=>{
    const merged=[];
    for(const {from,to} of ranges.sort((a,b)=>a.from-b.from)){
      const last=merged.at(-1);
      if(last&&from<=last.to)last.to=Math.max(last.to,to);else merged.push({chapter,from,to});
    }
    return merged;
  });
}
export function recordArrivalHistory(snapshot,previous){
  const time=Date.parse(snapshot.updatedAt),before=Date.parse(previous?.updatedAt);
  const history=recentArrivalHistory(previous?.recentArrivals,snapshot.chapters,time);
  // After a long outage, counts cannot tell us when people actually joined.
  // Establish a new baseline rather than label old registrations as recent.
  if(previous&&time>before&&time-before<RECENT_ARRIVAL_MS){
    const counts=new Map(previous.chapters.map(c=>[c.id,c.joined]));
    for(const c of snapshot.chapters){const from=counts.get(c.id)??0;if(c.joined>from)history.push({chapter:c.id,from,to:c.joined,at:snapshot.updatedAt});}
  }
  return {...snapshot,recentArrivals:history};
}
