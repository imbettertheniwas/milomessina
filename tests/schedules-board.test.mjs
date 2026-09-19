/* The half of the schedules tab that never reaches the sheet: the calendar
   file people drop on it, the timetable they paste instead, and the
   overlap the board is drawn from. All three are read in the browser, and
   all three are the kind of thing that can be quietly wrong — a window
   nobody is actually free in is worse than no window at all, because
   somebody drives in for it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const PEOPLE = ['Milo', 'Bijan', 'Jesse', 'Luchi', 'Arya'];

function board(){
  const store = new Map();
  const element = () => ({
    value:'', hidden:false, disabled:false, textContent:'', innerHTML:'', files:null,
    classList:{toggle(){}, add(){}, remove(){}, contains(){return false;}},
    addEventListener(){}, setAttribute(){}, getAttribute(){return null;},
    closest(){return null;}, querySelector(){return null;}, querySelectorAll(){return [];}
  });
  const nodes = new Map();
  const document = {
    getElementById(id){ if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    querySelectorAll(){ return []; },
    createElement:element
  };
  const window = {
    FOMO_SHEET:{people:PEOPLE, tone:() => '--s1', endpoint:'', key:'',
      identity:() => ({who:'Milo', token:'t'}), admin:() => false, session:() => 't'},
    addEventListener(){}, dispatchEvent(){}
  };
  const context = vm.createContext({
    document, window, location:{hash:'#/schedules'}, fetch:async () => ({ok:false, status:500}),
    localStorage:{getItem:k => (store.has(k) ? store.get(k) : null),
      setItem:(k, v) => store.set(k, v), removeItem:k => store.delete(k)},
    confirm:() => true, Date, Math, JSON, console
  });
  vm.runInContext(readFileSync(new URL('../invoice/schedules.js', import.meta.url), 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  /* Everything comes back across the vm boundary as JSON: an array made in
     there is not deepEqual to one made out here, and the tests are about
     what the values are, not which realm made them. */
  const out = code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', context));
  return {
    run,
    ics: text => out('icsBlocks(' + JSON.stringify(text) + ').blocks'),
    breaks: text => out('icsBlocks(' + JSON.stringify(text) + ').breaks'),
    paste: text => out('pasteBlocks(' + JSON.stringify(text) + ')'),
    /* the board, asked the question it exists to answer */
    free(blocks, {need = 2, from = 8, to = 21} = {}){
      run('state.blocks = ' + JSON.stringify(blocks) + ';');
      return out('windows(freeGrid(), ' + need + ', ' + from + ', ' + to + ')');
    },
    /* the board asked about one particular week */
    freeIn(blocks, monday, {need = 2, from = 8, to = 21} = {}){
      run('state.blocks = ' + JSON.stringify(blocks) + '; state.week = ' + JSON.stringify(monday) + ';');
      return out('windows(freeGrid(' + JSON.stringify(monday) + '), ' + need + ', ' + from + ', ' + to + ')');
    },
    runsOn(block, monday){
      return run('runsOn(' + JSON.stringify(block) + ', ' + JSON.stringify(monday) + ')');
    },
    cycleFor(monday, n){ return run('cycleFor(' + JSON.stringify(monday) + ', ' + n + ')'); },
    known(blocks){
      run('state.blocks = ' + JSON.stringify(blocks) + ';');
      return out('knownPeople()');
    }
  };
}

const busy = (who, days, start, end, over = {}) =>
  ({id:who + start + days.join(''), who, days, start, end, label:'x', kind:'class',
    source:'typed', updated:'2026-09-14T10:00:00', ...over});

/* ---------- the calendar file ---------- */

const CAL = lines => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' + lines.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
const EVENT = body => 'BEGIN:VEVENT\r\n' + body.join('\r\n') + '\r\nEND:VEVENT';

