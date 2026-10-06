export function validateMemberHistory(value){
 if(value?.available!==true||value.timezone!=='UTC'||!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.days))return null;
 const seen=new Set(),days=[];
 for(const day of value.days){if(!day||!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||!Number.isFinite(Date.parse(day.date))||new Date(day.date).toISOString().slice(0,10)!==day.date||seen.has(day.date)||!Number.isSafeInteger(day.count)||day.count<0)return null;seen.add(day.date);days.push({date:day.date,count:day.count});}
 if(days.reduce((n,d)=>n+d.count,0)!==value.total)return null;
 return {available:true,timezone:'UTC',total:value.total,days:days.sort((a,b)=>a.date.localeCompare(b.date))};
}
export function memberGrowthSeries(history,updatedAt,period=30){
 if(!history)return null;
 const end=Date.parse(updatedAt.slice(0,10)),first=history.days.length?Date.parse(history.days[0].date):end;
 const length=period==='all'?Math.max(1,Math.min(730,Math.round((end-first)/86400000)+1)):Number(period),start=end-(length-1)*86400000,counts=new Map(history.days.map(d=>[d.date,d.count]));
 let cumulative=history.days.filter(d=>Date.parse(d.date)<start).reduce((s,d)=>s+d.count,0);
 return Array.from({length},(_,i)=>{const date=new Date(start+i*86400000).toISOString().slice(0,10),daily=counts.get(date)||0;cumulative+=daily;return {date,daily,cumulative};});
}
