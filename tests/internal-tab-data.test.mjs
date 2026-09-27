import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../invoice/tab-data.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function setup({token = 'session-one', isOperator = true} = {}) {
  const calls = [], timers = new Map();
  let now = 0, timerId = 0;
  const window = {};
  const context = vm.createContext({window, AbortController, Date: {now: () => now},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, {fn, ms}); return id; },
    clearTimeout(id) { timers.delete(id); }});
  vm.runInContext(source, context);
  const data = window.createInternalTabData({endpoint: '/backend', key: 'shared-key',
    session: () => token, operator: () => isOperator,
    fetch: (url, options) => {
      const pending = deferred();
      calls.push({url, options, body: options.body ? JSON.parse(options.body) : null, ...pending});
      return pending.promise;
    }});
  return {data, calls, timers, setToken(value) { token = value; }, setOperator(value) { isOperator = value; },
    advance(ms) { now += ms; },
    respond(index, output = {ok: true}, status = 200) {
      calls[index].resolve({ok: status >= 200 && status < 300, status, json: async () => output});
    }};
}

test('warming is authenticated, restricted by namespace and operator access', async () => {
  const fixture = setup({token: ''});
  await fixture.data.warm('beta');
  await assert.rejects(fixture.data.read('beta'), {code: 'AUTH_REQUIRED'});
  assert.equal(fixture.calls.length, 0);
  fixture.setToken('signed-in');
  fixture.setOperator(false);
  for (const api of ['beta', 'refer', 'admin', 'forms', 'delete', 'unknown']) await fixture.data.warm(api);
  assert.equal(fixture.calls.length, 0);
  const warm = fixture.data.warm('schedules');
  await tick();
  assert.equal(fixture.calls[0].body._api, 'schedules');
  fixture.respond(0);
  await warm;
  const read = fixture.data.read('campus');
  fixture.respond(1);
  await read;
});

test('foreground reads coalesce equivalent payloads and capture transport identity', async () => {
  const {data, calls, respond} = setup();
  const first = data.read('schedules', 'detail', {id: 2, extra: {b: 2, a: 1}, _session: 'untrusted'});
  const second = data.read('schedules', 'detail', {_session: 'untrusted', extra: {a: 1, b: 2}, id: 2});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/backend');
  assert.equal(calls[0].body._session, 'session-one');
  assert.equal(calls[0].body._key, 'shared-key');
  assert.equal(calls[0].options.method, 'POST');
  assert(calls[0].options.signal instanceof AbortSignal);
  const output = {ok: true, value: 42};
  respond(0, output);
  assert.equal(await first, output);
  assert.equal(await second, output);
  const later = data.read('schedules', 'detail', {id: 2, extra: {b: 2, a: 1}, _session: 'untrusted'});
  assert.equal(calls.length, 2, 'completed foreground reads are never cached');
  respond(1);
  await later;
});

test('warm reads run one at a time and wait behind active foreground work', async () => {
  const {data, calls, respond} = setup();
  const foreground = data.read('campus');
  const beta = data.warm('beta'), schedules = data.warm('schedules');
  await tick();
  assert.equal(calls.length, 1);
  respond(0); await foreground; await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body._api, 'beta');
  respond(1); await beta; await tick();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].body._api, 'schedules');
  respond(2); await schedules;
});

test('opening a queued tab promotes it immediately and shares its pending warm read', async () => {
  const {data, calls, respond} = setup();
  const beta = data.warm('beta'), schedules = data.warm('schedules'), posts = data.warm('posts');
  await tick();
  assert.equal(calls.length, 1);
  const foreground = data.read('schedules');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body._api, 'schedules');
  respond(0); await beta; await tick();
  assert.equal(calls.length, 2, 'remaining speculation waits while the foreground read runs');
  const output = {ok: true, schedules: []};
  respond(1, output);
  assert.equal(await foreground, output);
  assert.equal(await schedules, output);
  await tick();
  assert.equal(calls[2].body._api, 'posts');
  respond(2); await posts;
  const next = data.read('schedules');
  assert.equal(calls.length, 4, 'foreground consumption does not leave a cached snapshot');
  respond(3); await next;
});

test('a successful warm snapshot lasts sixty seconds and is consumed only once', async () => {
  const fixture = setup();
  let warm = fixture.data.warm('beta');
  await tick();
  const output = {ok: true, rows: ['snapshot']};
  fixture.respond(0, output); await warm;
  fixture.advance(59999);
  assert.equal(await fixture.data.read('beta'), output);
  assert.equal(fixture.calls.length, 1);
  const second = fixture.data.read('beta');
  assert.equal(fixture.calls.length, 2);
  fixture.respond(1); await second;
  warm = fixture.data.warm('beta');
  await tick(); fixture.respond(2, output); await warm;
  fixture.advance(60000);
  const expired = fixture.data.read('beta');
  assert.equal(fixture.calls.length, 4);
  fixture.respond(3); await expired;
});

