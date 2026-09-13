/* ─────────────────────────────────────────────────────────────────
   fomo/campus — form receiver

   Paste this whole file into Apps Script (Extensions → Apps Script
   from inside your Google Sheet), fill in CONFIG below, deploy it
   as a web app, and put the /exec URL into ENDPOINT at the top of
   fomo/assets/form.js. Step-by-step: fomo/setup/README.md

   It writes one tab per form — apply, submit, report — and adds
   columns by itself when a form gains a field, so you never have
   to touch the sheet when the HTML changes.
   ───────────────────────────────────────────────────────────────── */

var CONFIG = {
  /* Leave blank if this script lives inside the sheet (Extensions →
     Apps Script). Otherwise paste the long id out of the sheet URL. */
  SHEET_ID: '',

  /* Where /fomo/report uploads land. Created on the first upload.
     The files stay private to your Drive — nobody but you can open
     them unless you share them. */
  UPLOAD_FOLDER: 'fomo campus — report uploads',

  /* Where /invoice receipt photos land — a separate folder, because
     unlike the report uploads above these are deliberately readable by
     anyone holding the link. The whole team has to be able to open a
     receipt off the ledger, and the ledger is shared. Sharing is set on
     each file rather than the folder, so nothing else in your Drive is
     touched by it. */
  RECEIPT_FOLDER: 'fomo campus — receipts',

  /* Blank = no email. Put an address here to get a heads-up on every
     submission; the row is in the sheet either way. */
  NOTIFY_EMAIL: '',

  /* Blank = accept anything. If you set it, it must match FORM_KEY in
     form.js. It rides along in the page source, so treat it as a
     turnstile against drive-by junk, not as a password. */
  SHARED_SECRET: '',

  /* Blank = the stipend ledger at /invoice accepts anything. Set it to
     the same string as PASSCODE in invoice/index.html and the endpoint
     turns away requests that do not carry it. Like SHARED_SECRET it
     rides along in the page source: a turnstile, not a password. */
  INVOICE_KEY: 'monkey'
};

/* ── the endpoint ────────────────────────────────────────────── */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    /* two people submitting in the same second must not race for the
       same row, so everything below runs one at a time */
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) return reply(false, 'empty request');
    var body = JSON.parse(e.postData.contents);

    /* The stipend ledger at /invoice reads and writes its own tab through
       this same deployment. It answers with the whole ledger rather than a
       bare confirmation, so it takes its branch here and never touches the
       form tabs below. */
    if (body._api === 'invoice') return invoiceApi(body);

    if (CONFIG.SHARED_SECRET && body._key !== CONFIG.SHARED_SECRET) return reply(false, 'bad key');

    /* honeypot. A bot filled a field no human can see: tell it everything
       is fine and write nothing. */
    if (body._hp) return reply(true);

    var fileUrl = body._file ? saveUpload(body._file) : null;
    var row = buildRow(body, fileUrl);
    writeRow(tabFor(body._page), row);
    if (CONFIG.NOTIFY_EMAIL) notify(tabFor(body._page), row);

    return reply(true);
  } catch (err) {
    return reply(false, String(err && err.message ? err.message : err));
  } finally {
    lock.releaseLock();
  }
}

/* Open the /exec URL in a browser and you should see this. If you get a
   Google sign-in page instead, the deployment is not set to "Anyone".

   `ledger` answers the question you cannot otherwise ask from outside:
   whether the version actually being SERVED is the one carrying the stipend
   ledger, or an older deployment that only knows about the forms. Apps
   Script serves the last deployed version, not the last saved one, so a
   paste without a redeploy leaves this false. */
function doGet() {
  return reply(true, null, {
    hint: 'fomo campus form receiver is live',
    ledger: typeof invoiceApi === 'function',
    clock: typeof shiftIn === 'function',
    shiftimport: typeof shiftImport === 'function',
    subs: typeof subsRoll === 'function'
  });
}

/* ── the pieces ──────────────────────────────────────────────── */

/* '/fomo/apply/' and '/fomo/apply/index.html' both mean the apply tab */
function tabFor(path) {
  var s = String(path || '').replace(/index\.html?$/i, '').replace(/\/+$/, '');
  return s.split('/').pop() || 'form';
}

/* Underscored field names become readable headers, and anything the form
   sends for its own bookkeeping (_page, _key, _hp, _file) is dropped. */
