/* The contribution calendar is the only thing the console can read about
   somebody whose repositories are private. It is scraped from markup rather
   than an API, so the parser has to be exact about what it accepts and
   quiet when the markup moves — a half-read calendar would be a wrong
   number on a panel people are judged by, and nobody could spot it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommitHandler} from '../api/commits.mjs';

const NOW = Date.parse('2026-09-17T12:00:00Z');

/* GitHub's shape, as it serves it: the date and the cell id live on the
   <td>, and the count lives in a <tool-tip> that points back at the id. */
function calendarHtml(counts, {days = 370, cells = null} = {}){
  const td = [], tip = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(2025, 8, 14) + i * 86400000).toISOString().slice(0, 10);
    const id = 'contribution-day-component-' + (i % 7) + '-' + Math.floor(i / 7);
    const n = counts[d] || 0;
    td.push('<td data-ix="' + i + '" data-date="' + d + '" id="' + id + '" class="ContributionCalendar-day">');
    tip.push('<tool-tip for="' + id + '" data-view-component="true">' +
      (n ? n + (n === 1 ? ' contribution' : ' contributions') : 'No contributions') +
      ' on ' + d + '.</tool-tip>');
  }
  const body = td.slice(0, cells ?? days).join('') + tip.slice(0, cells ?? days).join('');
  return '<div class="js-yearly-contributions">' + body + '</div>';
}

/* A server that has no public repositories to offer and whatever calendar
   the test hands it, so the calendar is the only thing under test. */
function server({calendar, repos = [], commits = []} = {}){
  const seen = {calls: 0, urls: []};
  const handler = createCommitHandler({now: () => NOW, env: {}, fetchImpl: async url => {
    if (url.startsWith('https://github.com/users/')) {
      seen.calls++; seen.urls.push(url);
      if (calendar === null) throw new Error('network');
      if (calendar === false) return {ok: false, status: 404};
      return {ok: true, text: async () => calendar};
    }
    if (/\/users\/[^/]+\/repos/.test(url)) return {ok: true, json: async () => repos};
    return {ok: true, json: async () => commits};
  }});
  return {handler, seen};
}

async function read(opts){
  const {handler, seen} = server(opts);
  let body;
  const res = {setHeader(){}, status(){return this;}, end(v){body = v; return this;},
               json(v){body = JSON.stringify(v); return this;}};
  await handler({method: 'GET', headers: {}}, res);
  return {people: JSON.parse(body).people, seen};
}

test('a calendar is read into per-day counts inside the window', async () => {
  const {people} = await read({calendar: calendarHtml({
    '2026-09-15': 5, '2026-09-16': 13, '2026-09-07': 1
  })});
  const cal = people.Arya.calendar;
  assert.equal(cal.days['2026-09-15'], 5);
  assert.equal(cal.days['2026-09-16'], 13);
  assert.equal(cal.days['2026-09-07'], 1);
  assert.equal(cal.total, 19);
});

test('a day older than the window is left out of the total', async () => {
  /* the window opens 13 weeks back, so the season before it is not ours */
  const {people} = await read({calendar: calendarHtml({
    '2025-12-25': 99, '2026-09-16': 4
  })});
  assert.equal(people.Arya.calendar.total, 4);
  assert.equal(people.Arya.calendar.days['2025-12-25'], undefined);
});

test('a singular day parses the same as a plural one', async () => {
  const {people} = await read({calendar: calendarHtml({'2026-09-16': 1})});
  assert.equal(people.Arya.calendar.total, 1);
});

test('markup that no longer looks like a calendar is dropped whole', async () => {
  /* too few cells to be a year: a partial read would be a wrong number */
  const {people} = await read({calendar: calendarHtml({'2026-09-16': 7}, {cells: 40})});
  assert.equal(people.Arya.calendar, null);
});

test('an unreadable calendar costs a line, not the panel', async () => {
  for (const calendar of [null, false, '<div>nothing here</div>']) {
    const {people} = await read({calendar});
    assert.equal(people.Arya.calendar, null, 'no calendar');
    assert.deepEqual(people.Arya.days, {}, 'the commit scan still answered');
    assert.ok(!people.Arya.error, 'and the person is not an error');
  }
});

test('contributions never leak into the commit counts', async () => {
  const {people} = await read({
    calendar: calendarHtml({'2026-09-16': 40}),
    repos: [{full_name: 'someone/repo', pushed_at: '2026-09-16T00:00:00Z'}],
    commits: [{sha: 'a1', author: {login: 'aryatoufanian'},
               commit: {author: {date: '2026-09-16T10:00:00Z'}, message: 'one'}}]
  });
  const arya = people.Arya;
  assert.deepEqual(arya.days, {'2026-09-16': 1}, 'days counts commits and only commits');
  assert.equal(arya.calendar.total, 40, 'the calendar is reported beside it, not inside it');
});

test('each login is asked for once, and every person on the roster is asked', async () => {
  const {people, seen} = await read({calendar: calendarHtml({'2026-09-16': 2})});
  assert.deepEqual(seen.urls, [...new Set(seen.urls)], 'no login is fetched twice');
  /* somebody with two handles is summed, exactly as their commits are */
  const logins = Object.values(people).reduce((n, p) => n + p.logins.length, 0);
  assert.equal(seen.urls.length, logins, 'one contributions page per login');
  assert.ok(seen.urls.some(u => u.includes('aryatoufanian')), 'Arya included');
});
