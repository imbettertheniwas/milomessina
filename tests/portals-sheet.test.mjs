import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

/* The forms half of fomo/setup/apps-script.gs — the reader behind
   /internal's portal manager — run against a fake spreadsheet.

   It is a reader and nothing else, so most of what is checked here is
   what it must NOT do: widen a header row it does not own, build a tab
   the form has not built yet, or hand a form's answers to somebody who
   is not maintaining the console. */

const APPLY = ['received','page','seat','full name','email','phone','university',
  'grad year','tiktok','instagram','portfolio','why you','role answer','hours'];
const SUBMIT = ['received','page','submission type','full name','email','school',
  'handle','platform','video url','payout method','payout handle'];

function application(n, over = {}) {
  const row = ['2026-09-0' + n + 'T10:00:00','apply','content','Maya ' + n,
    'maya' + n + '@school.edu','313-555-010' + n,'University of Michigan','2027',
    '@maya','@maya','https://example.invalid/post','because','a hook','6–8 hours'];
  Object.keys(over).forEach(k => { row[APPLY.indexOf(k)] = over[k]; });
  return row;
}

function claim(n) {
  return ['2026-09-1' + n + 'T09:30:00','submit','video','Jordan ' + n,
    'jordan' + n + '@school.edu','Clemson','@jordan' + n,'tiktok',
    'https://tiktok.invalid/' + n,'venmo','@jordan-pay'];
}

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
    deleteRow(r){ rows.splice(r - 1, 1); },
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

/* Two sessions, because the interesting refusal is the one in the middle:
   Bijan is signed in and on the roster, and still cannot read this. */
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
    ctx.formsApi(Object.assign({action, _key:'monkey', _session:'operator-session'}, payload, over));
  /* Signing the caller in builds the roster tab, the way it does for
     every other namespace. `built` is the question this file is actually
     asking: did reading a form's tab create one? */
  const forms = () => made.filter(n => ['apply','submit','report','onboard'].includes(n));
  return {call, ctx, sheets, made: () => made, built: forms, tab: name => sheets[name],
          date: iso => vm.runInContext('new Date(' + JSON.stringify(iso) + ')', ctx)};
}

test('the passcode is checked before anything is read', () => {
  const h = harness({apply:[APPLY, application(1)]});
  assert.equal(h.call('index', {}, {_key:'guess'}).ok, false);
});

test('an intern on the roster is still turned away', () => {
  /* Everything else in the console is one subject at a time. This is all
     of them at once — applicants' phone numbers and creators' payout
     handles on one screen — so it takes the maintenance door. */
  const h = harness({apply:[APPLY, application(1)]});
  const out = h.call('index', {}, {_session:'intern-session'});
  assert.equal(out.ok, false);
  assert.match(out.error, /Arya and Milo/);
});

test('a session nobody is holding is turned away', () => {
  const h = harness();
  assert.equal(h.call('index', {}, {_session:'made-up'}).ok, false);
});

test('the index names every form tab, and says which have nothing behind them', () => {
  const h = harness({apply:[APPLY, application(1), application(2)]});
  const out = h.call('index');
  assert.equal(out.ok, true);
  assert.deepEqual(out.portals.map(p => p.tab), ['apply','submit','report','onboard']);

  const apply = out.portals.find(p => p.tab === 'apply');
  assert.equal(apply.exists, true);
  assert.equal(apply.total, 2);
  assert.equal(apply.last, '2026-09-02T10:00:00');
  assert.ok(apply.fields.includes('role answer'));

  /* A tab that is not there is a form nobody has submitted yet, which is
     a true answer — not an error, and not a tab to go and build. */
  const submit = out.portals.find(p => p.tab === 'submit');
  assert.equal(submit.exists, false);
  assert.equal(submit.total, 0);
  assert.deepEqual(h.built(), []);
});

test('the index names the forms the receiver will actually accept', () => {
  /* /fomo/onboard posts exactly like the other three and the receiver
     turns it away. The manager has to be able to say so rather than
     showing it as a door nobody has walked through. */
  const h = harness();
  const out = h.call('index');
  assert.deepEqual(out.inbox, ['apply','submit','report']);
  assert.ok(!out.inbox.includes('onboard'));
});