function buildRow(body, fileUrl) {
  var row = { 'received': new Date(), 'page': tabFor(body._page) };
  Object.keys(body).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    row[k.replace(/_/g, ' ')] = body[k];
  });
  if (fileUrl) row['file'] = fileUrl;
  return row;
}

function writeRow(tabName, row) {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  var headers = sh.getLastRow() > 0
    ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].filter(String)
    : [];

  /* a form that grew a field just grows a column here too */
  var missing = Object.keys(row).filter(function (k) { return headers.indexOf(k) === -1; });
  if (missing.length) {
    headers = headers.concat(missing);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  /* Sheets would read 5551234567 as a number and hand it back in
     scientific notation, and it drops the + off +447700900123. The
     phone column has to be plain text, and the format has to be set
     before the row lands in it. */
  headers.forEach(function (h, i) {
    if (/phone/i.test(h)) sh.getRange(1, i + 1, sh.getMaxRows()).setNumberFormat('@');
  });

  sh.appendRow(headers.map(function (h) {
    return row[h] === undefined || row[h] === null ? '' : row[h];
  }));
}

/* The report form's uploads, unchanged: private to the owner's Drive. */
function saveUpload(f) {
  return driveSave(f, CONFIG.UPLOAD_FOLDER, false);
}

/* A receipt off /invoice. Shared by link on purpose — a ledger four people
   read is no use if only one of them can open the photo proving the line. */
function saveReceipt(f) {
  return driveSave(f, CONFIG.RECEIPT_FOLDER, true);
}

function driveSave(f, folderName, share) {
  if (!f || !f.data) throw new Error('no file');
  /* The page shrinks a photo to about 100KB before it ever gets here, so
     anything this size is not a receipt and is refused rather than parked
     in Drive. base64 runs about a third bigger than the bytes it carries. */
  if (String(f.data).length > 8 * 1024 * 1024) throw new Error('that photo is too large');

  var it = DriveApp.getFoldersByName(folderName);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(f.data),
    f.type || 'application/octet-stream',
    f.name || 'upload'
  );
  var file = folder.createFile(blob);
  if (share) {
    /* If the domain forbids link sharing this throws, and the line is worth
       more than the thumbnail: keep the file, hand back the URL, and let it
       ask whoever clicks for access rather than losing the whole spend. */
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) {}
  }
  return file.getUrl();
}

function notify(tabName, row) {
  var lines = Object.keys(row).map(function (k) { return k + ': ' + row[k]; });
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: 'fomo/campus — new ' + tabName,
    body: lines.join('\n')
  });
}

/* ── the stipend ledger, behind /invoice ─────────────────────── */

var INVOICE_TAB = 'invoice';
/* `shared` goes on the end on purpose. Rows are read positionally, so a
   column added anywhere else would shift every value in every row written
   before it. Appending leaves old rows reading exactly as they did, with an
   empty `shared` — which the page treats as "no split recorded". */
var INVOICE_COLS = ['id', 'logged', 'date', 'who', 'what', 'category',
                    'amount', 'status', 'note', 'receipt', 'reimbursed', 'shared'];
/* The interns. Only these names go on the clock or come back off it — the
   shift tab is a timesheet, and Arya does not have one. */
var INVOICE_PEOPLE = ['Milo', 'Bijan', 'Jesse', 'Luchi'];

/* Everyone a line can name — as the person who fronted it, or as somebody it
   was bought for. Arya reimburses the ledger rather than being paid out of it,
   so most lines are an intern's card; but Arya fronts spends too, and plenty
   of what the interns buy is bought for Arya, so `shared` has to be able to
   say so. Kept apart from INVOICE_PEOPLE, which is the timesheet roster.
   Mirrors PAYERS/SHARERS in invoice/index.html — change both together. */
var INVOICE_PAYERS = INVOICE_PEOPLE.concat(['Arya']);
var INVOICE_SHARERS = INVOICE_PAYERS;
var INVOICE_CATS = ['lunch', 'coffee', 'ai', 'software', 'travel', 'supplies', 'other'];

/* Every action answers with the whole ledger, so the page never has to
   guess what the sheet now holds — it just re-renders what came back. */
function invoiceApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');

  var sh = invoiceSheet();
  var action = String(body.action || 'list');
  var statusCol = INVOICE_COLS.indexOf('status') + 1;
  var paidCol = INVOICE_COLS.indexOf('reimbursed') + 1;

  if (action === 'add') {
    /* A photo arrives as base64 and leaves as a Drive link. The sheet holds
       the link and never the image — a cell tops out at 50,000 characters
       and a receipt is comfortably past that even shrunk. */
    if (body.receiptFile && body.receiptFile.data) {
      try {
        body.receipt = saveReceipt(body.receiptFile);
      } catch (err) {
        return reply(false, 'the photo could not be saved: ' +
          (err && err.message ? err.message : String(err)));
      }
    }
    var line = invoiceClean(body);
    if (line.error) return reply(false, line.error);
    sh.appendRow(INVOICE_COLS.map(function (c) {
      return line.row[c] === undefined ? '' : line.row[c];
    }));

  } else if (action === 'update') {
    var hit = invoiceFind(sh, body.id);
    if (!hit) return reply(false, 'that line is no longer on the ledger');
    var paid = String(body.status) === 'reimbursed';
    sh.getRange(hit, statusCol).setValue(paid ? 'reimbursed' : 'pending');
    sh.getRange(hit, paidCol).setValue(paid ? invoiceStamp() : '');

  } else if (action === 'delete') {
    var gone = invoiceFind(sh, body.id);
    if (gone) sh.deleteRow(gone);

  } else if (action === 'settle') {
    var who = String(body.who || '');
    var all = invoiceRead(sh), stamp = invoiceStamp(), n = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].who !== who || all[i].status === 'reimbursed') continue;
      sh.getRange(all[i]._row, statusCol).setValue('reimbursed');
      sh.getRange(all[i]._row, paidCol).setValue(stamp);
      n++;
    }
    if (!n) return reply(false, 'nothing is owed to ' + who);

  } else if (action === 'clockin' || action === 'clockout') {
    var clockErr = action === 'clockin' ? shiftIn(body.who) : shiftOut(body.who);
    if (clockErr) return reply(false, clockErr);

  } else if (action === 'shiftimport') {
    var impErr = shiftImport(body.shifts);
    if (impErr) return reply(false, impErr);

  } else if (action === 'shiftdelete') {
    var ssh = shiftSheet();
    var srow = shiftFind(ssh, body.id);
    if (srow) ssh.deleteRow(srow);

  } else if (action === 'subadd') {
    var rule = subClean(body);
    if (rule.error) return reply(false, rule.error);
    subSheet().appendRow(SUB_COLS.map(function (c) {
      return rule.row[c] === undefined ? '' : rule.row[c];
    }));

  } else if (action === 'subpause') {
    var bsh = subSheet();
    var brow = subFind(bsh, body.id);
    if (!brow) return reply(false, 'that subscription is no longer on the sheet');
    bsh.getRange(brow, SUB_COLS.indexOf('active') + 1).setValue(body.active ? 'yes' : 'no');

  } else if (action === 'subdelete') {
    var dsh = subSheet();
    var drow = subFind(dsh, body.id);
    if (drow) dsh.deleteRow(drow);

  } else if (action !== 'list') {
    return reply(false, 'unknown action');
  }

  /* Any monthly line that has come due since somebody last opened the page
     is written here, on the way out. It runs on every call, including a
     plain 'list', because that is the call four laptops make when they
     open /invoice in the morning and one of them has to be the one that
     writes September's Cursor bill. A rule that cannot be turned into a
     line is skipped rather than allowed to take the ledger down with it. */
  try { subsRoll(sh); } catch (rollErr) {}

  /* Every part comes back on every call, so the page always renders what
     the sheet actually holds rather than what it hoped it did. */
  return reply(true, null, {
    rows: invoiceRead(sh).map(invoicePublic),
    shifts: shiftRead(shiftSheet()).map(shiftPublic),
    subs: subRead(subSheet()).map(subPublic)
  });
}