test('fresh reads bypass cached snapshots but share current pending work', async () => {
  const {data, calls, respond} = setup();
  let warm = data.warm('beta');
  await tick(); respond(0, {ok: true, value: 'old'}); await warm;
  const fresh = data.read('beta', 'list', {}, {fresh: true});
  assert.equal(calls.length, 2);
  const other = data.read('beta', 'list', {}, {fresh: true});
  assert.equal(calls.length, 2);
  respond(1, {ok: true, value: 'new'});
  assert.equal((await fresh).value, 'new'); await other;
  warm = data.warm('beta');
  await tick();
  const pending = data.read('beta', 'list', {}, {fresh: true});
  assert.equal(calls.length, 3);
  respond(2); await Promise.all([warm, pending]);
});

test('application errors remain intact and are never stored by warming', async () => {
  const {data, calls, respond} = setup();
  const warm = data.warm('beta');
  await tick();
  const output = {ok: false, error: 'Session expired'};
  respond(0, output);
  assert.equal(await warm, output);
  const read = data.read('beta');
  assert.equal(calls.length, 2);
  respond(1, output);
  assert.equal(await read, output);
});

test('HTTP and network failures are silent only for warm callers, with no retries', async () => {
  const {data, calls, respond} = setup();
  const warm = data.warm('beta');
  await tick();
  const foreground = data.read('beta');
  const rejected = assert.rejects(foreground, {code: 'HTTP_ERROR'});
  respond(0, {}, 503);
  assert.equal(await warm, undefined); await rejected; await tick();
  assert.equal(calls.length, 1);
  const next = data.read('beta');
  const failed = assert.rejects(next, /Offline/);
  calls[1].reject(new Error('Offline'));
  await failed; await tick();
  assert.equal(calls.length, 2);
});

test('invalidation rejects old work immediately and prevents late replies from warming cache', async () => {
  const {data, calls, respond} = setup();
  const warm = data.warm('beta');
  await tick();
  const foreground = data.read('beta');
  const rejected = assert.rejects(foreground, {code: 'STALE'});
  data.invalidate('beta');
  await rejected;
  assert.equal(await warm, undefined);
  assert(calls[0].options.signal.aborted);
  const fresh = data.read('beta');
  respond(0, {ok: true, value: 'before-write'});
  respond(1, {ok: true, value: 'after-write'});
  assert.equal((await fresh).value, 'after-write');
  const another = data.read('beta');
  assert.equal(calls.length, 3);
  respond(2); await another;
});

test('namespace invalidation clears only that namespace and drops its queued work', async () => {
  const {data, calls, respond} = setup();
  const beta = data.warm('beta');
  await tick(); respond(0, {ok: true, beta: true}); await beta;
  const active = data.read('campus');
  const schedules = data.warm('schedules'), posts = data.warm('posts');
  data.invalidate('schedules');
  assert.equal(await schedules, undefined);
  assert.equal((await data.read('beta')).beta, true);
  respond(1); await active; await tick();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].body._api, 'posts');
  respond(2); await posts;
});

test('session changes reject old payloads even without another read', async () => {
  const fixture = setup();
  const old = fixture.data.read('beta');
  const rejected = assert.rejects(old, {code: 'STALE'});
  fixture.setToken('session-two');
  fixture.respond(0, {ok: true, private: 'old-session'});
  await rejected;
  const current = fixture.data.read('beta');
  assert.equal(fixture.calls[1].body._session, 'session-two');
  fixture.respond(1); await current;
});

test('clear cancels queued and active reads and removes completed snapshots', async () => {
  const {data, calls, respond} = setup();
  const beta = data.warm('beta');
  await tick(); respond(0); await beta;
  const active = data.read('campus');
  const rejected = assert.rejects(active, {code: 'STALE'});
  const queued = data.warm('schedules');
  data.clear();
  await rejected;
  assert.equal(await queued, undefined);
  await tick();
  assert.equal(calls.length, 2);
  assert(calls[1].options.signal.aborted);
  const read = data.read('beta');
  assert.equal(calls.length, 3);
  respond(2); await read;
});

test('cached delivery rechecks session and invalidation before returning its snapshot', async () => {
  for (const invalidate of [fixture => fixture.setToken('session-two'), fixture => fixture.data.invalidate('beta')]) {
    const fixture = setup();
    const warm = fixture.data.warm('beta');
    await tick(); fixture.respond(0, {ok: true, private: 'old'}); await warm;
    const read = fixture.data.read('beta');
    const rejected = assert.rejects(read, {code: 'STALE'});
    invalidate(fixture);
    await rejected;
  }
});

