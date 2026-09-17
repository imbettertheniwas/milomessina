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

    /* Visit requests from /hqvisitform go the same way, into visits.gs and its
       own visit_requests tab. They carry their own 32-character service secret
       instead of SHARED_SECRET, because the rows hold guest contact details. */
    if (body._api === 'visits') return visitsApi(body);

    /* The campus applicants and the roster of interns running a campus,
       read and written by /internal through this same deployment. Like the
       ledger it answers with both tables rather than a bare confirmation. */
    if (body._api === 'campus') return campusApi(body);

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
    visits: typeof visitsApi === 'function',
    campus: typeof campusApi === 'function',
    clock: typeof shiftIn === 'function',
    shiftimport: typeof shiftImport === 'function',
    subs: typeof subsRoll === 'function',
    days: typeof dayMark === 'function',
    /* The roster this deployment will actually put on a line. The page
       carries its own copy of the same list, and the two agree only while
       the script behind the URL is current — so it is named here rather
       than assumed. A page talking to an older deployment can then grey a
       name out instead of taking the line and losing it to a refusal. */
    payers: INVOICE_PAYERS
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

  } else if (action === 'daymark' || action === 'dayclear') {
    var dayErr = action === 'daymark' ? dayMark(body.who, body.day) : dayClear(body.who, body.day);
    if (dayErr) return reply(false, dayErr);

  } else if (action === 'dayimport') {
    var dimpErr = dayImport(body.days);
    if (dimpErr) return reply(false, dimpErr);

  } else if (action === 'daydelete') {
    var ddsh = daySheet();
    var ddrow = dayFind(ddsh, body.id);
    if (ddrow) ddsh.deleteRow(ddrow);

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
    days: dayRead(daySheet()).map(dayPublic),
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

/* ── the days people were here ───────────────────────────────

   The clock used to record when a shift started and when it ended, and
   totalled the minutes between. That was the wrong shape for what this
   actually is: four people who come in on a day or don't. Nobody was
   paid by the hour, half the shifts were closed by whoever noticed, and
   a forgotten clock-out turned a normal day into sixteen red hours.

   So a day is the unit. One row per person per day they were here,
   nothing finer. There is no start, no end and no duration to get wrong,
   and the only way to be inaccurate is to mark a day you weren't in.

   `hours` is left exactly where it is. It is the archive of the old
   system and nothing reads it after the migration below, which runs once
   — the first time this script is asked for a `days` tab that does not
   exist yet — and carries every distinct person-and-day across. */
var DAY_TAB = 'days';
var DAY_COLS = ['id', 'who', 'day', 'marked'];

function daySheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(DAY_TAB);
  if (!sh) {
    sh = ss.insertSheet(DAY_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), DAY_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, DAY_COLS.length).setValues([DAY_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    /* Only ever on the tab's first creation, so it cannot run twice and
       cannot double up. Wrapped because an unreadable archive is not a
       reason to refuse the team a working clock today. */
    try { dayMigrate(ss, sh); } catch (migErr) {}
  }
  return sh;
}

/* Every distinct person-and-day in the old `hours` tab becomes one row
   here. Shifts crossing midnight count as the day they started, which is
   the day the person turned up — and is already what the tab's own `day`
   column says, so that is read in preference to re-deriving it from a
   UTC stamp in some other timezone. */
function dayMigrate(ss, sh) {
  var hrs = ss.getSheetByName(SHIFT_TAB);
  if (!hrs) return;

  var all = shiftRead(hrs), seen = {}, add = [];
  for (var i = 0; i < all.length; i++) {
    var who = String(all[i].who || '');
    if (INVOICE_PEOPLE.indexOf(who) === -1) continue;

    var day = dayText(all[i].day);
    if (!isDayString(day)) day = dayFromStamp(all[i].start);
    if (!isDayString(day)) continue;

    var key = who + '|' + day;
    if (seen[key]) continue;
    seen[key] = true;
    /* Stamped with the moment the shift was clocked in, not the moment
       this migration ran. `marked` is read as "was this day written down
       afterwards", so stamping fourteen years of history with today
       would report the whole archive as backfilled — the one thing the
       column exists to flag. The clock-in is when the day was recorded,
       and it is the honest answer. */
    add.push([Utilities.getUuid().slice(0, 8), who, day, dayStamp(all[i].start)]);
  }
  if (add.length) sh.getRange(2, 1, add.length, DAY_COLS.length).setValues(add);
}

function isDayString(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }

/* A hand-edit turns the text back into a real date, the same way it does
   on every other tab here, so both shapes are handed back as text. */
function dayText(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').trim();
}

/* a UTC stamp off the old hours tab, in the same shape invoiceStamp()
   writes — local to the script's timezone, seconds, no offset */
function dayStamp(iso) {
  var t = new Date(iso);
  if (isNaN(t.getTime())) return invoiceStamp();
  return Utilities.formatDate(t, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function dayFromStamp(iso) {
  var t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  return Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dayShift(days) {
  var d = new Date();
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* Marking is idempotent on purpose. Two laptops can press the same name
   on the same morning, and the second one is not a mistake worth an
   error — the day is already recorded and that is the whole of what was
   being asked for. */
function dayMark(who, day) {
  who = String(who || '');
  day = dayText(day);

  if (INVOICE_PEOPLE.indexOf(who) === -1) return 'that name is not on the bootcamp';
  if (!isDayString(day)) return 'that day does not look right';
  /* Tomorrow, not today, because the person pressing the button may be
     hours ahead of whatever timezone this script thinks in — but a week
     out is somebody filling in a month they have not worked. */
  if (day > dayShift(1)) return 'that day has not happened yet';

  var sh = daySheet();
  if (dayRowFor(sh, who, day)) return null;

  sh.appendRow([Utilities.getUuid().slice(0, 8), who, day, invoiceStamp()]);
  return null;
}

/* Unmarking an unmarked day is not an error either: the request and the
   sheet already agree about what is true. */
function dayClear(who, day) {
  who = String(who || '');
  day = dayText(day);
  if (!isDayString(day)) return 'that day does not look right';

  var sh = daySheet();
  var row = dayRowFor(sh, who, day);
  if (row) sh.deleteRow(row);
  return null;
}

/* A browser that was keeping its own attendance, handing it over. Same
   shape as the ledger's carry-over: the roster is checked, a day already
   on the tab is stepped over rather than written twice, and anything
   unreadable is skipped rather than taking the whole send down. */
function dayImport(list) {
  if (!list || !list.length) return 'nothing to import';

  var sh = daySheet();
  var have = dayRead(sh), seen = {}, add = [];
  for (var i = 0; i < have.length; i++) seen[have[i].who + '|' + have[i].day] = true;

  for (var j = 0; j < list.length; j++) {
    var v = list[j] || {};
    var who = String(v.who || '');
    if (INVOICE_PEOPLE.indexOf(who) === -1) continue;

    var day = dayText(v.day);
    if (!isDayString(day) || day > dayShift(1)) continue;

    var key = who + '|' + day;
    if (seen[key]) continue;
    seen[key] = true;
    add.push([Utilities.getUuid().slice(0, 8), who, day, invoiceStamp()]);
  }

  if (!add.length) return null;
  sh.getRange(sh.getLastRow() + 1, 1, add.length, DAY_COLS.length).setValues(add);
  return null;
}

function dayRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, DAY_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i];
    if (!String(raw[0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < DAY_COLS.length; j++) o[DAY_COLS[j]] = raw[j];
    o.id = String(o.id);
    o.who = String(o.who);
    o.day = dayText(o.day);
    out.push(o);
  }
  return out;
}

function dayRowFor(sh, who, day) {
  var all = dayRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].who === who && all[i].day === day) return all[i]._row;
  }
  return null;
}

function dayFind(sh, id) {
  id = String(id || '');
  if (!id) return null;
  var all = dayRead(sh);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]._row;
  return null;
}

