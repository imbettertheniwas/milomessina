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
    if (body._api === 'internal') return internalSessionApi(body);
    if (body._api === 'beta') return betaApi(body);
    if (body._api === 'invoice') return invoiceApi(body);

    /* The console that fixes the rest of it when it has gone wrong. Its own
       namespace because everything in it is something every other namespace
       is right to refuse, and because a reader of this line should be able
       to find all of it in one place. */
    if (body._api === 'admin') return internalAdminApi(body);

    /* Visit requests from /hqvisitform go the same way, into the bundled visits code and its
       own visit_requests tab. They carry their own 32-character service secret
       instead of SHARED_SECRET, because the rows hold guest contact details. */
    if (body._api === 'visits') return visitsApi(body);

    /* The campus applicants and the roster of interns running a campus,
       read and written by /internal through this same deployment. Like the
       ledger it answers with both tables rather than a bare confirmation. */
    if (body._api === 'campus') return campusApi(body);

    /* What each of them says they did that week, posted from /internal.
       Its own namespace rather than a fourth table on the ledger's answer:
       the feed only grows, and the ledger is read on every page open. */
    if (body._api === 'posts') return postsApi(body);

    /* Every public form's own tab, read by /internal's portal manager.
       Reading rather than writing: the receiver above owns these tabs and
       this namespace never touches them. */
    if (body._api === 'forms') return formsApi(body);

    /* Referrals. The one namespace here that answers a stranger as well
       as the console: `claim` is public, because /fomo/refer is useless
       unless it can hand somebody back the code it just minted for them.
       Everything else in it is money and is operator-only. */
    if (body._api === 'refer') return referApi(body);

    /* The hours each of them is already spoken for in a normal week,
       so /internal can work out when they could all be in the office at
       once. Recurring blocks, not dated events — the tab is small and
       changes a few times a term. */
    if (body._api === 'schedules') return schedulesApi(body);

    if (body._api || FORM_INBOX.indexOf(tabFor(body._page)) < 0) return reply(false, 'unknown form');
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
  var seen = rosterProbe();
  return reply(true, null, {
    hint: 'fomo campus form receiver is live',
    identity: true,
    beta: typeof betaApi === 'function',
    betaPasswordless: true,
    betaPermanentGroup: true,
    betaDelete: true,
    approvals: true,
    moneyUndo: true,
    purchaseApproval: true,
    ledger: typeof invoiceApi === 'function',
    visits: typeof visitsApi === 'function',
    visitHours: typeof visitAvailability === 'function',
    campus: typeof campusApi === 'function',
    posts: typeof postsApi === 'function',
    forms: typeof formsApi === 'function',
    /* Whether this deployment can mint a referral code. /fomo/refer reads
       it before it lets somebody claim one, so a page in front of an older
       script says so instead of taking a claim it cannot register. */
    refer: typeof referApi === 'function',
    /* The forms this deployment will take a submission from. Named
       rather than assumed for the same reason `payers` is: /internal
       lists every front door on the site, and a door posting to a tab
       this receiver does not accept should read as one with no inbox
       behind it rather than as one nobody has used yet. */
    formInbox: FORM_INBOX,
    schedules: typeof schedulesApi === 'function',
    editline: /'edit'/.test(String(invoiceApi)),
    clock: typeof shiftIn === 'function',
    shiftimport: typeof shiftImport === 'function',
    subs: typeof subsRoll === 'function',
    days: typeof dayMark === 'function',
    /* The roster this deployment will actually put on a line. The page
       carries its own copy of the same list, and the two agree only while
       the script behind the URL is current — so it is named here rather
       than assumed. A page talking to an older deployment can then grey a
       name out instead of taking the line and losing it to a refusal. */
    payers: seen.payers,
    /* The same roster with its roles on it, which `payers` flattens away.
       The sign-in menu is drawn off the first; who is on the clock and who
       is only on the ledger comes off this. */
    team: seen.team,
    /* Whether the roster behind this URL is the sheet's rather than this
       file's constant, and whether the console is deployed at all. A page
       that offers Arya and Milo a console the script has never heard of
       sends them to a button that answers 'unknown form'. */
    roster: typeof rosterRead === 'function',
    admin: typeof internalAdminApi === 'function',
    /* Whether this deployment will take Arya's name on somebody else's
       line. Named rather than assumed for the same reason `payers` is:
       a page ahead of the script behind it can grey the chip out instead
       of taking the line and losing it to a refusal. */
    cardSpends: typeof invoiceSettled === 'function',
    /* Whether this deployment keeps a name from outside the roster in
       `shared`. An older one drops it silently, so the page greys out its
       Other chip rather than let the name vanish on save. */
    guests: typeof guestEntry === 'function'
  });
}

/* ── the pieces ──────────────────────────────────────────────── */

/* The forms this receiver accepts, by the tab each one writes into.
   doPost checks a submission against it and doGet names it, so the one
   list answers both "is this ours" and "which doors have an inbox". */
var FORM_INBOX = ['apply', 'submit', 'report'];

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

/* A shared passcode and a chosen identity, as requested by the team.
   The server stores the identity; request payloads cannot change its role.
   This is a trusted-team selector, not verification of a person's identity. */
function internalSessionApi(body) {
  if (body.action === 'logout') {
    if (body._session) {
      CacheService.getScriptCache().remove(internalSessionPrefix() + body._session);
      if(betaConfigured())CacheService.getScriptCache().remove(betaSessionPrefix() + body._session);
    }
    return reply(true);
  }
  if (body.action === 'betalogin') return betaLogin(body);
  if (body.action === 'betainvite') return betaInviteApi(body);
  if (body.action === 'betagroup') return betaGroupApi();
  if (body.action === 'betajoin') return betaJoin(body);
  if (body.action === 'session') {
    var beta = betaActor(body);
    if(beta)return reply(true,null,{who:beta.name,beta:true,member:betaPublicMember(beta,false),permissions:betaMemberPermissions(beta)});
    var current = internalActor(body);
    return current ? reply(true, null, {who:current, admin:internalIsAdmin(current), operator:internalIsAdmin(current), roster:rosterRead().map(rosterPublic)})
      : reply(false, 'Session expired. Enter the passcode and select your name again.', {code:'AUTH_REQUIRED'});
  }
  if (body.action !== 'login') return reply(false, 'unknown action');
  if (body.passcode !== CONFIG.INVOICE_KEY) return reply(false, 'That passcode does not match.');
  var who = String(body.who || '');
  if (rosterPayers().indexOf(who) === -1) return reply(false, 'Select your name.');
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(internalSessionPrefix() + token, who, 21600);
  /* Both administrators can manage the full workspace. Card ownership is
     independent: CARD_PAYER still determines whose spends settle at once. */
  return reply(true, null, {token:token, who:who, admin:internalIsAdmin(who), operator:internalIsAdmin(who), roster:rosterRead().map(rosterPublic)});
}
function internalActor(body) {
  var token = String(body._session || '');
  if (!token || token.length > 100) return null;
  var who = CacheService.getScriptCache().get(internalSessionPrefix() + token);
  return rosterPayers().indexOf(who) >= 0 ? who : null;
}
/* ── beta intern access ────────────────────────────────────────
   Beta participants stay out of internal_roster. Their individual codes
   are shown once and stored only as a digest. Every beta request rereads
   membership and its access epoch so pausing or changing access revokes
   existing sessions immediately. */
var BETA_PERMISSIONS = ['attendance', 'github', 'recap'];
var BETA_STATUSES = ['active', 'paused', 'graduated'];
var BETA_MEMBERS = ['id','name','email','batch','status','notes','codeHash','epoch','createdAt','updatedAt','createdBy','batchId','github','phone','joinRequestHash','website'];
var BETA_DELETIONS = ['id','joinRequestHash','deletedAt'];
var BETA_SETUP_MESSAGE = 'This beta invitation is not available. Ask Arya for the current link.';
function betaSecret() {
  return String(PropertiesService.getScriptProperties().getProperty('INTERNAL_BETA_SECRET') || '');
}
function betaEnsureSecret() {
  // Called only while an operator initializes the group, under doPost's lock.
  // The regular team's password and every existing property stay unchanged.
  var secret=betaSecret();
  if(!secret) {
    secret=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    PropertiesService.getScriptProperties().setProperty('INTERNAL_BETA_SECRET',secret);
  }
  if(secret.length<32)throw new Error('Beta access could not be initialized. Contact the workspace operator.');
}
function internalDigest(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function(n){ return ('0' + ((n + 256) % 256).toString(16)).slice(-2); }).join('');
}
function internalSame(a, b) {
  a=String(a); b=String(b);
  var different=a.length ^ b.length;
  for(var i=0;i<a.length;i++) different |= a.charCodeAt(i) ^ (b.charCodeAt(i)||0);
  return different === 0;
}
function internalSessionPrefix() {return 'internal:';}
function betaConfigured() {return betaSecret().length>=32;}
function betaBook() {
  return CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}
