// Pure layouts for the four lenses. They read only the aggregate feed: chapter
// totals and member join counts per Eastern date and hour. No DOM here.
export const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY=86400000,iso=t=>new Date(t).toISOString().slice(0,10),weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
export const goalOf=c=>Math.max(1,Math.ceil(c.active*.8));

// Daily joins from the Eastern-time hourly history, falling back to UTC days.
export function dailyJoins(history){
 if(history?.timeOfDay?.days?.length)return history.timeOfDay.days.map(d=>({date:d.date,count:d.counts.reduce((a,b)=>a+b,0)}));
 return history?.days?.map(d=>({date:d.date,count:d.count}))||[];
}

// Sequential steps 1–4 split the non-zero days at their quartiles, so a few
// record days cannot wash every other day out to the lightest step.
export function stepper(values){
 const sorted=values.filter(v=>v>0).sort((a,b)=>a-b),q=f=>sorted[Math.min(sorted.length-1,Math.floor(f*sorted.length))]??0;
 const cuts=[q(.25),q(.5),q(.75)];
 return v=>v<=0?0:v<=cuts[0]?1:v<=cuts[1]?2:v<=cuts[2]?3:4;
}

export function calendar(days,end,weeks=53){
 const counts=new Map(days.map(d=>[d.date,d.count])),endAt=Date.parse(end),startAt=endAt-(weekday(end)+(weeks-1)*7)*DAY;
 const cells=[],months=[];
 for(let t=startAt,i=0;t<=endAt;t+=DAY,i++){
  const date=iso(t),col=Math.floor(i/7);cells.push({date,count:counts.get(date)||0,col,row:i%7});
  if(date.endsWith('-01')||i===0)months.push({col:date.endsWith('-01')?col:0,label:new Date(t).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})});
 }
 const step=stepper(cells.map(c=>c.count));cells.forEach(c=>c.step=step(c.count));
 const sum=(from,to)=>cells.filter(c=>c.date>=iso(from)&&c.date<=iso(to)).reduce((s,c)=>s+c.count,0);
 const last7=sum(endAt-6*DAY,endAt),prev7=sum(endAt-13*DAY,endAt-7*DAY);
 // Today is partial: a streak still counts if it ran through yesterday.
 let streak=0;for(let i=cells.length-1-(cells.at(-1)?.count?0:1);i>=0&&cells[i].count>0;i--)streak++;
 let longest=0,run=0;for(const c of cells){run=c.count?run+1:0;longest=Math.max(longest,run);}
 const best=cells.reduce((b,c)=>c.count>b.count?c:b,{count:0,date:null});
 return {cells,months:months.filter((m,i,a)=>!i||m.col-a[i-1].col>=3),weeks:Math.ceil(cells.length/7),total:cells.reduce((s,c)=>s+c.count,0),activeDays:cells.filter(c=>c.count).length,best,streak,longest,last7,prev7,change:prev7?(last7-prev7)/prev7:null};
}

export function rhythm(timeOfDay){
 const grid=WEEKDAYS.map(()=>Array(24).fill(0)),dates=WEEKDAYS.map(()=>new Set());
 for(const d of timeOfDay?.days||[]){const w=weekday(d.date);dates[w].add(d.date);d.counts.forEach((n,h)=>grid[w][h]+=n);}
 const total=grid.flat().reduce((a,b)=>a+b,0);let peak={day:0,hour:0,count:0};
 grid.forEach((hours,day)=>hours.forEach((count,hour)=>{if(count>peak.count)peak={day,hour,count};}));
 const byDay=grid.map((hours,day)=>({day,count:hours.reduce((a,b)=>a+b,0),dates:dates[day].size}));
 const busiest=byDay.reduce((b,d)=>d.count>b.count?d:b,byDay[0]),weekend=byDay[0].count+byDay[6].count;
 const step=stepper(grid.flat());
 return {grid,steps:grid.map(h=>h.map(step)),total,peak,byDay,busiest,weekendShare:total?weekend/total:0};
}

// Progress is joined over the rounded-up 80% goal; past-goal chapters keep their real count.
export function race(chapters){
 const rows=chapters.map(c=>{const goal=goalOf(c);return {id:c.id,name:c.name,school:c.shortSchool||c.school,joined:c.joined,active:c.active,goal,progress:c.joined/goal,remaining:Math.max(0,goal-c.joined)};}).sort((a,b)=>b.progress-a.progress||a.id.localeCompare(b.id));
 const open=rows.filter(r=>r.remaining>0),closest=open.reduce((b,r)=>!b||r.remaining<b.remaining||r.remaining===b.remaining&&r.progress>b.progress?r:b,null);
 const mid=rows.length?[...rows].sort((a,b)=>a.progress-b.progress)[Math.floor((rows.length-1)/2)].progress:0;
 return {rows,crossed:rows.length-open.length,closest,median:mid};
}