test('a weekly rule becomes one block on the days it names', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:CS 106A Lecture',
    'DTSTART;TZID=America/Los_Angeles:20260914T090000',
    'DTEND;TZID=America/Los_Angeles:20260914T101500',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20991211T000000Z'
  ])]));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].days, [1, 3, 5]);
  assert.equal(out[0].start, '09:00');
  assert.equal(out[0].end, '10:15');
  assert.equal(out[0].label, 'CS 106A Lecture');
  assert.equal(out[0].kind, 'class');
});

test('a term already over is not still on the timetable', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:Last spring',
    'DTSTART:20250114T090000',
    'DTEND:20250114T100000',
    'RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20250501T000000Z'
  ])]));
  assert.deepEqual(out, []);
});

/* The other export: every meeting written out on its own date, forty of
   them, which has to come out the same as the rule above. */
test('a term written out meeting by meeting folds back into one block', () => {
  const b = board();
  /* the next Monday, then Mon/Wed/Fri for four weeks — twelve rows in the
     file and one class in the week */
  const monday = new Date();
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  const events = [];
  [0, 2, 4].forEach(offset => {
    for (let week = 0; week < 4; week++) {
      const d = new Date(monday.getTime() + (offset + week * 7) * 864e5);
      const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0');
      events.push(EVENT(['SUMMARY:Chem 1A', 'DTSTART:' + stamp + 'T133000',
        'DTEND:' + stamp + 'T145000']));
    }
  });
  const out = b.ics(CAL(events));
  assert.equal(out.length, 1, 'twelve dated meetings are one weekly commitment');
  assert.equal(out[0].start, '13:30');
  assert.equal(out[0].end, '14:50');
  assert.deepEqual(out[0].days, [1, 3, 5]);
});

test('last year’s calendar is not this term’s week', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:A meeting in 2019', 'DTSTART:20190312T090000', 'DTEND:20190312T100000'
  ])]));
  assert.deepEqual(out, []);
});

test('all-day events never become busy hours on the grid', () => {
  const b = board();
  const cal = CAL([
    EVENT(['SUMMARY:Spring break', 'DTSTART;VALUE=DATE:20990316', 'DTEND;VALUE=DATE:20990321']),
    EVENT(['SUMMARY:Out of town', 'DTSTART:20260914T000000', 'DTEND:20260915T000000',
      'RRULE:FREQ=WEEKLY;BYDAY=SA'])
  ]);
  assert.deepEqual(b.ics(cal), [], 'neither one is an hour in a week');
});

/* ---------- the breaks a school calendar carries ---------- */

test('a break comes back with the days it covers, ending the day it ends', () => {
  const b = board();
  /* DTEND on an all-day event is the morning after: the 21st means the
     break's last day is the 20th, and a board that said the 21st would
     have somebody skip a Monday of class. */
  const out = b.breaks(CAL([EVENT([
    'SUMMARY:Spring Break', 'DTSTART;VALUE=DATE:20990316', 'DTEND;VALUE=DATE:20990321'
  ])]));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'break');
  assert.equal(out[0].label, 'Spring Break');
  assert.equal(out[0].from, '2099-03-16');
  assert.equal(out[0].to, '2099-03-20');
  assert.deepEqual(out[0].days, []);
  assert.equal(out[0].start, '');
});

test('a one-day holiday is a break of one day, not a block of hours', () => {
  const b = board();
  const out = b.breaks(CAL([EVENT([
    'SUMMARY:No classes', 'DTSTART;VALUE=DATE:20991125', 'DTEND;VALUE=DATE:20991126'
  ])]));
  assert.equal(out.length, 1);
  assert.equal(out[0].from, '2099-11-25');
  assert.equal(out[0].to, '2099-11-25');
});

