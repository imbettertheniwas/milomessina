// Joins anonymized call rows (calls.json, built by tools/match-calls.mjs) to the
// live chapter feed. Call outcomes are fixed at export time; chapter progress
// is always read from the live feed.
export const CALL_ROWS=[['showed','Showed up'],['no-show','No-show'],['cancelled','Cancelled']];
export const CHAPTER_COLS=[['none','No chapter signed'],['signed','Signed · 0 members'],['joining','Members joining'],['onboarded','80%+ onboarded']];
const RANK={none:0,signed:1,joining:2,onboarded:3};

export function callRow(outcome){return outcome==='attended'||outcome==='waited'?'showed':outcome==='cancelled'?'cancelled':'no-show';}
export function chapterStage(c){
 if(!c)return 'none';
 return c.joined>=Math.ceil(c.active*.8)?'onboarded':c.joined>0?'joining':'signed';
}
const share=(n,d)=>d?n/d:0;

export function mashCalls(data,chapters){
 const byId=new Map(chapters.map(c=>[c.id,c]));
 const dots=data.callers.map(caller=>{
  const matched=caller.chapters.map(id=>byId.get(id)).filter(Boolean);
  const chapter=matched.sort((a,b)=>RANK[chapterStage(b)]-RANK[chapterStage(a)]||b.joined-a.joined)[0]||null;
  return {...caller,chapter,row:callRow(caller.outcome),col:chapterStage(chapter),
   // The chapter already existed before this person's first call.
   before:!!chapter&&chapter.registered<caller.first};
 });
 const count=fn=>dots.filter(fn).length;
 const funnel={booked:dots.length,showed:count(d=>d.row==='showed'),signed:count(d=>d.col!=='none'),
  joining:count(d=>d.col==='joining'||d.col==='onboarded'),onboarded:count(d=>d.col==='onboarded')};
 funnel.onboardedAfter=count(d=>d.col==='onboarded'&&!d.before);

 // One row per matched chapter, with every call that pointed at it.
 const rows=new Map();
 for(const d of dots)for(const id of d.chapters){
  const c=byId.get(id);if(!c)continue;
  const r=rows.get(id)||{chapter:c,first:d.first,booked:0,showed:0,stage:chapterStage(c)};
  r.booked+=d.booked;r.showed+=d.row==='showed'?1:0;if(d.first<r.first)r.first=d.first;
  rows.set(id,r);
 }
 const matched=[...rows.values()].map(r=>({...r,before:r.chapter.registered<r.first,
  days:Math.round((Date.parse(r.chapter.registered)-Date.parse(r.first))/864e5)}))
  .sort((a,b)=>b.chapter.joined-a.chapter.joined||a.chapter.name.localeCompare(b.chapter.name));

 // Same-period comparison: chapters registered since the first answered booking.
 const since=dots.filter(d=>d.school||d.chapters.length).map(d=>d.first).sort()[0]||data.from;
 const group=list=>{
  const joined=list.reduce((s,c)=>s+c.joined,0),active=list.reduce((s,c)=>s+c.active,0);
  return {chapters:list.length,joined,active,participation:share(joined,active),
   withMembers:share(list.filter(c=>c.joined>0).length,list.length),
   onboarded:share(list.filter(c=>chapterStage(c)==='onboarded').length,list.length),
   avgJoined:share(joined,list.length)};
 };
 const recent=chapters.filter(c=>c.registered>=since);
 const comparison={since,called:group(recent.filter(c=>rows.has(c.id))),uncalled:group(recent.filter(c=>!rows.has(c.id)))};
 return {dots,funnel,matched,comparison};
}
