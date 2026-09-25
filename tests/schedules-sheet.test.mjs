import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const block = (over = {}) => ({who:'Milo', label:'CS 106', kind:'class',
  days:[1,3,5], start:'09:00', end:'10:15', ...over});
const add = (h, token, over = {}) => h.call(token, 'add', block(over), 'schedules');
const list = h => h.call(h.login('Milo'), 'list', {}, 'schedules').schedules;
const mine = (h, who) => list(h).filter(s => s.who === who);

test('a block goes on with its days in order, and reads back as a week', () => {
  const h = harness(), m = h.login('Milo');
  const out = add(h, m, {days:[5,1,3,1]});
  assert.equal(out.ok, true);
  const [s] = mine(h, 'Milo');
  assert.deepEqual(s.days, [1, 3, 5]);
  assert.equal(s.start, '09:00');
  assert.equal(s.end, '10:15');
  assert.equal(s.kind, 'class');
  assert.equal(s.label, 'CS 106');
  assert.equal(s.source, 'typed');
  assert.ok(s.id);
});

test('a block nobody could sit in is turned away, and says why', () => {
  const h = harness(), m = h.login('Milo');
  assert.equal(add(h, m, {days:[]}).error, 'pick at least one day');
  assert.equal(add(h, m, {start:'10:00', end:'09:00'}).error, 'that block ends before it starts');
  assert.equal(add(h, m, {start:'10:00', end:'10:00'}).error, 'that block ends before it starts');
  assert.equal(add(h, m, {start:'', end:''}).error, 'give a start and an end, like 09:00 and 10:15');
  assert.equal(add(h, m, {start:'25:00', end:'26:00'}).error, 'give a start and an end, like 09:00 and 10:15');
  assert.equal(list(h).length, 0);
});

test('an intern owns their own week and nobody else’s; Arya owns all of them', () => {
  const h = harness(), m = h.login('Milo'), b = h.login('Bijan'), a = h.login('Arya');
  assert.equal(add(h, m, {who:'Bijan'}).error, 'You can only change your own week.');
  assert.equal(add(h, '', {}).error, 'Session expired. Sign in again.');
  assert.equal(add(h, a, {who:'Luchi'}).ok, true);

  const [luchi] = mine(h, 'Luchi');
  assert.equal(h.call(b, 'edit', {id:luchi.id, label:'mine now', days:[2], start:'11:00', end:'12:00'},
    'schedules').error, 'You can only change your own week.');
  assert.equal(h.call(b, 'delete', {id:luchi.id}, 'schedules').error, 'You can only change your own week.');
  assert.equal(mine(h, 'Luchi').length, 1);
  assert.equal(h.call(a, 'delete', {id:luchi.id}, 'schedules').ok, true);
  assert.equal(mine(h, 'Luchi').length, 0);
});

test('an edit moves the hours and the days but never the person', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  const [was] = mine(h, 'Milo');
  const out = h.call(m, 'edit', {id:was.id, who:'Bijan', label:'CS 106 lab',
    kind:'class', days:[2, 4], start:'13:00', end:'14:30'}, 'schedules');
  assert.equal(out.ok, true);
  const [now] = mine(h, 'Milo');
  assert.equal(now.id, was.id);
  assert.equal(now.who, 'Milo');
  assert.deepEqual(now.days, [2, 4]);
  assert.equal(now.start, '13:00');
  assert.equal(now.end, '14:30');
  assert.equal(now.label, 'CS 106 lab');
  assert.equal(mine(h, 'Bijan').length, 0);
  assert.notEqual(now.updated, '');
});

test('"nothing fixed" and a real block cannot both be true at once', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  assert.equal(h.call(m, 'add', {who:'Milo', kind:'none'}, 'schedules').ok, true);
  let now = mine(h, 'Milo');
  assert.equal(now.length, 1);
  assert.equal(now[0].kind, 'none');
  assert.deepEqual(now[0].days, []);
  assert.equal(now[0].start, '');

  add(h, m, {label:'Chem 1A', start:'14:00', end:'15:00', days:[2]});
  now = mine(h, 'Milo');
  assert.equal(now.length, 1);
  assert.equal(now[0].kind, 'class');
  assert.equal(now[0].label, 'Chem 1A');
});