test('breaks that already finished are not news', () => {
  const b = board();
  const out = b.breaks(CAL([
    EVENT(['SUMMARY:Last spring', 'DTSTART;VALUE=DATE:20200316', 'DTEND;VALUE=DATE:20200321']),
    EVENT(['SUMMARY:Next spring', 'DTSTART;VALUE=DATE:20990316', 'DTEND;VALUE=DATE:20990321'])
  ]));
  assert.equal(out.length, 1);
  assert.equal(out[0].label, 'Next spring');
});

test('a whole school calendar comes back as classes and breaks at once', () => {
  const b = board();
  const cal = CAL([
    EVENT(['SUMMARY:CS 106A', 'DTSTART:20260914T090000', 'DTEND:20260914T101500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']),
    EVENT(['SUMMARY:Thanksgiving Break', 'DTSTART;VALUE=DATE:20991123', 'DTEND;VALUE=DATE:20991128']),
    EVENT(['SUMMARY:Winter Break', 'DTSTART;VALUE=DATE:20991214', 'DTEND;VALUE=DATE:21000105'])
  ]);
  assert.equal(b.ics(cal).length, 1);
  const breaks = b.breaks(cal);
  assert.equal(breaks.length, 2);
  assert.deepEqual(breaks.map(x => x.label), ['Thanksgiving Break', 'Winter Break']);
});

test('a folded line and an escaped title survive the read', () => {
  const b = board();
  const out = b.ics('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Econ 1\\, section w\r\n ' +
    'ith the TA\r\nDTSTART:20260915T140000\r\nDTEND:20260915T150000\r\n' +
    'RRULE:FREQ=WEEKLY;BYDAY=TU\r\nEND:VEVENT\r\nEND:VCALENDAR');
  assert.equal(out.length, 1);
  assert.equal(out[0].label, 'Econ 1, section with the TA');
  assert.deepEqual(out[0].days, [2]);
});

test('a UTC stamp is read as the hour it is here, not the hour it is stored in', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:Standup', 'DTSTART:20260915T160000Z', 'DTEND:20260915T163000Z',
    'RRULE:FREQ=WEEKLY;BYDAY=TU'
  ])]));
  assert.equal(out.length, 1);
  const local = new Date(Date.UTC(2026, 8, 15, 16, 0, 0));
  assert.equal(out[0].start,
    String(local.getHours()).padStart(2, '0') + ':' + String(local.getMinutes()).padStart(2, '0'));
});

test('a duration instead of an end time still gives an end time', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:Lab', 'DTSTART:20260916T100000', 'DURATION:PT1H30M', 'RRULE:FREQ=WEEKLY;BYDAY=WE'
  ])]));
  assert.equal(out[0].start, '10:00');
  assert.equal(out[0].end, '11:30');
});

/* ---------- the timetable pasted in ---------- */

test('the compact form a registrar writes reads as the days it means', () => {
  const b = board();
  const {good} = b.paste('CS 106 MWF 9:00-10:15\nChem 1A TTh 1-2:20pm\nSeminar W 4-6pm');
  assert.equal(good.length, 3);
  assert.deepEqual(good[0].days, [1, 3, 5]);
  assert.equal(good[0].start, '09:00');
  assert.equal(good[0].end, '10:15');
  assert.equal(good[0].label, 'CS 106');
  assert.deepEqual(good[1].days, [2, 4]);
  assert.equal(good[1].start, '13:00');
  assert.equal(good[1].end, '14:20');
  assert.deepEqual(good[2].days, [3]);
  assert.equal(good[2].start, '16:00');
  assert.equal(good[2].end, '18:00');
});

test('days written out in words read the same as the short form', () => {
  const b = board();
  const {good} = b.paste('Shift at the library Tue Thu 2pm-6pm\nPractice weekdays 6:30-8am');
  assert.deepEqual(good[0].days, [2, 4]);
  assert.equal(good[0].start, '14:00');
  assert.equal(good[0].end, '18:00');
  assert.equal(good[0].kind, 'work');
  assert.deepEqual(good[1].days, [1, 2, 3, 4, 5]);
  assert.equal(good[1].start, '06:30');
  assert.equal(good[1].end, '08:00');
});

