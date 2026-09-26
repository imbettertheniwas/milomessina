import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

// Count remote spreadsheet operations, not elapsed time in the in-memory fake.
function watch(sheet) {
  const counts = {reads:0, writes:0, appends:0};
  const getRange = sheet.getRange, appendRow = sheet.appendRow;
  sheet.getRange = function(row, ...args) {
    const range = getRange.call(this, row, ...args);
    const getValues = range.getValues, setValues = range.setValues;
    range.getValues = function() { if (row > 1) counts.reads++; return getValues.call(this); };
    range.setValues = function(values) { if (row > 1) counts.writes++; return setValues.call(this, values); };
    return range;
  };
  sheet.appendRow = function(values) { counts.appends++; return appendRow.call(this, values); };
  return counts;
}

function limitCapacity(sheet, initial) {
  let capacity = initial;
  const getRange = sheet.getRange;
  sheet.getMaxRows = () => capacity;
  sheet.insertRowsAfter = (after, added) => {
    assert.equal(after, capacity);
    assert.ok(added > 0);
    capacity += added;
  };
  sheet.getRange = function(row, column, height=1, width=1) {
    assert.ok(row + height - 1 <= capacity, 'expand the sheet before writing beyond its row capacity');
    return getRange.call(this, row, column, height, width);
  };
}

test('beta manager sheet reads stay constant as the member list grows and writes remain fresh', () => {
  const h = harness(), operator = h.login('Arya');
  const api = (action, payload={}) => h.ctx.betaApi({_session:operator, action, ...payload});
  const initialized = api('list');
  assert.equal(initialized.ok, true);
  const joined = h.ctx.internalSessionApi({action:'betajoin', invite:'beta', name:'Maya', email:'maya@example.com', phone:'+1 212 555 0100', github:'maya-builds'});
  assert.equal(joined.ok, true);
  const original = h.ctx.betaRead('internal_beta_members', h.ctx.BETA_MEMBERS)[0];
  for (let n=1; n<40; n++) {
    const copy = {...original, id:'member-'+n, name:'Member '+n, email:'member'+n+'@example.com'};
    delete copy._row;
    h.ctx.betaWrite('internal_beta_members', h.ctx.BETA_MEMBERS, copy);
  }
  const batches = watch(h.sheets.internal_beta_batches), members = watch(h.sheets.internal_beta_members);
  const list = api('list');
  assert.equal(list.members.length, 40);
  assert.equal(list.peers.length, 40);
  assert.ok(list.members.every(member => member.batch === initialized.group.name));
  assert.equal(members.reads, 1, 'load member rows once for the response');
  assert.equal(batches.reads, 2, 'one initialization check and one final batch snapshot, regardless of member count');
  const renamed = api('batchupdate', {id:initialized.group.id, name:'Updated group'});
  assert.ok(renamed.members.every(member => member.batch === 'Updated group'));
  assert.equal(renamed.group.name, 'Updated group');
  api('memberupdate', {id:joined.member.id, status:'paused'});
  assert.equal(h.ctx.betaApi({_session:joined.token, action:'list'}).code, 'AUTH_REQUIRED');
});

test('admin counts, audit and selected rows share one fresh read of each table', () => {
  const h = harness(), operator = h.login('Arya');
  const api = (action, payload={}) => h.ctx.internalAdminApi({_key:'monkey', _session:operator, action, ...payload});
  assert.equal(api('list').ok, true);
  const counts = {};
  for (const name of h.ctx.ADMIN_TABLES) {
    const table = h.ctx.adminTable(name);
    const record = {id:name+'-row', who:'Former intern', logged_by:'Former intern', date:'2026-09-25', day:'2026-09-25', amount:12, what:'Example', status:'pending', body:'Example', next:'2099-10-01', active:'no'};
    table.sh.appendRow(table.cols.map(column => record[column] ?? ''));
    counts[name] = watch(table.sh);
  }
  const result = api('rows', {table:'invoice', who:'Former intern'});
  assert.equal(result.ok, true);
  for (const name of h.ctx.ADMIN_TABLES) assert.equal(counts[name].reads, 1, name);
  assert.deepEqual(result.counts['Former intern'], {rows:1, days:1, hours:1, subs:1, posts:1, schedules:1, owed:12});
  assert.equal(result.audit.filter(row => row.kind === 'stranger').length, 5);
  assert.equal(result.rows[0].id, 'invoice-row');
  const invoice = h.ctx.invoiceSheet();
  invoice.getRange(2, h.ctx.INVOICE_COLS.indexOf('amount')+1).setValue(25);
  const refreshed = api('rows', {table:'invoice', who:'Former intern'});
  assert.equal(refreshed.counts['Former intern'].owed, 25);
  assert.notEqual(refreshed.rows[0].key, result.rows[0].key);
});