function betaTable(name, columns, create) {
  var book=betaBook(), sheet=book.getSheetByName(name);
  if(!sheet && create) {
    sheet=book.insertSheet(name);
    sheet.getRange(1,1,1,columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  if(sheet) {
    var head=sheet.getRange(1,1,1,columns.length).getValues()[0];
    // Extend earlier exact member schemas with appended fields. Never
    // overwrite an existing header, row or occupied column.
    var prefix=0;
    while(prefix<columns.length && head[prefix]===columns[prefix])prefix++;
    if(name==='internal_beta_members' && prefix>=13 && prefix<columns.length &&
       head.slice(prefix).every(function(v){return v==='';}) && sheet.getLastColumn()<=prefix) {
      sheet.getRange(1,prefix+1,1,columns.length-prefix).setValues([columns.slice(prefix)]).setFontWeight('bold');
      head=columns.slice();
    }
    if(JSON.stringify(head)!==JSON.stringify(columns))
      throw new Error('The ' + name + ' columns do not match. Restore the beta table headers before continuing.');
  }
  return sheet;
}
function betaRead(name,columns) {
  var sheet=betaTable(name,columns,false);
  if(!sheet || sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,columns.length).getValues().map(function(row,index){
    var out={_row:index+2};
    columns.forEach(function(key,n){var v=row[n];out[key]=typeof v==='string' && v.charCodeAt(0)===8203?v.slice(1):v;});
    return out;
  }).filter(function(row){return !!row.id;});
}
function betaWrite(name,columns,record) {
  var sheet=betaTable(name,columns,true), values=columns.map(function(key){
    var v=record[key] === undefined ? '' : record[key];
    // Explicit text encoding also protects operator-entered notes from sheet formulas.
    return typeof v==='string' ? '\u200b'+v : v;
  });
  if(record._row) sheet.getRange(record._row,1,1,columns.length).setValues([values]);
  else sheet.appendRow(values);
}
function betaMemberPermissions(member) {return BETA_PERMISSIONS.slice();}
function betaPublicMember(member,manager) {
  var actualBatch=betaFindBatch(member),period=betaMemberPeriod(member);
  var out={id:member.id,name:member.name,email:member.email,phone:String(member.phone||''),batch:actualBatch?actualBatch.name:member.batch,batchId:member.batchId,github:member.github,status:member.status,
    permissions:betaMemberPermissions(member),createdAt:member.createdAt,updatedAt:member.updatedAt,startDate:period.startDate,endDate:period.endDate,website:betaPublicWebsite(member.website)};
  if(manager)out.notes=member.notes;
  return out;
}
function betaCleanRow(row,columns) {
  var out={};columns.forEach(function(key){out[key]=row[key];});return out;
}
function betaCodeHash(code) {return internalDigest(betaSecret()+'\n'+String(code||'').trim().toUpperCase());}
function betaNewCode() {return 'BETA-'+Utilities.getUuid().replace(/-/g,'').toUpperCase();}
function betaSessionPrefix() {return 'beta:v1:'+internalDigest(betaSecret()).slice(0,24)+':';}
function betaActor(body) {
  if(!betaConfigured())return null;
  var token=String(body._session||'');
  if(!token || token.length>100)return null;
  var cached;
  try {cached=JSON.parse(CacheService.getScriptCache().get(betaSessionPrefix()+token)||'null');}catch(e){return null;}
  if(!cached)return null;
  var member=betaRead('internal_beta_members',BETA_MEMBERS).filter(function(m){return m.id===cached.id;})[0];
  if(!member || member.status!=='active' || Number(member.epoch)!==Number(cached.epoch))return null;
  var batch=betaFindBatch(member);
  if(!batch || !betaActive(batch.active) || Number(cached.batchEpoch)!==Number(batch.epoch))return null;
  return member;
}
function betaLogin(body) {
  if(!betaConfigured())return reply(false,BETA_SETUP_MESSAGE,{code:'BETA_UNCONFIGURED'});
  var code=String(body.code||'').trim();
  if(!/^BETA-[a-f0-9]{32}$/i.test(code))return reply(false,'This personal workspace link is invalid or no longer active.',{code:'AUTH_REQUIRED'});
  var hash=betaCodeHash(code), member=betaRead('internal_beta_members',BETA_MEMBERS).filter(function(m){
    return m.status==='active' && internalSame(String(m.codeHash||''),hash);
  })[0];
  if(!member)return reply(false,'This personal workspace link is invalid or no longer active.',{code:'AUTH_REQUIRED'});
  var batch=betaFindBatch(member);
  if(!batch || !betaActive(batch.active))return reply(false,'This beta batch is paused. Contact Arya for access.',{code:'AUTH_REQUIRED'});
  var token=betaMintSession(member);
  return reply(true,null,{token:token,who:member.name,beta:true,member:betaPublicMember(member,false),permissions:betaMemberPermissions(member)});
}
function betaString(body,key,max,required) {
  var value=String(body[key]===undefined?'':body[key]).trim();
  if((required && !value)||value.length>max)throw new Error('Enter '+(required?'a ':'')+key+' of '+(required?'1–':'at most ')+max+' characters.');
  return value;
}
var BETA_BATCHES = ['id','name','startDate','endDate','active','inviteHash','inviteVersion','epoch','createdAt','updatedAt','createdBy'];
var BETA_ATTENDANCE = ['id','memberId','day','createdAt'];
var BETA_RECAPS = ['id','memberId','learned','accomplished','links','submitted','submittedAt','updatedAt'];
function betaActive(value) {return value===true || value==='true';}
function betaPublicBatch(batch) {
  return {id:batch.id,name:batch.name,startDate:batch.startDate,endDate:batch.endDate,active:betaActive(batch.active),createdAt:batch.createdAt,updatedAt:batch.updatedAt};
}
function betaFindBatch(member) {
  if(!member || !member.batchId)return null;
  return betaRead('internal_beta_batches',BETA_BATCHES).filter(function(b){return b.id===member.batchId;})[0]||null;
}
function betaPrimaryBatch() {
  var batches=betaRead('internal_beta_batches',BETA_BATCHES);
  var selected=PropertiesService.getScriptProperties().getProperty('INTERNAL_BETA_GROUP_ID');
  if(selected) return batches.filter(function(b){return b.id===selected;})[0]||null;
  return batches[0]||null;
}
function betaEnsureGroup(operator) {
  var props=PropertiesService.getScriptProperties(),group=betaPrimaryBatch();
  if(!group) {
    if(props.getProperty('INTERNAL_BETA_GROUP_ID'))throw new Error('The beta group record is missing. Restore it before continuing.');
    betaManageBatch({action:'batchadd',name:'Beta interns',startDate:betaToday()},operator);
    group=betaPrimaryBatch();
  }
  betaEnsureSecret();
  if(!props.getProperty('INTERNAL_BETA_GROUP_ID'))props.setProperty('INTERNAL_BETA_GROUP_ID',String(group.id));
  return group;
}
function betaGroupApi() {
  var group=betaConfigured()?betaPrimaryBatch():null;
  if(!group)return reply(false,'The beta group is not ready yet. Ask Arya or Milo to open Beta in /internal.',{code:'BETA_UNCONFIGURED'});
  if(!betaActive(group.active))return reply(false,'The beta group is paused. Contact Arya or Milo for access.',{code:'AUTH_REQUIRED'});
  return reply(true,null,{batch:betaPublicBatch(group),group:betaPublicBatch(group),invite:'beta',periodDays:14});
}
function betaDate(value) {
  var text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||isNaN(Date.parse(text+'T00:00:00Z'))||new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text)
    throw new Error('Choose a valid calendar date.');
  return text;
}
function betaEndDate(start) {return new Date(Date.parse(betaDate(start)+'T00:00:00Z')+13*86400000).toISOString().slice(0,10);}
function betaNewYorkDay(date) {return Utilities.formatDate(date,'America/New_York','yyyy-MM-dd').slice(0,10);}
function betaToday() {return betaNewYorkDay(new Date());}
function betaMemberPeriod(member) {
  // The original join timestamp fixes each person's day one. Shared group
  // dates remain legacy metadata and never shorten a new member's trial.
  var joined=new Date(member.createdAt);
  if(isNaN(joined.getTime()))return {startDate:'',endDate:''};
  var start=betaNewYorkDay(joined);
  return {startDate:start,endDate:betaEndDate(start)};
}
function betaGithub(value) {
  var username=String(value||'').trim().replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/^@/,'');
  if(!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username))throw new Error('Enter a valid GitHub username.');
  return username;
}
function betaPhone(value) {
  var phone=typeof value==='string'?value.trim():'';
  var digits=phone.replace(/\D/g,'');
  if(phone.length>40 || !/^\+?[\d\s().-]+$/.test(phone) || digits.length<7 || digits.length>15)
    throw new Error('Enter a phone number with 7–15 digits. You can include a country code and normal phone formatting.');
  return phone;
}
function betaWebsite(value) {
  if(value===undefined || value==='')return '';
  if(typeof value!=='string')throw new Error('Enter a website such as example.com, or leave it blank.');
  var website=value.trim();
  if(!website)return '';
  if(!/^[a-z][a-z0-9+.-]*:/i.test(website))website='https://'+website;
  var parts=/^(https?):\/\/([^/?#]+)([/?#].*)?$/i.exec(website);
  if(website.length>300 || /[\s\x00-\x1f\x7f\\<>"'`]/.test(website) || !parts)
    throw new Error('Use an http or https website of at most 300 characters, without sign-in details.');
  var authority=/^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(parts[2]);
  var hostname=authority?authority[1].toLowerCase():'',labels=hostname.split('.');
  if(!authority || hostname.length>253 || labels.length<2 || /^\d+$/.test(labels[labels.length-1]) ||
     labels.some(function(label){return !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label);}) ||
     authority[2] && (Number(authority[2])<1 || Number(authority[2])>65535))
    throw new Error('Enter a valid website domain, such as example.com.');
  return parts[1].toLowerCase()+'://'+hostname+(authority[2]?':'+authority[2]:'')+(parts[3]||'');
}
function betaPublicWebsite(value) {
  // Old or manually edited sheet values must not become unsafe links.
  try{return betaWebsite(value);}catch(e){return '';}
}
function betaNewInvite() {return 'BATCH-'+Utilities.getUuid().replace(/-/g,'').toUpperCase();}
function betaInviteHash(invite) {return internalDigest(betaSecret()+'\nbatch-invite\n'+String(invite||'').trim().toUpperCase());}
function betaInviteBatch(invite) {
  if(betaConfigured() && String(invite||'').trim()==='beta') {
    var group=betaPrimaryBatch();return group&&betaActive(group.active)?group:null;
  }
  if(!betaConfigured() || !/^BATCH-[a-f0-9]{32}$/i.test(String(invite||'').trim()))return null;
  var hash=betaInviteHash(invite);
  return betaRead('internal_beta_batches',BETA_BATCHES).filter(function(b){return betaActive(b.active)&&internalSame(String(b.inviteHash||''),hash);})[0]||null;
}
function betaInviteApi(body) {
  if(!betaConfigured())return reply(false,BETA_SETUP_MESSAGE,{code:'BETA_UNCONFIGURED'});
  var batch=betaInviteBatch(body.invite);
  return batch?reply(true,null,{batch:betaPublicBatch(batch)}):reply(false,'This beta invite is invalid or no longer active.',{code:'AUTH_REQUIRED'});
}
function betaJoinRequest(body) {
  if(body.joinRequest===undefined)return '';
  if(typeof body.joinRequest!=='string' || !/^[a-f0-9]{32}$/i.test(body.joinRequest))
    throw new Error('This join attempt is invalid. Open the invitation again and retry.');
  return body.joinRequest.toLowerCase();
}
function betaJoinRequestHash(batchId,request) {
  return internalDigest(betaSecret()+'\nbeta-join-request-v1\n'+batchId+'\n'+request);
}
function betaJoinIdentity(name,email,phone,github,website) {
  var identity=[name,email.toLowerCase(),phone,github.toLowerCase()];
  if(website)identity.push(website); // Preserve earlier retry hashes when no website was supplied.
  return JSON.stringify(identity);
}
function betaJoin(body) {
  if(!betaConfigured())return reply(false,BETA_SETUP_MESSAGE,{code:'BETA_UNCONFIGURED'});
  var batch=betaInviteBatch(body.invite);
  if(!batch)return reply(false,'This beta invite is invalid or no longer active.',{code:'AUTH_REQUIRED'});
  var joinMayBeSaved=false;
  try {
    var request=betaJoinRequest(body),name=betaString(body,'name',80,true),email=betaString(body,'email',254,true),github=betaGithub(body.github),phone=betaPhone(body.phone),website=betaWebsite(body.website);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
    var identity=betaJoinIdentity(name,email,phone,github,website),requestHash=request?betaJoinRequestHash(batch.id,request):'';
    if(requestHash && betaRead('internal_beta_deletions',BETA_DELETIONS).some(function(d){return internalSame(String(d.joinRequestHash||''),requestHash);}))
      throw new Error('This join attempt belongs to a deleted profile. Start a new signup to join again.');
    var code=request?'BETA-'+internalDigest(betaSecret()+'\nbeta-join-access-v1\n'+batch.id+'\n'+request+'\n'+identity).slice(0,32).toUpperCase():betaNewCode();
    var codeHash=betaCodeHash(code),members=betaRead('internal_beta_members',BETA_MEMBERS);
    var existing=members.filter(function(m){return m.batchId===batch.id &&
      (String(m.email).toLowerCase()===email.toLowerCase() || requestHash && internalSame(String(m.joinRequestHash||''),requestHash));});
    if(existing.length) {
      var saved=existing[0];
      // Email alone never recovers an account. The original secret attempt,
      // identity and still-active personal capability must all agree.
      if(existing.length!==1 || !requestHash || saved.status!=='active' ||
         !internalSame(String(saved.joinRequestHash||''),requestHash) || !internalSame(String(saved.codeHash||''),codeHash) ||
         betaJoinIdentity(String(saved.name),String(saved.email),String(saved.phone),String(saved.github),betaPublicWebsite(saved.website))!==identity)
        throw new Error('You already joined this beta batch. Open your personal workspace link, or ask Arya to reset it.');
      joinMayBeSaved=true;
      return reply(true,null,{token:betaMintSession(saved),code:code,who:saved.name,beta:true,recovered:true,member:betaPublicMember(saved,false),permissions:betaMemberPermissions(saved)});
    }
    var stamp=new Date().toISOString();
    var member={id:Utilities.getUuid(),name:name,email:email,phone:phone,github:github,website:website,batchId:batch.id,batch:batch.name,status:'active',
      notes:'',codeHash:codeHash,joinRequestHash:requestHash,epoch:1,createdAt:stamp,updatedAt:stamp,createdBy:'self-join'};
    joinMayBeSaved=true; // A write can succeed even if its confirmation fails.
    betaWrite('internal_beta_members',BETA_MEMBERS,member);
    return reply(true,null,{token:betaMintSession(member),code:code,who:member.name,beta:true,member:betaPublicMember(member,false),permissions:betaMemberPermissions(member)});
  }catch(e){
    var errorInfo={code:'INVALID'};
    if(!joinMayBeSaved)errorInfo.joinSaved=false;
    return reply(false,String(e.message||e),errorInfo);
  }
}
function betaMintSession(member) {
  var token=Utilities.getUuid()+Utilities.getUuid(),batch=betaFindBatch(member);
  CacheService.getScriptCache().put(betaSessionPrefix()+token,JSON.stringify({id:member.id,epoch:Number(member.epoch),batchEpoch:batch?Number(batch.epoch):null}),21600);
  return token;
}
function betaManageBatch(body,operator) {
  var action=body.action,stamp=new Date().toISOString(),batch,invite,extra={};
  if(action==='batchadd') {
    var start=betaDate(body.startDate),name=betaString(body,'name',80,true);
    if(betaRead('internal_beta_batches',BETA_BATCHES).length)throw new Error('There is one permanent beta group. Open the existing group instead.');
    betaEnsureSecret();
    invite=betaNewInvite();
    batch={id:Utilities.getUuid(),name:name,startDate:start,endDate:betaEndDate(start),active:true,
      inviteHash:betaInviteHash(invite),inviteVersion:1,epoch:1,createdAt:stamp,updatedAt:stamp,createdBy:operator};
    extra={invite:invite,createdBatchId:batch.id};
  } else {
    batch=betaRead('internal_beta_batches',BETA_BATCHES).filter(function(b){return b.id===String(body.id);})[0];
    if(!batch)throw new Error('Beta batch not found.');
    if(action==='rotateinvite') {
      invite=betaNewInvite();batch.inviteHash=betaInviteHash(invite);batch.inviteVersion=Number(batch.inviteVersion)+1;
      extra={invite:invite,createdBatchId:batch.id};
    } else {
      if(body.name!==undefined)batch.name=betaString(body,'name',80,true);
      if(body.startDate!==undefined){batch.startDate=betaDate(body.startDate);batch.endDate=betaEndDate(batch.startDate);}
      if(body.active!==undefined) {
        if(typeof body.active!=='boolean')throw new Error('Choose active or paused.');
        if(betaActive(batch.active)!==body.active)batch.epoch=Number(batch.epoch)+1;
        batch.active=body.active;
      }
    }
    batch.updatedAt=stamp;
  }
  betaWrite('internal_beta_batches',BETA_BATCHES,batch);
  if(action==='batchadd')PropertiesService.getScriptProperties().setProperty('INTERNAL_BETA_GROUP_ID',String(batch.id));
  return extra;
}
function betaAttendanceWrite(body,member) {
  var period=betaMemberPeriod(member),day=betaDate(body.day),today=betaToday();
  if(!period.startDate || day<period.startDate || day>period.endDate || day>today)throw new Error('Attendance must be a past or current day within your own two weeks, starting the day you joined.');
  var existing=betaRead('internal_beta_attendance',BETA_ATTENDANCE).filter(function(a){return a.memberId===member.id && a.day===day;})[0];
  if(body.action==='attendanceremove') {
    if(existing)betaTable('internal_beta_attendance',BETA_ATTENDANCE,false).deleteRow(existing._row);
  } else if(!existing)betaWrite('internal_beta_attendance',BETA_ATTENDANCE,{id:Utilities.getUuid(),memberId:member.id,day:day,createdAt:new Date().toISOString()});
}
function betaRecapWrite(body,member) {
  if(body.submit!==undefined && typeof body.submit!=='boolean')throw new Error('Choose save draft or submit recap.');
  var submit=body.submit===true,learned=betaString(body,'learned',12000,submit),accomplished=betaString(body,'accomplished',12000,submit);
  var links=body.links===undefined?[]:body.links;
  if(!Array.isArray(links)||links.length>12||links.some(function(link){return typeof link!=='string'||link.length>2000||!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(link);}))
    throw new Error('Add up to 12 valid http or https links.');
  var stamp=new Date().toISOString(),recap=betaRead('internal_beta_recaps',BETA_RECAPS).filter(function(r){return r.memberId===member.id;})[0]||{id:Utilities.getUuid(),memberId:member.id};
  recap.learned=learned;recap.accomplished=accomplished;recap.links=JSON.stringify(links);recap.submitted=submit;
  recap.submittedAt=submit?stamp:'';recap.updatedAt=stamp;
  betaWrite('internal_beta_recaps',BETA_RECAPS,recap);
}
function betaRecapPublic(recap) {
  var out=betaCleanRow(recap,BETA_RECAPS);
  try{out.links=JSON.parse(String(recap.links||'[]'));}catch(e){out.links=[];}
  if(!Array.isArray(out.links))out.links=[];
  out.submitted=betaActive(recap.submitted);return out;
}
function betaDeleteMember(body) {
  if(typeof body.id!=='string' || !body.id.trim() || body.id.length>100)throw new Error('Select the beta intern to delete.');
  var id=body.id.trim(),member=betaRead('internal_beta_members',BETA_MEMBERS).filter(function(m){return m.id===id;})[0];
  if(!member)return {deletedMemberId:id,alreadyDeleted:true};
  // Revoke access before touching dependent rows. If a later sheet operation
  // fails, a retry continues cleanup while old sessions and links stay invalid.
  member.status='paused';member.epoch=Number(member.epoch)+1;member.codeHash='';member.updatedAt=new Date().toISOString();
  betaWrite('internal_beta_members',BETA_MEMBERS,member);
  var deleted=betaRead('internal_beta_deletions',BETA_DELETIONS).filter(function(d){return d.id===id;})[0];
  if(!deleted)betaWrite('internal_beta_deletions',BETA_DELETIONS,{id:id,joinRequestHash:String(member.joinRequestHash||''),deletedAt:new Date().toISOString()});
  // Keep only the consumed join-attempt hash so a stale retry cannot recreate
  // the deleted profile's deterministic personal capability.
  [['internal_beta_attendance',BETA_ATTENDANCE],['internal_beta_recaps',BETA_RECAPS]].forEach(function(table){
    var rows=betaRead(table[0],table[1]).filter(function(r){return r.memberId===id;});
    rows.sort(function(a,b){return b._row-a._row;}).forEach(function(r){betaTable(table[0],table[1],false).deleteRow(r._row);});
  });
  betaTable('internal_beta_members',BETA_MEMBERS,false).deleteRow(member._row);
  return {deletedMemberId:id,alreadyDeleted:false};
}
function betaGroupData(manager,member) {
  var members=betaRead('internal_beta_members',BETA_MEMBERS),batches=betaRead('internal_beta_batches',BETA_BATCHES),batch=member?betaFindBatch(member):null;
  var group=betaPrimaryBatch();
  var peers=members.filter(function(m){return manager || member && member.batchId && m.batchId===member.batchId;});
  var ids=peers.map(function(m){return m.id;});
  return {group:group?betaPublicBatch(group):null,batch:batch?betaPublicBatch(batch):null,batches:batches.filter(function(b){return manager || member&&b.id===member.batchId;}).map(betaPublicBatch),
    peers:peers.map(function(m){var period=betaMemberPeriod(m);return {id:m.id,name:m.name,github:m.github,website:betaPublicWebsite(m.website),status:m.status,batchId:m.batchId,startDate:period.startDate,endDate:period.endDate};}),
    attendance:betaRead('internal_beta_attendance',BETA_ATTENDANCE).filter(function(a){return manager||ids.indexOf(a.memberId)>=0;}).map(function(a){return betaCleanRow(a,BETA_ATTENDANCE);}),
    recaps:betaRead('internal_beta_recaps',BETA_RECAPS).filter(function(r){return manager||member&&r.memberId===member.id;}).map(betaRecapPublic)};
}

function betaApi(body) {
  var operator=internalActor(body), manager=internalIsAdmin(operator), member=manager?null:betaActor(body);
  if(!manager && !member)return reply(false,'Beta session expired or access changed. Sign in again.',{code:'AUTH_REQUIRED'});
  var action=String(body.action||'list'), configured=betaConfigured();
  if(!configured && action!=='list' && !(manager && action==='batchadd'))return reply(false,BETA_SETUP_MESSAGE,{code:'BETA_UNCONFIGURED'});
  if(!manager && ['list','attendance','attendanceremove','recap','memberprofile'].indexOf(action)<0)return reply(false,'Only Arya and Milo can manage the beta batch.',{code:'FORBIDDEN'});
  var members=betaRead('internal_beta_members',BETA_MEMBERS), target, stamp=new Date().toISOString(), extra={};
  try {
    if(manager && action==='list')betaEnsureGroup(operator);
    if(['batchadd','batchupdate','rotateinvite'].indexOf(action)>=0)extra=betaManageBatch(body,operator);
    else if(action==='attendance' || action==='attendanceremove') {
      if(manager)return reply(false,'Attendance is recorded by each beta participant.',{code:'FORBIDDEN'});
      betaAttendanceWrite(body,member);
    } else if(action==='recap') {
      if(manager)return reply(false,'A recap must be written by its participant.',{code:'FORBIDDEN'});
      betaRecapWrite(body,member);
    } else if(action==='memberprofile') {
      if(manager)return reply(false,'Select an intern in the Beta manager to edit their website.',{code:'FORBIDDEN'});
      if(body.website===undefined)throw new Error('Include a website, or an empty value to clear it.');
      member.website=betaWebsite(body.website);member.updatedAt=stamp;
      betaWrite('internal_beta_members',BETA_MEMBERS,member);
    } else if(action==='memberdelete') {
      extra=betaDeleteMember(body);
    } else if(action==='memberupdate' || action==='rotatecode') {
      target=members.filter(function(m){return m.id===String(body.id);})[0];
      if(!target)throw new Error('Beta participant not found.');
      var revoke=action==='rotatecode';
      if(action==='rotatecode') {var rotated=betaNewCode();target.codeHash=betaCodeHash(rotated);extra={code:rotated,createdMemberId:target.id};}
      else {
        ['name','email','notes'].forEach(function(k){if(body[k]!==undefined)target[k]=betaString(body,k,k==='notes'?5000:k==='email'?254:80,k==='name'||k==='batch');});
        if(body.github!==undefined)target.github=betaGithub(body.github);
        if(body.phone!==undefined)target.phone=betaPhone(body.phone);
        if(body.website!==undefined)target.website=betaWebsite(body.website);
        if(target.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email))throw new Error('Enter a valid email address.');
        if(target.email && members.some(function(m){return m.id!==target.id && m.batchId===target.batchId && String(m.email).toLowerCase()===String(target.email).toLowerCase();}))throw new Error('That email already belongs to another beta participant.');
        if(body.status!==undefined) {
          if(BETA_STATUSES.indexOf(body.status)<0)throw new Error('Choose active, paused or graduated.');
          revoke=revoke||target.status!==body.status;target.status=body.status;
        }
      }
      if(revoke)target.epoch=Number(target.epoch)+1;
      target.updatedAt=stamp;betaWrite('internal_beta_members',BETA_MEMBERS,target);
    } else if(action!=='list')throw new Error('Unknown beta action.');
  } catch(e) {return reply(false,String(e.message||e),{code:'INVALID'});}
  var permissions=manager?BETA_PERMISSIONS.slice():betaMemberPermissions(member);
  var visibleMembers=betaRead('internal_beta_members',BETA_MEMBERS).filter(function(m){return manager || m.id===member.id;});
  var result={manager:manager,configured:true,setupMessage:'',betaDelete:true,permissions:permissions,
    members:visibleMembers.map(function(m){return betaPublicMember(m,manager);}),member:member?betaPublicMember(member,false):null};
  var group=betaGroupData(manager,member);
  Object.keys(group).forEach(function(k){result[k]=group[k];});
  Object.keys(extra).forEach(function(k){result[k]=extra[k];});
  return reply(true,null,result);
}

function invoicePermission(action, body, actor, sh) {
  if (!actor) return 'Session expired. Enter the passcode and select your name again.';
  if (action === 'approve' || action === 'unapprove') return 'Share approvals have been replaced by administrator purchase approval. Reload the site.';
  if (action === 'purchaseapprove' || action === 'purchaseunapprove') return internalIsAdmin(actor) ? null : 'Only Arya and Milo can approve or undo approval of a purchase.';
  if (action === 'moneyundo') return null; // The stored actor and every affected record are checked below.
  if (internalIsAdmin(actor)) return null;
  /* Arya's card goes round the room, so his name is the one everybody may
     put on a line. Nothing else about it is theirs to hand out. */
  if (action === 'add' || action === 'subadd')
    return (body.who === actor || body.who === CARD_PAYER) ? null : 'You can only log a spend on your own card or on Arya’s.';
  if (action === 'profileupdate' || action === 'daymark' || action === 'dayclear' || action === 'clockin' || action === 'clockout')
    return body.who === actor ? null : 'You can only change your own records.';
  var record;
  if (action === 'edit' || action === 'delete') {
    record = invoiceRead(sh).filter(function(r){return String(r.id) === String(body.id);})[0];
    if (!record || invoiceLogger(record) !== actor || (action === 'edit' && body.who !== actor && body.who !== CARD_PAYER)) return 'You can only change your own spends.';
    /* The lock is there so a line cannot be rewritten after somebody was
       paid for it. A card line settles without anybody being paid, so it
       stays open to the person who logged it. */
    if (record.status === 'reimbursed' && String(record.who) !== CARD_PAYER) return 'Only Arya and Milo can change a reimbursed charge.';
    return null;
  }
  if (action === 'daydelete') record = dayRead(daySheet()).filter(function(r){return String(r.id) === String(body.id);})[0];
  if (action === 'shiftdelete') record = shiftRead(shiftSheet()).filter(function(r){return String(r.id) === String(body.id);})[0];
  if (action === 'subpause' || action === 'subdelete') record = subRead(subSheet()).filter(function(r){return String(r.id) === String(body.id);})[0];
  if (record) return invoiceLogger(record) === actor ? null : 'You can only change your own records.';
  if (action === 'dayimport' || action === 'shiftimport') {
    var list = action === 'dayimport' ? body.days : body.shifts;
    return Array.isArray(list) && list.every(function(r){return r.who === actor;}) ? null : 'You can only import your own attendance.';
  }
  return 'Only Arya and Milo can do that.';
}

/* ── the stipend ledger, behind /invoice ─────────────────────── */

var INVOICE_TAB = 'invoice';
/* `shared` goes on the end on purpose. Rows are read positionally, so a
   column added anywhere else would shift every value in every row written
   before it. Appending leaves old rows reading exactly as they did, with an
   empty `shared` — which the page treats as "no split recorded". */
var INVOICE_COLS = ['id', 'logged', 'date', 'who', 'what', 'category',
                    'amount', 'status', 'note', 'receipt', 'reimbursed', 'shared', 'approvals', 'approved_by', 'approved_at',
                    'logged_by'];

/* Arya hands his card over for a lunch run, so a line can name him as the
   payer whoever typed it. Two things follow. Nothing is owed on it — it is
   his money going out, and it lands settled rather than waiting to be paid
   back to somebody who never paid. And `who` is no longer the person who
   can change it, so `logged_by` carries that: empty on every line written
   before this existed, where the payer is also the one who logged it.

   Mirrors CARD in invoice/index.html — change both together. */
var CARD_PAYER = 'Arya';
function invoiceSettled(who, status) {
  return (String(who) === CARD_PAYER || String(status) === 'reimbursed') ? 'reimbursed' : 'pending';
}
function invoiceLogger(r) { return String((r && (r.logged_by || r.who)) || ''); }
/* ---------- the roster, and who is allowed to change it ----------

   These five names were a constant for as long as the five of them were
   the whole bootcamp. Somebody arriving or leaving then meant editing this
   file, redeploying it, editing invoice/index.html and shipping that too —
   four steps, in order, with a window in between where the page offers a
   name the sheet has never heard of. That is the shape of a job nobody
   does, so the ledger carries a person who left for months.

   So the list moved into the sheet, where everything else the console is
   about already lives. What is left here is the seed: the first time
   anything asks, the roster tab is written out as exactly these names, and
   from then on the tab is the answer. A deployment nobody has opened the
   console on behaves precisely as it did before.

   Mirrors PEOPLE/LEADS in invoice/index.html. That copy is what the page
   believes before the sheet has answered; `payers` in doGet and `roster` on
   every ledger reply are what keep the two honest. */

/* The interns. Only these names go on the clock or come back off it — the
   shift tab is a timesheet, and Arya does not have one. */
var INVOICE_PEOPLE_SEED = ['Milo', 'Bijan', 'Jesse', 'Luchi'];

/* Not on the clock, but on the ledger. Arya reimburses it rather than being
   paid out of it; plenty of what the interns buy is bought for him, so a
   line has to be able to name him. Kept apart from the interns, which is
   the timesheet roster. */
var INVOICE_LEADS_SEED = ['Arya'];

/* Arya and Milo have full administration access to the workspace. The role
   is resolved from the server's regular session, never a requested name.
   Card ownership and the attendance roster remain separate accounting rules.
   Mirrors the administrator list in invoice/index.html. */
var INTERNAL_ADMINS = ['Arya', 'Milo'];
function internalIsAdmin(who) { return INTERNAL_ADMINS.indexOf(String(who || '')) > -1; }

var ROSTER_TAB = 'internal_roster';
var ROSTER_COLS = ['name', 'role', 'added', 'added_by', 'removed', 'removed_by'];
var ROSTER_ROLES = ['intern', 'lead'];

/* One read per request, not one per name checked. dayImport asks about the
   roster once for every row in the file it was handed, and a spreadsheet
   read inside that loop is the difference between an import and a timeout.
   Every write below clears it, so nothing is ever answered from a copy the
   same request has already replaced. */
var rosterMemo = null;
function rosterForget() { rosterMemo = null; }

function rosterSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ROSTER_TAB);
  if (sh) return sh;
  sh = ss.insertSheet(ROSTER_TAB);
  sh.getRange(1, 1, 1, ROSTER_COLS.length).setValues([ROSTER_COLS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  var stamp = invoiceStamp();
  INVOICE_PEOPLE_SEED.forEach(function (n) { sh.appendRow([n, 'intern', stamp, 'seed', '', '']); });
  INVOICE_LEADS_SEED.forEach(function (n) { sh.appendRow([n, 'lead', stamp, 'seed', '', '']); });
  rosterForget();
  return sh;
}

function rosterRead() {
  if (rosterMemo) return rosterMemo;
  var sh = rosterSheet(), last = sh.getLastRow(), out = [];
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, ROSTER_COLS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var name = String(vals[i][0] || '').trim();
      if (!name) continue;
      var role = String(vals[i][1] || 'intern');
      out.push({
        _row: i + 2,
        name: name,
        role: ROSTER_ROLES.indexOf(role) > -1 ? role : 'intern',
        added: String(vals[i][2] || ''),
        added_by: String(vals[i][3] || ''),
        removed: String(vals[i][4] || ''),
        removed_by: String(vals[i][5] || '')
      });
    }
  }
  rosterMemo = out;
  return out;
}

