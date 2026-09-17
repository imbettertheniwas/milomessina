/* ══════════ applicants, and the people running a campus ══════════

   Two views over the same Google Sheet the ledger is on, through the same
   Apps Script deployment: `apply` is the tab /fomo/apply writes into, and
   `campus_team` is the roster of interns actually working a campus. The
   endpoint and the console's passcode are handed over on window.FOMO_SHEET
   rather than copied here — one URL to change if it is ever redeployed.

   Nothing is fetched until one of the two views is opened for the first
   time. Both are rendered from the one answer, because the sheet sends
   both tables on every call: the roster says which applicants have already
   been hired, and the applicants are where most roster rows come from. */

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};

/* The five seats, by the value /fomo/apply submits. The colours are the
   console's own category ramp, so a seat tag reads like a category tag. */
const SEATS = [
  {id:'pres',    label:'president',    v:'--s6'},
  {id:'growth',  label:'growth',       v:'--s3'},
  {id:'partner', label:'partnerships', v:'--s1'},
  {id:'content', label:'content',      v:'--s2'},
  {id:'culture', label:'culture',      v:'--s5'}
];
const SEAT = {};
SEATS.forEach(s => { SEAT[s.id] = s; });
const seatOf = id => SEAT[id] || {id:String(id||''), label:String(id||'—'), v:'--s7'};

/* Where an application has got to. `new` is the absence of a decision, so
   it is what an untouched row reads as rather than something anyone sets. */
const APPLY_STATES = [
  {id:'new',       label:'New',       pill:''},
  {id:'reviewing', label:'Reviewing', pill:'blue'},
  {id:'interview', label:'Interview', pill:'purple'},
  {id:'offer',     label:'Offer out', pill:'amber'},
  {id:'hired',     label:'Hired',     pill:'good'},
  {id:'passed',    label:'Passed',    pill:''}
];
const OPEN_STATES = ['new','reviewing','interview','offer'];
const TEAM_STATES = [
  {id:'active', label:'Active', pill:'good'},
  {id:'paused', label:'Paused', pill:'amber'},
  {id:'alumni', label:'Alumni', pill:''}
];
const labelOf = (list, id) => (list.find(s => s.id === id) || {label:String(id||'—'), pill:''});

const STATES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado',
  CT:'Connecticut', DE:'Delaware', DC:'District of Columbia', FL:'Florida', GA:'Georgia',
  HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky',
  LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota',
  MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire',
  NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota',
  OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island',
  SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming'
};

/* The campuses the console already knows where to find — the chapter
   board's own table, kept short on purpose. It only ever prefills the
   state field on a new roster row; anything not here is typed in. */
const CAMPUS_STATE = {
  'arizona state':'AZ', 'clemson':'SC', 'coastal carolina':'SC', 'cornell':'NY',
  'emory':'GA', 'florida international':'FL', 'indiana':'IN', 'ohio state':'OH',
  'ohio university':'OH', 'penn state':'PA', 'pennsylvania state':'PA', 'rutgers':'NJ',
  'salisbury':'MD', 'san diego state':'CA', 'texas christian':'TX', 'michigan':'MI',
  'south carolina':'SC', 'southern california':'CA', 'tampa':'FL', 'virginia tech':'VA',
  'ucla':'CA', 'berkeley':'CA', 'irvine':'CA', 'michigan state':'MI', 'purdue':'IN',
  'wisconsin':'WI', 'minnesota':'MN', 'illinois':'IL', 'iowa':'IA', 'nebraska':'NE',
  'maryland':'MD', 'washington':'WA', 'oregon':'OR', 'texas':'TX', 'florida':'FL',
  'georgia':'GA', 'alabama':'AL', 'auburn':'AL', 'tennessee':'TN', 'kentucky':'KY',
  'missouri':'MO', 'kansas':'KS', 'colorado':'CO', 'utah':'UT', 'arizona':'AZ',
  'syracuse':'NY', 'boston':'MA', 'northeastern':'MA', 'nyu':'NY', 'fordham':'NY'
};
function guessState(campus){
  const s = String(campus || '').toLowerCase();
  if (!s) return '';
  let best = '';
  Object.keys(CAMPUS_STATE).forEach(k => {
    if (s.indexOf(k) > -1 && k.length > best.length) best = k;
  });
  return best ? CAMPUS_STATE[best] : '';
}

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
function daysSince(stamp){
  const t = Date.parse(String(stamp || '').slice(0,10) + 'T00:00:00');
  return t ? Math.max(0, Math.round((Date.now() - t) / 86400000)) : null;
}
function ago(stamp){
  const d = daysSince(stamp);
  return d == null ? '' : d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}