/* The tab builds itself on the first spend, the same way the form tabs do. */
function invoiceSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(INVOICE_TAB);

  /* A tab built before a column existed keeps the header row it was made
     with, and then the page reads a column the sheet never labelled. Since
     columns are only ever appended, widening the header is enough to bring
     an old tab up to date — the rows below it do not move. */
  if (sh && sh.getLastColumn() < INVOICE_COLS.length) {
    var have = sh.getLastColumn();
    sh.getRange(1, have + 1, sh.getMaxRows(), INVOICE_COLS.length - have).setNumberFormat('@');
    sh.getRange(1, 1, 1, INVOICE_COLS.length).setValues([INVOICE_COLS]).setFontWeight('bold');
  }

  if (!sh) {
    sh = ss.insertSheet(INVOICE_TAB);
    /* Left to itself Sheets reads 2026-09-08 as a date object and an
       8-character id as scientific notation, and hands both back in a
       shape the page can't match. Every column is text but the money. */
    sh.getRange(1, 1, sh.getMaxRows(), INVOICE_COLS.length).setNumberFormat('@');
    sh.getRange(1, INVOICE_COLS.indexOf('amount') + 1, sh.getMaxRows()).setNumberFormat('$#,##0.00');
    sh.getRange(1, 1, 1, INVOICE_COLS.length).setValues([INVOICE_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Nothing reaches the sheet unchecked — the endpoint is open to the web. */
function invoiceClean(b) {
  var who = String(b.who || '').trim();
  var what = String(b.what || '').trim().slice(0, 90);
  var category = String(b.category || 'other').trim();
  var amount = Math.round(Number(b.amount) * 100) / 100;
  var date = String(b.date || '').trim();
  var receipt = String(b.receipt || '').trim();

  /* Unknown names are dropped rather than refused: a line that is otherwise
     good should not bounce over who it was for, and a silent drop shows up
     on screen as a missing name where a refusal shows up as lost typing. */
  var shared = String(b.shared || '').split(',').map(function (n) { return n.trim(); })
    .filter(function (n, i, all) {
      return INVOICE_SHARERS.indexOf(n) > -1 && all.indexOf(n) === i;
    });

  if (INVOICE_PAYERS.indexOf(who) === -1) return { error: 'that name is not on the bootcamp' };
  if (!what) return { error: 'that line needs a description' };
  if (!(amount > 0) || amount > 100000) return { error: 'that amount does not look right' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'that date does not look right' };
  if (INVOICE_CATS.indexOf(category) === -1) category = 'other';

  return { row: {
    id: Utilities.getUuid().slice(0, 8),
    logged: invoiceStamp(),
    date: date,
    who: who,
    what: what,
    category: category,
    amount: amount,
    status: 'pending',
    note: String(b.note || '').slice(0, 120),
    receipt: /^https?:\/\//i.test(receipt) ? receipt.slice(0, 500) : '',
    reimbursed: '',
    shared: shared.join(', ')
  }};
}

function invoiceRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, INVOICE_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i];
    if (!String(raw[0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < INVOICE_COLS.length; j++) o[INVOICE_COLS[j]] = raw[j];
    o.id = String(o.id);
    o.amount = Number(o.amount) || 0;
    o.status = String(o.status) === 'reimbursed' ? 'reimbursed' : 'pending';
    o.date = invoiceDate(o.date);
    out.push(o);
  }
  return out;
}

/* Someone editing the tab by hand can turn the text date back into a
   real date, so read both shapes. */
function invoiceDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function invoiceFind(sh, id) {
  id = String(id || '');
  if (!id) return null;
  var all = invoiceRead(sh);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]._row;
  return null;
}

function invoicePublic(r) {
  return {
    id: r.id, logged: String(r.logged), date: r.date, who: String(r.who),
    what: String(r.what), category: String(r.category), amount: r.amount,
    status: r.status, note: String(r.note), receipt: String(r.receipt),
    shared: String(r.shared || '')
  };
}

function invoiceStamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

/* ── subscriptions: a spend that repeats every month ─────────── */

/* A subscription is a rule, not a spend. `next` is the day the rule is
   owed its next line, and rolling that forward is the whole feature:
   subsRoll asks every active rule whether its day has come round and
   writes the ledger lines that are due.

   It lives here rather than on the page for one reason. doPost holds a
   script lock, so these run one at a time — and four laptops opening
   /invoice within a minute of each other all ask the same question about
   the same rule. One of them writes the line and moves `next`; the other
   three arrive to find nothing due. The same loop on the page would have
   each of them write their own copy of October's bill.

   The page still carries its own copy of this loop, because a browser on
   device storage has no sheet to do it for them. */
var SUB_TAB = 'subs';
var SUB_COLS = ['id', 'created', 'who', 'what', 'category', 'amount',
                'day', 'next', 'active', 'note', 'shared', 'last'];

/* A rule left alone for two years should not wake up and write two years
   of lines. It catches up a year at a time and the page says so. */
var SUB_MAX_CATCHUP = 12;

function subSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(SUB_TAB);
  if (!sh) {
    sh = ss.insertSheet(SUB_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), SUB_COLS.length).setNumberFormat('@');
    sh.getRange(1, SUB_COLS.indexOf('amount') + 1, sh.getMaxRows()).setNumberFormat('$#,##0.00');
    sh.getRange(1, 1, 1, SUB_COLS.length).setValues([SUB_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Nothing reaches the sheet unchecked — a rule writes a line a month for
   as long as it exists, so it is checked exactly as hard as a spend. */
function subClean(b) {
  var line = invoiceClean(b);
  if (line.error) return line;

  var start = line.row.date;
  var day = Math.min(31, Math.max(1, Math.round(Number(b.day) || Number(start.split('-')[2]) || 1)));

  return { row: {
    id: Utilities.getUuid().slice(0, 8),
    created: invoiceStamp(),
    who: line.row.who,
    what: line.row.what,
    category: line.row.category,
    amount: line.row.amount,
    day: day,
    next: start,
    active: 'yes',
    note: line.row.note,
    shared: line.row.shared,
    last: ''
  }};
}

function subRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, SUB_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i];
    if (!String(raw[0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < SUB_COLS.length; j++) o[SUB_COLS[j]] = raw[j];
    o.id = String(o.id);
    o.amount = Number(o.amount) || 0;
    o.day = Math.min(31, Math.max(1, Math.round(Number(o.day) || 1)));
    /* a hand-edit turns the text date back into a real one, same as the
       ledger's own dates do */
    o.next = invoiceDate(o.next);
    o.last = invoiceDate(o.last);
    o.active = String(o.active).toLowerCase() === 'no' ? 'no' : 'yes';
    out.push(o);
  }
  return out;
}

function subFind(sh, id) {
  id = String(id || '');
  if (!id) return null;
  var all = subRead(sh);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]._row;
  return null;
}

function subPublic(s) {
  return {
    id: s.id, who: String(s.who), what: String(s.what), category: String(s.category),
    amount: s.amount, day: s.day, next: s.next, active: s.active,
    note: String(s.note || ''), shared: String(s.shared || ''), last: s.last || ''
  };
}

/* The day of the month is kept as the rule's own number rather than read
   back off the last line written, so a subscription on the 31st does not
   walk itself back to the 28th the first time it passes February. */
function subStep(iso, day) {
  var p = String(iso || '').split('-');
  var y = Number(p[0]), m = Number(p[1]);
  if (!y || !m) return '';
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  var inMonth = new Date(y, m, 0).getDate();
  var d = Math.min(Math.max(1, Number(day) || Number(p[2]) || 1), inMonth);
  return y + '-' + subPad(m) + '-' + subPad(d);
}
function subPad(n) { return (n < 10 ? '0' : '') + n; }

function subsRoll(insh) {
  var sh = subSheet();
  var all = subRead(sh);
  if (!all.length) return 0;

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var nextCol = SUB_COLS.indexOf('next') + 1, lastCol = SUB_COLS.indexOf('last') + 1;
  var made = 0;

  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (s.active !== 'yes') continue;

    var next = s.next, wrote = '', guard = 0;
    while (/^\d{4}-\d{2}-\d{2}$/.test(next) && next <= today && guard++ < SUB_MAX_CATCHUP) {
      var line = invoiceClean({
        who: s.who, what: s.what, category: s.category, amount: s.amount,
        date: next, note: s.note, shared: s.shared
      });
      /* a rule whose name or amount was edited into something the ledger
         will not take stops writing rather than throwing — it stays on the
         subs tab, with its `next` where it was, saying which day it stuck on */
      if (line.error) break;
      insh.appendRow(INVOICE_COLS.map(function (c) {
        return line.row[c] === undefined ? '' : line.row[c];
      }));
      wrote = next;
      made++;
      next = subStep(next, s.day);
    }

    if (wrote) {
      sh.getRange(s._row, nextCol).setValue(next);
      sh.getRange(s._row, lastCol).setValue(wrote);
    }
  }
  return made;
}

