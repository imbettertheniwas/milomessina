import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../invoice/campus.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = data => ({ok:true, status:200, text:async () => JSON.stringify({ok:true, ...data})});
const applicants = [
  {id:'new', status:'new', seat:'pres', school:'Cornell'},
  {id:'reviewing', status:'reviewing', seat:'partner', school:'Emory'},
  {id:'interview', status:'interview', seat:'content', school:'Cornell'},
  {id:'offer', status:'offer', seat:'events', school:'UCLA'},
  {id:'hired', status:'hired', seat:'partner', school:'Cornell'},
  {id:'passed', status:'passed', seat:'events', school:'UCLA'}
].map(row => ({name:row.id, email:row.id + '@example.invalid', received:'2026-09-25', extra:[], ...row}));
const team = [
  {id:'active', status:'active', seat:'partner', state:'NY', campus:'Cornell'},
  {id:'paused', status:'paused', seat:'events', state:'CA', campus:'UCLA'},
  {id:'alumni', status:'alumni', seat:'pres', state:'GA', campus:'Emory'}
].map(row => ({name:row.id, email:row.id + '@example.invalid', ...row}));

function harness(fetchImpl = async () => response({applicants, team}), admin = true) {
  const elements = new Map(), events = new Map(), writes = [], calls = [];
  const on = (key, fn) => { if (!events.has(key)) events.set(key, []); events.get(key).push(fn); };
  const selectIds = new Set(['ap-seat','ap-campus','cm-seat','cm-state','cm-status']);
  const node = (id = '') => {
    let html = '', value = '';
    const classes = new Set();
    return {id, hidden:false, dataset:{}, children:[], options:[], textContent:'',
      get value(){return value;},
      set value(next){value = selectIds.has(id) && !this.options.includes(next) ? '' : next;},
      get innerHTML(){return html;},
      set innerHTML(next){
        html = next; writes.push(id);
        if (selectIds.has(id)) this.options = [...next.matchAll(/<option value="([^"]*)"/g)].map(match => match[1]);
      },
      classList:{toggle(name, enabled){enabled ? classes.add(name) : classes.delete(name);}, contains:name => classes.has(name)},
      addEventListener(type, fn){on(id + ':' + type, fn);},
      getAttribute(name){return name === 'data-ap' ? this.dataset.ap : '';},
      scrollIntoView(){}, focus(){}, setAttribute(){}, removeAttribute(){}};
  };
  const get = id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  get('ap-tabs').children = ['', 'open', 'hired', 'passed'].map(value => {
    const tab = node();tab.dataset.ap = value;return tab;
  });
  get('cm-status').innerHTML = ['', 'working', 'active', 'paused', 'alumni'].map(value => '<option value="' + value + '">').join('');
  const document = {body:{dataset:{consoleView:'overview'}}, getElementById:get, querySelector(){return null;}};
  const location = {hash:'#/overview'};
  const window = {FOMO_SHEET:{endpoint:'https://example.invalid/sheet', identity:()=>({who:'Milo'}), admin:()=>admin, toast(){}},
    addEventListener(type, fn){on('window:' + type, fn);}, dispatchEvent(){}};
  const context = vm.createContext({document, window, location, URL, Blob, AbortSignal, setTimeout,
    CustomEvent:class{constructor(type, options){this.type=type;this.detail=options?.detail;}},
    fetch:async (...args) => {calls.push(args);return fetchImpl(...args);}});
  vm.runInContext(source, context, {filename:'campus.js'});
  const emit = async (key, event = {}) => {
    const id = key.slice(0, key.indexOf(':'));
    for (const fn of events.get(key) || []) await fn.call(get(id), event);
  };
  const activate = async view => {
    location.hash = '#/' + view;document.body.dataset.consoleView = view;
    await emit('window:fomo:view-change');await settle();
  };
  const change = async (id, value, type = 'change') => {get(id).value=value;await emit(id + ':' + type);};
  const rows = id => [...get(id).innerHTML.matchAll(/data-(?:ap|cm)="([^"]+)"/g)].map(match => match[1]).sort();
  return {get, emit, activate, change, rows, writes, calls, window};
}

async function staleApplicants(h) {
  await h.activate('applicants');
  await h.change('ap-seat', 'partner');
  await h.change('ap-campus', 'Cornell');
  await h.change('ap-q', 'hired', 'input');
  const tab = h.get('ap-tabs').children.find(tab => tab.dataset.ap === 'hired');
  await h.emit('ap-tabs:click', {target:{closest:()=>tab}});
  await h.emit('ap-body:click', {target:{closest:()=>({getAttribute:()=> 'hired'})}});
  assert.equal(h.get('ap-detail').hidden, false);
  await h.activate('overview');
}

