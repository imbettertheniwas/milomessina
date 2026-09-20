import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

/* The referral half of fomo/setup/apps-script.gs, run against a fake
   spreadsheet.

   Two things are worth testing here and the rest follows from them.
   The first is the sweep: referrals are not typed by anybody, they are
   derived from submissions that already landed on the form tabs, so the
   question is whether it finds every one exactly once and prices it
   right. The second is that money only ever moves forward — a console
   that can walk a row back out of `paid` is a console that can pay the
   same person twice. */

const APPLY = ['received','page','seat','full name','email','phone','university','ref','ref seen'];
const SUBMIT = ['received','page','full name','email','handle','platform','video url','ref'];
const ONBOARD = ['received','page','clan','school','fomo username','full name','email','ref'];
const REPORT = ['received','page','full name','school','week','file'];

function apply(n, ref, over = {}) {
  const row = ['2026-09-0' + n + 'T10:00:00','apply','content','Maya ' + n,
    'maya' + n + '@school.edu','313-555-010' + n,'Michigan', ref, '2026-08-30T12:00:00'];
  Object.keys(over).forEach(k => { row[APPLY.indexOf(k)] = over[k]; });
  return row;
}
const submit = (n, ref) => ['2026-09-1' + n + 'T09:30:00','submit','Jordan ' + n,
  'jordan' + n + '@school.edu','@jordan' + n,'tiktok','https://tiktok.invalid/' + n, ref];
const onboard = (n, ref) => ['2026-09-2' + n + 'T08:00:00','onboard','Sigma Chi','SDSU',
  'jack' + n,'Jack ' + n,'jack' + n + '@school.edu', ref];

const referrer = (code, email, over = {}) =>
  Object.assign({code, claimed:'2026-08-01T09:00:00', 'full name':'Owner of ' + code,
    email, school:'SDSU', status:'active', note:''}, over);

function fakeSheet(grid) {
  const rows = grid.map(r => [...r]);
  const cell = (r, c) => (rows[r-1] && rows[r-1][c-1] !== undefined ? rows[r-1][c-1] : '');
  const put = (r, c, v) => {
    while (rows.length < r) rows.push([]);
    const row = rows[r-1];
    while (row.length < c) row.push('');
    row[c-1] = v;
  };
  const sheet = {
    getLastRow(){ let n = 0; rows.forEach((r, i) => { if (r.some(v => String(v ?? '') !== '')) n = i + 1; }); return n; },
    getLastColumn(){ let n = 0; rows.forEach(r => r.forEach((v, j) => { if (String(v ?? '') !== '' && j + 1 > n) n = j + 1; })); return n; },
    getMaxRows(){ return 1000; },
    setFrozenRows(){ return sheet; },
    appendRow(values){ const at = sheet.getLastRow() + 1; values.forEach((v, j) => put(at, j + 1, v)); },
    getRange(r, c, h = 1, w = 1){
      return {
        getValues(){
          const out = [];
          for (let i = 0; i < h; i++) {
            const line = [];
            for (let j = 0; j < w; j++) line.push(cell(r + i, c + j));
            out.push(line);
          }
          return out;
        },
        setValues(values){ values.forEach((line, i) => line.forEach((v, j) => put(r + i, c + j, v))); return this; },
        setValue(v){ put(r, c, v); return this; },
        setNumberFormat(){ return this; },
        setFontWeight(){ return this; }
      };
    },
    rows
  };
  return sheet;
}

/* Arya is an operator, Bijan is on the roster and is not. */
const SESSIONS = {'internal:operator-session':'Arya', 'internal:intern-session':'Bijan'};