function rosterFind(name) {
  var all = rosterRead(), want = String(name || '').trim();
  for (var i = 0; i < all.length; i++) if (all[i].name === want) return all[i];
  return null;
}

/* Everybody currently on the roster, in the role asked for. An empty answer
   is never returned: a tab that exists but has been emptied by hand would
   otherwise lock all five of them out of their own ledger, which is a worse
   outcome than ignoring it and carrying on with the seed. */
function rosterActive(role) {
  var out = rosterRead().filter(function (r) { return !r.removed && (!role || r.role === role); })
    .map(function (r) { return r.name; });
  if (out.length) return out;
  return role === 'lead' ? INVOICE_LEADS_SEED.slice()
    : role === 'intern' ? INVOICE_PEOPLE_SEED.slice()
    : INVOICE_PEOPLE_SEED.concat(INVOICE_LEADS_SEED);
}

/* The timesheet roster: who can be marked in, clocked on, or counted as a
   day in the office. */
function rosterPeople() { return rosterActive('intern'); }

/* Everyone a line, a schedule or a post can name. */
function rosterPayers() { return rosterActive('intern').concat(rosterActive('lead')); }

/* Everyone the sheet has ever carried, whether they are still here or not.
   This is the list the READ paths use. Somebody leaving must not take four
   months of spends, days and posts off the board with them — their rows are
   still what the ledger did, and a name that has fallen out of `payers`
   would otherwise be filtered straight out of every answer. */
function rosterKnown() {
  var out = rosterRead().map(function (r) { return r.name; });
  INVOICE_PEOPLE_SEED.concat(INVOICE_LEADS_SEED).forEach(function (n) {
    if (out.indexOf(n) === -1) out.push(n);
  });
  return out;
}

/* The roster as the probe may ask for it, and the probe only. Opening the
   /exec URL in a browser is the cheap health check — it is hit on every page
   load and is the one call that has never needed the spreadsheet — so it
   must not start failing because the book is unreachable, or because this
   script is running somewhere there is no book at all. A page told the seed
   names by a deployment whose sheet is down is in exactly the position it
   was in before the roster moved, which is a working one.

   Nothing that decides whether a request is allowed uses this. Those paths
   call rosterPayers() and are meant to fail loudly, because answering a
   permission question out of a fallback list is how somebody taken off the
   roster gets back in. */
function rosterProbe() {
  try { return { payers: rosterPayers(), team: rosterRead().map(rosterPublic) }; }
  catch (e) {
    return {
      payers: INVOICE_PEOPLE_SEED.concat(INVOICE_LEADS_SEED),
      team: INVOICE_PEOPLE_SEED.map(function (n) { return { name: n, role: 'intern', removed: '' }; })
        .concat(INVOICE_LEADS_SEED.map(function (n) { return { name: n, role: 'lead', removed: '' }; }))
    };
  }
}

function rosterPublic(r) {
  return {
    name: r.name, role: r.role, added: r.added, addedBy: r.added_by,
    removed: r.removed, removedBy: r.removed_by,
    admin: internalIsAdmin(r.name), card: r.name === CARD_PAYER
  };
}
var INVOICE_CATS = ['lunch', 'coffee', 'ai', 'software', 'travel', 'supplies', 'other'];

/* Every action answers with the whole ledger, so the page never has to
   guess what the sheet now holds — it just re-renders what came back. */
function invoiceApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');

  var actor = internalActor(body);
  if(!actor)return reply(false, 'Session expired. Sign in again.', {code:'AUTH_REQUIRED'});
  var sh = invoiceSheet();
  var action = String(body.action || 'list');
  /* Who is asking, taken from the session rather than the payload: the
     page says whose card a line went on, never whose hands typed it. */
  if (action !== 'list') {
    var denied = invoicePermission(action, body, actor, sh);
    if (denied) return reply(false, denied);
  }
  var trackMoney = MONEY_ACTIONS.indexOf(action) >= 0;
  if (trackMoney) {
    // Finish already-due recurring charges before isolating this person's change.
    subsRoll(sh);
    moneyHistorySheet(true);
  }
  var beforeMoney = trackMoney ? moneySnapshot() : null;
  var statusCol = INVOICE_COLS.indexOf('status') + 1;
  var paidCol = INVOICE_COLS.indexOf('reimbursed') + 1;

  if (action === 'moneyundo') {
    var undoError = moneyUndo(body.undoId, internalActor(body));
    if (undoError) return reply(false, undoError);
  } else if (action === 'profileupdate') {
    var profileError = profileUpdate(body);
    if (profileError) return reply(false, profileError);
  } else if (action === 'add') {
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
    var line = invoiceClean(body, actor);
    if (line.error) return reply(false, line.error);
    sh.appendRow(INVOICE_COLS.map(function (c) {
      return line.row[c] === undefined ? '' : line.row[c];
    }));

  } else if (action === 'purchaseapprove' || action === 'purchaseunapprove') {
    var approvalRow = invoiceFind(sh, body.id);
    if (!approvalRow) return reply(false, 'That purchase is no longer on the ledger.');
    var charge = invoiceRead(sh).filter(function(r){return String(r.id) === String(body.id);})[0];
    var reviewKey = JSON.stringify([charge.date,charge.who,charge.what,charge.category,Number(charge.amount),charge.note||'',charge.receipt||'',charge.shared||'']);
    if (action === 'purchaseapprove' && body.reviewed !== reviewKey) return reply(false, 'This purchase changed. Review the latest receipt and details before approving.');
    var approvePurchase = action === 'purchaseapprove';
    sh.getRange(approvalRow, INVOICE_COLS.indexOf('approved_by') + 1).setValue(approvePurchase ? actor : '');
    sh.getRange(approvalRow, INVOICE_COLS.indexOf('approved_at') + 1).setValue(approvePurchase ? (charge.approved_by === actor && charge.approved_at ? charge.approved_at : invoiceStamp()) : '');

  } else if (action === 'update') {
    var hit = invoiceFind(sh, body.id);
    if (!hit) return reply(false, 'that line is no longer on the ledger');
    var paid = String(body.status) === 'reimbursed';
    sh.getRange(hit, statusCol).setValue(paid ? 'reimbursed' : 'pending');
    sh.getRange(hit, paidCol).setValue(paid ? invoiceStamp() : '');

  } else if (action === 'edit') {
    /* Changing a line somebody already logged, rather than deleting it and
       typing it again — which is what everyone was doing, and which loses
       the receipt and the logged-at stamp along with the mistake.

       Its own action rather than a wider 'update' so that the pay/unpay
       path above keeps working exactly as it did: that one is sent by a
       button that knows nothing about the rest of the row, and a payload
       missing every other field must never be read as clearing them.

       The line is re-validated exactly as hard as a new one. What it may
       NOT change is id, logged, status or reimbursed: whether a line has
       been paid back is a fact about the money, not a detail of the
       description, and it has its own button. */
    var edit = invoiceFind(sh, body.id);
    if (!edit) return reply(false, 'that line is no longer on the ledger');

    var was = invoiceRead(sh).filter(function (r) { return String(r.id) === String(body.id); })[0];
    var keep = was ? String(was.receipt || '') : '';

    /* A new photo replaces whatever was there; an explicit clear empties
       it; sending neither leaves the receipt alone, so editing the amount
       on a line does not quietly drop its proof. */
    if (body.receiptFile && body.receiptFile.data) {
      try {
        keep = saveReceipt(body.receiptFile);
      } catch (shotErr) {
        return reply(false, 'the photo could not be saved: ' +
          (shotErr && shotErr.message ? shotErr.message : String(shotErr)));
      }
    } else if (body.receiptClear) {
      keep = '';
    } else if (body.receipt && /^https?:\/\//i.test(String(body.receipt))) {
      keep = String(body.receipt).slice(0, 500);
    }

    var next = invoiceClean(body, was ? invoiceLogger(was) : actor);
    if (next.error) return reply(false, next.error);

    var setCol = function (name, value) {
      sh.getRange(edit, INVOICE_COLS.indexOf(name) + 1).setValue(value);
    };
    setCol('date', next.row.date);
    setCol('who', next.row.who);
    setCol('what', next.row.what);
    setCol('category', next.row.category);
    setCol('amount', next.row.amount);
    setCol('note', next.row.note);
    setCol('shared', next.row.shared);
    setCol('receipt', keep);
    // Changes to a charge require an administrator to review it again. Legacy share confirmations stay archived.
    setCol('approved_by', '');
    setCol('approved_at', '');
    /* Whether a line has been paid back is not edited here — but which
       card it went on decides whether anything is owed at all, and that
       is edited here. Moved onto Arya's card the line is settled by the
       move; moved back off it, it is owed again. */
    if (next.row.who === CARD_PAYER) {
      setCol('status', 'reimbursed');
      setCol('reimbursed', (was && was.reimbursed) ? was.reimbursed : invoiceStamp());
    } else if (was && String(was.who) === CARD_PAYER) {
      setCol('status', 'pending');
      setCol('reimbursed', '');
    }

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
    var rule = subClean(body, actor);
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
  if (action !== 'moneyundo') { try { subsRoll(sh); } catch (rollErr) {} }
  if (trackMoney) {
    try { moneyRemember(beforeMoney, moneySnapshot(), internalActor(body), action); }
    catch (historyError) {
      moneyRestore(beforeMoney);
      return reply(false, 'The change was rolled back because its undo history could not be saved.');
    }
  }

  /* Every part comes back on every call, so the page always renders what
     the sheet actually holds rather than what it hoped it did. */
  return reply(true, null, {
    moneyHistory: moneyHistoryPublic(internalActor(body)),
    moneyUndo: true,
    purchaseApproval: true,
    profiles: profileRead(),
    rows: invoiceRead(sh).map(invoicePublic),
    days: dayRead(daySheet()).map(dayPublic),
    subs: subRead(subSheet()).map(subPublic)
  });
}

