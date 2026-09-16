export const requestTimes=["10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"];

export const requestTimePattern = /^(?:[1-9]|1[0-2]):[0-5][0-9] (?:AM|PM)$/;
export function formatRequestTime(value: string): string {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return "";
  const [hour, minute] = value.split(":");
  const h = Number(hour);
  return (h % 12 || 12) + ":" + minute + (h < 12 ? " AM" : " PM");
}
export function timeInputValue(value: string): string {
  if (!requestTimePattern.test(value)) return "";
  const [clock, period] = value.split(" ");
  const [hour, minute] = clock.split(":");
  return String(Number(hour) % 12 + (period === "PM" ? 12 : 0)).padStart(2, "0") + ":" + minute;
}

export function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
export function nyToday(now=new Date()) {const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const part=(t:string)=>Number(p.find(v=>v.type===t)?.value);return new Date(part("year"),part("month")-1,part("day"));}
export function validateRequest(value:unknown,now=new Date()):string|null{
  if(!value||typeof value!=="object")return "Please enter your visit details.";
  const v=value as Record<string,unknown>;
  for(const key of ["name","email","social","notes","date","time","requestId","website"])if(typeof v[key]!=="string")return "Please enter valid visit details.";
  if(!(v.name as string).trim()||(v.name as string).length>100)return "Please enter your name.";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email as string)||(v.email as string).length>254)return "Please enter a valid email address.";
  if((v.social as string).length>300||(v.notes as string).length>1500)return "Please shorten your profile link or note.";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date as string))return "Choose a valid date.";
  const [y,m,d]=(v.date as string).split("-").map(Number);const day=new Date(y,m-1,d);
  const today=nyToday(now);const last=new Date(today.getFullYear(),today.getMonth(),today.getDate()+90);
  if(dateKey(day)!==v.date||day<=today||day>last)return "Choose a date from tomorrow through the next 90 days.";
  if(!requestTimePattern.test(v.time as string))return "Choose a preferred start time.";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId as string))return "Please reload the page and try again.";
  if(v.website)return "Your request could not be submitted.";
  return null;
}
