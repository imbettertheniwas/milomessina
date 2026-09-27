import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../invoice/index.html', import.meta.url), 'utf8');

function lift(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' is defined');
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + name);
}

function page(rows = [], endDay = '2026-09-26') {
  const nodes = new Map(), effects = [];
  const node = id => {
    if (!nodes.has(id)) {
      let markup = '';
      nodes.set(id, {
        textContent: '', writes: 0, buttons: [],
        get innerHTML() { return markup; },
        set innerHTML(value) {
          markup = value;
          this.writes++;
          if (id === 'ov-daily') {
            this.buttons = Array.from(value.matchAll(/<button[^>]*data-spend-day="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>/g), match => ({
              dataset: {spendDay: match[1]}, attributes: {'aria-pressed': match[2]},
              setAttribute(name, value) { this.attributes[name] = value; }
            }));
          }
        },
        querySelectorAll(selector) {
          assert.equal(selector, '[data-spend-day]');
          return this.buttons;
        }
      });
    }
    return nodes.get(id);
  };
  const c = vm.createContext({
    rows, endDay, overviewSpendDay: '', overviewSpendPicked: false, overviewSpendActivity: null, $: node,
    document: {activeElement: null},
    today: () => c.endDay,
    money: n => '$' + Number(n).toFixed(2),
    fetch: (...args) => effects.push(['fetch', ...args]),
    setView: (...args) => effects.push(['setView', ...args]),
    render: (...args) => effects.push(['render', ...args]),
    openLedgerDetail: (...args) => effects.push(['openLedgerDetail', ...args])
  });
  for (const name of ['esc', 'isoOf', 'buildSpendActivity', 'spendActivityDate', 'paintSpendActivity', 'paintSpendPurchases', 'selectSpendDay']) {
    vm.runInContext(lift(name), c);
  }
  return {c, node, effects};
}

function expense(id, date, amount = 10, status = 'pending', extras = {}) {
  return {id, date, amount, status, what: 'Expense ' + id, who: 'Milo', ...extras};
}

function dateKeys(activity) {
  return Array.from(activity.span, day => day.key);
}

test('activity covers exactly 14 calendar days, excluding older and future expenses', () => {
  const {c} = page();
  const included = expense('start', '2025-12-25');
  const activity = c.buildSpendActivity([
    expense('old', '2025-12-24', 500), included,
    expense('end', '2026-01-07', 20, 'reimbursed'),
    expense('future', '2026-01-08', 900)
  ], '2026-01-07');
  assert.equal(activity.span.length, 14);
  assert.equal(activity.span[0].key, '2025-12-25');
  assert.equal(activity.span[13].key, '2026-01-07');
  assert.equal(new Set(dateKeys(activity)).size, 14);
  assert.equal(activity.total, 30);
  assert.equal(activity.byDay['2025-12-25'].rows[0], included, 'actual purchase identity is retained');
  assert.equal(activity.byDay['2025-12-24'], undefined);
  assert.equal(activity.byDay['2026-01-08'], undefined);
});

test('calendar grouping keeps every day across spring and autumn DST changes', () => {
  const oldTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const {c} = page();
    const spring = c.buildSpendActivity([], '2026-03-14');
    const autumn = c.buildSpendActivity([], '2026-11-07');
    assert.deepEqual(dateKeys(spring), Array.from({length: 14}, (_, i) => '2026-03-' + String(i + 1).padStart(2, '0')));
    assert.deepEqual(dateKeys(autumn), [
      '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
      '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'
    ]);
    assert.equal(spring.byDay['2026-03-08'].date - spring.byDay['2026-03-07'].date, 23 * 60 * 60 * 1000);
    assert.equal(autumn.byDay['2026-11-01'].date - autumn.byDay['2026-10-31'].date, 25 * 60 * 60 * 1000);
    assert.equal(c.spendActivityDate('2026-03-08'), 'Sun, March 8');
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});

test('paid, owed and daily totals use cents without floating-point drift', () => {
  const {c} = page();
  const activity = c.buildSpendActivity([
    expense('a', '2026-09-25', 0.1), expense('b', '2026-09-25', 0.2),
    expense('c', '2026-09-25', '12.34', 'reimbursed'),
    expense('d', '2026-09-26', '0.10', 'reimbursed'),
    expense('e', '2026-09-26', '0.20', 'reimbursed')
  ], '2026-09-26');
  assert.equal(activity.owed, 0.3);
  assert.equal(activity.paid, 12.64);
  assert.equal(activity.total, 12.94);
  assert.equal(activity.byDay['2026-09-25'].total, 12.64);
  assert.equal(activity.byDay['2026-09-26'].total, 0.3);
  assert.equal(activity.peak, 12.64);
});

