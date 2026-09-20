/* ══════════ the portal manager ══════════

   Every public front door on this domain, on one page, and everything
   that has come through each one.

   The console already had a view per subject — Applicants, Visit
   requests, Chapters — each one reading the door it happens to care
   about. What it had nowhere was the list of doors: which pages the
   outside world can actually post through, whether each is up, whether
   anything is behind it, and when the last person walked in. Two of the
   forms had no reader at all — /fomo/submit and /fomo/report wrote into
   the sheet and could be read nowhere but the spreadsheet.

   So this is a manager and not a fifth table: the index is the estate,
   and opening one portal is every submission it has ever taken, whatever
   it is written on. Three different backings sit behind these rows — the
   Apps Script sheet, /api/visits, /api/campuswars — and each is
   normalised to the same shape on the way in, so one renderer draws all
   of them and a portal added later needs a row in PORTALS and nothing
   else.

   Operators only, and the endpoint says so too. One screen here puts
   applicants' phone numbers, creators' payout handles and guests' contact
   details within a click of each other; everywhere else in the console
   they are a view apart. */

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};

/* ---------- the estate ----------

   `reads` is where a portal's submissions actually live, and it is the
   only thing that differs between them:

     tab      a tab of the Apps Script sheet, read through _api:'forms'
     visits   /api/visits, the same list the Visit requests view reads
     chapters /api/campuswars, the public snapshot the board is drawn from
     none     a page with no inbox — a door into the others

   `prefer` names the columns worth putting in the table when the sheet
   has them. It is a hint and never a requirement: a form that drops a
   question loses a column here and nothing else, and the table tops
   itself up from whatever headers did come back. */
const PORTALS = [
  {
    id:'apply', name:'Campus team application', path:'/fomo/apply/',
    blurb:'The five seats on a campus team. One application per seat — and a question added to the form arrives here as one more line, with nothing redeployed.',
    reads:{kind:'tab', tab:'apply'},
    view:{id:'applicants', label:'Applicants'},
    prefer:['full name','university','seat','email','hours']
  },
  {
    id:'submit', name:'Get paid for views', path:'/fomo/submit/',
    blurb:'A creator posts a video, tags @fomo and claims the payout per 1,000 qualifying views. Holds payout handles, so it is read here and nowhere else.',
    reads:{kind:'tab', tab:'submit'},
    prefer:['handle','platform','video url','school','payout method']
  },
  {
    id:'report', name:'Weekly report', path:'/fomo/report/',
    blurb:'Where a campus team drops its Sunday report to HQ. The upload itself stays in Drive; the sheet holds the link to it.',
    reads:{kind:'tab', tab:'report'},
    prefer:['full name','school','seat','week','file']
  },
  {
    id:'onboard', name:'Chapter onboarding', path:'/fomo/onboard/',
    blurb:'A student joining the house their school already has, with their fomo username checked on the way through.',
    reads:{kind:'tab', tab:'onboard'},
    prefer:['full name','school','clan','fomo username','email']
  },
  {
    id:'visits', name:'Visit fomo HQ', path:'/hqvisitform/',
    blurb:'A guest asking for a slot at HQ. Its own store behind /api/visits rather than the sheet, and never cached in this browser.',
    reads:{kind:'visits'},
    view:{id:'visits', label:'Visit requests'},
    prefer:['name','email','preferred_date','preferred_time','status']
  },
  {
    id:'campuswars', name:'Campus wars', path:'/fomo/campuswars/',
    blurb:'The chapter competition. Registrations come from the campus admin through /api/campuswars, so this is a read of somebody else’s system rather than of ours.',
    reads:{kind:'chapters'},
    view:{id:'chapters', label:'Chapters'},
    prefer:['name','school','joined','active','registered']
  },
  {
    id:'refer', name:'Refer people, get paid', path:'/fomo/refer/',
    blurb:'Where somebody claims a referral link. The tab holds the codes; what came back through them is a view of its own, because it is money rather than a submission.',
    reads:{kind:'tab', tab:'referrers'},
    view:{id:'referrals', label:'Referrals'},
    prefer:['code','full name','email','school','status']
  },
  {
    id:'portal', name:'Campus portal', path:'/fomoportal',
    blurb:'Four ways into fomo at your school on one screen. It takes nothing itself — every door on it leads to one of the forms above.',
    reads:{kind:'none'}
  },
  {
    id:'landing', name:'Campus landing', path:'/landingpage/',
    blurb:'The pitch for Greek Wars, the internship and paid posts. A page to send people to, with no inbox of its own.',
    reads:{kind:'none'}
  },
  {
    id:'program', name:'fomo campus', path:'/fomo/',
    blurb:'The program itself: five roles, an eight-week goal map, sixty days. The page the rest of them are explaining.',
    reads:{kind:'none'}
  }
];
const portalOf = id => PORTALS.find(p => p.id === id) || null;