function harness(tabs = {}) {
  const sheets = {};
  Object.keys(tabs).forEach(name => { sheets[name] = fakeSheet(tabs[name]); });
  const made = [];
  const book = {
    getSheetByName: name => sheets[name] || null,
    insertSheet(name){ made.push(name); sheets[name] = fakeSheet([]); return sheets[name]; }
  };
  let uuid = 0;
  const ctx = vm.createContext({
    SpreadsheetApp:{getActiveSpreadsheet: () => book, openById: () => book},
    Utilities:{
      getUuid: () => 'id' + String(++uuid).padStart(6, '0') + '-0000-4000-8000-000000000000',
      formatDate: date => date.toISOString().slice(0, 19)
    },
    Session:{getScriptTimeZone: () => 'America/New_York'},
    ContentService:{MimeType:{JSON:'json'}, createTextOutput: body => ({setMimeType: () => JSON.parse(body)})},
    LockService:{getScriptLock: () => ({waitLock(){}, releaseLock(){}})},
    PropertiesService:{getScriptProperties: () => ({getProperty: () => null})},
    CacheService:{getScriptCache: () => ({get: token => SESSIONS[token] || null})},
    DriveApp:{}, MailApp:{}
  });
  vm.runInContext(fs.readFileSync(new URL('../fomo/setup/apps-script.gs', import.meta.url), 'utf8'), ctx);

  const call = (action, payload = {}, over = {}) =>
    ctx.referApi(Object.assign({_api:'refer', action, _key:'monkey', _session:'operator-session'},
      payload, over));
  /* Claims come in off a public page and carry no session at all. */
  const claim = payload => ctx.referApi(Object.assign({_api:'refer', action:'claim'}, payload));
  const seed = list => { sheets.referrers = fakeSheet([ctx.REFER_COLS,
    ...list.map(r => ctx.REFER_COLS.map(c => r[c] ?? ''))]); };
  return {call, claim, seed, ctx, sheets, made: () => made, tab: n => sheets[n]};
}

/* ---------- who can do what ---------- */

test('claiming a code needs no session, because a stranger is doing it', () => {
  const h = harness();
  const out = h.claim({code:'JackD', full_name:'Jack D', email:'jack@school.edu'});
  assert.equal(out.ok, true);
  assert.equal(out.code, 'jackd');
});

test('an intern on the roster cannot see what anybody is owed', () => {
  const h = harness();
  const out = h.call('list', {}, {_session:'intern-session'});
  assert.equal(out.ok, false);
  assert.match(out.error, /Arya and Milo/);
});

test('the passcode is checked before the referrals are read', () => {
  const h = harness();
  assert.equal(h.call('list', {}, {_key:'guess'}).ok, false);
});

test('a session nobody is holding is turned away', () => {
  const h = harness();
  assert.equal(h.call('list', {}, {_session:'made-up'}).ok, false);
});

/* ---------- claiming ---------- */

test('the same person claiming twice gets one code and one row', () => {
  const h = harness();
  const first = h.claim({code:'jackd', full_name:'Jack D', email:'Jack@School.edu'});
  const again = h.claim({code:'jackd', full_name:'Jack D', email:'jack@school.edu'});
  assert.equal(first.code, 'jackd');
  assert.equal(again.code, 'jackd');
  assert.equal(again.mine, true);
  assert.equal(h.tab('referrers').getLastRow(), 2, 'a second row was written for the same person');
});

test('a username somebody else holds is answered with a variant, never a refusal', () => {
  /* Losing a referrer over a name collision is a worse trade than
     handing them jackd2. */
  const h = harness();
  h.claim({code:'jackd', full_name:'Jack D', email:'jack@school.edu'});
  const out = h.claim({code:'jackd', full_name:'Jack Dunne', email:'dunne@school.edu'});
  assert.equal(out.ok, true);
  assert.equal(out.taken, true);
  assert.equal(out.code, 'jackd2');
  assert.notEqual(out.code, 'jackd');
});

test('a claim without a reachable email is refused', () => {
  const h = harness();
  assert.equal(h.claim({code:'jackd', full_name:'Jack', email:'not-an-email'}).ok, false);
  assert.equal(h.claim({code:'ab', full_name:'Jack', email:'jack@school.edu'}).ok, false);
});

test('a bot that fills the hidden field is told everything is fine and written nowhere', () => {
  const h = harness();
  const out = h.claim({code:'spam', full_name:'x', email:'x@x.invalid', _hp:'1'});
  assert.equal(out.ok, true);
  assert.equal(h.tab('referrers'), undefined, 'the honeypot claim built a tab');
});

/* ---------- the sweep ---------- */