test('first render selects the latest active day, while an empty window selects today', () => {
  const {c, node} = page([
    expense('latest', '2026-09-25', 21), expense('older', '2026-09-14', 900)
  ]);
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-25');
  assert.equal(node('ov-daily').buttons.length, 14);
  assert.match(node('ov-spend-purchases').innerHTML, /Fri, September 25/);
  assert.match(node('ov-spend-purchases').innerHTML, /Expense latest/);

  const empty = page([expense('outside-window', '2026-09-01', 900)]);
  empty.c.paintSpendActivity();
  assert.equal(empty.c.overviewSpendDay, '2026-09-26');
  assert.match(empty.node('ov-daily').innerHTML, /\$0\.00/);
  assert.doesNotMatch(empty.node('ov-daily').innerHTML, /is-largest|largest day marked/);
  assert.match(empty.node('ov-spend-purchases').innerHTML, /No expenses logged on this day\./);
  assert.doesNotMatch(empty.node('ov-spend-purchases').innerHTML, /data-ledger-date|#\/charge\//);
});

test('an explicitly selected blank day survives refresh, then resets when outside the range', () => {
  const {c, node} = page([expense('active', '2026-09-25')]);
  c.paintSpendActivity();
  c.selectSpendDay('2026-09-14');
  c.rows.push(expense('new', '2026-09-26'));
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-14');
  assert.match(node('ov-spend-purchases').innerHTML, /No expenses logged on this day\./);
  c.endDay = '2026-09-28';
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-26');
  assert.match(node('ov-spend-purchases').innerHTML, /Expense new/);
});

test('an empty initial paint switches to the latest active day when ledger data arrives', () => {
  const {c, node} = page();
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-26');
  c.rows = [expense('loaded', '2026-09-23')];
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-23');
  assert.match(node('ov-spend-purchases').innerHTML, /Expense loaded/);
  c.selectSpendDay('2026-09-24');
  c.rows.push(expense('later', '2026-09-25'));
  c.paintSpendActivity();
  assert.equal(c.overviewSpendDay, '2026-09-24');
  assert.match(node('ov-spend-purchases').innerHTML, /No expenses logged on this day\./);
});

test('mixed days expose both statuses, exact amounts, purchase IDs and escaped text', () => {
  const dangerous = {what: '<img src=x onerror="alert(1)"> & lunch', who: '<Milo & "team">'};
  const id = 'purchase /?&"#<id>';
  const {c, node} = page([
    expense(id, '2026-09-25', 12.5, 'pending', dangerous),
    expense('paid', '2026-09-25', 18.75, 'reimbursed')
  ]);
  c.paintSpendActivity();
  const strip = node('ov-daily').innerHTML, detail = node('ov-spend-purchases').innerHTML;
  assert.match(strip, /is-mixed/);
  assert.match(strip, /\$31\.25 across 2 expenses, \$12\.50 still owed, \$18\.75 reimbursed/);
  assert.match(strip, /Largest spending day/);
  assert.match(detail, /Still owed/);
  assert.match(detail, /Reimbursed/);
  assert.ok(detail.includes('href="#/charge/' + encodeURIComponent(id) + '"'));
  assert.match(detail, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; lunch/);
  assert.match(detail, /Fronted by &lt;Milo &amp; &quot;team&quot;&gt;/);
  assert.doesNotMatch(detail, /<img|<Milo/);
  assert.match(detail, /\$12\.50/);
  assert.match(detail, /\$18\.75/);
});

test('busy days show at most three purchase links plus an exact-date link to all expenses', () => {
  const {c, node} = page(Array.from({length: 5}, (_, i) => expense('row-' + i, '2026-09-25', i + 1)));
  c.paintSpendActivity();
  const detail = node('ov-spend-purchases').innerHTML;
  assert.equal((detail.match(/href="#\/charge\//g) || []).length, 3);
  assert.match(detail, /\$15\.00/);
  assert.match(detail, /data-ledger-date="2026-09-25"/);
  assert.match(detail, /View all 5 expenses/);
  assert.doesNotMatch(detail, /#\/charge\/row-3|#\/charge\/row-4/);
});

test('day selection updates only the selection and purchases, with no navigation or fetch', () => {
  const {c, node, effects} = page([
    expense('a', '2026-09-14'), expense('b', '2026-09-25')
  ]);
  c.paintSpendActivity();
  const strip = node('ov-daily'), detail = node('ov-spend-purchases');
  const previousStripWrites = strip.writes, previousDetailWrites = detail.writes;
  const existingButtons = strip.buttons;
  c.selectSpendDay('2026-09-14');
  assert.equal(strip.writes, previousStripWrites, 'timeline is not replaced, retaining keyboard focus');
  assert.equal(strip.buttons, existingButtons);
  assert.equal(detail.writes, previousDetailWrites + 1);
  assert.deepEqual(strip.buttons.filter(button => button.attributes['aria-pressed'] === 'true').map(button => button.dataset.spendDay), ['2026-09-14']);
  assert.match(detail.innerHTML, /Expense a/);
  assert.deepEqual(effects, []);
  const selectedMarkup = detail.innerHTML;
  c.selectSpendDay('2020-01-01');
  assert.equal(c.overviewSpendDay, '2026-09-14');
  assert.equal(detail.innerHTML, selectedMarkup);
  assert.equal(detail.writes, previousDetailWrites + 1);
});
