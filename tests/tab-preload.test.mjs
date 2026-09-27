import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../invoice/tab-preload.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({operator=true,session='session'}={}) {
 const events=new Map(),warmed=[],timers=new Map();let timerId=0,cleared=0;
 const on=(key,fn)=>events.set(key,fn);
 const bridge={ledgerReady:false,session:()=>session,operator:()=>operator,
  read:async()=>({ok:true}),tabData:{warm:async api=>{warmed.push(api);},clear(){cleared++;}}};
 const document={hidden:false,getElementById:()=>({addEventListener:(name,fn)=>on(name,fn)}),addEventListener:on};
 vm.runInNewContext(source,{document,window:{FOMO_SHEET:bridge,addEventListener:on},
  setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
 return {bridge,document,warmed,events,cleared:()=>cleared,
  async flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn();await settle();}};
}
test('common tabs warm only after the primary read and skip already opened views',async()=>{
 const h=setup();await h.flush();assert.deepEqual(h.warmed,[]);
 await h.bridge.read('campus','list');h.events.get('fomo:ledger-ready')();await h.flush();
 assert.deepEqual(h.warmed,['beta','visits','schedules','posts']);
});
test('hidden pages and unauthenticated sessions do not warm tabs; interns cannot warm beta',async()=>{
 for(const session of ['', 'session']){
  const h=setup({session});h.document.hidden=true;h.events.get('fomo:ledger-ready')();await h.flush();
  assert.deepEqual(h.warmed,[]);
 }
 const h=setup({operator:false});h.events.get('fomo:ledger-ready')();await h.flush();
 assert.deepEqual(h.warmed,['visits','schedules','posts','campus']);
});
test('navigation intent preloads its tab and identity changes clear private responses',async()=>{
 const h=setup();h.events.get('pointerover')({target:{closest:()=>({dataset:{go:'beta'}})}});await settle();
 assert.deepEqual(h.warmed,['beta']);h.events.get('fomo:identity')();assert.equal(h.cleared(),1);
});