test('a line that cannot be read is handed back rather than dropped in silence', () => {
  const b = board();
  const {good, bad} = b.paste('CS 106 MWF 9:00-10:15\nsomething on Tuesday\n9-10 whenever');
  assert.equal(good.length, 1);
  assert.equal(bad.length, 2);
  assert.match(bad[0].why, /hours/);
  assert.match(bad[1].why, /days/);
  assert.equal(bad[0].line, 'something on Tuesday');
});

/* ---------- the board itself ---------- */

test('somebody who has said nothing is left out, not counted free', () => {
  const b = board();
  assert.deepEqual(b.known([busy('Milo', [1], '09:00', '10:00')]), ['Milo']);
  assert.deepEqual(b.known([busy('Milo', [1], '09:00', '10:00'),
    {id:'n1', who:'Bijan', days:[], start:'', end:'', label:'', kind:'none', source:'typed'}]),
    ['Milo', 'Bijan']);
});

test('a window is only the hours everybody in it is actually free', () => {
  const b = board();
  /* Milo is in class Tuesday until noon, Bijan from 2pm. The pair of them
     are free 12:00–14:00 and that is the whole of it. */
  const found = b.free([
    busy('Milo', [2], '09:00', '12:00'),
    busy('Bijan', [2], '14:00', '17:00')
  ], {need:2});
  const midday = found.filter(w => w.day === 2 && w.start === 12 * 60)[0];
  assert.ok(midday, 'the gap between the two of them is a window');
  assert.equal(midday.end, 14 * 60);
  assert.deepEqual(midday.who.slice().sort(), ['Bijan', 'Milo']);
  /* and it does not run on into Bijan's afternoon */
  assert.equal(found.filter(w => w.day === 2 && w.start === 12 * 60 && w.end > 14 * 60).length, 0);
});

test('a block that spills over the half hour keeps the rest of it busy', () => {
  const b = board();
  const found = b.free([
    busy('Milo', [3], '09:00', '10:15'),
    busy('Bijan', [3], '08:00', '09:00')
  ], {need:2});
  const wed = found.filter(w => w.day === 3)[0];
  /* 10:15 is inside the 10:00 slot, so the window opens at 10:30 — not at
     10:00, which would have put the two of them in a room Milo is still in
     a lecture hall for. */
  assert.equal(wed.start, 10 * 60 + 30);
});

test('nothing is free when everybody is busy, and the board says so with an empty list', () => {
  const b = board();
  const blocks = [];
  ['Milo', 'Bijan'].forEach(p => { for (let d = 1; d <= 7; d++) blocks.push(busy(p, [d], '00:00', '23:30')); });
  assert.deepEqual(b.free(blocks, {need:2}), []);
});

test('a window shorter than an hour is not a window', () => {
  const b = board();
  const found = b.free([
    busy('Milo', [1], '08:00', '13:00'),
    busy('Milo', [1], '13:30', '20:00'),
    busy('Bijan', [1], '08:00', '12:00')
  ], {need:2});
  assert.equal(found.filter(w => w.day === 1 && w.start === 13 * 60).length, 0);
});

test('the window only covers the hours the board is showing', () => {
  const b = board();
  const found = b.free([busy('Milo', [1], '09:00', '10:00'),
    busy('Bijan', [1], '09:00', '10:00')], {need:2, from:8, to:21});
  found.forEach(w => {
    assert.ok(w.start >= 8 * 60, 'no window starts before the board does');
    assert.ok(w.end <= 21 * 60, 'no window runs past the end of the board');
  });
});

/* ---------- weeks that are not every week ----------

   A lab every other Tuesday is the one thing a single repeating week
   cannot say. Read as weekly it books out every Tuesday in the term, half
   of which are free — which is the expensive direction to be wrong in,
   because the windows it hides are the ones people would have used. */

