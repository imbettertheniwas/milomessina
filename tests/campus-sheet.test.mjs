import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

/* The campus half of fomo/setup/apps-script.gs, run against a fake
   spreadsheet. Everything it does that cannot be tried from a browser is
   here: growing the apply tab's header row, backfilling ids onto rows the
   form wrote without one, and the hire that has to move two tables at
   once or neither. */

const HEAD = ['received','page','seat','full name','email','phone','university',
  'grad year','tiktok','instagram','portfolio','why you','role answer','hours',
  'confirm student','confirm advice'];

function application(n, over = {}) {
  const row = ['2026-09-0' + n + 'T10:00:00','apply','content','Maya ' + n,
    'maya' + n + '@school.edu','313-555-010' + n,'University of Michigan','2027',
    '@maya','@maya','https://example.invalid/post','because','a hook','6–8 hours','on','on'];
  Object.keys(over).forEach(k => { row[HEAD.indexOf(k)] = over[k]; });
  return row;
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

function harness(tabs = {}) {
  const sheets = {};
  Object.keys(tabs).forEach(name => { sheets[name] = fakeSheet(tabs[name]); });
  let made = [];
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
    CacheService:{getScriptCache: () => ({get: token => token === "internal:admin-test-session" ? "Arya" : null})},
    DriveApp:{}, MailApp:{}
  });
  vm.runInContext(fs.readFileSync(new URL('../fomo/setup/apps-script.gs', import.meta.url), 'utf8'), ctx);
  const call = (action, payload = {}, key = 'monkey') =>
    ctx.campusApi(Object.assign({action, _key:key, _session:"admin-test-session"}, payload));
  return {call, sheets, made: () => made, tab: name => sheets[name]};
}

test('the passcode is checked before anything is read or built', () => {
  const h = harness();
  assert.equal(h.call('list', {}, 'guess').ok, false);
  assert.deepEqual(h.made(), []);
});

test('applicant reads require a session before reading or creating tables', () => {
  const h = harness();
  assert.equal(h.call('list', {_session:''}).ok, false);
  assert.deepEqual(h.made(), []);
});

test('an empty sheet answers with two empty tables and builds no apply tab', () => {
  const h = harness();
  const out = h.call('list');
  assert.equal(out.ok, true);
  assert.deepEqual(out.applicants, []);
  assert.deepEqual(out.team, []);
  /* The form owns the apply tab and builds it on its first submission —
     the console must never put an empty one in front of it. */
  assert.deepEqual(h.made(), ['internal_roster', 'campus_team']);
});

test('reading the apply tab widens its header and gives every row an id', () => {
  const h = harness({apply:[HEAD, application(1), application(2)]});
  const out = h.call('list');
  const headers = h.tab('apply').rows[0];
  ['id','status','team notes','decided'].forEach(c => assert.ok(headers.includes(c), c + ' column'));
  assert.equal(out.applicants.length, 2);
  assert.ok(out.applicants.every(a => a.id.length === 8));
  assert.notEqual(out.applicants[0].id, out.applicants[1].id);
  /* and the ids are on the rows they belong to, not just in the answer */
  const idCol = headers.indexOf('id');
  assert.equal(h.tab('apply').rows[1][idCol], out.applicants[0].id);
  assert.equal(h.tab('apply').rows[2][idCol], out.applicants[1].id);
});

test('an application is read by header name, not by position', () => {
  /* the same row with two of the form's columns swapped around */
  const shuffled = ['full name','received','page','seat','email','phone','university',
    'grad year','tiktok','instagram','portfolio','why you','role answer','hours',
    'confirm student','confirm advice'];
  const row = shuffled.map(col => application(1)[HEAD.indexOf(col)]);
  const h = harness({apply:[shuffled, row]});
  const a = h.call('list').applicants[0];
  assert.equal(a.name, 'Maya 1');
  assert.equal(a.school, 'University of Michigan');
  assert.equal(a.seat, 'content');
  assert.equal(a.status, 'new');
});

test('a question the form gained arrives as an extra rather than being dropped', () => {
  const h = harness({apply:[HEAD.concat(['car access']), application(1).concat(['yes'])]});
  const a = h.call('list').applicants[0];
  assert.deepEqual(a.extra.filter(x => x.k === 'car access'), [{k:'car access', v:'yes'}]);
  /* the bookkeeping columns are not extras */
  assert.ok(!a.extra.some(x => ['page','id','status','received'].includes(x.k)));
});