/* `marked` travels with the row. It is what tells a day filled in
   afterwards apart from one marked on the day itself, which is the only
   guard this tab has against attendance being written in retrospect —
   dropping it here left the sheet holding the evidence and the page
   unable to show it. */
function dayPublic(d) {
  return { id: d.id, who: d.who, day: d.day, marked: dayText(d.marked) };
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

/* ── the campus team, behind /internal ───────────────────────────

   Two tables read as one section of the console. `apply` is the tab
   /fomo/apply already writes into, read here rather than copied, so an
   application is on the board the moment it lands. `campus_team` is the
   roster of people actually running a campus: a row appears there when
   somebody is hired out of the apply tab, or is typed in by hand.

   The apply tab's columns belong to the form and grow with it, so
   nothing below reads that tab positionally — every cell is matched to
   the header above it by name. The four columns the console owns are
   appended if the tab has not got them yet, and rows that predate them
   are given an id on the next read. A form that gains a question still
   needs no hand-editing of the sheet: the new column simply arrives on
   the application as one more line. */

var APPLY_TAB = 'apply';
/* Written by the console, not by the form. `decided` is when the status
   was last moved, which is the only date the apply tab does not already
   hold — `received` is the applicant's own. */
var APPLY_OWN = ['id', 'status', 'team notes', 'decided'];
var APPLY_STATES = ['new', 'reviewing', 'interview', 'offer', 'hired', 'passed'];

/* The header the form writes, and what the console calls it. Anything
   not named here still reaches the page — see applyPublic — it just
   arrives as an extra line rather than in a field of its own. */
var APPLY_FIELDS = {
  'seat': 'seat', 'full name': 'name', 'email': 'email', 'phone': 'phone',
  'university': 'school', 'grad year': 'grad', 'tiktok': 'tiktok',
  'instagram': 'instagram', 'portfolio': 'portfolio', 'why you': 'why',
  'role answer': 'answer', 'hours': 'hours'
};

var TEAM_TAB = 'campus_team';
var TEAM_COLS = ['id', 'added', 'name', 'email', 'phone', 'seat', 'campus',
                 'state', 'status', 'started', 'notes', 'from'];
var TEAM_STATES = ['active', 'paused', 'alumni'];
/* The five seats on the apply form, by the value the form submits. The
   page carries the readable labels; the sheet keeps the short codes so
   an application and the roster row it becomes say the same thing. */
var TEAM_SEATS = ['pres', 'growth', 'partner', 'content', 'culture'];

/* Every action answers with both tables, the way the ledger answers with
   the whole ledger: the page re-renders what came back rather than
   guessing what its own change did to the sheet. */
function campusApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');

  var action = String(body.action || 'list'), err = null;

  if (action === 'applicant')       err = applySet(body);
  else if (action === 'hire')       err = campusHire(body);
  else if (action === 'teamadd')    err = teamAdd(body);
  else if (action === 'teamupdate') err = teamUpdate(body);
  else if (action === 'teamdelete') err = teamDelete(body);
  else if (action !== 'list')       return reply(false, 'unknown action');
  if (err) return reply(false, err);

  return reply(true, null, {
    applicants: applyList(),
    team: teamRead(teamSheet()).map(teamPublic)
  });
}

