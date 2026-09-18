/* applyDefaults decides which browsers pick up a change to GH_DEFAULTS.
   It got this wrong once: a slot already holding a seeded login was never
   rewritten, so renaming an account left every browser that had opened the
   console calling the old handle forever. The console source is the real
   thing here — the function is lifted out of invoice/index.html rather than
   copied, so a change there has to come past these cases. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../invoice/index.html', import.meta.url), 'utf8');

function lift(re, what){
  const m = SRC.match(re);
  assert.ok(m, 'invoice/index.html no longer contains ' + what);
  return m[0];
}

/* the roster, the storage keys and the function under test, as shipped */
const PEOPLE    = lift(/var PEOPLE = \[[^\]]*\];/,               'PEOPLE');
const KEYS      = lift(/var GH_WEEKS = [\s\S]*?GH_LOGINS = "[^"]*";/, 'the storage keys');
const SEEDED    = lift(/var GH_SEEDED = "[^"]*";/,               'GH_SEEDED');
const DEFAULTS  = lift(/var GH_DEFAULTS = \{[\s\S]*?\};/,        'GH_DEFAULTS');
const APPLY     = lift(/function applyDefaults\(\)\{[\s\S]*?\n\}/, 'applyDefaults');

/* Runs applyDefaults against a browser in a given state and reports what it
   left behind: the logins it would use, and whether it dropped the cache. */
function run({stored = {}, seeded = null, defaults = null} = {}){
  const store = {};
  const ctx = vm.createContext({
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    JSON, console
  });
  vm.runInContext([PEOPLE, KEYS, SEEDED, DEFAULTS].join('\n'), ctx);
  if (defaults) vm.runInContext('GH_DEFAULTS = ' + JSON.stringify(defaults) + ';', ctx);
  store[ctx.GH_LOGINS] = JSON.stringify(stored);
  if (seeded) store[ctx.GH_SEEDED] = JSON.stringify(seeded);
  vm.runInContext('var logins = JSON.parse(localStorage.getItem(GH_LOGINS)); var ghAt = 1;', ctx);
  vm.runInContext(APPLY + '\napplyDefaults();', ctx);
  return {
    logins: JSON.parse(store[ctx.GH_LOGINS]),
    seeded: JSON.parse(store[ctx.GH_SEEDED] || '{}'),
    cacheDropped: ctx.ghAt === 0,
    shipped: ctx.GH_DEFAULTS
  };
}

test('a browser that has never opened the console gets the roster', () => {
  const {logins, shipped} = run();
  assert.equal(logins.Milo, shipped.Milo);
  assert.equal(logins.Bijan, shipped.Bijan);
});

test('a renamed account reaches a browser still holding the old handle', () => {
  const {logins, cacheDropped} = run({
    stored:   {Milo: 'oldhandle', Bijan: 'Code-Atreides'},
    seeded:   {Milo: 'oldhandle', Bijan: 'Code-Atreides'},
    defaults: {Milo: 'newhandle', Bijan: 'Code-Atreides'}
  });
  assert.equal(logins.Milo, 'newhandle');
  assert.equal(logins.Bijan, 'Code-Atreides', 'an unchanged default is left as it is');
  assert.equal(cacheDropped, true, 'counts read under the old handle must not survive');
});

test('a login someone typed by hand survives a change to the default', () => {
  const {logins} = run({
    stored:   {Milo: 'handpicked'},
    seeded:   {Milo: 'oldhandle'},
    defaults: {Milo: 'newhandle'}
  });
  assert.equal(logins.Milo, 'handpicked');
});

test('a login someone cleared stays cleared', () => {
  const {logins} = run({
    stored:   {Milo: ''},
    seeded:   {Milo: 'oldhandle'},
    defaults: {Milo: 'newhandle'}
  });
  assert.equal(logins.Milo, '');
});

test('an unseeded person is filled without disturbing a hand-typed neighbour', () => {
  const {logins} = run({
    stored:   {Milo: 'handpicked'},
    seeded:   null,
    defaults: {Milo: 'newhandle', Luchi: 'ouchip'}
  });
  assert.equal(logins.Milo, 'handpicked', 'never seeded and already set: left alone');
  assert.equal(logins.Luchi, 'ouchip',    'never seeded and empty: filled');
});

test('nothing is written and the cache is kept when the roster is current', () => {
  const current = {Milo: 'samehandle'};
  const {logins, cacheDropped} = run({stored: current, seeded: current, defaults: current});
  assert.equal(logins.Milo, 'samehandle');
  assert.equal(cacheDropped, false, 'a no-op must not force every browser to refetch');
});

test('the shipped roster points at the account that exists today', () => {
  const {shipped} = run();
  assert.equal(shipped.Milo, 'imbettertheniwas');
});