test('a blank row left by a hand-deleted application is skipped, and the rows below keep their own ids', () => {
  const h = harness({apply:[HEAD, application(1), [], application(3)]});
  const out = h.call('list');
  assert.equal(out.applicants.length, 2);
  const idCol = h.tab('apply').rows[0].indexOf('id');
  assert.equal(h.tab('apply').rows[3][idCol], out.applicants.find(a => a.name === 'Maya 3').id);
  assert.equal(String(h.tab('apply').rows[2][idCol] ?? ''), '');
});

test('moving an application stamps when it moved, and re-marking it new does not', () => {
  const h = harness({apply:[HEAD, application(1)]});
  const id = h.call('list').applicants[0].id;

  const moved = h.call('applicant', {id, status:'interview', notes:'call thursday'});
  assert.equal(moved.ok, true);
  assert.equal(moved.applicants[0].status, 'interview');
  assert.equal(moved.applicants[0].notes, 'call thursday');
  assert.ok(moved.applicants[0].decided);

  const back = h.call('applicant', {id, status:'new'});
  assert.equal(back.applicants[0].status, 'new');
  assert.equal(h.call('applicant', {id, status:'shortlisted'}).ok, false);
});

test('hiring writes the roster row and marks the application, or does neither', () => {
  const h = harness({apply:[HEAD, application(1)]});
  const id = h.call('list').applicants[0].id;

  /* no state, so nothing happens on either table */
  const refused = h.call('hire', {id, started:'2026-09-17'});
  assert.equal(refused.ok, false);
  assert.equal(h.tab('campus_team').getLastRow(), 1);

  const out = h.call('hire', {id, state:'mi', started:'2026-09-17'});
  assert.equal(out.ok, true);
  assert.equal(out.team.length, 1);
  assert.equal(out.team[0].campus, 'University of Michigan');
  assert.equal(out.team[0].state, 'MI');
  assert.equal(out.team[0].seat, 'content');
  assert.equal(out.team[0].from, id);
  assert.equal(out.applicants[0].status, 'hired');

  /* and they cannot be hired onto a second campus by accident */
  assert.equal(h.call('hire', {id, state:'NJ'}).ok, false);
  assert.equal(h.call('list').team.length, 1);
});

test('a roster row is checked before it is written', () => {
  const h = harness();
  const good = {name:'Priya Shah', campus:'Rutgers University', state:'NJ', seat:'growth'};
  assert.equal(h.call('teamadd', Object.assign({}, good, {name:''})).ok, false);
  assert.equal(h.call('teamadd', Object.assign({}, good, {state:'New Jersey'})).ok, false);
  assert.equal(h.call('teamadd', Object.assign({}, good, {seat:'vibes'})).ok, false);
  assert.equal(h.call('teamadd', Object.assign({}, good, {started:'sept'})).ok, false);
  assert.equal(h.call('list').team.length, 0);

  const out = h.call('teamadd', Object.assign({}, good, {status:'nonsense'}));
  assert.equal(out.ok, true);
  assert.equal(out.team[0].status, 'active');
  assert.equal(out.team[0].from, '');
});

test('a name that would read as a formula is stored as text', () => {
  const h = harness();
  const out = h.call('teamadd', {name:'=HYPERLINK("bad")', campus:'Rutgers University', state:'NJ', seat:'growth'});
  assert.equal(out.team[0].name, '\'=HYPERLINK("bad")');
});

test('editing keeps the row its own history, and removing it takes only that row', () => {
  const h = harness({apply:[HEAD, application(1)]});
  const id = h.call('list').applicants[0].id;
  h.call('hire', {id, state:'MI'});
  h.call('teamadd', {name:'Priya Shah', campus:'Rutgers University', state:'NJ', seat:'growth'});

  const hired = h.call('list').team.find(t => t.from === id);
  const out = h.call('teamupdate', {id:hired.id, name:'Maya 1', campus:'University of Michigan',
    state:'MI', seat:'partner', status:'paused'});
  const after = out.team.find(t => t.id === hired.id);
  assert.equal(after.seat, 'partner');
  assert.equal(after.status, 'paused');
  assert.equal(after.from, id, 'the application it came from is never rewritten');
  assert.equal(after.added, hired.added);

  const left = h.call('teamdelete', {id:hired.id});
  assert.equal(left.team.length, 1);
  assert.equal(left.team[0].name, 'Priya Shah');
  /* and the application it came from is left as it was found */
  assert.equal(left.applicants[0].status, 'hired');
  assert.equal(h.call('teamdelete', {id:hired.id}).ok, false);
});

test('an unknown action is refused rather than read as a list', () => {
  const h = harness({apply:[HEAD, application(1)]});
  assert.equal(h.call('drop').ok, false);
});