function campusBook() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');
  return ss;
}

/* A cell that starts with = + or @ is a formula to Sheets, and everything
   written below arrives from a browser. Leading apostrophe keeps it text. */
function campusSafe(v) {
  var s = String(v == null ? '' : v);
  return /^[=+@]/.test(s) ? "'" + s : s;
}

function campusStamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

/* A date typed into the sheet by hand comes back as a Date; one written
   by the script comes back as the string it wrote. Hand back both as text. */
function campusWhen(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return String(v == null ? '' : v);
}

/* ---------- the apply tab ---------- */

/* null when nobody has applied yet: the form builds the tab on its first
   submission, and the console must not build an empty one in front of it. */
function applySheet() {
  return campusBook().getSheetByName(APPLY_TAB);
}

/* The header row, with the console's own columns appended if they are
   missing. Trailing blanks are dropped so a column's position in this
   array is its position in the sheet. */
function applyHeaders(sh) {
  var width = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h); });
  while (headers.length && !headers[headers.length - 1]) headers.pop();

  var missing = APPLY_OWN.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    headers = headers.concat(missing);
    /* An id like 00123456 is a number to Sheets, and comes back as 123456
       — a row the console would then never find again. */
    sh.getRange(1, headers.indexOf('id') + 1, sh.getMaxRows()).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return headers;
}

/* Every row as {_row, cells:{header: value}}. Blank rows — a hand-deleted
   application leaves one behind — are skipped rather than counted. */
function applyRows(sh, headers) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var any = false, cells = {};
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      cells[headers[j]] = vals[i][j];
      if (String(vals[i][j] || '') !== '') any = true;
    }
    if (any) out.push({ _row: i + 2, cells: cells });
  }
  return out;
}

/* Rows that predate the id column, and every row the form writes, arrive
   without one. They are filled in here, in a single write, because an
   application with no id is one the console can read but never answer. */