test('visit availability reads and writes do not open the requests sheet and still require the service secret', () => {
  const secret = 'visit-performance-secret-'.repeat(2);
  const h = harness({VISITS_SERVICE_SECRET:secret});
  let opens = 0;
  h.ctx.SpreadsheetApp.getActiveSpreadsheet = () => { opens++; throw Error('Sheet unavailable'); };
  h.ctx.SpreadsheetApp.openById = h.ctx.SpreadsheetApp.getActiveSpreadsheet;
  const call = (action, payload={}) => h.ctx.visitsApi({secret, action, ...payload});
  assert.equal(call('settings').data.availability, null);
  const availability = Array.from({length:7}, (_,day) => ({open:day!==0}));
  assert.equal(call('saveSettings', {availability}).ok, true);
  assert.deepEqual(call('settings').data.availability, availability);
  assert.equal(call('saveSettings', {availability:[]}).code, 'INVALID');
  assert.equal(call('saveSettings', {secret:'wrong', availability:[]}).code, 'UNAUTHORIZED');
  assert.equal(opens, 0);
  assert.deepEqual(call('settings').data.availability, availability);
});

test('ledger reads recurring rows once and batches a year of due charges without duplicates', () => {
  const h = harness(), operator = h.login('Arya');
  h.ctx.Utilities.formatDate = (date, zone, format) => format === 'yyyy-MM-dd' ? '2026-09-25' : date.toISOString().slice(0,19);
  const invoice = h.ctx.invoiceSheet(), subs = h.ctx.subSheet();
  const row = {id:'recurring-rule', created:'2025-10-01', who:'Milo', what:'Monthly software', category:'software', amount:15, day:25, next:'2025-10-25', active:'yes', logged_by:'Milo'};
  subs.appendRow(h.ctx.SUB_COLS.map(column => row[column] ?? ''));
  limitCapacity(invoice, 2);
  const subCounts = watch(subs), invoiceCounts = watch(invoice);
  const post = () => h.ctx.doPost({postData:{contents:JSON.stringify({_api:'invoice', _key:'monkey', _session:operator, action:'list'})}});
  const result = post();
  assert.equal(result.ok, true);
  assert.equal(subCounts.reads, 1);
  assert.equal(invoiceCounts.appends, 0);
  assert.equal(invoiceCounts.writes, 1);
  assert.equal(result.rows.length, 12);
  assert.equal(new Set(result.rows.map(row => row.date)).size, 12);
  assert.equal(result.subs[0].next, '2026-10-25');
  assert.equal(result.subs[0].last, '2026-09-25');
  assert.equal(post().rows.length, 12);
  assert.equal(invoiceCounts.writes, 1);
  assert.equal(subCounts.reads, 2, 'each new request reads a fresh subscription snapshot');
});

test('referral refresh reuses sweep inputs but includes newly arrived referrals immediately', () => {
  const h = harness(), operator = h.login('Arya');
  const api = () => h.ctx.referApi({_key:'monkey', _session:operator, action:'list'});
  const owner = {code:'maya', claimed:'2026-09-01', 'full name':'Maya', email:'maya@example.com', status:'active'};
  h.ctx.referrerSheet().appendRow(h.ctx.REFER_COLS.map(column => owner[column] ?? ''));
  h.ctx.writeRow('apply', {received:'2026-09-25', 'full name':'Riley', email:'riley@example.com', ref:'maya'});
  assert.equal(api().referrals.length, 1);
  const referrers = watch(h.sheets.referrers), referrals = watch(h.sheets.referrals);
  assert.equal(api().referrals.length, 1);
  assert.equal(referrers.reads, 1);
  assert.equal(referrals.reads, 1);
  h.ctx.writeRow('apply', {received:'2026-09-26', 'full name':'Jordan', email:'jordan@example.com', ref:'maya'});
  const refreshed = api();
  assert.equal(refreshed.referrals.length, 2);
  assert.equal(referrers.reads, 2);
  assert.equal(referrals.reads, 3, 'reread referrals only when the sweep appends a new record');
  assert.equal(api().referrals.length, 2);
});

test('schedule imports write all new blocks together while retaining hand-entered commitments', () => {
  const h = harness(), token = h.login('Jesse');
  const call = (action, payload) => h.call(token, action, payload, 'schedules');
  assert.equal(call('add', {who:'Jesse', label:'Soccer', kind:'busy', days:[6], start:'10:00', end:'12:00'}).ok, true);
  limitCapacity(h.sheets.schedules, 2);
  const counts = watch(h.sheets.schedules);
  const blocks = Array.from({length:40}, (_,n) => ({label:'Class '+n, kind:'class', days:[n%5+1], start:'09:00', end:'10:00'}));
  const imported = call('import', {who:'Jesse', source:'ics', blocks});
  assert.equal(imported.ok, true);
  assert.equal(imported.schedules.length, 41);
  assert.equal(counts.appends, 0);
  assert.equal(counts.writes, 1);
  const again = call('import', {who:'Jesse', source:'ics', blocks});
  assert.equal(again.schedules.length, 41);
  assert.equal(again.schedules.filter(row => row.label === 'Soccer').length, 1);
  assert.equal(new Set(again.schedules.map(row => row.id)).size, 41);
  assert.equal(counts.writes, 2);
});