test('operator loss discards cached privileged data and cancels queued privileged warming', async () => {
  const fixture = setup();
  const beta = fixture.data.warm('beta');
  await tick(); fixture.respond(0, {ok: true, private: true}); await beta;
  const active = fixture.data.read('campus');
  const queued = fixture.data.warm('refer');
  fixture.setOperator(false);
  const checked = fixture.data.read('beta');
  assert.equal(fixture.calls.length, 3, 'a privileged snapshot cannot survive loss of operator access');
  fixture.respond(1); fixture.respond(2, {ok: false, error: 'Forbidden'});
  await active;
  assert.equal((await checked).ok, false);
  assert.equal(await queued, undefined);
  assert.equal(fixture.calls.length, 3);
});

test('twenty-second deadline covers response body consumption and releases the warm queue', async () => {
  const {data, calls, timers, respond} = setup();
  const read = data.read('beta');
  const rejected = assert.rejects(read, {code: 'TIMEOUT'});
  const body = deferred();
  calls[0].resolve({ok: true, status: 200, json: () => body.promise});
  const queued = data.warm('posts');
  await tick();
  assert.equal(calls.length, 1);
  const timer = [...timers.values()][0];
  assert.equal(timer.ms, 20000);
  timer.fn(); await rejected; await tick();
  assert(calls[0].options.signal.aborted);
  assert.equal(calls[1].body._api, 'posts');
  body.resolve({ok: true, value: 'too late'});
  respond(1); await queued;
  assert.equal(timers.size, 0);
});

test('visits preloads use authenticated same-origin GET and consume the warm inbox once', async () => {
  const {data,calls,respond}=setup({isOperator:false});
  const warm=data.warm('visits');await tick();
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/visits?action=list');
  assert.equal(calls[0].options.method,'GET');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.headers['X-Fomo-Internal-Session'],'session-one');
  assert.equal(calls[0].options.body,undefined);
  assert(calls[0].options.signal instanceof AbortSignal);
  const inbox={requests:[{id:'guest',name:'Guest'}]};
  respond(0,inbox);await warm;
  assert.equal(await data.read('visits'),inbox);
  assert.equal(calls.length,1,'opening the tab consumes its completed authenticated preload');
  const fresh=data.read('visits');assert.equal(calls.length,2);
  respond(1,{requests:[]});await fresh;
});

test('a malformed visit inbox is rejected, never cached, and can be retried', async () => {
  const {data,calls,respond}=setup();
  const warm=data.warm('visits');await tick();
  const foreground=data.read('visits'),failed=assert.rejects(foreground,{code:'INVALID'});
  respond(0,{ok:true});await failed;assert.equal(await warm,undefined);
  const retry=data.read('visits');assert.equal(calls.length,2);
  respond(1,{requests:[]});assert.deepEqual(await retry,{requests:[]});
  const unsupported=data.read('visits','update',{id:'guest'});
  await assert.rejects(unsupported,{code:'INVALID'});
  assert.equal(calls.length,2,'mutations cannot use the preload transport');
});

test('explicit visit refresh discards warm data and preserves unauthorized status for the view', async () => {
  const {data,calls,respond}=setup();
  const warm=data.warm('visits');await tick();respond(0,{requests:[{id:'before'}]});await warm;
  const fresh=data.read('visits','list',{}, {fresh:true});
  const denied=assert.rejects(fresh,{code:'HTTP_ERROR',status:401,message:'Your Internal session expired.'});
  assert.equal(calls.length,2);
  respond(1,{error:'Your Internal session expired.'},401);await denied;
  const again=data.read('visits');assert.equal(calls.length,3,'denial cannot reveal the old preload');
  respond(2,{requests:[]});await again;
});

test('an unauthorized Visits response preserves its status even with a malformed error body', async () => {
  for(const body of [null,'bad response',{error:{message:'not a string'}}]){
    const {data,respond}=setup(),read=data.read('visits');
    const denied=assert.rejects(read,{code:'HTTP_ERROR',status:401,message:'Visit requests could not be loaded. Please try again.'});
    respond(0,body,401);await denied;
  }
});

test('visit writes discard completed snapshots and pending reads without disturbing other tabs', async () => {
  const {data,calls,respond}=setup();
  const other=data.warm('posts');await tick();respond(0,{ok:true,posts:['current']});await other;
  const warm=data.warm('visits');await tick();respond(1,{requests:[{id:'old'}]});await warm;
  data.invalidate('visits');
  const pending=data.read('visits'),stale=assert.rejects(pending,{code:'STALE'});
  assert.equal(calls.length,3);
  data.invalidate('visits');await stale;assert(calls[2].options.signal.aborted);
  const fresh=data.read('visits');respond(2,{requests:[{id:'late'}]});respond(3,{requests:[{id:'new'}]});
  assert.equal((await fresh).requests[0].id,'new');
  assert.equal((await data.read('posts')).posts[0],'current');
  assert.equal(calls.length,4);
});