test('a submission is read by header name, not by position', () => {
  const shuffled = ['full name','received','page','seat','email','phone','university',
    'grad year','tiktok','instagram','portfolio','why you','role answer','hours'];
  const row = shuffled.map(col => application(1)[APPLY.indexOf(col)]);
  const h = harness({apply:[shuffled, row]});
  const out = h.call('rows', {tab:'apply'});
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].cells['full name'], 'Maya 1');
  assert.equal(out.rows[0].cells['university'], 'University of Michigan');
  assert.equal(out.rows[0].received, '2026-09-01T10:00:00');
});

test('a question the form gained arrives without anything being redeployed', () => {
  const h = harness({apply:[APPLY.concat(['car access']), application(1).concat(['yes'])]});
  const out = h.call('rows', {tab:'apply'});
  assert.ok(out.headers.includes('car access'));
  assert.equal(out.rows[0].cells['car access'], 'yes');
});

test('a blank answer is left out rather than carried as one', () => {
  const h = harness({apply:[APPLY, application(1, {'tiktok':'', 'portfolio':''})]});
  const cells = h.call('rows', {tab:'apply'}).rows[0].cells;
  assert.ok(!('tiktok' in cells));
  assert.ok(!('portfolio' in cells));
  assert.equal(cells['instagram'], '@maya');
});

test('reading a tab never widens it and never writes to it', () => {
  /* applyHeaders adds the console's own four columns to the apply tab.
     This reader owns none of the three tabs it reads, so it adds nothing
     — a header row here is the form's, and stays the form's. */
  const h = harness({apply:[APPLY, application(1)]});
  const before = h.tab('apply').rows.map(r => [...r]);
  h.call('rows', {tab:'apply'});
  h.call('index');
  assert.deepEqual(h.tab('apply').rows, before);
  assert.deepEqual(h.built(), []);
});

test('a hand-deleted submission leaves a blank row, and it is not counted', () => {
  const h = harness({apply:[APPLY, application(1), APPLY.map(() => ''), application(3)]});
  const out = h.call('rows', {tab:'apply'});
  assert.equal(out.total, 2);
  assert.equal(out.rows.length, 2);
  /* and the index agrees with the table it is counting */
  assert.equal(h.call('index').portals.find(p => p.tab === 'apply').total, 2);
});

test('submissions come back newest first, with the row the sheet calls them', () => {
  const h = harness({apply:[APPLY, application(1), application(2), application(3)]});
  const rows = h.call('rows', {tab:'apply'}).rows;
  assert.deepEqual(rows.map(r => r.cells['full name']), ['Maya 3','Maya 2','Maya 1']);
  assert.deepEqual(rows.map(r => r._row), [4, 3, 2]);
});

test('the cap drops the oldest, says it did, and still counts the whole tab', () => {
  const many = [];
  for (let i = 0; i < 405; i++) many.push(claim(1).map((v, j) => j === 6 ? '@jordan' + i : v));
  const h = harness({submit:[SUBMIT, ...many]});
  const out = h.call('rows', {tab:'submit'});
  assert.equal(out.total, 405);
  assert.equal(out.rows.length, 400);
  assert.equal(out.capped, true);
  /* newest kept, oldest dropped */
  assert.equal(out.rows[0].cells['handle'], '@jordan404');
  assert.ok(!out.rows.some(r => r.cells['handle'] === '@jordan0'));
});

test('a tab nobody has submitted to reads as empty rather than as a failure', () => {
  const h = harness();
  const out = h.call('rows', {tab:'report'});
  assert.equal(out.ok, true);
  assert.equal(out.exists, false);
  assert.deepEqual(out.rows, []);
  assert.deepEqual(h.built(), []);
});

test('a tab that is not one of the forms is refused', () => {
  /* The ledger, the roster and the admin log are all tabs of this same
     sheet, and none of them is a front door. */
  const h = harness({invoice:[['id','who','amount']]});
  ['invoice','internal_roster','campus_team','posts'].forEach(tab => {
    assert.equal(h.call('rows', {tab}).ok, false, tab);
  });
});

test('an unknown action is refused rather than read as an index', () => {
  const h = harness();
  assert.equal(h.call('wipe', {tab:'apply'}).ok, false);
});

test('a date typed into the sheet by hand comes back as text', () => {
  /* Built inside the script's own realm, because that is where Apps
     Script hands one over and instanceof only holds within a realm. */
  const h = harness({apply:[APPLY, application(1)]});
  h.tab('apply').rows[1][APPLY.indexOf('received')] = h.date('2026-09-04T14:05:00Z');
  const out = h.call('rows', {tab:'apply'});
  assert.equal(typeof out.rows[0].received, 'string');
  assert.equal(out.rows[0].received, '2026-09-04T14:05:00');
});
