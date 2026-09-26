import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = file => readFileSync(new URL('../invoice/' + file, import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = data => ({ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data)});

function viewHarness(file, fetchImpl = async () => response({ok:true, posts:[], schedules:[], applicants:[], team:[]})) {
  const elements = new Map(), events = new Map(), calls = [], writes = [], githubCalls = [];
  const on = (key, fn) => { if (!events.has(key)) events.set(key, []); events.get(key).push(fn); };
  const node = (id = '') => {
    let html = '';
    return {id, value:'', hidden:false, open:false, textContent:'', disabled:false, dataset:{}, style:{},
      get innerHTML(){return html;}, set innerHTML(value){html=value; writes.push(id);},
      classList:{toggle(){}, add(){}, remove(){}}, querySelectorAll(){return [];}, querySelector(){return null;},
      addEventListener(type, fn){on(id + ':' + type, fn);}, replaceChildren(){this.innerHTML='';}, append(){},
      setAttribute(){}, getAttribute(){return '';}, scrollIntoView(){}, focus(){}, select(){}, remove(){}};
  };
  const get = id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  const document = {hidden:false, body:{dataset:{consoleView:'ledger'}, appendChild(){}}, getElementById:get,
    querySelector(){return null;}, querySelectorAll(){return [];}, createElement:node,
    addEventListener(type, fn){on('document:' + type, fn);}};
  const location = {hash:'#/ledger', origin:'https://example.invalid', href:'https://example.invalid/internal#/ledger'};
  const window = {FOMO_SHEET:{endpoint:'https://example.invalid/sheet', people:['Milo'], key:'test',
    identity:()=>({who:'Milo'}), session:()=> 'test-session', admin:()=>true, operator:()=>true},
    addEventListener(type, fn){on('window:' + type, fn);}, dispatchEvent(){}};
  const context = vm.createContext({document, window, location, URL, Blob, AbortController, AbortSignal,
    setTimeout, clearTimeout, setInterval(){}, CustomEvent:class{constructor(type){this.type=type;}},
    localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, navigator:{clipboard:{writeText:async()=>{}}},
    loadBetaGithub:async members => {githubCalls.push(members);return [];},
    fetch:async (url, options) => {calls.push({url, options});return fetchImpl(url, options);}});
  vm.runInContext(source(file).replace(/^import [^\n]+\n/gm, ''), context, {filename:file});
  return {context, calls, writes, githubCalls, get, document, location,
    emit:async key => {for (const fn of events.get(key) || []) await fn();}};
}

test('ledger readiness does not fetch or render hidden posts and schedules', async () => {
  for (const file of ['posts.js', 'schedules.js']) {
    const h = viewHarness(file);
    const before = h.writes.length;
    await h.emit('window:fomo:ledger-ready');
    await h.emit('window:fomo:identity');
    assert.equal(h.calls.length, 0, file + ' should wait for its view');
    assert.equal(h.writes.length, before, file + ' should leave hidden content alone');
    h.location.hash = file === 'posts.js' ? '#/posts' : '#/schedules';
    await h.emit('window:fomo:view-change');
    await settle();
    assert.equal(h.calls.length, 1, file + ' loads on first activation');
    await h.emit('window:hashchange');
    await h.emit('window:fomo:view-change');
    assert.equal(h.calls.length, 1, file + ' reuses its loaded response');
  }
});

test('campus overview counts wait for ledger readiness without rendering hidden tables', async () => {
  const h = viewHarness('campus.js');
  h.document.body.dataset.consoleView = 'overview';h.location.hash = '#/overview';
  await h.emit('window:fomo:view-change');
  assert.equal(h.calls.length, 0);
  h.writes.length = 0;
  await h.emit('window:fomo:ledger-ready');await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.includes('ap-body'), false);
  assert.equal(h.writes.includes('cm-groups'), false);
  h.location.hash = '#/applicants';await h.emit('window:fomo:view-change');
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.includes('ap-body'), true);
});

test('schedules paint only the visible subtab and paint newly selected content', () => {
  const h = viewHarness('schedules.js');h.location.hash = '#/schedules';
  vm.runInContext(`globalThis.draws=[];drawBoard=()=>draws.push('board');drawMine=()=>draws.push('mine');drawAll=()=>draws.push('all');
    state.tab='board';render();state.tab='mine';render();state.tab='all';render();`, h.context);
  assert.deepEqual(Array.from(h.context.draws), ['board', 'mine', 'all']);
});

test('sheet reads have bounded waits without timing out or retrying mutations', async () => {
  for (const file of ['campus.js', 'posts.js', 'schedules.js', 'referrals.js']) {
    const h = viewHarness(file);
    const call = file === 'referrals.js' ? 'callRefer' : 'call';
    await vm.runInContext(`${call}('list')`, h.context);
    assert.ok(h.calls[0].options.signal instanceof AbortSignal, file + ' bounds its read');
    await vm.runInContext(`${call}('add', {who:'Milo'})`, h.context);
    assert.equal(h.calls[1].options.signal, undefined, file + ' preserves write completion');
    assert.equal(h.calls.length, 2);
  }
});

test('visit inbox needs one read and opening its hours panel loads hours once', async () => {
  const h = viewHarness('visits.js', async url => response(url.includes('availability') ? {availability:[]} : {requests:[]}));
  h.location.hash = '#/visits';await h.emit('window:fomo:view-change');await settle();
  assert.deepEqual(h.calls.map(call => call.url), ['/api/visits?action=list']);
  assert.equal(vm.runInContext('state.busy', h.context), false);
  h.get('vr-hours').open = true;
  await h.emit('vr-hours:toggle');await settle();
  await h.emit('vr-hours:toggle');await settle();
  assert.deepEqual(h.calls.map(call => call.url), ['/api/visits?action=list', '/api/visits?action=availability']);
});

