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
const GH_PEOPLE = lift(/var GH_PEOPLE = PEOPLE\.concat\(\[[^\]]*\]\);/, 'GH_PEOPLE');
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
  vm.runInContext([PEOPLE, GH_PEOPLE, KEYS, SEEDED, DEFAULTS].join('\n'), ctx);
  if (defaults) vm.runInContext('GH_DEFAULTS = ' + JSON.stringify(defaults) + ';', ctx);
  store[ctx.GH_LOGINS] = JSON.stringify(stored);
  if (seeded) store[ctx.GH_SEEDED] = JSON.stringify(seeded);
  vm.runInContext('var logins = JSON.parse(localStorage.getItem(GH_LOGINS)); var ghAt = 1;', ctx);
  vm.runInContext(APPLY + '\napplyDefaults();', ctx);
  return {
    logins: JSON.parse(store[ctx.GH_LOGINS]),
    seeded: JSON.parse(store[ctx.GH_SEEDED] || '{}'),
    cacheDropped: ctx.ghAt === 0,
    shipped: ctx.GH_DEFAULTS,
    roster: ctx.GH_PEOPLE
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

test('Arya is on the commit roster and gets seeded like anyone else', () => {
  const {logins, roster, shipped} = run();
  assert.ok(roster.includes('Arya'), 'the GitHub panel covers Arya');
  assert.equal(shipped.Arya, 'aryatoufanian');
  assert.equal(logins.Arya, 'aryatoufanian');
});

/* Arya runs the bootcamp and is not on the clock, so the commit cards cover
   Arya while the quiet spend check does not. The two lists are the whole of
   that distinction, and swapping one for the other in either place is the
   mistake worth catching — hence a read of the source rather than a run. */
test('the timesheet roster stays free of Arya', () => {
  const people = SRC.match(/var PEOPLE = \[[^\]]*\];/)[0];
  assert.ok(!people.includes('Arya'), 'PEOPLE drives shifts and the ledger');
});

test('the quiet spend check judges only people on the clock', () => {
  const fn = SRC.match(/function quietSpendDays\(\)\{[\s\S]*?\n\}/)[0];
  assert.ok(fn.includes('PEOPLE.indexOf(r.who)'), 'still filtered to PEOPLE');
  assert.ok(!fn.includes('GH_PEOPLE'), 'Arya must not be flagged for a slow commit day');
});

test('every GitHub reader uses the commit roster, not the timesheet', () => {
  const strays = [];
  for (const name of ['applyDefaults', 'refreshGh', 'renderGh', 'buildGhLink', 'ghTeam', 'ghSummary']) {
    const m = SRC.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
    assert.ok(m, 'invoice/index.html no longer contains ' + name);
    m[0].split('\n').forEach(line => {
      if (/(?<!GH_)\bPEOPLE\b/.test(line)) strays.push(name + ': ' + line.trim());
    });
  }
  assert.deepEqual(strays, [], 'a GitHub path left on PEOPLE would silently drop Arya');
});

/* Which number a card shows. The calendar covers private work but counts
   pull requests and reviews too, and misses commits off a default branch —
   so a real commit count always wins, and the calendar only speaks where
   there is nothing public to say. */
test('a commit count always beats a contribution count', () => {
  const fn = lift(/function ghCalendar\(p\)\{[\s\S]*?\n\}/, 'ghCalendar');
  const call = state => {
    const ctx = vm.createContext({ghData: state});
    vm.runInContext(fn + '\nvar out = ghCalendar("Milo");', ctx);
    return ctx.out;
  };
  const cal = {total: 1748, days: {'2026-09-16': 14}};
  assert.equal(call({Milo: {calendar: cal, days: {'2026-09-16': 3}}}), null,
    'public commits exist, so the calendar stays quiet');
  assert.deepEqual(call({Milo: {calendar: cal, days: {}}}), cal,
    'nothing public to count, so the calendar speaks');
  assert.equal(call({Milo: {days: {}}}), null, 'no calendar, nothing to show');
  assert.equal(call({Milo: {calendar: {total: 0, days: {}}, days: {}}}), null,
    'an empty calendar is not a number worth printing');
});