/* Financial changes keep their exact before/after values. No history is invented
   for old rows. A reversal checks the entire group before touching any record. */
var MONEY_ACTIONS = ['purchaseapprove','purchaseunapprove','add','edit','delete','update','settle','subadd','subpause','subdelete'];
var MONEY_COLS = ['id','actor','action','created','table','record','before','after','undone'];
function moneyHistorySheet(create) {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('internal_money_history');
  if (!sh && create) {
    sh = ss.insertSheet('internal_money_history');
    sh.getRange(1,1,sh.getMaxRows(),MONEY_COLS.length).setNumberFormat('@');
    sh.getRange(1,1,1,MONEY_COLS.length).setValues([MONEY_COLS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function moneySnapshot() {
  var snapshot = {};
  [[INVOICE_TAB,invoiceRead(invoiceSheet()),INVOICE_COLS], [SUB_TAB,subRead(subSheet()),SUB_COLS]].forEach(function(part){
    part[1].forEach(function(r){
      snapshot[part[0] + ':' + r.id] = {table:part[0], id:r.id, values:part[2].map(function(c){return r[c] == null ? '' : r[c];})};
    });
  });
  return snapshot;
}
function moneyRestore(before) {
  var current=moneySnapshot();
  Object.keys(before).concat(Object.keys(current)).filter(function(k,i,all){return all.indexOf(k)===i;}).forEach(function(k){
    var a=before[k]||null,b=current[k]||null;
    if(JSON.stringify(a)===JSON.stringify(b))return;
    var record=a||b,sh=record.table===INVOICE_TAB?invoiceSheet():subSheet();
    var row=record.table===INVOICE_TAB?invoiceFind(sh,record.id):subFind(sh,record.id);
    if(!a){if(row)sh.deleteRow(row);}
    else if(row)sh.getRange(row,1,1,a.values.length).setValues([a.values]);
    else sh.appendRow(a.values);
  });
}
function moneyRemember(before, after, actor, action) {
  var id = Utilities.getUuid(), stamp = invoiceStamp(), entries = [];
  Object.keys(before).concat(Object.keys(after)).filter(function(k,i,all){return all.indexOf(k) === i;}).forEach(function(k){
    var a = before[k] || null, b = after[k] || null;
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    var record = b || a;
    entries.push([id,actor,action,stamp,record.table,record.id,JSON.stringify(a),JSON.stringify(b),'']);
  });
  if (!entries.length) return;
  var sh = moneyHistorySheet(true);
  sh.getRange(sh.getLastRow()+1,1,entries.length,MONEY_COLS.length).setValues(entries);
}
function moneyHistoryRead() {
  var sh = moneyHistorySheet(false);
  if (!sh || sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,MONEY_COLS.length).getValues().map(function(values,i){
    var row = {_row:i+2}; MONEY_COLS.forEach(function(c,j){row[c]=values[j];}); return row;
  });
}
function moneyHistoryPublic(actor) {
  if (!actor) return [];
  var groups = {}, order = [];
  moneyHistoryRead().forEach(function(r){
    if (!internalIsAdmin(actor) && r.actor !== actor) return;
    if (!groups[r.id]) {
      groups[r.id] = {id:r.id,actor:r.actor,action:r.action,created:dayText(r.created),undone:!!r.undone,count:0,description:''}; order.push(r.id);
    }
    var g=groups[r.id], record=JSON.parse(r.after) || JSON.parse(r.before);
    g.count++;
    if (!g.description) g.description=String(record.values[record.table===INVOICE_TAB?4:3] || '');
  });
  return order.reverse().map(function(id){return groups[id];});
}
function moneyUndo(id, actor) {
  var entries = moneyHistoryRead().filter(function(r){return String(r.id)===String(id);});
  if (!entries.length) return 'That change is not in the money history.';
  if (!internalIsAdmin(actor) && entries.some(function(r){return r.actor !== actor;})) return 'You can only undo your own changes.';
  if (entries.every(function(r){return !!r.undone;})) return null;
  var current=moneySnapshot();
  for (var i=0;i<entries.length;i++) {
    var r=entries[i], expected=JSON.parse(r.after), actual=current[r.table+':'+r.record] || null;
    if (r.undone || JSON.stringify(actual)!==JSON.stringify(expected)) return 'This record changed afterwards. Review its latest details before changing it; nothing was undone.';
  }
  entries.forEach(function(r){
    var before=JSON.parse(r.before), sh=r.table===INVOICE_TAB?invoiceSheet():subSheet();
    var row=r.table===INVOICE_TAB?invoiceFind(sh,r.record):subFind(sh,r.record);
    if (!before) { if (row) sh.deleteRow(row); }
    else if (row) sh.getRange(row,1,1,before.values.length).setValues([before.values]);
    else sh.appendRow(before.values);
  });
  var history=moneyHistorySheet(false), stamp=invoiceStamp();
  entries.forEach(function(r){history.getRange(r._row,MONEY_COLS.length).setValue(stamp);});
  return null;
}

/* Team profiles use stable roster names, never display text, as ownership. */
var PROFILE_COLS = ['who','headline','bio','link'];
function profileSheet(){
  var ss=CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('internal_profiles');
  if (!sh) {
    sh=ss.insertSheet('internal_profiles');
    sh.getRange(1,1,sh.getMaxRows(),PROFILE_COLS.length).setNumberFormat('@');
    sh.getRange(1,1,1,PROFILE_COLS.length).setValues([PROFILE_COLS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function profileRead(){
  var sh=profileSheet();
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,PROFILE_COLS.length).getValues().map(function(r){
    return {who:String(r[0]),headline:String(r[1]||''),bio:String(r[2]||''),link:String(r[3]||'')};
  }).filter(function(p){return rosterKnown().indexOf(p.who)>=0;});
}
function profileUpdate(body){
  var who=String(body.who||''),headline=String(body.headline||'').trim(),bio=String(body.bio||'').trim(),link=String(body.link||'').trim();
  if(rosterPayers().indexOf(who)<0) return 'Select a person on the team.';
  if(headline.length>80 || bio.length>600 || link.length>300) return 'Keep the headline under 80 characters and the bio under 600.';
  if(link && !/^https?:\/\/[^\s]+$/i.test(link)) return 'Use a full website URL beginning with https:// or http://.';
  var sh=profileSheet(),at=0;
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,1).getValues().forEach(function(row,i){if(String(row[0])===who)at=i+2;});
  var row=[who,campusSafe(headline),campusSafe(bio),link];
  if(at)sh.getRange(at,1,1,PROFILE_COLS.length).setValues([row]);else sh.appendRow(row);
  return null;
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

/* Somebody outside the roster a line was bought for — a guest at lunch, a
   visitor's coffee. They sit in `shared` beside the roster names so they
   count toward the split like anyone else, written as `Sam (guest)`. A
   roster name is letters and never holds a bracket, so the two can never
   be mistaken for each other, and a rename never touches a guest. */
var GUEST_TAG = ' (guest)';
function isGuestEntry(n) {
  n = String(n || '');
  return n.length > GUEST_TAG.length && n.slice(-GUEST_TAG.length) === GUEST_TAG;
}
/* the cleaned `Name (guest)` form of one entry, or '' when it is not a guest */
function guestEntry(n) {
  n = String(n || '').trim();
  if (!isGuestEntry(n)) return '';
  var name = n.slice(0, -GUEST_TAG.length).replace(/[,()\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return name ? name + GUEST_TAG : '';
}

/* Nothing reaches the sheet unchecked — the endpoint is open to the web.
   `actor` is the signed-in name, kept apart from `who`: one is whose card
   it was, the other is whose hands typed it, and on Arya's card they are
   two different people. */
function invoiceClean(b, actor) {
  var who = String(b.who || '').trim();
  var what = String(b.what || '').trim().slice(0, 90);
  var category = String(b.category || 'other').trim();
  var amount = Math.round(Number(b.amount) * 100) / 100;
  var date = String(b.date || '').trim();
  var receipt = String(b.receipt || '').trim();

  /* Unknown names are dropped rather than refused: a line that is otherwise
     good should not bounce over who it was for, and a silent drop shows up
     on screen as a missing name where a refusal shows up as lost typing. */
  var shared = String(b.shared || '').split(',').map(function (n) {
      n = n.trim();
      return isGuestEntry(n) ? guestEntry(n) : n;
    })
    .filter(function (n, i, all) {
      return n && (rosterPayers().indexOf(n) > -1 || isGuestEntry(n)) && all.indexOf(n) === i;
    });

  if (rosterPayers().indexOf(who) === -1) return { error: 'that name is not on the bootcamp' };
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
    status: invoiceSettled(who, 'pending'),
    note: String(b.note || '').slice(0, 120),
    receipt: /^https?:\/\//i.test(receipt) ? receipt.slice(0, 500) : '',
    /* a card line is settled on arrival, and the stamp says when */
    reimbursed: who === CARD_PAYER ? invoiceStamp() : '',
    shared: shared.join(', '),
    logged_by: String(actor || b.logged_by || who)
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
    /* Lines Arya logged for himself were written before his card counted
       as settled. The rule is applied on the way out rather than by
       rewriting rows that are otherwise perfectly good. */
    o.status = invoiceSettled(o.who, o.status);
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
    shared: String(r.shared || ''), approvals: String(r.approvals || ''),
    approvedBy: String(r.approved_by || ''), approvedAt: String(r.approved_at || ''),
    loggedBy: invoiceLogger(r)
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
                'day', 'next', 'active', 'note', 'shared', 'last', 'logged_by'];

/* A rule left alone for two years should not wake up and write two years
   of lines. It catches up a year at a time and the page says so. */
var SUB_MAX_CATCHUP = 12;

function subSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(SUB_TAB);

  /* Same as the ledger's: columns are only ever appended, so widening the
     header row brings a tab built before one existed up to date. */
  if (sh && sh.getLastColumn() < SUB_COLS.length) {
    var had = sh.getLastColumn();
    sh.getRange(1, had + 1, sh.getMaxRows(), SUB_COLS.length - had).setNumberFormat('@');
    sh.getRange(1, 1, 1, SUB_COLS.length).setValues([SUB_COLS]).setFontWeight('bold');
  }

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
function subClean(b, actor) {
  var line = invoiceClean(b, actor);
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
    last: '',
    logged_by: line.row.logged_by
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
    note: String(s.note || ''), shared: String(s.shared || ''), last: s.last || '',
    loggedBy: invoiceLogger(s)
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
      }, invoiceLogger(s));
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
    if (rosterKnown().indexOf(who) === -1) continue;

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

  if (rosterPeople().indexOf(who) === -1) return 'that name is not on the bootcamp';
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
    if (rosterPeople().indexOf(who) === -1) continue;

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
  if (rosterPeople().indexOf(who) === -1) return 'that name is not on the bootcamp';

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
    if (rosterPeople().indexOf(who) === -1) continue;

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
  if(!internalActor(body))return reply(false, 'Session expired. Sign in again.', {code:'AUTH_REQUIRED'});

  var action = String(body.action || 'list'), err = null;

  if (action !== 'list' && !internalIsAdmin(internalActor(body))) return reply(false, 'Only Arya and Milo can manage the campus team and applicants.');
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

/* ══════════ the front doors, behind /internal ══════════

   Every public form on the site writes into a tab of this sheet named
   after its own URL — the same three `tabFor` sorts the post into. Until
   now only `apply` had a reader: `submit` and `report` were write-only,
   so a creator's payout claim and a campus team's Sunday report landed in
   the spreadsheet and could be read nowhere else. The portal manager is
   the reader they never had.

   It reads by header name, never by position, and it never writes — not
   a cell, not a column, not a tab. A tab that does not exist is a form
   nobody has submitted yet, which is a true answer rather than an error,
   and building an empty one in front of the form would be a lie about it.

   Operators only, and for a reason worth naming: one read here puts
   applicants' phone numbers, creators' payout handles and every answer
   anybody has typed on one screen. Everything else in the console is one
   subject at a time; this is all of them at once, so it takes the narrow
   door the maintenance console takes. */

/* Readable here. `onboard` is on the list without being on FORM_INBOX
   above on purpose: /fomo/onboard posts like the other three, the
   receiver turns it away, and a manager that quietly left it out would
   be hiding exactly the thing it exists to show. It reads as a door with
   no inbox behind it, which is what it is. */
/* `referrers` is on here for the same reason `onboard` is: /fomo/refer
   is a front door, so the manager that lists every front door has to be
   able to open it. It is not on FORM_INBOX because it does not post like
   the others — it takes the `refer` namespace, which answers with a code
   rather than with {ok:true}. */
var FORM_TABS = FORM_INBOX.concat(['onboard', 'referrers']);

/* Newest first, and capped. Nothing on these tabs is near it; the cap is
   so a year of submissions cannot turn one page open into a timeout. */
var FORM_MAX = 400;

function formsApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');

  var actor = internalActor(body);
  if (!actor) return reply(false, 'Session expired. Enter the passcode and select your name again.');
  if (!internalIsAdmin(actor)) return reply(false, 'The portals are ' + INTERNAL_ADMINS.join(' and ') + ' only.');

  var action = String(body.action || 'index');
  if (action === 'index') {
    return reply(true, null, { inbox: FORM_INBOX, portals: FORM_TABS.map(formsTally) });
  }
  if (action === 'rows') {
    var tab = String(body.tab || '');
    if (FORM_TABS.indexOf(tab) === -1) return reply(false, 'that is not one of the form tabs');
    return reply(true, null, formsRead(tab));
  }
  return reply(false, 'unknown action');
}

/* The header row as the form left it. applyHeaders widens the apply tab
   with the console's own four columns; this one must not — it is reading
   three tabs it does not own, and a reader that edits what it reads is
   how a form's own columns end up somewhere it did not put them. */
function formsHeaders(sh) {
  var width = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h); });
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  return headers;
}

/* What the index needs and no more: whether the tab is there, how much is
   on it, and when the last one landed. The rows are read to count them —
   getLastRow counts a hand-deleted submission's leftover blank row, and
   `apply` says 12 in one place and 11 in another the moment it does. */
function formsTally(tab) {
  var sh = campusBook().getSheetByName(tab);
  if (!sh) return { tab: tab, exists: false, total: 0, last: '', fields: [] };
  var headers = formsHeaders(sh);
  var rows = applyRows(sh, headers);
  var last = '';
  rows.forEach(function (r) {
    var when = formsWhen(r.cells['received']);
    if (when > last) last = when;
  });
  return { tab: tab, exists: true, total: rows.length, last: last, fields: headers.filter(String) };
}

function formsRead(tab) {
  var sh = campusBook().getSheetByName(tab);
  if (!sh) return { tab: tab, exists: false, headers: [], rows: [], total: 0, capped: false };
  var headers = formsHeaders(sh);
  /* applyRows is already generic — every cell matched to the header above
     it, blank rows skipped — so it is borrowed rather than written twice. */
  var rows = applyRows(sh, headers);
  /* The sheet appends, so the newest submissions are the last ones. Take
     from the end, then turn it round: the cap has to drop the oldest. */
  var take = rows.slice(Math.max(0, rows.length - FORM_MAX)).reverse();
  return {
    tab: tab, exists: true, headers: headers.filter(String),
    total: rows.length, capped: rows.length > take.length,
    rows: take.map(function (r) { return formsPublic(r, headers); })
  };
}

/* A date typed into the sheet by hand comes back as a Date, one the
   receiver wrote comes back as the string it wrote. Both leave as text —
   the same defence the ledger and the campus tables already take. */
function formsWhen(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return String(v == null ? '' : v);
}

/* Every answer, keyed by the question above it, with the blanks left out
   — a field somebody skipped is not an answer, and carrying it would
   make every payload the width of the widest form. `_row` is what the
   spreadsheet calls this submission, so a row on screen can be found in
   the sheet by somebody who has to go and look at it. */
function formsPublic(r, headers) {
  var out = { _row: r._row, received: formsWhen(r.cells['received']), cells: {} };
  headers.forEach(function (h) {
    if (!h) return;
    var v = formsWhen(r.cells[h]);
    if (v !== '') out.cells[h] = v;
  });
  return out;
}

/* ══════════ the week notes ══════════

   An internal feed: one short note a week from each of them saying what
   they actually worked on, with the links and photos to show it. It is the
   one tab here that is writing rather than bookkeeping, so it is kept
   deliberately thin — a body, some links, some photos, and who and when.

   Photos go to Drive the way receipts do and the cell holds the link, for
   the same reason: a sheet cell tops out at 50,000 characters and a photo
   is past that even shrunk. Links and photos are several per post, so each
   column holds them newline-separated rather than one column per slot. */
var POST_TAB = 'posts';
var POST_COLS = ['id', 'posted', 'who', 'week', 'body', 'links', 'photos', 'tags', 'edited'];
var POST_MAX_BODY = 2000;
var POST_MAX_PHOTOS = 4;
var POST_MAX_LINKS = 8;
var POST_MAX_TAGS = 8;

function postsApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');
  if(!internalActor(body))return reply(false, 'Session expired. Sign in again.', {code:'AUTH_REQUIRED'});

  var action = String(body.action || 'list'), err = null;
  if (action !== 'list') {
    var actor = internalActor(body);
    if (!actor) return reply(false, 'Session expired. Sign in again.');
    if (!internalIsAdmin(actor)) {
      if (action === 'add' && body.who !== actor) return reply(false, 'You can only post as yourself.');
      if (action === 'delete' || action === 'edit') {
        var post = postRead(postSheet()).filter(function(p){return p.id === String(body.id);})[0];
        if (!post || post.who !== actor) return reply(false, action === 'edit'
          ? 'You can only edit your own posts.'
          : 'You can only delete your own posts.');
      }
    }
  }
  if (action === 'add')         err = postAdd(body);
  else if (action === 'edit')   err = postEdit(body);
  else if (action === 'delete') err = postDelete(body);
  else if (action !== 'list')   return reply(false, 'unknown action');
  if (err) return reply(false, err);

  return reply(true, null, { posts: postRead(postSheet()).map(postPublic) });
}

function postSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet \u2014 set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(POST_TAB);
  if (!sh) {
    sh = ss.insertSheet(POST_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), POST_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, POST_COLS.length).setValues([POST_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }

  /* A tab made before `tags` and `edited` existed is missing their headers,
     and the cells under them are empty rather than wrong. So the header row
     is topped up in place: the notes already on it keep their rows, and an
     old post simply has nobody tagged and no edit stamp. */
  var head = sh.getRange(1, 1, 1, POST_COLS.length).getValues()[0];
  for (var i = 0; i < POST_COLS.length; i++) {
    if (String(head[i]) === POST_COLS[i]) continue;
    sh.getRange(1, 1, sh.getMaxRows(), POST_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, POST_COLS.length).setValues([POST_COLS]).setFontWeight('bold');
    break;
  }
  return sh;
}

function postCol(name) {
  return POST_COLS.indexOf(name) + 1;
}

/* Monday of the week a note belongs to. The page sends one, but a date
   from a browser is a date from anywhere, so it is recomputed here and the
   sent one is only trusted as far as being a real yyyy-mm-dd. */
function postWeek(v) {
  var s = String(v == null ? '' : v).slice(0, 10);
  var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* Only http(s), and only as many as the feed will show. Anything else is
   dropped rather than refused \u2014 a mistyped link should not cost somebody
   the note they just wrote. */
function postLinks(list) {
  var out = [];
  (list && list.length ? list : []).forEach(function (u) {
    var s = String(u == null ? '' : u).trim();
    if (out.length >= POST_MAX_LINKS) return;
    if (/^https?:\/\/[^\s]+$/i.test(s) && s.length <= 500) out.push(s);
  });
  return out;
}

/* Who a note tags, read out of the note itself rather than taken from the
   page. Someone types "...with @bijan" and the name is matched against the
   roster: only somebody on it counts, so a stray e-mail address or an @ in
   the middle of a word is left as words. The canonical spelling is stored,
   whatever case it was typed in. */
var POST_AT = /(^|[^A-Za-z0-9@_])@([A-Za-z][A-Za-z0-9_-]*)/g;

function postTagsIn(text) {
  var out = [], s = String(text == null ? '' : text), m;
  /* Everyone the sheet has heard of, not only everyone still here: an @ at
     somebody who has since left is still a mention of that person, and read
     once here rather than once per @ in the post. */
  var known = rosterKnown();
  POST_AT.lastIndex = 0;
  while ((m = POST_AT.exec(s))) {
    var typed = m[2].replace(/[-_]+$/, '').toLowerCase();
    for (var i = 0; i < known.length; i++) {
      var name = known[i];
      if (name.toLowerCase() !== typed) continue;
      if (out.indexOf(name) === -1 && out.length < POST_MAX_TAGS) out.push(name);
    }
  }
  return out;
}

function postAdd(b) {
  var who = campusSafe(String(b.who == null ? '' : b.who).trim()).slice(0, 60);
  if (!who) return 'say who is posting';

  var text = String(b.body == null ? '' : b.body).replace(/\r\n/g, '\n').trim();
  if (text.length > POST_MAX_BODY) text = text.slice(0, POST_MAX_BODY);

  var photos = [], files = (b.photos && b.photos.length) ? b.photos : [];
  for (var i = 0; i < files.length && photos.length < POST_MAX_PHOTOS; i++) {
    if (!files[i] || !files[i].data) continue;
    try {
      /* Shared by link, like a receipt: a feed four people read is no use
         if only the poster can open the screenshot. */
      photos.push(saveReceipt(files[i]));
    } catch (err) {
      return 'a photo could not be saved: ' + (err && err.message ? err.message : String(err));
    }
  }

  var links = postLinks(b.links);
  if (!text && !photos.length && !links.length) return 'write something, or add a photo or a link';

  postSheet().appendRow([
    Utilities.getUuid().slice(0, 8),
    campusStamp(),
    who,
    postWeek(b.week),
    campusSafe(text),
    links.join('\n'),
    photos.join('\n'),
    postTagsIn(text).join('\n'),
    ''
  ]);
  return null;
}

/* A note is a few lines typed in a hurry, so it is worth being able to fix
   one: the words, the links in them and who they tag. Whose note it is, the
   week it went into and the photos on it stay put — changing those would be
   writing a different note rather than correcting this one, and the delete
   is right there for that. The edit is stamped so the feed can say so. */
function postEdit(b) {
  var id = String(b.id == null ? '' : b.id);
  if (!id) return 'no post id';

  var sh = postSheet(), all = postRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id !== id) continue;

    var text = String(b.body == null ? '' : b.body).replace(/\r\n/g, '\n').trim();
    if (text.length > POST_MAX_BODY) text = text.slice(0, POST_MAX_BODY);
    var links = postLinks(b.links);
    if (!text && !links.length && !postSplit(all[i].photos).length)
      return 'a note cannot be emptied — delete it instead';

    var row = all[i]._row;
    sh.getRange(row, postCol('body')).setValue(campusSafe(text));
    sh.getRange(row, postCol('links')).setValue(links.join('\n'));
    sh.getRange(row, postCol('tags')).setValue(postTagsIn(text).join('\n'));
    sh.getRange(row, postCol('edited')).setValue(campusStamp());
    return null;
  }
  return 'that post is already gone';
}

function postDelete(b) {
  var id = String(b.id == null ? '' : b.id);
  if (!id) return 'no post id';
  var sh = postSheet(), all = postRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) { sh.deleteRow(all[i]._row); return null; }
  }
  return 'that post is already gone';
}

function postRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, POST_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < POST_COLS.length; j++) o[POST_COLS[j]] = vals[i][j];
    o.id = String(o.id);
    o.posted = campusWhen(o.posted);
    o.week = campusWhen(o.week).slice(0, 10);
    out.push(o);
  }
  return out;
}

function postSplit(v) {
  return String(v == null ? '' : v).split('\n').map(function (s) {
    return s.trim();
  }).filter(function (s) { return !!s; });
}

/* campusSafe puts a leading apostrophe on anything starting with =, + or @
   so a cell can never be read as a formula. A note that opens by tagging
   somebody — "@bijan and I..." — starts with an @, so that apostrophe is
   taken back off here rather than showing up in the feed. */
function postBody(v) {
  var s = String(v == null ? '' : v);
  return /^'[=+@]/.test(s) ? s.slice(1) : s;
}

function postPublic(p) {
  return {
    id: p.id, posted: p.posted, who: String(p.who), week: p.week,
    body: postBody(p.body), links: postSplit(p.links), photos: postSplit(p.photos),
    tags: postSplit(p.tags), edited: p.edited ? campusWhen(p.edited) : ''
  };
}

/* ══════════ the schedules ══════════

   One more tab of the same sheet, behind the same deployment: the hours
   each of them is already spoken for in a normal week — classes, a shift,
   practice — so the console can work out the other thing nobody can answer
   from four separate calendars, which is when everybody could actually be
   at the office at the same time.

   A row is one recurring block, not one event on one date: "Mon, Wed, Fri
   9:00–10:15, CS 106". `days` holds the weekdays it repeats on, 1 for
   Monday through 7 for Sunday, because a class on three days is one thing
   somebody typed once and three rows of it would be three things to fix
   when it moves.

   The times are wall-clock and carry no zone. That is not an oversight:
   a class at nine is at nine to the person sitting in it, whichever zone
   the script happens to be set to, and the office they are deciding to
   come into is the one they are near. */
var SCHED_TAB = 'schedules';
var SCHED_COLS = ['id', 'updated', 'who', 'label', 'kind', 'days', 'start', 'end', 'source', 'from', 'to', 'week'];
/* 'none' is not a block, it is the answer "nothing fixed this week" — the
   one thing a list of busy hours cannot say for itself. Without it somebody
   with no classes at all is indistinguishable from somebody who never
   filled the tab in, and the board would wait on them forever. It is stored
   as a row with no days and no hours, and the two cannot coexist with real
   blocks: adding one takes the other away, on the way in, below. */
var SCHED_KINDS = ['class', 'work', 'busy', 'none', 'break'];
var SCHED_SOURCES = ['typed', 'ics', 'pasted'];
/* A week of classes is a couple of dozen rows; a school calendar's terms,
   holidays and reading weeks are a couple of dozen more on top. The cap is
   there to stop a runaway import, not to ration a normal year. */
var SCHED_MAX_PER_PERSON = 140;
var SCHED_MAX_LABEL = 80;

function schedulesApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');
  if(!internalActor(body))return reply(false, 'Session expired. Sign in again.', {code:'AUTH_REQUIRED'});

  var action = String(body.action || 'list'), err = null;
  if (action !== 'list') {
    var actor = internalActor(body);
    if (!actor) return reply(false, 'Session expired. Sign in again.');
    /* Administrators read and write anybody's week; everybody else owns their own
       and nothing else. A block names its person, so the check is the same
       question in two shapes: the name on the way in, and the name already
       on the row being changed. */
    if (!internalIsAdmin(actor)) {
      if (action === 'add' || action === 'import' || action === 'clear') {
        if (String(body.who || '') !== actor) return reply(false, 'You can only change your own week.');
      }
      if (action === 'edit' || action === 'delete') {
        var block = schedRead(schedSheet()).filter(function (s) { return s.id === String(body.id); })[0];
        if (!block || String(block.who) !== actor) return reply(false, 'You can only change your own week.');
      }
    }
  }
  if (action === 'add')         err = schedAdd(body);
  else if (action === 'edit')   err = schedEdit(body);
  else if (action === 'delete') err = schedDelete(body);
  else if (action === 'import') err = schedImport(body);
  else if (action === 'clear')  err = schedClear(body);
  else if (action !== 'list')   return reply(false, 'unknown action');
  if (err) return reply(false, err);

  return reply(true, null, { schedules: schedRead(schedSheet()).map(schedPublic) });
}

function schedSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
                           : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('no spreadsheet — set SHEET_ID, or run this script from inside the sheet');

  var sh = ss.getSheetByName(SCHED_TAB);
  if (!sh) {
    sh = ss.insertSheet(SCHED_TAB);
    sh.getRange(1, 1, sh.getMaxRows(), SCHED_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, SCHED_COLS.length).setValues([SCHED_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  /* Everything on this tab is text, times included: '9:00' left to the
     sheet's own guess comes back as a Date in 1899, and the header is
     topped up in place the way the notes tab's is. */
  var head = sh.getRange(1, 1, 1, SCHED_COLS.length).getValues()[0];
  for (var i = 0; i < SCHED_COLS.length; i++) {
    if (String(head[i]) === SCHED_COLS[i]) continue;
    sh.getRange(1, 1, sh.getMaxRows(), SCHED_COLS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, SCHED_COLS.length).setValues([SCHED_COLS]).setFontWeight('bold');
    break;
  }
  return sh;
}

function schedCol(name) {
  return SCHED_COLS.indexOf(name) + 1;
}

/* "1,3,5" out of whatever the page sent — a list, a string, numbers or the
   names of the days. Sorted, deduplicated, and Monday first, so two ways of
   saying the same week read as the same week. */
function schedDays(v) {
  var raw = (v && v.length !== undefined && typeof v !== 'string') ? v : String(v == null ? '' : v).split(',');
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var n = parseInt(String(raw[i]).trim(), 10);
    if (!(n >= 1 && n <= 7)) continue;
    if (out.indexOf(n) === -1) out.push(n);
  }
  out.sort(function (a, b) { return a - b; });
  return out;
}

/* 'HH:MM', or '' for anything that is not a time of day. Minutes are kept
   as they are typed rather than rounded: a class that ends at 10:15 ends
   at 10:15, and the board can round when it draws. */
function schedTime(v) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(v == null ? '' : v).trim());
  if (!m) return '';
  var h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (!(h >= 0 && h <= 23) || !(min >= 0 && min <= 59)) return '';
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}

/* 'YYYY-MM-DD', or '' for anything that is not a day. A cell somebody has
   typed a date into comes back as a Date and is read the same way. */
