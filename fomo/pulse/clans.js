const $=id=>document.getElementById(id);let snapshot=null,busy=false;
const profit=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',signDisplay:'exceptZero',maximumFractionDigits:2}).format(value):'—';
const confirmed=r=>['Matched','Name match','School match only'].includes(r.status);
function render(){
 if(!snapshot)return;const all=snapshot.records||[],query=$('clan-search').value.toLowerCase(),filter=$('clan-filter').value;
 const rows=all.filter(r=>(r.name+' '+r.school+' '+r.chapter).toLowerCase().includes(query)&&(filter==='all'||(filter==='confirmed'?confirmed(r):!confirmed(r))));
 $('clan-count').textContent=all.filter(confirmed).length.toLocaleString();$('clan-review').textContent=all.filter(r=>!confirmed(r)).length.toLocaleString();
 $('clan-scope').textContent=`${snapshot.coverage.schools} schools · ${snapshot.coverage.chapters} distinct chapters above 10 onboarded`;
 $('clan-time').textContent=snapshot.updatedAt?`Last saved ${new Date(snapshot.updatedAt).toLocaleString()}`:`Manual audit · ${snapshot.observedDate}`;
 const age=snapshot.updatedAt?Date.now()-Date.parse(snapshot.updatedAt):Infinity;
 $('clan-state').textContent=age<=600000?'RECENT SYNC':'SAVED SNAPSHOT';
 $('clan-rows').replaceChildren();
 for(const r of rows){const tr=document.createElement('tr'),identity=document.createElement('td'),link=document.createElement('a'),school=document.createElement('small');link.textContent=r.name;link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';school.textContent=r.school+(r.chapter?' · '+r.chapter:'');identity.append(link,school);tr.append(identity);
  const counts=Array.isArray(r.onboarded)?r.onboarded:r.onboarded==null?[]:[r.onboarded];
  for(const value of [r.members.toLocaleString(),counts.length?counts.join(' / '):'—',profit(r.pnl24hUsd),profit(r.pnlAllTimeUsd),r.status]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
  tr.lastChild.title=r.note||'';if(counts.length>1)tr.children[2].title='Separate duplicate admin rows; not added together.';$('clan-rows').append(tr);
 }
 $('clan-empty').hidden=rows.length>0;
 const capped=snapshot.coverage.cappedQueries?.length||0;
 $('clan-note').textContent='Profit/loss is FOMO’s reported clan P&L in USD for 24 hours or all time; — means not yet available. Clan membership and campus onboarding are separate counts. '+(capped?`${capped} searches reached FOMO’s result limit; discovery may be incomplete. `:'')+'A name match is inferred; uncertain results stay marked for review. Counts refresh only while the connected browser is open and signed in.';
}
async function refresh(){if(busy)return;busy=true;$('clan-refresh').disabled=true;try{const r=await fetch('/api/clans',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.records)||!data.coverage)throw Error();snapshot=data;render();$('clan-error').hidden=true;}catch{$('clan-error').hidden=false;}finally{busy=false;$('clan-refresh').disabled=false;}}
$('clan-search').oninput=render;$('clan-filter').onchange=render;$('clan-refresh').onclick=refresh;
$('clan-connect').onclick=()=>$('clan-setup').showModal();$('clan-close').onclick=()=>$('clan-setup').close();
const timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});void refresh();
