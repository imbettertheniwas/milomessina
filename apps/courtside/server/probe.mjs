import {chromium} from 'playwright';
import {collectCalendar,laDate,liveSources} from './availability.mjs';

// Read-only operator verification. Never fabricates or persists openings.
const courtID=process.argv[2]||'balboa';
const date=process.argv[3]||laDate(new Date(Date.now()+86400000));
if(!liveSources[courtID])throw Error('No implemented collector for this facility.');
let browser;
try {
  browser=await chromium.launch({headless:true,timeout:15000});
  const result=await collectCalendar(browser,courtID,date);
  console.log(JSON.stringify({courtID,date,checkedAt:new Date(result.checkedAt).toISOString(),openingCount:result.slots.length,resources:[...new Set(result.slots.map(s=>s.resourceID))].length,sourceURL:result.sourceURL}));
} catch(error) {
  console.error(JSON.stringify({courtID,date,status:'unavailable',errorType:error.name}));
  process.exitCode=1;
} finally {await browser?.close();}