function schedDate(v) {
  if (v && typeof v.getFullYear === 'function') {
    return v.getFullYear() + '-' + (v.getMonth() < 9 ? '0' : '') + (v.getMonth() + 1) +
      '-' + (v.getDate() < 10 ? '0' : '') + v.getDate();
  }
  var s = String(v == null ? '' : v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/* Which weeks a block actually runs in.

   'every' is the ordinary answer and what everything written before this
   column existed reads as. The other answer is a rotation: '1/2' is the
   first week of an alternating pair, '2/3' the middle week of a three-week
   cycle. A lab every other Tuesday is one block with a rotation on it, not
   a block that lies about half the Tuesdays in the term.

   Which real week is which is not stored anywhere. It is counted off a
   fixed Monday — 5 January 1970, which was one — so every page, every
   person and this script all land on the same answer for the same week
   without a shared anchor row to keep in step. */
function schedWeek(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s || s === 'every') return 'every';
  var m = /^(\d)\/(\d)$/.exec(s);
  if (!m) return 'every';
  var i = parseInt(m[1], 10), n = parseInt(m[2], 10);
  if (!(n >= 2 && n <= 4) || !(i >= 1 && i <= n)) return 'every';
  return i + '/' + n;
}

function schedMins(hhmm) {
  var m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}

function schedKind(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return SCHED_KINDS.indexOf(s) >= 0 ? s : 'busy';
}

function schedSource(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return SCHED_SOURCES.indexOf(s) >= 0 ? s : 'typed';
}

/* One block, cleaned, or a sentence saying what is wrong with it. The
   sentence is what gets shown, so it says what to do rather than which
   field failed. */
function schedClean(b) {
  var who = String(b.who == null ? '' : b.who).trim();
  if (rosterPayers().indexOf(who) === -1) return { error: 'that name is not on the bootcamp' };

  var kind = schedKind(b.kind);
  if (kind === 'none') {
    return { who: who, label: '', kind: 'none', days: '', start: '', end: '',
             source: schedSource(b.source), from: '', to: '', week: 'every' };
  }

  /* A break is the other thing a school calendar knows and a weekly grid
     cannot hold: spring break, reading week, the Monday nobody has class.
     It is dated rather than repeating, so it carries two days instead of a
     list of weekdays and no hours at all. */
  if (kind === 'break') {
    var from = schedDate(b.from), to = schedDate(b.to) || from;
    if (!from) return { error: 'a break needs the day it starts' };
    if (to < from) to = from;
    var name = String(b.label == null ? '' : b.label).replace(/\s+/g, ' ').trim().slice(0, SCHED_MAX_LABEL);
    if (!name) return { error: 'a break needs a name' };
    return { who: who, label: campusSafe(name), kind: 'break', days: '', start: '', end: '',
             source: schedSource(b.source), from: from, to: to, week: 'every' };
  }

  var days = schedDays(b.days);
  if (!days.length) return { error: 'pick at least one day' };

  var start = schedTime(b.start), end = schedTime(b.end);
  if (!start || !end) return { error: 'give a start and an end, like 09:00 and 10:15' };
  if (schedMins(end) <= schedMins(start)) return { error: 'that block ends before it starts' };

  var label = String(b.label == null ? '' : b.label).replace(/\s+/g, ' ').trim().slice(0, SCHED_MAX_LABEL);

  return {
    who: who, label: campusSafe(label), kind: kind,
    days: days.join(','), start: start, end: end, source: schedSource(b.source),
    from: '', to: '', week: schedWeek(b.week)
  };
}

function schedAdd(b) {
  var clean = schedClean(b);
  if (clean.error) return clean.error;

  var sh = schedSheet(), mine = schedRead(sh).filter(function (s) { return String(s.who) === clean.who; });
  if (clean.kind !== 'none' && mine.length >= SCHED_MAX_PER_PERSON)
    return 'that is already a full week — delete something first';

  /* "Nothing fixed" and an actual block are answers to the same question,
     so the newer one replaces the older rather than sitting beside it:
     declaring an empty week clears what was on it, and putting anything
     back on takes the declaration away. */
  var drop = mine.filter(function (s) {
    return clean.kind === 'none' ? true : schedKind(s.kind) === 'none';
  });
  for (var i = drop.length - 1; i >= 0; i--) sh.deleteRow(drop[i]._row);

  sh.appendRow([
    Utilities.getUuid().slice(0, 8), campusStamp(), clean.who, clean.label,
    clean.kind, clean.days, clean.start, clean.end, clean.source, clean.from, clean.to,
    clean.week
  ]);
  return null;
}

/* Everything about a block can be corrected except whose it is: moving one
   onto somebody else is two people's weeks being changed by one edit, and
   the person it would land on never asked. */
function schedEdit(b) {
  var id = String(b.id == null ? '' : b.id);
  if (!id) return 'no block id';

  var sh = schedSheet(), all = schedRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id !== id) continue;
    if (schedKind(all[i].kind) === 'none') return 'there is nothing on that line to edit';
    var was = schedKind(all[i].kind);
    var clean = schedClean({
      who: all[i].who, label: b.label, kind: was === 'break' ? 'break' : (b.kind === 'none' ? 'busy' : b.kind),
      days: b.days, start: b.start, end: b.end, source: all[i].source,
      from: b.from, to: b.to, week: b.week
    });
    if (clean.error) return clean.error;
    var row = all[i]._row;
    sh.getRange(row, schedCol('from')).setValue(clean.from);
    sh.getRange(row, schedCol('to')).setValue(clean.to);
    sh.getRange(row, schedCol('week')).setValue(clean.week);
    sh.getRange(row, schedCol('label')).setValue(clean.label);
    sh.getRange(row, schedCol('kind')).setValue(clean.kind);
    sh.getRange(row, schedCol('days')).setValue(clean.days);
    sh.getRange(row, schedCol('start')).setValue(clean.start);
    sh.getRange(row, schedCol('end')).setValue(clean.end);
    sh.getRange(row, schedCol('updated')).setValue(campusStamp());
    return null;
  }
  return 'that block is already gone';
}

function schedDelete(b) {
  var id = String(b.id == null ? '' : b.id);
  if (!id) return 'no block id';
  var sh = schedSheet(), all = schedRead(sh);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) { sh.deleteRow(all[i]._row); return null; }
  }
  return 'that block is already gone';
}

/* A calendar file is dropped on the page, read there, and arrives here as
   the blocks it worked out. It replaces what the last drop of the same
   kind left behind rather than adding to it — a term's timetable exported
   twice is one timetable, and an import that piled up would have somebody
   busy at every hour by the third try. Blocks typed by hand are left
   alone: they are the ones the calendar does not know about. */
function schedImport(b) {
  var who = String(b.who == null ? '' : b.who).trim();
  if (rosterPayers().indexOf(who) === -1) return 'that name is not on the bootcamp';
  var source = schedSource(b.source);
  if (source === 'typed') return 'an import has to say where it came from';

  var list = (b.blocks && b.blocks.length) ? b.blocks : [];
  if (list.length > SCHED_MAX_PER_PERSON) return 'that calendar has more in it than a week can hold';

  var clean = [];
  for (var i = 0; i < list.length; i++) {
    var one = schedClean({
      who: who, label: list[i].label, kind: list[i].kind,
      days: list[i].days, start: list[i].start, end: list[i].end, source: source,
      from: list[i].from, to: list[i].to, week: list[i].week
    });
    /* A single unreadable line in a calendar of forty is not a reason to
       refuse the other thirty-nine. */
    if (!one.error) clean.push(one);
  }
  if (!clean.length) return 'nothing in that file looked like a weekly commitment';

  var sh = schedSheet(), all = schedRead(sh);
  for (var j = all.length - 1; j >= 0; j--) {
    if (String(all[j].who) !== who) continue;
    /* the last import of this kind, and any standing "nothing fixed" — a
       calendar with hours in it has answered that question now */
    if (String(all[j].source) === source || schedKind(all[j].kind) === 'none') sh.deleteRow(all[j]._row);
  }
  var stamp = campusStamp();
  for (var k = 0; k < clean.length; k++) {
    sh.appendRow([
      Utilities.getUuid().slice(0, 8), stamp, clean[k].who, clean[k].label,
      clean[k].kind, clean[k].days, clean[k].start, clean[k].end, clean[k].source,
      clean[k].from, clean[k].to, clean[k].week
    ]);
  }
  return null;
}

function schedClear(b) {
  var who = String(b.who == null ? '' : b.who).trim();
  if (rosterPayers().indexOf(who) === -1) return 'that name is not on the bootcamp';
  var sh = schedSheet(), all = schedRead(sh);
  for (var i = all.length - 1; i >= 0; i--) {
    if (String(all[i].who) === who) sh.deleteRow(all[i]._row);
  }
  return null;
}

function schedRead(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, SCHED_COLS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][0])) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < SCHED_COLS.length; j++) o[SCHED_COLS[j]] = vals[i][j];
    o.id = String(o.id);
    o.updated = campusWhen(o.updated);
    out.push(o);
  }
  return out;
}

/* A time typed into the cell by hand comes back as a Date, the way a date
   does — read both as the 'HH:MM' the board is drawn from. It is asked
   whether it can tell the time rather than whether it is a Date: the same
   object crossing into this script from anywhere else is still a Date, and
   an instanceof would say no and quietly blank the cell. */
