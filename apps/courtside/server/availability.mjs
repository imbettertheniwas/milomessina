import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {required} from './security.mjs';
export const courts=JSON.parse(readFileSync(new URL('./courts.json',import.meta.url),'utf8')).map(c=>({...c,note:c.id==='balboa'?'Confirm public hours, eligibility and current rental rates with LA Parks.':c.note}));
export const FRESH_MS=180000;
export const liveSources={balboa:{location:'BalboaPayTennis',inspected:true}};
export function calendarURL(id,date) {
  const source=liveSources[id];
  if(!source)return null;
  const url=new URL('https://reg.recreation.parks.lacity.gov/webtrac/web/search.html');
  url.search=new URLSearchParams({location:source.location,InterfaceParameter:'Iframe_Live_WebTrac',module:'FR',arwebsearch_buttonsearch:'yes',date:date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1')});
  return url.toString();
}
export function laDate(date=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function laEpoch(day,seconds) {
  const [month,date,year]=day.split('/').map(Number);
  const anchor=Date.UTC(year,month-1,date,12);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'longOffset'}).formatToParts(anchor).map(p=>[p.type,p.value]));
  const m=parts.timeZoneName.match(/GMT([+-])(\d{2}):(\d{2})/);
  required(m,502,'Unrecognized calendar timezone.');
  const offset=(Number(m[2])*60+Number(m[3]))*(m[1]==='-'?-1:1);
  return Date.UTC(year,month-1,date)+seconds*1000-offset*60000;
}
// Runs in a public calendar document; never clicks a slot or carries a session token into a booking link.
export function extractWebTracDocument() {
  const tables=[...document.querySelectorAll('table[id^="frwebsearch_output_table_"]')];
  return tables.map(table=>{
    const cells=[...table.querySelectorAll('tbody tr:first-child td')].map(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('.mobile-column-header').forEach(n=>n.remove());return copy.textContent.trim();});
    const detail=table.querySelector('a[aria-label^="Item Details"]');
    const container=table.closest('.result-content');
    const links=[...(container?.querySelectorAll('a[role="button"][aria-label^="Book for"]')||[])];
    return {name:cells[1],location:cells[2],sport:cells[3],resourceID:detail?new URL(detail.href).searchParams.get('FMID'):null,
      slots:links.filter(a=>a.classList.contains('success')&&a.getAttribute('aria-disabled')!=='true').map(a=>{
        const p=new URL(a.href).searchParams;
        return {resourceID:p.get('FRFMIDList'),day:p.get('GlobalSalesArea_FRItemBeginDate'),endDay:p.get('GlobalSalesArea_FRItemEndDate'),start:Number(p.get('GlobalSalesArea_FRItemBeginTime')),end:Number(p.get('GlobalSalesArea_FRItemEndTime'))};
      })};
  });
}
export function normalizeRows(rows,courtID,date,checkedAt=Date.now()) {
  required(Array.isArray(rows)&&rows.length>0,502,'Calendar structure not recognized.');
  const source=liveSources[courtID];required(source,400,'Unsupported source.');
  const expected=date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3/$1');
  const results=new Map();
  for(const row of rows) {
    if(row.sport!=='Tennis Court'||/\bpro\b/i.test(row.name))continue;
    required(row.location=== 'Balboa Pay Tennis' && /^\d+$/.test(row.resourceID||''),502,'Calendar identity changed.');
    for(const slot of row.slots) {
      required(slot.resourceID===row.resourceID && slot.day===expected && slot.endDay===expected && Number.isInteger(slot.start)&&Number.isInteger(slot.end)&&slot.start>=0&&slot.end<=86400&&slot.end>slot.start,502,'Calendar date or resource mismatch.');
      const start=laEpoch(slot.day,slot.start),end=laEpoch(slot.endDay,slot.end);
      if(start<=checkedAt)continue;
      const id=createHash('sha256').update(`${courtID}:${row.resourceID}:${start}:${end}`).digest('hex');
      results.set(id,{id,courtID,resourceID:row.resourceID,resourceName:row.name,start,end,checkedAt,bookingURL:calendarURL(courtID,date)});
    }
  }
  // Offer two-hour sessions only when the same resource has adjacent verified slots.
  // Never bridge a gap or infer an unobserved half-hour opening.
  const singles=[...results.values()];
  for(const first of singles) for(const second of singles) {
    if(first.resourceID!==second.resourceID||first.end!==second.start||second.end-first.start>7200000)continue;
    const id=createHash('sha256').update(`${courtID}:${first.resourceID}:${first.start}:${second.end}`).digest('hex');
    results.set(id,{...first,id,end:second.end});
  }
  return [...results.values()].sort((a,b)=>a.start-b.start||a.resourceName.localeCompare(b.resourceName)||a.end-b.end);
}
export async function readAvailability(q,courtID,date,now=Date.now()) {
  required(courts.some(c=>c.id===courtID),404,'Court not found.');
  required(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date)),400,'Choose a valid date.');
  const [row]=await q('SELECT * FROM snapshots WHERE key=$1',[`${courtID}:${date}`]);
  if(!row)return {courtID,date,state:'unavailable',checkedAt:null,slots:[],sourceURL:calendarURL(courtID,date)};
  const fresh=row.state==='live'&&now-Number(row.checked_at)<=FRESH_MS&&Number(row.checked_at)<=now;
  return {courtID,date,state:fresh?'live':row.state==='live'?'stale':'unavailable',checkedAt:Number(row.checked_at),slots:fresh?JSON.parse(row.payload).filter(s=>s.start>now):[],sourceURL:row.source_url};
}
export async function collectCalendar(browser,courtID,date) {
  const url=calendarURL(courtID,date);required(url,400,'Unsupported source.');
  const context=await browser.newContext();
  const page=await context.newPage();
  try {
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    required(response?.ok(),503,'Operator calendar unavailable.');
    await page.locator('table[id^="frwebsearch_output_table_"]').first().waitFor({timeout:20000});
    const rows=[];let completed=false;
    for(let pageNumber=1;pageNumber<=10;pageNumber++) {
      rows.push(...await page.evaluate(extractWebTracDocument));
      const next=page.getByRole('button',{name:`Go To Page ${pageNumber+1}`,exact:true});
      if(await next.count()===0){completed=true;break;}
      const firstID=await page.locator('table[id^="frwebsearch_output_table_"] a[aria-label^="Item Details"]').first().getAttribute('href');
      await next.click();
      await page.waitForFunction(prior=>document.querySelector('table[id^="frwebsearch_output_table_"] a[aria-label^="Item Details"]')?.getAttribute('href')!==prior,firstID,{timeout:20000});
    }
    required(completed,502,'Calendar pagination incomplete.');
    const checkedAt=Date.now();return {slots:normalizeRows(rows,courtID,date,checkedAt),checkedAt,sourceURL:url};
  } finally {await context.close();}
}