test('a fortnightly block runs on alternate weeks and nothing else', () => {
  const b = board();
  /* two consecutive Mondays; a 1-of-2 block falls on exactly one of them */
  const first = '2026-09-21', second = '2026-09-28', third = '2026-10-05';
  const cycle = b.cycleFor(first, 2);
  const block = {who:'Milo', days:[2], start:'14:00', end:'17:00', label:'Lab',
    kind:'class', week:cycle};
  assert.equal(b.runsOn(block, first), true);
  assert.equal(b.runsOn(block, second), false);
  assert.equal(b.runsOn(block, third), true, 'and it comes back round');
});

test('a block with no rotation on it runs every week, including one saved before rotations existed', () => {
  const b = board();
  const weekly = {who:'Milo', days:[2], start:'14:00', end:'17:00', label:'Lecture', week:'every'};
  const old = {who:'Milo', days:[2], start:'14:00', end:'17:00', label:'Lecture'};
  ['2026-09-21', '2026-09-28', '2026-10-05'].forEach(monday => {
    assert.equal(b.runsOn(weekly, monday), true);
    assert.equal(b.runsOn(old, monday), true, 'silence means every week');
  });
});

test('the week you are looking at is the week the board answers for', () => {
  const b = board();
  const first = '2026-09-21', second = '2026-09-28';
  const onFirst = b.cycleFor(first, 2);
  const blocks = [
    {id:'1', who:'Milo', days:[2], start:'09:00', end:'12:00', label:'Lab', kind:'class',
      week:onFirst, source:'typed'},
    {id:'2', who:'Bijan', days:[2], start:'13:00', end:'14:00', label:'Seminar', kind:'class',
      week:'every', source:'typed'}
  ];
  /* On the lab week nothing can be booked across 9–12; on the other week
     the same hours are the two of them free. */
  const covers = list => list.some(w => w.day === 2 && w.start < 12 * 60 && w.end > 9 * 60 &&
    w.who.length === 2);
  assert.equal(covers(b.freeIn(blocks, first, {need:2})), false,
    'nobody is offered the hours the lab is running in');
  assert.equal(covers(b.freeIn(blocks, second, {need:2})), true,
    'and on the week with no lab, those same hours are a window');
});

test('every-other-week in a calendar is read as every other week, not every week', () => {
  const b = board();
  const out = b.ics(CAL([EVENT([
    'SUMMARY:CHEM 31A Lab',
    'DTSTART:20260915T140000',
    'DTEND:20260915T170000',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU'
  ])]));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].days, [2]);
  assert.match(out[0].week, /^[12]\/2$/);
  /* and it lands on the week the rule actually starts in */
  assert.equal(b.runsOn(out[0], '2026-09-14'), true);
  assert.equal(b.runsOn(out[0], '2026-09-21'), false);
});

test('a weekly lecture and a fortnightly lab at the same hour stay two things', () => {
  const b = board();
  const out = b.ics(CAL([
    EVENT(['SUMMARY:CHEM 31A', 'DTSTART:20260915T140000', 'DTEND:20260915T170000',
      'RRULE:FREQ=WEEKLY;BYDAY=TU']),
    EVENT(['SUMMARY:CHEM 31A', 'DTSTART:20260917T140000', 'DTEND:20260917T170000',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH'])
  ]));
  assert.equal(out.length, 2, 'the fold must not swallow one into the other');
  assert.equal(out.filter(x => x.week === 'every').length, 1);
  assert.equal(out.filter(x => /\/2$/.test(x.week)).length, 1);
});

test('a rotation longer than a month is left off rather than guessed at', () => {
  const b = board();
  assert.deepEqual(b.ics(CAL([EVENT([
    'SUMMARY:Rare thing', 'DTSTART:20260915T140000', 'DTEND:20260915T150000',
    'RRULE:FREQ=WEEKLY;INTERVAL=6;BYDAY=TU'
  ])])), []);
});