/* Columns the person filling the form in never saw. They are worth
   showing on the record — `page` is which form it came from, `id` and
   `status` are the console's own — but they have no business taking one
   of the five slots in the table. */
const BOOKKEEPING = ['page', 'id', 'status', 'team notes', 'decided', 'received', 'version'];

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function niceDate(stamp){
  const p = String(stamp || '').slice(0,10).split('-');
  if (p.length !== 3 || !Number(p[1])) return '—';
  const out = MONTHS[Number(p[1])-1] + ' ' + Number(p[2]);
  return Number(p[0]) === new Date().getFullYear() ? out : out + ' ' + p[0];
}
function ago(stamp){
  const t = Date.parse(String(stamp || '').slice(0,10) + 'T00:00:00');
  if (!t) return '';
  const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}
function withinDays(stamp, n){
  const t = Date.parse(String(stamp || '').slice(0,10) + 'T00:00:00');
  return !!t && (Date.now() - t) < n * 86400000;
}
function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }
function label(k){ return String(k || '').replace(/_/g, ' '); }
function link(url, text){
  let u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return '';
  return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text || u) + '</a>';
}
/* A cell is an answer somebody typed, so a link in one is worth having as
   a link — and nothing else in it is ever treated as markup. */
function cell(v){
  const s = String(v == null ? '' : v);
  return /^https?:\/\//i.test(s.trim()) ? link(s, s.replace(/^https?:\/\//i, '').slice(0, 44)) : esc(s);
}
function note(msg, bad){
  const el = $('pl-msg');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', !!bad);
}
function csv(name, head, lines){
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const body = head.join(',') + '\r\n' +
    lines.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob(['﻿' + body], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- state ----------

   Nothing here is written to localStorage, deliberately and for the same
   reason the applicants are not: these rows are other people's contact
   details, and a faster second open is not worth leaving them in a
   browser after the tab is shut. */
const state = {
  index: null,     // what the sheet says is on each form tab
  inbox: null,     // which forms the deployed receiver will actually accept
  probe: {},       // portal id -> {state:'up'|'down'|'checking', status}
  data: {},        // portal id -> {loading, error, headers, rows, total, capped, at}
  open: null,      // the portal being looked at, or null for the index
  pick: null,      // which row of what is in view is open beside the table
  busy: false,
  q: ''
};

/* ---------- the sheet ---------- */
async function callForms(action, payload){
  const cfg = bridge();
  if (!cfg.identity || !cfg.identity()) throw new Error('Sign in first.');
  if (!cfg.endpoint) throw new Error('this console has no sheet endpoint set — see invoice/README.md');
  const body = Object.assign({_api:'forms', action, _key:cfg.key || '',
    _session:cfg.session ? cfg.session() : ''}, payload || {});
  const res = await fetch(cfg.endpoint, {method:'POST', body:JSON.stringify(body)});
  if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
  let out = null;
  try { out = JSON.parse(await res.text()); } catch (e) {}
  if (!out) throw new Error('the endpoint answered, but not with the portals. ' +
    'Its deployment access is probably not set to "Anyone"');
  /* A deployment that predates the reader answers 'unknown form', because
     doPost reads an unrecognised namespace as a submission. Say which fix
     it is rather than leaving the page blaming the passcode. */
  if (out.ok !== true) {
    if (/unknown form/i.test(out.error || '')) throw new Error('the Apps Script behind this endpoint is an ' +
      'older version — it does not know about the portals yet. Redeploy fomo/setup/apps-script.gs ' +
      '(Deploy → Manage deployments → New version)');
    throw new Error(out.error || 'the sheet turned it away');
  }
  return out;
}

/* Visit requests come from their own endpoint, and the console's session
   is what authorises the read — the same call the Visit requests view
   makes, made here rather than reached into. */
async function callVisits(){
  const cfg = bridge();
  const res = await fetch('/api/visits?action=list', {
    credentials:'same-origin', cache:'no-store',
    headers: cfg.session && cfg.session() ? {'X-Fomo-Internal-Session':cfg.session()} : {}
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'the visit store answered HTTP ' + res.status);
  return Array.isArray(out.requests) ? out.requests : [];
}

async function callChapters(){
  const res = await fetch('/api/campuswars', {cache:'no-store'});
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'the chapter feed answered HTTP ' + res.status);
  if (!out.chapters) throw new Error('the feed answered, but without any chapters in it');
  return {rows: out.chapters, stale: out.stale === true, at: out.updatedAt || ''};
}

/* ---------- is the door open ----------

   A portal can be perfectly wired to its inbox and still be a 404,
   which no count would ever show. One HEAD each, same origin, on the
   first open and again on Refresh. */
async function probe(p){
  state.probe[p.id] = {state:'checking'};
  try {
    let res = await fetch(p.path, {method:'HEAD', cache:'no-store'});
    /* Not every host answers HEAD on a static page; a GET settles it. */
    if (res.status === 405 || res.status === 501) res = await fetch(p.path, {cache:'no-store'});
    state.probe[p.id] = {state: res.ok ? 'up' : 'down', status: res.status};
  } catch (e) {
    state.probe[p.id] = {state:'down', status:0};
  }
  if (!state.open) renderIndex();
}

/* ---------- one shape, whatever it is written on ----------

   Every source lands as {headers, rows:[{received, cells}]}: the sheet
   already answers in it, and the two APIs are turned into it here. The
   renderer below knows nothing else, which is why a portal added later
   does not touch it. */
function headersFrom(rows){
  const seen = [];
  rows.forEach(r => Object.keys(r.cells).forEach(k => { if (seen.indexOf(k) === -1) seen.push(k); }));
  return seen;
}
function fromRecords(records, when, drop){
  const rows = records.map(r => {
    const cells = {};
    Object.keys(r).forEach(k => {
      if ((drop || []).indexOf(k) > -1) return;
      const v = r[k];
      if (v === null || v === undefined || v === '') return;
      cells[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
    return {received: String(r[when] || ''), cells};
  });
  rows.sort((a, b) => String(b.received).localeCompare(String(a.received)));
  return {headers: headersFrom(rows), rows, total: rows.length, capped: false};
}

async function pull(p, force){
  const held = state.data[p.id];
  if (held && held.loading) return;
  if (held && !held.error && !force) return;
  state.data[p.id] = {loading:true};
  if (state.open === p.id) renderDetail();
  try {
    let got;
    if (p.reads.kind === 'tab') {
      const out = await callForms('rows', {tab:p.reads.tab});
      got = {headers: out.headers || [], rows: out.rows || [], total: out.total || 0,
             capped: out.capped === true, exists: out.exists === true};
    } else if (p.reads.kind === 'visits') {
      got = fromRecords(await callVisits(), 'created_at', ['id','version']);
    } else if (p.reads.kind === 'chapters') {
      const out = await callChapters();
      got = fromRecords(out.rows, 'registered', []);
      got.stale = out.stale;
      got.at = out.at;
    } else {
      got = {headers:[], rows:[], total:0, capped:false};
    }
    got.loading = false;
    got.at = got.at || new Date().toISOString();
    state.data[p.id] = got;
  } catch (err) {
    state.data[p.id] = {loading:false, error: err.message, headers:[], rows:[], total:0};
  }
  /* The index counts the two API-backed portals by reading them, so it is
     drawn again when the read lands — otherwise they sit on "Reading…"
     until something else happens to repaint. A read that finishes while
     some other portal is open repaints neither: the screen it is about is
     not the screen anybody is looking at. */
  if (!state.open) renderIndex();
  else if (state.open === p.id) renderDetail();
  renderAgg();
  publish();
}

/* ---------- the index ---------- */
async function loadIndex(force){
  const cfg = bridge();
  if (!cfg.identity || !cfg.identity()) return;
  if (state.busy || (state.index && !force)) return;
  state.busy = true;
  note(state.index ? 'Re-reading the sheet…' : 'Reading the form tabs…');
  try {
    const out = await callForms('index');
    state.index = {};
    (out.portals || []).forEach(t => { state.index[t.tab] = t; });
    state.inbox = out.inbox || null;
    note('Up to date with the sheet.');
  } catch (err) {
    note(err.message, true);
  } finally {
    state.busy = false;
  }
  /* The two API-backed portals are counted by reading them, which is the
     only way to count them — there is no cheaper question to ask either
     endpoint. They are small and it happens once. */
  PORTALS.filter(p => p.reads.kind === 'visits' || p.reads.kind === 'chapters')
    .forEach(p => pull(p, force));
  PORTALS.forEach(probe);
  /* The index can be read while a portal is open — a link straight to one
     asks for it too — so it draws the screen it is about and leaves the
     other one alone. */
  if (state.open) renderDetail(); else renderIndex();
  renderAgg();
  publish();
}

/* What is known about one portal, from whichever of the two places knows
   it. `inbox` is the honest one: a door whose form the deployed receiver
   will not accept has no inbox, however empty its tab looks. */
function factsOf(p){
  if (p.reads.kind === 'tab') {
    const t = (state.index || {})[p.reads.tab] || null;
    const accepted = !state.inbox || state.inbox.indexOf(p.reads.tab) > -1;
    /* The tally and the rows count the same tab, so either answers this —
       and the rows are the one already on screen. A link straight to a
       portal has them before the index has been asked for at all. */
    const d = state.data[p.id];
    const read = !!(d && !d.loading && !d.error);
    return {
      known: read || !!state.index, accepted,
      total: read ? d.total : t ? t.total : 0,
      last: read && d.rows.length ? d.rows[0].received : t ? t.last : '',
      where: 'the ' + p.reads.tab + ' tab',
      exists: read ? d.exists !== false : t ? t.exists : false,
      error: d ? d.error : ''
    };
  }
  if (p.reads.kind === 'none') return {known:true, accepted:true, total:null, last:'', where:'no inbox'};
  const d = state.data[p.id] || null;
  return {
    known: !!(d && !d.loading && !d.error), accepted: true,
    total: d && !d.error ? d.total : 0,
    last: d && d.rows && d.rows.length ? d.rows[0].received : '',
    where: p.reads.kind === 'visits' ? '/api/visits' : '/api/campuswars',
    exists: true, error: d ? d.error : ''
  };
}

/* The one line that says what to think about this portal. Order matters:
   a door that is down is a bigger fact than an empty inbox behind it. */
function verdict(p){
  const f = factsOf(p), up = state.probe[p.id] || {};
  if (up.state === 'down') return {pill:'red', text: up.status ? 'Page ' + up.status : 'Not answering'};
  if (f.error) return {pill:'red', text:'Not reading'};
  if (!f.accepted) return {pill:'amber', text:'No inbox'};
  if (p.reads.kind === 'none') return {pill:'', text:'A door'};
  if (!f.known) return {pill:'', text:'Reading…'};
  if (!f.total) return {pill:'', text:'Nothing yet'};
  if (withinDays(f.last, 7)) return {pill:'good', text:'Live this week'};
  return {pill:'blue', text:'Quiet'};
}

function renderIndex(){
  const box = $('pl-index');
  if (!box) return;
  const q = state.q.trim().toLowerCase();
  const list = PORTALS.filter(p => !q ||
    (p.name + ' ' + p.path + ' ' + p.blurb).toLowerCase().indexOf(q) > -1);

  $('pl-showing').textContent = q
    ? plural(list.length, 'portal', 'portals') + ' of ' + PORTALS.length
    : plural(PORTALS.length, 'front door', 'front doors');

  box.innerHTML = list.length ? '<div class="pl-grid">' + list.map(p => {
    const f = factsOf(p), v = verdict(p);
    const count = p.reads.kind === 'none' ? '—'
      : f.known ? String(f.total) : '·';
    return '<button class="pl-card" type="button" data-portal="' + esc(p.id) + '">' +
      '<span class="pl-card-h">' +
        '<b>' + esc(p.name) + '</b>' +
        '<span class="pill' + (v.pill ? ' ' + v.pill : '') + '"><i></i>' + esc(v.text) + '</span>' +
      '</span>' +
      '<span class="pl-path">' + esc(p.path) + '</span>' +
      '<span class="pl-blurb">' + esc(p.blurb) + '</span>' +
      '<span class="pl-foot">' +
        '<span class="pl-n">' + esc(count) + '<small>' +
          (p.reads.kind === 'none' ? 'takes nothing' : f.total === 1 ? 'submission' : 'submissions') +
        '</small></span>' +
        '<span class="pl-when">' + esc(f.last ? 'last ' + ago(f.last) : '') + '</span>' +
        '<span class="pl-where">' + esc(f.where) + '</span>' +
      '</span>' +
    '</button>';
  }).join('') + '</div>'
    : '<div class="empty"><b>No portal by that name.</b>Nine front doors, searched by name, path and what each one is for.</div>';
}

/* ---------- one portal ---------- */
function visible(p){
  const d = state.data[p.id];
  if (!d || !d.rows) return [];
  const q = state.q.trim().toLowerCase();
  if (!q) return d.rows;
  return d.rows.filter(r => Object.keys(r.cells)
    .some(k => String(r.cells[k]).toLowerCase().indexOf(q) > -1));
}

/* Five columns at most: `received`, then the portal's own preferences
   where the data actually has them, topped up from whatever else came
   back. A form that changes shape narrows or widens this by itself. */
function columnsOf(p, d){
  const has = d.headers.filter(h => h && BOOKKEEPING.indexOf(h) === -1);
  const cols = (p.prefer || []).filter(h => has.indexOf(h) > -1);
  has.forEach(h => { if (cols.length < 4 && cols.indexOf(h) === -1) cols.push(h); });
  return cols.slice(0, 4);
}

function renderDetail(){
  const p = portalOf(state.open);
  const box = $('pl-detail');
  if (!p || !box) return;
  const d = state.data[p.id] || {loading:true};
  const f = factsOf(p), v = verdict(p);
  const up = state.probe[p.id] || {};

  let head = '<div class="pl-head">' +
    '<div class="pl-head-t"><h2>' + esc(p.name) +
      '<span class="pill' + (v.pill ? ' ' + v.pill : '') + '"><i></i>' + esc(v.text) + '</span></h2>' +
      '<p>' + esc(p.blurb) + '</p></div>' +
    '<div class="pl-head-k">' +
      '<span><b>Page</b>' + link(location.origin + p.path, p.path) + '</span>' +
      '<span><b>Lands in</b>' + esc(f.where) + '</span>' +
      (p.view ? '<span><b>Also on</b><a href="#/' + esc(p.view.id) + '">' + esc(p.view.label) + '</a></span>' : '') +
      (up.state === 'up' ? '<span><b>Answering</b>HTTP ' + esc(String(up.status)) + '</span>' :
       up.state === 'down' ? '<span><b>Answering</b>' + esc(up.status ? 'HTTP ' + up.status : 'nothing') + '</span>' : '') +
    '</div>' +
  '</div>';

  /* The three sentences worth saying before a table: a door with no
     inbox, a form the receiver refuses, and a read that failed. Each one
     is a different fix, so none of them is left as an empty table. */
  let banner = '';
  if (p.reads.kind === 'none') {
    banner = '<div class="pl-note"><b>This one takes nothing.</b> It is a page people are sent to, not a form ' +
      'they submit — everything it collects, it collects by sending them to one of the other portals.</div>';
  } else if (!f.accepted) {
    banner = '<div class="pl-note warn"><b>Nothing this form sends is being kept.</b> It posts to the ' +
      esc(p.reads.tab) + ' tab, and the deployed receiver only accepts ' +
      esc((state.inbox || []).join(', ')) + ' — so a submission is answered with <code>unknown form</code> ' +
      'and the person is told it did not send. The fix is one name in <code>FORM_INBOX</code> in ' +
      'fomo/setup/apps-script.gs, then a redeploy.</div>';
  } else if (d.error) {
    banner = '<div class="pl-note warn"><b>Couldn’t read this one.</b> ' + esc(d.error) + '</div>';
  } else if (d.stale) {
    banner = '<div class="pl-note"><b>Showing the last snapshot.</b> The campus admin did not answer the server ' +
      'this time, so these are as of ' + esc(niceDate(d.at)) + ' rather than this minute.</div>';
  } else if (d.capped) {
    banner = '<div class="pl-note">Showing the newest ' + plural(d.rows.length, 'submission', 'submissions') +
      ' of ' + d.total + '. The rest are on the tab.</div>';
  }

  const rows = visible(p);
  const week = (d.rows || []).filter(r => withinDays(r.received, 7)).length;
  /* The toolbar counts what the toolbar is filtering, which on this
     screen is submissions and not portals. */
  $('pl-showing').textContent = p.reads.kind === 'none' ? ''
    : d.loading ? 'reading…'
    : state.q.trim() ? plural(rows.length, 'submission', 'submissions') + ' of ' + (d.total || 0)
    : plural(d.total || 0, 'submission', 'submissions');
  const stat = (lbl, v, sub, tone) =>
    '<div class="overview-stat"><span class="lbl">' + esc(lbl) + '</span>' +
    '<span class="v' + (tone ? ' ' + tone : '') + '">' + esc(v) + '</span>' +
    '<span class="sub">' + esc(sub) + '</span></div>';
  const asked = (d.headers || []).filter(h => BOOKKEEPING.indexOf(h) === -1).length;
  const rail = p.reads.kind === 'none' ? '' :
    '<div class="rail">' +
      stat('submissions', d.loading ? '·' : String(d.total || 0), f.where) +
      stat('last seven days', d.loading ? '·' : String(week),
           week ? 'still coming in' : 'nothing this week', week ? 'good' : '') +
      stat('most recent', f.last ? niceDate(f.last) : '—', f.last ? ago(f.last) : 'nobody yet') +
      stat('questions asked', d.loading ? '·' : String(asked), 'columns on the form') +
    '</div>';

  let table = '';
  if (p.reads.kind !== 'none') {
    if (d.loading) {
      table = '<div class="empty"><b>Reading it…</b>One round trip to whatever this portal writes into.</div>';
    } else if (!rows.length) {
      /* Three different empties, and saying the wrong one is worse than
         saying nothing: a form the receiver refuses is not a form nobody
         has filled in. */
      const why = state.q ? 'Clear the search to see everything this portal has taken.'
        : !f.accepted ? 'Nothing could have. The receiver turns this form away, so every submission is lost on the way in.'
        : d.error ? 'Nothing is lost — this is a read, and a Refresh is the whole fix.'
        : 'The form is up; nobody has submitted it.';
      const head2 = state.q ? 'Nothing matches that.'
        : !f.accepted ? 'Nothing has been kept.'
        : d.error ? 'Nothing to show.' : 'Nothing has come through yet.';
      table = '<div class="empty"><b>' + head2 + '</b>' + esc(why) + '</div>';
    } else {
      const cols = columnsOf(p, d);
      table = '<div class="pl-cols"><div class="tbl-scroll"><table><thead><tr><th>Received</th>' +
        cols.map(c => '<th>' + esc(label(c)) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map((r, i) => '<tr class="pl-row' + (state.pick === i ? ' pl-row-on' : '') +
          '" data-pick="' + i + '">' +
          '<td class="date">' + esc(niceDate(r.received)) + '</td>' +
          cols.map(c => '<td>' + cell(r.cells[c]) + '</td>').join('') +
        '</tr>').join('') + '</tbody></table></div>' + recordPanel(p, rows) + '</div>';
    }
  }

  box.innerHTML = head + banner + rail + table;
}

/* The whole submission, exactly as it was answered — every field the
   sheet holds for it, in the order the form asks them, and the
   bookkeeping columns last and named as such. */
function recordPanel(p, rows){
  const r = state.pick == null ? null : rows[state.pick];
  if (!r) return '<aside class="pl-rec" hidden></aside>';
  const d = state.data[p.id];
  const keys = (d.headers.length ? d.headers : Object.keys(r.cells)).filter(k => k in r.cells);
  const own = keys.filter(k => BOOKKEEPING.indexOf(k) === -1);
  const book = keys.filter(k => BOOKKEEPING.indexOf(k) > -1 && k !== 'received');
  const line = k => '<dt>' + esc(label(k)) + '</dt><dd' +
    (String(r.cells[k]).length > 90 ? ' class="say"' : '') + '>' + cell(r.cells[k]) + '</dd>';
  return '<aside class="pl-rec" aria-label="The open submission">' +
    '<div class="pl-rec-h"><h3>' + esc(niceDate(r.received)) +
      '<small>' + esc(ago(r.received) || 'no date on it') +
      (r._row ? ' · row ' + esc(String(r._row)) + ' of the sheet' : '') + '</small></h3>' +
      '<button class="mini ghost" id="pl-rec-x" type="button" aria-label="Close this submission">✕</button></div>' +
    '<dl>' + own.map(line).join('') + '</dl>' +
    (book.length ? '<p class="pl-rec-k">Not the applicant’s answers — the console’s own columns</p><dl>' +
      book.map(line).join('') + '</dl>' : '') +
  '</aside>';
}

/* ---------- the strip along the foot ---------- */
function renderAgg(){
  const bar = $('pl-agg');
  if (!bar) return;
  if (state.open) {
    const p = portalOf(state.open), d = state.data[state.open] || {};
    const shown = visible(p).length;
    bar.innerHTML = '<span class="agg">' + esc(p.name) + '</span>' +
      (p.reads.kind === 'none' ? '<span class="agg">No inbox</span>' :
        '<span class="agg">' + plural(shown, 'submission', 'submissions') + ' in view</span>' +
        (d.total && shown !== d.total ? '<span class="agg">of <b>' + d.total + '</b></span>' : '')) +
      '<span class="push"><span class="agg">' + esc(factsOf(p).where) + '</span></span>';
    return;
  }
  const withInbox = PORTALS.filter(p => p.reads.kind !== 'none');
  const taken = withInbox.reduce((n, p) => n + (factsOf(p).total || 0), 0);
  const down = PORTALS.filter(p => (state.probe[p.id] || {}).state === 'down').length;
  const shut = withInbox.filter(p => !factsOf(p).accepted).length;
  bar.innerHTML = '<span class="agg">' + PORTALS.length + ' front doors</span>' +
    '<span class="agg">' + withInbox.length + ' with an inbox</span>' +
    '<span class="agg good">Received <b>' + taken + '</b></span>' +
    (down ? '<span class="agg owed">Not answering <b>' + down + '</b></span>' : '') +
    (shut ? '<span class="agg owed">No inbox <b>' + shut + '</b></span>' : '');
}

/* The rail's own count beside the view, the way campus.js keeps its own. */
function publish(){
  const el = document.querySelector('#nav [data-ct="portals"]');
  if (el) {
    const bad = PORTALS.filter(p => (state.probe[p.id] || {}).state === 'down').length +
      PORTALS.filter(p => p.reads.kind !== 'none' && !factsOf(p).accepted).length;
    el.textContent = bad ? String(bad) : '';
    el.classList.toggle('warn', !!bad);
  }
}

/* ---------- what is on screen ---------- */
function render(){
  const on = !!state.open;
  $('pl-index').hidden = on;
  $('pl-detail').hidden = !on;
  $('pl-back').hidden = !on;
  /* A door has no rows, so it has nothing to export and no answers to
     search — the controls that would do neither are taken away rather
     than left to refuse. */
  $('pl-csv').hidden = !on || (on && portalOf(state.open).reads.kind === 'none');
  $('pl-q').closest('.srch').hidden = on && portalOf(state.open).reads.kind === 'none';
  $('pl-open').hidden = !on;
  if (on) {
    const p = portalOf(state.open);
    $('pl-open').href = p.path;
    $('pl-open').textContent = 'Open ' + p.path;
    $('pl-q').placeholder = 'Search every answer';
    $('pl-q').setAttribute('aria-label', 'Search this portal’s submissions');
    renderDetail();
  } else {
    $('pl-q').placeholder = 'Search the portals';
    $('pl-q').setAttribute('aria-label', 'Search the portals');
    renderIndex();
  }
  renderAgg();
  publish();
}

/* The view lives in the hash the way every other one does, so a portal is
   a link somebody can send: /internal#/portals/submit. */
function goto(id){
  const hash = '#/portals' + (id ? '/' + encodeURIComponent(id) : '');
  if (location.hash !== hash) location.hash = hash;
  else sync();
}

function sync(){
  const m = /^#\/portals(?:\/(.+))?$/.exec(location.hash || '');
  if (!m) return;
  const id = m[1] ? decodeURIComponent(m[1]) : null;
  const p = id ? portalOf(id) : null;
  const was = state.open;
  state.open = p ? p.id : null;
  if (was !== state.open) { state.pick = null; state.q = ''; $('pl-q').value = ''; }
  render();
  if (p && p.reads.kind !== 'none') pull(p, false);
  /* Asked for whether or not the index is what is on screen: it is what
     the rail's count is drawn from, and a link straight to one portal
     should leave Every portal one click away rather than one wait. */
  loadIndex(false);
}

/* ---------- the controls ---------- */
$('pl-index').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-portal]');
  if (b) goto(b.getAttribute('data-portal'));
});
$('pl-detail').addEventListener('click', ev => {
  if (ev.target.closest('#pl-rec-x')) { state.pick = null; renderDetail(); return; }
  const tr = ev.target.closest('tr[data-pick]');
  if (!tr || ev.target.closest('a')) return;
  const p = portalOf(state.open), rows = visible(p);
  const i = Number(tr.getAttribute('data-pick'));
  if (!rows[i]) return;
  state.pick = state.pick === i ? null : i;
  renderDetail();
});
$('pl-back').addEventListener('click', () => goto(null));
$('pl-q').addEventListener('input', function(){
  state.q = this.value;
  /* A search that no longer shows the open submission must not leave a
     panel beside a table it is not in. */
  state.pick = null;
  if (state.open) renderDetail(); else renderIndex();
  renderAgg();
});
$('pl-refresh').addEventListener('click', () => {
  if (state.open) {
    const p = portalOf(state.open);
    note('Re-reading ' + p.name + '…');
    probe(p);
    if (p.reads.kind !== 'none') pull(p, true).then(() => note('Up to date.'));
    else note('');
  } else {
    state.index = null;
    loadIndex(true);
  }
});
$('pl-csv').addEventListener('click', () => {
  const p = portalOf(state.open);
  if (!p) return;
  const d = state.data[p.id] || {headers:[], rows:[]};
  const rows = visible(p);
  if (!rows.length) { note('Nothing in view to export.', true); return; }
  /* Everything, not the four columns the table had room for: an export
     that quietly drops the long answers is the one nobody can use. */
  const head = ['received'].concat((d.headers.length ? d.headers : headersFrom(rows))
    .filter(h => h && h !== 'received'));
  csv('fomo-portal-' + p.id, head.map(label),
    rows.map(r => head.map(h => h === 'received' ? r.received : (r.cells[h] || ''))));
});

/* ---------- when it reads ----------

   Not until the view is opened, the way the campus tables and the week
   notes are not: the ledger is what the console is opened for, and Apps
   Script answers one request at a time. */
function activated(){
  if (/^#\/portals(\/|$)/.test(location.hash || '')) sync();
}
window.addEventListener('hashchange', activated);
window.addEventListener('fomo:view-change', activated);
window.addEventListener('fomo:identity', () => {
  state.index = null; state.inbox = null; state.data = {}; state.probe = {};
  state.open = null; state.pick = null;
  activated();
});
activated();