function applyIds(sh, headers, rows) {
  if (!rows.length) return;
  var col = headers.indexOf('id') + 1, need = false;
  var ids = rows.map(function (r) {
    if (!String(r.cells.id || '')) { r.cells.id = Utilities.getUuid().slice(0, 8); need = true; }
    r.cells.id = String(r.cells.id);
    return [r.cells.id];
  });
  if (!need) return;
  /* The rows are contiguous from row 2, but a blank row in the middle was
     skipped above — so write each run rather than the whole block. */
  var start = 0;
  while (start < rows.length) {
    var end = start;
    while (end + 1 < rows.length && rows[end + 1]._row === rows[end]._row + 1) end++;
    sh.getRange(rows[start]._row, col, end - start + 1, 1).setValues(ids.slice(start, end + 1));
    start = end + 1;
  }
}

function applyList() {
  var sh = applySheet();
  if (!sh) return [];
  var headers = applyHeaders(sh);
  var rows = applyRows(sh, headers);
  applyIds(sh, headers, rows);
  return rows.map(function (r) { return applyPublic(r, headers); });
}

function applyPublic(r, headers) {
  var c = r.cells, out = { extra: [] };
  Object.keys(APPLY_FIELDS).forEach(function (h) {
    out[APPLY_FIELDS[h]] = String(c[h] == null ? '' : c[h]);
  });
  out.id = String(c['id'] || '');
  out.received = campusWhen(c['received']);
  out.status = APPLY_STATES.indexOf(String(c['status'])) > -1 ? String(c['status']) : 'new';
  out.notes = String(c['team notes'] || '');
  out.decided = campusWhen(c['decided']);
  /* Whatever else the form sent, in the order the sheet holds it: a
     question added to /fomo/apply reaches the console without a
     redeploy of anything. */
  headers.forEach(function (h) {
    if (!h || APPLY_FIELDS[h] || APPLY_OWN.indexOf(h) > -1 || h === 'page' || h === 'received') return;
    var v = String(c[h] == null ? '' : c[h]);
    if (v !== '') out.extra.push({ k: h, v: v });
  });
  return out;
}

function applyFind(id) {
  var sh = applySheet();
  if (!sh) return null;
  var headers = applyHeaders(sh);
  var rows = applyRows(sh, headers);
  applyIds(sh, headers, rows);
  id = String(id || '');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].cells.id === id) return { sh: sh, headers: headers, row: rows[i] };
  }
  return null;
}

function applyWrite(hit, header, value) {
  var col = hit.headers.indexOf(header) + 1;
  if (col > 0) hit.sh.getRange(hit.row._row, col).setValue(value);
}

function applySet(b) {
  var hit = applyFind(b.id);
  if (!hit) return 'that application is not on the sheet any more';
  var status = String(b.status || '');
  if (APPLY_STATES.indexOf(status) === -1) return 'that is not one of the statuses';

  /* An untouched row has no status cell at all, and that is 'new' — so
     re-marking it 'new' is not a decision and does not get stamped. */
  var was = String(hit.row.cells['status'] || 'new');
  if (status !== was) {
    applyWrite(hit, 'status', status);
    applyWrite(hit, 'decided', campusStamp());
  }
  if (b.notes !== undefined) applyWrite(hit, 'team notes', campusSafe(String(b.notes).slice(0, 2000)));
  return null;
}

/* ---------- the roster ---------- */

/* Built on the first hire, the same way the ledger's tab is built on the
   first spend. Every column is text: a start date must come back as the
   string it went in as, and a phone number must keep its + and its
   leading zero. */
function teamSheet() {
  var ss = campusBook();
  var sh = ss.getSheetByName(TEAM_TAB);
  if (sh && sh.getLastColumn() < TEAM_COLS.length) {
    var have = sh.getLastColumn();
    sh.getRange(1, have + 1, sh.getMaxRows(), TEAM_COLS.length - have).setNumberFormat('@');
    sh.getRange(1, 1, 1, TEAM_COLS.length).setValues([TEAM_COLS]).setFontWeight('bold');
  }
  if (!sh) {
    sh = ss.insertSheet(TEAM_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), TEAM_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, TEAM_COLS.length).setValues([TEAM_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function teamRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, TEAM_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < TEAM_COLS.length; j++) o[TEAM_COLS[j]] = vals[i][j];
    o.id = String(o.id);
    o.status = TEAM_STATES.indexOf(String(o.status)) > -1 ? String(o.status) : 'active';
    o.added = campusWhen(o.added);
    o.started = campusWhen(o.started).slice(0, 10);
    out.push(o);
  }
  return out;
}