test('a calendar imported twice is one calendar, and hand-typed blocks survive it', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m, {label:'Soccer', kind:'busy', days:[6], start:'10:00', end:'12:00'});
  const term = [
    {label:'CS 106', kind:'class', days:[1, 3, 5], start:'09:00', end:'10:15'},
    {label:'Chem 1A', kind:'class', days:[2, 4], start:'13:00', end:'14:30'}
  ];
  assert.equal(h.call(m, 'import', {who:'Milo', source:'ics', blocks:term}, 'schedules').ok, true);
  assert.equal(mine(h, 'Milo').length, 3);

  assert.equal(h.call(m, 'import', {who:'Milo', source:'ics',
    blocks:term.concat([{label:'Physics', kind:'class', days:[5], start:'15:00', end:'16:00'}])},
    'schedules').ok, true);
  const now = mine(h, 'Milo');
  assert.equal(now.length, 4);
  assert.equal(now.filter(s => s.label === 'Soccer').length, 1);
  assert.equal(now.filter(s => s.source === 'ics').length, 3);
});

test('an import keeps the lines it can read and drops the ones it cannot', () => {
  const h = harness(), m = h.login('Milo');
  const out = h.call(m, 'import', {who:'Milo', source:'pasted', blocks:[
    {label:'Good', days:[1], start:'09:00', end:'10:00'},
    {label:'Backwards', days:[2], start:'10:00', end:'09:00'},
    {label:'Dayless', days:[], start:'09:00', end:'10:00'}
  ]}, 'schedules');
  assert.equal(out.ok, true);
  const now = mine(h, 'Milo');
  assert.equal(now.length, 1);
  assert.equal(now[0].label, 'Good');
  assert.equal(h.call(m, 'import', {who:'Milo', source:'ics', blocks:[
    {label:'Nope', days:[], start:'', end:''}]}, 'schedules').error,
    'nothing in that file looked like a weekly commitment');
});

test('clearing a week takes only that week off', () => {
  const h = harness(), m = h.login('Milo'), b = h.login('Bijan');
  add(h, m);
  add(h, b, {who:'Bijan', label:'Econ 1'});
  assert.equal(h.call(m, 'clear', {who:'Milo'}, 'schedules').ok, true);
  assert.equal(mine(h, 'Milo').length, 0);
  assert.equal(mine(h, 'Bijan').length, 1);
  assert.equal(h.call(m, 'clear', {who:'Bijan'}, 'schedules').error, 'You can only change your own week.');
});

test('a label that opens with an = is stored as text and read back as typed', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m, {label:'=SUM(A1:A9) study group'});
  const [s] = mine(h, 'Milo');
  assert.equal(s.label, '=SUM(A1:A9) study group');
  assert.equal(h.sheets.schedules.rows[1][3], "'=SUM(A1:A9) study group");
});

test('a name the bootcamp has never heard of cannot take a slot', () => {
  const h = harness(), m = h.login('Milo');
  assert.equal(add(h, m, {who:'Nobody'}).error, 'You can only change your own week.');
  const a = h.login('Arya');
  assert.equal(add(h, a, {who:'Nobody'}).error, 'that name is not on the bootcamp');
});

test('the list requires a session, and an unknown action is named', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  assert.equal(h.call('', 'list', {}, 'schedules').ok, false);
  assert.equal(list(h).length, 1);
  assert.equal(h.call(m, 'shuffle', {}, 'schedules').error, 'unknown action');
  assert.equal(h.call('', 'shuffle', {}, 'schedules').error, 'Session expired. Sign in again.');
});

test('hours typed into the tab by hand still come back as hours', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  const sh = h.sheets.schedules;
  sh.rows[1][6] = new Date(2026, 8, 14, 9, 0, 0);    /* what the sheet does to '09:00' */
  assert.equal(mine(h, 'Milo')[0].start, '09:00');
});

test('a school calendar puts its breaks on the tab beside the classes', () => {
  const h = harness(), m = h.login('Milo');
  const out = h.call(m, 'import', {who:'Milo', source:'ics', blocks:[
    {label:'CS 106', kind:'class', days:[1,3,5], start:'09:00', end:'10:15'},
    {label:'Spring Break', kind:'break', from:'2099-03-16', to:'2099-03-20'},
    {label:'No classes', kind:'break', from:'2099-11-25'}
  ]}, 'schedules');
  assert.equal(out.ok, true);
  const all = mine(h, 'Milo');
  assert.equal(all.length, 3);
  const [spring] = all.filter(s => s.label === 'Spring Break');
  assert.equal(spring.kind, 'break');
  assert.equal(spring.from, '2099-03-16');
  assert.equal(spring.to, '2099-03-20');
  assert.deepEqual(spring.days, []);
  assert.equal(spring.start, '');
  /* one day off, with no end date given, ends the day it starts */
  const [oneDay] = all.filter(s => s.label === 'No classes');
  assert.equal(oneDay.from, '2099-11-25');
  assert.equal(oneDay.to, '2099-11-25');
});

