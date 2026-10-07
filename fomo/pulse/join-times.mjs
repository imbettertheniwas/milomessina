export const JOIN_TIMEZONE='America/New_York';
const localClock=new Intl.DateTimeFormat('en-CA',{timeZone:JOIN_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'});
export function localJoinDate(at){
 const p=Object.fromEntries(localClock.formatToParts(new Date(at)).map(p=>[p.type,p.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
export function validateJoinTimes(value,total){
 if(value?.timezone!==JOIN_TIMEZONE||!Array.isArray(value.days))return null;
 const seen=new Set(),days=[];
 for(const d of value.days){
  if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||seen.has(d.date)||!Array.isArray(d.counts)||d.counts.length!==24||!d.counts.every(n=>Number.isSafeInteger(n)&&n>=0))return null;
  seen.add(d.date);days.push({date:d.date,counts:[...d.counts]});
 }
 if(days.reduce((n,d)=>n+d.counts.reduce((a,b)=>a+b,0),0)!==total)return null;
 return {timezone:JOIN_TIMEZONE,days:days.sort((a,b)=>a.date.localeCompare(b.date))};
}
export function joinTimeSummary(history,at,period='all'){
 if(!history)return null;
 const end=localJoinDate(at),start=period==='all'?(history.days[0]?.date||end):new Date(Date.parse(end)-(Number(period)-1)*86400000).toISOString().slice(0,10);
 const hours=Array(24).fill(0);
 for(const d of history.days)if(d.date>=start&&d.date<=end)d.counts.forEach((n,h)=>hours[h]+=n);
 const total=hours.reduce((a,b)=>a+b,0),peak=Math.max(...hours),peakHours=total?hours.flatMap((n,h)=>n===peak?[h]:[]):[];
 const dayparts=[['Overnight',0],['Morning',6],['Afternoon',12],['Evening',18]].map(([label,start])=>({label,start,count:hours.slice(start,start+6).reduce((a,b)=>a+b,0)}));
 return {start,end,hours,total,peak,peakHours,dayparts};
}
export const hourLabel=hour=>`${hour%12||12} ${hour%24<12?'AM':'PM'}`;
export const hourRange=hour=>`${hourLabel(hour)}–${hourLabel((hour+1)%24)}`;