function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }
function seatTag(id){
  const s = seatOf(id);
  return '<span class="tag tint" style="--c:var(' + s.v + ')">' + esc(s.label) + '</span>';
}
function pill(id, list){
  const s = labelOf(list, id);
  return '<span class="pill' + (s.pill ? ' ' + s.pill : '') + '"><i></i>' + esc(s.label) + '</span>';
}
function handle(v){
  const t = String(v || '').trim();
  return t ? (t.charAt(0) === '@' ? t : '@' + t) : '';
}
function link(url, text){
  let u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text || u) + '</a>';
}
function say(msg, bad){
  const t = bridge().toast;
  if (t) t(msg, bad); else note(msg, bad);
}
/* The rail's own count beside these two views, kept by the page that owns
   the rail everywhere else. Written here because nothing in index.html
   knows how many applications are open. */
function navCount(key, value){
  const el = document.querySelector('#nav [data-ct="' + key + '"]');
  if (el) el.textContent = value || '';
}
function note(msg, bad){
  ['ap-msg','cm-msg'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!bad);
  });
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

/* ---------- the sheet ---------- */
const state = {applicants:[], team:[], loaded:false, busy:false, open:null, editing:null};

/* Apps Script answers a plain string body without a preflight, so the
   request carries no headers of its own — the same shape /fomo/apply
   posts with. */
async function call(action, payload){
  const cfg = bridge();
  if (!cfg.endpoint) throw new Error('this console has no sheet endpoint set — see invoice/README.md');
  const body = Object.assign({_api:'campus', action, _key:cfg.key || ''}, payload || {});
  const res = await fetch(cfg.endpoint, {method:'POST', body:JSON.stringify(body)});
  if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
  let out = null;
  try { out = JSON.parse(await res.text()); } catch (e) {}
  if (!out) throw new Error('the endpoint answered, but not with the campus tables. ' +
    'Its deployment access is probably not set to "Anyone"');
  if (out.ok !== true) throw new Error(out.error || 'the sheet turned it away');
  if (!out.applicants) throw new Error('the Apps Script behind this endpoint is an older version — ' +
    'it does not know about the campus tables yet. Redeploy fomo/setup/apps-script.gs ' +
    '(Deploy → Manage deployments → New version)');
  return out;
}

async function run(action, payload, saying){
  if (state.busy) return false;
  state.busy = true;
  note(saying || 'Saving…');
  try {
    const out = await call(action, payload);
    take(out);
    return true;
  } catch (err) {
    note(err.message, true);
    return false;
  } finally {
    state.busy = false;
  }
}

function take(out){
  state.applicants = (out.applicants || []).slice().sort((a,b) =>
    String(b.received || '').localeCompare(String(a.received || '')));
  state.team = (out.team || []).slice().sort((a,b) =>
    String(a.name || '').localeCompare(String(b.name || '')));
  state.loaded = true;
  if (state.open && !state.applicants.some(a => a.id === state.open)) state.open = null;
  renderApplicants();
  renderTeam();
  /* The open application is redrawn here and nowhere else. Filtering or
     searching re-renders the table underneath it, and repainting the panel
     with it would throw away notes somebody was halfway through typing. */
  if (state.open) paintDetail(); else $('ap-detail').hidden = true;
}

async function load(force){
  if (state.busy || (state.loaded && !force)) return;
  state.busy = true;
  note(state.loaded ? 'Re-reading the sheet…' : 'Reading the campus tables…');
  try {
    take(await call('list'));
    note(state.applicants.length || state.team.length
      ? 'Up to date with the sheet.'
      : 'Nothing on either tab yet.');
  } catch (err) {
    note(err.message, true);
  } finally {
    state.busy = false;
  }
}

