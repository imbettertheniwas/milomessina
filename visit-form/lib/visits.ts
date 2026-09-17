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

/* Availability, set per weekday in the console. Index 0 is Sunday, matching
   Date.getDay(), so the form can look a date up without a lookup table. */
export type DayAvailability = { open: boolean; times: string[] };
export const weekdayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const maxTimesPerDay = 24;

/* Until someone configures it, every day offers what the form always offered,
   so switching this on changes nothing by itself. */
export function defaultAvailability(): DayAvailability[] {
  return weekdayNames.map(() => ({ open: true, times: requestTimes.slice() }));
}

/* "2:15 PM", "2:15pm" and "14:15" are one slot typed three ways. Store one
   spelling so the form and the console cannot disagree about a duplicate. */
export function canonicalTime(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const clock = /^(\d{1,2}):([0-5][0-9])$/.exec(raw);
  if (clock) {
    const hour = Number(clock[1]);
    return hour > 23 ? "" : formatRequestTime(String(hour).padStart(2, "0") + ":" + clock[2]);
  }
  const meridiem = /^(\d{1,2}):([0-5][0-9])\s*([AaPp])\.?[Mm]?\.?$/.exec(raw);
  if (!meridiem) return "";
  const hour = Number(meridiem[1]);
  if (hour < 1 || hour > 12) return "";
  return hour + ":" + meridiem[2] + " " + (meridiem[3].toLowerCase() === "a" ? "AM" : "PM");
}

export function normalizeAvailability(value: unknown): DayAvailability[] {
  if (!Array.isArray(value) || value.length !== weekdayNames.length) return defaultAvailability();
  return weekdayNames.map((_, index) => {
    const entry = (value[index] ?? {}) as Record<string, unknown>;
    const times: string[] = [];
    for (const raw of Array.isArray(entry.times) ? entry.times : []) {
      const time = canonicalTime(raw);
      if (time && times.indexOf(time) === -1 && times.length < maxTimesPerDay) times.push(time);
    }
    times.sort((a, b) => timeInputValue(a).localeCompare(timeInputValue(b)));
    return { open: entry.open === true, times };
  });
}

export function dayIsOpen(availability: DayAvailability[], date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  return availability[new Date(y, m - 1, d).getDay()]?.open === true;
}