function teamPublic(t) {
  return {
    id: t.id, added: t.added, name: String(t.name), email: String(t.email),
    phone: String(t.phone), seat: String(t.seat), campus: String(t.campus),
    state: String(t.state), status: t.status, started: t.started,
    notes: String(t.notes), from: String(t.from || '')
  };
}

function teamFind(sh, id) {
  id = String(id || '');
  if (!id) return null;
  var all = teamRead(sh);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]._row;
  return null;
}

/* Nothing reaches the sheet unchecked — the endpoint is open to the web. */
function teamClean(b) {
  var name = String(b.name || '').trim().slice(0, 80);
  var campus = String(b.campus || '').trim().slice(0, 90);
  var state = String(b.state || '').trim().toUpperCase();
  var seat = String(b.seat || '').trim();
  var status = String(b.status || 'active').trim();
  var started = String(b.started || '').trim();

  if (!name) return { error: 'that row needs a name' };
  if (!campus) return { error: 'say which campus they run' };
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'the state has to be its two-letter code' };
  if (TEAM_SEATS.indexOf(seat) === -1) return { error: 'that is not one of the five seats' };
  if (TEAM_STATES.indexOf(status) === -1) status = 'active';
  if (started && !/^\d{4}-\d{2}-\d{2}$/.test(started)) return { error: 'that start date does not look right' };

  return { row: {
    name: campusSafe(name),
    email: campusSafe(String(b.email || '').trim().slice(0, 120)),
    phone: campusSafe(String(b.phone || '').trim().slice(0, 40)),
    seat: seat,
    campus: campusSafe(campus),
    state: state,
    status: status,
    started: started,
    notes: campusSafe(String(b.notes || '').slice(0, 500))
  }};
}

function teamAdd(b) {
  var clean = teamClean(b);
  if (clean.error) return clean.error;
  return teamAppend(teamSheet(), clean.row, String(b.from || ''));
}

function teamAppend(sh, row, from) {
  row.id = Utilities.getUuid().slice(0, 8);
  row.added = campusStamp();
  row.from = from;
  sh.appendRow(TEAM_COLS.map(function (c) { return row[c] === undefined ? '' : row[c]; }));
  return null;
}

function teamUpdate(b) {
  var sh = teamSheet();
  var at = teamFind(sh, b.id);
  if (!at) return 'that person is not on the roster any more';
  var clean = teamClean(b);
  if (clean.error) return clean.error;
  /* id, added and from are the row's history and are never rewritten. */
  TEAM_COLS.forEach(function (c, i) {
    if (clean.row[c] === undefined) return;
    sh.getRange(at, i + 1).setValue(clean.row[c]);
  });
  return null;
}

function teamDelete(b) {
  var sh = teamSheet();
  var at = teamFind(sh, b.id);
  if (!at) return 'that person is not on the roster any more';
  sh.deleteRow(at);
  return null;
}

/* An applicant becomes a campus intern in one call, because the two
   halves must not be able to half-happen: a roster row whose application
   still reads "interview", or an application marked hired with nobody on
   the roster, is worse than a refusal. */
function campusHire(b) {
  var hit = applyFind(b.id);
  if (!hit) return 'that application is not on the sheet any more';

  var sh = teamSheet();
  var already = teamRead(sh);
  for (var i = 0; i < already.length; i++) {
    if (String(already[i].from) === String(b.id)) return 'they are already on the campus team';
  }

  var clean = teamClean({
    name: b.name || hit.row.cells['full name'],
    email: b.email || hit.row.cells['email'],
    phone: b.phone || hit.row.cells['phone'],
    seat: b.seat || hit.row.cells['seat'],
    campus: b.campus || hit.row.cells['university'],
    state: b.state,
    status: 'active',
    started: b.started,
    notes: b.notes
  });
  if (clean.error) return clean.error;

  var err = teamAppend(sh, clean.row, String(b.id));
  if (err) return err;

  applyWrite(hit, 'status', 'hired');
  applyWrite(hit, 'decided', campusStamp());
  return null;
}

function reply(ok, error, extra) {
  var out = { ok: !!ok };
  if (error) out.error = error;
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