test('a break with no name or no date is not a break', () => {
  const h = harness(), m = h.login('Milo');
  assert.equal(h.call(m, 'add', {who:'Milo', kind:'break', label:'Reading week'},
    'schedules').error, 'a break needs the day it starts');
  assert.equal(h.call(m, 'add', {who:'Milo', kind:'break', from:'2099-03-16'},
    'schedules').error, 'a break needs a name');
  assert.equal(h.call(m, 'add', {who:'Milo', kind:'break', label:'Backwards',
    from:'2099-03-20', to:'2099-03-16'}, 'schedules').ok, true);
  const [b] = mine(h, 'Milo');
  assert.equal(b.to, '2099-03-20', 'an end before its start is read as one day');
});

test('a break is edited by its dates, and cannot be turned into a class', () => {
  const h = harness(), m = h.login('Milo');
  h.call(m, 'add', {who:'Milo', kind:'break', label:'Spring Break',
    from:'2099-03-16', to:'2099-03-20'}, 'schedules');
  const [was] = mine(h, 'Milo');
  const out = h.call(m, 'edit', {id:was.id, kind:'class', label:'Spring Break',
    from:'2099-03-17', to:'2099-03-24', days:[1], start:'09:00', end:'10:00'}, 'schedules');
  assert.equal(out.ok, true);
  const [now] = mine(h, 'Milo');
  assert.equal(now.kind, 'break');
  assert.equal(now.from, '2099-03-17');
  assert.equal(now.to, '2099-03-24');
  assert.deepEqual(now.days, []);
});

test('a tab written before breaks existed gains the columns and keeps its rows', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  const sh = h.sheets.schedules;
  sh.rows[0] = ['id','updated','who','label','kind','days','start','end','source'];  /* the old header */
  sh.rows[1] = sh.rows[1].slice(0, 9);
  const old = mine(h, 'Milo')[0];
  assert.equal(old.label, 'CS 106');
  assert.equal(old.from, '');
  assert.equal(h.call(m, 'add', {who:'Milo', kind:'break', label:'Spring Break',
    from:'2099-03-16', to:'2099-03-20'}, 'schedules').ok, true);
  assert.deepEqual(sh.rows[0],
    ['id','updated','who','label','kind','days','start','end','source','from','to','week']);
  assert.equal(mine(h, 'Milo').length, 2);
});

test('a block can run every other week, and says which of the two it is', () => {
  const h = harness(), m = h.login('Milo');
  assert.equal(add(h, m, {label:'CHEM Lab', days:[2], start:'14:00', end:'17:00',
    week:'2/2'}).ok, true);
  const [s] = mine(h, 'Milo');
  assert.equal(s.week, '2/2');
  assert.deepEqual(s.days, [2]);
});

test('a rotation nobody could keep is read as every week rather than refused', () => {
  const h = harness(), m = h.login('Milo');
  [['0/2'], ['3/2'], ['1/9'], ['every other'], ['']].forEach(([week]) => {
    h.call(m, 'clear', {who:'Milo'}, 'schedules');
    add(h, m, {week});
    assert.equal(mine(h, 'Milo')[0].week, 'every', JSON.stringify(week) + ' is not a rotation');
  });
});

test('an edit can put a block on a rotation and take it off again', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  const [was] = mine(h, 'Milo');
  h.call(m, 'edit', {id:was.id, label:'CS 106', kind:'class', days:[1,3,5],
    start:'09:00', end:'10:15', week:'1/2'}, 'schedules');
  assert.equal(mine(h, 'Milo')[0].week, '1/2');
  h.call(m, 'edit', {id:was.id, label:'CS 106', kind:'class', days:[1,3,5],
    start:'09:00', end:'10:15', week:'every'}, 'schedules');
  assert.equal(mine(h, 'Milo')[0].week, 'every');
});

test('a tab written before rotations existed reads every row as every week', () => {
  const h = harness(), m = h.login('Milo');
  add(h, m);
  const sh = h.sheets.schedules;
  sh.rows[0] = ['id','updated','who','label','kind','days','start','end','source','from','to'];
  sh.rows[1] = sh.rows[1].slice(0, 11);
  assert.equal(mine(h, 'Milo')[0].week, 'every');
  assert.equal(add(h, m, {label:'Lab', days:[2], start:'14:00', end:'17:00', week:'1/2'}).ok, true);
  assert.deepEqual(sh.rows[0],
    ['id','updated','who','label','kind','days','start','end','source','from','to','week']);
  assert.equal(mine(h, 'Milo').filter(s => s.label === 'Lab')[0].week, '1/2');
});