function schedCell(v) {
  if (v && typeof v.getHours === 'function') {
    var h = v.getHours(), m = v.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  return schedTime(v);
}

function schedPublic(s) {
  return {
    id: s.id, updated: s.updated, who: String(s.who),
    label: postBody(s.label), kind: schedKind(s.kind),
    days: schedDays(s.days), start: schedCell(s.start), end: schedCell(s.end),
    source: schedSource(s.source), from: schedDate(s.from), to: schedDate(s.to),
    week: schedWeek(s.week)
  };
}

function reply(ok, error, extra) {
  var out = { ok: !!ok };
  if (error) out.error = error;
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── the console behind /internal, for the two who maintain it ──

   Everything here is something the ledger deliberately refuses to do. A
   spend belongs to whoever logged it, a post to whoever wrote it, a day to
   whoever was in — and those rules are the point of the place, so nothing
   below weakens them. What they do not cover is the sheet going wrong: a
   row whose owner has left and cannot delete it, a name typed into the
   roster with a letter missing, a day marked on the wrong person by an
   import. Before this, fixing any of it meant opening the spreadsheet by
   hand, which is how a ledger four people trust stops being one.

   So the powers live here instead, behind their own namespace, named out
   loud, and every one of them writes down who used it. Two rules hold the
   whole thing up:

     · this is the only door — no check anywhere else was loosened to make
       room for it, so a bug in this file cannot quietly hand an intern
       somebody else's ledger;
     · destructive work is confirmed against what the caller was looking
       at, the same way approving a purchase is, so a row cannot be deleted
       on the strength of a screen that is ten minutes stale. */

var ADMIN_TABLES = ['invoice', 'days', 'hours', 'subs', 'posts', 'schedules'];

function internalAdminApi(body) {
  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');

  var actor = internalActor(body);
  if (!actor) return reply(false, 'Session expired. Enter the passcode and select your name again.');
  if (!internalIsAdmin(actor)) return reply(false, 'The console is Arya and Milo only.');

  var action = String(body.action || 'list'), err = null;
  if (action === 'list')              err = null;
  else if (action === 'rows')         err = null;
  else if (action === 'rosteradd')    err = rosterAdd(body, actor);
  else if (action === 'rosterremove') err = rosterRemove(body, actor);
  else if (action === 'rosterrestore')err = rosterRestore(body, actor);
  else if (action === 'rosterrole')   err = rosterRole(body, actor);
  else if (action === 'rosterrename') err = rosterRename(body, actor);
  else if (action === 'forcedelete')  err = adminForceDelete(body, actor);
  else return reply(false, 'unknown action');
  if (err) return reply(false, err);

  /* Like the ledger, the console answers with everything rather than a
     confirmation: the screen it is drawn on is the one thing that must not
     be allowed to disagree with the sheet. */
  var out = {
    roster: rosterRead().map(rosterPublic),
    counts: adminCounts(),
    audit: adminAudit(),
    log: adminLogRead()
  };
  /* One person's rows in one table, asked for on the way to deleting one of
     them. Not sent with every answer: the key that a delete has to echo back
     is the whole row, and six tables of those on every roster change would
     be most of the payload for the sake of a button nobody pressed. */
  if (action === 'rows') {
    out.table = String(body.table || '');
    out.who = String(body.who || '');
    out.rows = adminRows(out.table, out.who);
  }
  return reply(true, null, out);
}

/* ---------- the roster ---------- */

function rosterName(v) {
  var name = String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, 40);
  /* The name is an identifier before it is a label: it is written into the
     `who` column of six tabs and read back out of a comma-joined `shared`
     list, so a comma in it would split one person into two. */
  if (!name) return { error: 'that person needs a name' };
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return { error: 'a roster name is letters, and may hold a space, a dot, a hyphen or an apostrophe' };
  return { name: name };
}

function rosterAdd(b, actor) {
  var clean = rosterName(b.name);
  if (clean.error) return clean.error;
  var role = String(b.role || 'intern');
  if (ROSTER_ROLES.indexOf(role) === -1) return 'a new person is either an intern or a lead';

  var had = rosterFind(clean.name);
  /* Somebody who left and is coming back is the row that is already there,
     not a second one: their spends, days and posts are all keyed on this
     name and would otherwise end up split between two people with it. */
  if (had && !had.removed) return clean.name + ' is already on the roster';
  if (had) return rosterRestore({ name: clean.name, role: role }, actor);

  var sh = rosterSheet();
  sh.appendRow([clean.name, role, invoiceStamp(), actor, '', '']);
  rosterForget();
  adminLog(actor, 'rosteradd', clean.name, role);
  return null;
}

/* Taking somebody off the roster is not deleting them. Their name comes out
   of every picker and they can no longer sign in; every line they logged,
   day they were in and post they wrote stays exactly where it is and keeps
   rendering, because that is what the ledger did and the ledger is a record.
   Wiping it would also quietly change what everyone else is owed. */
function rosterRemove(b, actor) {
  var row = rosterFind(String(b.name || '').trim());
  if (!row) return 'that person is not on the roster';
  if (row.removed) return row.name + ' is already off the roster';
  if (internalIsAdmin(row.name)) return 'the console is ' + INTERNAL_ADMINS.join(' and ') + ' — neither of them can be taken off the roster from inside it';
  if (row.name === CARD_PAYER) return CARD_PAYER + '’s card is what half the ledger is logged against. Move the card before moving him.';
  var owed = adminOwed(row.name);
  if (owed > 0 && !b.evenThoughOwed) return row.name + ' is still owed ' + adminMoney(owed) + '. Settle up first, or tick the box to take them off anyway.';

  var sh = rosterSheet();
  sh.getRange(row._row, ROSTER_COLS.indexOf('removed') + 1, 1, 2).setValues([[invoiceStamp(), actor]]);
  rosterForget();
  adminLog(actor, 'rosterremove', row.name, owed > 0 ? 'still owed ' + adminMoney(owed) : '');
  return null;
}

function rosterRestore(b, actor) {
  var row = rosterFind(String(b.name || '').trim());
  if (!row) return 'that person is not on the roster';
  var sh = rosterSheet();
  sh.getRange(row._row, ROSTER_COLS.indexOf('removed') + 1, 1, 2).setValues([['', '']]);
  if (b.role && ROSTER_ROLES.indexOf(String(b.role)) > -1) {
    sh.getRange(row._row, ROSTER_COLS.indexOf('role') + 1).setValue(String(b.role));
  }
  rosterForget();
  adminLog(actor, 'rosterrestore', row.name, '');
  return null;
}

function rosterRole(b, actor) {
  var row = rosterFind(String(b.name || '').trim());
  if (!row) return 'that person is not on the roster';
  var role = String(b.role || '');
  if (ROSTER_ROLES.indexOf(role) === -1) return 'somebody is either an intern or a lead';
  if (role === row.role) return null;
  /* An intern has a timesheet and a lead does not, so this is not only a
     label: moving somebody to lead takes their name off the attendance
     board while leaving the days they were in on the sheet. */
  rosterSheet().getRange(row._row, ROSTER_COLS.indexOf('role') + 1).setValue(role);
  rosterForget();
  adminLog(actor, 'rosterrole', row.name, row.role + ' → ' + role);
  return null;
}

/* A name typed wrong is the one roster mistake that cannot be fixed by
   removing and re-adding: six tabs are keyed on the string. So it is done
   here, in one pass over every column that holds a person's name, and it is
   the one thing in the console with no undo behind it — which is why it
   asks for the new name twice on the way in and says so on screen. */
/* Each list column says how it is joined, because they do not agree and a
   rename must not quietly restyle a column on its way past. A split share
   is written 'Jesse, Milo', the archived approvals are bare commas, and a
   post's tags are one per line. Reading is forgiving — a comma or a newline
   ends a name either way — and writing puts back exactly what that column
   has always used. */
var ADMIN_NAME_COLS = [
  { tab: function () { return invoiceSheet(); },   cols: INVOICE_COLS,  who: ['who', 'logged_by'], list: [['shared', ', '], ['approvals', ',']] },
  { tab: function () { return daySheet(); },       cols: DAY_COLS,      who: ['who'],              list: [] },
  { tab: function () { return shiftSheet(); },     cols: SHIFT_COLS,    who: ['who'],              list: [] },
  { tab: function () { return subSheet(); },       cols: SUB_COLS,      who: ['who'],              list: [['shared', ', ']] },
  { tab: function () { return postSheet(); },      cols: POST_COLS,     who: ['who'],              list: [['tags', '\n']] },
  { tab: function () { return schedSheet(); },     cols: SCHED_COLS,    who: ['who'],              list: [] },
  { tab: function () { return profileSheet(); },   cols: PROFILE_COLS,  who: ['who'],              list: [] }
];

function rosterRename(b, actor) {
  var row = rosterFind(String(b.name || '').trim());
  if (!row) return 'that person is not on the roster';
  var clean = rosterName(b.to);
  if (clean.error) return clean.error;
  if (clean.name === row.name) return null;
  if (internalIsAdmin(row.name) || row.name === CARD_PAYER) return 'Administrator and card payer names cannot be renamed.';
  if (rosterFind(clean.name)) return clean.name + ' is already a name on the roster';
  if (String(b.confirm || '') !== clean.name) return 'type the new name again to confirm the rename';

  var moved = 0;
  ADMIN_NAME_COLS.forEach(function (t) {
    var sh = t.tab(), last = sh.getLastRow();
    if (last < 2) return;
    var width = t.cols.length;
    var vals = sh.getRange(2, 1, last - 1, width).getValues(), touched = false;
    for (var i = 0; i < vals.length; i++) {
      t.who.forEach(function (c) {
        var at = t.cols.indexOf(c);
        if (at > -1 && String(vals[i][at]) === row.name) { vals[i][at] = clean.name; touched = true; moved++; }
      });
      t.list.forEach(function (c) {
        var at = t.cols.indexOf(c[0]);
        if (at === -1) return;
        var parts = String(vals[i][at] || '').split(/[,\n]/).map(function (n) { return n.trim(); })
          .filter(function (n) { return n; });
        if (parts.indexOf(row.name) === -1) return;
        vals[i][at] = parts.map(function (n) { return n === row.name ? clean.name : n; }).join(c[1]);
        touched = true; moved++;
      });
    }
    if (touched) sh.getRange(2, 1, last - 1, width).setValues(vals);
  });

  rosterSheet().getRange(row._row, 1).setValue(clean.name);
  rosterForget();
  adminLog(actor, 'rosterrename', row.name + ' → ' + clean.name, moved + ' cells');
  return null;
}

/* ---------- a row nobody else can reach ---------- */

function adminTable(name) {
  if (name === 'invoice')   return { sh: invoiceSheet(),  cols: INVOICE_COLS, read: function (sh) { return invoiceRead(sh); } };
  if (name === 'days')      return { sh: daySheet(),      cols: DAY_COLS,     read: function (sh) { return dayRead(sh); } };
  if (name === 'hours')     return { sh: shiftSheet(),    cols: SHIFT_COLS,   read: function (sh) { return shiftRead(sh); } };
  if (name === 'subs')      return { sh: subSheet(),      cols: SUB_COLS,     read: function (sh) { return subRead(sh); } };
  if (name === 'posts')     return { sh: postSheet(),     cols: POST_COLS,    read: function (sh) { return postRead(sh); } };
  if (name === 'schedules') return { sh: schedSheet(),    cols: SCHED_COLS,   read: function (sh) { return schedRead(sh); } };
  return null;
}

/* What the caller was looking at when they pressed delete, joined the same
   way a purchase approval names what it approved. A row that has changed
   since the screen was drawn refuses rather than going, because the whole
   reason this exists is rows nobody is watching. */
function adminRowKey(cols, r) {
  return cols.map(function (c) { return String(r[c] == null ? '' : r[c]); }).join('␟');
}

/* Everything one person is holding in one table, each row carrying the key
   its own deletion will have to quote back and a line of plain English
   saying what it is. The line matters: a console that offers to delete
   `a3f19c2b` is a console nobody should press a button on. */
function adminRows(name, who) {
  var t = adminTable(name);
  if (!t) return [];
  who = String(who || '');
  return t.read(t.sh).filter(function (r) {
    return !who || String(r.who) === who || (name === 'invoice' && invoiceLogger(r) === who);
  }).map(function (r) {
    return { id: String(r.id), who: String(r.who || ''), key: adminRowKey(t.cols, r), line: adminLine(name, r) };
  });
}

function adminLine(name, r) {
  if (name === 'invoice') return String(r.date || '').slice(0, 10) + ' \u00b7 ' + adminMoney(r.amount) + ' \u00b7 ' + String(r.what || '') +
    ' \u00b7 ' + String(r.status || '') + (invoiceLogger(r) !== String(r.who) ? ' \u00b7 logged by ' + invoiceLogger(r) : '');
  if (name === 'days')  return String(r.day || '');
  if (name === 'hours') return String(r.day || '') + ' \u00b7 ' + (Math.round((Number(r.minutes) || 0) / 6) / 10) + 'h';
  if (name === 'subs')  return adminMoney(r.amount) + ' \u00b7 ' + String(r.what || '') + ' \u00b7 the ' + r.day + 'th' +
    (String(r.active) === 'no' ? ' \u00b7 paused' : '');
  if (name === 'posts') return String(r.week || '') + ' \u00b7 ' + String(r.body || '').replace(/\s+/g, ' ').slice(0, 90);
  if (name === 'schedules') return String(r.label || '') + ' \u00b7 ' + String(r.days || '') + ' ' + String(r.start || '') + '\u2013' + String(r.end || '');
  return String(r.id || '');
}

function adminForceDelete(b, actor) {
  var name = String(b.table || '');
  if (ADMIN_TABLES.indexOf(name) === -1) return 'that is not a table the console deletes from';
  var t = adminTable(name);
  if (!t) return 'that is not a table the console deletes from';

  var all = t.read(t.sh), hit = null;
  for (var i = 0; i < all.length; i++) if (String(all[i].id) === String(b.id)) hit = all[i];
  if (!hit) return 'that row is not on the sheet any more';
  if (adminRowKey(t.cols, hit) !== String(b.reviewed || '')) return 'That row changed since you looked at it. Reload and check it again before deleting it.';

  /* A ledger or subscription line is money, so it goes through the same
     history every other money change does and can be put back. The rest is
     attendance and writing: gone is gone, and the log says who did it. */
  if (name === 'invoice' || name === 'subs') {
    var before = moneySnapshot();
    t.sh.deleteRow(hit._row);
    try { moneyRemember(before, moneySnapshot(), actor, 'delete'); }
    catch (historyError) {
      moneyRestore(before);
      return 'The row was put back because its undo history could not be saved.';
    }
  } else {
    t.sh.deleteRow(hit._row);
  }
  adminLog(actor, 'forcedelete', name + ' ' + hit.id, String(hit.who || ''));
  return null;
}

/* ---------- what the sheet looks like from up here ---------- */

function adminMoney(n) { return '$' + (Math.round(Number(n) * 100) / 100).toFixed(2); }

function adminOwed(who) {
  var out = 0;
  invoiceRead(invoiceSheet()).forEach(function (r) {
    if (String(r.who) !== String(who)) return;
    if (invoiceSettled(r.who, r.status) === 'reimbursed') return;
    out += Number(r.amount) || 0;
  });
  return Math.round(out * 100) / 100;
}

/* How much of the sheet each name is actually holding, so "remove Jesse"
   is a decision made in front of the four hundred rows it touches rather
   than blind. */
function adminCounts() {
  var out = {};
  function bump(who, key) {
    var name = String(who || '');
    if (!name) return;
    if (!out[name]) out[name] = { rows: 0, days: 0, hours: 0, subs: 0, posts: 0, schedules: 0, owed: 0 };
    out[name][key]++;
  }
  invoiceRead(invoiceSheet()).forEach(function (r) {
    bump(r.who, 'rows');
    var name = String(r.who || '');
    if (name && out[name] && invoiceSettled(r.who, r.status) !== 'reimbursed') {
      out[name].owed = Math.round((out[name].owed + (Number(r.amount) || 0)) * 100) / 100;
    }
  });
  dayRead(daySheet()).forEach(function (r) { bump(r.who, 'days'); });
  shiftRead(shiftSheet()).forEach(function (r) { bump(r.who, 'hours'); });
  subRead(subSheet()).forEach(function (r) { bump(r.who, 'subs'); });
  postRead(postSheet()).forEach(function (r) { bump(r.who, 'posts'); });
  schedRead(schedSheet()).forEach(function (r) { bump(r.who, 'schedules'); });
  return out;
}

/* The things that are wrong rather than merely unfinished. Read-only on
   purpose: an audit that fixed what it found would be a script rewriting
   the ledger on its own, and the point of the console is that a person
   decided. Each finding names the row so it can be gone to. */
function adminAudit() {
  var known = rosterKnown(), out = [];
  function flag(kind, what, row, table) {
    if (out.length >= 200) return;
    var cols = table === 'invoice' ? INVOICE_COLS : table === 'days' ? DAY_COLS : table === 'posts' ? POST_COLS
      : table === 'schedules' ? SCHED_COLS : table === 'subs' ? SUB_COLS : SHIFT_COLS;
    out.push({ kind: kind, what: what, id: String(row.id || ''), table: table || '', key: adminRowKey(cols, row) });
  }

  invoiceRead(invoiceSheet()).forEach(function (r) {
    var who = String(r.who || '');
    if (who && known.indexOf(who) === -1) flag('stranger', 'a spend logged against ' + who + ', who is not on the roster', r, 'invoice');
    if (invoiceSettled(r.who, r.status) === 'reimbursed' && String(r.status) !== 'reimbursed' && who !== CARD_PAYER) {
      flag('settled', 'a line that reads settled but is not marked so', r, 'invoice');
    }
    if (!(Number(r.amount) > 0)) flag('amount', 'a spend with no amount on it', r, 'invoice');
    String(r.shared || '').split(',').map(function (n) { return n.trim(); }).filter(String).forEach(function (n) {
      if (n && known.indexOf(n) === -1 && !isGuestEntry(n)) flag('stranger', 'a spend split with ' + n + ', who is not on the roster', r, 'invoice');
    });
  });
  dayRead(daySheet()).forEach(function (r) {
    if (known.indexOf(String(r.who || '')) === -1) flag('stranger', 'a day marked for ' + r.who + ', who is not on the roster', r, 'days');
  });
  postRead(postSheet()).forEach(function (r) {
    if (known.indexOf(String(r.who || '')) === -1) flag('stranger', 'a post by ' + r.who + ', who is not on the roster', r, 'posts');
  });
  schedRead(schedSheet()).forEach(function (r) {
    if (known.indexOf(String(r.who || '')) === -1) flag('stranger', 'a schedule for ' + r.who + ', who is not on the roster', r, 'schedules');
  });
  subRead(subSheet()).forEach(function (r) {
    if (known.indexOf(String(r.who || '')) === -1) flag('stranger', 'a monthly rule for ' + r.who + ', who is not on the roster', r, 'subs');
  });
  return out;
}

/* ---------- the log ----------

   A power used without a record of who used it is the thing everybody was
   right to be nervous about. Every write above lands here first, before the
   console will show anybody a fresh screen, and nothing deletes from it. */
var ADMIN_LOG_TAB = 'internal_admin_log';
var ADMIN_LOG_COLS = ['at', 'who', 'action', 'subject', 'detail'];
var ADMIN_LOG_KEEP = 200;

function adminLogSheet() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ADMIN_LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(ADMIN_LOG_TAB);
    sh.getRange(1, 1, 1, ADMIN_LOG_COLS.length).setValues([ADMIN_LOG_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function adminLog(actor, action, subject, detail) {
  adminLogSheet().appendRow([invoiceStamp(), String(actor || ''), String(action || ''),
    campusSafe(String(subject || '')), campusSafe(String(detail || ''))]);
}

function adminLogRead() {
  var sh = adminLogSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  var from = Math.max(2, last - ADMIN_LOG_KEEP + 1);
  return sh.getRange(from, 1, last - from + 1, ADMIN_LOG_COLS.length).getValues().map(function (r) {
    return { at: String(r[0]), who: String(r[1]), action: String(r[2]), subject: String(r[3]), detail: String(r[4]) };
  }).reverse();
}

/* ══════════ referrals ══════════

   Two tabs and one idea: a code belongs to a person, and a referral is
   a row on somebody else's form that carries that code.

   `referrers` is the claim — one row per person who has been to
   /fomo/refer and taken a link. `referrals` is what came back through
   those links, and it is not typed by anybody: referSweep reads the
   form tabs the receiver already writes, finds the submissions with a
   `ref` cell on them, and opens a referral row for each one it has not
   seen before. That is the whole attribution mechanism. It means a
   referral cannot exist without a real submission behind it, and it
   means a door that gains referral tracking later needs a line in
   REFER_DOORS and nothing else.

   Money never moves by itself. A swept row lands at `pending`, which
   says only that somebody arrived on a link. Somebody has to look at
   the submission and say the person actually finished the thing before
   it becomes `completed`, and say it again before it becomes `paid`.
   The two steps are separate on purpose: the first is a judgement about
   the referral, the second is a statement that the money has left. */

var REFER_TAB = 'referrers';
var REFER_COLS = ['code', 'claimed', 'full name', 'email', 'school', 'status', 'note'];

var REFERRAL_TAB = 'referrals';
var REFERRAL_COLS = ['id', 'created', 'code', 'tier', 'who', 'contact', 'via', 'source',
                     'stage', 'amount', 'moved', 'moved by', 'note'];

/* Mirrors TIERS in fomo/refer/tiers.js — change both together. The page
   quotes these amounts to the person being asked to send the link, and
   this is what actually gets written next to their name, so the two
   disagreeing is the one bug here nobody would notice until a payout. */
var REFER_TIERS = {
  clan:    {level: 1, amount: 5},
  creator: {level: 2, amount: 25},
  intern:  {level: 3, amount: 100},
  chapter: {level: 4, amount: 250}
};

/* Which tier a submission on each form tab is worth. A tab not listed
   here is not swept, however many `ref` cells are on it — attribution
   on a door nobody has priced would land as a referral worth nothing.

   `onboard` is the clan rung. The chapter rung is not here and cannot
   be: a chapter qualifying is not a form somebody fills in, it is 80%
   of a house crossing a line in the campus admin, so it is opened by
   hand from the console. */
var REFER_DOORS = {apply: 'intern', submit: 'creator', onboard: 'clan'};

var REFER_STAGES = ['pending', 'completed', 'paid', 'rejected'];
var REFER_CODE_MAX = 24;

/* Mirrors normalizeCode in fomo/refer/tiers.js. */
function referCode(value) {
  return String(value == null ? '' : value)
    .trim().toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, REFER_CODE_MAX);
}

function referApi(body) {
  var action = String(body.action || 'list');

  /* The public half. It carries the form turnstile rather than the
     console passcode, because it is reached from a page a stranger is
     looking at. */
  if (action === 'claim') {
    if (CONFIG.SHARED_SECRET && body._key !== CONFIG.SHARED_SECRET) return reply(false, 'bad key');
    return referClaim(body);
  }

  if (CONFIG.INVOICE_KEY && body._key !== CONFIG.INVOICE_KEY) return reply(false, 'wrong passcode');
  var actor = internalActor(body);
  if (!actor) return reply(false, 'Session expired. Enter the passcode and select your name again.');
  if (!internalIsAdmin(actor)) return reply(false, 'Referrals are ' + INTERNAL_ADMINS.join(' and ') + ' only.');

  var err = null;
  if (action === 'stage')       err = referStage(body, actor);
  else if (action === 'open')   err = referOpen(body, actor);
  else if (action === 'block')  err = referBlock(body, actor);
  else if (action !== 'list')   return reply(false, 'unknown action');
  if (err) return reply(false, err);

  /* Every action answers with the whole picture rather than with what it
     just changed. The console draws totals across both tabs — owed per
     person, paid to date — and a partial answer would leave it adding a
     new row to figures it had computed before the row existed. */
  referSweep();
  return reply(true, null, {
    referrers: referrerRead(),
    referrals: referralRead(),
    tiers: REFER_TIERS,
    doors: REFER_DOORS
  });
}

/* ---------- the tabs ---------- */
function referSheet(name, cols) {
  var ss = campusBook();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  /* A tab made before a column existed is topped up in place, the way
     the week notes are: the rows already on it keep their rows and the
     new cell reads empty rather than wrong. */
  var head = sh.getRange(1, 1, 1, cols.length).getValues()[0];
  for (var i = 0; i < cols.length; i++) {
    if (String(head[i]) === cols[i]) continue;
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    break;
  }
  return sh;
}
function referrerSheet() { return referSheet(REFER_TAB, REFER_COLS); }
function referralSheet() { return referSheet(REFERRAL_TAB, REFERRAL_COLS); }

function referRows(sh, cols) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var any = false, row = {_row: i + 2};
    for (var j = 0; j < cols.length; j++) {
      row[cols[j]] = formsWhen(vals[i][j]);
      if (String(vals[i][j] || '') !== '') any = true;
    }
    if (any) out.push(row);
  }
  return out;
}
function referrerRead() { return referRows(referrerSheet(), REFER_COLS); }