// A binned dot plot: one column per slice of progress, dots stacked upward.
// Chapters with no members are counted, not drawn: there are too many to stack.
export function dotColumns(rows,{bins=50,cap=1.25,maxStack=12}={}){
 const stacks=new Map(),dots=[],overflow=[];
 for(const r of rows.filter(r=>r.joined>0).sort((a,b)=>b.progress-a.progress||a.id.localeCompare(b.id))){
  const bin=Math.min(bins-1,Math.floor(Math.min(r.progress,cap)/cap*bins)),stack=stacks.get(bin)||0;stacks.set(bin,stack+1);
  if(stack<maxStack)dots.push({...r,bin,stack});
 }
 for(const [bin,count] of stacks)if(count>maxStack)overflow.push({bin,count:count-maxStack});
 return {dots,overflow,starting:rows.filter(r=>r.joined<=0).length,height:Math.min(maxStack,Math.max(1,...stacks.values()))};
}

export function squarify(items,x,y,w,h){
 const out=[],total=items.reduce((s,i)=>s+i.value,0);if(!total||w<=0||h<=0)return out;
 const scale=w*h/total,rest=items.filter(i=>i.value>0).sort((a,b)=>b.value-a.value).map(i=>({...i,area:i.value*scale}));
 const worst=(row,side)=>{const s=row.reduce((a,i)=>a+i.area,0);return Math.max(...row.map(i=>Math.max(side*side*i.area/(s*s),s*s/(side*side*i.area))));};
 const place=row=>{const s=row.reduce((a,i)=>a+i.area,0);
  if(w>=h){const rw=s/h;let cy=y;for(const i of row){out.push({...i,x,y:cy,w:rw,h:i.area/rw});cy+=i.area/rw;}x+=rw;w-=rw;}
  else{const rh=s/w;let cx=x;for(const i of row){out.push({...i,x:cx,y,w:i.area/rh,h:rh});cx+=i.area/rh;}y+=rh;h-=rh;}};
 let row=[];
 while(rest.length){const side=Math.min(w,h);if(!row.length||worst([...row,rest[0]],side)<=worst(row,side))row.push(rest.shift());else{place(row);row=[];}}
 if(row.length)place(row);
 return out;
}

// States are the outer tiles and chapters fill each state; area is members joined.
export function mosaic(chapters,regionOf,width,height,inset=16){
 const groups=new Map();
 for(const c of chapters){if(c.joined<=0)continue;const code=regionOf(c);if(!groups.has(code))groups.set(code,[]);groups.get(code).push(c);}
 const regions=squarify([...groups].map(([code,list])=>({code,value:list.reduce((s,c)=>s+c.joined,0),list})),0,0,width,height);
 return {empty:chapters.filter(c=>c.joined<=0).length,regions:regions.map(r=>{
  const top=r.h>inset*2.2&&r.w>40?inset:0;
  return {code:r.code,value:r.value,x:r.x,y:r.y,w:r.w,h:r.h,tiles:squarify(r.list.map(c=>({id:c.id,name:c.name,school:c.shortSchool||c.school,value:c.joined,goal:goalOf(c),progress:c.joined/goalOf(c)})),r.x,r.y+top,r.w,r.h-top)};
 })};
}
export const progressStep=p=>p>=1?4:p>=.75?3:p>=.5?2:p>=.25?1:0;

// Spend is members joined times the flat per-member cost, summed per school.
// Known aliases share one school; the largest schools get slices, the rest fold into Other.
export const COST_PER_MEMBER=6.25;
export function spend(chapters,schoolOf,{perMember=COST_PER_MEMBER,slices=7}={}){
 const groups=new Map();
 for(const c of chapters){const s=schoolOf(c);if(!groups.has(s.key))groups.set(s.key,{key:s.key,name:s.name,members:0,chapters:0});const g=groups.get(s.key);g.members+=c.joined;g.chapters++;}
 const members=[...groups.values()].reduce((n,g)=>n+g.members,0),total=members*perMember;
 const schools=[...groups.values()].map(g=>({...g,spend:g.members*perMember,share:members?g.members/members:0})).sort((a,b)=>b.members-a.members||a.name.localeCompare(b.name));
 const paid=schools.filter(s=>s.members>0),top=paid.length>slices+1?paid.slice(0,slices):paid,rest=paid.slice(top.length);
 const restMembers=rest.reduce((n,s)=>n+s.members,0);
 const pie=[...top.map((s,i)=>({...s,slot:i})),...(rest.length?[{key:'other',name:`${rest.length} other schools`,members:restMembers,chapters:rest.reduce((n,s)=>n+s.chapters,0),spend:restMembers*perMember,share:restMembers/members,slot:'other',schools:rest.length}]:[])];
 return {total,members,perMember,schools,paid:paid.length,pie};
}

// SVG path for one pie slice; angles are fractions of a turn starting at 12 o'clock.
export function slicePath(cx,cy,r,from,to){
 if(to-from>=1)return `M${cx} ${cy-r}A${r} ${r} 0 1 1 ${cx} ${cy+r}A${r} ${r} 0 1 1 ${cx} ${cy-r}Z`;
 const pt=f=>[(cx+r*Math.sin(f*2*Math.PI)).toFixed(2),(cy-r*Math.cos(f*2*Math.PI)).toFixed(2)];
 const [x1,y1]=pt(from),[x2,y2]=pt(to);
 return `M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 ${to-from>.5?1:0} 1 ${x2} ${y2}Z`;
}
