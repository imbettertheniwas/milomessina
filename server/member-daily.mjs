// Private CSV rows are reduced to date/count pairs before leaving the server.
export function parseMemberDaily(csv,now=Date.now()){
 const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(quoted){if(c==='"'){if(csv[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Invalid member export');quoted=true;}
  else if(c===','){row.push(field);field='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';closed=false;}
  else{if(closed)throw Error('Invalid member export');field+=c;}
 }
 if(quoted)throw Error('Invalid member export');
 row.push(field);if(row.some(Boolean))rows.push(row);
 const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,'').trim());
 if(!headers||headers.filter(h=>h==='joined').length!==1)throw Error('Member join dates unavailable');
 const index=headers.indexOf('joined'),days=new Map();let total=0;
 for(const row of rows){
  const joined=row[index];
  if(row.length!==headers.length||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(joined))throw Error('Invalid member join date');
  const datePart=joined.slice(0,10);if(!Number.isFinite(Date.parse(datePart))||new Date(datePart).toISOString().slice(0,10)!==datePart)throw Error('Invalid member join date');
  const time=Date.parse(joined);if(!Number.isFinite(time)||time>now+60000)throw Error('Invalid member join date');
  const date=new Date(time).toISOString().slice(0,10);days.set(date,(days.get(date)||0)+1);total++;
 }
 return {available:true,timezone:'UTC',total,days:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count}))};
}