/* Every cell leaves these tabs as text, which is the same defence the
   ledger and the campus tables take against a date the spreadsheet has
   decided to reinterpret. `amount` is the one exception: it is money,
   the console adds it up, and a column of strings is one silent string
   concatenation away from a total nobody can explain. */
function referralRead() {
  return referRows(referralSheet(), REFERRAL_COLS).map(function (r) {
    r.amount = Number(r.amount) || 0;
    return r;
  });
}

/* ---------- claiming a code ----------

   Idempotent by email. The page promises that claiming again with the
   same username gets the same code back, which is how somebody who has
   cleared their browser gets their link again — so the same person
   asking twice must not mint a second code, and must not be told their
   own code is taken.

   A username somebody else already holds is answered with a numbered
   variant rather than a refusal. A refusal here costs us the referrer
   over a name collision, which is a bad trade for both of us. */
function referClaim(body) {
  if (body._hp) return reply(true, null, {code: referCode(body.code)});

  var code = referCode(body.code);
  if (code.length < 3) return reply(false, 'That username is too short to make a link from.');

  var email = String(body.email == null ? '' : body.email).trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(false, 'Enter an email we can reach you on.');

  var name = campusSafe(String(body.full_name == null ? '' : body.full_name).trim()).slice(0, 100);
  var school = campusSafe(String(body.school == null ? '' : body.school).trim()).slice(0, 120);

  var held = referrerRead();
  var i;

  /* Already theirs — by code and email together, or by email alone. */
  for (i = 0; i < held.length; i++) {
    if (String(held[i]['email']).toLowerCase() === email) {
      return reply(true, null, {code: held[i]['code'], taken: held[i]['code'] !== code, mine: true});
    }
  }

  /* Somebody else's. Walk to the first free variant. */
  var taken = {}, free = code;
  for (i = 0; i < held.length; i++) taken[String(held[i]['code'])] = true;
  if (taken[free]) {
    var n = 2;
    while (taken[free] && n < 200) { free = code.slice(0, REFER_CODE_MAX - 2) + n; n++; }
  }

  referrerSheet().appendRow([free, campusStamp(), name, email, school, 'active', '']);
  return reply(true, null, {code: free, taken: free !== code, mine: false});
}

/* ---------- the sweep ----------

   Everything the form tabs have that the referrals tab has not. It runs
   on every console read, which is often enough that a referral is on
   screen the same day it arrives and cheap enough that it does not
   matter: the form tabs are a few hundred rows and the comparison is
   against a set built once.

   A submission is identified by its tab and its row. That is stable
   under everything the receiver does — it only ever appends — and it is
   what lets the console link a referral back to the submission it came
   from. A row deleted by hand in the spreadsheet would let the row
   beneath it be swept twice, which is the one cost of not writing an id
   onto tabs this namespace does not own. */
function referSweep() {
  var seen = {}, existing = referralRead(), i;
  for (i = 0; i < existing.length; i++) {
    var src = String(existing[i]['source'] || '');
    if (src) seen[src] = true;
  }

  var codes = {}, held = referrerRead();
  for (i = 0; i < held.length; i++) codes[String(held[i]['code'])] = held[i];

  var fresh = [], ss = campusBook();
  Object.keys(REFER_DOORS).forEach(function (tab) {
    var sh = ss.getSheetByName(tab);
    if (!sh) return;
    var headers = formsHeaders(sh);
    if (headers.indexOf('ref') === -1) return;
    var rows = applyRows(sh, headers);
    rows.forEach(function (r) {
      var code = referCode(r.cells['ref']);
      if (!code) return;
      var source = tab + ':' + r._row;
      if (seen[source]) return;
      seen[source] = true;

      var tier = REFER_DOORS[tab];
      var who = String(r.cells['full name'] || r.cells['name'] || r.cells['fomo username'] || '').slice(0, 120);
      var contact = String(r.cells['email'] || r.cells['handle'] || '').slice(0, 254);

      /* A code nobody has claimed still gets a row. It is somebody
         handing out a link we have never registered — the referrer who
         claimed while the sheet was unreachable, most likely — and the
         console has a place to show it. Dropping it here would lose the
         referral and the evidence of it at the same time. */
      var note = codes[code] ? '' : 'no claim on this code';
      if (codes[code] && String(codes[code]['status']) === 'blocked') note = 'code is blocked';

      /* Somebody using their own link on their own application. The
         rules page says it is dropped, so it is dropped — recorded as
         rejected rather than deleted, because a thing we refused to pay
         is worth being able to point at. */
      if (codes[code] && contact && String(codes[code]['email']).toLowerCase() === contact.toLowerCase()) {
        fresh.push([Utilities.getUuid().slice(0, 8), campusStamp(), code, tier, campusSafe(who),
                    campusSafe(contact), tab, source, 'rejected', REFER_TIERS[tier].amount,
                    campusStamp(), 'sweep', 'self-referral']);
        return;
      }

      fresh.push([Utilities.getUuid().slice(0, 8), campusStamp(), code, tier, campusSafe(who),
                  campusSafe(contact), tab, source, 'pending', REFER_TIERS[tier].amount,
                  '', '', note]);
    });
  });

  if (!fresh.length) return 0;
  var sh = referralSheet();
  sh.getRange(sh.getLastRow() + 1, 1, fresh.length, REFERRAL_COLS.length).setValues(fresh);
  return fresh.length;
}

/* ---------- moving one along ---------- */
function referStage(body, actor) {
  var id = String(body.id || '');
  var stage = String(body.stage || '');
  if (REFER_STAGES.indexOf(stage) === -1) return 'that is not a stage a referral can be at';

  var sh = referralSheet(), rows = referRows(sh, REFERRAL_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['id']) !== id) continue;
    /* Paid is the end of the line. Money has left; a console that can
       walk a row back out of it would be a console that can pay twice. */
    if (String(rows[i]['stage']) === 'paid' && stage !== 'paid') return 'that one is already paid';
    var r = rows[i]._row;
    sh.getRange(r, REFERRAL_COLS.indexOf('stage') + 1).setValue(stage);
    sh.getRange(r, REFERRAL_COLS.indexOf('moved') + 1).setValue(campusStamp());
    sh.getRange(r, REFERRAL_COLS.indexOf('moved by') + 1).setValue(actor);
    if (typeof body.note === 'string')
      sh.getRange(r, REFERRAL_COLS.indexOf('note') + 1).setValue(campusSafe(body.note.slice(0, 500)));
    return null;
  }
  return 'no referral with that id';
}

/* The chapter rung, and anything else that did not come through a form.
   A chapter crossing 80% is a fact about the campus admin, not a
   submission, so there is nothing for the sweep to find and it is
   opened by hand here. */
function referOpen(body, actor) {
  var code = referCode(body.code);
  if (!code) return 'say whose code it is';
  var tier = String(body.tier || '');
  if (!REFER_TIERS[tier]) return 'say which rung it is';

  var who = campusSafe(String(body.who == null ? '' : body.who).trim()).slice(0, 120);
  if (!who) return 'say who was referred';

  referralSheet().appendRow([
    Utilities.getUuid().slice(0, 8), campusStamp(), code, tier, who,
    campusSafe(String(body.contact == null ? '' : body.contact).trim()).slice(0, 254),
    'by hand', '', 'pending', REFER_TIERS[tier].amount, campusStamp(), actor,
    campusSafe(String(body.note == null ? '' : body.note).trim()).slice(0, 500)
  ]);
  return null;
}

function referBlock(body, actor) {
  var code = referCode(body.code);
  var status = body.blocked === true ? 'blocked' : 'active';
  var sh = referrerSheet(), rows = referRows(sh, REFER_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['code']) !== code) continue;
    sh.getRange(rows[i]._row, REFER_COLS.indexOf('status') + 1).setValue(status);
    sh.getRange(rows[i]._row, REFER_COLS.indexOf('note') + 1)
      .setValue(campusSafe(status + ' by ' + actor + ' ' + campusStamp()));
    return null;
  }
  return 'no referrer with that code';
}

/* ── Visit requests and visiting hours ──────────────────────────
   Included in this complete deployment file. No separate visits.gs is needed.
   Keep the existing VISITS_SERVICE_SECRET and VISITS_SHEET_ID Script Properties.
   These functions use the existing visit_requests tab without replacing it.
   ────────────────────────────────────────────────────────────── */

var VISIT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var VISIT_COLUMNS=['id','name','email','social','notes','preferred_date','preferred_time','time_zone','status','created_at','updated_at','internal_notes','version'];
function visitReply(ok,data,code) {
  return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data||null,code:code||null})).setMimeType(ContentService.MimeType.JSON);
}
function visitBook() {
  /* Same spreadsheet the rest of this script writes to, unless told otherwise. */
  var id=PropertiesService.getScriptProperties().getProperty('VISITS_SHEET_ID')
    || (typeof CONFIG!=='undefined' && CONFIG.SHEET_ID) || '';
  var book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!book)throw new Error('no spreadsheet - set VISITS_SHEET_ID');
  return book;
}
/* Called from doPost for body._api === 'visits'. The caller already holds the
   script lock, so this must not take or release one of its own. */
function visitsApi(body) {
  try{
    var secret=PropertiesService.getScriptProperties().getProperty('VISITS_SERVICE_SECRET');
    if(!secret || secret.length<32)return visitReply(false,null,'UNCONFIGURED');
    if(!body || JSON.stringify(body).length>16000)return visitReply(false,null,'INVALID');
    var given=String(body.secret||''),different=secret.length^given.length;
    for(var i=0;i<secret.length;i++)different|=secret.charCodeAt(i)^(given.charCodeAt(i)||0);
    if(different)return visitReply(false,null,'UNAUTHORIZED');
    if(body.action==='throttle'){
      if(!/^[a-f0-9]{64}$/.test(body.key))return visitReply(false,null,'INVALID');
      var cache=CacheService.getScriptCache(),cacheKey='visit-login:'+body.key;
      var bucket=JSON.parse(cache.get(cacheKey)||'null'),now=Date.now();
      if(!bucket || bucket.until<=now)bucket={count:0,until:now+15*60*1000};
      if(bucket.count>=10)return visitReply(false,null,'RATE_LIMIT');
      bucket.count++;
      cache.put(cacheKey,JSON.stringify(bucket),Math.max(1,Math.ceil((bucket.until-now)/1000)));
      return visitReply(true,{allowed:true});
    }
    var book=visitBook(),sheet=book.getSheetByName('visit_requests');
    if(!sheet){
      sheet=book.insertSheet('visit_requests');
      sheet.appendRow(VISIT_COLUMNS);
      sheet.setFrozenRows(1);
    }
    var grid=sheet.getDataRange().getValues();
    /* Only the columns this feature owns have to match. The form receiver in
       this same project appends a column to whatever tab a request names, and
       that must not take visit requests down. */
    if(JSON.stringify(grid[0].slice(0,VISIT_COLUMNS.length))!==JSON.stringify(VISIT_COLUMNS))return visitReply(false,null,'SCHEMA');
    var requests=grid.slice(1).map(function(row){
      var result={};VISIT_COLUMNS.forEach(function(key,n){
        var value=row[n];
        // Every stored string has one invisible text marker; decode exactly one.
        result[key]=typeof value==='string' && value.charCodeAt(0)===8203?value.slice(1):value;
      });
      result.version=Number(result.version);return result;
    }).filter(function(r){return VISIT_ID.test(String(r.id));});
    if(body.action==='settings')return visitReply(true,{availability:visitAvailability()});
    if(body.action==='saveSettings'){
      if(!Array.isArray(body.availability) || body.availability.length!==7)return visitReply(false,null,'INVALID');
      PropertiesService.getScriptProperties().setProperty('VISITS_AVAILABILITY',JSON.stringify(body.availability));
      return visitReply(true,{availability:visitAvailability()});
    }
    if(body.action==='list')return visitReply(true,{requests:requests.reverse()});
    if(body.action==='submit'){
      var r=body.request;
      if(!r || !/^[0-9a-f-]{36}$/i.test(r.id) || r.status!=='pending' || r.time_zone!=='America/New_York')return visitReply(false,null,'INVALID');
      var prior=requests.filter(function(x){return x.id===r.id;})[0];
      if(prior){
        if(prior.email!==r.email)return visitReply(false,null,'CONFLICT');
        return visitReply(true,{reference:prior.id,status:'pending',duplicate:true});
      }
      var since=Date.now()-24*60*60*1000;
      if(requests.filter(function(x){return x.email===r.email && new Date(x.created_at).getTime()>since;}).length>=5)return visitReply(false,null,'RATE_LIMIT');
      if(!visitDayOpen(r.preferred_date))return visitReply(false,null,'CLOSED');
      if(!visitAllowAddress(body.addressKey))return visitReply(false,null,'RATE_LIMIT');
      var values=VISIT_COLUMNS.map(function(k){return k==='version'?1:visitText(r[k]);});
      sheet.getRange(sheet.getLastRow()+1,1,1,VISIT_COLUMNS.length).setNumberFormat('@').setValues([values]);
      return visitReply(true,{reference:r.id,status:'pending',duplicate:false});
    }
    if(body.action==='update'){
      var index=requests.findIndex(function(r){return r.id===body.id;});
      if(index<0)return visitReply(false,null,'NOT_FOUND');
      var record=requests[index];
      if(record.version!==body.version)return visitReply(false,null,'CONFLICT');
      if(['pending','confirmed','completed','declined'].indexOf(body.status)<0 || typeof body.internalNotes!=='string' || body.internalNotes.length>3000)return visitReply(false,null,'INVALID');
      record.status=body.status;record.internal_notes=body.internalNotes;record.updated_at=body.now;record.version++;
      // Find the physical row by id so a manually blanked row cannot shift writes.
      var rowNumber=grid.findIndex(function(row){return String(row[0]).replace(/^\u200b/,'')===body.id;})+1;
      sheet.getRange(rowNumber,1,1,VISIT_COLUMNS.length).setNumberFormat('@').setValues([VISIT_COLUMNS.map(function(k){return k==='version'?record.version:visitText(record[k]);})]);
      return visitReply(true,{request:record});
    }
    return visitReply(false,null,'INVALID');
  }catch(err){return visitReply(false,null,'UNAVAILABLE');}
}
function visitAvailability() {
  var raw=PropertiesService.getScriptProperties().getProperty('VISITS_AVAILABILITY');
  if(!raw)return null;
  try{
    var parsed=JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length===7?parsed:null;
  }catch(err){return null;}
}
/* Unset or unreadable settings mean every day is open, which is how this
   behaved before availability existed. Failing open here is deliberate: a
   corrupted property must not silently close the form to every guest. */
function visitDayOpen(date) {
  var availability=visitAvailability();
  if(!availability)return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))return false;
  var parts=String(date).split('-');
  var day=new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])).getDay();
  return !availability[day] || availability[day].open!==false;
}
/* Best-effort ceiling per sending address, so one sender cannot fill the tab by
   varying the email. The 5-per-email rule reads committed rows and cannot see
   this; CacheService can, but is not durable, so treat it as a speed bump
   rather than a guarantee. Cache TTL caps the window well under a day. */
var VISIT_IP_LIMIT=8,VISIT_IP_MINUTES=60;
function visitAllowAddress(key) {
  // No key means a caller that predates this check; it already holds the secret.
  if(typeof key!=='string' || !/^[a-f0-9]{64}$/.test(key))return true;
  var cache=CacheService.getScriptCache(),cacheKey='visit-submit:'+key;
  var bucket=JSON.parse(cache.get(cacheKey)||'null'),now=Date.now();
  if(!bucket || bucket.until<=now)bucket={count:0,until:now+VISIT_IP_MINUTES*60*1000};
  if(bucket.count>=VISIT_IP_LIMIT)return false;
  bucket.count++;
  cache.put(cacheKey,JSON.stringify(bucket),Math.max(1,Math.ceil((bucket.until-now)/1000)));
  return true;
}
function visitText(value){
  var text=String(value==null?'':value);
  return '\u200b'+text;
}
