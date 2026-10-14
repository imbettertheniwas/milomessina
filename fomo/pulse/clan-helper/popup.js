const $=id=>document.getElementById(id);
async function send(message){const r=await chrome.runtime.sendMessage(message);if(r?.error)$('status').textContent=r.error;else await update();}
$('connect').onsubmit=async e=>{e.preventDefault();const password=$('password').value;$('password').value='';await send({type:'connect',password});};
for(const type of ['refresh','pause','resume','disconnect'])$(type).onclick=()=>send({type});
$('discover').onclick=()=>send({type:'refresh',discovery:true});
async function update(){const s=await chrome.storage.local.get(['status','lastSuccess']);$('status').textContent=s.status||'Not connected';$('last').textContent=s.lastSuccess?'Last saved '+new Date(s.lastSuccess).toLocaleString():'';}
chrome.storage.onChanged.addListener(update);void update();