test('a previous visit load cannot unlock or clear a newer identity request', async () => {
  const first = deferred(), second = deferred();let calls = 0;
  const h = viewHarness('visits.js', () => ++calls === 1 ? first.promise : second.promise);
  const old = vm.runInContext('refresh()', h.context);
  h.location.hash = '#/visits';await h.emit('window:fomo:identity');
  assert.equal(calls, 2);
  first.resolve({ok:false,status:401,json:async()=>({error:'Old session expired'})});await old;
  assert.equal(vm.runInContext('state.busy', h.context), true);
  second.resolve(response({requests:[]}));await settle();
  assert.equal(vm.runInContext('state.authenticated', h.context), true);
  assert.equal(vm.runInContext('state.busy', h.context), false);
});

test('portal checks and API counts start before the slow form index finishes', async () => {
  const sheet = deferred();
  const h = viewHarness('portals.js', async (url, options) => {
    if (options?.method === 'POST') return sheet.promise;
    if (url.includes('/api/visits')) return response({requests:[]});
    if (url.includes('/api/campuswars')) return response({chapters:[]});
    return response({});
  });
  const loading = vm.runInContext('loadIndex(false)', h.context);
  assert.equal(h.calls.filter(call => call.options?.method === 'HEAD').length, 10);
  assert.ok(h.calls.some(call => call.url === '/api/visits?action=list'));
  assert.ok(h.calls.some(call => call.url === '/api/campuswars'));
  sheet.resolve(response({ok:true, portals:[]}));await loading;
});

test('chapter polling coalesces reads, skips hidden views, and reuses unchanged maps', async () => {
  const script = source('chapters.js');
  const loadSource = script.slice(script.indexOf('  function load(force){'), script.indexOf('\n  onLive(true, "loading");'));
  const pending = deferred();let now = 1000000, active = true, calls = 0;
  class TestDate extends Date {static now(){return now;}}
  const context = vm.createContext({Date:TestDate, document:{hidden:false}, AbortController, setTimeout, clearTimeout,
    fetch:async()=>{calls++;return calls === 1 ? pending.promise : response({chapters:[], updatedAt:'today'});},
    isActive:()=>active, onLive(){}, onSource(){}, banner(){}, esc:String, hhmm12:()=>'', niceDate:()=>'',
    el:()=>({}), unitsFrom:rows=>rows});
  vm.runInContext(`var dead=false,pending=null,controller=null,checkedAt=0,renderedSnapshot='',POLL_MS=120000,
    FEED='/api/campuswars',units=[],raw=[],feedAt='',feedStale=false,paintCount=0;
    function render(){paintCount++;}
    ${loadSource}`, context);
  const first = vm.runInContext('load()', context), second = vm.runInContext('load(true)', context);
  assert.equal(first, second);assert.equal(calls, 1);
  pending.resolve(response({chapters:[], updatedAt:'today'}));await first;
  await vm.runInContext('load()', context);assert.equal(calls, 1);
  await vm.runInContext('load(true)', context);assert.equal(calls, 2);assert.equal(context.paintCount, 1);
  active = false;now += 120001;await vm.runInContext('load(true)', context);assert.equal(calls, 2);
  active = true;context.document.hidden = true;await vm.runInContext('load(true)', context);assert.equal(calls, 2);
  context.document.hidden = false;await vm.runInContext('load()', context);assert.equal(calls, 3);
});

test('fresh beta GitHub cache avoids all network reads while explicit refresh bypasses it', async () => {
  let calls = 0;
  const now = () => Date.parse('2026-09-25T18:00:00Z');
  const fetch = async () => {calls++;return response({since:'2026-09-01T00:00:00Z',updatedAt:'2026-09-25T17:59:00Z',
    people:{One:{logins:['one'],days:{'2026-09-25':1}},Two:{logins:['two'],days:{'2026-09-25':2}}}});};
  const context = vm.createContext({fetch, URL});
  vm.runInContext(source('beta-github.js').replace(/^export /gm, ''), context);
  context.members=[{id:'one',name:'One',github:'one'}];
  context.options={startDate:'2026-09-12',endDate:'2026-09-25',now};
  assert.equal((await vm.runInContext('loadBetaGithub(members, options)', context))[0].total, 1);
  assert.equal(calls, 1);
  assert.equal((await vm.runInContext('loadBetaGithub(members, options)', context))[0].total, 1);
  assert.equal(calls, 1);
  context.members=[{id:'two',name:'Two',github:'two'}];
  assert.equal((await vm.runInContext('loadBetaGithub(members, options)', context))[0].total, 2);
  assert.equal(calls, 1, 'another member can reuse the recent shared snapshot');
  await vm.runInContext('loadBetaGithub(members, {...options,force:true})', context);
  assert.equal(calls, 2);
});

test('searching the beta roster preserves the current detail and in-flight GitHub read', async () => {
  const member = {id:'one',name:'One',email:'one@example.invalid',phone:'',github:'one',status:'active',startDate:'2026-09-12',endDate:'2026-09-25'};
  const h = viewHarness('beta-manager.js', async () => response({ok:true,manager:true,group:{id:'all'},members:[member],attendance:[],recaps:[]}));
  h.document.body.dataset.consoleView = 'beta';
  await h.emit('window:fomo:view-change');await settle();
  assert.equal(h.githubCalls.length, 1);
  h.writes.length = 0;h.get('bt-search').value = 'on';
  await h.emit('bt-search:input');await settle();
  assert.equal(h.githubCalls.length, 1);
  assert.equal(h.writes.includes('bt-detail'), false);
  assert.equal(h.writes.includes('bt-roster'), true);
});