async function drill(h, detail) {
  await h.emit('window:fomo:campus-drilldown', {detail});
  await h.activate(detail.view);
}

for (const [name, filter, expected] of [
  ['all applicants', {}, ['new','reviewing','interview','offer','hired','passed']],
  ['all open application states', {status:'open'}, ['new','reviewing','interview','offer']],
  ['a seat using its exact id', {seat:'partner'}, ['reviewing','hired']],
  ['an unknown seat id', {seat:'events'}, ['offer','passed']],
  ['an open seat', {seat:'events', status:'open'}, ['offer']]
]) {
  test('overview shows ' + name + ' after clearing stale applicant filters and detail', async () => {
    const h = harness();await staleApplicants(h);
    await drill(h, {view:'applicants', ...filter});
    assert.deepEqual(h.rows('ap-body'), expected.sort());
    assert.equal(h.get('ap-campus').value, '');
    assert.equal(h.get('ap-q').value, '');
    assert.equal(h.get('ap-seat').value, filter.seat || '');
    assert.equal(h.get('ap-detail').hidden, true);
    assert.deepEqual(h.get('ap-tabs').children.filter(tab => tab.classList.contains('on')).map(tab => tab.dataset.ap), [filter.status || '']);
    assert.equal(h.calls.length, 1, 'loaded table is reused');
  });
}

for (const [status, expected] of [
  ['', ['active','paused','alumni']],
  ['working', ['active','paused']],
  ['active', ['active']]
]) {
  test('overview campus status ' + (status || 'all') + ' clears stale roster filters and form', async () => {
    const h = harness();await h.activate('campus');
    await h.change('cm-state', 'GA');await h.change('cm-seat', 'pres');
    await h.change('cm-status', 'alumni');await h.change('cm-q', 'alumni', 'input');
    await h.emit('cm-groups:click', {target:{closest:()=>({getAttribute:()=> 'alumni'})}});
    assert.equal(h.get('cm-form').hidden, false);
    await h.activate('overview');await drill(h, {view:'campus', status});
    assert.deepEqual(h.rows('cm-groups'), expected.sort());
    for (const id of ['cm-state','cm-seat','cm-q']) assert.equal(h.get(id).value, '');
    assert.equal(h.get('cm-status').value, status);
    assert.equal(h.get('cm-form').hidden, true);
    assert.equal(h.calls.length, 1);
  });
}

test('overview counts publish seat ids, including unknown seats, and working count matches its drilldown', async () => {
  const h = harness();h.writes.length = 0;
  await h.emit('window:fomo:ledger-ready');await settle();
  assert.equal(h.writes.includes('ap-body'), false);
  assert.equal(h.writes.includes('cm-groups'), false);
  const stats = h.window.FOMO_CAMPUS_STATS;
  assert.equal(stats.seats.find(seat => seat.label === 'partnerships').id, 'partner');
  assert.equal(stats.seats.find(seat => seat.id === 'events').n, 2);
  await drill(h, {view:'campus', status:'working'});
  assert.equal(h.rows('cm-groups').length, stats.working);
});

test('drilldown keeps its exact seat and open status while the first sheet read is pending', async () => {
  let resolve;
  const pending = new Promise(done => {resolve=done;});
  const h = harness(() => pending);
  await h.emit('window:fomo:ledger-ready');
  h.writes.length = 0;
  await h.emit('window:fomo:campus-drilldown', {detail:{view:'applicants', seat:'events', status:'open'}});
  assert.equal(h.writes.includes('ap-body'), false, 'hidden applicant table is not rendered');
  assert.equal(h.get('ap-seat').value, 'events', 'unknown seat is a valid option before data arrives');
  await h.activate('applicants');
  assert.equal(h.calls.length, 1);
  resolve(response({applicants, team}));await settle();
  assert.deepEqual(h.rows('ap-body'), ['offer']);
  assert.equal(h.get('ap-seat').value, 'events');
});

test('read-only identities can drill into roster data without gaining edit rights', async () => {
  const h = harness(undefined, false);
  await drill(h, {view:'campus', seat:'events', status:'working'});
  assert.deepEqual(h.rows('cm-groups'), ['paused']);
  await h.emit('cm-groups:click', {target:{closest:()=>({getAttribute:()=> 'paused'})}});
  assert.equal(h.get('cm-form').hidden, true);
  assert.equal(h.calls.length, 1);
});
