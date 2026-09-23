import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

/* Something bought for somebody off the roster — a guest at lunch — goes in
   `shared` as `Name (guest)`, beside the interns it was also for, and counts
   toward the split like anyone ticked. */
const spend = (who = 'Milo', over = {}) =>
  ({who, what: 'Team lunch', category: 'lunch', amount: 30, date: '2026-09-15', shared: 'Milo,Bijan', ...over});

test('a guest name is kept in the split, cleaned, alongside roster names', () => {
  const h = harness(), m = h.login('Milo');
  const r = h.call(m, 'add', spend('Milo', {shared: 'Milo, Sam Lee (guest),  Dana ( Ops ) (guest), Stranger, Sam Lee (guest)'})).rows[0];
  assert.equal(r.shared, 'Milo, Sam Lee (guest), Dana Ops (guest)');
});

test('a bare "(guest)" with no name is dropped, and the deployment says it keeps guests', () => {
  const h = harness(), m = h.login('Milo');
  const r = h.call(m, 'add', spend('Milo', {shared: 'Milo, (guest), () (guest)'})).rows[0];
  assert.equal(r.shared, 'Milo');
  assert.equal(typeof h.ctx.guestEntry, 'function');
});

test('a monthly rule carries its guests onto the lines it writes', () => {
  const h = harness(), m = h.login('Milo');
  const rule = h.call(m, 'subadd', spend('Milo', {shared: 'Milo, Sam (guest)', day: 15})).subs[0];
  assert.equal(rule.shared, 'Milo, Sam (guest)');
  h.call(m, 'list').rows.forEach(r => assert.equal(r.shared, 'Milo, Sam (guest)'));
});