test('a submission carrying a code becomes a referral, priced by the door it came through', () => {
  const h = harness({
    apply:   [APPLY, apply(1, 'jackd')],
    submit:  [SUBMIT, submit(1, 'jackd')],
    onboard: [ONBOARD, onboard(1, 'jackd')]
  });
  h.seed([referrer('jackd', 'jack@school.edu')]);

  const out = h.call('list');
  assert.equal(out.ok, true);
  assert.equal(out.referrals.length, 3);

  const byTier = Object.fromEntries(out.referrals.map(r => [r.tier, r]));
  assert.equal(byTier.intern.amount, 100);
  assert.equal(byTier.creator.amount, 25);
  assert.equal(byTier.clan.amount, 5);
  /* Everything arrives undecided. Nothing is owed on the strength of a
     form having been submitted. */
  out.referrals.forEach(r => assert.equal(r.stage, 'pending'));
  assert.equal(byTier.intern.who, 'Maya 1');
  assert.equal(byTier.intern.via, 'apply');
});

test('reading twice does not record the same submission twice', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd'), apply(2, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  assert.equal(h.call('list').referrals.length, 2);
  assert.equal(h.call('list').referrals.length, 2);
  assert.equal(h.call('list').referrals.length, 2);
});

test('a submission with no code on it is not a referral', () => {
  const h = harness({apply:[APPLY, apply(1, ''), apply(2, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const out = h.call('list');
  assert.equal(out.referrals.length, 1);
  assert.equal(out.referrals[0].who, 'Maya 2');
});

test('a tab with no ref column at all is left alone', () => {
  /* /fomo/report is not a door anybody is paid for, and the receiver
     has never put a ref column on it. */
  const h = harness({report:[REPORT, ['2026-09-01T10:00:00','report','Maya','SDSU','w1','']]});
  assert.equal(h.call('list').referrals.length, 0);
  assert.ok(!h.made().includes('report'));
});

test('somebody using their own link on their own application is turned down, not deleted', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd', {email:'jack@school.edu'})]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const out = h.call('list');
  assert.equal(out.referrals.length, 1, 'the self-referral was dropped rather than recorded');
  assert.equal(out.referrals[0].stage, 'rejected');
  assert.equal(out.referrals[0].note, 'self-referral');
});

test('a code nobody claimed still gets a row, flagged so it can be chased', () => {
  const h = harness({apply:[APPLY, apply(1, 'ghost')]});
  const out = h.call('list');
  assert.equal(out.referrals.length, 1);
  assert.equal(out.referrals[0].code, 'ghost');
  assert.equal(out.referrals[0].stage, 'pending');
  assert.match(out.referrals[0].note, /no claim/);
});

test('a referral on a blocked code arrives flagged', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu', {status:'blocked'})]);
  assert.match(h.call('list').referrals[0].note, /blocked/);
});

test('a code typed into the form in any spelling lands on one referrer', () => {
  const h = harness({
    apply:   [APPLY, apply(1, '@JackD')],
    onboard: [ONBOARD, onboard(1, '  jackd  ')]
  });
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const out = h.call('list');
  assert.equal(out.referrals.length, 2);
  out.referrals.forEach(r => assert.equal(r.code, 'jackd'));
});

/* ---------- moving one along ---------- */

function pending(h) {
  return h.call('list').referrals.find(r => r.stage === 'pending');
}

test('a referral walks pending, completed, paid — and nothing is owed before completed', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const row = pending(h);

  let out = h.call('stage', {id:row.id, stage:'completed'});
  assert.equal(out.ok, true);
  let now = out.referrals.find(r => r.id === row.id);
  assert.equal(now.stage, 'completed');
  assert.equal(now['moved by'], 'Arya', 'the decision is not signed');

  out = h.call('stage', {id:row.id, stage:'paid'});
  assert.equal(out.referrals.find(r => r.id === row.id).stage, 'paid');
});

test('a paid referral cannot be walked back out of paid', () => {
  /* The money has left. A console that can undo this is a console that
     can pay the same person twice. */
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const row = pending(h);
  h.call('stage', {id:row.id, stage:'completed'});
  h.call('stage', {id:row.id, stage:'paid'});

  ['completed', 'pending', 'rejected'].forEach(to => {
    const out = h.call('stage', {id:row.id, stage:to});
    assert.equal(out.ok, false, 'a paid referral was moved to ' + to);
    assert.match(out.error, /already paid/);
  });
  assert.equal(h.call('list').referrals.find(r => r.id === row.id).stage, 'paid');
});

test('a stage nobody has heard of is refused', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const row = pending(h);
  assert.equal(h.call('stage', {id:row.id, stage:'approved'}).ok, false);
  assert.equal(h.call('stage', {id:row.id, stage:''}).ok, false);
  assert.equal(h.call('stage', {id:'made-up', stage:'paid'}).ok, false);
});

