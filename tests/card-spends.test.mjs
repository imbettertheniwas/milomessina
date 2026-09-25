import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

/* Arya hands his card over for a lunch run, so anybody can put his name in
   the "who paid" row. What follows from that is the whole feature: the line
   is his money going out, so nothing is owed on it, and the person who typed
   it is no longer the person it names — which is who has to be able to fix
   a typo in it afterwards. */
const spend = (who = 'Jesse', over = {}) =>
  ({who, what: 'Team lunch', category: 'lunch', amount: 30, date: '2026-09-15', shared: 'Jesse,Bijan', ...over});

test('an intern can log a spend on Arya’s card, and it lands settled', () => {
  const h = harness(), m = h.login('Jesse');
  const r = h.call(m, 'add', spend('Arya')).rows[0];
  assert.equal(r.who, 'Arya');
  assert.equal(r.loggedBy, 'Jesse');
  assert.equal(r.status, 'reimbursed');
  assert.ok(h.call(m, 'list').rows[0].id);
  // Nobody is waiting on money that never left an intern's account.
  assert.equal(h.call(h.login('Arya'), 'settle', {who: 'Arya'}).ok, false);
});

test('Arya’s is the only card anybody may borrow', () => {
  const h = harness(), m = h.login('Jesse');
  assert.equal(h.call(m, 'add', spend('Bijan')).ok, false);
  assert.equal(h.call(m, 'subadd', spend('Milo')).ok, false);
  assert.equal(h.call(m, 'add', spend('Jesse')).ok, true);
});

test('whoever logged a card line can still fix it, though it is settled', () => {
  const h = harness(), m = h.login('Jesse'), b = h.login('Bijan');
  const r = h.call(m, 'add', spend('Arya')).rows[0];
  assert.equal(h.call(b, 'edit', {id: r.id, ...spend('Arya', {amount: 99})}).ok, false);
  assert.equal(h.call(b, 'delete', {id: r.id}).ok, false);
  const fixed = h.call(m, 'edit', {id: r.id, ...spend('Arya', {amount: 42})}).rows[0];
  assert.equal(fixed.amount, 42);
  assert.equal(fixed.status, 'reimbursed');
  assert.equal(fixed.loggedBy, 'Jesse');
  assert.equal(h.call(m, 'delete', {id: r.id}).rows.length, 0);
});

test('a line moved onto the card is settled by the move, and owed again when moved off', () => {
  const h = harness(), m = h.login('Jesse');
  const r = h.call(m, 'add', spend('Jesse')).rows[0];
  assert.equal(r.status, 'pending');
  const onCard = h.call(m, 'edit', {id: r.id, ...spend('Arya')}).rows[0];
  assert.equal(onCard.status, 'reimbursed');
  assert.ok(h.sheets.invoice.getRange(2, h.ctx.INVOICE_COLS.indexOf('reimbursed') + 1).getValues()[0][0]);
  const back = h.call(m, 'edit', {id: r.id, ...spend('Jesse')}).rows[0];
  assert.equal(back.status, 'pending');
  assert.equal(h.sheets.invoice.getRange(2, h.ctx.INVOICE_COLS.indexOf('reimbursed') + 1).getValues()[0][0], '');
});

test('lines Arya logged before his card counted as settled read as settled now', () => {
  const h = harness(), a = h.login('Arya');
  h.call(a, 'add', spend('Jesse'));
  const sheet = h.sheets.invoice;
  sheet.getRange(2, h.ctx.INVOICE_COLS.indexOf('who') + 1).setValue('Arya');
  sheet.getRange(2, h.ctx.INVOICE_COLS.indexOf('status') + 1).setValue('pending');
  assert.equal(h.call(a, 'list').rows[0].status, 'reimbursed');
  // And a stored row that says otherwise cannot put Arya back in the owed column.
  assert.equal(h.call(a, 'update', {id: h.call(a, 'list').rows[0].id, status: 'pending'}).rows[0].status, 'reimbursed');
  assert.equal(h.call(a, 'settle', {who: 'Arya'}).ok, false);
});

test('a monthly rule can sit on the card, and its lines come out settled', () => {
  const h = harness(), m = h.login('Jesse'), b = h.login('Bijan');
  const rule = h.call(m, 'subadd', spend('Arya', {date: '2026-09-15', day: 15})).subs[0];
  assert.equal(rule.who, 'Arya');
  assert.equal(rule.loggedBy, 'Jesse');
  const written = h.call(m, 'list').rows;
  assert.ok(written.length >= 1);
  written.forEach(r => {
    assert.equal(r.who, 'Arya');
    assert.equal(r.loggedBy, 'Jesse');
    assert.equal(r.status, 'reimbursed');
  });
  assert.equal(h.call(b, 'subpause', {id: rule.id, active: false}).ok, false);
  assert.equal(h.call(m, 'subpause', {id: rule.id, active: false}).subs[0].active, 'no');
});