/* An applicant already on the roster, or null. */
function hiredAs(id){
  return state.team.find(t => t.from && t.from === id) || null;
}

/* ══════════ applicants ══════════ */
let apTab = '', apSeat = '', apCampus = '', apQuery = '';

function apVisible(){
  const q = apQuery.trim().toLowerCase();
  return state.applicants.filter(a => {
    if (apTab === 'open' && OPEN_STATES.indexOf(a.status) === -1) return false;
    if (apTab === 'hired' && a.status !== 'hired') return false;
    if (apTab === 'passed' && a.status !== 'passed') return false;
    if (apSeat && a.seat !== apSeat) return false;
    if (apCampus && a.school !== apCampus) return false;
    if (q) {
      const hay = [a.name, a.email, a.phone, a.school, a.why, a.answer,
                   a.notes, a.tiktok, a.instagram].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function renderApplicants(){
  const all = state.applicants;
  const counts = {open:0, hired:0, passed:0};
  all.forEach(a => {
    if (OPEN_STATES.indexOf(a.status) > -1) counts.open++;
    else if (a.status === 'hired') counts.hired++;
    else if (a.status === 'passed') counts.passed++;
  });
  $('ap-n-all').textContent = all.length || '';
  $('ap-n-open').textContent = counts.open || '';
  $('ap-n-hired').textContent = counts.hired || '';
  $('ap-n-passed').textContent = counts.passed || '';

  /* the campus filter is whatever has actually applied */
  const campuses = [...new Set(all.map(a => a.school).filter(Boolean))].sort();
  const pick = $('ap-campus');
  if (pick.dataset.of !== campuses.join('|')) {
    pick.dataset.of = campuses.join('|');
    pick.innerHTML = '<option value="">Every campus</option>' +
      campuses.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    pick.value = apCampus;
    if (pick.value !== apCampus) { apCampus = ''; pick.value = ''; }
  }

  const list = apVisible();
  $('ap-showing').textContent = list.length === all.length
    ? plural(all.length, 'application', 'applications')
    : list.length + ' of ' + all.length;

  $('ap-body').innerHTML = list.map(a => {
    const on = state.open === a.id;
    return '<tr data-ap="' + esc(a.id) + '"' + (on ? ' class="cm-row-on"' : '') + '>' +
      '<td class="date">' + esc(niceDate(a.received)) + '</td>' +
      '<td class="cm-who"><b>' + esc(a.name || 'no name given') + '</b><small>' + esc(a.email) + '</small></td>' +
      '<td>' + esc(a.school || '—') + '</td>' +
      '<td>' + seatTag(a.seat) + '</td>' +
      '<td class="date">' + esc(a.hours || '—') + '</td>' +
      '<td>' + pill(a.status, APPLY_STATES) + (hiredAs(a.id) ? ' <span class="pill blue"><i></i>on the roster</span>' : '') + '</td>' +
      '</tr>';
  }).join('');

  const empty = $('ap-empty');
  empty.hidden = list.length > 0;
  empty.innerHTML = !all.length
    ? '<b>No applications yet.</b>Everything submitted at /fomo/apply lands on the sheet’s <b style="display:inline">apply</b> tab and shows up here.'
    : '<b>Nothing matches these filters.</b>Clear the search or pick a different seat.';

  navCount('applicants', counts.open);
  $('ap-agg').innerHTML =
    '<span class="agg"><b>' + all.length + '</b> in total</span>' +
    '<span class="agg owed"><b>' + counts.open + '</b> still open</span>' +
    '<span class="agg good"><b>' + counts.hired + '</b> hired</span>' +
    '<span class="agg"><b>' + counts.passed + '</b> passed</span>';
}

function openDetail(id){
  state.open = id;
  renderApplicants();
  paintDetail();
}
function closeDetail(){
  state.open = null;
  $('ap-detail').hidden = true;
  renderApplicants();
}

function paintDetail(){
  const a = state.applicants.find(x => x.id === state.open);
  if (!a) return;
  const box = $('ap-detail');
  box.hidden = false;

  const on = hiredAs(a.id);
  const socials = [
    a.tiktok ? 'TikTok ' + esc(handle(a.tiktok)) : '',
    a.instagram ? 'Instagram ' + esc(handle(a.instagram)) : ''
  ].filter(Boolean).join(' · ');

  const bits = [];
  const add = (label, html) => { if (html) bits.push('<dt>' + esc(label) + '</dt><dd>' + html + '</dd>'); };
  add('Applied', esc(niceDate(a.received)) + (ago(a.received) ? ' <span style="color:var(--muted-2)">· ' + esc(ago(a.received)) + '</span>' : ''));
  add('Campus', esc(a.school || '—') + (a.grad ? ' <span style="color:var(--muted-2)">· graduating ' + esc(a.grad) + '</span>' : ''));
  add('Reach them', '<span class="cm-links">' +
    (a.email ? '<a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a>' : '') +
    (a.phone ? '<a href="tel:' + esc(String(a.phone).replace(/[^\d+]/g,'')) + '">' + esc(a.phone) + '</a>' : '') +
    '</span>');
  add('Where they post', socials || (a.portfolio ? '' : '<span style="color:var(--muted-2)">nothing given</span>'));
  add('Something they made', link(a.portfolio));
  add('Hours a week', esc(a.hours || '—'));
  add('Why this seat', a.why ? '<div class="say">' + esc(a.why) + '</div>' : '');
  add('The seat question', a.answer ? '<div class="say">' + esc(a.answer) + '</div>' : '');
  a.extra.forEach(x => add(x.k, esc(x.v)));
  if (on) add('On the campus team', 'Running ' + esc(on.campus) + ', ' + esc(on.state) +
    ' — ' + esc(labelOf(TEAM_STATES, on.status).label.toLowerCase()));

  box.innerHTML =
    '<div class="cm-detail-h"><h2>' + esc(a.name || 'no name given') +
      '<small>' + esc(seatOf(a.seat).label) + (a.school ? ' · ' + esc(a.school) : '') + '</small></h2>' +
      '<span class="push"><button class="mini ghost" id="ap-close">Close</button></span></div>' +
    '<dl>' + bits.join('') + '</dl>' +
    '<div class="cm-edit">' +
      '<label for="ap-status">Where this has got to' +
        '<select id="ap-status">' + APPLY_STATES.map(s =>
          '<option value="' + s.id + '"' + (s.id === a.status ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') +
        '</select></label>' +
      '<label for="ap-notes">What the team thinks' +
        '<textarea id="ap-notes" maxlength="2000" placeholder="Only the team sees this.">' + esc(a.notes) + '</textarea></label>' +
      '<div class="row"><button class="btn btn-p" id="ap-save" type="button">Save</button>' +
        (on ? '' : '<button class="mini" id="ap-hire" type="button">Put them on a campus →</button>') +
        '</div>' +
    '</div>';

  $('ap-close').addEventListener('click', closeDetail);
  $('ap-save').addEventListener('click', saveApplicant);
  if ($('ap-hire')) $('ap-hire').addEventListener('click', () => hireFrom(a));
}

async function saveApplicant(){
  const a = state.applicants.find(x => x.id === state.open);
  if (!a) return;
  const btn = $('ap-save');
  btn.setAttribute('aria-disabled', 'true');
  const ok = await run('applicant', {id:a.id, status:$('ap-status').value, notes:$('ap-notes').value},
    'Saving this application…');
  btn.removeAttribute('aria-disabled');
  if (ok) { note('Saved to the sheet.'); say('Application updated.'); }
}

/* The hire itself is one call on the roster form — the applicant's own row
   is only marked once the person is actually on a campus, so a half-filled
   form cannot leave an application reading "hired" with nobody running it. */
function hireFrom(a){
  location.hash = '#/campus';
  openForm({
    from: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    seat: a.seat,
    campus: a.school,
    state: guessState(a.school),
    status: 'active',
    started: new Date().toISOString().slice(0,10),
    notes: ''
  });
}

/* ══════════ the campus roster ══════════ */
let cmState = '', cmSeat = '', cmStatus = 'working', cmQuery = '';

function cmVisible(){
  const q = cmQuery.trim().toLowerCase();
  return state.team.filter(t => {
    if (cmStatus === 'working' && t.status === 'alumni') return false;
    if (cmStatus && cmStatus !== 'working' && t.status !== cmStatus) return false;
    if (cmState && t.state !== cmState) return false;
    if (cmSeat && t.seat !== cmSeat) return false;
    if (q && [t.name, t.email, t.campus, t.state, t.notes].join(' ').toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function renderTeam(){
  const all = state.team, list = cmVisible();

  /* the state filter is whatever the roster actually covers */
  const seen = [...new Set(all.map(t => t.state).filter(Boolean))].sort();
  const pick = $('cm-state');
  if (pick.dataset.of !== seen.join('|')) {
    pick.dataset.of = seen.join('|');
    pick.innerHTML = '<option value="">Every state</option>' +
      seen.map(s => '<option value="' + esc(s) + '">' + esc(STATES[s] || s) + '</option>').join('');
    pick.value = cmState;
    if (pick.value !== cmState) { cmState = ''; pick.value = ''; }
  }

  const working = all.filter(t => t.status !== 'alumni');
  const campuses = new Set(working.map(t => t.campus).filter(Boolean));
  const states = new Set(working.map(t => t.state).filter(Boolean));
  const seatsFilled = new Set(working.map(t => t.campus + '|' + t.seat));

  $('cm-rail').innerHTML = [
    {l:'campus interns', v:working.length,
     s:all.length > working.length ? plural(all.length - working.length, 'alum', 'alumni') + ' as well' : 'on a campus right now'},
    {l:'campuses', v:campuses.size, s:campuses.size ? 'with somebody on them' : 'nobody placed yet'},
    {l:'states', v:states.size, s:states.size ? [...states].sort().join(' · ') : 'no state covered yet'},
    {l:'seats filled', v:seatsFilled.size + ' / ' + (campuses.size * 5),
     s:'five seats on every campus'}
  ].map(k => '<div><span class="lbl">' + esc(k.l) + '</span><span class="v">' + esc(String(k.v)) +
      '</span><span class="sub">' + esc(k.s) + '</span></div>').join('');

  $('cm-showing').textContent = list.length === all.length
    ? plural(all.length, 'person', 'people')
    : list.length + ' of ' + all.length;

  /* state → campus → the people on it */
  const byState = {};
  list.forEach(t => {
    const st = t.state || '—';
    (byState[st] = byState[st] || {})[t.campus || '—'] = (byState[st][t.campus || '—'] || []).concat(t);
  });

  $('cm-groups').innerHTML = Object.keys(byState).sort((a,b) =>
    (STATES[a] || a).localeCompare(STATES[b] || b)).map(st => {
    const campusNames = Object.keys(byState[st]).sort();
    const heads = campusNames.reduce((n,c) => n + byState[st][c].length, 0);
    return '<div class="cm-group"><div class="cm-group-h">' +
      '<h2>' + esc(STATES[st] || st) + '</h2>' +
      '<span class="note">' + plural(campusNames.length, 'campus', 'campuses') + ' · ' +
        plural(heads, 'intern', 'interns') + '</span></div>' +
      '<div class="cm-campuses">' + campusNames.map(c => {
        const people = byState[st][c].slice().sort((a,b) =>
          SEATS.findIndex(s => s.id === a.seat) - SEATS.findIndex(s => s.id === b.seat));
        return '<div class="cm-campus">' +
          '<div class="cm-campus-h"><b>' + esc(c) + '</b>' +
            '<span class="note">' + people.length + '/5 seats</span></div>' +
          '<div class="cm-people">' + people.map(t =>
            '<button type="button" class="cm-person' + (t.status === 'active' ? '' : ' off') +
              '" data-cm="' + esc(t.id) + '">' +
              '<span class="nm"><b>' + esc(t.name) + '</b><small>' +
                esc(t.email || 'no email on file') + '</small></span>' +
              seatTag(t.seat) +
              (t.status === 'active' ? '' : pill(t.status, TEAM_STATES)) +
            '</button>').join('') + '</div></div>';
      }).join('') + '</div></div>';
  }).join('');

  const empty = $('cm-empty');
  empty.hidden = list.length > 0;
  empty.innerHTML = !all.length
    ? '<b>Nobody is on a campus yet.</b>Hire somebody out of <b style="display:inline">Applicants</b> and they land here, ' +
      'or add them by hand with <b style="display:inline">Add an intern</b>.'
    : '<b>Nothing matches these filters.</b>Try every state, or a different seat.';

  navCount('campus', working.length);
  $('cm-agg').innerHTML =
    '<span class="agg"><b>' + working.length + '</b> on a campus</span>' +
    '<span class="agg"><b>' + campuses.size + '</b> ' + (campuses.size === 1 ? 'campus' : 'campuses') + '</span>' +
    '<span class="agg"><b>' + states.size + '</b> ' + (states.size === 1 ? 'state' : 'states') + '</span>';
}

/* ---------- adding and editing one of them ---------- */
function openForm(row){
  state.editing = row;
  const form = $('cm-form');
  form.hidden = false;
  $('cm-form-t').textContent = row.id ? 'Edit ' + row.name
    : row.from ? 'Put ' + (row.name || 'them') + ' on a campus'
    : 'Add a campus intern';
  $('cm-f-name').value = row.name || '';
  $('cm-f-email').value = row.email || '';
  $('cm-f-phone').value = row.phone || '';
  $('cm-f-seat').value = row.seat || 'content';
  $('cm-f-campus').value = row.campus || '';
  $('cm-f-state').value = row.state || '';
  $('cm-f-status').value = row.status || 'active';
  $('cm-f-started').value = row.started || '';
  $('cm-f-notes').value = row.notes || '';
  $('cm-delete').hidden = !row.id;
  $('cm-f-hint').textContent = row.from && !row.id
    ? 'Saving this also marks their application hired.'
    : '';
  form.scrollIntoView({block:'nearest'});
  ($('cm-f-state').value ? $('cm-f-name') : $('cm-f-state')).focus();
}
function closeForm(){
  state.editing = null;
  $('cm-form').hidden = true;
}

async function saveTeam(ev){
  ev.preventDefault();
  const row = state.editing;
  if (!row) return;
  const payload = {
    id: row.id || '',
    from: row.from || '',
    name: $('cm-f-name').value.trim(),
    email: $('cm-f-email').value.trim(),
    phone: $('cm-f-phone').value.trim(),
    seat: $('cm-f-seat').value,
    campus: $('cm-f-campus').value.trim(),
    state: $('cm-f-state').value.trim().toUpperCase(),
    status: $('cm-f-status').value,
    started: $('cm-f-started').value,
    notes: $('cm-f-notes').value
  };
  const action = row.id ? 'teamupdate' : row.from ? 'hire' : 'teamadd';
  /* `hire` is keyed on the application, not on a roster row that does not
     exist yet — everything else about the row rides along with it. */
  if (action === 'hire') payload.id = row.from;

  const ok = await run(action, payload, 'Writing to the sheet…');
  if (!ok) return;
  closeForm();
  note(action === 'teamupdate' ? 'Roster updated.' : 'They are on the campus team.');
  say(action === 'teamupdate' ? 'Roster updated.' : payload.name + ' is on ' + payload.campus + '.');
}

async function removeTeam(){
  const row = state.editing;
  if (!row || !row.id) return;
  if (!confirm('Take ' + row.name + ' off the campus roster? Their application, if they came from one, stays as it is.')) return;
  const ok = await run('teamdelete', {id:row.id}, 'Removing them…');
  if (!ok) return;
  closeForm();
  note('Taken off the roster.');
  say('Taken off the roster.');
}

/* ══════════ wiring ══════════ */
$('ap-tabs').addEventListener('click', ev => {
  const b = ev.target.closest('[data-ap]');
  if (!b) return;
  apTab = b.getAttribute('data-ap');
  [...$('ap-tabs').children].forEach(x => x.classList.toggle('on', x === b));
  renderApplicants();
});
$('ap-seat').addEventListener('change', function(){ apSeat = this.value; renderApplicants(); });
$('ap-campus').addEventListener('change', function(){ apCampus = this.value; renderApplicants(); });
$('ap-q').addEventListener('input', function(){ apQuery = this.value; renderApplicants(); });
$('ap-refresh').addEventListener('click', () => load(true));
$('ap-body').addEventListener('click', ev => {
  const tr = ev.target.closest('tr[data-ap]');
  if (!tr) return;
  const id = tr.getAttribute('data-ap');
  if (state.open === id) closeDetail(); else openDetail(id);
});
$('ap-csv').addEventListener('click', () => {
  const list = apVisible();
  if (!list.length) { say('Nothing to export with these filters.', true); return; }
  csv('fomo-applicants',
    ['received','name','email','phone','campus','grad_year','seat','hours','status',
     'tiktok','instagram','portfolio','why_this_seat','seat_answer','team_notes'],
    list.map(a => [String(a.received).slice(0,10), a.name, a.email, a.phone, a.school, a.grad,
      seatOf(a.seat).label, a.hours, a.status, a.tiktok, a.instagram, a.portfolio,
      a.why, a.answer, a.notes]));
  say('Applicants exported.');
});

$('cm-state').addEventListener('change', function(){ cmState = this.value; renderTeam(); });
$('cm-seat').addEventListener('change', function(){ cmSeat = this.value; renderTeam(); });
$('cm-status').addEventListener('change', function(){ cmStatus = this.value; renderTeam(); });
$('cm-q').addEventListener('input', function(){ cmQuery = this.value; renderTeam(); });
$('cm-refresh').addEventListener('click', () => load(true));
$('cm-new').addEventListener('click', () => openForm({status:'active', seat:'content'}));
$('cm-cancel').addEventListener('click', closeForm);
$('cm-delete').addEventListener('click', removeTeam);
$('cm-form').addEventListener('submit', saveTeam);
$('cm-groups').addEventListener('click', ev => {
  const b = ev.target.closest('[data-cm]');
  if (!b) return;
  const row = state.team.find(t => t.id === b.getAttribute('data-cm'));
  if (row) openForm(Object.assign({}, row));
});
/* A campus typed in by hand usually knows its own state. */
$('cm-f-campus').addEventListener('change', function(){
  if ($('cm-f-state').value) return;
  const guess = guessState(this.value);
  if (guess) $('cm-f-state').value = guess;
});
$('cm-csv').addEventListener('click', () => {
  const list = cmVisible();
  if (!list.length) { say('Nothing to export with these filters.', true); return; }
  csv('fomo-campus-team',
    ['name','email','phone','seat','campus','state','status','started','notes'],
    list.map(t => [t.name, t.email, t.phone, seatOf(t.seat).label, t.campus,
      STATES[t.state] || t.state, t.status, t.started, t.notes]));
  say('Campus team exported.');
});

/* the two selects that are the same on every load */
$('ap-seat').innerHTML = '<option value="">Every seat</option>' +
  SEATS.map(s => '<option value="' + s.id + '">' + esc(s.label) + '</option>').join('');
$('cm-seat').innerHTML = '<option value="">Every seat</option>' +
  SEATS.map(s => '<option value="' + s.id + '">' + esc(s.label) + '</option>').join('');
$('cm-f-seat').innerHTML = SEATS.map(s =>
  '<option value="' + s.id + '">' + esc(s.label) + '</option>').join('');
$('cm-f-status').innerHTML = TEAM_STATES.map(s =>
  '<option value="' + s.id + '">' + esc(s.label) + '</option>').join('');
$('cm-f-state').innerHTML = '<option value="">pick a state</option>' +
  Object.keys(STATES).map(s =>
    '<option value="' + s + '">' + esc(STATES[s]) + '</option>').join('');

/* Nothing is read until one of the two views is actually opened — the
   ledger is what the console is opened for, and it should not wait behind
   a second round trip to Apps Script. */
function activated(){
  const hash = location.hash;
  if (hash === '#/applicants' || hash === '#/campus') load(false);
}
window.addEventListener('hashchange', activated);
window.addEventListener('fomo:view-change', activated);
activated();