test('an intern cannot move money even with a real session', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const row = pending(h);
  const out = h.call('stage', {id:row.id, stage:'paid'}, {_session:'intern-session'});
  assert.equal(out.ok, false);
  assert.equal(h.call('list').referrals.find(r => r.id === row.id).stage, 'pending');
});

/* ---------- the rung with no form behind it ---------- */

test('a chapter referral is opened by hand, at pending like any other', () => {
  const h = harness();
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const out = h.call('open', {code:'jackd', tier:'chapter', who:'Sigma Chi — SDSU',
    note:'crossed 80% on 12 March'});
  assert.equal(out.ok, true);
  assert.equal(out.referrals.length, 1);
  assert.equal(out.referrals[0].tier, 'chapter');
  assert.equal(out.referrals[0].amount, 250);
  assert.equal(out.referrals[0].stage, 'pending', 'a hand-opened referral skipped the decision');
  assert.equal(out.referrals[0].via, 'by hand');
  assert.equal(out.referrals[0]['moved by'], 'Arya');
});

test('a hand-opened referral needs a code, a rung and somebody it is about', () => {
  const h = harness();
  assert.equal(h.call('open', {tier:'chapter', who:'Sigma Chi'}).ok, false);
  assert.equal(h.call('open', {code:'jackd', who:'Sigma Chi'}).ok, false);
  assert.equal(h.call('open', {code:'jackd', tier:'chapter'}).ok, false);
  assert.equal(h.call('open', {code:'jackd', tier:'invented', who:'x'}).ok, false);
});

/* ---------- blocking ---------- */

test('blocking a code does not touch what it has already earned', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  const row = pending(h);
  h.call('stage', {id:row.id, stage:'completed'});

  const out = h.call('block', {code:'jackd', blocked:true});
  assert.equal(out.ok, true);
  assert.equal(out.referrers.find(r => r.code === 'jackd').status, 'blocked');
  assert.equal(out.referrals.find(r => r.id === row.id).stage, 'completed');

  assert.equal(h.call('block', {code:'jackd', blocked:false})
    .referrers.find(r => r.code === 'jackd').status, 'active');
});

test('blocking a code nobody claimed is refused rather than inventing a referrer', () => {
  const h = harness();
  assert.equal(h.call('block', {code:'ghost', blocked:true}).ok, false);
});

/* ---------- the shape of the answer ---------- */

test('every call answers with both tables and the prices, not just what it changed', () => {
  /* The console totals across both tabs on every render. A partial
     answer would leave it adding a new row to figures taken before the
     row existed. */
  const h = harness({apply:[APPLY, apply(1, 'jackd')]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  ['list', 'stage', 'block'].forEach(action => {
    const row = h.call('list').referrals[0];
    const out = h.call(action, action === 'stage'
      ? {id:row.id, stage:'pending'} : {code:'jackd', blocked:false});
    assert.ok(Array.isArray(out.referrers), action + ' did not answer with the referrers');
    assert.ok(Array.isArray(out.referrals), action + ' did not answer with the referrals');
    assert.equal(out.tiers.intern.amount, 100, action + ' did not answer with the prices');
  });
});

test('an unknown action is refused rather than falling through to a read', () => {
  const h = harness();
  assert.equal(h.call('delete-everything').ok, false);
});

test('a formula typed into a form cannot land in the sheet as one', () => {
  const h = harness({apply:[APPLY, apply(1, 'jackd', {'full name':'=SUM(A1:A9)'})]});
  h.seed([referrer('jackd', 'jack@school.edu')]);
  assert.equal(h.call('list').referrals[0].who, "'=SUM(A1:A9)");
});
