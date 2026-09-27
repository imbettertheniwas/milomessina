import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../invoice/index.html', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const snapshot = name => ({ok:true, roster:[{name}], counts:{}, audit:[], log:[]});
const response = data => ({ok:true, text:async () => JSON.stringify(data)});

function harness() {
  let now = 1000000, paints = 0;
  const nodes = new Map(), requests = [], rosterChanges = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent:'', innerHTML:''});
    return nodes.get(id);
  };
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({
    Date:Clock, AbortSignal, identity:{token:'first-session'}, ENDPOINT:'sheet', PASSCODE:'test',
    $:node, isOperator:() => true, esc:String, toast(){},
    applyRoster(rows) { rosterChanges.push(rows.map(row => row.name)); },
    renderAdmin() { paints++; node('ad-roster').innerHTML = context.adminState.roster.map(row => row.name).join(','); },
    fetch(url, options) {
      const pending = deferred();
      requests.push({...pending, ...JSON.parse(options.body), signal:options.signal});
      return pending.promise;
    }
  });
  vm.runInContext(html.slice(html.indexOf('var adminState ='), html.indexOf('\nfunction adminHeld(')), context);
  return {c:context, requests, node, rosterChanges, tick:ms => {now += ms;}, paints:() => paints};
}

test('admin tab coalesces first loads, paints cached data and refreshes after one minute or explicitly', async () => {
  const {c, requests, node, tick, paints} = harness();
  const first = c.adminLoad(), same = c.adminLoad();
  assert.equal(requests.length, 1);
  requests[0].resolve(response(snapshot('Milo')));
  await Promise.all([first, same]);
  const before = paints();
  await c.adminLoad();
  assert.equal(requests.length, 1);
  assert.equal(node('ad-roster').innerHTML, 'Milo');
  assert.equal(paints(), before + 1);
  const forced = c.adminLoad(true);
  assert.equal(requests.length, 2);
  requests[1].resolve(response(snapshot('Arya'))); await forced;
  tick(60001);
  const expired = c.adminLoad();
  assert.equal(requests.length, 3);
  assert.equal(node('ad-roster').innerHTML, 'Arya', 'keep the current table while checking');
  requests[2].resolve(response(snapshot('Jesse'))); await expired;
  assert.equal(node('ad-roster').innerHTML, 'Jesse');
  assert.match(html, /"ad-refresh"\)\.addEventListener\("click", function\(\)\{ adminLoad\(true\); \}\)/);
});

test('failed background admin reads preserve the existing table and release the shared request', async () => {
  const {c, requests, node, tick} = harness();
  const initial = c.adminLoad(); requests[0].resolve(response(snapshot('Milo'))); await initial;
  tick(60001);
  const refresh = c.adminLoad(); requests[1].reject(new Error('offline')); await refresh;
  assert.equal(node('ad-roster').innerHTML, 'Milo');
  assert.equal(node('ad-note').textContent, 'offline');
  assert.equal(c.adminListFlight, null);
  const retry = c.adminLoad(); assert.equal(requests.length, 3);
  requests[2].resolve(response(snapshot('Arya'))); await retry;
  assert.equal(node('ad-roster').innerHTML, 'Arya');
});

for (const readDuringWrite of [false, true]) {
  test(`admin reads started ${readDuringWrite ? 'during' : 'before'} a write cannot replace the completed change`, async () => {
    const {c, requests} = harness();
    let read, write;
    if (readDuringWrite) { write = c.adminCall('rosteradd', {name:'New member'}); read = c.adminCall('list'); }
    else { read = c.adminCall('list'); write = c.adminCall('rosteradd', {name:'New member'}); }
    const old = assert.rejects(read, error => error.stale === true);
    requests[readDuringWrite ? 0 : 1].resolve(response(snapshot('New member'))); await write;
    requests[readDuringWrite ? 1 : 0].resolve(response(snapshot('Old member'))); await old;
    assert.equal(c.adminState.roster[0].name, 'New member');
    assert.equal(c.adminListFlight, null);
    const fresh = c.adminCall('list'); assert.equal(requests.length, 3);
    requests[2].resolve(response(snapshot('Current member'))); await fresh;
    assert.equal(c.adminState.roster[0].name, 'Current member');
  });
}

test('an old admin load failure cannot replace the status from a successful change', async () => {
  const {c, requests, node} = harness();
  const read = c.adminLoad();
  const write = c.adminDo('rosteradd', {name:'New member'});
  requests[1].resolve(response(snapshot('New member'))); await write;
  node('ad-note').textContent = 'Saved';
  requests[0].reject(new Error('old failure')); await read;
  assert.equal(node('ad-note').textContent, 'Saved');
  assert.equal(node('ad-roster').innerHTML, 'New member');
});

test('admin cache and pending reads cannot cross authenticated sessions', async () => {
  const {c, requests, node, rosterChanges} = harness();
  const initial = c.adminLoad(); requests[0].resolve(response(snapshot('First private roster'))); await initial;
  const old = c.adminLoad(true);
  c.identity = {token:'second-session'};
  const next = c.adminLoad();
  assert.equal(requests.length, 3);
  assert.equal(node('ad-roster').innerHTML, '', 'remove the previous session table before waiting');
  requests[1].resolve(response(snapshot('Old delayed roster'))); await old;
  assert.equal(node('ad-roster').innerHTML, '');
  assert.notEqual(c.adminListFlight, null, 'the old read cannot clear the new pending read');
  requests[2].resolve(response(snapshot('Second private roster'))); await next;
  assert.equal(node('ad-roster').innerHTML, 'Second private roster');
  assert.deepEqual(rosterChanges.map(rows => Array.from(rows)), [['First private roster'], ['Second private roster']]);
});

test('admin read deadlines include selected rows but writes have no read timeout', async () => {
  const {c, requests} = harness();
  for (const [action, expected] of [['list', true], ['rows', true], ['rosteradd', false]]) {
    const operation = c.adminCall(action);
    const request = requests.at(-1);
    assert.equal(request.signal instanceof AbortSignal, expected);
    request.resolve(response(snapshot('Milo'))); await operation;
  }
});

test('a refused mutation invalidates cached freshness and the next tab opening reads again', async () => {
  const {c, requests} = harness();
  const initial = c.adminLoad(); requests[0].resolve(response(snapshot('Milo'))); await initial;
  const change = c.adminDo('rosteradd', {name:'New member'});
  requests[1].resolve(response({ok:false, error:'Change refused'})); await change;
  assert.equal(c.adminAt, 0);
  assert.equal(c.adminBusy, false);
  const next = c.adminLoad(); assert.equal(requests.length, 3);
  requests[2].resolve(response(snapshot('Milo'))); await next;
});