/* ── the clock, behind the same /invoice page ────────────────── */

var SHIFT_TAB = 'hours';
var SHIFT_COLS = ['id', 'who', 'day', 'start', 'end', 'minutes'];

function shiftSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(SHIFT_TAB);
  if (!sh) {
    sh = ss.insertSheet(SHIFT_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), SHIFT_COLS.length).setNumberFormat('@');
    sh.getRange(1, SHIFT_COLS.indexOf('minutes') + 1, sh.getMaxRows()).setNumberFormat('0');
    sh.getRange(1, 1, 1, SHIFT_COLS.length).setValues([SHIFT_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* start and end are stored as UTC ISO stamps, not local text: the page
   does the elapsed-time arithmetic in whatever timezone the person
   pressing the button is sitting in, and it has to agree with the sheet.
   `day` is the local date alongside them, purely so the tab reads well. */
function shiftIn(who) {
  who = String(who || '');
  if (INVOICE_PEOPLE.indexOf(who) === -1) return 'that name is not on the bootcamp';

  var sh = shiftSheet();
  if (shiftOpenFor(sh, who)) return who + ' is already on the clock';

  var now = new Date();
  sh.appendRow([
    Utilities.getUuid().slice(0, 8),
    who,
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    now.toISOString(),
    '',
    ''
  ]);
  return null;
}

function shiftOut(who) {
  who = String(who || '');
  var sh = shiftSheet();
  var open = shiftOpenFor(sh, who);
  if (!open) return who + ' is not on the clock';

  var end = new Date();
  var started = new Date(open.start);
  var minutes = Math.max(0, Math.round((end.getTime() - started.getTime()) / 60000));
  sh.getRange(open._row, SHIFT_COLS.indexOf('end') + 1).setValue(end.toISOString());
  sh.getRange(open._row, SHIFT_COLS.indexOf('minutes') + 1).setValue(minutes);
  return null;
}

/* A browser that was keeping its own ledger, handing it over.

   These shifts cannot come in through shiftIn: it stamps the server's own
   clock, on purpose, so a shift that started an hour ago on somebody's
   laptop would arrive as one that started now — an hour of work turned
   into an hour of nothing. They carry their own start and end instead.

   Nothing about that makes it a free-for-all. The roster is checked the
   same way, a second open shift for someone already on the clock is
   refused the same way, and a shift already on the tab is skipped rather
   than written twice, so pressing the button again after a half-finished
   send costs nothing. */
function shiftImport(list) {
  if (!list || !list.length) return 'nothing to import';

  var sh = shiftSheet();
  var have = shiftRead(sh), open = {}, seen = {};
  for (var i = 0; i < have.length; i++) {
    if (!have[i].end) open[have[i].who] = true;
    seen[have[i].who + '|' + String(have[i].start).slice(0, 16)] = true;
  }

  var add = [];
  for (var j = 0; j < list.length; j++) {
    var v = list[j] || {};
    var who = String(v.who || '');
    if (INVOICE_PEOPLE.indexOf(who) === -1) continue;

    var start = new Date(v.start);
    if (isNaN(start.getTime())) continue;

    var key = who + '|' + start.toISOString().slice(0, 16);
    if (seen[key]) continue;

    var end = v.end ? new Date(v.end) : null;
    if (end && (isNaN(end.getTime()) || end.getTime() < start.getTime())) end = null;

    /* two open shifts for one person is the state the clock refuses to
       reach by hand; an import must not reach it either */
    if (!end) {
      if (open[who]) continue;
      open[who] = true;
    }

    seen[key] = true;
    add.push([
      Utilities.getUuid().slice(0, 8),
      who,
      Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      start.toISOString(),
      end ? end.toISOString() : '',
      end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : ''
    ]);
  }

  if (!add.length) return null;
  sh.getRange(sh.getLastRow() + 1, 1, add.length, SHIFT_COLS.length).setValues(add);
  return null;
}

function shiftOpenFor(sh, who) {
  var all = shiftRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].who === who && !all[i].end) return all[i];
  }
  return null;
}

function shiftRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, SHIFT_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i];
    if (!String(raw[0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < SHIFT_COLS.length; j++) o[SHIFT_COLS[j]] = raw[j];
    o.id = String(o.id);
    o.who = String(o.who);
    o.start = shiftStamp(o.start);
    o.end = shiftStamp(o.end);
    o.minutes = Number(o.minutes) || 0;
    out.push(o);
  }
  return out;
}

/* Same defence as the ledger's dates: a hand-edit can turn the stamp
   back into a real date, so hand both shapes back as ISO. */
function shiftStamp(v) {
  if (v instanceof Date) return v.toISOString();
  return String(v || '');
}

function shiftFind(sh, id) {
  id = String(id || '');
  if (!id) return null;
  var all = shiftRead(sh);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]._row;
  return null;
}

function shiftPublic(s) {
  return { id: s.id, who: s.who, start: s.start, end: s.end, minutes: s.minutes };
}

function reply(ok, error, extra) {
  var out = { ok: !!ok };
  if (error) out.error = error;
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
